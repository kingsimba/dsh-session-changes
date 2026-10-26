import { readBase } from "../api.js";
import { react } from "../react.js";

/**
 * The Session's first pre-image of the selected file: the stored baseline the
 * comparison diffs against.
 *
 * @param input - `{ sessionId, selected, entry, nonce }`.
 * @returns `{ phase: "ready", text }` / `{ phase: "ready", absent: true }` /
 *   `{ phase: "loading" }` / `{ phase: "error" }`, or undefined before the read.
 */
export function useBase({ sessionId, selected, entry, nonce }) {
  const [state, setState] = react.useState(undefined);
  react.useEffect(() => {
    if (selected === null || entry === undefined) return undefined;
    if (typeof sessionId !== "string" || sessionId === "") return undefined;
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
  }, [selected, entry, sessionId, nonce]);
  return state;
}
