import { ROW_CAP } from "../constants.js";
import { buildDiffModel } from "../diff/model.js";
import { hunkLabel } from "../diff/rows.js";
import { languageForPath, useCodeHighlighter } from "../primitives.js";
import { h, react } from "../react.js";
import { BlockActions } from "./block-actions.js";
import { DiffCells, DiffText } from "./diff-text.js";
import { comparisonNotes, notesBlock, paneNote } from "./pane-note.js";

/**
 * Keep two comparison lanes on the same scroll offsets without feeding events back.
 * @param source - the lane that scrolled.
 * @param target - the lane to move.
 * @param guard - a ref that swallows the echo.
 */
function syncLanes(source, target, guard) {
  if (target === null || guard.current) return;
  guard.current = true;
  target.scrollTop = source.scrollTop;
  target.scrollLeft = source.scrollLeft;
  if (typeof requestAnimationFrame === "function")
    requestAnimationFrame(() => {
      guard.current = false;
    });
  else guard.current = false;
}

/**
 * The comparison of the selected file, side by side. Unwrapped draws two fixed 50%
 * lanes that scroll in step, so long lines never move the split; wrapped draws one
 * 50/50 grid that wraps inside its own cells.
 *
 * Every changed row carries its block's accept/revert buttons, shown only while
 * that row is hovered.
 *
 * @param props - `{ state, wrap, t, onRetry, busy, actionError, onAction }`.
 */
export function SplitDiff({ state, wrap, t, onRetry, busy, actionError, onAction }) {
  const data = state !== undefined && state.phase === "ready" ? state.data : undefined;
  const text = data !== undefined && data.kind === "text" ? data : undefined;
  const language =
    text !== undefined && languageForPath !== null ? languageForPath(text.path) : undefined;
  const highlighter = useCodeHighlighter === null ? undefined : useCodeHighlighter(language);
  const leftRef = react.useRef(null);
  const rightRef = react.useRef(null);
  const guard = react.useRef(false);
  const model = react.useMemo(() => {
    if (text === undefined) return null;
    return buildDiffModel(text, highlighter, "split");
  }, [text, highlighter]);

  const note = paneNote(state, t, onRetry);
  if (note !== null) return note;

  const head = notesBlock(comparisonNotes(data, model, t));
  const actionNote =
    actionError === undefined || actionError === null
      ? null
      : h("div", { className: "dsc-dnote dsc-actionnote", key: "act" }, actionError);
  const truncation =
    model !== null && model.truncated
      ? h(
          "div",
          { className: "dsc-dnote", key: "trunc" },
          t("truncated", { count: String(ROW_CAP) }),
        )
      : null;

  if (wrap === true) {
    const cells = [];
    if (model !== null)
      for (let at = 0; at < model.blocks.length; at += 1) {
        const block = model.blocks[at];
        cells.push(
          h("div", { className: "dsc-hunk", key: "h" + String(at) }, hunkLabel(block.hunk)),
        );
        for (let rowAt = 0; rowAt < block.rows.length; rowAt += 1) {
          for (const cell of DiffCells({
            row: block.rows[rowAt],
            marks: block.marks,
            keyPrefix: String(at) + ":" + String(rowAt) + ":",
            t,
            busy,
            onAction,
          }))
            cells.push(cell);
        }
      }
    return h("div", { className: "dsc-dbody" }, [
      actionNote,
      head,
      h(
        "div",
        {
          className: "dsc-dgrid",
          "data-wrap": "true",
          "data-spans": highlighter === undefined ? "false" : "true",
          key: "g",
        },
        cells,
      ),
      truncation,
    ]);
  }

  /**
   * One lane's rows: hunk header, then number, sign and the line, plus the block's
   * review buttons on a changed row.
   * @param side - which lane to draw.
   * @returns the elements in order.
   */
  const lane = (side) => {
    const out = [];
    if (model === null) return out;
    for (let at = 0; at < model.blocks.length; at += 1) {
      const block = model.blocks[at];
      out.push(h("div", { className: "dsc-hunk", key: "h" + String(at) }, hunkLabel(block.hunk)));
      const map =
        block.marks === undefined ? undefined : block.marks[side === "left" ? "old" : "new"];
      for (let rowAt = 0; rowAt < block.rows.length; rowAt += 1) {
        const row = block.rows[rowAt];
        const cell = row[side];
        const spans = cell === undefined || map === undefined ? undefined : map.get(cell.no);
        const kind = cell === undefined ? "pad" : cell.kind === "context" ? "ctx" : cell.kind;
        // The buttons sit on the new side whenever that half exists (so a green block
        // shows them on the right); a deletion-only row has no right cell, so its red
        // half carries them instead of leaving them on an empty pad.
        const actionable =
          (side === "right" && row.right !== undefined) ||
          (side === "left" && row.right === undefined);
        out.push(
          h(
            "div",
            {
              className: "dsc-lrow",
              "data-kind": kind,
              key: "r" + String(at) + ":" + String(rowAt),
            },
            [
              h(
                "span",
                { className: "dsc-lsign", key: "s" },
                cell === undefined
                  ? ""
                  : cell.kind === "del"
                    ? "−"
                    : cell.kind === "add"
                      ? "+"
                      : "",
              ),
              h(
                "span",
                { className: "dsc-lno", key: "n" },
                cell === undefined ? "" : String(cell.no),
              ),
              cell === undefined
                ? h("span", { className: "dsc-code", key: "c" })
                : h(DiffText, { key: "c", text: cell.text, spans }),
              // The buttons live on the right half, as the review surface; a deleted
              // block has a pad cell there, which still carries the row's block.
              actionable
                ? h(BlockActions, { key: "a", t, block: row.block, busy, onAction })
                : null,
            ],
          ),
        );
      }
    }
    return out;
  };

  return h("div", { className: "dsc-dbody" }, [
    actionNote,
    head,
    h("div", { className: "dsc-lanes", key: "l" }, [
      h(
        "div",
        {
          className: "dsc-lane dsc-lane-left",
          key: "left",
          ref: leftRef,
          onScroll: (event) => syncLanes(event.currentTarget, rightRef.current, guard),
        },
        lane("left"),
      ),
      h(
        "div",
        {
          className: "dsc-lane dsc-lane-right",
          key: "right",
          ref: rightRef,
          onScroll: (event) => syncLanes(event.currentTarget, leftRef.current, guard),
        },
        lane("right"),
      ),
    ]),
    truncation,
  ]);
}
