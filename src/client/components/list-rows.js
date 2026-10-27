import { groupFiles } from "../grouping.js";
import { h } from "../react.js";
import { rowMatchesSelection } from "../selection.js";
import { FileRow } from "./file-row.js";

/**
 * Turn the Host's file list plus the live counts into the rows the list shows.
 *
 * A file that was edited back to its pre-image nets zero, so it is not "changed
 * since this task started" and drops out instead of reading `+0 −0`. A row whose
 * counts are still being read stays visible without numbers.
 *
 * @param files - `{ path, display }[]` from the Host.
 * @param counts - `{ [path]: { added, deleted, missing, binary, oversized } }`.
 * @returns the rows, grouped by folder.
 */
export function buildRows(files, counts) {
  const shown = [];
  for (const file of files) {
    const live = counts[file.path];
    if (
      live !== undefined &&
      live.missing !== true &&
      live.binary !== true &&
      live.oversized !== true &&
      (live.added ?? 0) === 0 &&
      (live.deleted ?? 0) === 0
    )
      continue;
    const segments = String(file.display).split(/[\\/]/);
    const name = segments.pop() ?? String(file.display);
    shown.push({
      path: file.path,
      display: file.display,
      name,
      folder: segments.join("/"),
      added: live === undefined ? undefined : live.added,
      deleted: live === undefined ? undefined : live.deleted,
      missing: live === undefined ? false : live.missing === true,
      binary: live === undefined ? false : live.binary === true,
      oversized: live === undefined ? false : live.oversized === true,
    });
  }
  return shown;
}

/**
 * Build the left list: one folder header, then that folder's files.
 *
 * @param input - `{ rows, selectedPath, t, onSelect, onAction, busy }`.
 * @returns the elements in order.
 */
export function buildListRows({ rows, selectedPath, t, onSelect, onAction, busy }) {
  const grouped = groupFiles(rows);
  const out = [];
  for (const folder of grouped.folders) {
    const label = folder.folder === "" ? "./" : folder.folder + "/";
    out.push(h("div", { className: "dsc-folder", key: "f:" + folder.folder, title: label }, label));
    for (const row of folder.files) {
      out.push(
        h(FileRow, {
          key: row.file.path,
          file: row.file,
          name: row.file.name,
          t,
          missing: row.file.missing === true,
          selected: rowMatchesSelection(row.file, { path: selectedPath }),
          onSelect: () => onSelect(row.file.path),
          onAction,
          busy,
        }),
      );
    }
  }
  return out;
}
