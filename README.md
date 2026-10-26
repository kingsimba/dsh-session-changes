# dsh-session-changes

An always-available **Changes** page for the DeepSeek Harness right sidebar: a master–detail split with
every file the current Session changed on the left, grouped by turn, and the selected file's
**side-by-side comparison** on the right. The divider between them is draggable.

## Why

The built-in changed-files card lives in the transcript and scrolls away, and the Review tab it opens
is a right-sidebar tab. Closing that tab used to leave no way back except scrolling to the turn. This
page is a docked tab type, so it stays reachable: `+` (add tab) → **Changes**, any time.

## Layout

```
┌────────────────────┬─┬──────────────────────────────────┐
│ Session changes    │ │ src/app.ts        +12 −3 ↵ ⤴ ↗   │
│ Turn 3      2 files│ │ ┌────────────┬─────────────────┐ │
│ src/               │ │ │ 41  const… │ 41  const…      │ │
│   app.ts    +12 −3 │ │ │ 42 -old    │ 42 +new         │ │
│ ./                 │ │ │ 43 -gone   │ 43 +added       │ │
│   README.md  +4 −1 │ │ └────────────┴─────────────────┘ │
└────────────────────┴─┴──────────────────────────────────┘
                  ↑ drag to resize
```

* **Files are grouped by folder** inside each turn: one muted monospace line per folder (`src/components/`,
  or `./` for the workspace root), then the file names alone beneath it — so the list stays narrow and
  the mouse target stays on the name. Folder lines are labels, not collapsible headers.
* **Syntax colours come from the same tokenizer the built-in Review tab uses** — `useCodeHighlighter` and
  `languageForPath` from `@deepseek-ai/dsh-client-ui-primitives` (Shiki). Like the Review tab, each hunk
  side is tokenized independently, because the omitted source lines make whole-file tokenization
  impossible. If the primitives module is not exposed to this plugin, the pane degrades to plain text;
  the grid carries `data-spans="false"` when that happens.
* **Two modes** — `By turn` keeps a **turn strip above the comparison** (every turn, oldest first, newest
  selected by default) and the left list shows **that turn's files**, so the strip drives both panes.
  `Overall` merges every turn into one row per file with counts summed, and the comparison becomes the
  baseline→current diff. The mode choice is remembered.
* **Drag the divider** (or focus it and press ←/→, Shift for a bigger step) to resize the list. The
  width is remembered per browser.
* **↵** toggles line wrapping. Unwrapped keeps a **fixed 50/50 split**: each lane is its own scroll
  surface and the two are kept in step (vertical and horizontal offsets), so a long line scrolls inside
  its own half instead of widening the pane or moving the divider. Wrapped turns the pane into one 50/50
  grid that wraps inside the cells.
* **Full / hunks** and **Split / Inline** are two independent axes:
  * **Full** changes the *scope* — hunks only, or the whole file. It rebuilds the file's text on both
    sides of the comparison (`reverseHunks` back through the newer turns), so the full view is a real
    whole-file diff, not just the current text.
  * **Split / Inline** changes the *layout* — two 50/50 lanes, or one column with both line numbers, a
    sign, and the line. Either layout renders either scope.
* **⤴** opens the selected file in its default application — VSCode, if that is what the extension is
  associated with. It opens the **live file on disk**, not the turn's snapshot, so you can edit it there.
* **↗** opens the same file in the built-in **Review** tab, if you want the full-width view.
* Selections survive a refresh of the list; **↻** re-reads both the list and the comparison.
* **The list and the open comparison keep themselves current.** While the tab is visible, the Host
  streams one frame whenever a listed file changes on disk, and one when a turn commits its
  `workspace/changes`; the tab waits **1 s** for the burst to settle, then re-reads both. No polling, no
  waiting for a turn to close before a repeated edit shows up in the comparison. **↻** stays for a manual
  re-read; hiding the tab closes the stream.

## Overall mode

`Overall` answers *"what changed since this task started"*: selecting a file diffs the text it had
**before the Session's first recorded turn** — the Host's own pre-image — against the file as it stands now.

* the list is one row per file, deduplicated by path, with `+added/−deleted` **read live**: the
  pre-image against the file as it stands now, the same pair the comparison diffs, so the numbers and the
  pane cannot disagree. Files with no captured pre-image, a binary, an oversized, or an unreadable one keep
  the counts summed over the recorded turns (the roll-up stops at 40 files per refresh);
* the comparison is a **single** diff (pre-image → current), not a set of per-turn diffs;
* the pre-image is the real file text the Host copied just before the Session's first write to that path,
  so the diff cannot drift when the file is edited outside the recorded turns. A path outside the
  workspace gets the same treatment: its copy lives in the sibling `_external` store, named by a SHA-1 of
  the absolute path so a deep path cannot outgrow the Windows path limit, and files the agent edited above
  the workspace (or outside the repository) are compared too;
* a file created during the Session has no pre-image (`absent`), so it reads as entirely added;
* a file whose current text equals its pre-image is **not listed at all**: Overall shows what still
  differs, so editing a file back drops its row (and its folder line) instead of reading `+0 −0`;
* a file that is gone from the disk is compared against empty text, so it reads as entirely deleted, and
  its name is struck through in the list;
* a file with no recorded pre-image (it was changed before this Host build started capturing them) has no
  baseline at all, so the pane says exactly that and shows no diff — it never rebuilds one from the turns.

`Full` in **By turn** still rebuilds the state just before the chosen turn with `reverseHunks`; when that
walk no longer lines up, the pane annotates the current file and explains why, instead of dead-ending.

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

The Desktop profile is managed by the Electron app, so install it the way the app expects:

1. Sidebar → **Plugins** → **Add plugin**
2. Paste the absolute directory:

   ```
   C:\Users\kingsimba\Documents\deepseek-harness\default-workspace\plugins\dsh-session-changes
   ```

3. Confirm **Install** and let it compose.
4. Refresh the app window (Ctrl+R) so the browser loads the new client bundle.
5. In the right sidebar, click **+** (add tab) → **Changes**.

To remove it: **Plugins** → the bundle's page → remove. Nothing else in the profile is touched.

## What it reads

* Host half (`lib/index.js`): five authenticated GET routes — `api/session-changes.list` (the turn list,
  joined with the recorder's live summaries, **keeping only files the Session's file tools actually
  changed**: a file with no captured pre-image is a build artifact or an outside edit the recorder saw
  through git, not something this page can compare), `api/session-changes.file` (a file's current text),
  `api/session-changes.base` (its first pre-image, or `{ absent: true }`), `api/session-changes.exists`
  (which listed paths are still on disk) and `api/session-changes.watch` (a newline-delimited stream of
  `ready` / `file` / `turn` / `ping` frames; it observes the listed files through `fs.watch` and the next
  `workspace/changes` append through `session/event`). It also copies a file's pre-image on the first
  `fs/write-intent` / `fs/edit-intent` of each path.
* Browser half (`src/client/`): a `builtin`-band page tab type plus one `sidebar.right.pane.tab` body.
  Per-turn comparisons come from the existing `api/changes.diff` route (the same one the built-in Review
  tab uses) and are cached per tab; **↻** clears the cache and re-reads.

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
  diff core, the 1 s debounce and the frame parser, and exercises the Host routes (including the watch
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

These are inherited from the recorder, not this plugin:

* Summaries live only as long as the Session in the running Host process. After an app restart, older
  turns have no comparison and therefore drop out of this list.
* Outside a git work tree the recorder lists **file-tool edits only** — files written by shell commands
  in a non-repository workspace are not listed.
* The list is per Session; it is not a git working-tree view and does not show uncommitted changes
  made outside the agent.
* Only files the Session's **file tools** changed are listed. In a git work tree the recorder also sees
  whatever a shell command wrote (a `npm run build` bundle, a lockfile), but those have no pre-image, so
  they are filtered out of every mode instead of appearing as undiffable rows.
* The watch follows the files the list already shows, so a brand-new file appears when its turn commits
  (the `turn` frame), not the moment it is created.
