import { h } from "../react.js";
import { AllRow } from "./all-row.js";

/**
 * The master list: title, session totals, the whole-list actions, and the rows.
 *
 * @param props - `{ t, state, totals, rows, busy, left, reverted, onRefresh, actionBusy,
 *   confirmRevertAll, onAcceptAll, onAskRevertAll, onCancelRevertAll, onRevertAll }`,
 *   where `reverted` says the empty list means "every change was undone", not "nothing
 *   was ever recorded".
 */
export function ListPane(props) {
  const {
    t,
    state,
    totals,
    rows,
    busy,
    left,
    reverted,
    onRefresh,
    actionBusy,
    confirmRevertAll,
    onAcceptAll,
    onAskRevertAll,
    onCancelRevertAll,
    onRevertAll,
  } = props;
  let listBody;
  if (state.phase === "loading") listBody = h("div", { className: "dsc-note" }, t("loading"));
  else if (state.phase === "error")
    listBody = h("div", { className: "dsc-note" }, [
      h("span", { key: "m" }, t("error")),
      h(
        "button",
        { type: "button", className: "dsc-btn", key: "b", onClick: onRefresh },
        t("retry"),
      ),
    ]);
  else if (rows.length === 0)
    listBody = h("div", { className: "dsc-note" }, reverted === true ? t("reverted") : t("empty"));
  else listBody = h("div", { className: "dsc-body" }, rows);

  return h(
    "div",
    { className: "dsc-pane dsc-left", key: "l", style: { flex: "0 0 " + String(left) + "px" } },
    [
      h("div", { className: "dsc-head", key: "h" }, [
        h("span", { className: "dsc-title", key: "t" }, t("title")),
        state.files.length === 0
          ? null
          : h("span", { className: "dsc-stat", key: "s" }, [
              h("span", { className: "dsc-add", key: "a" }, "+" + String(totals.added)),
              h("span", { className: "dsc-del", key: "d" }, "−" + String(totals.deleted)),
            ]),
        h(
          "button",
          {
            type: "button",
            className: "dsc-btn",
            key: "r",
            title: t("refresh"),
            "aria-label": t("refresh"),
            disabled: busy,
            onClick: onRefresh,
          },
          "↻",
        ),
      ]),
      rows.length === 0
        ? null
        : h(AllRow, {
            key: "all",
            t,
            busy: busy === true || actionBusy === true,
            confirming: confirmRevertAll === true,
            onAcceptAll,
            onAskRevert: onAskRevertAll,
            onCancelRevert: onCancelRevertAll,
            onRevertAll,
          }),
      listBody,
    ],
  );
}
