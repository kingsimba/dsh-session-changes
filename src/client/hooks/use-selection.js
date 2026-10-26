import { react } from "../react.js";

/**
 * Keep the selection pointing at a listed row: adopt the same path when the list
 * still has it, otherwise the first listed file, otherwise nothing.
 *
 * @param input - `{ rows, selectedPath, setSelectedPath }`.
 */
export function useSelection({ rows, selectedPath, setSelectedPath }) {
  react.useEffect(() => {
    if (rows.length === 0) {
      if (selectedPath !== null) setSelectedPath(null);
      return;
    }
    if (selectedPath !== null && rows.some((row) => row.path === selectedPath)) return;
    setSelectedPath(rows[0].path);
  }, [rows, selectedPath]);
}
