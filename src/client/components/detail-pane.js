import { h } from "../react.js";
import { DetailBody } from "./detail-body.js";
import { RightHead } from "./right-head.js";

/**
 * The comparison pane: toolbar and body.
 *
 * @param props - `{ t, selected, layout, wrap, comparison, baseState, onToggleLayout,
 *   onToggleWrap }`.
 */
export function DetailPane(props) {
  return h("div", { className: "dsc-pane dsc-right", key: "r" }, [
    h(RightHead, props),
    h(DetailBody, props),
  ]);
}
