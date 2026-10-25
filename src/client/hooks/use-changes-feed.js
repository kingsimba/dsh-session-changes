import { readDiff, readTurns } from "../api.js";
import { react } from "../react.js";
import { entryKey } from "../selection.js";

/**
 * The Session's changed-file feed: the turn list, the per-entry comparisons, the
 * in-memory cache that survives a re-selection, and the refresh counter that
 * reloads all of it.
 *
 * The turn read always clears the cache, so Refresh cannot serve a payload the Host
 * has since replaced.
 *
 * @param input - `{ sessionId, visible, selected }`.
 * @returns `{ state, diffs, nonce, refresh, retryEntry }`.
 */
export function useChangesFeed({ sessionId, visible, selected }) {
  const cache = react.useRef(new Map());
  const [state, setState] = react.useState({ phase: "loading", turns: [] });
  const [nonce, setNonce] = react.useState(0);
  const [diffs, setDiffs] = react.useState({});

  react.useEffect(() => {
    if (visible === false) return undefined;
    if (typeof sessionId !== "string" || sessionId === "") {
      setState({ phase: "ready", turns: [] });
      return undefined;
    }
    let live = true;
    const controller = new AbortController();
    setState((previous) => ({
      phase: previous.turns.length === 0 ? "loading" : "refreshing",
      turns: previous.turns,
    }));
    cache.current.clear();
    setDiffs({});
    readTurns(sessionId, controller.signal)
      .then((turns) => {
        if (live) setState({ phase: "ready", turns });
      })
      .catch(() => {
        if (!live || controller.signal.aborted) return;
        setState({ phase: "error", turns: [] });
      });
    return () => {
      live = false;
      controller.abort();
    };
  }, [sessionId, nonce, visible]);

  react.useEffect(() => {
    if (selected === null || typeof sessionId !== "string" || sessionId === "") return undefined;
    let live = true;
    const controllers = [];
    for (const entry of selected.entries) {
      const key = entryKey(entry);
      if (cache.current.has(key)) {
        const cached = cache.current.get(key);
        setDiffs((previous) =>
          previous[key] !== undefined
            ? previous
            : { ...previous, [key]: { phase: "ready", data: cached } },
        );
        continue;
      }
      const controller = new AbortController();
      controllers.push(controller);
      readDiff(sessionId, entry, controller.signal)
        .then((payload) => {
          if (!live) return;
          cache.current.set(key, payload);
          setDiffs((previous) => ({ ...previous, [key]: { phase: "ready", data: payload } }));
        })
        .catch(() => {
          if (!live || controller.signal.aborted) return;
          setDiffs((previous) => ({ ...previous, [key]: { phase: "error" } }));
        });
    }
    return () => {
      live = false;
      for (const controller of controllers) controller.abort();
    };
  }, [selected, sessionId, nonce]);

  /** Reload the turn list (and, with it, every comparison). */
  const refresh = () => setNonce((value) => value + 1);

  /**
   * Forget one cached comparison and reload, so the pane can ask again.
   * @param key - the entry key from {@link entryKey}.
   */
  const retryEntry = (key) => {
    cache.current.delete(key);
    setDiffs((previous) => {
      const next = { ...previous };
      delete next[key];
      return next;
    });
    setNonce((value) => value + 1);
  };

  return { state, diffs, nonce, refresh, retryEntry };
}
