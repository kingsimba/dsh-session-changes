import { h } from "../react.js";
import { linePieces, matchRanges, sliceSpans } from "../diff/tokens.js";
import { BlockActions } from "./block-actions.js";

/**
 * One cell's text, coloured by the shared highlighter when it produced spans.
 *
 * When a token is selected and the browser lacks the CSS Custom Highlight API, the
 * matches are wrapped in `<mark>` here instead. The line is matched as a whole before
 * the syntax spans are cut, so a qualified name split across spans still lights up.
 *
 * @param props - `{ text, spans, token }`; `token` is null when nothing is selected.
 */
export function DiffText({ text, spans, token }) {
  const active = token !== null && token !== undefined;
  if (spans === undefined) {
    if (!active) return h("span", { className: "dsc-code" }, text);
    const pieces = linePieces(text, token);
    if (pieces === null) return h("span", { className: "dsc-code" }, text);
    return h(
      "span",
      { className: "dsc-code" },
      pieces.map((piece, index) =>
        piece.hit ? h("mark", { className: "dsc-tok", key: index }, piece.text) : piece.text,
      ),
    );
  }

  const plain = spans.map((span, index) => h("span", { style: span.style, key: index }, span.text));
  if (!active) return h("span", { className: "dsc-code" }, plain);

  const matches = matchRanges(spans.map((span) => span.text).join(""), token);
  if (matches.length === 0) return h("span", { className: "dsc-code" }, plain);

  const pieces = sliceSpans(spans, matches);
  return h(
    "span",
    { className: "dsc-code" },
    pieces.map((piece, index) => {
      if (piece.hit) return h("mark", { className: "dsc-tok", key: index }, piece.text);
      return piece.style === undefined
        ? piece.text
        : h("span", { style: piece.style, key: index }, piece.text);
    }),
  );
}

/**
 * Both lanes of one row, tokens included: the wrapped grid draws a row as two
 * sibling cells instead of two scroll-synced lanes. The row's change block rides
 * along, so the new half carries its accept/revert buttons — or the old half when
 * the row has no new side (a pure deletion).
 *
 * @param props - `{ row, marks, keyPrefix, t, busy, onAction, token }`.
 * @returns the left cell, then the right cell.
 */
export function DiffCells({ row, marks, keyPrefix, t, busy, onAction, token }) {
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
    const actionable = side === "right" ? row.right !== undefined : row.right === undefined;
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
            : h(DiffText, { key: "c", text: cell.text, spans, token }),
          actionable ? h(BlockActions, { key: "a", t, block: row.block, busy, onAction }) : null,
        ],
      ),
    );
  }
  return cells;
}
