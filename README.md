# TrialTree

Real-time clinical decision-tree mapping for **Genitourinary (GU) oncology trials** across
Southern California (City of Hope, UCLA, UCSD, UCI, USC). Built to drive **patient accrual**: a
single living map of every recruiting trial by disease type → disease state → line of therapy,
displayed on clinic **kiosks**, and updatable by an authorized clinician **texting or emailing** a
plain-English change.

```
Clinician texts "Close the bladder Phase II at City of Hope"
        │
        ▼
 Twilio  ──►  /api/webhooks/sms  ──►  verify signature + clinician allowlist
                                          │
                                          ▼
                                AI parser (structured JSON action)
                                          │
                       confidence ≥ 85% ──┤── confidence < 85%
                              │            └────────────► admin review queue
                              ▼
                      executor mutates Postgres
                              │
                              ▼
                  publishTreeUpdate() ──► SSE /api/events
                              │
                              ▼
              Kiosk TVs flash + redraw the tree (no refresh)
```

## Tech stack

| Layer            | Choice                                                              |
| ---------------- | ------------------------------------------------------------------ |
| Frontend + API   | **Next.js 14 (App Router)** — one repo for UI, webhooks, SSE        |
| Tree rendering   | **React Flow (`@xyflow/react`)** + **dagre** auto-layout           |
| Real-time        | **Server-Sent Events** + in-process pub/sub bus                    |
| AI parser        | **Claude strict tool use** (default) or **OpenAI structured outputs** — one env var |
| Database         | **PostgreSQL** via **Prisma**                                      |
| Inbound SMS/email| **Twilio** (signed) + **SendGrid Inbound Parse** (shared secret)   |

> **Why one Next.js app instead of Node + FastAPI?** The webhooks, AI parser, real-time stream, and
> both frontends share types and a single auth surface — co-locating them removes cross-service CORS
> and signature-forwarding headaches. If you prefer a Python service, the AI parser
> (`src/lib/ai/`) and executor (`src/lib/actions/`) map 1:1 onto FastAPI routes; keep Next.js for the
> frontend and point its webhooks at the FastAPI base URL.

## File structure

```
trialtree/
├── prisma/
│   ├── schema.prisma          # tree topology: DecisionNode (self-ref), Trial, TrialLocation, Cohort, Clinician, ActionLog
│   └── seed.ts                # SoCal GU seed data (prostate@UCLA, bladder@COH, renal@UCI, ...)
├── src/
│   ├── app/
│   │   ├── page.tsx                       # landing / index of kiosks
│   │   ├── admin/
│   │   │   ├── page.tsx + AdminClient.tsx # interactive desktop tree (pan/zoom/filter)
│   │   │   └── review/                     # low-confidence approval queue
│   │   ├── kiosk/[location]/
│   │   │   ├── page.tsx                    # validates slug
│   │   │   └── KioskClient.tsx             # full-screen, no-chrome, live + QR
│   │   └── api/
│   │       ├── webhooks/sms/route.ts       # Twilio inbound (signed)
│   │       ├── webhooks/email/route.ts     # SendGrid Inbound Parse (token)
│   │       ├── tree/route.ts               # GET serialized tree
│   │       ├── events/route.ts             # SSE stream
│   │       └── admin/{pending,approve}/    # review queue API
│   ├── components/
│   │   ├── TreeFlow.tsx                    # React Flow canvas (kiosk + admin modes)
│   │   ├── nodes/{DecisionNode,TrialNode}.tsx
│   │   ├── QRCodeBlock.tsx                 # sms: deep-link QR
│   │   ├── Sidebar.tsx                     # hospital/PI filters
│   │   └── useTreeStream.ts                # fetch + SSE hook
│   ├── lib/
│   │   ├── db.ts                           # Prisma singleton
│   │   ├── events.ts                       # pub/sub bus (LISTEN/NOTIFY upgrade documented)
│   │   ├── locations.ts                    # 5 SoCal centers + fuzzy slug resolver
│   │   ├── auth/{verifyTwilio,verifyEmail}.ts
│   │   ├── ai/{schema,prompt,parser}.ts    # zod schema + system prompt + LLM call
│   │   ├── actions/executor.ts             # resolve target + mutate DB + publish event
│   │   └── tree/buildTree.ts               # TreeData -> React Flow nodes/edges (dagre)
│   └── types/index.ts
├── docker-compose.yml          # local Postgres
└── .env.example
```

## Local setup (the full pipeline)

> **Prerequisites:** Node 18+ and npm, Docker (for Postgres), and a tunnel for webhooks
> (`ngrok` or `cloudflared`). **This machine has no Node installed** — provision Node/Docker first,
> or deploy straight to Vercel + a hosted Postgres (Neon/Supabase) and skip Docker.

```bash
# 1. Install
npm install

# 2. Start Postgres + load schema + seed
docker compose up -d
cp .env.example .env          # then fill in the values below
npm run db:push               # creates tables from schema.prisma
npm run db:seed               # loads SoCal GU trials

# 3. Run
npm run dev                   # http://localhost:3000
```

Open:

- **Admin tree:** http://localhost:3000/admin
- **Kiosk (City of Hope):** http://localhost:3000/kiosk/city-of-hope
- **Kiosk in E-Ink mode:** http://localhost:3000/kiosk/city-of-hope?display=eink
- **Review queue:** http://localhost:3000/admin/review

### Environment variables

| Variable                       | What it is                                                                                   |
| ------------------------------ | -------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                 | Postgres connection string (Docker default works out of the box).                            |
| `OPENAI_API_KEY`               | OpenAI key for the parser. `OPENAI_MODEL` defaults to a structured-outputs-capable model.    |
| `AI_AUTOAPPLY_THRESHOLD`       | Confidence % at/above which actions auto-apply (default **85**).                             |
| `TWILIO_AUTH_TOKEN`            | Twilio Auth Token — used to verify `X-Twilio-Signature`. (`TWILIO_WEBHOOK_SECRET` is an alias.) |
| `PUBLIC_BASE_URL`              | Public URL Twilio calls, e.g. your ngrok/Vercel URL — used to reconstruct the signed URL.    |
| `INBOUND_PARSE_SECRET`         | Random secret appended to the SendGrid Inbound Parse URL as `?token=...`.                     |
| `ALLOWED_EMAIL_DOMAINS`        | Comma-separated allowlist of clinician email domains.                                         |
| `NEXT_PUBLIC_SMS_NUMBER`       | The Twilio number rendered into kiosk QR codes.                                               |

### Wiring the webhooks

1. **Tunnel:** `ngrok http 3000` → copy the https URL into `PUBLIC_BASE_URL`.
2. **Twilio:** Phone Number → Messaging → *A message comes in* → Webhook
   `POST https://<tunnel>/api/webhooks/sms`.
3. **SendGrid:** Settings → Inbound Parse → Add Host & URL →
   `POST https://<tunnel>/api/webhooks/email?token=<INBOUND_PARSE_SECRET>`.

### Try it end-to-end

From an **authorized** seeded number/email (e.g. Dr. Andre Okafor, `+16265550150`), text the Twilio
number:

```
Close the Phase II bladder trial at City of Hope, we hit accrual
```

→ parser returns `CLOSE_TRIAL` / shorthand `Phase II bladder trial` / `City of Hope` at ~88% →
auto-applies → the `/kiosk/city-of-hope` board flashes and the trial flips to **Waitlisted** live.
Low-confidence messages land in `/admin/review` instead.

## Deploy a test instance (Railway)

> **Why not Vercel:** the live kiosk redraw uses a long-lived SSE connection + an in-process event
> bus, which needs a single long-running Node process. Vercel's serverless functions time out and
> don't share memory, so deploy to **Railway** (or Render) — one always-on service.

No local Node required; Railway builds in the cloud. `railway.json` runs `prisma db push` on every
boot (creates the tables), so the only manual data step is hitting the seed URL once.

1. **Push to GitHub.** Create an empty repo, then from the `trialtree/` folder:
   `git remote add origin <your-repo-url> && git push -u origin main`.
2. **New Railway project** → *Deploy from GitHub repo* → pick the repo.
3. In the project, **+ New → Database → PostgreSQL** (Railway sets `DATABASE_URL` automatically).
4. On the app service, add **Variables**:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`  (reference the Postgres service)
   - `ANTHROPIC_API_KEY` = your key
   - `ENABLE_DEV_SIMULATE` = `true`  (lets you seed + simulate on the deployed instance)
   - `NEXT_PUBLIC_SMS_NUMBER` = any number for now (rendered into the kiosk QR)
5. Wait for the deploy, then open your Railway URL and:
   - `https://<app>/api/dev/import` once → pulls **real** recruiting GU trials from
     ClinicalTrials.gov for the 5 SoCal centers. (Or `/api/dev/seed` for the hand-made demo set.)
   - `https://<app>/kiosk/city-of-hope` on one screen.
   - `https://<app>/api/dev/simulate?location=city-of-hope&mode=flash` on another → kiosk flashes.
   - `https://<app>/admin` for the interactive tree.

> ⚠️ `ENABLE_DEV_SIMULATE` and the `--accept-data-loss` push flag are for a throwaway **test**
> instance only. For production, remove the flag and run real `prisma migrate` migrations.

## The AI action contract

The LLM is constrained to emit exactly this shape — on Claude via **strict tool use** (a forced
`emit_trial_action` tool whose `input_schema` is the strict JSON Schema in
[`src/lib/ai/schema.ts`](src/lib/ai/schema.ts)), and on OpenAI via Structured Outputs:

```jsonc
{
  "action": "CLOSE_TRIAL | OPEN_TRIAL | ADD_COHORT | UPDATE_CRITERIA | UNKNOWN",
  "target_trial_identifier": { "nct_id": null, "protocol_number": null, "shorthand": "Phase II bladder trial" },
  "location": "City of Hope",
  "payload": { "new_status": "WAITLISTED", "cohort_label": null, "criteria_text": null, "notes": null },
  "confidence_score": 88,
  "reasoning": "Clinician says the bladder Phase II hit accrual at COH."
}
```

The full system prompt lives in [`src/lib/ai/prompt.ts`](src/lib/ai/prompt.ts).

### Choosing the backend

Both are implemented in [`src/lib/ai/parser.ts`](src/lib/ai/parser.ts) and return the identical
validated `ParsedAction`; switching is one env var:

- **`AI_PROVIDER=anthropic`** (default) + `ANTHROPIC_API_KEY`. Uses Claude strict tool use.
  `ANTHROPIC_MODEL` defaults to `claude-opus-4-8` (highest accuracy); set `claude-sonnet-4-6` for a
  cheaper/faster high-volume classifier.
- **`AI_PROVIDER=openai`** + `OPENAI_API_KEY`. Uses OpenAI Structured Outputs.

The whole inbound pipeline — parse, then the confidence gate that auto-applies or queues for review
— is the single service [`processInboundMessage()`](src/lib/actions/processInbound.ts), which both
webhooks call.

## Security hardening (before production)

- [ ] Put `/admin/**` and `/api/admin/**` behind SSO/auth middleware (NextAuth, Clerk, or your IdP).
      The endpoints are written but **not yet auth-gated** — see the notes in those files.
- [ ] Add per-sender rate limiting on the webhooks.
- [ ] Move the SSE bus to Postgres `LISTEN/NOTIFY` or Redis if you run more than one instance
      (call sites already abstracted in `src/lib/events.ts`).
- [ ] Keep PHI out of messages; the prompt instructs the model to drop patient identifiers, but add a
      regex scrub on `rawText` before storage if your compliance posture requires it.
- [ ] Rotate `INBOUND_PARSE_SECRET` and `TWILIO_AUTH_TOKEN` via your secret manager.

## Implementation roadmap

1. **MVP (this repo):** seed → admin tree + kiosks → SMS pipeline with auto-apply + review queue.
2. **Auth + audit:** SSO on admin, signed-in PIs manage their own trials, full `ActionLog` history UI.
3. **Accrual analytics:** track scans-per-kiosk and status changes → dashboard of which boards drive
   referrals; A/B test kiosk layouts against accrual.
4. **ClinicalTrials.gov sync:** nightly job to reconcile `nctId` status with the federal registry and
   flag drift for review.
5. **Scale-out:** Postgres `LISTEN/NOTIFY` bus, multi-region kiosks, offline cache for E-Ink panels.
```
