import { en } from "./en.js";

/**
 * Fill `{name}` placeholders of one English entry: the fallback used when the tab is
 * rendered without a bound dictionary (the registration smoke tests, mainly).
 *
 * @param key - a dictionary key.
 * @param params - values for the placeholders.
 * @returns the finished text.
 */
export function fallback(key, params) {
  const text = en[key] ?? key;
  return params === undefined
    ? text
    : text.replace(/\{(\w+)\}/g, (whole, name) => params[name] ?? whole);
}
