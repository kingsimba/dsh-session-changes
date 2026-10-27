import { h } from "../react.js";

/**
 * A file's line counts, or the reason it has none. Counts that have not been read
 * yet show a quiet ellipsis instead of `+undefined`: on a Session switch the cached
 * values are there immediately, and a new file fills them in a moment later.
 *
 * @param props - `{ added, deleted, binary, oversized, t }`.
 */
export function Counts({ added, deleted, binary, oversized, t }) {
  if (binary === true) return h("span", { className: "dsc-counts dsc-muted" }, t("binary"));
  if (oversized === true) return h("span", { className: "dsc-counts dsc-muted" }, t("oversized"));
  if (added === undefined || deleted === undefined)
    return h("span", { className: "dsc-counts dsc-muted", "aria-hidden": true }, "…");
  return h("span", { className: "dsc-counts" }, [
    h("span", { className: "dsc-add", key: "a" }, "+" + String(added)),
    h("span", { className: "dsc-del", key: "d" }, "−" + String(deleted)),
  ]);
}
