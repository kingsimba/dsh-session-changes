import { h } from "../react.js";
import { DetailBody } from "./detail-body.js";
import { RightHead } from "./right-head.js";

/**
 * The comparison pane: toolbar and body.
 *
 * @param props - the toolbar and body inputs: `selected`, `activeEntry`, `layout`,
 *   `wrap`, `opening`, `openFailed`, `comparison`, `baseState`, `wholeState`,
 *   `onRetry`, and the toolbar callbacks.
 */
export function DetailPane(props) {
  return h("div", { className: "dsc-pane dsc-right", key: "r" }, [
    h(RightHead, props),
    h(DetailBody, props),
  ]);
}
