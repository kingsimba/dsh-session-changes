import { readBase } from "../api.js";
import { react } from "../react.js";

/**
 * The Session's first pre-image of the selected file: the stored baseline the
 * comparison diffs against.
 *
 * @param input - `{ sessionId, path, nonce }`.
 * @returns `{ phase: "ready", text }` / `{ phase: "ready", absent: true }` /
 *   `{ phase: "loading" }` / `{ phase: "binary" }` / `{ phase: "error" }`, or
 *   undefined before the read.
 */
export function useBase({ sessionId, path, nonce }) {
  const [state, setState] = react.useState(undefined);
  react.useEffect(() => {
    if (path === null) return undefined;
    if (typeof sessionId !== "string" || sessionId === "") return undefined;
    let live = true;
    const controller = new AbortController();
    setState({ phase: "loading" });
    readBase(sessionId, path, controller.signal)
      .then((value) => {
        if (live) setState({ phase: "ready", ...value });
      })
      .catch((error) => {
        if (!live || controller.signal.aborted) return;
        if (error !== null && error !== undefined && error.binary === true)
          setState({ phase: "binary" });
        else setState({ phase: "error" });
      });
    return () => {
      live = false;
      controller.abort();
    };
  }, [sessionId, path, nonce]);
  return state;
}
