import { readFiles } from "../api.js";
import { react } from "../react.js";

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
        if (live) setState({ phase: "ready", files });
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
