import { h } from "../react.js";
import { Counts } from "./counts.js";

/**
 * The comparison toolbar: name, counts, and the layout / wrap buttons.
 *
 * @param props - the selected file plus the actions the buttons run.
 */
export function RightHead({ t, selected, layout, wrap, onToggleLayout, onToggleWrap }) {
  return h("div", { className: "dsc-dhead", key: "h" }, [
    h(
      "span",
      { className: "dsc-dpath", key: "p", title: selected === null ? "" : selected.path },
      selected === null ? t("pick") : selected.display,
    ),
    selected === null
      ? null
      : h(Counts, {
          key: "c",
          added: selected.added,
          deleted: selected.deleted,
          binary: selected.binary,
          oversized: selected.oversized,
          t,
        }),
    selected === null
      ? null
      : h(
          "button",
          {
            type: "button",
            className: "dsc-btn",
            key: "l",
            title: layout === "inline" ? t("layoutSplit") : t("layoutInline"),
            "aria-label": layout === "inline" ? t("layoutSplit") : t("layoutInline"),
            "aria-pressed": layout === "inline" ? "true" : "false",
            onClick: onToggleLayout,
          },
          layout === "inline" ? t("layoutInlineShort") : t("layoutSplitShort"),
        ),
    selected === null
      ? null
      : h(
          "button",
          {
            type: "button",
            className: "dsc-btn",
            key: "w",
            title: wrap === true ? t("wrapOff") : t("wrapOn"),
            "aria-label": wrap === true ? t("wrapOff") : t("wrapOn"),
            "aria-pressed": wrap === true ? "true" : "false",
            onClick: onToggleWrap,
          },
          "↵",
        ),
  ]);
}
