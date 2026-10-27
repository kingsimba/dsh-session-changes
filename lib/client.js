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

		  /** Dictionary namespace. */
		  const NS = "session-changes";

		  /** This implementation's identity in the tab system, and the key its body registers under. */
		  const TYPE_ID = "dsh-session-changes";

		  /** The page kind the guide entry opens. */
		  const KIND = "session-changes";

		  /** The command id this page contributes to the keyboard-shortcut catalog. */
		  const COMMAND_ID = "session.changes.open";

		  /** The authenticated routes served by this package's Host half. */
		  const LIST_ROUTE = "api/session-changes.list";
		  const FILE_ROUTE = "api/session-changes.file";
		  const BASE_ROUTE = "api/session-changes.base";
		  const WATCH_ROUTE = "api/session-changes.watch";

		  /** Native open of a captured file, served by this package's Host half. */
		  const OPEN_ROUTE = "api/session-changes.open";

		  /** The review writes: accept one change block into the pre-image, or revert it. */
		  const ACCEPT_ROUTE = "api/session-changes.accept";
		  const REVERT_ROUTE = "api/session-changes.revert";

		  /** Persisted preferences: left pane width, wrap, whole-file scope, layout. */
		  const WIDTH_KEY = "dsh-session-changes.left";
		  const WRAP_KEY = "dsh-session-changes.wrap";
		  const WHOLE_KEY = "dsh-session-changes.whole";
		  const LAYOUT_KEY = "dsh-session-changes.layout";

		  /** Pane geometry bounds, in pixels. */
		  const MIN_LEFT = 180;
		  const MIN_RIGHT = 260;

		  /** Left pane width before the user has dragged it. */
		  const DEFAULT_LEFT = 220;

		  /** Rows drawn before the comparison says it stopped. */
		  const ROW_CAP = 5000;

		  /** Context lines kept around each change when the diff is cut into hunks. */
		  const DIFF_CONTEXT = 3;

		  /** Identifies this package's stylesheet tag, so a reload never stacks a second copy. */
		  const CSS_TAG_ID = "dsh-session-changes/list.css";

		  /**
		   * Split one hunk into the change blocks a reviewer acts on: each run of deletions
		   * and additions between context lines, with the exact ranges it covers on both
		   * sides. The review buttons work one block at a time, so the ranges have to be
		   * exact: a block with no deletions is a pure insertion at `oldStart`, and one with
		   * no additions is a pure deletion at `newStart`.
		   *
		   * @param hunk - a hunk (`{ oldStart, newStart, lines }`) as the pane receives it.
		   * @returns the blocks in file order, each with its 1-based start and line counts,
		   *   the deleted and added line texts, and the `from`/`to` row indexes it spans.
		   */
		  function hunkBlocks(hunk) {
		    const lines = Array.isArray(hunk.lines) ? hunk.lines : [];
		    const blocks = [];
		    let oldNo = hunk.oldStart;
		    let newNo = hunk.newStart;
		    let current = null;
		    for (let at = 0; at < lines.length; at += 1) {
		      const op = lines[at][0];
		      const text = lines[at].slice(1);
		      if (op === " ") {
		        current = null;
		        oldNo += 1;
		        newNo += 1;
		        continue;
		      }
		      if (current === null) {
		        current = {
		          from: at,
		          to: at,
		          oldStart: oldNo,
		          oldLines: 0,
		          newStart: newNo,
		          newLines: 0,
		          deleted: [],
		          added: [],
		        };
		        blocks.push(current);
		      }
		      current.to = at;
		      if (op === "-") {
		        current.deleted.push(text);
		        current.oldLines += 1;
		        oldNo += 1;
		      } else if (op === "+") {
		        current.added.push(text);
		        current.newLines += 1;
		        newNo += 1;
		      }
		    }
		    return blocks;
		  }

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
		        // Both cells of a paired row belong to the same change block; carrying the
		        // block on the row lets a pad half (or either lane) draw its review buttons.
		        const block = left === undefined ? right.block : left.block;
		        out.push({
		          ...(left === undefined ? {} : { left }),
		          ...(right === undefined ? {} : { right }),
		          ...(block === undefined ? {} : { block }),
		        });
		      }
		      dels = [];
		      adds = [];
		    };
		    for (const row of rows) {
		      if (row.kind === "del")
		        dels.push({ no: row.old, text: row.text, kind: "del", block: row.block });
		      else if (row.kind === "add")
		        adds.push({ no: row.new, text: row.text, kind: "add", block: row.block });
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
		   * Each hunk also yields its change blocks, and every changed numbered row keeps a
		   * reference to its block, so either layout can draw the block's accept/revert
		   * buttons without recomputing the ranges. A hunk cut by the row budget marks its
		   * blocks `editable: false`: their ranges would be incomplete.
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
		    for (let hunkAt = 0; hunkAt < hunks.length; hunkAt += 1) {
		      const hunk = hunks[hunkAt];
		      if (budget <= 0) {
		        truncated = true;
		        break;
		      }
		      const kept =
		        hunk.lines.length <= budget ? hunk : { ...hunk, lines: hunk.lines.slice(0, budget) };
		      budget -= kept.lines.length;
		      const cut = kept !== hunk;
		      if (cut) truncated = true;
		      const numbered = hunkRows(kept);
		      const changes = hunkBlocks(kept).map((block, at) => ({
		        ...block,
		        key: String(hunkAt) + ":" + String(at),
		        editable: cut !== true,
		      }));
		      for (const block of changes)
		        for (let at = block.from; at <= block.to; at += 1) numbered[at].block = block;
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
		        changes,
		      });
		    }
		    return { blocks, truncated };
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
		   * The two review buttons of one change block. They live inside the block's row (or
		   * cell), so CSS can show them while that row is hovered and hide them as soon as the
		   * pointer leaves the block; moving onto the buttons keeps the row hovered, because
		   * they are its descendants. No hover state is kept in React.
		   *
		   * Headless blocks (no block, or a hunk cut by the row cap) render nothing.
		   *
		   * @param props - `{ t, block, busy, onAction(action, block) }`.
		   */
		  function BlockActions({ t, block, busy, onAction }) {
		    if (block === undefined || block === null || block.editable !== true) return null;
		    const run = (action) => (event) => {
		      event.stopPropagation();
		      if (busy !== true) onAction(action, block);
		    };
		    return h("span", { className: "dsc-actions", key: "actions" }, [
		      h("span", { className: "dsc-actionbar", key: "bar" }, [
		        h(
		          "button",
		          {
		            type: "button",
		            className: "dsc-act",
		            key: "accept",
		            "data-action": "accept",
		            title: t("acceptChange"),
		            "aria-label": t("acceptChange"),
		            disabled: busy === true,
		            onClick: run("accept"),
		          },
		          t("acceptShort"),
		        ),
		        h(
		          "button",
		          {
		            type: "button",
		            className: "dsc-act",
		            key: "revert",
		            "data-action": "revert",
		            title: t("revertChange"),
		            "aria-label": t("revertChange"),
		            disabled: busy === true,
		            onClick: run("revert"),
		          },
		          t("revertShort"),
		        ),
		      ]),
		    ]);
		  }

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
		   * sibling cells instead of two scroll-synced lanes. The row's change block rides
		   * along, so the new half carries its accept/revert buttons — or the old half when
		   * the row has no new side (a pure deletion).
		   *
		   * @param props - `{ row, marks, keyPrefix, t, busy, onAction }`.
		   * @returns the left cell, then the right cell.
		   */
		  function DiffCells({ row, marks, keyPrefix, t, busy, onAction }) {
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
		              : h(DiffText, { key: "c", text: cell.text, spans }),
		            actionable ? h(BlockActions, { key: "a", t, block: row.block, busy, onAction }) : null,
		          ],
		        ),
		      );
		    }
		    return cells;
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
		   * split layout, so either scope can use either one. A changed row carries its
		   * block's accept/revert buttons, shown only while that row is hovered.
		   *
		   * @param props - `{ state, wrap, t, onRetry, busy, actionError, onAction }`.
		   */
		  function InlineDiff({ state, wrap, t, onRetry, busy, actionError, onAction }) {
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

		    return h("div", { className: "dsc-dbody" }, [
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
		  function SplitDiff({ state, wrap, t, onRetry, busy, actionError, onAction }) {
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

		  /**
		   * What the comparison area shows: the diff of the stored pre-image against the file
		   * as it stands now, or the note explaining why there is none.
		   *
		   * @param props - the current selection, the computed comparison and its sources,
		   *   plus the review action state (`busy`, `actionError`, `onAction`).
		   */
		  function DetailBody({
		    t,
		    selected,
		    layout,
		    whole,
		    wrap,
		    comparison,
		    baseState,
		    busy,
		    actionError,
		    onAction,
		  }) {
		    if (selected === null) return h("div", { className: "dsc-note" }, t("pick"));

		    let note = null;
		    let payloadState;
		    if (comparison === null || comparison.status === "pending") note = t("loading");
		    else if (comparison.status === "unreadable") note = t("wholeError");
		    else if (comparison.status === "binary") note = t("diffBinary");
		    else if (comparison.status === "oversized") note = t("diffOversized");
		    else if (comparison.status === "no-base") note = t("overallNoBase");
		    else {
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

		    if (note !== null) return h("div", { className: "dsc-note" }, note);

		    const shared = { state: payloadState, wrap, t, busy, actionError, onAction };
		    return layout === "inline" ? h(InlineDiff, shared) : h(SplitDiff, shared);
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
		   * The comparison toolbar: name, counts, and the layout / scope / open / wrap
		   * buttons.
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
		    ]);
		  }

		  /**
		   * The comparison pane: toolbar and body.
		   *
		   * @param props - `{ t, selected, layout, wrap, comparison, baseState, onToggleLayout,
		   *   onToggleWrap }`.
		   */
		  function DetailPane(props) {
		    return h("div", { className: "dsc-pane dsc-right", key: "r" }, [
		      h(RightHead, props),
		      h(DetailBody, props),
		    ]);
		  }

		  /**
		   * The master list: title, session totals, and the rows.
		   *
		   * @param props - `{ t, state, totals, rows, busy, left, reverted, onRefresh }`, where
		   *   `reverted` says the empty list means "every change was undone", not "nothing
		   *   was ever recorded".
		   */
		  function ListPane({ t, state, totals, rows, busy, left, reverted, onRefresh }) {
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
		    else if (rows.length === 0)
		      listBody = h("div", { className: "dsc-note" }, reverted === true ? t("reverted") : t("empty"));
		    else listBody = h("div", { className: "dsc-body" }, rows);

		    return h(
		      "div",
		      { className: "dsc-pane dsc-left", key: "l", style: { flex: "0 0 " + String(left) + "px" } },
		      [
		        h("div", { className: "dsc-head", key: "h" }, [
		          h("span", { className: "dsc-title", key: "t" }, t("title")),
		          state.files.length === 0
		            ? null
		            : h("span", { className: "dsc-stat", key: "s" }, [
		                h("span", { className: "dsc-add", key: "a" }, "+" + String(totals.added)),
		                h("span", { className: "dsc-del", key: "d" }, "−" + String(totals.deleted)),
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
		        listBody,
		      ],
		    );
		  }

		  /**
		   * Group a flat file list by folder.
		   * @param files - `{ path, display }[]` as the Host lists them.
		   * @returns the folder groups and the number of files.
		   */
		  function groupFiles(files) {
		    const folders = [];
		    const byFolder = new Map();
		    for (const file of files) {
		      const segments = String(file.display).split(/[\\/]/);
		      const name = segments.pop() ?? String(file.display);
		      const folder = segments.join("/");
		      let bucket = byFolder.get(folder);
		      if (bucket === undefined) {
		        bucket = [];
		        byFolder.set(folder, bucket);
		        folders.push(folder);
		      }
		      bucket.push({ file, name });
		    }
		    return {
		      folders: folders.map((folder) => ({ folder, files: byFolder.get(folder) })),
		      count: files.length,
		    };
		  }

		  /**
		   * One list row, as data: the selection keeps only this, so it survives the list
		   * being rebuilt.
		   *
		   * @param row - one built row.
		   * @returns the selection.
		   */

		  /**
		   * Whether one row is the selected file.
		   * @param row - one built row.
		   * @param selected - the selected value, or null.
		   * @returns true when the row should render as selected.
		   */
		  function rowMatchesSelection(row, selected) {
		    return selected !== null && selected.path === row.path;
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
		   * Turn the Host's file list plus the live counts into the rows the list shows.
		   *
		   * A file that was edited back to its pre-image nets zero, so it is not "changed
		   * since this task started" and drops out instead of reading `+0 −0`. A row whose
		   * counts are still being read stays visible without numbers.
		   *
		   * @param files - `{ path, display }[]` from the Host.
		   * @param counts - `{ [path]: { added, deleted, missing, binary, oversized } }`.
		   * @returns the rows, grouped by folder.
		   */
		  function buildRows(files, counts) {
		    const shown = [];
		    for (const file of files) {
		      const live = counts[file.path];
		      if (
		        live !== undefined &&
		        live.missing !== true &&
		        live.binary !== true &&
		        live.oversized !== true &&
		        (live.added ?? 0) === 0 &&
		        (live.deleted ?? 0) === 0
		      )
		        continue;
		      const segments = String(file.display).split(/[\\/]/);
		      const name = segments.pop() ?? String(file.display);
		      shown.push({
		        path: file.path,
		        display: file.display,
		        name,
		        folder: segments.join("/"),
		        added: live === undefined ? undefined : live.added,
		        deleted: live === undefined ? undefined : live.deleted,
		        missing: live === undefined ? false : live.missing === true,
		        binary: live === undefined ? false : live.binary === true,
		        oversized: live === undefined ? false : live.oversized === true,
		      });
		    }
		    return shown;
		  }

		  /**
		   * Build the left list: one folder header, then that folder's files.
		   *
		   * @param input - `{ rows, selectedPath, t, onSelect }`.
		   * @returns the elements in order.
		   */
		  function buildListRows({ rows, selectedPath, t, onSelect }) {
		    const grouped = groupFiles(rows);
		    const out = [];
		    for (const folder of grouped.folders) {
		      const label = folder.folder === "" ? "./" : folder.folder + "/";
		      out.push(h("div", { className: "dsc-folder", key: "f:" + folder.folder, title: label }, label));
		      for (const row of folder.files) {
		        out.push(
		          h(FileRow, {
		            key: row.file.path,
		            file: row.file,
		            name: row.file.name,
		            t,
		            missing: row.file.missing === true,
		            selected: rowMatchesSelection(row.file, { path: selectedPath }),
		            onSelect: () => onSelect(row.file.path),
		          }),
		        );
		      }
		    }
		    return out;
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
		      cache: "no-store",
		    });
		    if (!response.ok) throw new Error(String(response.status));
		    return response.json();
		  }

		  /**
		   * Read the files this Session's file tools touched.
		   * @param sessionId - the viewed Session.
		   * @param signal - cancellation.
		   * @returns `{ path, display }[]`, or none for a malformed payload.
		   */
		  async function readFiles(sessionId, signal) {
		    const payload = await getJson(LIST_ROUTE, { sessionId }, signal);
		    if (payload === null || typeof payload !== "object" || !Array.isArray(payload.files)) return [];
		    return payload.files
		      .filter((file) => file !== null && typeof file === "object" && typeof file.path === "string")
		      .map((file) => ({ path: file.path, display: String(file.display ?? file.path) }));
		  }

		  /**
		   * Read one file's text as it stood before this Session first touched it.
		   * @param sessionId - the viewed Session.
		   * @param path - the file's path as the list spells it.
		   * @param signal - cancellation.
		   * @returns `{ text }`, or `{ absent: true }` when the file did not exist yet.
		   */
		  async function readBase(sessionId, path, signal) {
		    const response = await fetch(BASE_ROUTE + query({ sessionId, path }), {
		      signal,
		      headers: { accept: "application/json" },
		      credentials: "same-origin",
		      cache: "no-store",
		    });
		    if (!response.ok) {
		      const refusal = new Error(String(response.status));
		      let reason = "";
		      try {
		        const payload = await response.json();
		        if (payload !== null && typeof payload === "object" && typeof payload.error === "string")
		          reason = payload.error;
		      } catch (_error) {
		        // A body that is not JSON leaves the status as the reason.
		      }
		      refusal.binary = reason === "binary";
		      refusal.oversized = reason === "too-large";
		      refusal.uncaptured = reason === "not-captured";
		      throw refusal;
		    }
		    const payload = await response.json();
		    if (payload === null || typeof payload !== "object") throw new Error("malformed");
		    if (payload.absent === true) return { absent: true };
		    if (typeof payload.text !== "string") throw new Error("malformed");
		    return { text: payload.text };
		  }

		  /**
		   * Read one file's current text from disk.
		   *
		   * The refusal carries the reason the comparison needs to explain itself: a path
		   * that vanished is a deletion, not a read failure, and a binary or oversized file
		   * has no readable diff either.
		   *
		   * @param sessionId - the viewed Session.
		   * @param path - the file's path as the list spells it.
		   * @param signal - cancellation.
		   * @returns the text, or throws a refusal flagged `missing` / `binary` / `oversized`.
		   */
		  async function readWholeFile(sessionId, path, signal) {
		    const response = await fetch(FILE_ROUTE + query({ sessionId, path }), {
		      signal,
		      headers: { accept: "application/json" },
		      credentials: "same-origin",
		      cache: "no-store",
		    });
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
		      refusal.binary = reason === "binary";
		      refusal.oversized = reason === "too-large";
		      throw refusal;
		    }
		    const payload = await response.json();
		    if (payload === null || typeof payload !== "object" || typeof payload.text !== "string")
		      throw new Error("malformed");
		    return payload.text;
		  }

		  /**
		   * Ask the Host desktop to open one captured file in its default application.
		   * @param sessionId - the viewed Session.
		   * @param path - the file's path as the list spells it.
		   */
		  async function requestOpen(sessionId, path) {
		    const response = await fetch(OPEN_ROUTE + query({ sessionId, path }), {
		      method: "POST",
		      credentials: "same-origin",
		    });
		    if (!response.ok) throw new Error(String(response.status));
		  }

		  /**
		   * Apply one change block: `accept` writes the block's new lines into the stored
		   * pre-image, `revert` writes the block's old lines back into the live file.
		   *
		   * The Host refuses a write whose `expect` digest no longer matches the side it is
		   * about to replace, so an agent edit that landed while the diff was open cannot be
		   * clobbered; the refusal is flagged `conflict` for the caller to explain.
		   *
		   * @param input - `{ sessionId, path, action, text, expect }`: the block's new full
		   *   text for one side, and the digest of the text it replaces (`null` to skip).
		   * @returns the Host's answer, `{ ok }` plus `deleted` when a revert removed a file.
		   */
		  async function requestApply({ sessionId, path, action, text, expect }) {
		    const route = action === "accept" ? ACCEPT_ROUTE : REVERT_ROUTE;
		    const response = await fetch(route, {
		      method: "POST",
		      headers: { "content-type": "application/json", accept: "application/json" },
		      credentials: "same-origin",
		      cache: "no-store",
		      body: JSON.stringify({ sessionId, path, text, expect }),
		    });
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
		      refusal.conflict = reason === "changed";
		      refusal.uncaptured = reason === "not-captured";
		      throw refusal;
		    }
		    try {
		      const payload = await response.json();
		      return payload !== null && typeof payload === "object" ? payload : { ok: true };
		    } catch (_error) {
		      return { ok: true };
		    }
		  }

		  /**
		   * Open the Host's invalidation stream for one Session and deliver each frame as it
		   * arrives. Frames are newline-delimited JSON: `ready`, `file`, `added`, and `ping`.
		   *
		   * The promise settles when the stream ends (the Host restarted, or the tab closed
		   * the connection); a failed open rejects.
		   *
		   * @param sessionId - the viewed Session.
		   * @param options - `{ signal, onOpen, onFrame }`.
		   * @returns when the stream ends; rejects when the route cannot be opened.
		   */
		  async function watchChanges(sessionId, options) {
		    const { signal, onOpen, onFrame } = options;
		    const response = await fetch(WATCH_ROUTE + query({ sessionId: String(sessionId) }), {
		      signal,
		      headers: { accept: "application/x-ndjson" },
		      credentials: "same-origin",
		      cache: "no-store",
		    });
		    if (!response.ok) throw new Error(String(response.status));
		    if (response.body === null || response.body === undefined) throw new Error("no-body");
		    if (typeof onOpen === "function") onOpen();
		    const reader = response.body.getReader();
		    const decoder = new TextDecoder();
		    let buffer = "";
		    try {
		      for (;;) {
		        const { value, done } = await reader.read();
		        if (done) return;
		        buffer += decoder.decode(value, { stream: true });
		        let newline = buffer.indexOf("\n");
		        while (newline !== -1) {
		          const line = buffer.slice(0, newline).trim();
		          buffer = buffer.slice(newline + 1);
		          if (line !== "") {
		            let frame;
		            try {
		              frame = JSON.parse(line);
		            } catch (_error) {
		              frame = null;
		            }
		            if (frame !== null && typeof frame === "object" && typeof onFrame === "function") {
		              onFrame(frame);
		            }
		          }
		          newline = buffer.indexOf("\n");
		        }
		      }
		    } finally {
		      try {
		        await reader.cancel();
		      } catch (_error) {
		        // The Host already closed the body; nothing left to release.
		      }
		    }
		  }

		  /**
		   * One trailing debounce timer: any number of {@link schedule} calls inside `delay`
		   * collapse into a single {@link run}, fired `delay` ms after the last call.
		   *
		   * A file save is rarely one event on disk (editors write a temp file, rename, then
		   * touch again), so the tab coalesces the burst before it re-reads. The returned
		   * handle is disposable: the tab's effect owns it and drops it on close.
		   *
		   * @param delay - quiet period in milliseconds.
		   * @param run - the callback one burst ends with.
		   * @returns `{ schedule, cancel, dispose, pending }`.
		   */
		  function createDebouncer(delay, run) {
		    let timer = undefined;
		    let disposed = false;

		    const cancel = () => {
		      if (timer !== undefined) {
		        clearTimeout(timer);
		        timer = undefined;
		      }
		    };

		    return {
		      /** Restart the quiet period. */
		      schedule() {
		        if (disposed) return;
		        cancel();
		        timer = setTimeout(() => {
		          timer = undefined;
		          run();
		        }, delay);
		      },
		      cancel,
		      /** Drop any waiting call; later schedules are ignored. */
		      dispose() {
		        disposed = true;
		        cancel();
		      },
		      /** Whether one burst is still waiting. */
		      get pending() {
		        return timer !== undefined;
		      },
		    };
		  }

		  /** Quiet period a burst of invalidations has to hold before the tab re-reads. */
		  const AUTO_REFRESH_DEBOUNCE_MS = 1000;

		  /** Wait before reopening a stream the Host dropped. */
		  const AUTO_REFRESH_RETRY_MS = 2000;

		  /**
		   * Keep the open tab current without polling and without waiting for a turn to close:
		   * the Host streams one frame per listed-file invalidation and one per committed
		   * `workspace/changes`, and a burst of frames coalesces into a single re-read.
		   *
		   * The stream only exists while the tab is visible, and the ref keeps the effect from
		   * reopening it on every render (the feed rebuilds `refresh` each pass). A stream that
		   * ends after delivering frames is reopened, because a Host restart should not leave
		   * the tab stale; a stream that never opened is left alone — the tab still reads on
		   * open, and a Host without the watch route cannot be healed by retrying.
		   *
		   * @param input - `{ sessionId, visible, refresh }`.
		   */
		  function useAutoRefresh({ sessionId, visible, refresh }) {
		    const latest = react.useRef(refresh);
		    react.useEffect(() => {
		      latest.current = refresh;
		    });

		    react.useEffect(() => {
		      if (visible === false) return undefined;
		      if (typeof sessionId !== "string" || sessionId === "") return undefined;
		      let live = true;
		      let opened = false;
		      let retry = undefined;
		      const controller = new AbortController();
		      const debouncer = createDebouncer(AUTO_REFRESH_DEBOUNCE_MS, () => latest.current());

		      const connect = async () => {
		        try {
		          await watchChanges(sessionId, {
		            signal: controller.signal,
		            onOpen: () => {
		              opened = true;
		            },
		            onFrame: (frame) => {
		              if (frame.t === "file" || frame.t === "turn") debouncer.schedule();
		            },
		          });
		        } catch (_error) {
		          // Leaving a reading tab quiet is better than a reconnect storm.
		        }
		        if (!live || !opened) return;
		        retry = setTimeout(connect, AUTO_REFRESH_RETRY_MS);
		      };
		      void connect();

		      return () => {
		        live = false;
		        controller.abort();
		        debouncer.dispose();
		        if (retry !== undefined) clearTimeout(retry);
		      };
		    }, [sessionId, visible]);
		  }

		  /**
		   * The Session's first pre-image of the selected file: the stored baseline the
		   * comparison diffs against.
		   *
		   * @param input - `{ sessionId, path, nonce }`.
		   * @returns `{ phase: "ready", text }` / `{ phase: "ready", absent: true }` /
		   *   `{ phase: "loading" }` / `{ phase: "binary" }` / `{ phase: "error" }`, or
		   *   undefined before the read.
		   */
		  function useBase({ sessionId, path, nonce }) {
		    const [state, setState] = react.useState(undefined);
		    react.useEffect(() => {
		      if (path === null) return undefined;
		      if (typeof sessionId !== "string" || sessionId === "") return undefined;
		      let live = true;
		      const controller = new AbortController();
		      setState({ phase: "loading" });
		      readBase(sessionId, path, controller.signal)
		        .then((value) => {
		          if (live) setState({ phase: "ready", ...value });
		        })
		        .catch((error) => {
		          if (!live || controller.signal.aborted) return;
		          if (error !== null && error !== undefined && error.binary === true)
		            setState({ phase: "binary" });
		          else setState({ phase: "error" });
		        });
		      return () => {
		        live = false;
		        controller.abort();
		      };
		    }, [sessionId, path, nonce]);
		    return state;
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
		   * One range covering the whole file; an empty diff has no range at all.
		   * @param ops - the operation list.
		   * @returns zero or one hunk.
		   */
		  function wholeRange(ops) {
		    return ops.length === 0 ? [] : [sliceHunk(ops, 0, ops.length - 1)];
		  }

		  /**
		   * Diff two texts into the `ready` comparison shape the panes consume.
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
		   * Work out what the comparison shows for the selected file: the Session's stored
		   * first pre-image against the file as it stands now, and nothing else. With no
		   * pre-image there is no baseline, so the pane says so instead of inventing one.
		   *
		   * @param input - `{ selected, wholeState, baseState }`.
		   * @returns the comparison, `null` while nothing is selected, or a status:
		   *   `pending` (still reading), `unreadable`, `binary`, `oversized`, `no-base`.
		   */
		  function buildComparison({ selected, wholeState, baseState }) {
		    if (selected === null) return null;
		    if (wholeState !== undefined && wholeState.phase === "error") return { status: "unreadable" };
		    if (wholeState !== undefined && wholeState.phase === "binary") return { status: "binary" };
		    if (wholeState !== undefined && wholeState.phase === "oversized") return { status: "oversized" };
		    if (wholeState === undefined || wholeState.phase === "loading") return { status: "pending" };
		    // The path is gone from the disk: compare against "nothing" so the whole
		    // pre-image reads as deleted, instead of claiming the file is unreadable.
		    const gone = wholeState.phase === "missing";
		    const current = gone ? "" : wholeState.text;
		    if (baseState === undefined || baseState.phase === "loading") return { status: "pending" };
		    if (baseState.phase !== "ready") return { status: "no-base" };
		    const beforeText = baseState.absent === true ? "" : baseState.text;
		    return { ...compare(beforeText, current), gone, absent: baseState.absent === true };
		  }

		  /**
		   * The comparison for the selected file, recomputed only when one of its sources
		   * changes.
		   *
		   * @param input - `{ selected, wholeState, baseState }`.
		   * @returns the comparison, or null while nothing is selected.
		   */
		  function useComparison({ selected, wholeState, baseState }) {
		    return react.useMemo(
		      () => buildComparison({ selected, wholeState, baseState }),
		      [selected, wholeState, baseState],
		    );
		  }

		  /**
		   * Added and deleted line counts between two texts, using the same line diff the
		   * comparison pane draws, so a row's numbers and the pane beside it cannot disagree.
		   *
		   * @param before - the old side text.
		   * @param after - the new side text.
		   * @returns `{ added, deleted }`.
		   */
		  function countChangedLines(before, after) {
		    const { ops } = diffLines(
		      before === "" ? [] : before.split("\n"),
		      after === "" ? [] : after.split("\n"),
		    );
		    let added = 0;
		    let deleted = 0;
		    for (const change of ops) {
		      if (change.op === "+") added += 1;
		      else if (change.op === "-") deleted += 1;
		    }
		    return { added, deleted };
		  }

		  /** Most files one roll-up reads; the rest keep no live numbers. */
		  const COUNT_CAP = 60;

		  /** Largest text worth diffing just to number a row. */
		  const MAX_COUNT_CHARS = 1000000;

		  /** Lines in one text, counting a trailing newline as this diff engine does. */
		  function lineCount(text) {
		    return text === "" ? 0 : text.split("\n").length;
		  }

		  /**
		   * Live `+added/−deleted` counts for the rows, plus what the row cannot show: a path
		   * that vanished, a binary file, or one too large to read.
		   *
		   * The pane diffs the stored pre-image against the file as it stands now, so the list
		   * numbers the same pair. One read per file (the pre-image is cached for the Session,
		   * it never changes), capped so a large Session cannot turn a refresh into a scan.
		   * Accepting a block rewrites that pre-image, so `baseVersion` drops the cache and
		   * reads the bases again.
		   *
		   * @param input - `{ sessionId, files, nonce, baseVersion }`; `nonce` re-runs the
		   *   read, and a new `baseVersion` also forgets the cached pre-images.
		   * @returns `{ [path]: { added, deleted, missing, binary, oversized } }`.
		   */
		  function useFileCounts({ sessionId, files, nonce, baseVersion }) {
		    const [counts, setCounts] = react.useState({});
		    const bases = react.useRef(new Map());
		    const version = react.useRef(baseVersion);

		    react.useEffect(() => {
		      if (version.current !== baseVersion) {
		        bases.current.clear();
		        version.current = baseVersion;
		      }
		      if (typeof sessionId !== "string" || sessionId === "") {
		        setCounts({});
		        return undefined;
		      }
		      let live = true;
		      const controller = new AbortController();
		      const targets = files.slice(0, COUNT_CAP);

		      void (async () => {
		        const next = {};
		        await Promise.all(
		          targets.map(async (file) => {
		            const key = String(sessionId) + ":" + file.path;
		            try {
		              let before = bases.current.get(key);
		              if (before === undefined) {
		                const base = await readBase(sessionId, file.path, controller.signal);
		                before = base.absent === true ? "" : base.text;
		                bases.current.set(key, before);
		              }
		              if (before.length > MAX_COUNT_CHARS) return;
		              const after = await readWholeFile(sessionId, file.path, controller.signal);
		              if (after.length > MAX_COUNT_CHARS) return;
		              next[file.path] = countChangedLines(before, after);
		            } catch (error) {
		              if (controller.signal.aborted) return;
		              const known = error !== null && error !== undefined;
		              if (known && error.missing === true) {
		                // A vanished path reads as "everything deleted", like the pane.
		                const before = bases.current.get(key);
		                next[file.path] =
		                  typeof before === "string"
		                    ? { added: 0, deleted: lineCount(before), missing: true }
		                    : { missing: true };
		              } else if (known && error.binary === true) {
		                next[file.path] = { binary: true };
		              } else if (known && error.oversized === true) {
		                next[file.path] = { oversized: true };
		              }
		              // No pre-image or an unreadable path: leave the row without numbers.
		            }
		          }),
		        );
		        if (live && !controller.signal.aborted) setCounts(next);
		      })();

		      return () => {
		        live = false;
		        controller.abort();
		      };
		    }, [sessionId, files, nonce, baseVersion]);

		    return counts;
		  }

		  /**
		   * The Session's changed-file list and the refresh counter that reloads it. There is
		   * no per-turn data: the Host lists the files whose pre-image it captured.
		   *
		   * @param input - `{ sessionId, visible }`.
		   * @returns `{ state, nonce, refresh }`.
		   */
		  function useFileList({ sessionId, visible }) {
		    const [state, setState] = react.useState({ phase: "loading", files: [] });
		    const [nonce, setNonce] = react.useState(0);

		    react.useEffect(() => {
		      if (visible === false) return undefined;
		      if (typeof sessionId !== "string" || sessionId === "") {
		        setState({ phase: "ready", files: [] });
		        return undefined;
		      }
		      let live = true;
		      const controller = new AbortController();
		      setState((previous) => ({
		        phase: previous.files.length === 0 ? "loading" : "refreshing",
		        files: previous.files,
		      }));
		      readFiles(sessionId, controller.signal)
		        .then((files) => {
		          if (live) setState({ phase: "ready", files });
		        })
		        .catch(() => {
		          if (!live || controller.signal.aborted) return;
		          setState({ phase: "error", files: [] });
		        });
		      return () => {
		        live = false;
		        controller.abort();
		      };
		    }, [sessionId, nonce, visible]);

		    /** Reload the list (and, with it, every comparison). */
		    const refresh = () => setNonce((value) => value + 1);

		    return { state, nonce, refresh };
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
		   * @param input - `{ rows, selectedPath, setSelectedPath }`.
		   */
		  function useSelection({ rows, selectedPath, setSelectedPath }) {
		    react.useEffect(() => {
		      if (rows.length === 0) {
		        if (selectedPath !== null) setSelectedPath(null);
		        return;
		      }
		      if (selectedPath !== null && rows.some((row) => row.path === selectedPath)) return;
		      setSelectedPath(rows[0].path);
		    }, [rows, selectedPath]);
		  }

		  /**
		   * The selected file's current text, read from the disk every time the list or the
		   * comparison refreshes.
		   *
		   * A path that is gone from the disk becomes `phase: "missing"`, which the
		   * comparison reads as "deleted" rather than "unreadable"; a binary or oversized
		   * file gets its own phase so the pane can say so.
		   *
		   * @param input - `{ sessionId, path, nonce }`.
		   * @returns the whole-file state, or undefined before anything was read.
		   */
		  function useWholeFile({ sessionId, path, nonce }) {
		    const [state, setState] = react.useState(undefined);
		    react.useEffect(() => {
		      if (path === null) return undefined;
		      if (typeof sessionId !== "string" || sessionId === "") return undefined;
		      let live = true;
		      const controller = new AbortController();
		      setState({ phase: "loading" });
		      readWholeFile(sessionId, path, controller.signal)
		        .then((text) => {
		          if (live) setState({ phase: "ready", text });
		        })
		        .catch((error) => {
		          if (!live || controller.signal.aborted) return;
		          // The file is gone from the disk: that is a deleted comparison, not a read failure.
		          if (error !== null && error !== undefined && error.missing === true)
		            setState({ phase: "missing" });
		          else if (error !== null && error !== undefined && error.binary === true)
		            setState({ phase: "binary" });
		          else if (error !== null && error !== undefined && error.oversized === true)
		            setState({ phase: "oversized" });
		          else setState({ phase: "error", detail: error instanceof Error ? error.message : "" });
		        });
		      return () => {
		        live = false;
		        controller.abort();
		      };
		    }, [sessionId, path, nonce]);
		    return state;
		  }

		  /** English copy. Keys are shared with {@link ./zh.js}. */
		  const en = {
		    title: "Session changes",
		    guideTitle: "Changes",
		    guideDescription: "Every file this Session changed, since it started",
		    shortcutOpen: "Open Session changes",
		    shortcutNoSession: "Select a session first",
		    empty: "No file changes recorded in this Session yet.",
		    reverted: "Every change in this Session has been edited back to where it started.",
		    loading: "Reading changes…",
		    error: "Could not read this Session's changes.",
		    retry: "Retry",
		    refresh: "Refresh",
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
		    layoutInline: "Switch to the inline layout",
		    layoutSplit: "Switch to the side-by-side layout",
		    layoutInlineShort: "Inline",
		    layoutSplitShort: "Split",
		    acceptShort: "Accept",
		    revertShort: "Revert",
		    acceptChange: "Accept this change into the baseline",
		    revertChange: "Revert this change on disk",
		    applyFailed: "Could not apply that change.",
		    applyConflict: "The file changed after this diff was drawn; it has been re-read. Try again.",
		    wholeShort: "Full",
		    wholeOn: "Show the whole file, marking the changes",
		    wholeOff: "Back to the changed hunks only",
		    wholeError: "Could not read the file from the Host.",
		    overallNoBase:
		      "No pre-image was recorded for this file, so there is no baseline to compare against.",
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
		   * Splice one change block into a full text: replace `count` lines starting at the
		   * 0-based `start` with the block's lines from the other side. Both sides of the
		   * comparison are read as `text.split("\n")`, which round-trips exactly, so a
		   * trailing newline survives an accept or a revert.
		   *
		   * @param text - the full side text to patch.
		   * @param start - 0-based index of the first replaced line.
		   * @param count - how many lines to replace (0 for a pure insertion).
		   * @param lines - the replacement lines.
		   * @returns the patched text.
		   */
		  function spliceLines(text, start, count, lines) {
		    const list = text === "" ? [] : text.split("\n");
		    list.splice(start, count, ...lines);
		    return list.join("\n");
		  }

		  /**
		   * SHA-256 of a text as lowercase hex, the fingerprint the Host compares before it
		   * replaces a side. A browser without WebCrypto yields null, which tells the Host to
		   * skip the stale-view check rather than refuse every action.
		   *
		   * @param text - the text the browser last read.
		   * @returns the digest, or null when WebCrypto is unavailable.
		   */
		  async function hashText(text) {
		    const subtle = globalThis.crypto === undefined ? undefined : globalThis.crypto.subtle;
		    if (subtle === undefined || subtle === null) return null;
		    const bytes = new TextEncoder().encode(text);
		    const digest = await subtle.digest("SHA-256", bytes);
		    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
		  }

		  /**
		   * Master list on the left, the selected file's comparison on the right, one
		   * draggable divider. Every row answers the same question — what changed since this
		   * task started — so the pane always diffs the Session's first pre-image against the
		   * file as it stands now.
		   *
		   * Each change block in the comparison can be accepted (folded into the stored
		   * pre-image) or reverted (the pre-image's lines written back to the live file). The
		   * block's new full text is computed here from the two texts the pane already read,
		   * and the Host writes it only when its digest still matches, so an action cannot
		   * clobber an edit that landed after the diff was drawn.
		   *
		   * @param props - `{ t, sessionId, tab }` from the sidebar tab system.
		   */
		  function ChangesTab(props) {
		    const t = typeof props.t === "function" ? props.t : fallback;
		    const sessionId = props.sessionId;
		    const visible = props.tab === undefined ? true : props.tab.visible !== false;

		    const [selectedPath, setSelectedPath] = react.useState(null);
		    const [wrap, setWrap] = react.useState(readWrap);
		    const [whole, setWhole] = react.useState(readWhole);
		    const [layout, setLayout] = react.useState(readLayout);
		    const [opening, setOpening] = react.useState(false);
		    const [openFailed, setOpenFailed] = react.useState(false);
		    const [busyKey, setBusyKey] = react.useState(null);
		    const [actionError, setActionError] = react.useState(null);
		    const [baseVersion, setBaseVersion] = react.useState(0);

		    const { rootRef, left, dragging, startDrag, nudge } = useResizable();
		    const list = useFileList({ sessionId, visible });
		    const counts = useFileCounts({
		      sessionId,
		      files: list.state.files,
		      nonce: list.nonce,
		      baseVersion,
		    });

		    /** Re-read the list and both sides of the comparison. */
		    const refreshAll = () => list.refresh();

		    // The Host streams each invalidation; a 1s quiet period folds a save burst into
		    // one re-read of the list and the open comparison.
		    useAutoRefresh({ sessionId, visible, refresh: refreshAll });

		    const rows = buildRows(list.state.files, counts);
		    useSelection({ rows, selectedPath, setSelectedPath });
		    const selected =
		      selectedPath === null ? null : (rows.find((row) => row.path === selectedPath) ?? null);
		    const baseState = useBase({ sessionId, path: selectedPath, nonce: list.nonce });
		    const wholeState = useWholeFile({ sessionId, path: selectedPath, nonce: list.nonce });
		    const comparison = useComparison({ selected, wholeState, baseState });

		    // A different file has different blocks; a stale failure message would not apply.
		    react.useEffect(() => {
		      setActionError(null);
		    }, [selectedPath]);

		    const totals = rows.reduce(
		      (sum, row) => ({
		        added: sum.added + (row.added ?? 0),
		        deleted: sum.deleted + (row.deleted ?? 0),
		      }),
		      { added: 0, deleted: 0 },
		    );

		    const toggleWrap = () => {
		      setWrap((value) => {
		        writeStored(WRAP_KEY, value === true ? "false" : "true");
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

		    const toggleWhole = () => {
		      setWhole((value) => {
		        writeStored(WHOLE_KEY, value === true ? "false" : "true");
		        return value !== true;
		      });
		    };

		    /** Ask the Host desktop to open the selected file in its default application. */
		    const openInApp = () => {
		      if (selectedPath === null || opening) return;
		      setOpening(true);
		      setOpenFailed(false);
		      requestOpen(sessionId, selectedPath)
		        .catch(() => setOpenFailed(true))
		        .finally(() => setOpening(false));
		    };

		    /**
		     * Accept or revert one change block. Accept replaces the block's old range in the
		     * stored pre-image with its added lines; revert replaces the block's new range in
		     * the live file with its deleted lines.
		     *
		     * @param action - `accept` or `revert`.
		     * @param block - the change block the buttons belong to.
		     */
		    const applyBlock = (action, block) => {
		      if (busyKey !== null || selectedPath === null) return;
		      const side = action === "accept" ? baseState : wholeState;
		      if (side === undefined || side === null) return;
		      const source =
		        side.phase === "ready"
		          ? side.absent === true
		            ? ""
		            : side.text
		          : side.phase === "missing"
		            ? ""
		            : null;
		      if (source === null) return;
		      const start = action === "accept" ? block.oldStart : block.newStart;
		      const count = action === "accept" ? block.oldLines : block.newLines;
		      const lines = action === "accept" ? block.added : block.deleted;
		      const text = spliceLines(source, start - 1, count, lines);
		      setBusyKey(block.key);
		      setActionError(null);
		      hashText(source)
		        .then((expect) => requestApply({ sessionId, path: selectedPath, action, text, expect }))
		        .then(() => {
		          // The pre-image changed: the row counts' cached copy of it is stale too.
		          if (action === "accept") setBaseVersion((value) => value + 1);
		          refreshAll();
		        })
		        .catch((error) => {
		          const conflict = error !== null && error !== undefined && error.conflict === true;
		          setActionError(conflict === true ? t("applyConflict") : t("applyFailed"));
		          // Either way the pane should show the text the Host actually holds now.
		          refreshAll();
		        })
		        .finally(() => setBusyKey(null));
		    };

		    const listRows = buildListRows({
		      rows,
		      selectedPath,
		      t,
		      onSelect: setSelectedPath,
		    });

		    return h("div", { className: "dsc-root", "data-session-changes": true, ref: rootRef }, [
		      h(ListPane, {
		        t,
		        state: list.state,
		        totals,
		        rows: listRows,
		        busy: list.state.phase === "loading",
		        left,
		        reverted: rows.length === 0 && list.state.files.length > 0,
		        onRefresh: refreshAll,
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
		        selected,
		        layout,
		        whole,
		        wrap,
		        opening,
		        openFailed,
		        comparison,
		        baseState,
		        busy: busyKey !== null,
		        actionError,
		        onAction: applyBlock,
		        onToggleLayout: toggleLayout,
		        onToggleWhole: toggleWhole,
		        onOpenFile: openInApp,
		        onToggleWrap: toggleWrap,
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
		    guideDescription: "本次会话开始以来改过的每个文件",
		    shortcutOpen: "打开会话改动",
		    shortcutNoSession: "请先选择会话",
		    empty: "本次会话还没有改动记录。",
		    reverted: "本次会话的改动都已被改回原样。",
		    loading: "正在读取改动…",
		    error: "读取本次会话的改动失败。",
		    retry: "重试",
		    refresh: "刷新",
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
		    layoutInline: "切换为单栏",
		    layoutSplit: "切换为左右对比",
		    layoutInlineShort: "单栏",
		    layoutSplitShort: "左右",
		    acceptShort: "接受",
		    revertShort: "还原",
		    acceptChange: "接受这处改动，写回对比基线",
		    revertChange: "还原这处改动，写回原文件",
		    applyFailed: "无法应用这处改动。",
		    applyConflict: "对比打开后文件又被改动，已重新读取，请再试一次。",
		    wholeShort: "整",
		    wholeOn: "显示整个文件并标出改动",
		    wholeOff: "只看改动的片段",
		    wholeError: "无法从 Host 读取该文件。",
		    overallNoBase: "这个文件没有记录首次改动前的快照，没有可比对的起点。",
		    resize: "调整文件列表宽度",
		  };

		  const css = ".dsc-root {\n  box-sizing: border-box;\n  width: 100%;\n  height: 100%;\n  min-height: 0;\n  display: flex;\n  overflow: hidden;\n  color: var(--dsw-alias-label-primary);\n  background: var(--dsw-alias-bg-layer-1);\n  font-size: 13px;\n}\n.dsc-pane {\n  box-sizing: border-box;\n  min-height: 0;\n  display: flex;\n  flex-direction: column;\n}\n.dsc-left {\n  flex: 0 0 auto;\n  min-width: 0;\n}\n.dsc-right {\n  flex: 1 1 auto;\n  min-width: 160px;\n  border-left: 0;\n}\n.dsc-head {\n  box-sizing: border-box;\n  flex: none;\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  height: 38px;\n  padding: 0 8px;\n  border-bottom: 0.5px solid var(--dsw-alias-border-l2);\n}\n.dsc-title {\n  flex: 1;\n  min-width: 0;\n  font-weight: 500;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n.dsc-stat {\n  flex: none;\n  display: flex;\n  gap: 6px;\n  font-family: var(--ds-font-family-code);\n  font-size: 11px;\n  color: var(--dsw-alias-label-tertiary);\n}\n.dsc-btn {\n  flex: none;\n  font: inherit;\n  color: var(--dsw-alias-label-secondary);\n  background: transparent;\n  border: 0;\n  border-radius: 6px;\n  padding: 4px 6px;\n  cursor: pointer;\n}\n.dsc-btn:hover:not(:disabled) {\n  background: var(--dsw-alias-interactive-bg-hover);\n}\n.dsc-btn:disabled {\n  cursor: progress;\n  opacity: 0.5;\n}\n.dsc-body {\n  flex: auto;\n  min-height: 0;\n  overflow: auto;\n  padding: 2px 0 14px;\n}\n.dsc-turn {\n  position: sticky;\n  top: 0;\n  z-index: 2;\n  display: flex;\n  justify-content: space-between;\n  gap: 8px;\n  padding: 5px 10px;\n  font-size: 11px;\n  font-weight: 500;\n  line-height: 16px;\n  color: var(--dsw-alias-label-secondary);\n  background: var(--dsw-static-neutral-50, #f4f4f5);\n  border-bottom: 0.5px solid var(--dsw-alias-border-l2);\n}\nbody[data-ds-dark-theme] .dsc-turn {\n  background: var(--dsw-static-neutral-850, #27272a);\n}\n.dsc-row {\n  box-sizing: border-box;\n  width: 100%;\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  min-height: 24px;\n  padding: 4px 10px;\n  border: 0;\n  background: transparent;\n  color: inherit;\n  font: inherit;\n  text-align: left;\n  cursor: pointer;\n}\n.dsc-row[data-nested=\"true\"] {\n  padding-left: 18px;\n}\n.dsc-folder {\n  display: block;\n  padding: 6px 10px 2px 10px;\n  font-family: var(--ds-font-family-code);\n  font-size: 11px;\n  line-height: 16px;\n  color: var(--dsw-alias-label-tertiary);\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n.dsc-row:hover,\n.dsc-row:focus-visible {\n  background: var(--dsw-alias-interactive-bg-hover);\n  outline: none;\n}\n.dsc-row[data-selected=\"true\"] {\n  background: var(--dsw-alias-interactive-bg-selected, var(--dsw-alias-interactive-bg-hover));\n}\n.dsc-row[data-missing=\"true\"] .dsc-path {\n  text-decoration: line-through;\n  color: var(--dsw-alias-state-error-primary, #cf222e);\n}\n.dsc-row[data-missing=\"true\"] .dsc-counts {\n  opacity: 0.45;\n}\n.dsc-row[data-missing=\"true\"]:hover .dsc-path,\n.dsc-row[data-missing=\"true\"]:focus-visible .dsc-path {\n  color: var(--dsw-alias-state-error-primary, #cf222e);\n}\n.dsc-path {\n  flex: 1;\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n.dsc-counts {\n  flex: none;\n  display: flex;\n  gap: 6px;\n  font-family: var(--ds-font-family-code);\n  font-size: 11px;\n}\n.dsc-add {\n  color: var(--dsw-alias-state-success-primary, #2da44e);\n}\n.dsc-del {\n  color: var(--dsw-alias-state-error-primary, #cf222e);\n}\n.dsc-muted {\n  color: var(--dsw-alias-label-tertiary);\n}\n.dsc-note {\n  display: flex;\n  align-items: center;\n  gap: 12px;\n  padding: 16px;\n  font-size: 13px;\n  color: var(--dsw-alias-label-secondary);\n}\n.dsc-divider {\n  flex: 0 0 6px;\n  position: relative;\n  cursor: col-resize;\n  background: transparent;\n  touch-action: none;\n  outline: none;\n}\n.dsc-divider::after {\n  content: \"\";\n  position: absolute;\n  top: 0;\n  bottom: 0;\n  left: 2.75px;\n  width: 0.5px;\n  background: var(--dsw-alias-border-l2);\n}\n.dsc-divider:hover::after,\n.dsc-divider:focus-visible::after,\n.dsc-divider[data-dragging=\"true\"]::after {\n  left: 2px;\n  width: 1px;\n  background: var(--dsw-alias-state-business-primary, #3b82f6);\n}\n.dsc-dhead {\n  box-sizing: border-box;\n  flex: none;\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  height: 38px;\n  padding: 0 8px 0 10px;\n  border-bottom: 0.5px solid var(--dsw-alias-border-l2);\n}\n.dsc-dpath {\n  flex: 1;\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  font-size: 12px;\n}\n.dsc-dbody {\n  flex: auto;\n  min-height: 0;\n  overflow: auto;\n  display: flex;\n  flex-direction: column;\n  font-family: var(--ds-font-family-code);\n  font-size: 12px;\n  line-height: 20px;\n  padding-bottom: 12px;\n}\n.dsc-dgrid {\n  display: grid;\n  grid-template-columns: max-content max-content;\n  min-width: 100%;\n  align-content: start;\n}\n.dsc-dgrid[data-wrap=\"true\"] {\n  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);\n}\n.dsc-cell {\n  display: flex;\n  min-width: 0;\n  box-sizing: border-box;\n}\n.dsc-cright {\n  border-left: 0.5px solid var(--dsw-alias-border-l2);\n}\n.dsc-lno {\n  flex: none;\n  width: 3.6em;\n  padding-right: 8px;\n  text-align: right;\n  color: var(--dsw-alias-label-tertiary);\n  user-select: none;\n  font-size: 11px;\n}\n.dsc-code {\n  white-space: pre;\n  padding-right: 12px;\n  min-width: 0;\n}\n.dsc-dgrid[data-wrap=\"true\"] .dsc-code {\n  white-space: pre-wrap;\n  word-break: break-word;\n  overflow-wrap: anywhere;\n}\n.dsc-cell[data-kind=\"del\"] {\n  background: rgba(207, 34, 46, 0.06);\n  background: color-mix(in srgb, var(--dsw-alias-state-error-primary, #cf222e) 8%, transparent);\n  box-shadow: inset 2px 0 0 var(--dsw-alias-state-error-primary, #cf222e);\n}\n.dsc-cell[data-kind=\"add\"] {\n  background: rgba(45, 164, 78, 0.06);\n  background: color-mix(in srgb, var(--dsw-alias-state-success-primary, #2da44e) 8%, transparent);\n  box-shadow: inset 2px 0 0 var(--dsw-alias-state-success-primary, #2da44e);\n}\n.dsc-cell[data-kind=\"pad\"] {\n  background: color-mix(in srgb, var(--dsw-alias-interactive-bg-hover) 45%, transparent);\n}\n.dsc-cell[data-kind=\"del\"] .dsc-lno {\n  color: var(--dsw-alias-state-error-primary, #cf222e);\n}\n.dsc-cell[data-kind=\"add\"] .dsc-lno {\n  color: var(--dsw-alias-state-success-primary, #2da44e);\n}\n.dsc-hunk {\n  grid-column: 1/-1;\n  min-width: max-content;\n  padding: 2px 10px;\n  color: var(--dsw-alias-label-tertiary);\n  background: color-mix(in srgb, var(--dsw-alias-interactive-bg-hover) 40%, transparent);\n  white-space: pre;\n  font-size: 11px;\n}\n.dsc-dnote {\n  grid-column: 1/-1;\n  padding: 6px 10px;\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 11px;\n  white-space: pre-wrap;\n}\n.dsc-modes {\n  flex: none;\n  display: flex;\n  gap: 2px;\n  padding: 4px 6px;\n  border-bottom: 0.5px solid var(--dsw-alias-border-l2);\n}\n.dsc-mode {\n  flex: 1;\n  min-width: 0;\n  font: inherit;\n  font-size: 11px;\n  line-height: 18px;\n  padding: 2px 6px;\n  border: 0;\n  border-radius: 6px;\n  background: transparent;\n  color: var(--dsw-alias-label-secondary);\n  cursor: pointer;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n.dsc-mode:hover {\n  background: var(--dsw-alias-interactive-bg-hover);\n}\n.dsc-mode[data-active=\"true\"] {\n  background: var(--dsw-alias-interactive-bg-selected, var(--dsw-alias-interactive-bg-hover));\n  color: var(--dsw-alias-label-primary);\n  font-weight: 500;\n}\n.dsc-dstack {\n  flex: auto;\n  min-height: 0;\n  overflow: auto;\n  padding-bottom: 12px;\n}\n.dsc-section + .dsc-section {\n  border-top: 0.5px solid var(--dsw-alias-border-l2);\n}\n.dsc-shead {\n  position: sticky;\n  top: 0;\n  z-index: 2;\n  padding: 4px 10px;\n  font-size: 11px;\n  font-weight: 500;\n  color: var(--dsw-alias-label-secondary);\n  background: var(--dsw-static-neutral-50, #f4f4f5);\n  border-bottom: 0.5px solid var(--dsw-alias-border-l2);\n}\nbody[data-ds-dark-theme] .dsc-shead {\n  background: var(--dsw-static-neutral-850, #27272a);\n}\n.dsc-lanes {\n  flex: 1 1 auto;\n  min-height: 0;\n  display: flex;\n}\n.dsc-lane {\n  flex: 1 1 50%;\n  min-width: 0;\n  overflow: auto;\n  box-sizing: border-box;\n  padding-bottom: 8px;\n}\n.dsc-lane + .dsc-lane {\n  border-left: 0.5px solid var(--dsw-alias-border-l2);\n}\n.dsc-lane-left {\n  scrollbar-width: none;\n}\n.dsc-lane-left::-webkit-scrollbar {\n  display: none;\n  width: 0;\n  height: 0;\n}\n.dsc-lrow {\n  display: flex;\n  width: 100%;\n  min-width: max-content;\n  height: 20px;\n}\n.dsc-lrow[data-kind=\"del\"] {\n  background: rgba(207, 34, 46, 0.06);\n  background: color-mix(in srgb, var(--dsw-alias-state-error-primary, #cf222e) 8%, transparent);\n  box-shadow: inset 2px 0 0 var(--dsw-alias-state-error-primary, #cf222e);\n}\n.dsc-lrow[data-kind=\"add\"] {\n  background: rgba(45, 164, 78, 0.06);\n  background: color-mix(in srgb, var(--dsw-alias-state-success-primary, #2da44e) 8%, transparent);\n  box-shadow: inset 2px 0 0 var(--dsw-alias-state-success-primary, #2da44e);\n}\n.dsc-lrow[data-kind=\"pad\"] {\n  background: color-mix(in srgb, var(--dsw-alias-interactive-bg-hover) 45%, transparent);\n}\n.dsc-lrow[data-kind=\"del\"] .dsc-lno,\n.dsc-lrow[data-kind=\"del\"] .dsc-lsign {\n  color: var(--dsw-alias-state-error-primary, #cf222e);\n}\n.dsc-lrow[data-kind=\"add\"] .dsc-lno,\n.dsc-lrow[data-kind=\"add\"] .dsc-lsign {\n  color: var(--dsw-alias-state-success-primary, #2da44e);\n}\n.dsc-lsign {\n  flex: none;\n  width: 1.4em;\n  text-align: center;\n  color: var(--dsw-alias-label-tertiary);\n  user-select: none;\n  font-size: 11px;\n}\n.dsc-dnotes {\n  flex: none;\n  display: flex;\n  flex-direction: column;\n  padding: 2px 0;\n}\n.dsc-chips {\n  flex: none;\n  display: flex;\n  gap: 4px;\n  padding: 4px 8px;\n  border-bottom: 0.5px solid var(--dsw-alias-border-l2);\n  overflow-x: auto;\n}\n.dsc-turnstrip {\n  flex: none;\n  display: flex;\n  gap: 3px;\n  padding: 4px 6px;\n  overflow-x: auto;\n  border-bottom: 0.5px solid var(--dsw-alias-border-l2);\n  scrollbar-width: thin;\n}\n.dsc-chip {\n  flex: none;\n  font: inherit;\n  font-size: 11px;\n  line-height: 16px;\n  padding: 2px 8px;\n  border: 0;\n  border-radius: 999px;\n  background: var(--dsw-alias-interactive-bg-hover);\n  color: var(--dsw-alias-label-secondary);\n  cursor: pointer;\n}\n.dsc-chip:disabled {\n  opacity: 0.4;\n  cursor: default;\n}\n.dsc-chip[data-active=\"true\"] {\n  background: var(--dsw-alias-interactive-bg-selected, var(--dsw-alias-interactive-bg-hover));\n  color: var(--dsw-alias-label-primary);\n  font-weight: 500;\n}\n.dsc-file {\n  display: flex;\n  flex-direction: column;\n  min-width: max-content;\n}\n.dsc-unified {\n  display: flex;\n  flex-direction: column;\n  min-width: max-content;\n  font-family: var(--ds-font-family-code);\n  font-size: 12px;\n  line-height: 20px;\n}\n.dsc-wrap {\n  flex: auto;\n  min-height: 0;\n  display: flex;\n  flex-direction: column;\n}\n.dsc-wrap-body {\n  flex: auto;\n  min-height: 0;\n  display: flex;\n  flex-direction: column;\n}\n.dsc-urow {\n  display: grid;\n  grid-template-columns: 3.2em 3.2em 1.2em max-content;\n  min-width: 100%;\n}\n.dsc-unified[data-wrap=\"true\"] .dsc-urow {\n  grid-template-columns: 3.2em 3.2em 1.2em minmax(0, 1fr);\n}\n.dsc-urow[data-kind=\"del\"] {\n  background: rgba(207, 34, 46, 0.06);\n  background: color-mix(in srgb, var(--dsw-alias-state-error-primary, #cf222e) 8%, transparent);\n  box-shadow: inset 2px 0 0 var(--dsw-alias-state-error-primary, #cf222e);\n}\n.dsc-urow[data-kind=\"add\"] {\n  background: rgba(45, 164, 78, 0.06);\n  background: color-mix(in srgb, var(--dsw-alias-state-success-primary, #2da44e) 8%, transparent);\n  box-shadow: inset 2px 0 0 var(--dsw-alias-state-success-primary, #2da44e);\n}\n.dsc-urow[data-kind=\"del\"] .dsc-uno,\n.dsc-urow[data-kind=\"del\"] .dsc-usign {\n  color: var(--dsw-alias-state-error-primary, #cf222e);\n}\n.dsc-urow[data-kind=\"add\"] .dsc-uno,\n.dsc-urow[data-kind=\"add\"] .dsc-usign {\n  color: var(--dsw-alias-state-success-primary, #2da44e);\n}\n.dsc-uno {\n  text-align: right;\n  padding-right: 6px;\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 11px;\n}\n.dsc-usign {\n  text-align: center;\n  color: var(--dsw-alias-label-tertiary);\n}\n.dsc-btn[data-active=\"true\"] {\n  background: var(--dsw-alias-interactive-bg-selected, var(--dsw-alias-interactive-bg-hover));\n  color: var(--dsw-alias-label-primary);\n}\n.dsc-actions {\n  position: sticky;\n  right: 6px;\n  z-index: 3;\n  width: 0;\n  flex: none;\n  align-self: stretch;\n  margin-left: auto;\n  pointer-events: none;\n  opacity: 0;\n  transition: opacity 90ms ease;\n}\n.dsc-urow > .dsc-actions {\n  grid-column: 1 / -1;\n  grid-row: 1;\n  justify-self: end;\n  margin-left: 0;\n}\n.dsc-lrow:hover > .dsc-actions,\n.dsc-lrow:focus-within > .dsc-actions,\n.dsc-urow:hover > .dsc-actions,\n.dsc-urow:focus-within > .dsc-actions,\n.dsc-cell:hover > .dsc-actions,\n.dsc-cell:focus-within > .dsc-actions {\n  opacity: 1;\n  pointer-events: auto;\n}\n.dsc-actionbar {\n  position: absolute;\n  top: 50%;\n  right: 6px;\n  transform: translateY(-50%);\n  display: flex;\n  gap: 2px;\n  padding: 1px;\n  border: 0.5px solid var(--dsw-alias-border-l2);\n  border-radius: 6px;\n  background: var(--dsw-alias-bg-layer-1);\n  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.14);\n  white-space: nowrap;\n}\nbody[data-ds-dark-theme] .dsc-actionbar {\n  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.45);\n}\n.dsc-act {\n  font: inherit;\n  font-size: 11px;\n  line-height: 16px;\n  padding: 1px 6px;\n  border: 0;\n  border-radius: 4px;\n  background: transparent;\n  color: var(--dsw-alias-label-secondary);\n  cursor: pointer;\n}\n.dsc-act:hover:not(:disabled) {\n  background: var(--dsw-alias-interactive-bg-hover);\n  color: var(--dsw-alias-label-primary);\n}\n.dsc-act:disabled {\n  opacity: 0.5;\n  cursor: progress;\n}\n.dsc-act[data-action=\"accept\"] {\n  color: var(--dsw-alias-state-success-primary, #2da44e);\n}\n.dsc-act[data-action=\"revert\"] {\n  color: var(--dsw-alias-state-error-primary, #cf222e);\n}\n.dsc-actionnote {\n  color: var(--dsw-alias-state-error-primary, #cf222e);\n}\n";

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
		   * this directory is the real source: `pnpm run build` bundles it into
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
		              commandId: COMMAND_ID,
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
		    // Optional: the tab type and its body keep working in a client without the
		    // shortcut service, while a client that has one gets an editable command in
		    // the Keyboard shortcuts dialog (Mod+Alt+D by default).
		    ctx.inject(["shortcuts"], (ctx) => {
		      ctx.effect(
		        () =>
		          ctx.shortcuts.register({
		            id: COMMAND_ID,
		            label: () => t("shortcutOpen"),
		            aliases: ["session changes", "changes", "diff"],
		            defaults: {
		              "desktop:macos": { code: "KeyD", modifiers: ["primary", "alt"] },
		              "desktop:windows": { code: "KeyD", modifiers: ["primary", "alt"] },
		              "desktop:linux": { code: "KeyD", modifiers: ["primary", "alt"] },
		              "web:macos": { code: "KeyD", modifiers: ["primary", "alt"] },
		              "web:windows": { code: "KeyD", modifiers: ["primary", "alt"] },
		            },
		            regions: ["page", "editable", "terminal"],
		            modals: [],
		            resolve: ({ target: element }) => {
		              const target = ctx.sidebarRight.commandTarget(element);
		              if (target === undefined) {
		                return { status: "blocked", reason: t("shortcutNoSession") };
		              }
		              return {
		                status: "handled",
		                run: () => {
		                  ctx.sidebarRight.openTabFromTarget(KIND, target);
		                },
		              };
		            },
		          }),
		        "session-changes: shortcut",
		      );
		    });
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
