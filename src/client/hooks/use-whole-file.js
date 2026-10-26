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
 * @param input - `{ sessionId, selected, entry, nonce }`.
 * @returns the whole-file state, or undefined before anything was read.
 */
export function useWholeFile({ sessionId, selected, entry, nonce }) {
  const [state, setState] = react.useState(undefined);
  react.useEffect(() => {
    if (selected === null || entry === undefined) return undefined;
    if (typeof sessionId !== "string" || sessionId === "") return undefined;
    let live = true;
    const controller = new AbortController();
    setState({ phase: "loading" });
    readWholeFile(sessionId, entry.seq, selected.path, controller.signal)
      .then((text) => {
        if (live) setState({ phase: "ready", text });
      })
      .catch((error) => {
        if (!live || controller.signal.aborted) return;
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
  }, [selected, entry, sessionId, nonce]);
  return state;
}
