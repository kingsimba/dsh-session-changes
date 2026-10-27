import { h } from "../react.js";

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
export function BlockActions({ t, block, busy, onAction }) {
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
