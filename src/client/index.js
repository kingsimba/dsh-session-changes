/**
 * Session changes, browser half: a sidebar tab that lists every file this Session
 * changed and draws the selected file's comparison beside the list.
 *
 * The shipped artifact is one classic script inside `window.__ModuleLoader__`, so
 * this directory is the real source: `pnpm run build` bundles it into
 * `lib/client.js`. See scripts/build.mjs.
 */

import { TabBody } from "./components/tab-body.js";
import { KIND, NS, TYPE_ID } from "./constants.js";
import { en } from "./locale/en.js";
import { zh } from "./locale/zh.js";
import { h } from "./react.js";
// Injects this package's stylesheet once, at load: the tab system may mount the
// body long after the bundle was evaluated.
import "./styles.js";

/** The Host features this client half needs. */
export const inject = ["slots", "locale", "sidebarRightTabs", "sidebarRight"];

/** The tab's guide icon. */
function guideIcon() {
  return h(
    "svg",
    {
      width: 20,
      height: 20,
      viewBox: "0 0 16 16",
      fill: "currentColor",
      "aria-hidden": true,
    },
    h("path", {
      d: "M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm0 1.5a5 5 0 0 1 4.6 3.1H9.5V3.2A5 5 0 0 1 8 3Zm-1.5.2v2.9H3.4A5 5 0 0 1 6.5 3.2ZM3.1 7.4h3.4v5.4a5 5 0 0 1-3.4-5.4Zm4.9 5.4V7.4h3.4A5 5 0 0 1 8 12.8Z",
    }),
  );
}

/**
 * Register the tab type, its guide entry, and its body.
 * @param ctx - the client context.
 */
export function apply(ctx) {
  const t = ctx.locale.bind(NS);
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "session-changes: dictionaries");
  ctx.effect(
    () =>
      ctx.sidebarRightTabs.register({
        id: TYPE_ID,
        kind: KIND,
        priority: "builtin",
        title: () => t("title"),
        guide: [
          {
            id: KIND,
            order: 45,
            title: () => t("guideTitle"),
            description: () => t("guideDescription"),
            icon: guideIcon,
          },
        ],
      }),
    "session-changes: tab type",
  );
  ctx.effect(
    () =>
      ctx.slots.inject("sidebar.right.pane.tab", () =>
        ctx.slots.register({ name: "sidebar.right.pane.tab", key: TYPE_ID, locale: NS }, TabBody),
      ),
    "session-changes: tab body",
  );
}
