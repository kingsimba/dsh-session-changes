import { react } from "../react.js";

/**
 * Keep the selection pointing at a listed row: adopt the same path when the list
 * still has it, otherwise the first listed file, otherwise nothing.
 *
 * `ready` holds the decision until the list has been read, so a selection restored
 * from memory is not cleared by the empty first render of a new tab mount.
 *
 * @param input - `{ rows, selectedPath, setSelectedPath, ready }`.
 */
export function useSelection({ rows, selectedPath, setSelectedPath, ready }) {
  react.useEffect(() => {
    if (ready !== true) return;
    if (rows.length === 0) {
      if (selectedPath !== null) setSelectedPath(null);
      return;
    }
    if (selectedPath !== null && rows.some((row) => row.path === selectedPath)) return;
    setSelectedPath(rows[0].path);
  }, [rows, selectedPath, ready]);
}
