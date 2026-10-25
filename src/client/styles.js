import css from "./styles.css";
import { CSS_TAG_ID } from "./constants.js";

/**
 * Publish this package's stylesheet once per document. The tag is keyed, so a
 * refreshed page (or a second tab body) replaces nothing and stacks nothing.
 */
export function installStyles() {
  if (typeof document === "undefined") return;
  const selector = "style[data-plugin-css=" + JSON.stringify(CSS_TAG_ID) + "]";
  if (document.querySelector(selector) !== null) return;
  const tag = document.createElement("style");
  tag.dataset.plugin = "dsh-session-changes";
  tag.dataset.pluginCss = CSS_TAG_ID;
  tag.textContent = css;
  document.head.appendChild(tag);
}

installStyles();
