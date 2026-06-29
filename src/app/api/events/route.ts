import { NextRequest } from 'next/server';
import { subscribeTreeUpdates, type TreeUpdateEvent } from '@/lib/events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Disable Next's response buffering so events flush immediately.
export const fetchCache = 'force-no-store';

/**
 * GET /api/events?location=<slug>
 * Server-Sent Events stream. The kiosk (and admin view) subscribe here; when a
 * webhook mutates the tree, publishTreeUpdate() pushes an event down every
 * matching connection and the client refetches /api/tree + redraws.
 */
export async function GET(req: NextRequest) {
  const location = new URL(req.url).searchParams.get('location') || 'all';
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: TreeUpdateEvent | { type: 'ping' }) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      // Initial hello so the client knows the stream is live.
      send({ type: 'tree-updated', location, action: 'CONNECTED', at: new Date().toISOString() });

      const unsubscribe = subscribeTreeUpdates(location, (event) => send(event));

      // Heartbeat keeps proxies/load balancers from closing an idle connection.
      const heartbeat = setInterval(() => send({ type: 'ping' }), 25_000);

      // Clean up when the client (kiosk) disconnects.
      const close = () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      req.signal.addEventListener('abort', close);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // disable nginx buffering
    },
  });
}
