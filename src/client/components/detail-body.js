import { h, react } from "../react.js";
import { InlineDiff } from "./inline-diff.js";
import { SplitDiff } from "./split-diff.js";

/**
 * What the comparison area shows: the diff of the stored pre-image against the file
 * as it stands now, or the note explaining why there is none.
 *
 * The served payload is memoized on the inputs that actually describe it, not on the
 * toolbar's busy flags. Both diff layouts key their model on that payload, so a
 * re-render caused by something else (a click in flight, a sidebar geometry change)
 * reuses the numbered and highlighted rows instead of rebuilding them.
 *
 * @param props - the current selection, the computed comparison and its sources,
 *   plus the review action state (`busy`, `actionError`, `onAction`).
 */
export function DetailBody({
  t,
  sessionId,
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
  const view = react.useMemo(() => {
    if (selected === null) return { note: t("pick"), state: undefined, viewKey: "" };

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

    if (note !== null) return { note, state: undefined, viewKey: "" };

    // One memory key per Session + file + scope; each layout adds its own mode.
    const viewKey =
      String(sessionId) + "\u0000" + selected.path + "\u0000" + (whole === true ? "full" : "hunks");
    return { note: null, state: payloadState, viewKey };
  }, [t, sessionId, selected, whole, comparison, baseState]);

  if (view.note !== null) return h("div", { className: "dsc-note" }, view.note);

  const shared = {
    state: view.state,
    wrap,
    t,
    busy,
    actionError,
    onAction,
    viewKey: view.viewKey,
  };
  return layout === "inline" ? h(InlineDiff, shared) : h(SplitDiff, shared);
}
