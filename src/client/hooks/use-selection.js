import { react } from "../react.js";
import { sameSelection, selectionOf } from "../selection.js";

/**
 * Keep the selection pointing at a listed row: adopt the same path when the list
 * still has it, otherwise the first listed file, otherwise nothing.
 *
 * @param input - `{ view, mode, selected, setSelected, setEntryIndex }`.
 */
export function useSelection({ view, mode, selected, setSelected, setEntryIndex }) {
  react.useEffect(() => {
    if (view.files === 0) {
      if (selected !== null) setSelected(null);
      return;
    }
    // Adopt the listed row, which also re-derives the entry when the mode changed.
    const adopt = (row) => {
      const next = selectionOf(row);
      if (!sameSelection(selected, next)) {
        setSelected(next);
        setEntryIndex(next.entries.length - 1);
      }
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
  }, [view, mode]);
}
