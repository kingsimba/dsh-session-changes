import { readBase } from "../api.js";
import { react } from "../react.js";

/**
 * The Session's first pre-image of the selected file: the stored baseline the
 * comparison diffs against.
 *
 * A re-read (auto-refresh, manual refresh, or a bulk action) keeps the previous
 * ready state on screen while it runs. Blanking it would unmount the comparison and
 * lose its scroll position; only switching to another file starts from `loading`.
 *
 * `apply` folds a known-good text in without a round-trip, so accepting a block can
 * update the diff instantly.
 *
 * @param input - `{ sessionId, path, nonce }`.
 * @returns `{ state, apply }`: the state is
 *   `{ phase: "ready", text }` / `{ phase: "ready", absent: true }` /
 *   `{ phase: "loading" }` / `{ phase: "binary" }` / `{ phase: "error" }`, or
 *   undefined before the read.
 */
export function useBase({ sessionId, path, nonce }) {
  const [state, setState] = react.useState(undefined);
  const key = (typeof sessionId === "string" ? sessionId : "") + "\u0000" + String(path);
  const currentKey = react.useRef(key);
  currentKey.current = key;
  const loadedKey = react.useRef("");
  const version = react.useRef(0);

  react.useEffect(() => {
    if (path === null) return undefined;
    if (typeof sessionId !== "string" || sessionId === "") return undefined;
    let live = true;
    const controller = new AbortController();
    const at = version.current;
    if (loadedKey.current !== key) {
      loadedKey.current = key;
      setState({ phase: "loading" });
    }
    readBase(sessionId, path, controller.signal)
      .then((value) => {
        if (live && version.current === at) setState({ phase: "ready", ...value });
      })
      .catch((error) => {
        if (!live || controller.signal.aborted || version.current !== at) return;
        if (error !== null && error !== undefined && error.binary === true)
          setState({ phase: "binary" });
        else setState({ phase: "error" });
      });
    return () => {
      live = false;
      controller.abort();
    };
  }, [sessionId, path, nonce]);

  /**
   * Replace the pre-image with a text the caller already wrote, superseding any
   * read that started before it. Ignored when the tab has moved to another file.
   * @param value - `{ text }`, or `{ absent: true }`.
   */
  const apply = (value) => {
    if (currentKey.current !== key) return;
    version.current += 1;
    loadedKey.current = key;
    setState({ phase: "ready", ...value });
  };

  return {
    // A state read for another file must never reach the pane: the render right
    // after the selection changed would otherwise mix the new file with old text.
    state: loadedKey.current === key ? state : undefined,
    apply,
  };
}
