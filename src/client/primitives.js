import { loadModule } from "./loader.js";

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
export const useCodeHighlighter =
  primitives === null || typeof primitives.useCodeHighlighter !== "function"
    ? null
    : primitives.useCodeHighlighter;

/** Maps a file path to the language the highlighter understands, or null. */
export const languageForPath =
  primitives === null || typeof primitives.languageForPath !== "function"
    ? null
    : primitives.languageForPath;
