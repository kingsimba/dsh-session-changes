
window.__ModuleLoader__.load({
	id: "dsh-session-changes",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		const react = require("react");
		const h = react.createElement;
		/** The shared client primitives carry the Shiki-backed tokenizer the built-in review uses. */
		let primitives = null;
		try {
			primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		} catch (_error) {
			primitives = null;
		}
		const useCodeHighlighter = primitives === null || typeof primitives.useCodeHighlighter !== "function" ? null : primitives.useCodeHighlighter;
		const languageForPath = primitives === null || typeof primitives.languageForPath !== "function" ? null : primitives.languageForPath;

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
		/** Left pane width, remembered across tabs and reloads. */
		const WIDTH_KEY = "dsh-session-changes.left";
		const WRAP_KEY = "dsh-session-changes.wrap";
		const MODE_KEY = "dsh-session-changes.mode";
		const WHOLE_KEY = "dsh-session-changes.whole";
		const MIN_LEFT = 180;
		const MIN_RIGHT = 260;
		/** Rows drawn before the comparison says it stopped. */
		const ROW_CAP = 5000;

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
			created: "Created in this turn",
			deleted: "Deleted in this turn",
			same: "Both sides hold the same lines",
			coarse: "Line comparison timed out; shown as a whole-file replacement",
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
			wholeOn: "Whole file with this turn's changes marked",
			wholeOff: "Back to the changed hunks only",
			wholeLoading: "Reading the file…",
			wholeError: "Could not read the file from the Host.",
			overallDrift: "Could not rebuild the state this Session started from — the file changed outside the recorded turns.",
			resize: "Resize the file list"
		};
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
			created: "本轮新建的文件",
			deleted: "本轮删除的文件",
			same: "两侧内容相同",
			coarse: "逐行对比超时，按整个文件替换显示",
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
			wholeOn: "显示整个文件并标出本轮改动",
			wholeOff: "只看改动的片段",
			wholeLoading: "正在读取文件…",
			wholeError: "无法从 Host 读取该文件。",
			overallDrift: "无法还原会话开始时的内容——这个文件在会话之外被改动过。",
			resize: "调整文件列表宽度"
		};

		const css = ".dsc-root{box-sizing:border-box;width:100%;height:100%;min-height:0;display:flex;overflow:hidden;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);font-size:13px}.dsc-pane{box-sizing:border-box;min-height:0;display:flex;flex-direction:column}.dsc-left{flex:0 0 auto;min-width:0}.dsc-right{flex:1 1 auto;min-width:160px;border-left:0}.dsc-head{box-sizing:border-box;flex:none;display:flex;align-items:center;gap:8px;height:38px;padding:0 8px;border-bottom:.5px solid var(--dsw-alias-border-l2)}.dsc-title{flex:1;min-width:0;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dsc-stat{flex:none;display:flex;gap:6px;font-family:var(--ds-font-family-code);font-size:11px;color:var(--dsw-alias-label-tertiary)}.dsc-btn{flex:none;font:inherit;color:var(--dsw-alias-label-secondary);background:transparent;border:0;border-radius:6px;padding:4px 6px;cursor:pointer}.dsc-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.dsc-btn:disabled{cursor:progress;opacity:.5}.dsc-body{flex:auto;min-height:0;overflow:auto;padding:2px 0 14px}.dsc-turn{position:sticky;top:0;z-index:2;display:flex;justify-content:space-between;gap:8px;padding:5px 10px;font-size:11px;font-weight:500;line-height:16px;color:var(--dsw-alias-label-secondary);background:var(--dsw-static-neutral-50,#f4f4f5);border-bottom:.5px solid var(--dsw-alias-border-l2)}body[data-ds-dark-theme] .dsc-turn{background:var(--dsw-static-neutral-850,#27272a)}.dsc-row{box-sizing:border-box;width:100%;display:flex;align-items:center;gap:8px;min-height:24px;padding:4px 10px;border:0;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}.dsc-row[data-nested=true]{padding-left:18px}.dsc-folder{display:block;padding:6px 10px 2px 10px;font-family:var(--ds-font-family-code);font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dsc-row:hover,.dsc-row:focus-visible{background:var(--dsw-alias-interactive-bg-hover);outline:none}.dsc-row[data-selected=true]{background:var(--dsw-alias-interactive-bg-selected,var(--dsw-alias-interactive-bg-hover))}.dsc-path{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dsc-counts{flex:none;display:flex;gap:6px;font-family:var(--ds-font-family-code);font-size:11px}.dsc-add{color:var(--dsw-alias-state-success-primary,#2da44e)}.dsc-del{color:var(--dsw-alias-state-error-primary,#cf222e)}.dsc-muted{color:var(--dsw-alias-label-tertiary)}.dsc-note{display:flex;align-items:center;gap:12px;padding:16px;font-size:13px;color:var(--dsw-alias-label-secondary)}.dsc-divider{flex:0 0 6px;position:relative;cursor:col-resize;background:transparent;touch-action:none;outline:none}.dsc-divider::after{content:'';position:absolute;top:0;bottom:0;left:2.75px;width:.5px;background:var(--dsw-alias-border-l2)}.dsc-divider:hover::after,.dsc-divider:focus-visible::after,.dsc-divider[data-dragging=true]::after{left:2px;width:1px;background:var(--dsw-alias-state-business-primary,#3b82f6)}.dsc-dhead{box-sizing:border-box;flex:none;display:flex;align-items:center;gap:8px;height:38px;padding:0 8px 0 10px;border-bottom:.5px solid var(--dsw-alias-border-l2)}.dsc-dpath{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}.dsc-dbody{flex:auto;min-height:0;overflow:auto;display:flex;flex-direction:column;font-family:var(--ds-font-family-code);font-size:12px;line-height:20px;padding-bottom:12px}.dsc-dgrid{display:grid;grid-template-columns:max-content max-content;min-width:100%;align-content:start}.dsc-dgrid[data-wrap=true]{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.dsc-cell{display:flex;min-width:0;box-sizing:border-box}.dsc-cright{border-left:.5px solid var(--dsw-alias-border-l2)}.dsc-lno{flex:none;width:3.6em;padding-right:8px;text-align:right;color:var(--dsw-alias-label-tertiary);user-select:none;font-size:11px}.dsc-code{white-space:pre;padding-right:12px;min-width:0}.dsc-dgrid[data-wrap=true] .dsc-code{white-space:pre-wrap;word-break:break-word;overflow-wrap:anywhere}.dsc-cell[data-kind=del]{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#cf222e) 10%,transparent)}.dsc-cell[data-kind=add]{background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#2da44e) 10%,transparent)}.dsc-cell[data-kind=pad]{background:color-mix(in srgb,var(--dsw-alias-interactive-bg-hover) 45%,transparent)}.dsc-hunk{grid-column:1/-1;min-width:max-content;padding:2px 10px;color:var(--dsw-alias-label-tertiary);background:color-mix(in srgb,var(--dsw-alias-interactive-bg-hover) 40%,transparent);white-space:pre;font-size:11px}.dsc-dnote{grid-column:1/-1;padding:6px 10px;color:var(--dsw-alias-label-tertiary);font-size:11px;white-space:pre-wrap}.dsc-modes{flex:none;display:flex;gap:2px;padding:4px 6px;border-bottom:.5px solid var(--dsw-alias-border-l2)}.dsc-mode{flex:1;min-width:0;font:inherit;font-size:11px;line-height:18px;padding:2px 6px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dsc-mode:hover{background:var(--dsw-alias-interactive-bg-hover)}.dsc-mode[data-active=true]{background:var(--dsw-alias-interactive-bg-selected,var(--dsw-alias-interactive-bg-hover));color:var(--dsw-alias-label-primary);font-weight:500}.dsc-dstack{flex:auto;min-height:0;overflow:auto;padding-bottom:12px}.dsc-section+.dsc-section{border-top:.5px solid var(--dsw-alias-border-l2)}.dsc-shead{position:sticky;top:0;z-index:2;padding:4px 10px;font-size:11px;font-weight:500;color:var(--dsw-alias-label-secondary);background:var(--dsw-static-neutral-50,#f4f4f5);border-bottom:.5px solid var(--dsw-alias-border-l2)}body[data-ds-dark-theme] .dsc-shead{background:var(--dsw-static-neutral-850,#27272a)}.dsc-lanes{flex:1 1 auto;min-height:0;display:flex}.dsc-lane{flex:1 1 50%;min-width:0;overflow:auto;box-sizing:border-box;padding-bottom:8px}.dsc-lane+.dsc-lane{border-left:.5px solid var(--dsw-alias-border-l2)}.dsc-lane-left{scrollbar-width:none}.dsc-lane-left::-webkit-scrollbar{display:none;width:0;height:0}.dsc-lrow{display:flex;min-width:max-content;height:20px}.dsc-lrow[data-kind=del]{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#cf222e) 10%,transparent)}.dsc-lrow[data-kind=add]{background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#2da44e) 10%,transparent)}.dsc-lrow[data-kind=pad]{background:color-mix(in srgb,var(--dsw-alias-interactive-bg-hover) 45%,transparent)}.dsc-dnotes{flex:none;display:flex;flex-direction:column;padding:2px 0}.dsc-chips{flex:none;display:flex;gap:4px;padding:4px 8px;border-bottom:.5px solid var(--dsw-alias-border-l2);overflow-x:auto}.dsc-chip{flex:none;font:inherit;font-size:11px;line-height:16px;padding:2px 8px;border:0;border-radius:999px;background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary);cursor:pointer}.dsc-chip[data-active=true]{background:var(--dsw-alias-interactive-bg-selected,var(--dsw-alias-interactive-bg-hover));color:var(--dsw-alias-label-primary);font-weight:500}.dsc-file{display:flex;flex-direction:column;min-width:max-content}.dsc-btn[data-active=true]{background:var(--dsw-alias-interactive-bg-selected,var(--dsw-alias-interactive-bg-hover));color:var(--dsw-alias-label-primary)}";
		const tagId = "dsh-session-changes/list.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-session-changes";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}

		/** Read one persisted preference. */
		function readStored(key, fallback) {
			try {
				const value = window.localStorage.getItem(key);
				return value === null ? fallback : value;
			} catch (_error) {
				return fallback;
			}
		}

		/** Persist one preference, ignoring a storage refusal. */
		function writeStored(key, value) {
			try {
				window.localStorage.setItem(key, value);
			} catch (_error) {}
		}

		const storedWidth = Number(readStored(WIDTH_KEY, ""));
		const storedWrap = readStored(WRAP_KEY, "false") === "true";

		/** Fill `{name}` placeholders of one English entry; the fallback when no dictionary is bound. */
		function fallback(key, params) {
			const text = en[key] ?? key;
			return params === void 0 ? text : text.replace(/\{(\w+)\}/g, (whole, name) => params[name] ?? whole);
		}

		/** Table row counts, or the reason a file has none. */
		function Counts({ added, deleted, binary, oversized, t }) {
			if (binary === true) return h("span", { className: "dsc-counts dsc-muted" }, t("binary"));
			if (oversized === true) return h("span", { className: "dsc-counts dsc-muted" }, t("oversized"));
			return h("span", { className: "dsc-counts" }, [
				h("span", { className: "dsc-add", key: "a" }, "+" + String(added)),
				h("span", { className: "dsc-del", key: "d" }, "−" + String(deleted))
			]);
		}

		/** One file in the list: its name alone, the counts, and the selected state. */
		function FileRow({ file, name, index, selected, t, onSelect }) {
			return h("button", {
				type: "button",
				className: "dsc-row",
				title: file.path,
				"data-nested": "true",
				"data-selected": selected === true ? "true" : "false",
				"aria-current": selected === true ? "true" : void 0,
				"aria-label": t("open", { name: file.display }),
				onClick: () => onSelect(index)
			}, [
				h("span", { className: "dsc-path", key: "p" }, name === void 0 || name === "" ? file.display : name),
				h(Counts, {
					key: "c",
					added: file.added,
					deleted: file.deleted,
					binary: file.binary,
					oversized: file.oversized,
					t
				})
			]);
		}

		/**
		 * Number a hunk's lines: context lines count on both sides, deletions on the
		 * old side, additions on the new side.
		 * @param hunk - a served hunk.
		 * @returns the rows in order.
		 */
		function hunkRows(hunk) {
			let oldNo = hunk.oldStart;
			let newNo = hunk.newStart;
			return (Array.isArray(hunk.lines) ? hunk.lines : []).map((line) => {
				const text = line.slice(1);
				switch (line[0]) {
					case "+": return { kind: "add", old: void 0, new: newNo++, text };
					case "-": return { kind: "del", old: oldNo++, new: void 0, text };
					default: return { kind: "context", old: oldNo++, new: newNo++, text };
				}
			});
		}

		/**
		 * Pair a hunk's lines for the side-by-side view: each run of deletions is
		 * aligned with the run of additions that follows it, row by row, and context
		 * lines sit on both sides.
		 * @param hunk - a served hunk.
		 * @returns the paired rows in order.
		 */
		function splitRows(hunk) {
			const rows = [];
			let dels = [];
			let adds = [];
			const flush = () => {
				for (let at = 0; at < Math.max(dels.length, adds.length); at += 1) {
					const left = dels[at];
					const right = adds[at];
					rows.push({ ...left === void 0 ? {} : { left }, ...right === void 0 ? {} : { right } });
				}
				dels = [];
				adds = [];
			};
			for (const row of hunkRows(hunk)) {
				if (row.kind === "del") dels.push({ no: row.old, text: row.text, kind: "del" });
				else if (row.kind === "add") adds.push({ no: row.new, text: row.text, kind: "add" });
				else {
					flush();
					rows.push({
						left: { no: row.old, text: row.text, kind: "context" },
						right: { no: row.new, text: row.text, kind: "context" }
					});
				}
			}
			flush();
			return rows;
		}

		/**
		 * Tokenize one side of a hunk with the shared highlighter. Each side is
		 * highlighted on its own because the omitted source lines are unavailable,
		 * which is the same hunk-local pass the built-in review runs.
		 * @param rows - numbered hunk rows.
		 * @param side - which line numbers to keep.
		 * @param highlighter - the theme-bound highlighter.
		 * @returns a map from line number to spans, or undefined while unavailable.
		 */
		function highlightedSide(rows, side, highlighter) {
			const source = rows.flatMap((row) => {
				const no = row[side];
				return no === void 0 ? [] : [{ no, text: row.text }];
			});
			if (source.length === 0) return /* @__PURE__ */ new Map();
			const highlighted = highlighter(source.map((line) => line.text).join("\n"));
			if (highlighted === void 0) return void 0;
			return new Map(source.map((line, index) => [line.no, highlighted[index] ?? []]));
		}

		/** One cell's text, coloured by the shared highlighter when it produced spans. */
		function DiffText({ text, spans }) {
			if (spans === void 0) return h("span", { className: "dsc-code" }, text);
			return h("span", { className: "dsc-code" }, spans.map((span, index) => h("span", { style: span.style, key: index }, span.text)));
		}

		/** Both lanes of one row, tokens included. */
		function DiffCells({ row, marks, keyPrefix }) {
			const cells = [];
			for (const side of ["left", "right"]) {
				const cell = row[side];
				const kind = cell === void 0 ? "pad" : cell.kind === "context" ? "ctx" : side === "left" ? "del" : "add";
				const map = marks === void 0 ? void 0 : marks[side === "left" ? "old" : "new"];
				const spans = cell === void 0 || map === void 0 ? void 0 : map.get(cell.no);
				cells.push(h("div", { className: side === "right" ? "dsc-cell dsc-cright" : "dsc-cell", "data-kind": kind, key: keyPrefix + side }, [
					h("span", { className: "dsc-lno", key: "n" }, cell === void 0 ? "" : String(cell.no)),
					cell === void 0 ? h("span", { className: "dsc-code", key: "c" }) : h(DiffText, { key: "c", text: cell.text, spans })
				]));
			}
			return cells;
		}

		/** Keep two comparison lanes on the same scroll offsets without feeding events back. */
		function syncLanes(source, target, guard) {
			if (target === null || guard.current) return;
			guard.current = true;
			target.scrollTop = source.scrollTop;
			target.scrollLeft = source.scrollLeft;
			if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => {
				guard.current = false;
			});
			else guard.current = false;
		}

		/** The range header of one hunk. */
		function hunkLabel(hunk) {
			return "@@ -" + String(hunk.oldStart) + "," + String(hunk.oldLines) + " +" + String(hunk.newStart) + "," + String(hunk.newLines) + " @@";
		}

		/**
		 * The comparison of the selected file. Unwrapped draws two fixed 50% lanes that
		 * scroll in step, so long lines never move the split; wrapped draws one 50/50
		 * grid that wraps inside its own cells.
		 */
		function DiffPane({ state, wrap, t, onRetry }) {
			const data = state !== void 0 && state.phase === "ready" ? state.data : void 0;
			const text = data !== void 0 && data.kind === "text" ? data : void 0;
			const language = text !== void 0 && languageForPath !== null ? languageForPath(text.path) : void 0;
			const highlighter = useCodeHighlighter === null ? void 0 : useCodeHighlighter(language);
			const leftRef = react.useRef(null);
			const rightRef = react.useRef(null);
			const guard = react.useRef(false);
			const model = react.useMemo(() => {
				if (text === void 0) return null;
				const hunks = Array.isArray(text.hunks) ? text.hunks : [];
				let budget = ROW_CAP;
				const blocks = [];
				let truncated = false;
				for (const hunk of hunks) {
					if (budget <= 0) {
						truncated = true;
						break;
					}
					const kept = hunk.lines.length <= budget ? hunk : { ...hunk, lines: hunk.lines.slice(0, budget) };
					budget -= kept.lines.length;
					if (kept !== hunk) truncated = true;
					const numbered = hunkRows(kept);
					const rows = splitRows(kept);
					let marks;
					if (highlighter !== void 0) marks = {
						old: highlightedSide(numbered, "old", highlighter),
						new: highlightedSide(numbered, "new", highlighter)
					};
					blocks.push({ hunk: kept, rows, marks });
				}
				return { blocks, truncated };
			}, [text, highlighter]);

			if (state === void 0 || state.phase === "loading") return h("div", { className: "dsc-note" }, t("diffLoading"));
			if (state.phase === "error") {
				return h("div", { className: "dsc-note" }, [
					h("span", { key: "m" }, t("diffError")),
					h("button", { type: "button", className: "dsc-btn", key: "b", onClick: onRetry }, t("retry"))
				]);
			}
			if (data === void 0) return h("div", { className: "dsc-note" }, t("diffError"));
			if (data.kind === "binary") return h("div", { className: "dsc-note" }, t("diffBinary"));
			if (data.kind === "oversized") return h("div", { className: "dsc-note" }, t("diffOversized"));

			const notes = [];
			if (data.before !== true) notes.push(["created", t("created")]);
			if (data.after !== true) notes.push(["deleted", t("deleted")]);
			if (data.coarse === true) notes.push(["coarse", t("coarse")]);
			if (model === null || model.blocks.length === 0) notes.push(["same", t("same")]);
			const head = notes.length === 0 ? null : h("div", { className: "dsc-dnotes", key: "n" }, notes.map(([key, label]) => h("div", { className: "dsc-dnote", key }, label)));
			const truncation = model !== null && model.truncated ? h("div", { className: "dsc-dnote", key: "trunc" }, t("truncated", { count: String(ROW_CAP) })) : null;

			if (wrap === true) {
				const cells = [];
				if (model !== null) for (let at = 0; at < model.blocks.length; at += 1) {
					const block = model.blocks[at];
					cells.push(h("div", { className: "dsc-hunk", key: "h" + String(at) }, hunkLabel(block.hunk)));
					for (let rowAt = 0; rowAt < block.rows.length; rowAt += 1) {
						for (const cell of DiffCells({
							row: block.rows[rowAt],
							marks: block.marks,
							keyPrefix: String(at) + ":" + String(rowAt) + ":"
						})) cells.push(cell);
					}
				}
				return h("div", { className: "dsc-dbody" }, [
					head,
					h("div", { className: "dsc-dgrid", "data-wrap": "true", "data-spans": highlighter === void 0 ? "false" : "true", key: "g" }, cells),
					truncation
				]);
			}

			const lane = (side) => {
				const out = [];
				if (model === null) return out;
				for (let at = 0; at < model.blocks.length; at += 1) {
					const block = model.blocks[at];
					out.push(h("div", { className: "dsc-hunk", key: "h" + String(at) }, hunkLabel(block.hunk)));
					const map = block.marks === void 0 ? void 0 : block.marks[side === "left" ? "old" : "new"];
					for (let rowAt = 0; rowAt < block.rows.length; rowAt += 1) {
						const row = block.rows[rowAt];
						const cell = row[side];
						const spans = cell === void 0 || map === void 0 ? void 0 : map.get(cell.no);
						const kind = cell === void 0 ? "pad" : cell.kind === "context" ? "ctx" : side;
						out.push(h("div", { className: "dsc-lrow", "data-kind": kind, key: "r" + String(at) + ":" + String(rowAt) }, [
							h("span", { className: "dsc-lno", key: "n" }, cell === void 0 ? "" : String(cell.no)),
							cell === void 0 ? h("span", { className: "dsc-code", key: "c" }) : h(DiffText, { key: "c", text: cell.text, spans })
						]));
					}
				}
				return out;
			};

			return h("div", { className: "dsc-dbody" }, [
				head,
				h("div", { className: "dsc-lanes", key: "l" }, [
					h("div", {
						className: "dsc-lane dsc-lane-left",
						key: "left",
						ref: leftRef,
						onScroll: (event) => syncLanes(event.currentTarget, rightRef.current, guard)
					}, lane("left")),
					h("div", {
						className: "dsc-lane dsc-lane-right",
						key: "right",
						ref: rightRef,
						onScroll: (event) => syncLanes(event.currentTarget, leftRef.current, guard)
					}, lane("right"))
				]),
				truncation
			]);
		}



		/**
		 * Group one turn's files by their folder.
		 * @param files - the summary's file rows.
		 * @param entryOf - builds one file's review coordinates.
		 * @returns folder groups in first-seen order.
		 */
		function groupFiles(files, entryOf) {
			const folders = [];
			const byFolder = /* @__PURE__ */ new Map();
			for (let index = 0; index < files.length; index += 1) {
				const file = files[index];
				const segments = String(file.display).split(/[\\/]/);
				const name = segments.pop() ?? String(file.display);
				const folder = segments.join("/");
				let bucket = byFolder.get(folder);
				if (bucket === void 0) {
					bucket = [];
					byFolder.set(folder, bucket);
					folders.push(folder);
				}
				bucket.push({ file, name, entries: [entryOf(index)] });
			}
			return folders.map((folder) => ({ folder, files: byFolder.get(folder) }));
		}

		/**
		 * Fold every turn into one file list: one row per path, counts summed, and
		 * every turn that touched the file kept for the stacked comparison.
		 * @param turns - the Session's recorded turns, newest first.
		 * @returns the folder groups and the number of distinct files.
		 */
		function groupOverall(turns) {
			const byPath = /* @__PURE__ */ new Map();
			for (const turn of turns) {
				const files = Array.isArray(turn.files) ? turn.files : [];
				for (let index = 0; index < files.length; index += 1) {
					const file = files[index];
					let record = byPath.get(file.path);
					if (record === void 0) {
						const segments = String(file.display).split(/[\\/]/);
						const name = segments.pop() ?? String(file.display);
						record = { file, name, folder: segments.join("/"), added: 0, deleted: 0, entries: [] };
						byPath.set(file.path, record);
					}
					record.added += file.added;
					record.deleted += file.deleted;
					record.entries.push({ seq: turn.seq, turn: turn.turn, index });
				}
			}
			const folders = [];
			const byFolder = /* @__PURE__ */ new Map();
			for (const record of byPath.values()) {
				let bucket = byFolder.get(record.folder);
				if (bucket === void 0) {
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
						oversized: record.file.oversized
					},
					name: record.name,
					entries: record.entries
				});
			}
			return { folders: folders.map((folder) => ({ folder, files: byFolder.get(folder) })), count: byPath.size };
		}

		/** Cell budget for the line diff; past it the comparison degrades to a coarse note. */
		const DIFF_CELL_CAP = 1500000;

		/**
		 * Undo one turn's comparison on a file's text: each hunk's new-side range is
		 * replaced with its old-side lines, so the caller walks back to the state before
		 * the turn.
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
		 * Line-level diff of two texts: the common prefix and suffix are kept as context
		 * and only the middle is matched, so a large file with small edits stays cheap.
		 * @returns the ordered operations, or null when the middle is too large.
		 */
		function diffLines(before, after) {
			let pre = 0;
			while (pre < before.length && pre < after.length && before[pre] === after[pre]) pre += 1;
			let suf = 0;
			while (suf < before.length - pre && suf < after.length - pre && before[before.length - 1 - suf] === after[after.length - 1 - suf]) suf += 1;
			const head = before.slice(0, pre);
			const tail = before.slice(before.length - suf);
			const middleBefore = before.slice(pre, before.length - suf);
			const middleAfter = after.slice(pre, after.length - suf);
			const n = middleBefore.length;
			const m = middleAfter.length;
			if ((n + 1) * (m + 1) > DIFF_CELL_CAP) return null;
			const width = m + 1;
			const table = new Uint32Array((n + 1) * (m + 1));
			for (let i = n - 1; i >= 0; i -= 1) for (let j = m - 1; j >= 0; j -= 1) {
				table[i * width + j] = middleBefore[i] === middleAfter[j] ? table[(i + 1) * width + j + 1] + 1 : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
			}
			const ops = [];
			for (const line of head) ops.push({ op: " ", text: line });
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
			return ops;
		}

		/** Build one hunk from an operation range, numbering both sides from the range start. */
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

		/** Group operations into hunks with a little context around each change. */
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

		/** The Host route that serves one changed file's current text. */
		const FILE_ROUTE = "api/session-changes.file";

		/**
		 * Read one changed file's current text from this plugin's own Host route.
		 * @param sessionId - the viewed Session.
		 * @param seq - the announcing event, whose summary carries the working directory.
		 * @param path - the file's path as the summary spells it.
		 * @param signal - cancellation.
		 * @returns the file's text.
		 */
		async function readWholeFile(sessionId, seq, path, signal) {
			const query = "?" + new URLSearchParams({
				sessionId: String(sessionId),
				seq: String(seq),
				path: String(path)
			}).toString();
			const response = await fetch(FILE_ROUTE + query, {
				signal,
				headers: { accept: "application/json" },
				credentials: "same-origin"
			});
			if (!response.ok) {
				let reason = String(response.status);
				try {
					const refused = await response.json();
					if (refused !== null && typeof refused === "object" && typeof refused.error === "string") reason = refused.error;
				} catch (_error) {}
				throw new Error(reason);
			}
			const payload = await response.json();
			if (payload === null || typeof payload !== "object" || typeof payload.text !== "string") throw new Error("malformed");
			return payload.text;
		}

		/**
		 * The current file in full, tokenized once as a whole file, with the turn's
		 * added lines marked in place and its deletions drawn where they were removed.
		 */
		function WholeFilePane({ state, diff, t, onRetry }) {
			const path = diff !== void 0 && typeof diff.path === "string" ? diff.path : "";
			const language = languageForPath !== null ? languageForPath(path) : void 0;
			const highlighter = useCodeHighlighter === null ? void 0 : useCodeHighlighter(language);
			const model = react.useMemo(() => {
				if (state === void 0 || state.phase !== "ready") return null;
				const lines = String(state.text).split("\n");
				const body = String(state.text);
				const spans = highlighter === void 0 || body.length > 400000 ? void 0 : highlighter(body);
				const added = /* @__PURE__ */ new Set();
				const removed = /* @__PURE__ */ new Map();
				const hunks = diff !== void 0 && diff.kind === "text" && Array.isArray(diff.hunks) ? diff.hunks : [];
				for (const hunk of hunks) {
					let newNo = hunk.newStart;
					let pending = [];
					for (const line of hunk.lines) {
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
				return { lines, spans, added, removed };
			}, [state, diff, highlighter]);
			if (state === void 0 || state.phase === "loading") return h("div", { className: "dsc-note" }, t("wholeLoading"));
			if (state.phase === "error") return h("div", { className: "dsc-note" }, [
				h("span", { key: "m" }, state.detail === void 0 || state.detail === "" ? t("wholeError") : t("wholeError") + " · " + state.detail),
				h("button", { type: "button", className: "dsc-btn", key: "b", onClick: onRetry }, t("retry"))
			]);
			if (model === null) return h("div", { className: "dsc-note" }, t("wholeLoading"));
			const removedRow = (text, key) => h("div", { className: "dsc-lrow", "data-kind": "del", key }, [
				h("span", { className: "dsc-lno", key: "n" }, "−"),
				h("span", { className: "dsc-code", key: "c" }, text)
			]);
			const rows = [];
			for (let at = 1; at <= model.lines.length; at += 1) {
				const gone = model.removed.get(at);
				if (gone !== void 0) for (let g = 0; g < gone.length; g += 1) rows.push(removedRow(gone[g], "d" + String(at) + ":" + String(g)));
				const spans = model.spans === void 0 ? void 0 : model.spans[at - 1];
				rows.push(h("div", { className: "dsc-lrow", "data-kind": model.added.has(at) ? "add" : "ctx", key: "l" + String(at) }, [
					h("span", { className: "dsc-lno", key: "n" }, String(at)),
					h(DiffText, { key: "c", text: model.lines[at - 1], spans })
				]));
			}
			const tail = model.removed.get(model.lines.length + 1);
			if (tail !== void 0) for (let g = 0; g < tail.length; g += 1) rows.push(removedRow(tail[g], "t" + String(g)));
			return h("div", { className: "dsc-dbody" }, h("div", { className: "dsc-file", key: "f" }, rows));
		}

		/** Master list on the left, the selected file's comparison on the right, one draggable divider. */
		function ChangesTab(props) {
			const t = typeof props.t === "function" ? props.t : fallback;
			const sessionId = props.sessionId;
			const visible = props.tab === void 0 ? true : props.tab.visible !== false;
			const rootRef = react.useRef(null);
			const cache = react.useRef(/* @__PURE__ */ new Map());
			const dragRef = react.useRef(null);

			const [state, setState] = react.useState({ phase: "loading", turns: [] });
			const [nonce, setNonce] = react.useState(0);
			const [mode, setMode] = react.useState(readStored(MODE_KEY, "turn") === "overall" ? "overall" : "turn");
			const [selected, setSelected] = react.useState(null);
			const [diffs, setDiffs] = react.useState({});
			const [wrap, setWrap] = react.useState(storedWrap);
			const [left, setLeft] = react.useState(Number.isFinite(storedWidth) && storedWidth >= MIN_LEFT ? storedWidth : 220);
			const [dragging, setDragging] = react.useState(false);
			const [opening, setOpening] = react.useState(false);
			const [openFailed, setOpenFailed] = react.useState(false);
			const [entryIndex, setEntryIndex] = react.useState(0);
			const [whole, setWhole] = react.useState(readStored(WHOLE_KEY, "false") === "true");
			const [wholeState, setWholeState] = react.useState(void 0);
			const [wholeNonce, setWholeNonce] = react.useState(0);

			react.useEffect(() => {
				if (visible === false) return void 0;
				if (typeof sessionId !== "string" || sessionId === "") {
					setState({ phase: "ready", turns: [] });
					return void 0;
				}
				let live = true;
				const controller = new AbortController();
				setState((previous) => ({ phase: previous.turns.length === 0 ? "loading" : "refreshing", turns: previous.turns }));
				cache.current.clear();
				setDiffs({});
				const query = "?" + new URLSearchParams({ sessionId }).toString();
				fetch(LIST_ROUTE + query, {
					signal: controller.signal,
					headers: { accept: "application/json" },
					credentials: "same-origin"
				}).then((response) => {
					if (!response.ok) throw new Error(String(response.status));
					return response.json();
				}).then((payload) => {
					if (!live) return;
					const turns = payload !== null && typeof payload === "object" && Array.isArray(payload.turns) ? payload.turns : [];
					setState({ phase: "ready", turns });
				}).catch(() => {
					if (!live || controller.signal.aborted) return;
					setState({ phase: "error", turns: [] });
				});
				return () => {
					live = false;
					controller.abort();
				};
			}, [sessionId, nonce, visible]);

			const view = react.useMemo(() => {
				// Oldest turn first, so the list reads as a timeline.
				const turns = [...state.turns].reverse();
				if (mode === "overall") {
					let added = 0;
					let deleted = 0;
					for (const turn of turns) {
						added += turn.added;
						deleted += turn.deleted;
					}
					const folded = groupOverall(turns);
					return { groups: [{ turn: void 0, total: folded.count, folders: folded.folders }], added, deleted, files: folded.count };
				}
				return {
					groups: turns.map((turn) => ({
						turn: turn.turn,
						total: turn.total,
						folders: groupFiles(Array.isArray(turn.files) ? turn.files : [], (index) => ({ seq: turn.seq, turn: turn.turn, index }))
					})),
					added: turns.reduce((sum, turn) => sum + turn.added, 0),
					deleted: turns.reduce((sum, turn) => sum + turn.deleted, 0),
					files: turns.reduce((sum, turn) => sum + turn.total, 0)
				};
			}, [state.turns, mode]);

			/** The same file may carry several review coordinates; the turn mode keeps one. */
			const matches = (row) => {
				if (selected === null || selected.path !== row.file.path) return false;
				if (mode === "overall") return true;
				return selected.entries[0].seq === row.entries[0].seq && selected.entries[0].index === row.entries[0].index;
			};

			react.useEffect(() => {
				if (view.files === 0) {
					if (selected !== null) setSelected(null);
					return;
				}
				// Adopt the listed row, which also re-derives the turn list when the mode changed.
				const adopt = (row) => {
					const next = {
						path: row.file.path,
						display: row.file.display,
						added: row.file.added,
						deleted: row.file.deleted,
						binary: row.file.binary,
						oversized: row.file.oversized,
						entries: row.entries
					};
					const same = selected !== null && selected.path === next.path && selected.entries.length === next.entries.length && selected.entries.every((entry, at) => entry.seq === next.entries[at].seq && entry.index === next.entries[at].index);
					if (!same) {
						setSelected(next);
						setEntryIndex(0);
					}
				};
				for (const group of view.groups) for (const folder of group.folders) for (const row of folder.files) {
					if (selected !== null && selected.path === row.file.path) {
						adopt(row);
						return;
					}
				}
				for (const group of view.groups) for (const folder of group.folders) {
					if (folder.files.length === 0) continue;
					adopt(folder.files[0]);
					return;
				}
				setSelected(null);
			}, [view, mode]);

			react.useEffect(() => {
				if (selected === null || typeof sessionId !== "string" || sessionId === "") return void 0;
				let live = true;
				const controllers = [];
				for (const entry of selected.entries) {
					const key = String(entry.seq) + ":" + String(entry.index);
					if (cache.current.has(key)) {
						const cached = cache.current.get(key);
						setDiffs((previous) => previous[key] !== void 0 ? previous : { ...previous, [key]: { phase: "ready", data: cached } });
						continue;
					}
					const controller = new AbortController();
					controllers.push(controller);
					const query = "?" + new URLSearchParams({
						sessionId,
						seq: String(entry.seq),
						index: String(entry.index)
					}).toString();
					fetch(DIFF_ROUTE + query, {
						signal: controller.signal,
						headers: { accept: "application/json" },
						credentials: "same-origin"
					}).then((response) => {
						if (!response.ok) throw new Error(String(response.status));
						return response.json();
					}).then((payload) => {
						if (!live) return;
						cache.current.set(key, payload);
						setDiffs((previous) => ({ ...previous, [key]: { phase: "ready", data: payload } }));
					}).catch(() => {
						if (!live || controller.signal.aborted) return;
						setDiffs((previous) => ({ ...previous, [key]: { phase: "error" } }));
					});
				}
				return () => {
					live = false;
					for (const controller of controllers) controller.abort();
				};
			}, [selected, sessionId, nonce]);

			react.useEffect(() => {
				if ((whole !== true && mode !== "overall") || selected === null) return void 0;
				if (typeof sessionId !== "string" || sessionId === "") return void 0;
				const entry = selected.entries[Math.min(entryIndex, Math.max(0, selected.entries.length - 1))];
				if (entry === void 0) return void 0;
				let live = true;
				const controller = new AbortController();
				setWholeState({ phase: "loading" });
				readWholeFile(sessionId, entry.seq, selected.path, controller.signal).then((text) => {
					if (live) setWholeState({ phase: "ready", text });
				}).catch((error) => {
					if (live && !controller.signal.aborted) setWholeState({ phase: "error", detail: error instanceof Error ? error.message : "" });
				});
				return () => {
					live = false;
					controller.abort();
				};
			}, [whole, selected, wholeNonce, entryIndex, mode, sessionId]);

			const retry = (key, entry) => {
				cache.current.delete(key);
				setDiffs((previous) => {
					const next = { ...previous };
					delete next[key];
					return next;
				});
				const query = "?" + new URLSearchParams({
					sessionId: String(sessionId),
					seq: String(entry.seq),
					index: String(entry.index)
				}).toString();
				fetch(DIFF_ROUTE + query, { credentials: "same-origin", headers: { accept: "application/json" } }).then((response) => {
					if (!response.ok) throw new Error(String(response.status));
					return response.json();
				}).then((payload) => {
					cache.current.set(key, payload);
					setDiffs((previous) => ({ ...previous, [key]: { phase: "ready", data: payload } }));
				}).catch(() => setDiffs((previous) => ({ ...previous, [key]: { phase: "error" } })));
			};

			const clamp = (value) => {
				const box = rootRef.current;
				const width = box === null ? Number.POSITIVE_INFINITY : box.getBoundingClientRect().width;
				return Math.max(MIN_LEFT, Math.min(value, Math.max(MIN_LEFT, width - MIN_RIGHT)));
			};

			react.useEffect(() => {
				const box = rootRef.current;
				if (box === null || typeof ResizeObserver === "undefined") return void 0;
				const observer = new ResizeObserver(() => {
					const width = box.getBoundingClientRect().width;
					setLeft((value) => Math.min(value, Math.max(MIN_LEFT, width - MIN_RIGHT)));
				});
				observer.observe(box);
				return () => observer.disconnect();
			}, []);

			const startDrag = (event) => {
				if (event.button !== void 0 && event.button !== 0) return;
				const startX = event.clientX;
				const startWidth = left;
				dragRef.current = { startX, startWidth };
				setDragging(true);
				event.preventDefault();
				const move = (next) => setLeft(clamp(startWidth + (next.clientX - startX)));
				const stop = () => {
					window.removeEventListener("pointermove", move);
					window.removeEventListener("pointerup", stop);
					window.removeEventListener("pointercancel", stop);
					dragRef.current = null;
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
				if (event.key === "ArrowLeft") setLeft((value) => {
					const next = clamp(value - step);
					writeStored(WIDTH_KEY, String(next));
					return next;
				});
				else if (event.key === "ArrowRight") setLeft((value) => {
					const next = clamp(value + step);
					writeStored(WIDTH_KEY, String(next));
					return next;
				});
				else return;
				event.preventDefault();
			};

			const toggleWrap = () => {
				setWrap((value) => {
					writeStored(WRAP_KEY, value === true ? "false" : "true");
					return value !== true;
				});
			};

			const setModeAndStore = (next) => {
				writeStored(MODE_KEY, next);
				setMode(next);
			};

			const openReview = () => {
				if (selected === null) return;
				const entry = selected.entries[Math.min(entryIndex, Math.max(0, selected.entries.length - 1))];
				const address = REVIEW_PREFIX + encodeURIComponent(String(sessionId)) + "/" + String(entry.seq) + "/" + String(entry.turn);
				const actions = props.tab === void 0 ? void 0 : props.tab.actions;
				if (actions !== void 0 && typeof actions.openResource === "function") actions.openResource(address, { params: { index: entry.index } });
				else if (typeof openResource === "function") openResource(address, { params: { index: entry.index } });
			};

			const openInApp = () => {
				if (selected === null || opening) return;
				const entry = selected.entries[Math.min(entryIndex, Math.max(0, selected.entries.length - 1))];
				setOpening(true);
				setOpenFailed(false);
				const query = "?" + new URLSearchParams({
					sessionId: String(sessionId),
					seq: String(entry.seq),
					index: String(entry.index),
					action: "open"
				}).toString();
				fetch(OPEN_ROUTE + query, { method: "POST", credentials: "same-origin" }).then((response) => {
					if (!response.ok) throw new Error(String(response.status));
				}).catch(() => setOpenFailed(true)).finally(() => setOpening(false));
			};

			const rows = [];
			for (const group of view.groups) {
				if (group.turn !== void 0) rows.push(h("div", { className: "dsc-turn", key: "t" + String(group.turn) }, [
					h("span", { key: "l" }, t("turn", { turn: String(group.turn) })),
					h("span", { key: "c" }, group.total === 1 ? t("oneFile") : t("files", { count: String(group.total) }))
				]));
				for (const folder of group.folders) {
					const label = folder.folder === "" ? "./" : folder.folder + "/";
					rows.push(h("div", {
						className: "dsc-folder",
						key: "f" + String(group.turn) + ":" + folder.folder,
						title: label
					}, label));
					for (const row of folder.files) {
						rows.push(h(FileRow, {
							key: String(row.entries[0].seq) + ":" + String(row.entries[0].index) + ":" + row.file.path,
							file: row.file,
							name: row.name,
							index: row.entries[0].index,
							t,
							selected: matches(row),
							onSelect: () => {
								setEntryIndex(0);
								setSelected({
									path: row.file.path,
									display: row.file.display,
									added: row.file.added,
									deleted: row.file.deleted,
									binary: row.file.binary,
									oversized: row.file.oversized,
									entries: row.entries
								});
							}
						}));
					}
				}
			}

			const busy = state.phase === "loading";
			let listBody;
			if (state.phase === "loading") listBody = h("div", { className: "dsc-note" }, t("loading"));
			else if (state.phase === "error") listBody = h("div", { className: "dsc-note" }, [
				h("span", { key: "m" }, t("error")),
				h("button", { type: "button", className: "dsc-btn", key: "b", onClick: () => setNonce((value) => value + 1) }, t("retry"))
			]);
			else if (rows.length === 0) listBody = h("div", { className: "dsc-note" }, t("empty"));
			else listBody = h("div", { className: "dsc-body" }, rows);

			const leftPane = h("div", { className: "dsc-pane dsc-left", key: "l", style: { flex: "0 0 " + String(left) + "px" } }, [
				h("div", { className: "dsc-head", key: "h" }, [
					h("span", { className: "dsc-title", key: "t" }, t("title")),
					state.turns.length === 0 ? null : h("span", { className: "dsc-stat", key: "s" }, [
						h("span", { className: "dsc-add", key: "a" }, "+" + String(view.added)),
						h("span", { className: "dsc-del", key: "d" }, "−" + String(view.deleted))
					]),
					h("button", {
						type: "button",
						className: "dsc-btn",
						key: "r",
						title: t("refresh"),
						"aria-label": t("refresh"),
						disabled: busy,
						onClick: () => setNonce((value) => value + 1)
					}, "↻")
				]),
				h("div", { className: "dsc-modes", key: "m" }, [
					h("button", {
						type: "button",
						className: "dsc-mode",
						key: "t",
						"data-active": mode === "turn" ? "true" : "false",
						"aria-pressed": mode === "turn" ? "true" : "false",
						onClick: () => setModeAndStore("turn")
					}, t("modeTurn")),
					h("button", {
						type: "button",
						className: "dsc-mode",
						key: "o",
						"data-active": mode === "overall" ? "true" : "false",
						"aria-pressed": mode === "overall" ? "true" : "false",
						onClick: () => setModeAndStore("overall")
					}, t("modeOverall"))
				]),
				listBody
			]);

			const divider = h("div", {
				className: "dsc-divider",
				key: "d",
				role: "separator",
				tabIndex: 0,
				"aria-orientation": "vertical",
				"aria-label": t("resize"),
				"data-dragging": dragging === true ? "true" : "false",
				onPointerDown: startDrag,
				onKeyDown: nudge
			});

			const rightHead = h("div", { className: "dsc-dhead", key: "h" }, [
				h("span", { className: "dsc-dpath", key: "p", title: selected === null ? "" : selected.path }, selected === null ? t("pick") : selected.display),
				selected === null ? null : h(Counts, {
					key: "c",
					added: selected.added,
					deleted: selected.deleted,
					binary: selected.binary,
					oversized: selected.oversized,
					t
				}),
				selected === null ? null : h("button", {
					type: "button",
					className: "dsc-btn",
					key: "f",
					title: whole === true ? t("wholeOff") : t("wholeOn"),
					"aria-label": whole === true ? t("wholeOff") : t("wholeOn"),
					"aria-pressed": whole === true ? "true" : "false",
					"data-active": whole === true ? "true" : "false",
					onClick: () => setWhole((value) => {
						writeStored(WHOLE_KEY, value === true ? "false" : "true");
						return value !== true;
					})
				}, t("wholeShort")),
				selected === null ? null : h("button", {
					type: "button",
					className: "dsc-btn",
					key: "e",
					title: openFailed === true ? t("openAppFailed") : t("openApp"),
					"aria-label": t("openApp"),
					disabled: opening,
					onClick: openInApp
				}, "⤴"),
				selected === null ? null : h("button", {
					type: "button",
					className: "dsc-btn",
					key: "w",
					title: wrap === true ? t("wrapOff") : t("wrapOn"),
					"aria-label": wrap === true ? t("wrapOff") : t("wrapOn"),
					"aria-pressed": wrap === true ? "true" : "false",
					onClick: toggleWrap
				}, "↵"),
				selected === null ? null : h("button", {
					type: "button",
					className: "dsc-btn",
					key: "o",
					title: t("review"),
					"aria-label": t("review"),
					onClick: openReview
				}, "↗")
			]);

			const activeAt = selected === null ? 0 : Math.min(entryIndex, Math.max(0, selected.entries.length - 1));
			const activeEntry = selected === null ? void 0 : selected.entries[activeAt];

			/**
			 * Overall: walk the file back through every turn that touched it to rebuild the
			 * pre-Session text, then diff that against the current file.
			 */
			const overall = react.useMemo(() => {
				if (mode !== "overall" || selected === null) return null;
				if (wholeState === void 0 || wholeState.phase !== "ready") return { status: "pending" };
				let text = wholeState.text;
				const ordered = [...selected.entries].sort((a, b) => b.turn - a.turn);
				for (const item of ordered) {
					const state = diffs[String(item.seq) + ":" + String(item.index)];
					if (state === void 0 || state.phase !== "ready") return { status: "pending" };
					const payload = state.data;
					if (payload === void 0 || payload.kind !== "text") return { status: "binary" };
					if (payload.before !== true) {
						text = "";
						continue;
					}
					const back = reverseHunks(text, payload.hunks);
					if (back === null) return { status: "drift" };
					text = back;
				}
				const before = text === "" ? [] : text.split("\n");
				const after = wholeState.text === "" ? [] : wholeState.text.split("\n");
				const ops = diffLines(before, after);
				if (ops === null) return { status: "coarse" };
				return {
					status: "ready",
					payload: {
						kind: "text",
						path: selected.path,
						display: selected.display,
						before: true,
						after: true,
						coarse: false,
						hunks: toHunks(ops, 3)
					}
				};
			}, [mode, selected, diffs, wholeState]);

			let rightBody;
			if (selected === null || activeEntry === void 0) rightBody = h("div", { className: "dsc-note" }, t("pick"));
			else if (whole === true) {
				const key = String(activeEntry.seq) + ":" + String(activeEntry.index);
				const ready = diffs[key] !== void 0 && diffs[key].phase === "ready" ? diffs[key].data : void 0;
				rightBody = h(WholeFilePane, {
					state: wholeState,
					diff: ready,
					t,
					onRetry: () => setWholeNonce((value) => value + 1)
				});
			} else if (mode === "overall") {
				if (overall === null || overall.status === "pending") rightBody = h("div", { className: "dsc-note" }, t("loading"));
				else if (overall.status === "binary") rightBody = h("div", { className: "dsc-note" }, t("diffBinary"));
				else if (overall.status === "coarse") rightBody = h("div", { className: "dsc-note" }, t("diffOversized"));
				else if (overall.status === "drift") rightBody = h("div", { className: "dsc-note" }, t("overallDrift"));
				else rightBody = h(DiffPane, {
					state: { phase: "ready", data: overall.payload },
					wrap,
					t,
					onRetry: () => setWholeNonce((value) => value + 1)
				});
			} else {
				const key = String(activeEntry.seq) + ":" + String(activeEntry.index);
				rightBody = h(DiffPane, {
					state: diffs[key],
					wrap,
					t,
					onRetry: () => retry(key, activeEntry)
				});
			}

			const rightPane = h("div", { className: "dsc-pane dsc-right", key: "r" }, [rightHead, rightBody]);

			return h("div", { className: "dsc-root", "data-session-changes": true, ref: rootRef }, [leftPane, divider, rightPane]);
		}


		/** Set by `apply`; the last-resort opener when a body has no bound tab actions. */
		let openResource;

		const inject = ["slots", "locale", "sidebarRightTabs", "sidebarRight"];

		function apply(ctx) {
			const t = ctx.locale.bind(NS);
			openResource = (address, options) => ctx.sidebarRight.openResource(address, options);
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "session-changes: dictionaries");
			ctx.effect(() => ctx.sidebarRightTabs.register({
				id: TYPE_ID,
				kind: KIND,
				priority: "builtin",
				title: () => t("title"),
				guide: [{
					id: KIND,
					order: 45,
					title: () => t("guideTitle"),
					description: () => t("guideDescription"),
					icon: () => h("svg", {
						width: 20,
						height: 20,
						viewBox: "0 0 16 16",
						fill: "currentColor",
						"aria-hidden": true
					}, h("path", { d: "M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm0 1.5a5 5 0 0 1 4.6 3.1H9.5V3.2A5 5 0 0 1 8 3Zm-1.5.2v2.9H3.4A5 5 0 0 1 6.5 3.2ZM3.1 7.4h3.4v5.4a5 5 0 0 1-3.4-5.4Zm4.9 5.4V7.4h3.4A5 5 0 0 1 8 12.8Z" }))
				}]
			}), "session-changes: tab type");
			ctx.effect(() => ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
				name: "sidebar.right.pane.tab",
				key: TYPE_ID,
				locale: NS
			}, ChangesTab)), "session-changes: tab body");
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
