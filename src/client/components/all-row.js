import { h } from "../react.js";

/**
 * The list's top row: apply every remaining change at once, or ask before reverting
 * everything. Revert All turns the row into its own confirmation instead of opening a
 * browser dialog, so the question stays inside the pane and cannot block the page.
 *
 * @param props - `{ t, busy, confirming, onAcceptAll, onAskRevert, onCancelRevert,
 *   onRevertAll }`.
 */
export function AllRow({
  t,
  busy,
  confirming,
  onAcceptAll,
  onAskRevert,
  onCancelRevert,
  onRevertAll,
}) {
  if (confirming === true) {
    return h(
      "div",
      { className: "dsc-all", "data-confirm": "true", "data-scope": "all", key: "all" },
      [
        h("div", { className: "dsc-all-question", key: "q" }, t("revertAllAsk")),
        h("div", { className: "dsc-all-buttons", key: "b" }, [
          h(
            "button",
            {
              type: "button",
              className: "dsc-act",
              key: "revert",
              "data-action": "revert-all-confirm",
              disabled: busy === true,
              onClick: onRevertAll,
            },
            t("revertAll"),
          ),
          h(
            "button",
            {
              type: "button",
              className: "dsc-act",
              key: "cancel",
              "data-action": "revert-all-cancel",
              disabled: busy === true,
              onClick: onCancelRevert,
            },
            t("cancel"),
          ),
        ]),
      ],
    );
  }
  return h("div", { className: "dsc-all", "data-scope": "all", key: "all" }, [
    h("div", { className: "dsc-all-buttons", key: "b" }, [
      h(
        "button",
        {
          type: "button",
          className: "dsc-act",
          key: "accept",
          "data-action": "accept-all",
          title: t("acceptAllHint"),
          "aria-label": t("acceptAllHint"),
          disabled: busy === true,
          onClick: onAcceptAll,
        },
        t("acceptAll"),
      ),
      h(
        "button",
        {
          type: "button",
          className: "dsc-act",
          key: "revert",
          "data-action": "revert-all",
          title: t("revertAllHint"),
          "aria-label": t("revertAllHint"),
          disabled: busy === true,
          onClick: onAskRevert,
        },
        t("revertAll"),
      ),
    ]),
  ]);
}
