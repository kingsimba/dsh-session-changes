import { ROW_CAP } from "../constants.js";
import { buildDiffModel } from "../diff/model.js";
import { hunkLabel } from "../diff/rows.js";
import { languageForPath, useCodeHighlighter } from "../primitives.js";
import { h, react } from "../react.js";
import { readScroll, writeScroll } from "../session-memory.js";
import { BlockActions } from "./block-actions.js";
import { DiffText } from "./diff-text.js";
import { comparisonNotes, notesBlock, paneNote } from "./pane-note.js";

/**
 * One comparison drawn as a single column: old line number, new line number, a
 * sign, and the line. This is the inline layout; it takes the same payload as the
 * split layout, so either scope can use either one. A changed row carries its
 * block's accept/revert buttons, shown only while that row is hovered.
 *
 * The scroll offset is remembered per Session, file, scope and mode, and restored
 * when the tab is mounted again after a Session switch.
 *
 * @param props - `{ state, wrap, t, onRetry, busy, actionError, onAction, viewKey }`.
 */
export function InlineDiff({ state, wrap, t, onRetry, busy, actionError, onAction, viewKey }) {
  const data = state !== undefined && state.phase === "ready" ? state.data : undefined;
  const text = data !== undefined && data.kind === "text" ? data : undefined;
  const language =
    text !== undefined && languageForPath !== null ? languageForPath(text.path) : undefined;
  const highlighter = useCodeHighlighter === null ? undefined : useCodeHighlighter(language);
  const bodyRef = react.useRef(null);
  const restored = react.useRef(false);
  const memoryKey = String(viewKey) + "\u0000inline\u0000" + (wrap === true ? "wrap" : "nowrap");
  const model = react.useMemo(() => {
    if (text === undefined) return null;
    return buildDiffModel(text, highlighter, "inline");
  }, [text, highlighter]);

  /** Keep the current scroll offsets under this view's key. */
  const remember = () => {
    const body = bodyRef.current;
    if (body !== null) writeScroll(memoryKey, { top: body.scrollTop, left: body.scrollLeft });
  };

  /** Put the remembered offsets back once the content is on screen. */
  const restore = () => {
    const saved = readScroll(memoryKey);
    const body = bodyRef.current;
    if (saved === undefined || body === null) return;
    body.scrollTop = saved.top ?? 0;
    body.scrollLeft = saved.left ?? 0;
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

  const rows = [];
  if (model !== null)
    for (let at = 0; at < model.blocks.length; at += 1) {
      const block = model.blocks[at];
      rows.push(h("div", { className: "dsc-hunk", key: "h" + String(at) }, hunkLabel(block.hunk)));
      for (let rowAt = 0; rowAt < block.rows.length; rowAt += 1) {
        const row = block.rows[rowAt];
        const map =
          block.marks === undefined
            ? undefined
            : row.kind === "del"
              ? block.marks.old
              : block.marks.new;
        const spans =
          map === undefined ? undefined : map.get(row.kind === "del" ? row.old : row.new);
        rows.push(
          h(
            "div",
            {
              className: "dsc-urow",
              "data-kind": row.kind === "add" ? "add" : row.kind === "del" ? "del" : "ctx",
              key: "r" + String(at) + ":" + String(rowAt),
            },
            [
              h(
                "span",
                { className: "dsc-uno", key: "o" },
                row.old === undefined ? "" : String(row.old),
              ),
              h(
                "span",
                { className: "dsc-uno", key: "n" },
                row.new === undefined ? "" : String(row.new),
              ),
              h(
                "span",
                { className: "dsc-usign", key: "s" },
                row.kind === "add" ? "+" : row.kind === "del" ? "−" : "",
              ),
              h(DiffText, { key: "c", text: row.text, spans }),
              h(BlockActions, { key: "a", t, block: row.block, busy, onAction }),
            ],
          ),
        );
      }
    }

  const actionNote =
    actionError === undefined || actionError === null
      ? null
      : h("div", { className: "dsc-dnote dsc-actionnote", key: "act" }, actionError);

  return h("div", { className: "dsc-dbody", ref: bodyRef, onScroll: remember }, [
    actionNote,
    notesBlock(comparisonNotes(data, model, t)),
    h(
      "div",
      { className: "dsc-unified", "data-wrap": wrap === true ? "true" : "false", key: "u" },
      rows,
    ),
    model !== null && model.truncated
      ? h(
          "div",
          { className: "dsc-dnote", key: "trunc" },
          t("truncated", { count: String(ROW_CAP) }),
        )
      : null,
  ]);
}
