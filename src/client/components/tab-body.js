import { h } from "../react.js";
import { ChangesTab } from "../changes-tab.js";
import { TabBoundary } from "./error-boundary.js";

/**
 * The registered tab body: the tab, fenced so a render error stays inside the pane.
 * @param props - whatever the tab system passes to a pane body.
 */
export function TabBody(props) {
  return TabBoundary === null ? h(ChangesTab, props) : h(TabBoundary, null, h(ChangesTab, props));
}
