import { react } from "../react.js";
import { sameSelection, selectionOf } from "../selection.js";

/**
 * Keep the selection pointing at a listed row: adopt the same path when the list
 * still has it, otherwise the first listed file, otherwise nothing.
 *
 * @param input - `{ view, selected, setSelected }`.
 */
export function useSelection({ view, selected, setSelected }) {
  react.useEffect(() => {
    if (view.files === 0) {
      if (selected !== null) setSelected(null);
      return;
    }
    const adopt = (row) => {
      const next = selectionOf(row);
      if (!sameSelection(selected, next)) setSelected(next);
    };
    for (const group of view.groups)
      for (const folder of group.folders)
        for (const row of folder.files) {
          if (selected !== null && selected.path === row.file.path) {
            adopt(row);
            return;
          }
        }
    for (const group of view.groups)
      for (const folder of group.folders) {
        if (folder.files.length === 0) continue;
        adopt(folder.files[0]);
        return;
      }
    setSelected(null);
  }, [view, selected]);
}
