import { watchChanges } from "../api.js";
import { createDebouncer } from "../debounce.js";
import { react } from "../react.js";

/** Quiet period a burst of invalidations has to hold before the tab re-reads. */
export const AUTO_REFRESH_DEBOUNCE_MS = 1000;

/** Wait before reopening a stream the Host dropped. */
export const AUTO_REFRESH_RETRY_MS = 2000;

/**
 * Keep the open tab current without polling and without waiting for a turn to close:
 * the Host streams one frame per listed-file invalidation and one per committed
 * `workspace/changes`, and a burst of frames coalesces into a single re-read.
 *
 * The stream only exists while the tab is visible, and the ref keeps the effect from
 * reopening it on every render (the feed rebuilds `refresh` each pass). A stream that
 * ends after delivering frames is reopened, because a Host restart should not leave
 * the tab stale; a stream that never opened is left alone — the tab still reads on
 * open, and a Host without the watch route cannot be healed by retrying.
 *
 * `clientId` identifies this tab, so the Host can omit the frames its own review
 * writes caused; the write handler already re-read the same data.
 *
 * @param input - `{ sessionId, visible, refresh, clientId }`.
 */
export function useAutoRefresh({ sessionId, visible, refresh, clientId }) {
  const latest = react.useRef(refresh);
  react.useEffect(() => {
    latest.current = refresh;
  });

  react.useEffect(() => {
    if (visible === false) return undefined;
    if (typeof sessionId !== "string" || sessionId === "") return undefined;
    let live = true;
    let opened = false;
    let retry = undefined;
    const controller = new AbortController();
    const debouncer = createDebouncer(AUTO_REFRESH_DEBOUNCE_MS, () => latest.current());

    const connect = async () => {
      try {
        await watchChanges(sessionId, {
          signal: controller.signal,
          clientId,
          onOpen: () => {
            opened = true;
          },
          onFrame: (frame) => {
            if (frame.t === "file" || frame.t === "turn") debouncer.schedule();
          },
        });
      } catch (_error) {
        // Leaving a reading tab quiet is better than a reconnect storm.
      }
      if (!live || !opened) return;
      retry = setTimeout(connect, AUTO_REFRESH_RETRY_MS);
    };
    void connect();

    return () => {
      live = false;
      controller.abort();
      debouncer.dispose();
      if (retry !== undefined) clearTimeout(retry);
    };
  }, [sessionId, visible, clientId]);
}
