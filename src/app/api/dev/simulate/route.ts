import { NextRequest, NextResponse } from 'next/server';
import { processInboundMessage } from '@/lib/actions/processInbound';
import { publishTreeUpdate } from '@/lib/events';
import { resolveLocationSlug, locationLabel } from '@/lib/locations';
import { devToolsEnabled } from '@/lib/devGuard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// DEV-ONLY simulator. Lets you exercise the real-time loop without Twilio/ngrok:
// it runs a dummy "text message" through the exact same pipeline a real SMS
// would, OR just fires an SSE event so you can watch a kiosk flash/redraw.
//
// ⚠️ This bypasses the webhook signature + clinician allowlist, so it is hard
// disabled in production. Set ENABLE_DEV_SIMULATE=true only if you deliberately
// want it on a deployed (non-local) instance for a demo.
// ---------------------------------------------------------------------------

const DEFAULT_TEXT = 'Close the bladder trial at City of Hope, we hit accrual';
const DEFAULT_SENDER = '+16265550150'; // seeded: Dr. Andre Okafor (City of Hope)

type Mode = 'full' | 'flash';
type SimulateParams = { text: string; location: string | null; sender: string; mode: Mode };

async function run(params: SimulateParams) {
  const { text, location, sender, mode } = params;

  if (mode === 'flash') {
    // No parser, no DB write — just push an SSE event so the kiosk flashes.
    // Useful before you have ANTHROPIC_API_KEY / a seeded database.
    const slug = resolveLocationSlug(location) ?? 'all';
    const event = publishTreeUpdate({
      location: slug,
      action: 'SIMULATED',
      summary: text || `Simulated update for ${locationLabel(slug)}`,
    });
    if (slug !== 'all') {
      publishTreeUpdate({ location: 'all', action: 'SIMULATED', summary: event.summary });
    }
    return { mode, status: 'FLASHED', message: event.summary };
  }

  // full: the real pipeline — Anthropic parser → confidence gate → DB mutation
  // → publishTreeUpdate(). This is what a genuine inbound SMS triggers.
  const result = await processInboundMessage({
    source: 'SMS',
    sender,
    rawText: text,
    homeLocationSlug: resolveLocationSlug(location),
  });
  return { mode, ...result };
}

export async function POST(req: NextRequest) {
  if (!devToolsEnabled()) return new NextResponse('Not found', { status: 404 });
  const body = (await req.json().catch(() => ({}))) as Partial<SimulateParams>;
  const result = await run({
    text: body.text ?? DEFAULT_TEXT,
    location: body.location ?? null,
    sender: body.sender ?? DEFAULT_SENDER,
    mode: body.mode === 'flash' ? 'flash' : 'full',
  });
  return NextResponse.json(result);
}

// GET is for quick browser/curl testing. It defaults to the safe "flash" mode
// (no DB write); pass ?mode=full to run the whole pipeline.
export async function GET(req: NextRequest) {
  if (!devToolsEnabled()) return new NextResponse('Not found', { status: 404 });
  const sp = new URL(req.url).searchParams;
  const result = await run({
    text: sp.get('text') ?? DEFAULT_TEXT,
    location: sp.get('location'),
    sender: sp.get('sender') ?? DEFAULT_SENDER,
    mode: sp.get('mode') === 'full' ? 'full' : 'flash',
  });
  return NextResponse.json(result);
}
