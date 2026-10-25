import { react } from "../react.js";
import { buildView } from "../view.js";

/**
 * The left list, recomputed only when the turns or one of the two switches change.
 * @param input - `{ turns, mode, turnFilter }`.
 * @returns the built view.
 */
export function useView({ turns, mode, turnFilter }) {
  return react.useMemo(() => buildView(turns, mode, turnFilter), [turns, mode, turnFilter]);
}
