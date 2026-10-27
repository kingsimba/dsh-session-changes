import { readFiles } from "../api.js";
import { react } from "../react.js";

/**
 * Whether two Host lists describe the same files. The sidebar re-reads the list
 * whenever the tab becomes visible, and the read always returns fresh objects; a new
 * array for an unchanged list would make every row (and the comparison hanging off
 * the selected row) look new. Keeping the previous array when the entries match
 * stops a collapse-and-reopen from re-diffing the whole session.
 *
 * @param previous - the list currently on screen.
 * @param next - the freshly read list.
 * @returns true when path and display match at every index.
 */
function sameFiles(previous, next) {
  if (previous === next) return true;
  if (previous.length !== next.length) return false;
  for (let at = 0; at < previous.length; at += 1) {
    const before = previous[at];
    const after = next[at];
    if (before === after) continue;
    if (before === undefined || after === undefined) return false;
    if (before.path !== after.path || before.display !== after.display) return false;
  }
  return true;
}

/**
 * The Session's changed-file list and the refresh counter that reloads it. There is
 * no per-turn data: the Host lists the files whose pre-image it captured.
 *
 * @param input - `{ sessionId, visible }`.
 * @returns `{ state, nonce, refresh }`.
 */
export function useFileList({ sessionId, visible }) {
  const [state, setState] = react.useState({ phase: "loading", files: [] });
  const [nonce, setNonce] = react.useState(0);

  react.useEffect(() => {
    if (visible === false) return undefined;
    if (typeof sessionId !== "string" || sessionId === "") {
      setState({ phase: "ready", files: [] });
      return undefined;
    }
    let live = true;
    const controller = new AbortController();
    setState((previous) => ({
      phase: previous.files.length === 0 ? "loading" : "refreshing",
      files: previous.files,
    }));
    readFiles(sessionId, controller.signal)
      .then((files) => {
        if (!live) return;
        setState((previous) =>
          sameFiles(previous.files, files)
            ? { phase: "ready", files: previous.files }
            : { phase: "ready", files },
        );
      })
      .catch(() => {
        if (!live || controller.signal.aborted) return;
        setState({ phase: "error", files: [] });
      });
    return () => {
      live = false;
      controller.abort();
    };
  }, [sessionId, nonce, visible]);

  /** Reload the list (and, with it, every comparison). */
  const refresh = () => setNonce((value) => value + 1);

  return { state, nonce, refresh };
}
