import { h } from "../react.js";
import { ChangesTab } from "../changes-tab.js";
import { TabBoundary } from "./error-boundary.js";

/**
 * The registered tab body: the tab, fenced so a render error stays inside the pane.
 * The body is keyed by Session, so a sidebar that reuses the slot for another
 * Session starts the tab from a clean mount; the mount itself restores the remembered
 * selection, counts and scroll offsets.
 *
 * @param props - whatever the tab system passes to a pane body.
 */
export function TabBody(props) {
  const tab = h(ChangesTab, { ...props, key: props.sessionId });
  return TabBoundary === null ? tab : h(TabBoundary, null, tab);
}
