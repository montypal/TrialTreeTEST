import { EventEmitter } from 'node:events';

// ---------------------------------------------------------------------------
// In-process pub/sub bus that powers the SSE stream (/api/events).
//
// When a webhook mutates the tree it calls publishTreeUpdate(); every SSE
// connection subscribed to that location (or to "all") receives the event and
// pushes it to the kiosk, which redraws without a refresh.
//
// SCALING NOTE: an EventEmitter only reaches listeners in the SAME Node
// process. For a single long-running `next start` server (the recommended
// kiosk deployment) that is exactly what you want. To run multiple instances
// behind a load balancer, replace the body of publishTreeUpdate/subscribe with
// Postgres LISTEN/NOTIFY or Redis pub/sub — the call sites do not change.
// A ready-to-use Postgres bridge is sketched at the bottom of this file.
// ---------------------------------------------------------------------------

export type TreeUpdateEvent = {
  type: 'tree-updated';
  /** Location slug that changed, or "all" for global changes. */
  location: string;
  /** What happened, for the kiosk toast / log. */
  action: string;
  /** Optional human summary, e.g. "Bladder trial closed at City of Hope". */
  summary?: string;
  at: string; // ISO timestamp
};

// Reuse one emitter across hot reloads.
const globalForBus = globalThis as unknown as { trialTreeBus?: EventEmitter };
const bus = globalForBus.trialTreeBus ?? new EventEmitter();
bus.setMaxListeners(0); // kiosks can hold many concurrent SSE connections
if (process.env.NODE_ENV !== 'production') globalForBus.trialTreeBus = bus;

const CHANNEL = 'tree-updated';

export function publishTreeUpdate(event: Omit<TreeUpdateEvent, 'type' | 'at'>) {
  const full: TreeUpdateEvent = { type: 'tree-updated', at: new Date().toISOString(), ...event };
  bus.emit(CHANNEL, full);
  return full;
}

/**
 * Subscribe to tree updates for a given location slug (or "all"). Returns an
 * unsubscribe function. A subscriber listening on "all" receives every event;
 * a location-specific subscriber receives its own location plus "all" events.
 */
export function subscribeTreeUpdates(
  location: string,
  handler: (event: TreeUpdateEvent) => void,
): () => void {
  const listener = (event: TreeUpdateEvent) => {
    if (location === 'all' || event.location === 'all' || event.location === location) {
      handler(event);
    }
  };
  bus.on(CHANNEL, listener);
  return () => bus.off(CHANNEL, listener);
}

// ---------------------------------------------------------------------------
// OPTIONAL multi-instance bridge (uncomment + `npm i pg`):
//
// import { Client } from 'pg';
// const pg = new Client({ connectionString: process.env.DATABASE_URL });
// await pg.connect();
// await pg.query('LISTEN tree_updated');
// pg.on('notification', (msg) => bus.emit(CHANNEL, JSON.parse(msg.payload!)));
// // and in publishTreeUpdate also: pg.query("SELECT pg_notify('tree_updated', $1)", [JSON.stringify(full)]);
// ---------------------------------------------------------------------------
