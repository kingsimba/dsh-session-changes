import { h } from "../react.js";

/**
 * The master list: title, session totals, and the rows.
 *
 * @param props - `{ t, state, totals, rows, busy, left, reverted, onRefresh }`, where
 *   `reverted` says the empty list means "every change was undone", not "nothing
 *   was ever recorded".
 */
export function ListPane({ t, state, totals, rows, busy, left, reverted, onRefresh }) {
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
      listBody,
    ],
  );
}
