import { h } from "../react.js";

/**
 * The note a pane shows when the payload is not renderable text. Both layouts use
 * the same wording, so it lives here once.
 *
 * @param state - the payload state (`undefined` while nothing was requested).
 * @param t - the bound dictionary.
 * @param onRetry - retries the read.
 * @returns the note element, or null when the payload is a drawable text diff.
 */
export function paneNote(state, t, onRetry) {
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
export function comparisonNotes(data, model, t) {
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
export function notesBlock(notes) {
  if (notes.length === 0) return null;
  return h(
    "div",
    { className: "dsc-dnotes", key: "n" },
    notes.map(([key, label]) => h("div", { className: "dsc-dnote", key }, label)),
  );
}
