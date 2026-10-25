import { h } from "../react.js";

/**
 * A file's line counts, or the reason it has none.
 * @param props - `{ added, deleted, binary, oversized, t }`.
 */
export function Counts({ added, deleted, binary, oversized, t }) {
  if (binary === true) return h("span", { className: "dsc-counts dsc-muted" }, t("binary"));
  if (oversized === true) return h("span", { className: "dsc-counts dsc-muted" }, t("oversized"));
  return h("span", { className: "dsc-counts" }, [
    h("span", { className: "dsc-add", key: "a" }, "+" + String(added)),
    h("span", { className: "dsc-del", key: "d" }, "−" + String(deleted)),
  ]);
}
