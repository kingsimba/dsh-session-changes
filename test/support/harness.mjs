/**
 * Run the built `lib/client.js` outside a browser.
 *
 * The bundle is a classic script that registers a factory on
 * `window.__ModuleLoader__`, so the harness stubs exactly four things: `window`,
 * `document`, `fetch`, and a React with the hooks this tab uses (with dependency
 * tracking, so effects and memos behave like the real ones across renders).
 *
 * The stubs stay installed for the lifetime of the process: the tab reads
 * `window.localStorage` while it renders, not only while the bundle loads. The Node
 * test runner gives each test file its own process, so one harness per file.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { en } from "../../src/client/locale/en.js";

const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

/** The built bundle's text. */
export function readBundle() {
  return readFileSync(join(ROOT, "lib/client.js"), "utf8");
}

/**
 * A dictionary that throws on an unknown key, so a typo fails the test instead of
 * rendering the raw key.
 * @param key - the dictionary key.
 * @param params - placeholder values.
 * @returns the filled entry.
 */
export function translate(key, params) {
  if (!Object.hasOwn(en, key)) throw new Error(`unknown locale key: ${key}`);
  const text = en[key];
  return params === undefined
    ? text
    : text.replace(/\{(\w+)\}/g, (whole, name) => params[name] ?? whole);
}

/**
 * Shallow dependency comparison, as React does it.
 * @param previous - the last render's dependencies.
 * @param next - this render's dependencies.
 * @returns true when nothing changed.
 */
function sameDeps(previous, next) {
  if (previous === undefined || next === undefined) return false;
  if (previous.length !== next.length) return false;
  return previous.every((value, at) => Object.is(value, next[at]));
}

/**
 * A React stand-in: elements, the four hooks the tab uses, and one render pass at a
 * time with hook order preserved.
 * @returns the runtime.
 */
function createReact() {
  const values = [];
  let effects = [];
  let index = 0;

  const react = {
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
    useRef(initial) {
      const slot = index++;
      if (values[slot] === undefined) values[slot] = { kind: "ref", value: { current: initial } };
      return values[slot].value;
    },
    useState(initial) {
      const slot = index++;
      if (values[slot] === undefined)
        values[slot] = {
          kind: "state",
          value: typeof initial === "function" ? initial() : initial,
        };
      const cell = values[slot];
      return [
        cell.value,
        (next) => {
          cell.value = typeof next === "function" ? next(cell.value) : next;
        },
      ];
    },
    useMemo(factory, deps) {
      const slot = index++;
      const cell = values[slot];
      if (cell === undefined || cell.kind !== "memo" || !sameDeps(cell.deps, deps)) {
        values[slot] = { kind: "memo", deps, value: factory() };
      }
      return values[slot].value;
    },
    useEffect(effect, deps) {
      const slot = index++;
      const cell = values[slot];
      if (cell === undefined || cell.kind !== "effect" || !sameDeps(cell.deps, deps)) {
        values[slot] = { kind: "effect", deps, effect, cleanup: cell?.cleanup };
        effects.push(slot);
      }
    },
  };

  return {
    react,
    begin() {
      index = 0;
      effects = [];
    },
    takeEffects() {
      const slots = effects;
      effects = [];
      return slots.map((slot) => values[slot]);
    },
  };
}

/**
 * Expand a React element tree by invoking every function component, so assertions
 * can read the markup the browser would receive.
 * @param node - an element, an array, or a text leaf.
 * @returns the expanded tree.
 */
function expand(node) {
  if (node === null || node === undefined || node === true || node === false) return null;
  if (Array.isArray(node)) return node.map(expand).filter((child) => child !== null);
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (typeof node.type === "function") return expand(node.type(node.props));
  const children = node.children.map(expand).filter((child) => child !== null);
  return { type: node.type, props: node.props ?? {}, children };
}

/**
 * Collect every element in an expanded tree.
 * @param tree - the expanded tree.
 * @returns the elements, depth first.
 */
export function elementsOf(tree) {
  const out = [];
  const walk = (node) => {
    if (node === null) return;
    if (Array.isArray(node)) {
      for (const child of node) walk(child);
      return;
    }
    if (typeof node === "string") return;
    out.push(node);
    for (const child of node.children) walk(child);
  };
  walk(tree);
  return out;
}

/**
 * All text content of an expanded tree.
 * @param tree - the expanded tree.
 * @returns the concatenated text.
 */
export function textOf(tree) {
  const walk = (node) => {
    if (node === null) return "";
    if (Array.isArray(node)) return node.map(walk).join("");
    if (typeof node === "string") return node;
    return node.children.map(walk).join("");
  };
  return walk(tree);
}

/**
 * A Host refusal, for routes a test does not care about.
 * @returns the response stub.
 */
export function refuse() {
  return { ok: false, status: 404, json: async () => ({ error: "not-found" }) };
}

/**
 * A Host answer.
 * @param payload - the JSON body.
 * @returns the response stub.
 */
export function respond(payload) {
  return { ok: true, status: 200, json: async () => payload };
}

/**
 * Boot the bundle against the stubs and expose a render loop.
 * @param input - `{ storage, fetch, source }`: initial localStorage entries, the
 *   Host, and the bundle text (defaults to the built `lib/client.js`).
 * @returns the harness.
 */
export function createHarness({ storage = new Map(), fetch = async () => refuse(), source } = {}) {
  const fakeReact = createReact();
  const fakeDocument = {
    querySelector: () => null,
    createElement: () => ({ dataset: {}, textContent: "" }),
    head: { appendChild: () => {} },
  };
  const fakeWindow = {
    localStorage: {
      getItem: (key) => (storage.has(key) ? storage.get(key) : null),
      setItem: (key, value) => storage.set(key, String(value)),
    },
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  let factory = null;
  fakeWindow.__ModuleLoader__ = {
    load: (definition) => {
      factory = definition.factory;
    },
  };

  globalThis.window = fakeWindow;
  globalThis.document = fakeDocument;
  globalThis.fetch = fetch;
  new Function(source ?? readBundle())();
  if (factory === null) throw new Error("the bundle did not register a module factory");

  const client = factory((name) => {
    if (name === "react") return fakeReact.react;
    throw new Error(`unexpected Host module: ${name}`);
  });

  let body = null;
  const registrations = { tabType: null, dictionaries: null };
  client.apply({
    locale: {
      bind: () => translate,
      register: (namespace, dictionaries) => {
        registrations.dictionaries = { namespace, dictionaries };
        return () => {};
      },
    },
    sidebarRightTabs: {
      register: (definition) => {
        registrations.tabType = definition;
        return () => {};
      },
    },
    sidebarRight: { openResource: () => {} },
    slots: {
      inject: (_name, register) => register(),
      register: (_config, component) => {
        body = component;
        return () => {};
      },
    },
    effect: (effect) => effect(),
  });

  let tree = null;

  /**
   * Render the registered tab body once.
   * @param props - the props the tab system passes.
   * @returns the expanded tree.
   */
  const render = (props = {}) => {
    if (body === null) throw new Error("apply did not register a tab body");
    fakeReact.begin();
    tree = expand({ type: body, props: { t: translate, ...props }, children: [] });
    return tree;
  };

  /**
   * Run every effect whose dependencies changed, then render again, until the tree
   * settles. Mirrors a React mount followed by its state updates.
   *
   * Reads land asynchronously, so a render with no pending effects is not proof that
   * the tree is final: three quiet ticks are given for a fetch to resolve and its
   * `setState` to show up in the next render.
   *
   * @param props - the props the tab system passes.
   * @param rounds - the most effect rounds to allow.
   * @returns the settled tree.
   */
  const settle = async (props = {}, rounds = 12) => {
    if (tree === null) render(props);
    let quiet = 0;
    for (let at = 0; at < rounds + 3; at += 1) {
      const pending = fakeReact.takeEffects();
      if (pending.length === 0) {
        quiet += 1;
        if (quiet > 3) return tree;
      } else {
        quiet = 0;
        for (const cell of pending) {
          if (typeof cell.cleanup === "function") cell.cleanup();
          const cleanup = cell.effect();
          cell.cleanup = typeof cleanup === "function" ? cleanup : undefined;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
      render(props);
    }
    return tree;
  };

  return {
    client,
    registrations,
    render,
    settle,
    current: () => tree,
    storage,
  };
}
