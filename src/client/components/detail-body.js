import { h } from "../react.js";
import { entryKey } from "../selection.js";
import { AnnotatedPane } from "./annotated.js";
import { InlineDiff } from "./inline-diff.js";
import { SplitDiff } from "./split-diff.js";

/**
 * What the comparison area shows: the pane for the served payload, a note while
 * something is missing, or the annotated fallback when the by-turn reconstruction
 * cannot be rebuilt.
 *
 * @param props - the current selection, the computed comparison and its sources.
 */
export function DetailBody({
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
    else if (comparison.status === "no-base") note = t("overallNoBase");
    else if (comparison.status === "drift") {
      // By-turn reconstruction failed: annotate the current file instead of dead-ending.
      banner = t("turnDrift");
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
