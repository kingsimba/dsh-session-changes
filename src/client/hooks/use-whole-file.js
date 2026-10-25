import { readWholeFile } from "../api.js";
import { react } from "../react.js";
import { activeEntryOf } from "../selection.js";

/**
 * The selected file's current text, read whenever the comparison needs the whole
 * file: in By-turn `Full` mode, and always in Overall.
 *
 * A path that is gone from the disk becomes `phase: "missing"`, which the
 * comparison reads as "deleted" rather than "unreadable".
 *
 * @param input - `{ sessionId, whole, mode, selected, entryIndex, nonce }`.
 * @returns the whole-file state, or undefined before anything was read.
 */
export function useWholeFile({ sessionId, whole, mode, selected, entryIndex, nonce }) {
  const [state, setState] = react.useState(undefined);
  react.useEffect(() => {
    if ((whole !== true && mode !== "overall") || selected === null) return undefined;
    if (typeof sessionId !== "string" || sessionId === "") return undefined;
    const entry = activeEntryOf(selected, entryIndex);
    if (entry === undefined) return undefined;
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
        else if (error !== null && error !== undefined && error.oversized === true)
          setState({ phase: "oversized" });
        else setState({ phase: "error", detail: error instanceof Error ? error.message : "" });
      });
    return () => {
      live = false;
      controller.abort();
    };
  }, [whole, selected, nonce, entryIndex, mode, sessionId]);
  return state;
}
