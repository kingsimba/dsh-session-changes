import { h } from "../react.js";
import { DetailBody } from "./detail-body.js";
import { RightHead } from "./right-head.js";
import { TurnChips } from "./turn-chips.js";

/**
 * The comparison pane: toolbar, turn strip, and the body.
 *
 * @param props - `{ t, mode, turns, activeTurn, onPickTurn }` plus the toolbar and
 *   body inputs: `selected`, `activeEntry`, `layout`, `whole`, `wrap`, `opening`,
 *   `openFailed`, `comparison`, `diffs`, `baseState`, `wholeState`, `onRetry`, and
 *   the toolbar callbacks.
 */
export function DetailPane({ t, mode, turns, activeTurn, onPickTurn, ...rest }) {
  return h("div", { className: "dsc-pane dsc-right", key: "r" }, [
    h(RightHead, { t, ...rest }),
    mode === "turn" ? h(TurnChips, { t, turns, activeTurn, onPick: onPickTurn }) : null,
    h(DetailBody, { t, mode, ...rest }),
  ]);
}
