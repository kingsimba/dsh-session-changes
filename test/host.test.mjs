/**
 * The Host half: route registration and the four read routes, against a stub
 * context and a throwaway workspace. No running app required.
 */

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { apply, inject } from "../lib/index.js";

const SESSION = "session-test";

/** The routes this package registers, in registration order. */
const ROUTES = [
  "/api/session-changes.list",
  "/api/session-changes.file",
  "/api/session-changes.base",
  "/api/session-changes.exists",
];

/**
 * A Host context with just enough of each service.
 * @param input - `{ cwd, turns, summaries }`.
 * @returns the stub context and the registered routes.
 */
function createContext({ cwd, turns, summaries }) {
  const routes = new Map();
  const ctx = {
    connection: {
      fetch: {
        register(route) {
          routes.set(route.path, route);
        },
      },
    },
    sessionQuery: {
      listEvents: async () => turns.map((turn) => ({ type: "workspace/changes", seq: turn.seq })),
    },
    workspaceChanges: {
      summary: (_sessionId, seq) => summaries.get(seq),
    },
    fs: { processPath: (target) => join(cwd, target) },
    effect: (effect) => effect(),
    on: () => () => {},
  };
  apply(ctx);
  return { routes, ctx };
}

/**
 * Call one registered route.
 * @param routes - the registered route map.
 * @param path - the route path.
 * @param query - its query string, without the `?`.
 * @returns the response.
 */
async function call(routes, path, query) {
  const route = routes.get(path);
  assert.ok(route !== undefined, `${path} was not registered`);
  assert.deepEqual(route.methods, ["GET"]);
  return route.fetch(new Request(`http://host${path}?${query}`));
}

/**
 * Make a throwaway workspace with one changed file and one pre-image store.
 * @returns `{ cwd, dispose }`.
 */
async function workspace() {
  const cwd = await mkdtemp(join(tmpdir(), "dsh-session-changes-"));
  const store = join(cwd, ".dsh/session-changes", SESSION);
  await mkdir(join(store, "src"), { recursive: true });
  await mkdir(join(cwd, "src"), { recursive: true });
  return {
    cwd,
    store,
    dispose: () => rm(cwd, { recursive: true, force: true }),
  };
}

/** One turn whose summary points at the fixture workspace. */
function summaryOf(cwd) {
  return {
    turn: 1,
    seq: 3,
    total: 2,
    added: 2,
    deleted: 1,
    cwd,
    files: [
      { path: "src/app.js", display: "src/app.js", added: 1, deleted: 1 },
      { path: "src/new.js", display: "src/new.js", added: 1, deleted: 0 },
    ],
  };
}

test("apply exports the services it injects and registers four read routes", () => {
  assert.deepEqual(inject, ["connection", "sessionQuery", "workspaceChanges", "fs"]);
});

test("the list route folds the Session log into browser rows", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "dsh-session-changes-list-"));
  try {
    const { routes } = createContext({
      cwd,
      turns: [{ seq: 3 }, { seq: 1 }],
      summaries: new Map([
        [
          3,
          {
            ...summaryOf(cwd),
            turn: 2,
            files: [{ path: "src/app.js", display: "src/app.js", added: 2, deleted: 1 }],
          },
        ],
        [1, { ...summaryOf(cwd), turn: 1 }],
      ]),
    });
    const response = await call(routes, "/api/session-changes.list", `sessionId=${SESSION}`);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.deepEqual(
      payload.turns.map((turn) => turn.turn),
      [2, 1],
    );
    assert.equal(payload.turns[0].files[0].path, "src/app.js");
    assert.equal(payload.turns[0].files[0].added, 2);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("the list route refuses a request without a Session", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "dsh-session-changes-nosession-"));
  try {
    const { routes } = createContext({ cwd, turns: [], summaries: new Map() });
    const response = await call(routes, "/api/session-changes.list", "");
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "bad-request" });
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("the file route serves the current text and flags a vanished path", async () => {
  const { cwd, dispose } = await workspace();
  try {
    await writeFile(join(cwd, "src/app.js"), "current text", "utf8");
    const { routes } = createContext({
      cwd,
      turns: [{ seq: 3 }],
      summaries: new Map([[3, summaryOf(cwd)]]),
    });

    const present = await call(
      routes,
      "/api/session-changes.file",
      `sessionId=${SESSION}&seq=3&path=src/app.js`,
    );
    assert.equal(present.status, 200);
    assert.deepEqual(await present.json(), { text: "current text" });

    const gone = await call(
      routes,
      "/api/session-changes.file",
      `sessionId=${SESSION}&seq=3&path=src/missing.js`,
    );
    assert.equal(gone.status, 404);
    assert.equal((await gone.json()).error, "read-ENOENT");
  } finally {
    await dispose();
  }
});

test("the base route answers a pre-image, an absent marker, and a miss", async () => {
  const { cwd, store, dispose } = await workspace();
  try {
    await writeFile(join(store, "src/app.js"), "before text", "utf8");
    await writeFile(join(store, "src/new.js.absent"), "", "utf8");
    const { routes } = createContext({
      cwd,
      turns: [{ seq: 3 }],
      summaries: new Map([[3, summaryOf(cwd)]]),
    });

    const captured = await call(
      routes,
      "/api/session-changes.base",
      `sessionId=${SESSION}&seq=3&path=src/app.js`,
    );
    assert.equal(captured.status, 200);
    assert.deepEqual(await captured.json(), { text: "before text" });

    const absent = await call(
      routes,
      "/api/session-changes.base",
      `sessionId=${SESSION}&seq=3&path=src/new.js`,
    );
    assert.deepEqual(await absent.json(), { absent: true });

    const uncaptured = await call(
      routes,
      "/api/session-changes.base",
      `sessionId=${SESSION}&seq=3&path=src/other.js`,
    );
    assert.equal(uncaptured.status, 404);
    assert.deepEqual(await uncaptured.json(), { error: "not-captured" });

    const outside = await call(
      routes,
      "/api/session-changes.base",
      `sessionId=${SESSION}&seq=3&path=../escape.js`,
    );
    assert.equal(outside.status, 404);
    assert.deepEqual(await outside.json(), { error: "outside-workspace" });
  } finally {
    await dispose();
  }
});

test("the exists route reports which listed paths are still on disk", async () => {
  const { cwd, dispose } = await workspace();
  try {
    await writeFile(join(cwd, "src/app.js"), "current text", "utf8");
    const { routes } = createContext({
      cwd,
      turns: [{ seq: 3 }],
      summaries: new Map([[3, summaryOf(cwd)]]),
    });
    const response = await call(routes, "/api/session-changes.exists", `sessionId=${SESSION}`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      paths: { "src/app.js": "file", "src/new.js": "missing" },
    });
  } finally {
    await dispose();
  }
});
