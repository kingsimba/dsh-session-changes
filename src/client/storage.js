import { DEFAULT_LEFT, LAYOUT_KEY, MIN_LEFT, WHOLE_KEY, WIDTH_KEY, WRAP_KEY } from "./constants.js";

/**
 * Read one persisted preference.
 * @param key - the storage key.
 * @param fallback - the value when nothing (or nothing usable) is stored.
 * @returns the stored string, or the fallback.
 */
export function readStored(key, fallback) {
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
export function writeStored(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch (_error) {
    // A refused write only costs the preference, never the render.
  }
}

/** The persisted wrap preference. */
export function readWrap() {
  return readStored(WRAP_KEY, "false") === "true";
}

/** The persisted whole-file preference. */
export function readWhole() {
  return readStored(WHOLE_KEY, "false") === "true";
}

/** The persisted comparison layout: `split` unless `inline` was chosen last time. */
export function readLayout() {
  return readStored(LAYOUT_KEY, "split") === "inline" ? "inline" : "split";
}

/**
 * The persisted left pane width, clamped to something usable.
 * @returns the width in pixels.
 */
export function readLeft() {
  const stored = Number(readStored(WIDTH_KEY, ""));
  return Number.isFinite(stored) && stored >= MIN_LEFT ? stored : DEFAULT_LEFT;
}
