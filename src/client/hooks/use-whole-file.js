import { readWholeFile } from "../api.js";
import { react } from "../react.js";

/**
 * The selected file's current text, read from the disk every time the list or the
 * comparison refreshes.
 *
 * A path that is gone from the disk becomes `phase: "missing"`, which the
 * comparison reads as "deleted" rather than "unreadable"; a binary or oversized
 * file gets its own phase so the pane can say so.
 *
 * A re-read keeps the previous ready state on screen, so the comparison is not
 * unmounted (and its scroll position is not lost) while new data arrives. `apply`
 * folds in a text the caller already wrote, for an instant revert.
 *
 * @param input - `{ sessionId, path, nonce }`.
 * @returns `{ state, apply }`: the state, or undefined before anything was read.
 */
export function useWholeFile({ sessionId, path, nonce }) {
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
    readWholeFile(sessionId, path, controller.signal)
      .then((text) => {
        if (live && version.current === at) setState({ phase: "ready", text });
      })
      .catch((error) => {
        if (!live || controller.signal.aborted || version.current !== at) return;
        // The file is gone from the disk: that is a deleted comparison, not a read failure.
        if (error !== null && error !== undefined && error.missing === true)
          setState({ phase: "missing" });
        else if (error !== null && error !== undefined && error.binary === true)
          setState({ phase: "binary" });
        else if (error !== null && error !== undefined && error.oversized === true)
          setState({ phase: "oversized" });
        else setState({ phase: "error", detail: error instanceof Error ? error.message : "" });
      });
    return () => {
      live = false;
      controller.abort();
    };
  }, [sessionId, path, nonce]);

  /**
   * Replace the current text with one the caller already wrote, superseding any read
   * that started before it. Ignored when the tab has moved to another file.
   * @param text - the file's new full text.
   */
  const apply = (text) => {
    if (currentKey.current !== key) return;
    version.current += 1;
    loadedKey.current = key;
    setState({ phase: "ready", text });
  };

  return {
    // A state read for another file must never reach the pane: the render right
    // after the selection changed would otherwise mix the new file with old text.
    state: loadedKey.current === key ? state : undefined,
    apply,
  };
}
