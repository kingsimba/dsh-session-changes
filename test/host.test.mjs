/**
 * The Host half: pre-image capture, the store-backed list, the file/pre-image reads,
 * and the watch stream. No running app required.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { apply, inject } from "../lib/index.js";

let sessions = 0;
/** A unique Session id per test: the Host caches each Session's workspace root. */
function nextSession() {
  sessions += 1;
  return "session-test-" + String(sessions);
}

/**
 * A Host context with just enough of each service.
 * @param input - `{ cwd }`.
 * @returns the registered routes, the captured event handlers, and the watchers.
 */
function createContext({ cwd }) {
  const routes = new Map();
  const handlers = new Map();
  const watchers = [];
  const ctx = {
    connection: {
      fetch: {
        register(route) {
          routes.set(route.path, route);
        },
      },
    },
    sessionQuery: {
      readSession: async () => ({ session: { cwd } }),
    },
    fs: {
      processPath: (target) => target.path,
      resolve: async (path) => ({ path }),
      watch: async (target, listener) => {
        watchers.push({ target, listener });
        return async () => {};
      },
    },
    effect: (effect) => effect(),
    on: (name, handler) => {
      handlers.set(name, handler);
      return () => {};
    },
  };
  apply(ctx);
  return { routes, handlers, watchers, ctx };
}

/** A throwaway workspace. */
async function workspace() {
  const cwd = await mkdtemp(join(tmpdir(), "dsh-session-changes-"));
  return { cwd, dispose: () => rm(cwd, { recursive: true, force: true }) };
}

/** Call one registered route. */
async function call(routes, path, query) {
  const route = routes.get(path);
  assert.ok(route !== undefined, `${path} was not registered`);
  assert.deepEqual(route.methods, ["GET"]);
  return route.fetch(new Request(`http://host${path}?${query}`));
}

/**
 * Simulate one file-tool write: map the tool execution to its Session, run the
 * write-intent waterfall (which captures the pre-image), then write the file.
 */
async function toolWrite({ handlers, session, target, content }) {
  const exec = { agent: { session } };
  await handlers.get("tools/pre-execute")(exec, async () => undefined);
  await handlers.get("fs/write-intent")({ path: target }, exec, async () => ({
    kind: "createIfAbsent",
  }));
  await writeFile(target, content, "utf8");
}

test("apply injects the services the Host half needs", async () => {
  const { cwd, dispose } = await workspace();
  try {
    const { routes } = createContext({ cwd });
    assert.deepEqual(inject, ["connection", "fs", "sessionQuery"]);
    for (const path of [
      "/api/session-changes.list",
      "/api/session-changes.file",
      "/api/session-changes.base",
      "/api/session-changes.watch",
    ])
      assert.ok(routes.has(path), `${path} was not registered`);
  } finally {
    await dispose();
  }
});

test("a write captures the pre-image, then the list and both reads see the file", async () => {
  const { cwd, dispose } = await workspace();
  try {
    const sessionId = nextSession();
    const session = { id: sessionId, header: { cwd } };
    const { routes, handlers } = createContext({ cwd });
    const target = join(cwd, "src", "app.js");
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, "before\n", "utf8");

    await toolWrite({ handlers, session, target, content: "after\n" });

    // The pre-image is the text as it stood before the write.
    const stored = join(cwd, ".dsh/session-changes", sessionId, "src", "app.js");
    assert.equal(await readFile(stored, "utf8"), "before\n");

    const list = await (
      await call(routes, "/api/session-changes.list", `sessionId=${sessionId}`)
    ).json();
    assert.deepEqual(
      list.files.map((file) => file.path),
      ["src/app.js"],
    );

    const base = await call(
      routes,
      "/api/session-changes.base",
      `sessionId=${sessionId}&path=src/app.js`,
    );
    assert.deepEqual(await base.json(), { text: "before\n" });

    const current = await call(
      routes,
      "/api/session-changes.file",
      `sessionId=${sessionId}&path=src/app.js`,
    );
    assert.deepEqual(await current.json(), { text: "after\n" });
  } finally {
    await dispose();
  }
});

test("a created file is listed from its absent marker and needs no pre-image text", async () => {
  const { cwd, dispose } = await workspace();
  try {
    const sessionId = nextSession();
    const session = { id: sessionId, header: { cwd } };
    const { routes, handlers } = createContext({ cwd });
    const target = join(cwd, "notes.md");

    await toolWrite({ handlers, session, target, content: "hello\n" });

    const list = await (
      await call(routes, "/api/session-changes.list", `sessionId=${sessionId}`)
    ).json();
    assert.deepEqual(
      list.files.map((file) => file.display),
      ["notes.md"],
    );
    const base = await call(
      routes,
      "/api/session-changes.base",
      `sessionId=${sessionId}&path=notes.md`,
    );
    assert.deepEqual(await base.json(), { absent: true });
  } finally {
    await dispose();
  }
});

test("a path outside the workspace is captured by digest and listed by its absolute path", async () => {
  const { cwd, dispose } = await workspace();
  try {
    const sessionId = nextSession();
    const session = { id: sessionId, header: { cwd } };
    const { routes, handlers } = createContext({ cwd });
    const target = resolve(cwd, "../outside-probe.md");
    await writeFile(target, "outside before\n", "utf8");

    await toolWrite({ handlers, session, target, content: "outside after\n" });

    const digest = createHash("sha1")
      .update(process.platform === "win32" ? target.toLowerCase() : target, "utf8")
      .digest("hex");
    const external = join(cwd, ".dsh/session-changes", "_external", sessionId);
    assert.equal(await readFile(join(external, digest), "utf8"), "outside before\n");
    assert.equal((await readFile(join(external, digest + ".path"), "utf8")).trim(), target);

    const list = await (
      await call(routes, "/api/session-changes.list", `sessionId=${sessionId}`)
    ).json();
    assert.deepEqual(
      list.files.map((file) => file.path),
      [target],
    );

    const base = await call(
      routes,
      "/api/session-changes.base",
      `sessionId=${sessionId}&path=${encodeURIComponent(target)}`,
    );
    assert.deepEqual(await base.json(), { text: "outside before\n" });
  } finally {
    await dispose();
  }
});

test("the file route refuses a binary file and reports a vanished one", async () => {
  const { cwd, dispose } = await workspace();
  try {
    const sessionId = nextSession();
    const { routes } = createContext({ cwd });
    await writeFile(join(cwd, "blob.bin"), "abc\u0000def", "utf8");

    const binary = await call(
      routes,
      "/api/session-changes.file",
      `sessionId=${sessionId}&path=blob.bin`,
    );
    assert.equal(binary.status, 415);
    assert.deepEqual(await binary.json(), { error: "binary" });

    const gone = await call(
      routes,
      "/api/session-changes.file",
      `sessionId=${sessionId}&path=missing.js`,
    );
    assert.equal(gone.status, 404);
    assert.equal((await gone.json()).error, "read-ENOENT");
  } finally {
    await dispose();
  }
});

test("a Session with no captures lists nothing and refuses a pre-image", async () => {
  const { cwd, dispose } = await workspace();
  try {
    const sessionId = nextSession();
    const { routes } = createContext({ cwd });
    const list = await (
      await call(routes, "/api/session-changes.list", `sessionId=${sessionId}`)
    ).json();
    assert.deepEqual(list, { files: [] });

    const base = await call(
      routes,
      "/api/session-changes.base",
      `sessionId=${sessionId}&path=src/app.js`,
    );
    assert.equal(base.status, 404);
    assert.deepEqual(await base.json(), { error: "not-captured" });
  } finally {
    await dispose();
  }
});

/** Read frames off a streamed route, one newline-delimited JSON object at a time. */
function framesOf(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  return {
    async next() {
      for (;;) {
        const newline = buffer.indexOf("\n");
        if (newline !== -1) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          if (line !== "") return JSON.parse(line);
          continue;
        }
        const { value, done } = await reader.read();
        if (done) return null;
        buffer += decoder.decode(value, { stream: true });
      }
    },
    cancel: () => reader.cancel(),
  };
}

test("the watch route streams readiness and wakes on every capture", async () => {
  const { cwd, dispose } = await workspace();
  try {
    const sessionId = nextSession();
    const session = { id: sessionId, header: { cwd } };
    const { routes, handlers, watchers } = createContext({ cwd });

    const response = await call(routes, "/api/session-changes.watch", `sessionId=${sessionId}`);
    assert.equal(response.status, 200);
    assert.match(String(response.headers.get("content-type")), /ndjson/);
    const frames = framesOf(response);
    assert.deepEqual(await frames.next(), { t: "ready", files: false });

    const target = join(cwd, "src", "app.js");
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, "before\n", "utf8");
    await toolWrite({ handlers, session, target, content: "after\n" });
    assert.deepEqual(await frames.next(), { t: "added" });

    // The capture re-arms the watchers, so the file is observed from now on.
    await new Promise((done) => setTimeout(done, 20));
    assert.equal(watchers.length >= 1, true);
    watchers[0].listener();
    assert.deepEqual(await frames.next(), { t: "file" });

    await frames.cancel();
  } finally {
    await dispose();
  }
});
