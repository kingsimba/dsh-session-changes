import { readTurns } from "../api.js";
import { react } from "../react.js";

/**
 * The Session's changed-file feed: the recorded turns, newest first, and the
 * refresh counter that reloads them. The list itself is folded into one view, so
 * nothing per turn is fetched.
 *
 * @param input - `{ sessionId, visible }`.
 * @returns `{ state, nonce, refresh }`.
 */
export function useChangesFeed({ sessionId, visible }) {
  const [state, setState] = react.useState({ phase: "loading", turns: [] });
  const [nonce, setNonce] = react.useState(0);

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

  /** Reload the turn list (and, with it, every comparison). */
  const refresh = () => setNonce((value) => value + 1);

  return { state, nonce, refresh };
}
