import { h } from "../react.js";

/**
 * One cell's text, coloured by the shared highlighter when it produced spans.
 * @param props - `{ text, spans }`.
 */
export function DiffText({ text, spans }) {
  if (spans === undefined) return h("span", { className: "dsc-code" }, text);
  return h(
    "span",
    { className: "dsc-code" },
    spans.map((span, index) => h("span", { style: span.style, key: index }, span.text)),
  );
}

/**
 * Both lanes of one row, tokens included: the wrapped grid draws a row as two
 * sibling cells instead of two scroll-synced lanes.
 *
 * @param props - `{ row, marks, keyPrefix }`.
 * @returns the left cell, then the right cell.
 */
export function DiffCells({ row, marks, keyPrefix }) {
  const cells = [];
  for (const side of ["left", "right"]) {
    const cell = row[side];
    const kind =
      cell === undefined
        ? "pad"
        : cell.kind === "context"
          ? "ctx"
          : side === "left"
            ? "del"
            : "add";
    const map = marks === undefined ? undefined : marks[side === "left" ? "old" : "new"];
    const spans = cell === undefined || map === undefined ? undefined : map.get(cell.no);
    cells.push(
      h(
        "div",
        {
          className: side === "right" ? "dsc-cell dsc-cright" : "dsc-cell",
          "data-kind": kind,
          key: keyPrefix + side,
        },
        [
          h("span", { className: "dsc-lno", key: "n" }, cell === undefined ? "" : String(cell.no)),
          cell === undefined
            ? h("span", { className: "dsc-code", key: "c" })
            : h(DiffText, { key: "c", text: cell.text, spans }),
        ],
      ),
    );
  }
  return cells;
}
