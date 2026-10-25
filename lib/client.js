window.__ModuleLoader__.load({
	id: "dsh-session-changes",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		var __dshSessionChangesBundle = (function (exports) {
		  'use strict';

		  /**
		   * The Host module loader, as seen from inside the bundle.
		   *
		   * `require` here is the factory parameter `lib/client.js` is wrapped in (see
		   * scripts/build.mjs): rollup emits this call untouched, because it is a plain
		   * reference rather than an import. Keeping it in one place is what lets every other
		   * source file stay an ordinary ES module and still ask the Host for `react` and the
		   * shared client primitives.
		   *
		   * @param name - a package name the Host knows how to resolve.
		   * @returns whatever that package exports.
		   */
		  function loadModule(name) {
		    return require(name);
		  }

		  /** React as the Host provides it. */
		  const react = loadModule("react");

		  /** The element factory every component in this package uses. */
		  const h = react.createElement;

		  /**
		   * The selectable value one list row stands for. The row itself is list-shaped;
		   * a selection has to survive the list being rebuilt, so it keeps only data.
		   *
		   * @param row - one list row.
		   * @returns the selection.
		   */
		  function selectionOf(row) {
		    const file = row.file;
		    return {
		      path: file.path,
		      display: file.display,
		      added: file.added,
		      deleted: file.deleted,
		      binary: file.binary,
		      oversized: file.oversized,
		      entries: row.entries,
		    };
		  }

		  /**
		   * Whether two selections point at the same file through the same turns.
		   * @param current - the selected value, or null.
		   * @param next - the candidate selection.
		   * @returns true when adopting `next` would not change anything.
		   */
		  function sameSelection(current, next) {
		    if (current === null || next === null) return false;
		    if (current.path !== next.path) return false;
		    if (current.entries.length !== next.entries.length) return false;
		    return current.entries.every(
		      (entry, at) => entry.seq === next.entries[at].seq && entry.index === next.entries[at].index,
		    );
		  }

		  /**
		   * Whether one list row is the selected file: the same path everywhere, and in
		   * By-turn mode also the same review coordinates.
		   *
		   * @param row - one list row.
		   * @param selected - the selected value, or null.
		   * @param mode - `turn` or `overall`.
		   * @returns true when the row should render as selected.
		   */
		  function rowMatchesSelection(row, selected, mode) {
		    if (selected === null || selected.path !== row.file.path) return false;
		    if (mode === "overall") return true;
		    const mine = selected.entries[0];
		    const theirs = row.entries[0];
		    if (mine === undefined || theirs === undefined) return false;
		    return mine.seq === theirs.seq && mine.index === theirs.index;
		  }

		  /**
		   * Stable cache key of one review coordinate.
		   * @param entry - a `{ seq, index, turn }` row.
		   * @returns `seq:index`.
		   */
		  function entryKey(entry) {
		    return String(entry.seq) + ":" + String(entry.index);
		  }

		  /**
		   * The selected file's entry that the comparison should show.
		   * @param selected - the selected value, or null.
		   * @param entryIndex - the entry the user last picked.
		   * @returns the entry, or undefined while nothing is selected.
		   */
		  function activeEntryOf(selected, entryIndex) {
		    if (selected === null) return undefined;
		    return selected.entries[Math.min(entryIndex, Math.max(0, selected.entries.length - 1))];
		  }

		  /**
		   * The shared client primitives carry the Shiki-backed tokenizer the built-in review
		   * uses. They are optional: a Host without them still renders plain text, so a failed
		   * load is remembered as "no highlighter" instead of breaking the tab.
		   */
		  function loadPrimitives() {
		    try {
		      const loaded = loadModule("@deepseek-ai/dsh-client-ui-primitives");
		      return loaded === null || typeof loaded !== "object" ? null : loaded;
		    } catch (_error) {
		      return null;
		    }
		  }

		  const primitives = loadPrimitives();

		  /** Binds one language to the shared highlighter, or null when the Host has none. */
		  const useCodeHighlighter =
		    primitives === null || typeof primitives.useCodeHighlighter !== "function"
		      ? null
		      : primitives.useCodeHighlighter;

		  /** Maps a file path to the language the highlighter understands, or null. */
		  const languageForPath =
		    primitives === null || typeof primitives.languageForPath !== "function"
		      ? null
		      : primitives.languageForPath;

		  /**
		   * One cell's text, coloured by the shared highlighter when it produced spans.
		   * @param props - `{ text, spans }`.
		   */
		  function DiffText({ text, spans }) {
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
		  function DiffCells({ row, marks, keyPrefix }) {
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

		  /** Most lines the annotated view will hand to the highlighter in one call. */
		  const HIGHLIGHT_LINE_CAP = 20000;

		  /**
		   * Never-fail whole-file view: the current text, with the turn's additions marked in
		   * place and its deletions drawn where they were removed. It is an annotation, not a
		   * historical diff, and it is what the comparison falls back to when the baseline
		   * cannot be rebuilt.
		   *
		   * @param props - `{ text, hunks, path, wrap, layout, t, onScrollLeft, onScrollRight }`.
		   */
		  function AnnotatedPane({ text, hunks, path, wrap, layout, t, onScrollLeft, onScrollRight }) {
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

		  /** Dictionary namespace. */
		  const NS = "session-changes";

		  /** This implementation's identity in the tab system, and the key its body registers under. */
		  const TYPE_ID = "dsh-session-changes";

		  /** The page kind the guide entry opens. */
		  const KIND = "session-changes";

		  /** Resource-address prefix of one turn's existing review tab. */
		  const REVIEW_PREFIX = "dsh-resource://changes-review/session/";

		  /** The authenticated read routes served by this package's Host half and by ui-deliverables. */
		  const LIST_ROUTE = "api/session-changes.list";
		  const DIFF_ROUTE = "api/changes.diff";

		  /** Native open of a changed file, served by ui-deliverables' Host half. */
		  const OPEN_ROUTE = "api/changes.open";

		  /** The Host route that serves one changed file's current text. */
		  const FILE_ROUTE = "api/session-changes.file";

		  /** The Host route that serves the file's first pre-image in this Session. */
		  const BASE_ROUTE = "api/session-changes.base";

		  /** The Host route that reports which of the listed paths still exist on disk. */
		  const EXISTS_ROUTE = "api/session-changes.exists";

		  /** Persisted preferences: left pane width, wrap, list mode, whole-file scope, layout. */
		  const WIDTH_KEY = "dsh-session-changes.left";
		  const WRAP_KEY = "dsh-session-changes.wrap";
		  const MODE_KEY = "dsh-session-changes.mode";
		  const WHOLE_KEY = "dsh-session-changes.whole";
		  const LAYOUT_KEY = "dsh-session-changes.layout";

		  /** Pane geometry bounds, in pixels. */
		  const MIN_LEFT = 180;
		  const MIN_RIGHT = 260;

		  /** Left pane width before the user has dragged it. */
		  const DEFAULT_LEFT = 220;

		  /** Rows drawn before the comparison says it stopped. */
		  const ROW_CAP = 5000;

		  /** Context lines kept around each change when a whole-file diff is cut into hunks. */
		  const DIFF_CONTEXT = 3;

		  /** Identifies this package's stylesheet tag, so a reload never stacks a second copy. */
		  const CSS_TAG_ID = "dsh-session-changes/list.css";

		  /**
		   * Tokenize one side of a hunk with the shared highlighter. Each side is highlighted
		   * on its own because the omitted source lines are unavailable, which is the same
		   * hunk-local pass the built-in review runs.
		   *
		   * @param rows - numbered hunk rows.
		   * @param side - which line numbers to keep.
		   * @param highlighter - the theme-bound highlighter.
		   * @returns a map from line number to spans, or undefined while unavailable.
		   */
		  function highlightedSide(rows, side, highlighter) {
		    const source = rows.flatMap((row) => {
		      const no = row[side];
		      return no === undefined ? [] : [{ no, text: row.text }];
		    });
		    if (source.length === 0) return new Map();
		    const highlighted = highlighter(source.map((line) => line.text).join("\n"));
		    if (highlighted === undefined) return undefined;
		    return new Map(source.map((line, index) => [line.no, highlighted[index] ?? []]));
		  }

		  /**
		   * Number a hunk's lines: context lines count on both sides, deletions on the
		   * old side, additions on the new side.
		   *
		   * @param hunk - a served hunk.
		   * @returns the rows in order.
		   */
		  function hunkRows(hunk) {
		    let oldNo = hunk.oldStart;
		    let newNo = hunk.newStart;
		    return (Array.isArray(hunk.lines) ? hunk.lines : []).map((line) => {
		      const text = line.slice(1);
		      switch (line[0]) {
		        case "+":
		          return { kind: "add", old: undefined, new: newNo++, text };
		        case "-":
		          return { kind: "del", old: oldNo++, new: undefined, text };
		        default:
		          return { kind: "context", old: oldNo++, new: newNo++, text };
		      }
		    });
		  }

		  /**
		   * Pair numbered rows for the side-by-side view: each run of deletions is aligned
		   * with the run of additions that follows it, row by row, and context lines sit on
		   * both sides.
		   *
		   * @param rows - the hunk's numbered rows.
		   * @returns the paired rows in order.
		   */
		  function splitRows(rows) {
		    const out = [];
		    let dels = [];
		    let adds = [];
		    const flush = () => {
		      for (let at = 0; at < Math.max(dels.length, adds.length); at += 1) {
		        const left = dels[at];
		        const right = adds[at];
		        out.push({
		          ...(left === undefined ? {} : { left }),
		          ...(right === undefined ? {} : { right }),
		        });
		      }
		      dels = [];
		      adds = [];
		    };
		    for (const row of rows) {
		      if (row.kind === "del") dels.push({ no: row.old, text: row.text, kind: "del" });
		      else if (row.kind === "add") adds.push({ no: row.new, text: row.text, kind: "add" });
		      else {
		        flush();
		        out.push({
		          left: { no: row.old, text: row.text, kind: "context" },
		          right: { no: row.new, text: row.text, kind: "context" },
		        });
		      }
		    }
		    flush();
		    return out;
		  }

		  /**
		   * The range header of one hunk.
		   * @param hunk - a served hunk.
		   * @returns `@@ -a,b +c,d @@`.
		   */
		  function hunkLabel(hunk) {
		    return (
		      "@@ -" +
		      String(hunk.oldStart) +
		      "," +
		      String(hunk.oldLines) +
		      " +" +
		      String(hunk.newStart) +
		      "," +
		      String(hunk.newLines) +
		      " @@"
		    );
		  }

		  /**
		   * Number, pair and highlight a comparison's hunks, stopping at {@link ROW_CAP}
		   * drawn lines so one huge file cannot lock the render.
		   *
		   * @param text - the served text payload (`{ hunks }`).
		   * @param highlighter - the theme-bound highlighter, or undefined for plain text.
		   * @param shape - `split` pairs both sides of every row; `inline` keeps one row.
		   * @returns `{ blocks, truncated }`, one block per hunk.
		   */
		  function buildDiffModel(text, highlighter, shape) {
		    const hunks = Array.isArray(text.hunks) ? text.hunks : [];
		    let budget = ROW_CAP;
		    const blocks = [];
		    let truncated = false;
		    for (const hunk of hunks) {
		      if (budget <= 0) {
		        truncated = true;
		        break;
		      }
		      const kept =
		        hunk.lines.length <= budget ? hunk : { ...hunk, lines: hunk.lines.slice(0, budget) };
		      budget -= kept.lines.length;
		      if (kept !== hunk) truncated = true;
		      const numbered = hunkRows(kept);
		      let marks;
		      if (highlighter !== undefined)
		        marks = {
		          old: highlightedSide(numbered, "old", highlighter),
		          new: highlightedSide(numbered, "new", highlighter),
		        };
		      blocks.push({
		        hunk: kept,
		        rows: shape === "split" ? splitRows(numbered) : numbered,
		        marks,
		      });
		    }
		    return { blocks, truncated };
		  }

		  /**
		   * The note a pane shows when the payload is not renderable text. Both layouts use
		   * the same wording, so it lives here once.
		   *
		   * @param state - the payload state (`undefined` while nothing was requested).
		   * @param t - the bound dictionary.
		   * @param onRetry - retries the read.
		   * @returns the note element, or null when the payload is a drawable text diff.
		   */
		  function paneNote(state, t, onRetry) {
		    if (state === undefined || state.phase === "loading")
		      return h("div", { className: "dsc-note" }, t("diffLoading"));
		    if (state.phase === "error") {
		      return h("div", { className: "dsc-note" }, [
		        h("span", { key: "m" }, t("diffError")),
		        h("button", { type: "button", className: "dsc-btn", key: "b", onClick: onRetry }, t("retry")),
		      ]);
		    }
		    const data = state.phase === "ready" ? state.data : undefined;
		    if (data === undefined) return h("div", { className: "dsc-note" }, t("diffError"));
		    if (data.kind === "binary") return h("div", { className: "dsc-note" }, t("diffBinary"));
		    if (data.kind === "oversized") return h("div", { className: "dsc-note" }, t("diffOversized"));
		    return null;
		  }

		  /**
		   * The notes a comparison shows above the code.
		   * @param data - the text payload.
		   * @param model - the built diff model, or null.
		   * @param t - the bound dictionary.
		   * @returns `[key, label]` pairs, in reading order.
		   */
		  function comparisonNotes(data, model, t) {
		    const notes = [];
		    if (data.before !== true) notes.push(["created", t("created")]);
		    if (data.after !== true) notes.push(["deleted", t("deleted")]);
		    if (data.coarse === true) notes.push(["coarse", t("coarse")]);
		    if ((model === null || model.blocks.length === 0) && data.after !== false)
		      notes.push(["same", t("same")]);
		    return notes;
		  }

		  /**
		   * The notes block above a comparison.
		   * @param notes - `[key, label]` pairs from {@link comparisonNotes}.
		   * @returns the element, or null when there is nothing to say.
		   */
		  function notesBlock(notes) {
		    if (notes.length === 0) return null;
		    return h(
		      "div",
		      { className: "dsc-dnotes", key: "n" },
		      notes.map(([key, label]) => h("div", { className: "dsc-dnote", key }, label)),
		    );
		  }

		  /**
		   * One comparison drawn as a single column: old line number, new line number, a
		   * sign, and the line. This is the inline layout; it takes the same payload as the
		   * split layout, so either scope can use either one.
		   *
		   * @param props - `{ state, wrap, t, onRetry }`.
		   */
		  function InlineDiff({ state, wrap, t, onRetry }) {
		    const data = state !== undefined && state.phase === "ready" ? state.data : undefined;
		    const text = data !== undefined && data.kind === "text" ? data : undefined;
		    const language =
		      text !== undefined && languageForPath !== null ? languageForPath(text.path) : undefined;
		    const highlighter = useCodeHighlighter === null ? undefined : useCodeHighlighter(language);
		    const model = react.useMemo(() => {
		      if (text === undefined) return null;
		      return buildDiffModel(text, highlighter, "inline");
		    }, [text, highlighter]);

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
		              ],
		            ),
		          );
		        }
		      }

		    return h("div", { className: "dsc-dbody" }, [
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
		   * @param props - `{ state, wrap, t, onRetry }`.
		   */
		  function SplitDiff({ state, wrap, t, onRetry }) {
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
		            }))
		              cells.push(cell);
		          }
		        }
		      return h("div", { className: "dsc-dbody" }, [
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
		     * One lane's rows: hunk header, then number, sign and the line.
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
		              ],
		            ),
		          );
		        }
		      }
		      return out;
		    };

		    return h("div", { className: "dsc-dbody" }, [
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

		  /**
		   * What the comparison area shows: the pane for the served payload, a note while
		   * something is missing, or the annotated fallback when the baseline cannot be
		   * rebuilt.
		   *
		   * @param props - the current selection, the computed comparison and its sources.
		   */
		  function DetailBody({
		    t,
		    selected,
		    activeEntry,
		    layout,
		    whole,
		    mode,
		    wrap,
		    comparison,
		    diffs,
		    baseState,
		    wholeState,
		    onRetry,
		  }) {
		    if (selected === null || activeEntry === undefined)
		      return h("div", { className: "dsc-note" }, t("pick"));

		    const key = entryKey(activeEntry);
		    const needsComputed = whole === true || mode === "overall";
		    let payloadState;
		    let note = null;
		    let banner = null;
		    let annotate = null;
		    if (needsComputed) {
		      if (comparison === null || comparison.status === "pending") note = t("loading");
		      else if (comparison.status === "unreadable") note = t("wholeError");
		      else if (comparison.status === "binary") note = t("diffBinary");
		      else if (comparison.status === "oversized") note = t("diffOversized");
		      else if (comparison.status === "drift") {
		        // Reconstruction failed: annotate the current file instead of dead-ending.
		        banner = t("overallDrift");
		        if (wholeState === undefined || wholeState.phase !== "ready") note = t("loading");
		        else
		          annotate = {
		            text: wholeState.text,
		            hunks:
		              diffs[key] !== undefined &&
		              diffs[key].phase === "ready" &&
		              diffs[key].data !== undefined &&
		              Array.isArray(diffs[key].data.hunks)
		                ? diffs[key].data.hunks
		                : [],
		          };
		      } else {
		        const baselineMissing =
		          baseState !== undefined && baseState.phase === "ready" && baseState.absent === true;
		        payloadState = {
		          phase: "ready",
		          data: {
		            kind: "text",
		            path: selected.path,
		            display: selected.display,
		            before: baselineMissing !== true,
		            after: comparison.gone !== true,
		            coarse: comparison.coarse === true,
		            hunks: whole === true ? comparison.full : comparison.hunks,
		          },
		        };
		      }
		    } else {
		      payloadState = diffs[key];
		    }

		    const pane =
		      layout === "inline"
		        ? h(InlineDiff, { state: payloadState, wrap, t, onRetry })
		        : h(SplitDiff, { state: payloadState, wrap, t, onRetry });

		    if (note !== null) return h("div", { className: "dsc-note" }, note);
		    if (annotate !== null)
		      return h("div", { className: "dsc-wrap" }, [
		        h("div", { className: "dsc-dnote", key: "b" }, banner),
		        h(
		          "div",
		          { className: "dsc-wrap-body", key: "p" },
		          h(AnnotatedPane, {
		            text: annotate.text,
		            hunks: annotate.hunks,
		            path: selected.path,
		            wrap,
		            layout,
		            t,
		          }),
		        ),
		      ]);
		    if (banner === null) return pane;
		    return h("div", { className: "dsc-wrap" }, [
		      h("div", { className: "dsc-dnote", key: "b" }, banner),
		      h("div", { className: "dsc-wrap-body", key: "p" }, pane),
		    ]);
		  }

		  /**
		   * A file's line counts, or the reason it has none.
		   * @param props - `{ added, deleted, binary, oversized, t }`.
		   */
		  function Counts({ added, deleted, binary, oversized, t }) {
		    if (binary === true) return h("span", { className: "dsc-counts dsc-muted" }, t("binary"));
		    if (oversized === true) return h("span", { className: "dsc-counts dsc-muted" }, t("oversized"));
		    return h("span", { className: "dsc-counts" }, [
		      h("span", { className: "dsc-add", key: "a" }, "+" + String(added)),
		      h("span", { className: "dsc-del", key: "d" }, "−" + String(deleted)),
		    ]);
		  }

		  /**
		   * The comparison toolbar: name, counts, and the layout / scope / open / wrap /
		   * review buttons.
		   *
		   * @param props - the selected file plus the actions the buttons run.
		   */
		  function RightHead({
		    t,
		    selected,
		    layout,
		    whole,
		    wrap,
		    opening,
		    openFailed,
		    onToggleLayout,
		    onToggleWhole,
		    onOpenFile,
		    onToggleWrap,
		    onOpenReview,
		  }) {
		    return h("div", { className: "dsc-dhead", key: "h" }, [
		      h(
		        "span",
		        { className: "dsc-dpath", key: "p", title: selected === null ? "" : selected.path },
		        selected === null ? t("pick") : selected.display,
		      ),
		      selected === null
		        ? null
		        : h(Counts, {
		            key: "c",
		            added: selected.added,
		            deleted: selected.deleted,
		            binary: selected.binary,
		            oversized: selected.oversized,
		            t,
		          }),
		      selected === null
		        ? null
		        : h(
		            "button",
		            {
		              type: "button",
		              className: "dsc-btn",
		              key: "l",
		              title: layout === "inline" ? t("layoutSplit") : t("layoutInline"),
		              "aria-label": layout === "inline" ? t("layoutSplit") : t("layoutInline"),
		              "aria-pressed": layout === "inline" ? "true" : "false",
		              onClick: onToggleLayout,
		            },
		            layout === "inline" ? t("layoutInlineShort") : t("layoutSplitShort"),
		          ),
		      selected === null
		        ? null
		        : h(
		            "button",
		            {
		              type: "button",
		              className: "dsc-btn",
		              key: "f",
		              title: whole === true ? t("wholeOff") : t("wholeOn"),
		              "aria-label": whole === true ? t("wholeOff") : t("wholeOn"),
		              "aria-pressed": whole === true ? "true" : "false",
		              "data-active": whole === true ? "true" : "false",
		              onClick: onToggleWhole,
		            },
		            t("wholeShort"),
		          ),
		      selected === null
		        ? null
		        : h(
		            "button",
		            {
		              type: "button",
		              className: "dsc-btn",
		              key: "e",
		              title: openFailed === true ? t("openAppFailed") : t("openApp"),
		              "aria-label": t("openApp"),
		              disabled: opening,
		              onClick: onOpenFile,
		            },
		            "⤴",
		          ),
		      selected === null
		        ? null
		        : h(
		            "button",
		            {
		              type: "button",
		              className: "dsc-btn",
		              key: "w",
		              title: wrap === true ? t("wrapOff") : t("wrapOn"),
		              "aria-label": wrap === true ? t("wrapOff") : t("wrapOn"),
		              "aria-pressed": wrap === true ? "true" : "false",
		              onClick: onToggleWrap,
		            },
		            "↵",
		          ),
		      selected === null
		        ? null
		        : h(
		            "button",
		            {
		              type: "button",
		              className: "dsc-btn",
		              key: "o",
		              title: t("review"),
		              "aria-label": t("review"),
		              onClick: onOpenReview,
		            },
		            "↗",
		          ),
		    ]);
		  }

		  /**
		   * The turn strip above the comparison: every turn of the Session, oldest first.
		   *
		   * @param props - `{ t, turns, activeTurn, onPick }`.
		   * @returns the strip, or null outside By-turn mode.
		   */
		  function TurnChips({ t, turns, activeTurn, onPick }) {
		    if (turns.length === 0) return null;
		    return h(
		      "div",
		      { className: "dsc-chips", key: "c" },
		      turns.map((item) =>
		        h(
		          "button",
		          {
		            type: "button",
		            className: "dsc-chip",
		            key: "c" + String(item.turn),
		            title:
		              t("sectionTurn", { turn: String(item.turn) }) +
		              " · " +
		              (item.total === 1 ? t("oneFile") : t("files", { count: String(item.total) })),
		            "data-active": item.turn === activeTurn ? "true" : "false",
		            "aria-pressed": item.turn === activeTurn ? "true" : "false",
		            onClick: () => onPick(item.turn),
		          },
		          t("sectionTurn", { turn: String(item.turn) }),
		        ),
		      ),
		    );
		  }

		  /**
		   * The comparison pane: toolbar, turn strip, and the body.
		   *
		   * @param props - `{ t, mode, turns, activeTurn, onPickTurn }` plus the toolbar and
		   *   body inputs: `selected`, `activeEntry`, `layout`, `whole`, `wrap`, `opening`,
		   *   `openFailed`, `comparison`, `diffs`, `baseState`, `wholeState`, `onRetry`, and
		   *   the toolbar callbacks.
		   */
		  function DetailPane({ t, mode, turns, activeTurn, onPickTurn, ...rest }) {
		    return h("div", { className: "dsc-pane dsc-right", key: "r" }, [
		      h(RightHead, { t, ...rest }),
		      mode === "turn" ? h(TurnChips, { t, turns, activeTurn, onPick: onPickTurn }) : null,
		      h(DetailBody, { t, mode, ...rest }),
		    ]);
		  }

		  /**
		   * The master list: title, session totals, the mode switch, and the rows.
		   *
		   * @param props - `{ t, state, view, rows, mode, busy, left, onMode, onRefresh }`.
		   */
		  function ListPane({ t, state, view, rows, mode, busy, left, onMode, onRefresh }) {
		    let listBody;
		    if (state.phase === "loading") listBody = h("div", { className: "dsc-note" }, t("loading"));
		    else if (state.phase === "error")
		      listBody = h("div", { className: "dsc-note" }, [
		        h("span", { key: "m" }, t("error")),
		        h(
		          "button",
		          { type: "button", className: "dsc-btn", key: "b", onClick: onRefresh },
		          t("retry"),
		        ),
		      ]);
		    else if (rows.length === 0) listBody = h("div", { className: "dsc-note" }, t("empty"));
		    else listBody = h("div", { className: "dsc-body" }, rows);

		    return h(
		      "div",
		      { className: "dsc-pane dsc-left", key: "l", style: { flex: "0 0 " + String(left) + "px" } },
		      [
		        h("div", { className: "dsc-head", key: "h" }, [
		          h("span", { className: "dsc-title", key: "t" }, t("title")),
		          state.turns.length === 0
		            ? null
		            : h("span", { className: "dsc-stat", key: "s" }, [
		                h("span", { className: "dsc-add", key: "a" }, "+" + String(view.added)),
		                h("span", { className: "dsc-del", key: "d" }, "−" + String(view.deleted)),
		              ]),
		          h(
		            "button",
		            {
		              type: "button",
		              className: "dsc-btn",
		              key: "r",
		              title: t("refresh"),
		              "aria-label": t("refresh"),
		              disabled: busy,
		              onClick: onRefresh,
		            },
		            "↻",
		          ),
		        ]),
		        h("div", { className: "dsc-modes", key: "m" }, [
		          h(
		            "button",
		            {
		              type: "button",
		              className: "dsc-mode",
		              key: "t",
		              "data-active": mode === "turn" ? "true" : "false",
		              "aria-pressed": mode === "turn" ? "true" : "false",
		              onClick: () => onMode("turn"),
		            },
		            t("modeTurn"),
		          ),
		          h(
		            "button",
		            {
		              type: "button",
		              className: "dsc-mode",
		              key: "o",
		              "data-active": mode === "overall" ? "true" : "false",
		              "aria-pressed": mode === "overall" ? "true" : "false",
		              onClick: () => onMode("overall"),
		            },
		            t("modeOverall"),
		          ),
		        ]),
		        listBody,
		      ],
		    );
		  }

		  /**
		   * One file in the list: its name alone, the counts, and the selected state.
		   * @param props - `{ file, name, index, selected, missing, t, onSelect }`.
		   */
		  function FileRow({ file, name, index, selected, missing, t, onSelect }) {
		    return h(
		      "button",
		      {
		        type: "button",
		        className: "dsc-row",
		        title: missing === true ? file.path + " · deleted" : file.path,
		        "data-nested": "true",
		        "data-selected": selected === true ? "true" : "false",
		        "data-missing": missing === true ? "true" : "false",
		        "aria-current": selected === true ? "true" : undefined,
		        "aria-label": t("open", { name: file.display }),
		        onClick: () => onSelect(index),
		      },
		      [
		        h(
		          "span",
		          { className: "dsc-path", key: "p" },
		          name === undefined || name === "" ? file.display : name,
		        ),
		        h(Counts, {
		          key: "c",
		          added: file.added,
		          deleted: file.deleted,
		          binary: file.binary,
		          oversized: file.oversized,
		          t,
		        }),
		      ],
		    );
		  }

		  /**
		   * Build the left list: one folder header, then that folder's files.
		   *
		   * @param input - `{ view, gonePaths, selected, mode, t, onSelect }`, where
		   *   `onSelect(selection, entryIndex)` adopts one row.
		   * @returns the elements in order.
		   */
		  function buildListRows({ view, gonePaths, selected, mode, t, onSelect }) {
		    const rows = [];
		    for (const group of view.groups) {
		      for (const folder of group.folders) {
		        const label = folder.folder === "" ? "./" : folder.folder + "/";
		        rows.push(
		          h(
		            "div",
		            {
		              className: "dsc-folder",
		              key: "f" + String(group.turn) + ":" + folder.folder,
		              title: label,
		            },
		            label,
		          ),
		        );
		        for (const row of folder.files) {
		          rows.push(
		            h(FileRow, {
		              key:
		                String(row.entries[0].seq) + ":" + String(row.entries[0].index) + ":" + row.file.path,
		              file: row.file,
		              name: row.name,
		              index: row.entries[0].index,
		              t,
		              missing: gonePaths[row.file.path] === true,
		              selected: rowMatchesSelection(row, selected, mode),
		              onSelect: () => onSelect(selectionOf(row), row.entries.length - 1),
		            }),
		          );
		        }
		      }
		    }
		    return rows;
		  }

		  /**
		   * The query string of one route read.
		   * @param params - the route's parameters.
		   * @returns `?a=b&c=d`.
		   */
		  function query(params) {
		    return "?" + new URLSearchParams(params).toString();
		  }

		  /**
		   * Read one JSON route. A non-2xx answer is a failure the caller has to decide on.
		   * @param route - the authenticated route to read.
		   * @param params - its parameters.
		   * @param signal - cancellation.
		   * @returns the parsed payload.
		   */
		  async function getJson(route, params, signal) {
		    const response = await fetch(route + query(params), {
		      signal,
		      headers: { accept: "application/json" },
		      credentials: "same-origin",
		    });
		    if (!response.ok) throw new Error(String(response.status));
		    return response.json();
		  }

		  /**
		   * Read this Session's recorded turns, newest first.
		   * @param sessionId - the viewed Session.
		   * @param signal - cancellation.
		   * @returns the turn rows, or none for a malformed payload.
		   */
		  async function readTurns(sessionId, signal) {
		    const payload = await getJson(LIST_ROUTE, { sessionId }, signal);
		    return payload !== null && typeof payload === "object" && Array.isArray(payload.turns)
		      ? payload.turns
		      : [];
		  }

		  /**
		   * Read one review entry's served comparison.
		   * @param sessionId - the viewed Session.
		   * @param entry - the file's coordinates for one turn.
		   * @param signal - cancellation.
		   * @returns the served payload (`kind: text | binary | oversized`).
		   */
		  async function readDiff(sessionId, entry, signal) {
		    return getJson(
		      DIFF_ROUTE,
		      { sessionId: String(sessionId), seq: String(entry.seq), index: String(entry.index) },
		      signal,
		    );
		  }

		  /**
		   * Read the Session's first pre-image of one file.
		   * @param sessionId - the viewed Session.
		   * @param seq - the announcing event, whose summary carries the working directory.
		   * @param path - the file's path as the summary spells it.
		   * @param signal - cancellation.
		   * @returns `{ text }`, or `{ absent: true }` when the file did not exist yet.
		   */
		  async function readBase(sessionId, seq, path, signal) {
		    const payload = await getJson(
		      BASE_ROUTE,
		      { sessionId: String(sessionId), seq: String(seq), path: String(path) },
		      signal,
		    );
		    if (payload === null || typeof payload !== "object") throw new Error("malformed");
		    if (payload.absent === true) return { absent: true };
		    if (typeof payload.text !== "string") throw new Error("malformed");
		    return { text: payload.text };
		  }

		  /**
		   * Read one changed file's current text from this package's own Host route.
		   *
		   * @param sessionId - the viewed Session.
		   * @param seq - the announcing event, whose summary carries the working directory.
		   * @param path - the file's path as the summary spells it.
		   * @param signal - cancellation.
		   * @returns the file's text, or throws a refusal flagged `missing` / `oversized`.
		   */
		  async function readWholeFile(sessionId, seq, path, signal) {
		    const response = await fetch(
		      FILE_ROUTE + query({ sessionId: String(sessionId), seq: String(seq), path: String(path) }),
		      { signal, headers: { accept: "application/json" }, credentials: "same-origin" },
		    );
		    if (!response.ok) {
		      let reason = String(response.status);
		      try {
		        const refused = await response.json();
		        if (refused !== null && typeof refused === "object" && typeof refused.error === "string")
		          reason = refused.error;
		      } catch (_error) {
		        // A body that is not JSON leaves the status as the reason.
		      }
		      const refusal = new Error(reason);
		      // A path that vanished (or stopped being a file) is a deletion, not a failure.
		      refusal.missing =
		        reason === "read-ENOENT" || reason === "read-ENOTDIR" || reason === "not-file";
		      refusal.oversized = reason === "too-large";
		      throw refusal;
		    }
		    const payload = await response.json();
		    if (payload === null || typeof payload !== "object" || typeof payload.text !== "string")
		      throw new Error("malformed");
		    return payload.text;
		  }

		  /**
		   * Ask the Host which of the listed paths still exist on disk.
		   * @param sessionId - the viewed Session.
		   * @param seq - the newest announcing event.
		   * @param signal - cancellation.
		   * @returns `{ [path]: "file" | "other" | "missing" | "unknown" }`.
		   */
		  async function readExists(sessionId, seq, signal) {
		    const payload = await getJson(
		      EXISTS_ROUTE,
		      { sessionId: String(sessionId), seq: String(seq) },
		      signal,
		    );
		    return payload !== null &&
		      typeof payload === "object" &&
		      payload.paths !== null &&
		      typeof payload.paths === "object"
		      ? payload.paths
		      : {};
		  }

		  /**
		   * Ask the Host desktop to open one file in its default application.
		   * @param sessionId - the viewed Session.
		   * @param entry - the file's coordinates for one turn.
		   */
		  async function requestOpen(sessionId, entry) {
		    const response = await fetch(
		      OPEN_ROUTE +
		        query({
		          sessionId: String(sessionId),
		          seq: String(entry.seq),
		          index: String(entry.index),
		          action: "open",
		        }),
		      { method: "POST", credentials: "same-origin" },
		    );
		    if (!response.ok) throw new Error(String(response.status));
		  }

		  /**
		   * The Session's first pre-image of the selected file: the stored baseline that
		   * replaces the old reverse reconstruction in Overall.
		   *
		   * @param input - `{ sessionId, mode, selected, nonce }`.
		   * @returns `{ phase: "ready", text }` / `{ phase: "ready", absent: true }` /
		   *   `{ phase: "loading" }` / `{ phase: "error" }`, or undefined before the read.
		   */
		  function useBase({ sessionId, mode, selected, nonce }) {
		    const [state, setState] = react.useState(undefined);
		    react.useEffect(() => {
		      if (mode !== "overall" || selected === null) return undefined;
		      if (typeof sessionId !== "string" || sessionId === "") return undefined;
		      const entry = selected.entries[0];
		      if (entry === undefined) return undefined;
		      let live = true;
		      const controller = new AbortController();
		      setState({ phase: "loading" });
		      readBase(sessionId, entry.seq, selected.path, controller.signal)
		        .then((value) => {
		          if (live) setState({ phase: "ready", ...value });
		        })
		        .catch(() => {
		          if (live && !controller.signal.aborted) setState({ phase: "error" });
		        });
		      return () => {
		        live = false;
		        controller.abort();
		      };
		    }, [mode, selected, sessionId, nonce]);
		    return state;
		  }

		  /**
		   * The Session's changed-file feed: the turn list, the per-entry comparisons, the
		   * in-memory cache that survives a re-selection, and the refresh counter that
		   * reloads all of it.
		   *
		   * The turn read always clears the cache, so Refresh cannot serve a payload the Host
		   * has since replaced.
		   *
		   * @param input - `{ sessionId, visible, selected }`.
		   * @returns `{ state, diffs, nonce, refresh, retryEntry }`.
		   */
		  function useChangesFeed({ sessionId, visible, selected }) {
		    const cache = react.useRef(new Map());
		    const [state, setState] = react.useState({ phase: "loading", turns: [] });
		    const [nonce, setNonce] = react.useState(0);
		    const [diffs, setDiffs] = react.useState({});

		    react.useEffect(() => {
		      if (visible === false) return undefined;
		      if (typeof sessionId !== "string" || sessionId === "") {
		        setState({ phase: "ready", turns: [] });
		        return undefined;
		      }
		      let live = true;
		      const controller = new AbortController();
		      setState((previous) => ({
		        phase: previous.turns.length === 0 ? "loading" : "refreshing",
		        turns: previous.turns,
		      }));
		      cache.current.clear();
		      setDiffs({});
		      readTurns(sessionId, controller.signal)
		        .then((turns) => {
		          if (live) setState({ phase: "ready", turns });
		        })
		        .catch(() => {
		          if (!live || controller.signal.aborted) return;
		          setState({ phase: "error", turns: [] });
		        });
		      return () => {
		        live = false;
		        controller.abort();
		      };
		    }, [sessionId, nonce, visible]);

		    react.useEffect(() => {
		      if (selected === null || typeof sessionId !== "string" || sessionId === "") return undefined;
		      let live = true;
		      const controllers = [];
		      for (const entry of selected.entries) {
		        const key = entryKey(entry);
		        if (cache.current.has(key)) {
		          const cached = cache.current.get(key);
		          setDiffs((previous) =>
		            previous[key] !== undefined
		              ? previous
		              : { ...previous, [key]: { phase: "ready", data: cached } },
		          );
		          continue;
		        }
		        const controller = new AbortController();
		        controllers.push(controller);
		        readDiff(sessionId, entry, controller.signal)
		          .then((payload) => {
		            if (!live) return;
		            cache.current.set(key, payload);
		            setDiffs((previous) => ({ ...previous, [key]: { phase: "ready", data: payload } }));
		          })
		          .catch(() => {
		            if (!live || controller.signal.aborted) return;
		            setDiffs((previous) => ({ ...previous, [key]: { phase: "error" } }));
		          });
		      }
		      return () => {
		        live = false;
		        for (const controller of controllers) controller.abort();
		      };
		    }, [selected, sessionId, nonce]);

		    /** Reload the turn list (and, with it, every comparison). */
		    const refresh = () => setNonce((value) => value + 1);

		    /**
		     * Forget one cached comparison and reload, so the pane can ask again.
		     * @param key - the entry key from {@link entryKey}.
		     */
		    const retryEntry = (key) => {
		      cache.current.delete(key);
		      setDiffs((previous) => {
		        const next = { ...previous };
		        delete next[key];
		        return next;
		      });
		      setNonce((value) => value + 1);
		    };

		    return { state, diffs, nonce, refresh, retryEntry };
		  }

		  /**
		   * Build one hunk from an operation range, numbering both sides from the range start.
		   * @param ops - the whole operation list.
		   * @param start - first operation of the hunk.
		   * @param end - last operation of the hunk, inclusive.
		   * @returns the served hunk shape.
		   */
		  function sliceHunk(ops, start, end) {
		    let oldNo = 1;
		    let newNo = 1;
		    for (let at = 0; at < start; at += 1) {
		      if (ops[at].op !== "+") oldNo += 1;
		      if (ops[at].op !== "-") newNo += 1;
		    }
		    const lines = [];
		    let oldLines = 0;
		    let newLines = 0;
		    for (let at = start; at <= end; at += 1) {
		      lines.push(ops[at].op + ops[at].text);
		      if (ops[at].op !== "+") oldLines += 1;
		      if (ops[at].op !== "-") newLines += 1;
		    }
		    return { oldStart: oldNo, oldLines, newStart: newNo, newLines, lines };
		  }

		  /**
		   * Group operations into hunks with a little context around each change.
		   * @param ops - the whole operation list.
		   * @param context - context lines to keep on either side of a change.
		   * @returns the hunks, in file order; empty when nothing changed.
		   */
		  function toHunks(ops, context) {
		    const changed = [];
		    for (let at = 0; at < ops.length; at += 1) if (ops[at].op !== " ") changed.push(at);
		    if (changed.length === 0) return [];
		    const hunks = [];
		    let start = Math.max(0, changed[0] - context);
		    let end = Math.min(ops.length - 1, changed[0] + context);
		    for (let at = 1; at < changed.length; at += 1) {
		      const index = changed[at];
		      if (index - context <= end + 1) {
		        end = Math.min(ops.length - 1, index + context);
		        continue;
		      }
		      hunks.push(sliceHunk(ops, start, end));
		      start = Math.max(0, index - context);
		      end = Math.min(ops.length - 1, index + context);
		    }
		    hunks.push(sliceHunk(ops, start, end));
		    return hunks;
		  }

		  /**
		   * Undo one turn's comparison on a file's text: each hunk's new-side range is
		   * replaced with its old-side lines, so the caller walks back to the state before
		   * the turn.
		   *
		   * @param text - the file as it stood after the turn.
		   * @param hunks - the turn's hunks for that file.
		   * @returns the text before the turn, or null when the hunk no longer lines up.
		   */
		  function reverseHunks(text, hunks) {
		    let lines = text === "" ? [] : text.split("\n");
		    let delta = 0;
		    for (const hunk of Array.isArray(hunks) ? hunks : []) {
		      const next = [];
		      const prev = [];
		      for (const line of Array.isArray(hunk.lines) ? hunk.lines : []) {
		        if (line[0] === "-") prev.push(line.slice(1));
		        else {
		          next.push(line.slice(1));
		          if (line[0] === " ") prev.push(line.slice(1));
		        }
		      }
		      const start = hunk.newStart - 1 + delta;
		      const end = start + next.length;
		      if (start < 0 || end > lines.length) return null;
		      for (let at = 0; at < next.length; at += 1) if (lines[start + at] !== next[at]) return null;
		      lines = [...lines.slice(0, start), ...prev, ...lines.slice(end)];
		      delta += prev.length - next.length;
		    }
		    return lines.join("\n");
		  }

		  /**
		   * Cell budget for the exact line diff: the LCS table is (n+1)x(m+1) Uint32 cells.
		   * 8M cells ≈ 32 MB of transient memory and well under a frame for realistic files;
		   * past it {@link diffLines} reports a coarse whole-block replacement instead.
		   */
		  const DIFF_CELL_CAP = 8000000;

		  /**
		   * Line-level diff of two texts: the common prefix and suffix are kept as context
		   * and only the middle is matched, so a large file with small edits stays cheap.
		   * When the middle is too big for an exact match the middle is reported as one
		   * wholesale replacement and `coarse` is set: still a readable two-sided diff,
		   * never a dead end.
		   *
		   * @param before - the old side, one line per entry.
		   * @param after - the new side, one line per entry.
		   * @returns `{ ops, coarse }`: the ordered operations and whether they approximate.
		   */
		  function diffLines(before, after) {
		    let pre = 0;
		    while (pre < before.length && pre < after.length && before[pre] === after[pre]) pre += 1;
		    let suf = 0;
		    while (
		      suf < before.length - pre &&
		      suf < after.length - pre &&
		      before[before.length - 1 - suf] === after[after.length - 1 - suf]
		    )
		      suf += 1;
		    const head = before.slice(0, pre);
		    const tail = before.slice(before.length - suf);
		    const middleBefore = before.slice(pre, before.length - suf);
		    const middleAfter = after.slice(pre, after.length - suf);
		    const n = middleBefore.length;
		    const m = middleAfter.length;
		    const ops = [];
		    for (const line of head) ops.push({ op: " ", text: line });
		    if ((n + 1) * (m + 1) > DIFF_CELL_CAP) {
		      for (const line of middleBefore) ops.push({ op: "-", text: line });
		      for (const line of middleAfter) ops.push({ op: "+", text: line });
		      for (const line of tail) ops.push({ op: " ", text: line });
		      return { ops, coarse: true };
		    }
		    const width = m + 1;
		    const table = new Uint32Array((n + 1) * (m + 1));
		    for (let i = n - 1; i >= 0; i -= 1)
		      for (let j = m - 1; j >= 0; j -= 1) {
		        table[i * width + j] =
		          middleBefore[i] === middleAfter[j]
		            ? table[(i + 1) * width + j + 1] + 1
		            : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
		      }
		    let i = 0;
		    let j = 0;
		    while (i < n && j < m) {
		      if (middleBefore[i] === middleAfter[j]) {
		        ops.push({ op: " ", text: middleBefore[i] });
		        i += 1;
		        j += 1;
		      } else if (table[(i + 1) * width + j] >= table[i * width + j + 1]) {
		        ops.push({ op: "-", text: middleBefore[i] });
		        i += 1;
		      } else {
		        ops.push({ op: "+", text: middleAfter[j] });
		        j += 1;
		      }
		    }
		    while (i < n) {
		      ops.push({ op: "-", text: middleBefore[i] });
		      i += 1;
		    }
		    while (j < m) {
		      ops.push({ op: "+", text: middleAfter[j] });
		      j += 1;
		    }
		    for (const line of tail) ops.push({ op: " ", text: line });
		    return { ops, coarse: false };
		  }

		  /**
		   * One whole-file range for the `Full` scope; an empty diff has no range at all.
		   * @param ops - the operation list.
		   * @returns zero or one hunk.
		   */
		  function wholeRange(ops) {
		    return ops.length === 0 ? [] : [sliceHunk(ops, 0, ops.length - 1)];
		  }

		  /**
		   * Diff two texts into the `ready` comparison shape both panes consume.
		   * @param before - the old side text.
		   * @param after - the new side text.
		   * @returns `{ status, hunks, full, coarse }`.
		   */
		  function compare(before, after) {
		    const diff = diffLines(
		      before === "" ? [] : before.split("\n"),
		      after === "" ? [] : after.split("\n"),
		    );
		    return {
		      status: "ready",
		      coarse: diff.coarse,
		      hunks: toHunks(diff.ops, DIFF_CONTEXT),
		      full: wholeRange(diff.ops),
		    };
		  }

		  /**
		   * Work out what the comparison shows for the selected file.
		   *
		   * Overall prefers the Session's stored pre-image: an exact baseline, never
		   * reconstructed. By turn walks the file back through the turns newer than the one
		   * being viewed, which is the only option because just the first pre-image is kept.
		   *
		   * @param input - the current view state.
		   * @returns the comparison, `null` while nothing is selected, or a status:
		   *   `pending` (still reading), `unreadable`, `oversized`, `binary`, `drift`.
		   */
		  function buildComparison({ mode, selected, diffs, wholeState, baseState, view }) {
		    if (selected === null) return null;
		    if (wholeState !== undefined && wholeState.phase === "error") return { status: "unreadable" };
		    if (wholeState !== undefined && wholeState.phase === "oversized") return { status: "oversized" };
		    if (wholeState === undefined || wholeState.phase === "loading") return { status: "pending" };
		    // The path is gone from the disk: compare against "nothing" so the whole
		    // pre-image reads as deleted, instead of claiming the file is unreadable.
		    const gone = wholeState.phase === "missing";
		    const current = gone ? "" : wholeState.text;
		    if (mode === "overall" && baseState !== undefined && baseState.phase === "ready") {
		      const beforeText = baseState.absent === true ? "" : baseState.text;
		      return { ...compare(beforeText, current), gone };
		    }
		    if (gone) return { status: "ready", gone: true, hunks: [], full: [] };
		    let text = current;
		    const ordered = [...selected.entries].sort((a, b) => b.turn - a.turn);
		    const target = mode === "overall" || view.groups.length === 0 ? undefined : view.groups[0].turn;
		    let after;
		    for (const item of ordered) {
		      if (target !== undefined && item.turn === target) after = text;
		      const state = diffs[entryKey(item)];
		      if (state === undefined || state.phase !== "ready") return { status: "pending" };
		      const payload = state.data;
		      if (payload === undefined || payload.kind !== "text") return { status: "binary" };
		      if (payload.before !== true) {
		        text = "";
		        continue;
		      }
		      const back = reverseHunks(text, payload.hunks);
		      if (back === null) return { status: "drift" };
		      text = back;
		    }
		    const afterText = mode === "overall" ? current : after === undefined ? current : after;
		    return { ...compare(text, afterText), gone: false };
		  }

		  /**
		   * The comparison for the selected file, recomputed only when one of its sources
		   * changes.
		   *
		   * @param input - `{ mode, selected, diffs, wholeState, baseState, view }`.
		   * @returns the comparison, or null while nothing is selected.
		   */
		  function useComparison({ mode, selected, diffs, wholeState, baseState, view }) {
		    return react.useMemo(
		      () => buildComparison({ mode, selected, diffs, wholeState, baseState, view }),
		      [mode, selected, diffs, wholeState, baseState, view],
		    );
		  }

		  /**
		   * Which of the listed files still exist on disk.
		   *
		   * The recorded turns only know about edits made by the file tools, so a file
		   * removed by anything else (a shell command, an editor, a `git checkout`) has to be
		   * checked against the filesystem.
		   *
		   * @param input - `{ sessionId, newestSeq, nonce, wholeNonce }`.
		   * @returns a set-shaped map of the paths that are gone.
		   */
		  function useExists({ sessionId, newestSeq, nonce, wholeNonce }) {
		    const [gonePaths, setGonePaths] = react.useState({});
		    react.useEffect(() => {
		      if (newestSeq <= 0 || typeof sessionId !== "string" || sessionId === "") return undefined;
		      let live = true;
		      const controller = new AbortController();
		      readExists(sessionId, newestSeq, controller.signal)
		        .then((paths) => {
		          if (!live) return;
		          const missing = {};
		          for (const path of Object.keys(paths)) if (paths[path] === "missing") missing[path] = true;
		          setGonePaths(missing);
		        })
		        .catch(() => {
		          if (live) setGonePaths({});
		        });
		      return () => {
		        live = false;
		        controller.abort();
		      };
		    }, [sessionId, newestSeq, nonce, wholeNonce]);
		    return gonePaths;
		  }

		  /**
		   * Read one persisted preference.
		   * @param key - the storage key.
		   * @param fallback - the value when nothing (or nothing usable) is stored.
		   * @returns the stored string, or the fallback.
		   */
		  function readStored(key, fallback) {
		    try {
		      const value = window.localStorage.getItem(key);
		      return value === null ? fallback : value;
		    } catch (_error) {
		      return fallback;
		    }
		  }

		  /**
		   * Persist one preference, ignoring a storage refusal (private mode, quota).
		   * @param key - the storage key.
		   * @param value - the value to store.
		   */
		  function writeStored(key, value) {
		    try {
		      window.localStorage.setItem(key, value);
		    } catch (_error) {
		      // A refused write only costs the preference, never the render.
		    }
		  }

		  /** The persisted list mode: `turn` unless `overall` was chosen last time. */
		  function readMode() {
		    return readStored(MODE_KEY, "turn") === "overall" ? "overall" : "turn";
		  }

		  /** The persisted wrap preference. */
		  function readWrap() {
		    return readStored(WRAP_KEY, "false") === "true";
		  }

		  /** The persisted whole-file preference. */
		  function readWhole() {
		    return readStored(WHOLE_KEY, "false") === "true";
		  }

		  /** The persisted comparison layout: `split` unless `inline` was chosen last time. */
		  function readLayout() {
		    return readStored(LAYOUT_KEY, "split") === "inline" ? "inline" : "split";
		  }

		  /**
		   * The persisted left pane width, clamped to something usable.
		   * @returns the width in pixels.
		   */
		  function readLeft() {
		    const stored = Number(readStored(WIDTH_KEY, ""));
		    return Number.isFinite(stored) && stored >= MIN_LEFT ? stored : DEFAULT_LEFT;
		  }

		  /**
		   * The draggable divider between the list and the comparison: width state, pointer
		   * drag, keyboard nudge, and the resize observer that keeps both panes usable.
		   *
		   * @returns `{ rootRef, left, dragging, startDrag, nudge }`: attach the ref to the
		   *   tab root, spread the handlers onto the divider.
		   */
		  function useResizable() {
		    const rootRef = react.useRef(null);
		    const [left, setLeft] = react.useState(readLeft);
		    const [dragging, setDragging] = react.useState(false);

		    /** Keep the list wide enough to read and the comparison wide enough to use. */
		    const clamp = (value) => {
		      const box = rootRef.current;
		      const width = box === null ? Number.POSITIVE_INFINITY : box.getBoundingClientRect().width;
		      return Math.max(MIN_LEFT, Math.min(value, Math.max(MIN_LEFT, width - MIN_RIGHT)));
		    };

		    react.useEffect(() => {
		      const box = rootRef.current;
		      if (box === null || typeof ResizeObserver === "undefined") return undefined;
		      const observer = new ResizeObserver(() => {
		        const width = box.getBoundingClientRect().width;
		        setLeft((value) => Math.min(value, Math.max(MIN_LEFT, width - MIN_RIGHT)));
		      });
		      observer.observe(box);
		      return () => observer.disconnect();
		    }, []);

		    const startDrag = (event) => {
		      if (event.button !== undefined && event.button !== 0) return;
		      const startX = event.clientX;
		      const startWidth = left;
		      setDragging(true);
		      event.preventDefault();
		      const move = (next) => setLeft(clamp(startWidth + (next.clientX - startX)));
		      const stop = () => {
		        window.removeEventListener("pointermove", move);
		        window.removeEventListener("pointerup", stop);
		        window.removeEventListener("pointercancel", stop);
		        setDragging(false);
		        setLeft((value) => {
		          writeStored(WIDTH_KEY, String(value));
		          return value;
		        });
		      };
		      window.addEventListener("pointermove", move);
		      window.addEventListener("pointerup", stop);
		      window.addEventListener("pointercancel", stop);
		    };

		    const nudge = (event) => {
		      const step = event.shiftKey ? 48 : 16;
		      if (event.key === "ArrowLeft")
		        setLeft((value) => {
		          const next = clamp(value - step);
		          writeStored(WIDTH_KEY, String(next));
		          return next;
		        });
		      else if (event.key === "ArrowRight")
		        setLeft((value) => {
		          const next = clamp(value + step);
		          writeStored(WIDTH_KEY, String(next));
		          return next;
		        });
		      else return;
		      event.preventDefault();
		    };

		    return { rootRef, left, dragging, startDrag, nudge };
		  }

		  /**
		   * Keep the selection pointing at a listed row: adopt the same path when the list
		   * still has it, otherwise the first listed file, otherwise nothing.
		   *
		   * @param input - `{ view, mode, selected, setSelected, setEntryIndex }`.
		   */
		  function useSelection({ view, mode, selected, setSelected, setEntryIndex }) {
		    react.useEffect(() => {
		      if (view.files === 0) {
		        if (selected !== null) setSelected(null);
		        return;
		      }
		      // Adopt the listed row, which also re-derives the entry when the mode changed.
		      const adopt = (row) => {
		        const next = selectionOf(row);
		        if (!sameSelection(selected, next)) {
		          setSelected(next);
		          setEntryIndex(next.entries.length - 1);
		        }
		      };
		      for (const group of view.groups)
		        for (const folder of group.folders)
		          for (const row of folder.files) {
		            if (selected !== null && selected.path === row.file.path) {
		              adopt(row);
		              return;
		            }
		          }
		      for (const group of view.groups)
		        for (const folder of group.folders) {
		          if (folder.files.length === 0) continue;
		          adopt(folder.files[0]);
		          return;
		        }
		      setSelected(null);
		    }, [view, mode]);
		  }

		  /**
		   * Group one turn's files by their folder.
		   * @param files - the summary's file rows.
		   * @param entryOf - builds one file's review coordinates.
		   * @returns folder groups in first-seen order.
		   */
		  function groupFiles(files, entryOf) {
		    const folders = [];
		    const byFolder = new Map();
		    for (let index = 0; index < files.length; index += 1) {
		      const file = files[index];
		      const segments = String(file.display).split(/[\\/]/);
		      const name = segments.pop() ?? String(file.display);
		      const folder = segments.join("/");
		      let bucket = byFolder.get(folder);
		      if (bucket === undefined) {
		        bucket = [];
		        byFolder.set(folder, bucket);
		        folders.push(folder);
		      }
		      bucket.push({ file, name, entries: [entryOf(index)] });
		    }
		    return folders.map((folder) => ({ folder, files: byFolder.get(folder) }));
		  }

		  /**
		   * Fold every turn into one file list: one row per path, counts summed, and every
		   * turn that touched the file kept for the stacked comparison.
		   *
		   * @param turns - the Session's recorded turns, newest first.
		   * @returns the folder groups and the number of distinct files.
		   */
		  function groupOverall(turns) {
		    const byPath = new Map();
		    for (const turn of turns) {
		      const files = Array.isArray(turn.files) ? turn.files : [];
		      for (let index = 0; index < files.length; index += 1) {
		        const file = files[index];
		        let record = byPath.get(file.path);
		        if (record === undefined) {
		          const segments = String(file.display).split(/[\\/]/);
		          const name = segments.pop() ?? String(file.display);
		          record = {
		            file,
		            name,
		            folder: segments.join("/"),
		            added: 0,
		            deleted: 0,
		            entries: [],
		          };
		          byPath.set(file.path, record);
		        }
		        record.added += file.added;
		        record.deleted += file.deleted;
		        record.entries.push({ seq: turn.seq, turn: turn.turn, index });
		      }
		    }
		    const folders = [];
		    const byFolder = new Map();
		    for (const record of byPath.values()) {
		      let bucket = byFolder.get(record.folder);
		      if (bucket === undefined) {
		        bucket = [];
		        byFolder.set(record.folder, bucket);
		        folders.push(record.folder);
		      }
		      bucket.push({
		        file: {
		          path: record.file.path,
		          display: record.file.display,
		          added: record.added,
		          deleted: record.deleted,
		          binary: record.file.binary,
		          oversized: record.file.oversized,
		        },
		        name: record.name,
		        entries: record.entries,
		      });
		    }
		    return {
		      folders: folders.map((folder) => ({ folder, files: byFolder.get(folder) })),
		      count: byPath.size,
		    };
		  }

		  /**
		   * The left list for the current mode, plus the Session totals the header shows.
		   *
		   * Turns arrive newest first from the Host; the strip reads them oldest first, like
		   * a timeline, so this is the one place the order is flipped.
		   *
		   * @param turns - recorded turns, newest first.
		   * @param mode - `turn` or `overall`.
		   * @param turnFilter - the turn the By-turn list should show; 0 means the newest.
		   * @returns `{ groups, turns, added, deleted, files }`.
		   */
		  function buildView(turns, mode, turnFilter) {
		    const ordered = [...turns].reverse();
		    if (ordered.length === 0) return { groups: [], turns: [], added: 0, deleted: 0, files: 0 };
		    if (mode === "overall") {
		      let added = 0;
		      let deleted = 0;
		      for (const turn of ordered) {
		        added += turn.added;
		        deleted += turn.deleted;
		      }
		      const folded = groupOverall(ordered);
		      return {
		        groups: [{ turn: undefined, total: folded.count, folders: folded.folders }],
		        turns: ordered.map((turn) => ({ turn: turn.turn, total: turn.total })),
		        added,
		        deleted,
		        files: folded.count,
		      };
		    }
		    // By turn: the list follows the chosen turn, defaulting to the newest one.
		    const active = ordered.find((turn) => turn.turn === turnFilter) ?? ordered[ordered.length - 1];
		    return {
		      groups: [
		        {
		          turn: active.turn,
		          total: active.total,
		          folders: groupFiles(Array.isArray(active.files) ? active.files : [], (index) => ({
		            seq: active.seq,
		            turn: active.turn,
		            index,
		          })),
		        },
		      ],
		      turns: ordered.map((turn) => ({ turn: turn.turn, total: turn.total })),
		      added: active.added,
		      deleted: active.deleted,
		      files: active.total,
		    };
		  }

		  /**
		   * The left list, recomputed only when the turns or one of the two switches change.
		   * @param input - `{ turns, mode, turnFilter }`.
		   * @returns the built view.
		   */
		  function useView({ turns, mode, turnFilter }) {
		    return react.useMemo(() => buildView(turns, mode, turnFilter), [turns, mode, turnFilter]);
		  }

		  /**
		   * The selected file's current text, read whenever the comparison needs the whole
		   * file: in By-turn `Full` mode, and always in Overall.
		   *
		   * A path that is gone from the disk becomes `phase: "missing"`, which the
		   * comparison reads as "deleted" rather than "unreadable".
		   *
		   * @param input - `{ sessionId, whole, mode, selected, entryIndex, nonce }`.
		   * @returns the whole-file state, or undefined before anything was read.
		   */
		  function useWholeFile({ sessionId, whole, mode, selected, entryIndex, nonce }) {
		    const [state, setState] = react.useState(undefined);
		    react.useEffect(() => {
		      if ((whole !== true && mode !== "overall") || selected === null) return undefined;
		      if (typeof sessionId !== "string" || sessionId === "") return undefined;
		      const entry = activeEntryOf(selected, entryIndex);
		      if (entry === undefined) return undefined;
		      let live = true;
		      const controller = new AbortController();
		      setState({ phase: "loading" });
		      readWholeFile(sessionId, entry.seq, selected.path, controller.signal)
		        .then((text) => {
		          if (live) setState({ phase: "ready", text });
		        })
		        .catch((error) => {
		          if (!live || controller.signal.aborted) return;
		          // The file is gone from the disk: that is a deleted comparison, not a read failure.
		          if (error !== null && error !== undefined && error.missing === true)
		            setState({ phase: "missing" });
		          else if (error !== null && error !== undefined && error.oversized === true)
		            setState({ phase: "oversized" });
		          else setState({ phase: "error", detail: error instanceof Error ? error.message : "" });
		        });
		      return () => {
		        live = false;
		        controller.abort();
		      };
		    }, [whole, selected, nonce, entryIndex, mode, sessionId]);
		    return state;
		  }

		  /** English copy. Keys are shared with {@link ./zh.js}. */
		  const en = {
		    title: "Session changes",
		    guideTitle: "Changes",
		    guideDescription: "Every file this Session changed, by turn",
		    empty: "No file changes recorded in this Session yet.",
		    loading: "Reading changes…",
		    error: "Could not read this Session's changes.",
		    retry: "Retry",
		    refresh: "Refresh",
		    turn: "Turn {turn}",
		    files: "{count} files",
		    oneFile: "1 file",
		    binary: "binary",
		    oversized: "too large",
		    open: "Open the diff for {name}",
		    pick: "Choose a file to compare.",
		    diffLoading: "Reading the comparison…",
		    diffError: "Could not read this comparison.",
		    diffBinary: "Binary file; changes cannot be shown.",
		    diffOversized: "File too large; changes cannot be shown.",
		    created: "New file",
		    deleted: "Deleted",
		    gone: "deleted",
		    same: "Both sides hold the same lines",
		    coarse: "Change block too large to match line by line; shown as one block replacement",
		    truncated: "Stopped at {count} lines",
		    wrapOn: "Enable line wrap",
		    wrapOff: "Disable line wrap",
		    review: "Open in the Review tab",
		    openApp: "Open the current file in its default application",
		    openAppFailed: "Could not open the file. The Host desktop may be unavailable.",
		    modeTurn: "By turn",
		    modeOverall: "Overall",
		    sectionTurn: "Turn {turn}",
		    wholeShort: "Full",
		    layoutInline: "Switch to the inline layout",
		    layoutSplit: "Switch to the side-by-side layout",
		    layoutInlineShort: "Inline",
		    layoutSplitShort: "Split",
		    wholeOn: "Whole file with this turn's changes marked",
		    wholeOff: "Back to the changed hunks only",
		    wholeLoading: "Reading the file…",
		    wholeError: "Could not read the file from the Host.",
		    overallDrift:
		      "Could not rebuild the state this comparison starts from — the file changed outside the recorded turns.",
		    resize: "Resize the file list",
		  };

		  /**
		   * Fill `{name}` placeholders of one English entry: the fallback used when the tab is
		   * rendered without a bound dictionary (the registration smoke tests, mainly).
		   *
		   * @param key - a dictionary key.
		   * @param params - values for the placeholders.
		   * @returns the finished text.
		   */
		  function fallback(key, params) {
		    const text = en[key] ?? key;
		    return params === undefined
		      ? text
		      : text.replace(/\{(\w+)\}/g, (whole, name) => params[name] ?? whole);
		  }

		  /**
		   * Set by `apply`; the last-resort opener when a tab body has no bound tab actions.
		   * Kept in one module so the container and the entry can share it without importing
		   * each other.
		   */
		  let resourceOpener = null;

		  /**
		   * Install the Host's resource opener.
		   * @param opener - `ctx.sidebarRight.openResource`.
		   */
		  function setResourceOpener(opener) {
		    resourceOpener = opener;
		  }

		  /**
		   * Open one review resource, when the Host exposes an opener at all.
		   * @param address - the `dsh-resource://` address.
		   * @param options - the tab actions' options.
		   */
		  function openResource(address, options) {
		    if (typeof resourceOpener === "function") resourceOpener(address, options);
		  }

		  /**
		   * Master list on the left, the selected file's comparison on the right, one
		   * draggable divider. All state lives here; the panes are presentational, and every
		   * read has its own hook.
		   *
		   * @param props - `{ t, sessionId, tab }` from the sidebar tab system.
		   */
		  function ChangesTab(props) {
		    const t = typeof props.t === "function" ? props.t : fallback;
		    const sessionId = props.sessionId;
		    const visible = props.tab === undefined ? true : props.tab.visible !== false;

		    const [mode, setMode] = react.useState(readMode);
		    const [selected, setSelected] = react.useState(null);
		    const [entryIndex, setEntryIndex] = react.useState(0);
		    const [turnFilter, setTurnFilter] = react.useState(0);
		    const [wrap, setWrap] = react.useState(readWrap);
		    const [whole, setWhole] = react.useState(readWhole);
		    const [layout, setLayout] = react.useState(readLayout);
		    const [wholeNonce, setWholeNonce] = react.useState(0);
		    const [opening, setOpening] = react.useState(false);
		    const [openFailed, setOpenFailed] = react.useState(false);

		    const { rootRef, left, dragging, startDrag, nudge } = useResizable();
		    const feed = useChangesFeed({ sessionId, visible, selected });
		    const view = useView({ turns: feed.state.turns, mode, turnFilter });
		    useSelection({ view, mode, selected, setSelected, setEntryIndex });
		    const wholeState = useWholeFile({
		      sessionId,
		      whole,
		      mode,
		      selected,
		      entryIndex,
		      nonce: wholeNonce,
		    });
		    const baseState = useBase({ sessionId, mode, selected, nonce: wholeNonce });
		    const newestSeq = feed.state.turns.length === 0 ? 0 : feed.state.turns[0].seq;
		    const gonePaths = useExists({ sessionId, newestSeq, nonce: feed.nonce, wholeNonce });
		    const comparison = useComparison({
		      mode,
		      selected,
		      diffs: feed.diffs,
		      wholeState,
		      baseState,
		      view,
		    });

		    const activeEntry = activeEntryOf(selected, entryIndex);
		    /** The turn the list is showing; the chip highlight follows it. */
		    const displayedTurn = view.groups.length === 0 ? undefined : view.groups[0].turn;

		    const setModeAndStore = (next) => {
		      writeStored(MODE_KEY, next);
		      setMode(next);
		    };

		    const toggleWrap = () => {
		      setWrap((value) => {
		        writeStored(WRAP_KEY, value === true ? "false" : "true");
		        return value !== true;
		      });
		    };

		    const toggleWhole = () => {
		      setWhole((value) => {
		        writeStored(WHOLE_KEY, value === true ? "false" : "true");
		        return value !== true;
		      });
		    };

		    const toggleLayout = () => {
		      setLayout((value) => {
		        const next = value === "inline" ? "split" : "inline";
		        writeStored(LAYOUT_KEY, next);
		        return next;
		      });
		    };

		    /** Open the same comparison in the existing review tab. */
		    const openReview = () => {
		      if (activeEntry === undefined) return;
		      const address =
		        REVIEW_PREFIX +
		        encodeURIComponent(String(sessionId)) +
		        "/" +
		        String(activeEntry.seq) +
		        "/" +
		        String(activeEntry.turn);
		      const actions = props.tab === undefined ? undefined : props.tab.actions;
		      const options = { params: { index: activeEntry.index } };
		      if (actions !== undefined && typeof actions.openResource === "function")
		        actions.openResource(address, options);
		      else openResource(address, options);
		    };

		    /** Ask the Host desktop to open the current file in its default application. */
		    const openInApp = () => {
		      if (activeEntry === undefined || opening) return;
		      setOpening(true);
		      setOpenFailed(false);
		      requestOpen(sessionId, activeEntry)
		        .catch(() => setOpenFailed(true))
		        .finally(() => setOpening(false));
		    };

		    /** Forget the failed comparison and read it again. */
		    const retryPayload = () => {
		      if (activeEntry === undefined) return;
		      feed.retryEntry(entryKey(activeEntry));
		      setWholeNonce((value) => value + 1);
		    };

		    const rows = buildListRows({
		      view,
		      gonePaths,
		      selected,
		      mode,
		      t,
		      onSelect: (selection, index) => {
		        setSelected(selection);
		        setEntryIndex(index);
		      },
		    });

		    return h("div", { className: "dsc-root", "data-session-changes": true, ref: rootRef }, [
		      h(ListPane, {
		        t,
		        state: feed.state,
		        view,
		        rows,
		        mode,
		        busy: feed.state.phase === "loading",
		        left,
		        onMode: setModeAndStore,
		        onRefresh: feed.refresh,
		      }),
		      h("div", {
		        className: "dsc-divider",
		        key: "d",
		        role: "separator",
		        tabIndex: 0,
		        "aria-orientation": "vertical",
		        "aria-label": t("resize"),
		        "data-dragging": dragging === true ? "true" : "false",
		        onPointerDown: startDrag,
		        onKeyDown: nudge,
		      }),
		      h(DetailPane, {
		        t,
		        mode,
		        turns: view.turns,
		        activeTurn: displayedTurn,
		        onPickTurn: setTurnFilter,
		        selected,
		        activeEntry,
		        layout,
		        whole,
		        wrap,
		        opening,
		        openFailed,
		        comparison,
		        diffs: feed.diffs,
		        baseState,
		        wholeState,
		        onRetry: retryPayload,
		        onToggleLayout: toggleLayout,
		        onToggleWhole: toggleWhole,
		        onOpenFile: openInApp,
		        onToggleWrap: toggleWrap,
		        onOpenReview: openReview,
		      }),
		    ]);
		  }

		  /**
		   * Keep one broken render from blanking the whole pane: show the reason and a Retry
		   * button instead. Without a class component to extend, the bare tab is used.
		   */
		  const TabBoundary =
		    typeof react.Component !== "function"
		      ? null
		      : class TabBoundary extends react.Component {
		          constructor(props) {
		            super(props);
		            this.state = { failure: null };
		          }

		          static getDerivedStateFromError(failure) {
		            return { failure };
		          }

		          render() {
		            const failure = this.state.failure;
		            if (failure === null || failure === undefined) return this.props.children;
		            const message =
		              typeof failure === "object" && failure !== null && typeof failure.message === "string"
		                ? failure.message
		                : String(failure);
		            return h("div", { className: "dsc-note" }, [
		              h("span", { key: "m" }, "Changes failed to render: " + message),
		              h(
		                "button",
		                {
		                  type: "button",
		                  className: "dsc-btn",
		                  key: "b",
		                  onClick: () => this.setState({ failure: null }),
		                },
		                "Retry",
		              ),
		            ]);
		          }
		        };

		  /**
		   * The registered tab body: the tab, fenced so a render error stays inside the pane.
		   * @param props - whatever the tab system passes to a pane body.
		   */
		  function TabBody(props) {
		    return TabBoundary === null ? h(ChangesTab, props) : h(TabBoundary, null, h(ChangesTab, props));
		  }

		  /** Chinese copy. Keys are shared with {@link ./en.js}. */
		  const zh = {
		    title: "会话改动",
		    guideTitle: "改动",
		    guideDescription: "按轮次列出本次会话改过的每个文件",
		    empty: "本次会话还没有改动记录。",
		    loading: "正在读取改动…",
		    error: "读取本次会话的改动失败。",
		    retry: "重试",
		    refresh: "刷新",
		    turn: "第 {turn} 轮",
		    files: "{count} 个文件",
		    oneFile: "1 个文件",
		    binary: "二进制",
		    oversized: "过大",
		    open: "查看 {name} 的改动",
		    pick: "选择一个文件进行对比。",
		    diffLoading: "正在读取对比…",
		    diffError: "读取对比失败。",
		    diffBinary: "二进制文件，无法显示改动。",
		    diffOversized: "文件过大，无法显示改动。",
		    created: "新文件",
		    deleted: "已删除",
		    gone: "已删除",
		    same: "两侧内容相同",
		    coarse: "改动范围过大，逐行对比已降级为整块替换显示",
		    truncated: "只显示前 {count} 行",
		    wrapOn: "开启自动换行",
		    wrapOff: "关闭自动换行",
		    review: "在 Review 标签中打开",
		    openApp: "用默认应用打开当前文件",
		    openAppFailed: "无法打开文件，Host 桌面不可用。",
		    modeTurn: "按轮次",
		    modeOverall: "全部",
		    sectionTurn: "第 {turn} 轮",
		    wholeShort: "整",
		    layoutInline: "切换为单栏",
		    layoutSplit: "切换为左右对比",
		    layoutInlineShort: "单栏",
		    layoutSplitShort: "左右",
		    wholeOn: "显示整个文件并标出本轮改动",
		    wholeOff: "只看改动的片段",
		    wholeLoading: "正在读取文件…",
		    wholeError: "无法从 Host 读取该文件。",
		    overallDrift: "无法还原该对比的起点——这个文件在会话之外被改动过。",
		    resize: "调整文件列表宽度",
		  };

		  const css = ".dsc-root {\n  box-sizing: border-box;\n  width: 100%;\n  height: 100%;\n  min-height: 0;\n  display: flex;\n  overflow: hidden;\n  color: var(--dsw-alias-label-primary);\n  background: var(--dsw-alias-bg-layer-1);\n  font-size: 13px;\n}\n.dsc-pane {\n  box-sizing: border-box;\n  min-height: 0;\n  display: flex;\n  flex-direction: column;\n}\n.dsc-left {\n  flex: 0 0 auto;\n  min-width: 0;\n}\n.dsc-right {\n  flex: 1 1 auto;\n  min-width: 160px;\n  border-left: 0;\n}\n.dsc-head {\n  box-sizing: border-box;\n  flex: none;\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  height: 38px;\n  padding: 0 8px;\n  border-bottom: 0.5px solid var(--dsw-alias-border-l2);\n}\n.dsc-title {\n  flex: 1;\n  min-width: 0;\n  font-weight: 500;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n.dsc-stat {\n  flex: none;\n  display: flex;\n  gap: 6px;\n  font-family: var(--ds-font-family-code);\n  font-size: 11px;\n  color: var(--dsw-alias-label-tertiary);\n}\n.dsc-btn {\n  flex: none;\n  font: inherit;\n  color: var(--dsw-alias-label-secondary);\n  background: transparent;\n  border: 0;\n  border-radius: 6px;\n  padding: 4px 6px;\n  cursor: pointer;\n}\n.dsc-btn:hover:not(:disabled) {\n  background: var(--dsw-alias-interactive-bg-hover);\n}\n.dsc-btn:disabled {\n  cursor: progress;\n  opacity: 0.5;\n}\n.dsc-body {\n  flex: auto;\n  min-height: 0;\n  overflow: auto;\n  padding: 2px 0 14px;\n}\n.dsc-turn {\n  position: sticky;\n  top: 0;\n  z-index: 2;\n  display: flex;\n  justify-content: space-between;\n  gap: 8px;\n  padding: 5px 10px;\n  font-size: 11px;\n  font-weight: 500;\n  line-height: 16px;\n  color: var(--dsw-alias-label-secondary);\n  background: var(--dsw-static-neutral-50, #f4f4f5);\n  border-bottom: 0.5px solid var(--dsw-alias-border-l2);\n}\nbody[data-ds-dark-theme] .dsc-turn {\n  background: var(--dsw-static-neutral-850, #27272a);\n}\n.dsc-row {\n  box-sizing: border-box;\n  width: 100%;\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  min-height: 24px;\n  padding: 4px 10px;\n  border: 0;\n  background: transparent;\n  color: inherit;\n  font: inherit;\n  text-align: left;\n  cursor: pointer;\n}\n.dsc-row[data-nested=\"true\"] {\n  padding-left: 18px;\n}\n.dsc-folder {\n  display: block;\n  padding: 6px 10px 2px 10px;\n  font-family: var(--ds-font-family-code);\n  font-size: 11px;\n  line-height: 16px;\n  color: var(--dsw-alias-label-tertiary);\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n.dsc-row:hover,\n.dsc-row:focus-visible {\n  background: var(--dsw-alias-interactive-bg-hover);\n  outline: none;\n}\n.dsc-row[data-selected=\"true\"] {\n  background: var(--dsw-alias-interactive-bg-selected, var(--dsw-alias-interactive-bg-hover));\n}\n.dsc-row[data-missing=\"true\"] .dsc-path {\n  text-decoration: line-through;\n  color: var(--dsw-alias-state-error-primary, #cf222e);\n}\n.dsc-row[data-missing=\"true\"] .dsc-counts {\n  opacity: 0.45;\n}\n.dsc-row[data-missing=\"true\"]:hover .dsc-path,\n.dsc-row[data-missing=\"true\"]:focus-visible .dsc-path {\n  color: var(--dsw-alias-state-error-primary, #cf222e);\n}\n.dsc-path {\n  flex: 1;\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n.dsc-counts {\n  flex: none;\n  display: flex;\n  gap: 6px;\n  font-family: var(--ds-font-family-code);\n  font-size: 11px;\n}\n.dsc-add {\n  color: var(--dsw-alias-state-success-primary, #2da44e);\n}\n.dsc-del {\n  color: var(--dsw-alias-state-error-primary, #cf222e);\n}\n.dsc-muted {\n  color: var(--dsw-alias-label-tertiary);\n}\n.dsc-note {\n  display: flex;\n  align-items: center;\n  gap: 12px;\n  padding: 16px;\n  font-size: 13px;\n  color: var(--dsw-alias-label-secondary);\n}\n.dsc-divider {\n  flex: 0 0 6px;\n  position: relative;\n  cursor: col-resize;\n  background: transparent;\n  touch-action: none;\n  outline: none;\n}\n.dsc-divider::after {\n  content: \"\";\n  position: absolute;\n  top: 0;\n  bottom: 0;\n  left: 2.75px;\n  width: 0.5px;\n  background: var(--dsw-alias-border-l2);\n}\n.dsc-divider:hover::after,\n.dsc-divider:focus-visible::after,\n.dsc-divider[data-dragging=\"true\"]::after {\n  left: 2px;\n  width: 1px;\n  background: var(--dsw-alias-state-business-primary, #3b82f6);\n}\n.dsc-dhead {\n  box-sizing: border-box;\n  flex: none;\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  height: 38px;\n  padding: 0 8px 0 10px;\n  border-bottom: 0.5px solid var(--dsw-alias-border-l2);\n}\n.dsc-dpath {\n  flex: 1;\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  font-size: 12px;\n}\n.dsc-dbody {\n  flex: auto;\n  min-height: 0;\n  overflow: auto;\n  display: flex;\n  flex-direction: column;\n  font-family: var(--ds-font-family-code);\n  font-size: 12px;\n  line-height: 20px;\n  padding-bottom: 12px;\n}\n.dsc-dgrid {\n  display: grid;\n  grid-template-columns: max-content max-content;\n  min-width: 100%;\n  align-content: start;\n}\n.dsc-dgrid[data-wrap=\"true\"] {\n  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);\n}\n.dsc-cell {\n  display: flex;\n  min-width: 0;\n  box-sizing: border-box;\n}\n.dsc-cright {\n  border-left: 0.5px solid var(--dsw-alias-border-l2);\n}\n.dsc-lno {\n  flex: none;\n  width: 3.6em;\n  padding-right: 8px;\n  text-align: right;\n  color: var(--dsw-alias-label-tertiary);\n  user-select: none;\n  font-size: 11px;\n}\n.dsc-code {\n  white-space: pre;\n  padding-right: 12px;\n  min-width: 0;\n}\n.dsc-dgrid[data-wrap=\"true\"] .dsc-code {\n  white-space: pre-wrap;\n  word-break: break-word;\n  overflow-wrap: anywhere;\n}\n.dsc-cell[data-kind=\"del\"] {\n  background: rgba(207, 34, 46, 0.09);\n  background: color-mix(in srgb, var(--dsw-alias-state-error-primary, #cf222e) 12%, transparent);\n  box-shadow: inset 2px 0 0 var(--dsw-alias-state-error-primary, #cf222e);\n}\n.dsc-cell[data-kind=\"add\"] {\n  background: rgba(45, 164, 78, 0.09);\n  background: color-mix(in srgb, var(--dsw-alias-state-success-primary, #2da44e) 12%, transparent);\n  box-shadow: inset 2px 0 0 var(--dsw-alias-state-success-primary, #2da44e);\n}\n.dsc-cell[data-kind=\"pad\"] {\n  background: color-mix(in srgb, var(--dsw-alias-interactive-bg-hover) 45%, transparent);\n}\n.dsc-cell[data-kind=\"del\"] .dsc-lno {\n  color: var(--dsw-alias-state-error-primary, #cf222e);\n}\n.dsc-cell[data-kind=\"add\"] .dsc-lno {\n  color: var(--dsw-alias-state-success-primary, #2da44e);\n}\n.dsc-hunk {\n  grid-column: 1/-1;\n  min-width: max-content;\n  padding: 2px 10px;\n  color: var(--dsw-alias-label-tertiary);\n  background: color-mix(in srgb, var(--dsw-alias-interactive-bg-hover) 40%, transparent);\n  white-space: pre;\n  font-size: 11px;\n}\n.dsc-dnote {\n  grid-column: 1/-1;\n  padding: 6px 10px;\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 11px;\n  white-space: pre-wrap;\n}\n.dsc-modes {\n  flex: none;\n  display: flex;\n  gap: 2px;\n  padding: 4px 6px;\n  border-bottom: 0.5px solid var(--dsw-alias-border-l2);\n}\n.dsc-mode {\n  flex: 1;\n  min-width: 0;\n  font: inherit;\n  font-size: 11px;\n  line-height: 18px;\n  padding: 2px 6px;\n  border: 0;\n  border-radius: 6px;\n  background: transparent;\n  color: var(--dsw-alias-label-secondary);\n  cursor: pointer;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n.dsc-mode:hover {\n  background: var(--dsw-alias-interactive-bg-hover);\n}\n.dsc-mode[data-active=\"true\"] {\n  background: var(--dsw-alias-interactive-bg-selected, var(--dsw-alias-interactive-bg-hover));\n  color: var(--dsw-alias-label-primary);\n  font-weight: 500;\n}\n.dsc-dstack {\n  flex: auto;\n  min-height: 0;\n  overflow: auto;\n  padding-bottom: 12px;\n}\n.dsc-section + .dsc-section {\n  border-top: 0.5px solid var(--dsw-alias-border-l2);\n}\n.dsc-shead {\n  position: sticky;\n  top: 0;\n  z-index: 2;\n  padding: 4px 10px;\n  font-size: 11px;\n  font-weight: 500;\n  color: var(--dsw-alias-label-secondary);\n  background: var(--dsw-static-neutral-50, #f4f4f5);\n  border-bottom: 0.5px solid var(--dsw-alias-border-l2);\n}\nbody[data-ds-dark-theme] .dsc-shead {\n  background: var(--dsw-static-neutral-850, #27272a);\n}\n.dsc-lanes {\n  flex: 1 1 auto;\n  min-height: 0;\n  display: flex;\n}\n.dsc-lane {\n  flex: 1 1 50%;\n  min-width: 0;\n  overflow: auto;\n  box-sizing: border-box;\n  padding-bottom: 8px;\n}\n.dsc-lane + .dsc-lane {\n  border-left: 0.5px solid var(--dsw-alias-border-l2);\n}\n.dsc-lane-left {\n  scrollbar-width: none;\n}\n.dsc-lane-left::-webkit-scrollbar {\n  display: none;\n  width: 0;\n  height: 0;\n}\n.dsc-lrow {\n  display: flex;\n  width: 100%;\n  min-width: max-content;\n  height: 20px;\n}\n.dsc-lrow[data-kind=\"del\"] {\n  background: rgba(207, 34, 46, 0.09);\n  background: color-mix(in srgb, var(--dsw-alias-state-error-primary, #cf222e) 12%, transparent);\n  box-shadow: inset 2px 0 0 var(--dsw-alias-state-error-primary, #cf222e);\n}\n.dsc-lrow[data-kind=\"add\"] {\n  background: rgba(45, 164, 78, 0.09);\n  background: color-mix(in srgb, var(--dsw-alias-state-success-primary, #2da44e) 12%, transparent);\n  box-shadow: inset 2px 0 0 var(--dsw-alias-state-success-primary, #2da44e);\n}\n.dsc-lrow[data-kind=\"pad\"] {\n  background: color-mix(in srgb, var(--dsw-alias-interactive-bg-hover) 45%, transparent);\n}\n.dsc-lrow[data-kind=\"del\"] .dsc-lno,\n.dsc-lrow[data-kind=\"del\"] .dsc-lsign {\n  color: var(--dsw-alias-state-error-primary, #cf222e);\n}\n.dsc-lrow[data-kind=\"add\"] .dsc-lno,\n.dsc-lrow[data-kind=\"add\"] .dsc-lsign {\n  color: var(--dsw-alias-state-success-primary, #2da44e);\n}\n.dsc-lsign {\n  flex: none;\n  width: 1.4em;\n  text-align: center;\n  color: var(--dsw-alias-label-tertiary);\n  user-select: none;\n  font-size: 11px;\n}\n.dsc-dnotes {\n  flex: none;\n  display: flex;\n  flex-direction: column;\n  padding: 2px 0;\n}\n.dsc-chips {\n  flex: none;\n  display: flex;\n  gap: 4px;\n  padding: 4px 8px;\n  border-bottom: 0.5px solid var(--dsw-alias-border-l2);\n  overflow-x: auto;\n}\n.dsc-turnstrip {\n  flex: none;\n  display: flex;\n  gap: 3px;\n  padding: 4px 6px;\n  overflow-x: auto;\n  border-bottom: 0.5px solid var(--dsw-alias-border-l2);\n  scrollbar-width: thin;\n}\n.dsc-chip {\n  flex: none;\n  font: inherit;\n  font-size: 11px;\n  line-height: 16px;\n  padding: 2px 8px;\n  border: 0;\n  border-radius: 999px;\n  background: var(--dsw-alias-interactive-bg-hover);\n  color: var(--dsw-alias-label-secondary);\n  cursor: pointer;\n}\n.dsc-chip:disabled {\n  opacity: 0.4;\n  cursor: default;\n}\n.dsc-chip[data-active=\"true\"] {\n  background: var(--dsw-alias-interactive-bg-selected, var(--dsw-alias-interactive-bg-hover));\n  color: var(--dsw-alias-label-primary);\n  font-weight: 500;\n}\n.dsc-file {\n  display: flex;\n  flex-direction: column;\n  min-width: max-content;\n}\n.dsc-unified {\n  display: flex;\n  flex-direction: column;\n  min-width: max-content;\n  font-family: var(--ds-font-family-code);\n  font-size: 12px;\n  line-height: 20px;\n}\n.dsc-wrap {\n  flex: auto;\n  min-height: 0;\n  display: flex;\n  flex-direction: column;\n}\n.dsc-wrap-body {\n  flex: auto;\n  min-height: 0;\n  display: flex;\n  flex-direction: column;\n}\n.dsc-urow {\n  display: grid;\n  grid-template-columns: 3.2em 3.2em 1.2em max-content;\n  min-width: 100%;\n}\n.dsc-unified[data-wrap=\"true\"] .dsc-urow {\n  grid-template-columns: 3.2em 3.2em 1.2em minmax(0, 1fr);\n}\n.dsc-urow[data-kind=\"del\"] {\n  background: rgba(207, 34, 46, 0.09);\n  background: color-mix(in srgb, var(--dsw-alias-state-error-primary, #cf222e) 12%, transparent);\n  box-shadow: inset 2px 0 0 var(--dsw-alias-state-error-primary, #cf222e);\n}\n.dsc-urow[data-kind=\"add\"] {\n  background: rgba(45, 164, 78, 0.09);\n  background: color-mix(in srgb, var(--dsw-alias-state-success-primary, #2da44e) 12%, transparent);\n  box-shadow: inset 2px 0 0 var(--dsw-alias-state-success-primary, #2da44e);\n}\n.dsc-urow[data-kind=\"del\"] .dsc-uno,\n.dsc-urow[data-kind=\"del\"] .dsc-usign {\n  color: var(--dsw-alias-state-error-primary, #cf222e);\n}\n.dsc-urow[data-kind=\"add\"] .dsc-uno,\n.dsc-urow[data-kind=\"add\"] .dsc-usign {\n  color: var(--dsw-alias-state-success-primary, #2da44e);\n}\n.dsc-uno {\n  text-align: right;\n  padding-right: 6px;\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 11px;\n}\n.dsc-usign {\n  text-align: center;\n  color: var(--dsw-alias-label-tertiary);\n}\n.dsc-btn[data-active=\"true\"] {\n  background: var(--dsw-alias-interactive-bg-selected, var(--dsw-alias-interactive-bg-hover));\n  color: var(--dsw-alias-label-primary);\n}\n";

		  /**
		   * Publish this package's stylesheet once per document. The tag is keyed, so a
		   * refreshed page (or a second tab body) replaces nothing and stacks nothing.
		   */
		  function installStyles() {
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

		  /**
		   * Session changes, browser half: a sidebar tab that lists every file this Session
		   * changed and draws the selected file's comparison beside the list.
		   *
		   * The shipped artifact is one classic script inside `window.__ModuleLoader__`, so
		   * this directory is the real source: `npm run build` bundles it into
		   * `lib/client.js`. See scripts/build.mjs.
		   */


		  /** The Host features this client half needs. */
		  const inject = ["slots", "locale", "sidebarRightTabs", "sidebarRight"];

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
		  function apply(ctx) {
		    const t = ctx.locale.bind(NS);
		    setResourceOpener((address, options) => ctx.sidebarRight.openResource(address, options));
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

		  exports.apply = apply;
		  exports.inject = inject;

		  Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

		  return exports;

		})({});
		exports.apply = __dshSessionChangesBundle.apply;
		exports.inject = __dshSessionChangesBundle.inject;
		return module.exports;
	}
});
