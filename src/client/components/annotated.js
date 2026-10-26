import { languageForPath, useCodeHighlighter } from "../primitives.js";
import { h, react } from "../react.js";
import { DiffText } from "./diff-text.js";

/** Most lines the annotated view will hand to the highlighter in one call. */
const HIGHLIGHT_LINE_CAP = 20000;

/**
 * Never-fail whole-file view: the current text, with the turn's additions marked in
 * place and its deletions drawn where they were removed. It is an annotation, not a
 * historical diff, and it is what By turn + Full falls back to when the walk back
 * through the turns no longer lines up.
 *
 * @param props - `{ text, hunks, path, wrap, layout, t, onScrollLeft, onScrollRight }`.
 */
export function AnnotatedPane({ text, hunks, path, wrap, layout, t, onScrollLeft, onScrollRight }) {
  const language = languageForPath !== null ? languageForPath(path) : undefined;
  const highlighter = useCodeHighlighter === null ? undefined : useCodeHighlighter(language);
  const model = react.useMemo(() => {
    const lines = String(text === undefined ? "" : text).split("\n");
    const spans =
      highlighter === undefined || lines.length > HIGHLIGHT_LINE_CAP
        ? undefined
        : highlighter(String(text === undefined ? "" : text));
    const added = new Set();
    const removed = new Map();
    for (const hunk of Array.isArray(hunks) ? hunks : []) {
      let newNo = hunk.newStart;
      let pending = [];
      for (const line of Array.isArray(hunk.lines) ? hunk.lines : []) {
        if (line[0] === "-") {
          pending.push(line.slice(1));
          continue;
        }
        if (pending.length > 0) {
          removed.set(newNo, (removed.get(newNo) ?? []).concat(pending));
          pending = [];
        }
        if (line[0] === "+") added.add(newNo);
        newNo += 1;
      }
      if (pending.length > 0) removed.set(newNo, (removed.get(newNo) ?? []).concat(pending));
    }
    const rows = [];
    for (let at = 1; at <= lines.length; at += 1) {
      const gone = removed.get(at);
      if (gone !== undefined)
        for (const line of gone)
          rows.push({ kind: "del", left: line, right: undefined, spans: undefined });
      rows.push({
        kind: added.has(at) ? "add" : "ctx",
        left: undefined,
        right: at,
        spans: spans === undefined ? undefined : spans[at - 1],
        text: lines[at - 1],
      });
    }
    const tail = removed.get(lines.length + 1);
    if (tail !== undefined)
      for (const line of tail)
        rows.push({ kind: "del", left: line, right: undefined, spans: undefined });
    return { rows, lines };
  }, [text, hunks, highlighter]);

  if (layout === "inline") {
    return h(
      "div",
      { className: "dsc-dbody" },
      h(
        "div",
        { className: "dsc-unified", "data-wrap": wrap === true ? "true" : "false", key: "u" },
        model.rows.map((row, at) =>
          h(
            "div",
            {
              className: "dsc-urow",
              "data-kind": row.kind,
              key: "r" + String(at),
            },
            [
              h("span", { className: "dsc-uno", key: "o" }, ""),
              h(
                "span",
                { className: "dsc-uno", key: "n" },
                row.right === undefined ? "" : String(row.right),
              ),
              h(
                "span",
                { className: "dsc-usign", key: "s" },
                row.kind === "add" ? "+" : row.kind === "del" ? "−" : "",
              ),
              row.kind === "del"
                ? h("span", { className: "dsc-code", key: "c" }, row.left)
                : h(DiffText, { key: "c", text: row.text, spans: row.spans }),
            ],
          ),
        ),
      ),
    );
  }

  /**
   * One lane's rows. A deletion is drawn on the left and padded on the right; every
   * other line is drawn on the right and padded on the left.
   * @param side - which lane to draw.
   * @returns the elements in order.
   */
  const lane = (side) =>
    model.rows.map((row, at) =>
      h(
        "div",
        {
          className: "dsc-lrow",
          "data-kind":
            side === "left" && row.kind !== "del"
              ? "pad"
              : side === "right" && row.kind === "del"
                ? "pad"
                : row.kind,
          key: "l" + String(at),
        },
        [
          h(
            "span",
            { className: "dsc-lno", key: "n" },
            side === "right" && row.right !== undefined ? String(row.right) : "",
          ),
          row.kind === "del"
            ? side === "left"
              ? h("span", { className: "dsc-code", key: "c" }, row.left)
              : h("span", { className: "dsc-code", key: "c" })
            : side === "right"
              ? h(DiffText, { key: "c", text: row.text, spans: row.spans })
              : h("span", { className: "dsc-code", key: "c" }),
        ],
      ),
    );

  return h(
    "div",
    { className: "dsc-dbody" },
    h("div", { className: "dsc-lanes", key: "l" }, [
      h(
        "div",
        { className: "dsc-lane dsc-lane-left", key: "left", onScroll: onScrollLeft },
        lane("left"),
      ),
      h(
        "div",
        { className: "dsc-lane dsc-lane-right", key: "right", onScroll: onScrollRight },
        lane("right"),
      ),
    ]),
  );
}
