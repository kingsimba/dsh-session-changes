import { readExists } from "../api.js";
import { react } from "../react.js";

/**
 * Which of the listed files still exist on disk.
 *
 * The recorded turns only know about edits made by the file tools, so a file
 * removed by anything else (a shell command, an editor, a `git checkout`) has to be
 * checked against the filesystem.
 *
 * @param input - `{ sessionId, newestSeq, nonce }`.
 * @returns a set-shaped map of the paths that are gone.
 */
export function useExists({ sessionId, newestSeq, nonce }) {
  const [gonePaths, setGonePaths] = react.useState({});
  react.useEffect(() => {
    if (newestSeq <= 0 || typeof sessionId !== "string" || sessionId === "") return undefined;
    let live = true;
    const controller = new AbortController();
    readExists(sessionId, newestSeq, controller.signal)
      .then((paths) => {
        if (!live) return;
        const missing = {};
        for (const path of Object.keys(paths)) if (paths[path] === "missing") missing[path] = true;
        setGonePaths(missing);
      })
      .catch(() => {
        if (live) setGonePaths({});
      });
    return () => {
      live = false;
      controller.abort();
    };
  }, [sessionId, newestSeq, nonce]);
  return gonePaths;
}
