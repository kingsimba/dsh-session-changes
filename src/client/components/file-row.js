import { h } from "../react.js";
import { Counts } from "./counts.js";

/**
 * One file in the list: its name alone, the counts, and the selected state. Hovering
 * the row reveals its Accept / Revert buttons, which act on every change in that
 * file; the counts are hidden meanwhile so the row does not change width.
 *
 * @param props - `{ file, name, index, selected, missing, t, onSelect, onAction, busy }`.
 */
export function FileRow({ file, name, index, selected, missing, t, onSelect, onAction, busy }) {
  const action = (kind) => (event) => {
    event.stopPropagation();
    if (busy !== true) onAction(kind, file.path);
  };
  return h(
    "div",
    {
      className: "dsc-row",
      title: missing === true ? file.path + " · deleted" : file.path,
      "data-nested": "true",
      "data-selected": selected === true ? "true" : "false",
      "data-missing": missing === true ? "true" : "false",
      "aria-current": selected === true ? "true" : undefined,
    },
    [
      h(
        "button",
        {
          type: "button",
          className: "dsc-row-main",
          key: "m",
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
      ),
      h("span", { className: "dsc-row-actions", key: "a", "data-scope": "file" }, [
        h(
          "button",
          {
            type: "button",
            className: "dsc-act",
            key: "accept",
            "data-action": "accept",
            title: t("acceptFile", { name: file.display }),
            "aria-label": t("acceptFile", { name: file.display }),
            disabled: busy === true,
            onClick: action("accept"),
          },
          t("acceptShort"),
        ),
        h(
          "button",
          {
            type: "button",
            className: "dsc-act",
            key: "revert",
            "data-action": "revert",
            title: t("revertFile", { name: file.display }),
            "aria-label": t("revertFile", { name: file.display }),
            disabled: busy === true,
            onClick: action("revert"),
          },
          t("revertShort"),
        ),
      ]),
    ],
  );
}
