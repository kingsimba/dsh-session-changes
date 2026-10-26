import { h } from "../react.js";
import { Counts } from "./counts.js";

/**
 * The comparison toolbar: name, counts, and the layout / scope / open / wrap
 * buttons.
 *
 * @param props - the selected file plus the actions the buttons run.
 */
export function RightHead({
  t,
  selected,
  layout,
  whole,
  wrap,
  opening,
  openFailed,
  onToggleLayout,
  onToggleWhole,
  onOpenFile,
  onToggleWrap,
}) {
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
            key: "f",
            title: whole === true ? t("wholeOff") : t("wholeOn"),
            "aria-label": whole === true ? t("wholeOff") : t("wholeOn"),
            "aria-pressed": whole === true ? "true" : "false",
            "data-active": whole === true ? "true" : "false",
            onClick: onToggleWhole,
          },
          t("wholeShort"),
        ),
    selected === null
      ? null
      : h(
          "button",
          {
            type: "button",
            className: "dsc-btn",
            key: "e",
            title: openFailed === true ? t("openAppFailed") : t("openApp"),
            "aria-label": t("openApp"),
            disabled: opening,
            onClick: onOpenFile,
          },
          "⤴",
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
