# dsh-session-changes

An always-available **Changes** page for the DeepSeek Harness right sidebar: a master–detail split with
every file the current Session changed on the left, and the selected file's **side-by-side comparison**
on the right. The divider between them is draggable.

One question, one answer: *what changed since this task started* — the file's first pre-image in this
Session against the file as it stands now. There is no per-turn mode.

## Why

The built-in changed-files card lives in the transcript and scrolls away, and the Review tab it opens
is a right-sidebar tab. Closing that tab used to leave no way back except scrolling to the turn. This
page is a docked tab type, so it stays reachable: `+` (add tab) → **Changes**, any time.

## Layout

```
┌────────────────────┬─┬──────────────────────────────────┐
│ Session changes    │ │ src/app.ts        +12 −3 Split   │
│              +16 −4│ │ ┌────────────┬─────────────────┐ │
│ src/               │ │ │ 41  const… │ 41  const…      │ │
│   app.ts    +12 −3 │ │ │ 42 -old    │ 42 +new         │ │
│ ./                 │ │ │ 43 -gone   │ 43 +added       │ │
│   README.md  +4 −1 │ │ └────────────┴─────────────────┘ │
└────────────────────┴─┴──────────────────────────────────┘
                  ↑ drag to resize
```

* **Files are grouped by folder**: one muted monospace line per folder (`src/components/`, or `./` for
  the workspace root), then the file names alone beneath it — so the list stays narrow and the mouse
  target stays on the name. Folder lines are labels, not collapsible headers.
* **Syntax colours come from the same tokenizer the built-in Review tab uses** — `useCodeHighlighter` and
  `languageForPath` from `@deepseek-ai/dsh-client-ui-primitives` (Shiki). Each hunk side is tokenized
  independently, because the omitted source lines make whole-file tokenization impossible. If the
  primitives module is not exposed to this plugin, the pane degrades to plain text; the grid carries
  `data-spans="false"` when that happens.
* **Drag the divider** (or focus it and press ←/→, Shift for a bigger step) to resize the list. The
  width is remembered per browser.
* **↵** toggles line wrapping. Unwrapped keeps a **fixed 50/50 split**: each lane is its own scroll
  surface and the two are kept in step (vertical and horizontal offsets), so a long line scrolls inside
  its own half instead of widening the pane or moving the divider. Wrapped turns the pane into one 50/50
  grid that wraps inside the cells.
* **Split / Inline** changes the layout only — two 50/50 lanes, or one column with both line numbers, a
  sign, and the line.
* **Full / hunks** changes the scope: hunks only, or the whole file with the changes marked. The choice is
  remembered.
* **⤴** opens the selected file in its default application — VSCode, if that is what the extension is
  associated with. It opens the **live file on disk**, so you can edit it there.
* **↗** opens the same file in the built-in **Review** tab, if you want the full-width view.
* Selections survive a refresh of the list; **↻** re-reads both the list and the comparison.
* **The list and the open comparison keep themselves current.** While the tab is visible, the Host
  streams one frame whenever a listed file changes on disk, and one whenever it captures a new
  pre-image; the tab waits **1 s** for the burst to settle, then re-reads both. No polling. **↻** stays
  for a manual re-read; hiding the tab closes the stream.

## What it shows

Every row answers *"what changed since this task started"*: selecting a file diffs the text it had
**before the Session's first recorded write** — the Host's own pre-image — against the file as it stands now.

* the list is one row per file, deduplicated by path, with `+added/−deleted` **read live**: the
  pre-image against the file as it stands now, the same pair the comparison diffs, so the numbers and the
  pane cannot disagree. Files with no captured pre-image, a binary, an oversized, or an unreadable one keep
  the counts summed over the recorded turns (the roll-up stops at 40 files per refresh);
* the pre-image is the real file text the Host copied just before the Session's first write to that path,
  so the diff cannot drift when the file is edited outside the recorded turns. A path outside the
  workspace gets the same treatment: its copy lives in the sibling `_external` store, named by a SHA-1 of
  the absolute path so a deep path cannot outgrow the Windows path limit, and files the agent edited above
  the workspace (or outside the repository) are compared too;
* a file created during the Session has no pre-image (`absent`), so it reads as entirely added;
* a file whose current text equals its pre-image is **not listed at all**: the page shows what still
  differs, so editing a file back drops its row (and its folder line) instead of reading `+0 −0`;
* a file that is gone from the disk is compared against empty text, so it reads as entirely deleted, and
  its name is struck through in the list;
* a file with no recorded pre-image (it was changed before this Host build started capturing them) has no
  baseline at all, so the pane says exactly that and shows no diff — it never rebuilds one from the turns.

## Editing

DSH's file surfaces are previews: the sidebar document viewer is documented as *preview, not editing*,
and the Agent owns writes. To edit by hand use one of:

* **⤴** here, or the sidebar preview's default-application control — one file.
* The Session header's **Open In…** split button — the whole workspace directory in the remembered app
  (pick VSCode once and it stays).

There is no in-app code editor. Adding one (Monaco/CodeMirror) would put a second writer on every file
the Agent may also be editing, with no LSP and a multi-megabyte bundle; the hand-off above is the
supported path.

## Install

The Desktop profile is managed by the Electron app, so install it through **Plugins**:

1. Sidebar → **Plugins** → **Add plugin**.
2. Enter the published package name `dsh-session-changes`, a Git URL pinned to a commit
   (`git+https://github.com/kingsimba/dsh-session-changes.git#<commit>`), or the absolute
   directory of a local checkout.
3. Confirm **Install** and let it compose.
4. Refresh the app window (Ctrl+R) so the browser loads the new client bundle.
5. In the right sidebar, click **+** (add tab) → **Changes**.

To remove it: **Plugins** → the bundle's page → remove. Nothing else in the profile is touched.

## What it reads

* Host half (`lib/index.js`): the plugin's **own store** under `<workspace>/.dsh/session-changes/` is the
  only source. It copies a file's whole text just before the first `fs/write-intent` / `fs/edit-intent`
  that touches it (or writes an `.absent` marker for a path that did not exist yet), and serves five
  authenticated routes: `api/session-changes.list` (the store's index — which files this Session's
  file tools touched), `api/session-changes.file` (a file's current text, refusing binary and oversized
  ones), `api/session-changes.base` (its stored pre-image, or `{ absent: true }`),
  `api/session-changes.watch` (a newline-delimited stream of `ready` / `file` / `added` / `ping` frames;
  it observes the listed files through `fs.watch`) and `api/session-changes.open` (a POST that hands one
  captured file to the desktop's default application). No per-turn summary is involved.
* Browser half (`src/client/`): a `builtin`-band page tab type plus one `sidebar.right.pane.tab` body.
  It fetches the list, reads one pre-image and one current text per row to number it, and diffs the
  selected file with its own diff engine; it never calls `api/changes.diff`.

## Permissions and data

* **File access** — the Host reads the Session workspace and writes the pre-image store under
  `<workspace>/.dsh/session-changes/`; a path outside the workspace is kept under the sibling
  `_external` store. Nothing is uploaded.
* **HTTP routes** — five authenticated routes under `api/session-changes.*` (list, file, base,
  watch, open) are served through the DSH connection and require the signed-in user.
* **Open in application** — `api/session-changes.open` spawns the OS opener
  (`cmd.exe /c start` on Windows, `open` on macOS, `xdg-open` elsewhere) for a path the Session
  captured and that is still a regular file. It does not accept arbitrary paths.
* **No outbound network, credentials, or telemetry** — the plugin talks only to the DSH Host and
  the local filesystem.
* The Host half runs with DSH's permissions; review `lib/index.js` before installing.

## Development

The shipped browser half is a **generated** file. Sources live in `src/client/`, and `npm run build`
bundles them into `lib/client.js` — one classic script in the Host's `__ModuleLoader__` wrapper, which is
what the sidebar actually loads.

```
npm install        # rollup + prettier
npm run build      # src/client/** -> lib/client.js
npm run format     # prettier --write .
npm run verify     # format:check + build:check + tests
```

* `lib/client.js` is committed, because the plugin runs straight from this directory. Never edit it by
  hand: `npm run build:check` fails when the committed bundle no longer matches the sources.
* The Host half (`lib/index.js`) is plain Node ESM and needs no build step.
* `npm test` renders the built bundle against a stubbed Host (`test/support/harness.mjs`), unit-tests the
  diff engine, the 1 s debounce and the frame parser, and exercises the Host routes (including the watch
  stream) against a throwaway workspace, so a refactor that changes the markup or a route fails loudly. It
  runs in one process (`--test-isolation=none`) so it also works inside DSH's own sandbox;
  `npm run test:isolated` uses the runner's usual per-file processes instead.
* `node scripts/compare-bundles.mjs <old-client.js>` renders two builds side by side over eleven scenarios
  and diffs the element trees — the check that proved the `src/client` split changed nothing.
* Layout: `src/client/index.js` registers the tab; `changes-tab.js` holds state; `hooks/` owns every read;
  `components/` is presentational; `diff/` is the pure diff engine.

## Updating a local install

The installer links the profile to this directory (`link:…` in the profile's `package.json`), so edits here
are live after a build: change `src/client/**`, run `npm run build`, then **Ctrl+R**. Only a change to the
Host half (`lib/index.js`, `cordis.patch.yml`, `package.json`) needs the plugin re-composed — disable and
re-enable it on its Plugins page.

## Known limits

* The list is per Session, from the plugin's own store. It survives an app restart (the store is on
  disk) but only covers files the Session's **file tools** wrote — a file changed only by a shell
  command was never captured, so it is not listed in either world.
* Outside a git work tree the recorder used to list file-tool edits only; this page no longer reads the
  recorder at all, so the rule is the same everywhere: the file tools' pre-images are the list.
* The list is not a git working-tree view and does not show uncommitted changes made outside the agent.
* Stores are kept when a Session is disposed, so a reopened Session still lists its files; nothing prunes
  old stores automatically (they live under `.dsh/`, which `git` ignores).
* The watch follows the files the list already shows, so a brand-new file appears as soon as its
  pre-image is captured — before its turn closes — not the instant it is created on disk.
