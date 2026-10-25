import { h } from "../react.js";
import { Counts } from "./counts.js";

/**
 * One file in the list: its name alone, the counts, and the selected state.
 * @param props - `{ file, name, index, selected, missing, t, onSelect }`.
 */
export function FileRow({ file, name, index, selected, missing, t, onSelect }) {
  return h(
    "button",
    {
      type: "button",
      className: "dsc-row",
      title: missing === true ? file.path + " · deleted" : file.path,
      "data-nested": "true",
      "data-selected": selected === true ? "true" : "false",
      "data-missing": missing === true ? "true" : "false",
      "aria-current": selected === true ? "true" : undefined,
      "aria-label": t("open", { name: file.display }),
      onClick: () => onSelect(index),
    },
    [
      h(
        "span",
        { className: "dsc-path", key: "p" },
        name === undefined || name === "" ? file.display : name,
      ),
      h(Counts, {
        key: "c",
        added: file.added,
        deleted: file.deleted,
        binary: file.binary,
        oversized: file.oversized,
        t,
      }),
    ],
  );
}
