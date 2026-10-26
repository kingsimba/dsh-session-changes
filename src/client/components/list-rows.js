import { h } from "../react.js";
import { rowMatchesSelection, selectionOf } from "../selection.js";
import { FileRow } from "./file-row.js";

/**
 * Build the left list: one folder header, then that folder's files.
 *
 * @param input - `{ view, gonePaths, selected, mode, t, counts, onSelect }`, where
 *   `counts` optionally overrides a row's `+added/−deleted` with live values and
 *   `onSelect(selection, entryIndex)` adopts one row.
 * @returns the elements in order.
 */
export function buildListRows({ view, gonePaths, selected, mode, t, counts, onSelect }) {
  const rows = [];
  for (const group of view.groups) {
    for (const folder of group.folders) {
      const label = folder.folder === "" ? "./" : folder.folder + "/";
      rows.push(
        h(
          "div",
          {
            className: "dsc-folder",
            key: "f" + String(group.turn) + ":" + folder.folder,
            title: label,
          },
          label,
        ),
      );
      for (const row of folder.files) {
        const live = counts === null || counts === undefined ? undefined : counts[row.file.path];
        rows.push(
          h(FileRow, {
            key:
              String(row.entries[0].seq) + ":" + String(row.entries[0].index) + ":" + row.file.path,
            file: live === undefined ? row.file : { ...row.file, ...live },
            name: row.name,
            index: row.entries[0].index,
            t,
            missing: gonePaths[row.file.path] === true,
            selected: rowMatchesSelection(row, selected, mode),
            onSelect: () => onSelect(selectionOf(row), row.entries.length - 1),
          }),
        );
      }
    }
  }
  return rows;
}
