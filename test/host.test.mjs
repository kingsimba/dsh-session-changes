/**
 * The Host half: pre-image capture, the store-backed list, the file/pre-image reads,
 * and the watch stream. No running app required.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { apply, inject, storeDirectory } from "../lib/index.js";

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

/** A throwaway workspace, with its own DSH data root so no real store is touched. */
async function workspace() {
  const cwd = await mkdtemp(join(tmpdir(), "dsh-session-changes-"));
  const home = await mkdtemp(join(tmpdir(), "dsh-session-changes-home-"));
  process.env.DSH_HOME = home;
  return {
    cwd,
    home,
    dispose: async () => {
      await rm(cwd, { recursive: true, force: true });
      await rm(home, { recursive: true, force: true });
    },
  };
}

/** Call one registered route. */
async function call(routes, path, query) {
  const route = routes.get(path);
  assert.ok(route !== undefined, `${path} was not registered`);
  assert.deepEqual(route.methods, ["GET"]);
  return route.fetch(new Request(`http://host${path}?${query}`));
}

/** SHA-256 of a text, as the browser sends it for a review write. */
function sha(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** POST one accept/revert write. */
async function applyWrite(routes, action, payload) {
  const route = routes.get(`/api/session-changes.${action}`);
  assert.ok(route !== undefined, `the ${action} route was not registered`);
  assert.deepEqual(route.methods, ["POST"]);
  return route.fetch(
    new Request(`http://host/api/session-changes.${action}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }),
  );
}

/** POST to one whole-file / whole-list review route. */
async function postReview(routes, path, payload) {
  const route = routes.get(path);
  assert.ok(route !== undefined, `${path} was not registered`);
  assert.deepEqual(route.methods, ["POST"]);
  return route.fetch(
    new Request(`http://host${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }),
  );
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
      "/api/session-changes.open",
      "/api/session-changes.accept",
      "/api/session-changes.revert",
      "/api/session-changes.apply-file",
      "/api/session-changes.apply-all",
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
    const stored = join(storeDirectory(cwd), sessionId, "src", "app.js");
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

test("the pre-image store stays outside the workspace, under DSH_HOME", async () => {
  const { cwd, home, dispose } = await workspace();
  try {
    const sessionId = nextSession();
    const session = { id: sessionId, header: { cwd } };
    const { handlers } = createContext({ cwd });
    const target = join(cwd, "src", "app.js");
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, "before\n", "utf8");

    await toolWrite({ handlers, session, target, content: "after\n" });

    const stored = join(storeDirectory(cwd), sessionId, "src", "app.js");
    assert.equal(await readFile(stored, "utf8"), "before\n");
    assert.equal(stored.startsWith(home), true);
    // Nothing was written into the work tree, not even an empty `.dsh`.
    await assert.rejects(stat(join(cwd, ".dsh")));
    // The store names the workspace it belongs to, so a digest is debuggable.
    const descriptor = JSON.parse(
      await readFile(join(storeDirectory(cwd), "workspace.json"), "utf8"),
    );
    assert.equal(descriptor.path, cwd);
  } finally {
    await dispose();
  }
});

test("a store an earlier version kept in the workspace is adopted and removed", async () => {
  const { cwd, dispose } = await workspace();
  try {
    const sessionId = nextSession();
    const legacy = join(cwd, ".dsh/session-changes");
    await mkdir(join(legacy, sessionId, "src"), { recursive: true });
    await writeFile(join(legacy, sessionId, "src", "app.js"), "before\n", "utf8");
    const { routes } = createContext({ cwd });

    const list = await (
      await call(routes, "/api/session-changes.list", `sessionId=${sessionId}`)
    ).json();
    assert.deepEqual(
      list.files.map((file) => file.path),
      ["src/app.js"],
    );
    assert.equal(
      await readFile(join(storeDirectory(cwd), sessionId, "src", "app.js"), "utf8"),
      "before\n",
    );
    await assert.rejects(stat(legacy));
    // The now-empty `.dsh` wrapper goes too, leaving the work tree untouched.
    await assert.rejects(stat(join(cwd, ".dsh")));
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
    const external = join(storeDirectory(cwd), "_external", sessionId);
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

test("accept writes the block's new text into the stored pre-image", async () => {
  const { cwd, dispose } = await workspace();
  try {
    const sessionId = nextSession();
    const session = { id: sessionId, header: { cwd } };
    const { routes, handlers } = createContext({ cwd });
    const target = join(cwd, "src", "app.js");
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, "before\n", "utf8");
    await toolWrite({ handlers, session, target, content: "after\n" });

    const accepted = await applyWrite(routes, "accept", {
      sessionId,
      path: "src/app.js",
      text: "after\n",
      expect: sha("before\n"),
    });
    assert.equal(accepted.status, 200);
    assert.deepEqual(await accepted.json(), { ok: true });

    // The store now holds the accepted text; the live file is untouched.
    const stored = join(storeDirectory(cwd), sessionId, "src", "app.js");
    assert.equal(await readFile(stored, "utf8"), "after\n");
    assert.equal(await readFile(target, "utf8"), "after\n");
    const base = await call(
      routes,
      "/api/session-changes.base",
      `sessionId=${sessionId}&path=src/app.js`,
    );
    assert.deepEqual(await base.json(), { text: "after\n" });
  } finally {
    await dispose();
  }
});

test("accept refuses when the pre-image no longer matches the browser's digest", async () => {
  const { cwd, dispose } = await workspace();
  try {
    const sessionId = nextSession();
    const session = { id: sessionId, header: { cwd } };
    const { routes, handlers } = createContext({ cwd });
    const target = join(cwd, "src", "app.js");
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, "before\n", "utf8");
    await toolWrite({ handlers, session, target, content: "after\n" });

    const refused = await applyWrite(routes, "accept", {
      sessionId,
      path: "src/app.js",
      text: "stale\n",
      expect: sha("something else"),
    });
    assert.equal(refused.status, 409);
    assert.deepEqual(await refused.json(), { error: "changed" });
    // Nothing was overwritten.
    const stored = join(storeDirectory(cwd), sessionId, "src", "app.js");
    assert.equal(await readFile(stored, "utf8"), "before\n");
  } finally {
    await dispose();
  }
});

test("revert writes the pre-image's lines back into the live file", async () => {
  const { cwd, dispose } = await workspace();
  try {
    const sessionId = nextSession();
    const session = { id: sessionId, header: { cwd } };
    const { routes, handlers } = createContext({ cwd });
    const target = join(cwd, "src", "app.js");
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, "before\n", "utf8");
    await toolWrite({ handlers, session, target, content: "after\n" });

    const reverted = await applyWrite(routes, "revert", {
      sessionId,
      path: "src/app.js",
      text: "before\n",
      expect: sha("after\n"),
    });
    assert.equal(reverted.status, 200);
    assert.deepEqual(await reverted.json(), { ok: true });
    assert.equal(await readFile(target, "utf8"), "before\n");
    // The pre-image store is the baseline; reverting does not touch it.
    const stored = join(storeDirectory(cwd), sessionId, "src", "app.js");
    assert.equal(await readFile(stored, "utf8"), "before\n");
  } finally {
    await dispose();
  }
});

test("revert refuses to clobber a file the agent changed after the diff was drawn", async () => {
  const { cwd, dispose } = await workspace();
  try {
    const sessionId = nextSession();
    const session = { id: sessionId, header: { cwd } };
    const { routes, handlers } = createContext({ cwd });
    const target = join(cwd, "src", "app.js");
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, "before\n", "utf8");
    await toolWrite({ handlers, session, target, content: "after\n" });
    // A second write lands while the browser still shows "after".
    await toolWrite({ handlers, session, target, content: "newer\n" });

    const refused = await applyWrite(routes, "revert", {
      sessionId,
      path: "src/app.js",
      text: "before\n",
      expect: sha("after\n"),
    });
    assert.equal(refused.status, 409);
    assert.deepEqual(await refused.json(), { error: "changed" });
    assert.equal(await readFile(target, "utf8"), "newer\n");
  } finally {
    await dispose();
  }
});

test("a created file gains a real pre-image on accept and is deleted on full revert", async () => {
  const { cwd, dispose } = await workspace();
  try {
    const sessionId = nextSession();
    const session = { id: sessionId, header: { cwd } };
    const { routes, handlers } = createContext({ cwd });
    const created = join(cwd, "notes.md");
    await toolWrite({ handlers, session, target: created, content: "hello\n" });

    // Accepting the whole block of a new file turns the absent marker into text.
    const accepted = await applyWrite(routes, "accept", {
      sessionId,
      path: "notes.md",
      text: "hello\n",
      expect: sha(""),
    });
    assert.equal(accepted.status, 200);
    const store = join(storeDirectory(cwd), sessionId);
    assert.equal(await readFile(join(store, "notes.md"), "utf8"), "hello\n");
    let marker = true;
    try {
      await readFile(join(store, "notes.md.absent"));
    } catch {
      marker = false;
    }
    assert.equal(marker, false);

    // A second new file, reverted in full, goes away instead of staying empty.
    const other = join(cwd, "other.md");
    await toolWrite({ handlers, session, target: other, content: "gone\n" });
    const reverted = await applyWrite(routes, "revert", {
      sessionId,
      path: "other.md",
      text: "",
      expect: sha("gone\n"),
    });
    assert.equal(reverted.status, 200);
    assert.deepEqual(await reverted.json(), { ok: true, deleted: true });
    await assert.rejects(readFile(other, "utf8"));
  } finally {
    await dispose();
  }
});

test("accept and revert refuse a path this Session never captured", async () => {
  const { cwd, dispose } = await workspace();
  try {
    const sessionId = nextSession();
    const { routes } = createContext({ cwd });
    for (const action of ["accept", "revert"]) {
      const refused = await applyWrite(routes, action, {
        sessionId,
        path: "nope.js",
        text: "text\n",
        expect: "",
      });
      assert.equal(refused.status, 404);
      assert.deepEqual(await refused.json(), { error: "not-captured" });
    }
  } finally {
    await dispose();
  }
});

test("a whole-file accept and revert copy both sides byte for byte", async () => {
  const { cwd, dispose } = await workspace();
  try {
    const sessionId = nextSession();
    const session = { id: sessionId, header: { cwd } };
    const { routes, handlers } = createContext({ cwd });
    const textFile = join(cwd, "src", "app.js");
    await mkdir(dirname(textFile), { recursive: true });
    await writeFile(textFile, "before\n", "utf8");
    await toolWrite({ handlers, session, target: textFile, content: "after\n" });
    const binary = join(cwd, "blob.bin");
    await writeFile(binary, Buffer.from("abc\u0000def", "utf8"));
    await toolWrite({ handlers, session, target: binary, content: "xyz\u0000uvw" });

    const accepted = await postReview(routes, "/api/session-changes.apply-file", {
      sessionId,
      path: "src/app.js",
      action: "accept",
      source: "tab-1",
    });
    assert.equal(accepted.status, 200);
    assert.deepEqual(await accepted.json(), { ok: true });
    const stored = join(storeDirectory(cwd), sessionId, "src", "app.js");
    assert.equal(await readFile(stored, "utf8"), "after\n");
    assert.equal(await readFile(textFile, "utf8"), "after\n");

    const reverted = await postReview(routes, "/api/session-changes.apply-file", {
      sessionId,
      path: "blob.bin",
      action: "revert",
    });
    assert.equal(reverted.status, 200);
    // Bytes survive the copy; no UTF-8 decode is involved.
    assert.deepEqual(await readFile(binary), Buffer.from("abc\u0000def", "utf8"));

    const refused = await postReview(routes, "/api/session-changes.apply-file", {
      sessionId,
      path: "nope.js",
      action: "accept",
    });
    assert.equal(refused.status, 404);
    assert.deepEqual(await refused.json(), { error: "not-captured" });
  } finally {
    await dispose();
  }
});

test("apply-all accepts every listed file into its pre-image", async () => {
  const { cwd, dispose } = await workspace();
  try {
    const sessionId = nextSession();
    const session = { id: sessionId, header: { cwd } };
    const { routes, handlers } = createContext({ cwd });
    const app = join(cwd, "src", "app.js");
    await mkdir(dirname(app), { recursive: true });
    await writeFile(app, "before\n", "utf8");
    await toolWrite({ handlers, session, target: app, content: "after\n" });
    const other = join(cwd, "b.js");
    await writeFile(other, "before2\n", "utf8");
    await toolWrite({ handlers, session, target: other, content: "after2\n" });
    const created = join(cwd, "c.md");
    await toolWrite({ handlers, session, target: created, content: "new\n" });

    const accepted = await postReview(routes, "/api/session-changes.apply-all", {
      sessionId,
      action: "accept",
      source: "tab-1",
    });
    assert.equal(accepted.status, 200);
    assert.deepEqual(await accepted.json(), { ok: true, files: 3, failed: 0 });

    const store = join(storeDirectory(cwd), sessionId);
    assert.equal(await readFile(join(store, "src", "app.js"), "utf8"), "after\n");
    assert.equal(await readFile(join(store, "b.js"), "utf8"), "after2\n");
    assert.equal(await readFile(join(store, "c.md"), "utf8"), "new\n");
    // The created file's absent marker is gone now that its baseline is real.
    await assert.rejects(readFile(join(store, "c.md.absent"), "utf8"));
    // The live files are untouched.
    assert.equal(await readFile(app, "utf8"), "after\n");
  } finally {
    await dispose();
  }
});

test("apply-all reverts every listed file and removes created ones", async () => {
  const { cwd, dispose } = await workspace();
  try {
    const sessionId = nextSession();
    const session = { id: sessionId, header: { cwd } };
    const { routes, handlers } = createContext({ cwd });
    const app = join(cwd, "src", "app.js");
    await mkdir(dirname(app), { recursive: true });
    await writeFile(app, "before\n", "utf8");
    await toolWrite({ handlers, session, target: app, content: "after\n" });
    const other = join(cwd, "b.js");
    await writeFile(other, "before2\n", "utf8");
    await toolWrite({ handlers, session, target: other, content: "after2\n" });
    const created = join(cwd, "c.md");
    await toolWrite({ handlers, session, target: created, content: "new\n" });

    const reverted = await postReview(routes, "/api/session-changes.apply-all", {
      sessionId,
      action: "revert",
      source: "tab-1",
    });
    assert.equal(reverted.status, 200);
    assert.deepEqual(await reverted.json(), { ok: true, files: 3, failed: 0 });
    assert.equal(await readFile(app, "utf8"), "before\n");
    assert.equal(await readFile(other, "utf8"), "before2\n");
    await assert.rejects(readFile(created, "utf8"));
  } finally {
    await dispose();
  }
});

test("the open route refuses a path this Session never captured", async () => {
  const { cwd, dispose } = await workspace();
  try {
    const sessionId = nextSession();
    const { routes } = createContext({ cwd });
    const route = routes.get("/api/session-changes.open");
    assert.ok(route !== undefined, "the open route was not registered");
    assert.deepEqual(route.methods, ["POST"]);
    const response = await route.fetch(
      new Request(`http://host/api/session-changes.open?sessionId=${sessionId}&path=nope.js`, {
        method: "POST",
      }),
    );
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: "not-captured" });
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

test("a tab skips its own review-write echoes while other tabs still hear them", async () => {
  const { cwd, dispose } = await workspace();
  let mine;
  let other;
  try {
    const sessionId = nextSession();
    const session = { id: sessionId, header: { cwd } };
    const { routes, handlers, watchers } = createContext({ cwd });
    const target = join(cwd, "src", "app.js");
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, "before\n", "utf8");
    await toolWrite({ handlers, session, target, content: "after\n" });

    mine = framesOf(
      await call(routes, "/api/session-changes.watch", `sessionId=${sessionId}&client=tab-a`),
    );
    other = framesOf(await call(routes, "/api/session-changes.watch", `sessionId=${sessionId}`));
    assert.deepEqual(await mine.next(), { t: "ready", files: true });
    assert.deepEqual(await other.next(), { t: "ready", files: true });

    const reverted = await applyWrite(routes, "revert", {
      sessionId,
      path: "src/app.js",
      text: "before\n",
      expect: sha("after\n"),
      source: "tab-a",
    });
    assert.equal(reverted.status, 200);
    // The tab that wrote hears nothing; every other tab hears the invalidation.
    assert.deepEqual(await other.next(), { t: "file", source: "tab-a" });

    // The filesystem echo of the same write is attributed the same way.
    await new Promise((done) => setTimeout(done, 20));
    const matched = watchers.filter(
      (watcher) => watcher.target !== undefined && watcher.target.path === target,
    );
    assert.equal(
      matched.length,
      2,
      JSON.stringify({ total: watchers.length, targets: watchers.map((w) => w.target?.path) }),
    );
    for (const watcher of matched) watcher.listener();

    // A later capture has no source, so both tabs hear it. It is also the proof
    // that the writing tab saw none of its own file frames in between.
    const notes = join(cwd, "notes.md");
    await toolWrite({ handlers, session, target: notes, content: "hello\n" });
    assert.deepEqual(await mine.next(), { t: "added" });

    const heard = [];
    for (;;) {
      const frame = await other.next();
      if (frame === null || frame.t === "added") break;
      heard.push(frame);
    }
    // One tagged echo per open stream; the writing tab saw none of them.
    assert.equal(heard.length >= 1, true, JSON.stringify(heard));
    for (const frame of heard) {
      assert.equal(frame.t, "file");
      assert.equal(frame.source, "tab-a");
    }
  } finally {
    if (mine !== undefined) await mine.cancel();
    if (other !== undefined) await other.cancel();
    await dispose();
  }
});
