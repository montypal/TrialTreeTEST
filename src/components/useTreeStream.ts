'use client';

import { useCallback, useEffect, useState } from 'react';
import type { TreeData, TreeFilter } from '@/types';

type StreamState = {
  data: TreeData | null;
  loading: boolean;
  /** Bumped every time a live update arrives, so callers can trigger a flash. */
  updateTick: number;
  lastSummary: string | null;
  connected: boolean;
};

/** How often to do a defensive full refetch in case a live event was missed. */
const POLL_FALLBACK_MS = 5 * 60 * 1000;
/** Backoff before manually recreating an EventSource the browser closed. */
const RECONNECT_MS = 3000;

/**
 * Loads /api/tree and keeps it fresh via the /api/events SSE stream.
 * Used by both the kiosk and the admin canvas.
 *
 * Built for an UNATTENDED display: it manually reconnects if the browser gives
 * up on the stream, and runs a slow full refetch as a safety net so a kiosk
 * self-heals after a network blip instead of sitting stale until someone notices.
 */
export function useTreeStream(filter: TreeFilter = {}): StreamState & { refetch: () => void } {
  const [state, setState] = useState<StreamState>({
    data: null,
    loading: true,
    updateTick: 0,
    lastSummary: null,
    connected: false,
  });
  const locationForStream = filter.locationSlug || 'all';

  const refetch = useCallback(async () => {
    try {
      const res = await fetch('/api/tree', { cache: 'no-store' });
      if (res.ok) {
        const data = (await res.json()) as TreeData;
        setState((s) => ({ ...s, data, loading: false }));
      }
    } catch {
      /* transient network error — the next poll or event will retry */
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const open = () => {
      es = new EventSource(`/api/events?location=${encodeURIComponent(locationForStream)}`);

      es.onopen = () => setState((s) => ({ ...s, connected: true }));

      es.onmessage = (evt) => {
        let payload: { type?: string; action?: string; summary?: string };
        try {
          payload = JSON.parse(evt.data);
        } catch {
          return;
        }
        if (payload.type === 'ping' || payload.action === 'CONNECTED') return;
        // A real tree change: refetch + signal a redraw/flash.
        refetch();
        setState((s) => ({
          ...s,
          updateTick: s.updateTick + 1,
          lastSummary: payload.summary ?? payload.action ?? 'Updated',
        }));
      };

      es.onerror = () => {
        setState((s) => ({ ...s, connected: false }));
        // EventSource auto-reconnects while readyState === CONNECTING. If it has
        // given up (CLOSED), recreate it after a short backoff.
        if (es && es.readyState === EventSource.CLOSED && !stopped) {
          es.close();
          es = null;
          reconnectTimer = setTimeout(open, RECONNECT_MS);
        }
      };
    };

    open();
    const poll = setInterval(refetch, POLL_FALLBACK_MS);

    return () => {
      stopped = true;
      clearInterval(poll);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      es?.close();
    };
  }, [locationForStream, refetch]);

  return { ...state, refetch };
}
