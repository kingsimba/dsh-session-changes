import { readBase } from "../api.js";
import { react } from "../react.js";

/**
 * The Session's first pre-image of the selected file: the stored baseline that
 * replaces the old reverse reconstruction in Overall.
 *
 * @param input - `{ sessionId, mode, selected, nonce }`.
 * @returns `{ phase: "ready", text }` / `{ phase: "ready", absent: true }` /
 *   `{ phase: "loading" }` / `{ phase: "error" }`, or undefined before the read.
 */
export function useBase({ sessionId, mode, selected, nonce }) {
  const [state, setState] = react.useState(undefined);
  react.useEffect(() => {
    if (mode !== "overall" || selected === null) return undefined;
    if (typeof sessionId !== "string" || sessionId === "") return undefined;
    const entry = selected.entries[0];
    if (entry === undefined) return undefined;
    let live = true;
    const controller = new AbortController();
    setState({ phase: "loading" });
    readBase(sessionId, entry.seq, selected.path, controller.signal)
      .then((value) => {
        if (live) setState({ phase: "ready", ...value });
      })
      .catch(() => {
        if (live && !controller.signal.aborted) setState({ phase: "error" });
      });
    return () => {
      live = false;
      controller.abort();
    };
  }, [mode, selected, sessionId, nonce]);
  return state;
}
