import { react } from "../react.js";
import { buildView } from "../view.js";

/**
 * The left list, recomputed only when the turns change.
 * @param input - `{ turns }`.
 * @returns the built view.
 */
export function useView({ turns }) {
  return react.useMemo(() => buildView(turns), [turns]);
}
