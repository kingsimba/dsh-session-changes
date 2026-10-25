import { h } from "../react.js";

/**
 * The turn strip above the comparison: every turn of the Session, oldest first.
 *
 * @param props - `{ t, turns, activeTurn, onPick }`.
 * @returns the strip, or null outside By-turn mode.
 */
export function TurnChips({ t, turns, activeTurn, onPick }) {
  if (turns.length === 0) return null;
  return h(
    "div",
    { className: "dsc-chips", key: "c" },
    turns.map((item) =>
      h(
        "button",
        {
          type: "button",
          className: "dsc-chip",
          key: "c" + String(item.turn),
          title:
            t("sectionTurn", { turn: String(item.turn) }) +
            " · " +
            (item.total === 1 ? t("oneFile") : t("files", { count: String(item.total) })),
          "data-active": item.turn === activeTurn ? "true" : "false",
          "aria-pressed": item.turn === activeTurn ? "true" : "false",
          onClick: () => onPick(item.turn),
        },
        t("sectionTurn", { turn: String(item.turn) }),
      ),
    ),
  );
}
