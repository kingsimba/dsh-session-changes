import { ROW_CAP } from "../constants.js";
import { buildDiffModel } from "../diff/model.js";
import { hunkLabel } from "../diff/rows.js";
import { useTokenHighlight } from "../hooks/use-token-highlight.js";
import { languageForPath, useCodeHighlighter } from "../primitives.js";
import { h, react } from "../react.js";
import { readScroll, writeScroll } from "../session-memory.js";
import { selectedToken, supportsTokenHighlight } from "../token-highlight.js";
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
 * The pane remembers its scroll offsets per Session, file, scope and mode, and
 * restores them when the tab is mounted again after a Session switch.
 *
 * Selecting one token lights up every occurrence in the view: the browser paints the
 * matches through the CSS Custom Highlight API, or they are wrapped in `<mark>` when
 * that API is missing.
 *
 * @param props - `{ state, wrap, t, onRetry, busy, actionError, onAction, viewKey,
 *   token, onToken }`.
 */
export function SplitDiff({
  state,
  wrap,
  t,
  onRetry,
  busy,
  actionError,
  onAction,
  viewKey,
  token,
  onToken,
}) {
  const data = state !== undefined && state.phase === "ready" ? state.data : undefined;
  const text = data !== undefined && data.kind === "text" ? data : undefined;
  const language =
    text !== undefined && languageForPath !== null ? languageForPath(text.path) : undefined;
  const highlighter = useCodeHighlighter === null ? undefined : useCodeHighlighter(language);
  const leftRef = react.useRef(null);
  const rightRef = react.useRef(null);
  const bodyRef = react.useRef(null);
  const guard = react.useRef(false);
  const restored = react.useRef(false);
  const memoryKey = String(viewKey) + "\u0000split\u0000" + (wrap === true ? "wrap" : "nowrap");
  const model = react.useMemo(() => {
    if (text === undefined) return null;
    return buildDiffModel(text, highlighter, "split");
  }, [text, highlighter]);

  const selected = token === null || token === undefined ? null : token;
  useTokenHighlight(bodyRef, selected, model, wrap);
  // The CSS API paints the matches itself; only a browser without it needs marks,
  // which would re-create the text nodes and drop the user's selection.
  const markToken = supportsTokenHighlight() === true ? null : selected;

  /** Take the token a finished selection names, or clear the highlight. */
  const pickToken = (event) => {
    if (typeof onToken !== "function") return;
    onToken(selectedToken(event.currentTarget));
  };

  /** Keep the current scroll offsets under this view's key. */
  const remember = () => {
    if (wrap === true) {
      const body = bodyRef.current;
      if (body === null) return;
      writeScroll(memoryKey, { top: body.scrollTop, left: body.scrollLeft });
      return;
    }
    const left = leftRef.current;
    const right = rightRef.current;
    if (left === null && right === null) return;
    writeScroll(memoryKey, {
      top: left === null ? 0 : left.scrollTop,
      left: left === null ? 0 : left.scrollLeft,
      top2: right === null ? 0 : right.scrollTop,
      left2: right === null ? 0 : right.scrollLeft,
    });
  };

  /** Put the remembered offsets back once the content is on screen. */
  const restore = () => {
    const saved = readScroll(memoryKey);
    if (saved === undefined) return;
    if (wrap === true) {
      const body = bodyRef.current;
      if (body !== null) {
        body.scrollTop = saved.top ?? 0;
        body.scrollLeft = saved.left ?? 0;
      }
      return;
    }
    const left = leftRef.current;
    if (left !== null) {
      left.scrollTop = saved.top ?? 0;
      left.scrollLeft = saved.left ?? 0;
    }
    const right = rightRef.current;
    if (right !== null) {
      right.scrollTop = saved.top2 ?? saved.top ?? 0;
      right.scrollLeft = saved.left2 ?? saved.left ?? 0;
    }
  };

  react.useEffect(() => {
    restored.current = false;
  }, [memoryKey]);
  react.useEffect(() => {
    if (restored.current || model === null) return;
    restored.current = true;
    restore();
  }, [memoryKey, model]);
  react.useEffect(() => () => remember(), [memoryKey, wrap]);

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
            token: markToken,
          }))
            cells.push(cell);
        }
      }
    return h(
      "div",
      { className: "dsc-dbody", ref: bodyRef, onScroll: remember, onMouseUp: pickToken },
      [
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
      ],
    );
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
                : h(DiffText, { key: "c", text: cell.text, spans, token: markToken }),
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

  return h(
    "div",
    { className: "dsc-dbody", ref: bodyRef, onScroll: remember, onMouseUp: pickToken },
    [
      actionNote,
      head,
      h("div", { className: "dsc-lanes", key: "l" }, [
        h(
          "div",
          {
            className: "dsc-lane dsc-lane-left",
            key: "left",
            ref: leftRef,
            onScroll: (event) => {
              syncLanes(event.currentTarget, rightRef.current, guard);
              remember();
            },
          },
          lane("left"),
        ),
        h(
          "div",
          {
            className: "dsc-lane dsc-lane-right",
            key: "right",
            ref: rightRef,
            onScroll: (event) => {
              syncLanes(event.currentTarget, leftRef.current, guard);
              remember();
            },
          },
          lane("right"),
        ),
      ]),
      truncation,
    ],
  );
}
