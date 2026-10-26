import { h } from "../react.js";
import { InlineDiff } from "./inline-diff.js";
import { SplitDiff } from "./split-diff.js";

/**
 * What the comparison area shows: the diff of the stored pre-image against the file
 * as it stands now, or the note explaining why there is none.
 *
 * @param props - the current selection, the computed comparison and its sources.
 */
export function DetailBody({ t, selected, activeEntry, layout, wrap, comparison, baseState }) {
  if (selected === null || activeEntry === undefined)
    return h("div", { className: "dsc-note" }, t("pick"));

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
        hunks: comparison.hunks,
      },
    };
  }

  if (note !== null) return h("div", { className: "dsc-note" }, note);

  return layout === "inline"
    ? h(InlineDiff, { state: payloadState, wrap, t })
    : h(SplitDiff, { state: payloadState, wrap, t });
}
