# 交接文档 — dsh-session-changes

写给下一位接手的人（或新 Session 的 AI）。读完这一页你应该能：知道它是什么、现在到哪一步、怎么验证、还剩什么。

> **2026-10-26 01:25 更新**：0.11.0 的 Host 半边（首次改前备份 + `.base` 路由）已在**真实运行的 App**里跑通，
> 不再是「只做过单元级验证」。浏览器端 `Overall` 的最终观感仍待人工确认（见 §6）。
>
> **2026-10-26 01:55 修 Split 视图没有红绿底色**（只动 `lib/client.js`，`package.json` 版本仍是 0.11.0，
> 这样浏览器强刷就能看到，不用碰 Plugins 里那个开关）。根因在 `DiffPane` 未换行那条 `lane()`：
> `data-kind` 写的是 `side`（`left`/`right`），而 CSS 只认 `del`/`add`/`pad`/`ctx`，于是所有规则都不匹配。
> 改成用 `cell.kind`，并补了 `−`/`+` 号列、行号染色、2px 左侧色条，底色由 10% 提到 16%（带 `rgba` 回退）。
>
> **2026-10-26 02:20 v0.11.1「已删除」状态 + 配色回调**：
> ① 底色回调到 12%（`rgba` 回退同步到 `.09`），并保留 2px 色条；
> ② 新增 `.exists` 路由，Overall/By turn 列表把「盘上已不存在」的文件名加删除线 + 红色、计数淡显；
> ③ 选中这类文件时「现在」一侧按空文本比，Overall 显示整份前像的删除，正文提示「已删除」，
>    不再误报「无法从 Host 读取该文件」；
> ④ payload 的 `before` 改由 `baseState.absent` 推导，Overall 现在也会显示「新文件」。
>
> **2026-10-26 02:35 修「文件过大」误报**：`diffLines` 原先在 `(n+1)*(m+1) > 1.5M` 时返回 `null`，
> 整个面板只剩一句「File too large; changes cannot be shown.」。实测 `lib/client.js` 自己（1586→1616 行，
> 中间 1391×1421 ≈ 1.98M 格）就中招。现在：① `DIFF_CELL_CAP` 提到 **8,000,000**（≈32MB 临时表，实测该文件 12.5ms、16 个 hunk）；
> ② 超预算不再死路，改成「中间整块替换」（前缀/后缀仍是精确上下文）并返回 `coarse:true`，面板提示
> 「改动范围过大，逐行对比已降级为整块替换显示」；③ 「过大」文案只留给真的 `kind:"oversized"`（核心 2 MiB/侧），
> `.file` 的 413 `too-large` 也映射成同一条；④ 顺手修了 ops 为空（空文件）时 `sliceHunk(ops,0,0)` 越界崩的问题。
>
> **2026-10-26 02:00 v0.12.0 工程化**：`lib/client.js` 从 1631 行单文件拆成 `src/client/` 下 46 个文件
> （45 个 JS 模块 + 1 份 `styles.css`），用 **rollup** 打包回 `lib/client.js`（Host 只认这一个 classic script，
> 格式没变：`__ModuleLoader__.load` + factory），全仓 **prettier** 统一格式（含 `lib/index.js`、`styles.css`），
> 并加了 `npm` 脚本与测试。
> **功能零改动**：用同一套 stub 把新旧 bundle 在 11 个场景（By turn/Overall × Split/Inline × Full、已删除、
> 二进制、drift、空会话、列表失败）各渲染一遍，元素树逐字节相同；样式表按 CSS 语义比对也相同
> （prettier 只做了 `.5px`→`0.5px`、`[a=b]`→`[a="b"]`、`content:''`→`content:""`、补分号这类等价改写）。
> 详见 §10。
>
> **2026-10-26 02:16 v0.12.1 对比色再调浅**：红/绿底 `12%` → **`8%`**（rgba 回退 `.09` → `.06`），
> 三处规则一起改（`.dsc-cell` / `.dsc-lrow` / `.dsc-urow`），覆盖 Split 网格、Split 双 lane、Inline 单栏，
> 降级视图用的 `.dsc-lrow` 也一起变浅。2px 左侧色条、行号与 `±` 号染色保持原样，所以「哪边改了」仍一眼可见。
> 只动 `src/client/styles.css` → `npm run build` 后强刷即可，Host 不用重挂载。

---

## 1. 这是什么

一个 DSH Web GUI 的本地插件：右侧栏多一个 **Changes** 页，用来 review「这次会话改了哪些文件」。

- 代码：`C:\Users\kingsimba\Documents\deepseek-harness\default-workspace\plugins\dsh-session-changes`
- 安装方式：Plugins → Add plugin → 粘贴上面的**绝对路径**；`~/.dsh/profiles/desktop/node_modules/dsh-session-changes` 是指向这里的 junction，所以**改代码立即生效**（刷新方式见 §5）
- 版本：`0.12.0`，git 仓库就在插件目录里，tag 从 `v0.3.0` 到 `v0.12.0`

## 2. 现在能做什么

| 维度 | 取值 | 说明 |
|---|---|---|
| 模式 | `By turn` / `Overall` | 左侧文件列表的模式 |
| 范围 | `Full` / 仅 hunk | 整文件 或 只显示改动片段 |
| 布局 | `Split` / `Inline` | 左右两栏 或 单栏统一视图 |

两个维度**正交**，四种组合都支持。

- **By turn**：右侧上方一排 `Turn 1 · Turn 2 · …` chips（从旧到新），点哪一轮左侧列表就显示那一轮改的文件；右侧是那一轮的 diff。
- **Overall**：左侧是全会话去重后的文件表（计数按文件求和），右侧是「**会话开始时 → 现在**」的对比。

## 3. 关键设计：基线（重点）

历史版本靠「从当前文件逆向应用每轮 hunk」来重建基线，文件一旦在会话外被改过就漂移、报错。现在改成**真实备份**：

**Host 端**（`lib/index.js`）：

- 监听 `fs/write-intent` / `fs/edit-intent`（`prepend: true`）。语义已核实：`next()` 只解析意图，**真正写盘在 handler 返回之后**，所以此刻读到的就是「改之前的原文」。
- 实际调用点：`dsh-tool-fs` 里是 `ctx.waterfall("fs/write-intent", target, exec, …)`，第三个参数就是 `tools/pre-execute` 拿到的那个 `exec`，所以 `WeakMap` 对得上。
- 绝对路径取法：`ctx.fs.processPath(target)`（与随包的 `workspace-changes` 完全一致）。
- **每个 Session、每个文件只备份第一次**：`capturedPaths: Map<storeRoot, Set<relPath>>`。
- 落盘：`<workspace>/.dsh/session-changes/<sessionId>/<relative path>`；新建文件写 `<rel>.absent` 标记。
  （`sessionId` 就是 `session-<uuid>` 那个字符串，直接当目录名。）
- `session/disposed` → 删掉该 Session 的整个目录（工作区删掉自然也一起没了）。
- 只有**文件工具**（`write`/`edit`/`str_replace_editor`）触发；shell 重定向抓不到——和记录器一致，属于已知边界。

**路由**（都挂在 `ctx.connection.fetch.register`，需登录态）：

| 路由 | 用途 |
|---|---|
| `GET /api/session-changes.list?sessionId` | 该 Session 所有 `workspace/changes` 汇总（前端列表） |
| `GET /api/session-changes.file?sessionId&seq&path` | 文件**当前**内容（`node:fs`，上限 4MB） |
| `GET /api/session-changes.base?sessionId&seq&path` | 文件的**首次改前原文**；新建返回 `{absent:true}`；未捕获 404 |
| `GET /api/session-changes.exists?sessionId` | 列表里每个 path 现在还在不在盘上：`{paths:{path:"file"\|"other"\|"missing"\|"unknown"}}`（只 `stat`，最多 2000 条） |

**客户端**（`lib/client.js`）：

- `Overall`：`base`（或 absent→空）vs `wholeState.text`（当前文件）→ `diffLines` + `toHunks` → 交给渲染器。**这条路径是精确的，不会漂移。**
- **文件已不在盘上**（`.file` 返回 `read-ENOENT` / `read-ENOTDIR` / `not-file`）：`wholeState` 进 `phase:"missing"`，
  对比的「现在」一侧按空文本处理 → Overall 里整份前像显示为删除；payload 带 `after:false`，正文顶部出现「已删除」。
  同时 `.exists` 的结果让左侧列表把该文件**名字加删除线、字变红**（`.dsc-row[data-missing=true]`）。
  注意：记录器只知道文件工具干的事，shell `rm`/`git checkout` 删掉的文件只能靠这条 `.exists` 查出来。
- `Overall` 的 base 取不到（404）时：`comparison` 直接进 `no-base`，面板只显示「没有记录首次改动前的快照」。
  **不再**回落到 `reverseHunks` 旧重建逻辑——没有基准就不出 diff，绝不拿重建结果冒充基准。
  典型场景：文件在「Host 带上 capture 代码」之前就被本会话改过。
- `By turn`：仍用 Host 的 per-turn hunk（`api/changes.diff`）。
- `By turn + Full`：仍走旧的 `reverseHunks` 重建；重建失败会**降级为「当前文件 + 标注」**（`AnnotatedPane`）并显示提示，不再死路。

## 4. 目录与文件

```
plugins/dsh-session-changes/
├─ package.json          # dsh.bundle.patch + dsh.client + npm scripts（version 0.12.0）
├─ cordis.patch.yml      # insert: session-changes 行
├─ README.md             # 面向用户的功能说明（含 Development 一节）
├─ HANDOVER.md           # 本文件
├─ .prettierrc.json      # 100 列 / 2 空格 / 双引号 / 分号
├─ .prettierignore       # 跳过生成物 lib/client.js 与 *.md
├─ scripts/build.mjs     # rollup：src/client → lib/client.js，带 --check
├─ src/client/           # 浏览器端源码（拆分后的真身，见下）
├─ lib/index.js          # Host：五条路由（list/file/base/watch/open）+ 前像存储（无 recorder 依赖，无构建步骤）
├─ lib/client.js         # 【生成物】rollup 打包结果，别手改
├─ test/                 # harness + diff/bundle 测试（node --test）
└─ profile/              # 快照：~/.dsh/profiles/desktop 的 cordis.patch.yml 与 package.json
```

```
src/client/
├─ index.js               # apply / inject：注册 tab 类型、guide、字典、pane body
├─ changes-tab.js         # 状态与编排（唯一持有页面级 useState 的组件）
├─ hooks/
│   ├─ use-file-list.js     # list（前像存储的索引）+ 刷新计数
│   ├─ use-file-counts.js   # 每行 +N −M：pre-image → 当前文件（带缓存与上限，标 missing/binary/oversized）
│   ├─ use-auto-refresh.js  # 订阅 Host 的失效流（fs.watch / 捕获通知），debounce 1s 后刷新
│   ├─ use-selection.js     # 选中项跟随列表重建（按 path）
│   ├─ use-whole-file.js    # .file，missing/binary/oversized 归一成 phase
│   ├─ use-base.js          # .base
│   ├─ use-comparison.js    # buildComparison 的 memo
│   └─ use-resizable.js     # 宽度、拖拽、键盘微调、ResizeObserver
├─ components/
│   ├─ list-pane.js         # 左栏：标题/统计/状态
│   ├─ list-rows.js         # 文件夹标题 + 文件行
│   ├─ file-row.js          # 一行文件（含删除线状态）
│   ├─ counts.js            # +N −M / binary / too large
│   ├─ right-head.js        # 右栏工具条
│   ├─ detail-pane.js       # 工具条 + body
│   ├─ detail-body.js       # 该显示 pane / note 的判定
│   ├─ split-diff.js        # Split 布局（两条同步滚动的 lane / 换行网格）
│   ├─ inline-diff.js       # Inline 布局（单栏）
│   ├─ diff-text.js         # 高亮文本单元格 + 网格双栏
│   ├─ pane-note.js         # loading/error/binary/oversized 与顶部提示（两布局共用）
│   ├─ error-boundary.js    # TabBoundary
│   └─ tab-body.js          # 注册给 slot 的 body
├─ diff/
│   ├─ lines.js             # diffLines（LCS，超预算降级 coarse）
│   ├─ hunks.js             # sliceHunk / toHunks
│   ├─ rows.js              # hunkRows / splitRows / hunkLabel
│   ├─ highlight.js         # highlightedSide
│   └─ model.js             # 按 ROW_CAP 截断 + 编号 + 成对 + 高亮的统一模型
├─ locale/{en,zh,fallback}.js
├─ api.js                 # 所有 fetch（list/file/base + watch）
├─ comparison.js          # 对比构建：pre-image → 当前文件
├─ grouping.js            # groupFiles（按目录分组）
├─ view.js                # buildView（turns → 单列表 + 汇总）
├─ selection.js           # selectionOf / sameSelection / rowMatchesSelection
├─ storage.js             # localStorage 读写 + 各键默认值
├─ primitives.js          # 共享高亮器（可选，加载失败即纯文本）
├─ react.js               # Host 的 react + h()
├─ loader.js              # 唯一出口：factory 的 require 参数
├─ open-resource.js       # apply 装进去的资源打开器
├─ styles.css             # 全部样式（原 css 字符串）
└─ styles.js              # 一次性注入 <style data-plugin-css>
```

职责边界：`changes-tab.js` 只做编排与交互回调；每次读取一个 `hooks/*`；`components/*` 不读数据；
`diff/*`、`comparison.js`、`grouping.js`、`view.js`、`selection.js` 都是纯函数，可在 Node 里直接测。

**工作区里的测试夹具**：~~`diff-demo/`~~ —— **已于 2026-10-26 01:40 整目录删除**（用户要求清干净）。
需要重现验收时自己建一份即可，要件清单见下面那条 01:35 的记录。
工作区里另外还有改过的 `base.js` 与 `.tmp/asar-*.mjs`（与本次 demo 无关，未动）。

> **2026-10-26 01:35 又改了一轮**（session `f94cc6b7…`），用来复查浏览器端观感，2 个 turn：
> Turn 1 改 `src/app.js`（DEFAULTS/run/新增 `withTimeout`）、`src/util.js`（时长拆分 + `clamp`/`formatPercent`）、
> `data/config.json`（0.2.0、加 archive job）、`notes-zh.md`（追加 2 段），新建 `src/batch.js`（→ `.absent`）；
> Turn 2 再改 `src/app.js`（`describe()`）、追加 `changelog.txt` 4 行、修 `README.md` 的文件表。
> 备份已验证：7 条记录，`app.js` 第二次改后 hash 不变、仍无 `withTimeout`。**这一轮的产物随后被删掉了**，
> `.dsh/session-changes/<sid>/` 下只剩备份副本（指向已不存在的文件，无副作用，session 销毁时自清）。

## 5. 改动怎么生效（很容易踩）

- **改浏览器端**（`src/client/**`）→ `npm run build` → 浏览器强刷 `Ctrl+Shift+R`
- **改了 `lib/index.js` / `cordis.patch.yml` / `package.json`** → 必须让 Host 重新挂载：重启 DSH，或 Plugins 里把 bundle 关开一次
- ⚠️ **`lib/client.js` 是生成物**：手改会被下次 build 覆盖，`npm run build:check` 也会报 stale。
- ⚠️ **别用进程 PID / 启动时间判断「重启成功没有」**：实测点过重启之后，Electron 主进程的 `StartTime` 仍是旧的，但 Host 的 capture 已经开始工作（桌面壳疑似在原地重载 Host，或走了 `dsh-hmr`）。**唯一可靠的判据是：让 Agent 改一个文件，看 `<workspace>/.dsh/session-changes/` 有没有出现/更新。**
- ⚠️ **不要拨插件列表里那个 row 开关**：它会往 `~/.dsh/profiles/desktop/cordis.patch.yml` 写
  `- id: session-changes` + `disabled: true`，再打开也不会清掉，结果就是「插件消失」。
  真要修就改那个文件（删掉那两行）再重启；`profile/` 里有可用版本的快照。

## 6. 已验证到哪一步（2026-10-26 01:25 实测）

证据目录：`default-workspace/.dsh/session-changes/session-842c5895-bb26-4e5d-97b2-48871bf4414d/`

| # | 断言 | 结果 |
|---|---|---|
| 1 | 新建文件落 `.absent` | ✅ `diff-demo/src/queue.js.absent`（0 B） |
| 2 | 已有文件首次改前抓到原文 | ✅ `diff-demo/src/app.js` 1639 B，SHA `AF2CA8B2…`，内容含 `retries: 3`（改前值） |
| 3 | 同文件第二次改不覆盖备份 | ✅ 再改两处后 hash 不变，仍 `AF2CA8B2…` |
| 4 | `.base` 返回改前原文 | ✅ 200，`hasRetries3=true` |
| 5 | `.base` 对新建文件返回 absent | ✅ `{"absent":true}` |
| 6 | `.base` 对未捕获文件 404 | ✅ `{"error":"not-captured"}`（该文件在 capture 上线前被改） |
| 7 | `.base` 越界路径被拒 | ✅ `{"error":"outside-workspace"}` |
| 8 | `.file` 返回当前内容 | ✅ 200，`hasRetries3=false` |

**仍未人工确认的**：浏览器里 `Overall` + `Full` 是否真的行号连续、没有「无法还原该对比的起点」banner；
以及 `Split`/`Inline`、`By turn` chip 联动的观感。这是当前唯一缺口。

> 上表的 store 是**老会话**的目录，会话没 dispose 就会一直在 `.dsh/session-changes/` 下。
> 新会话会生成新的 `session-<uuid>` 子目录，别拿老目录对照。

## 7. 怎么验（新会话照这个顺序跑）

> 为什么强调「新会话」：capture 只对「Host 已带这段代码时发生的第一笔改动」生效。
> 老会话里早先改过的文件没有前像，`Overall` 会掉回旧重建逻辑，**看起来像 bug 其实不是**。
> 新会话每个文件都能拿到干净基线，才是可信的验收环境。

1. **新开一个会话**（工作区仍是 `default-workspace`）
2. 让 Agent 改一个**已存在**的文件，例如 `diff-demo/src/app.js`（换几行、加几行）
3. 确认工作区出现
   `<workspace>/.dsh/session-changes/<sessionId>/diff-demo/src/app.js`，内容是该文件**改之前**的原文
4. 再改同一文件 → 备份**不应**被覆盖（比对 hash）
5. 新建一个文件 → 应有 `<name>.absent`（0 B）
6. Changes → `Overall` → `Full`：应显示「会话开始 → 现在」的整文件对比，**行号连续**，且**不出现**「无法还原该对比的起点」
7. 切 `Inline` / `Split` 各看一遍；点不同 turn chip，左侧列表应随之变化
8. 静态检查与单测：`npm run verify`（= prettier --check + `build.mjs --check` + `node --test test/`）。
   没有 node_modules 时至少跑 `node --check lib/index.js`、`node --check lib/client.js`。
9. Host 逻辑脱机自测（不需要跑 App，也不用登录）：
   - 用桩 `ctx` 加载 `lib/index.js`、调用 `mod.apply(ctx)`，桩要提供
     `connection.fetch.register` / `sessionQuery.listEvents` / `workspaceChanges.summary`
     （返回 `{ cwd: <workspace> }`）/ `fs.processPath` / `effect` / `on`
   - 然后直接 `await handler(new Request(url))` 打 `.base` / `.file`
   - 现成脚本：`node .tmp/route-check.mjs`（在 `default-workspace` 下跑；里面的 `SESSION` 常量按需改）
   - §6 那 8 条就是这么验的，可直接复用

> **在 DSH 自己的沙箱里**：`npm install` 会被拒（npm 的 lifecycle 要 spawn 子进程，报 `spawn EPERM`），
> 但 `npm run build` / `format` / `test` / `verify` 都能正常跑。`npm test` 特意用了
> `--test-isolation=none`（单进程），因为 `node --test` 默认给每个测试文件 spawn 一个子进程，在沙箱里同样 EPERM；
> 想要并行隔离的那套（沙箱外）用 `npm run test:isolated`。实在没有 node_modules 时，退回
> `node --check lib/index.js`、`node --check lib/client.js`。

## 8. 待办 / 已知缺口

1. **只差浏览器端确认**：`Overall` 渲染（§6 表下那段）。其余数据链路已实测通过。
2. `By turn + Full` 仍是逆向重建（因为按决定只存「首次改前」）。要精确需要**每轮**存一份（`<sid>/t<N>/…`），当时被否掉了。若以后想升级，改 `captureBefore` 的 key 加 turn，并在 `turn/start` 时记录 turn。
3. 死代码/小债：拆分时已清掉 `retry(key, entry)`（旧 `lib/client.js:1072`，无人调用）、`WholeFilePane`、以及
   `DetailBody` 里永远不会命中的 `comparison.status === "coarse"` 分支（coarse 现在只经 payload 的
   `data.coarse` 到 pane 顶部提示）。`useResizable` 里只写不读的 `dragRef` 也一并删了。
   保留的一处「有意为之」：`retry` 以前只清缓存不重取，会把面板卡在 loading；现在 `retryEntry` 会顺带
   bump nonce，等于重新拉一遍列表与对比。
4. `.dsh/session-changes/` 会出现在工作区目录树里（由 `node:fs` 写入，不被记录器计入改动列表）。若以后工作区建 git 仓，务必加 `.gitignore`。
5. 备份未做体积上限/二进制处理：超大文件会照样复制一份。需要的话加 `maxFileBytes` 并跳过二进制。
6. `captureBefore` 里 `capturedPaths.add(rel)` 发生在读文件**之前**；若 `stat` 成功但目标不是文件（目录等），函数直接 `return`，rel 已被记为「已捕获」且本会话不再重试。异常路径（非 ENOENT）会 `captured.delete(rel)`，不受影响。正常只改文件的场景碰不到。

## 9. 约定

- 每次改完：`npm run format` → `npm run verify` → `git add -A && git commit`，必要时打 tag（`v0.x.y`）
  （在 DSH 沙箱里 npm 不可用时，见 §7 末尾的 node 直调写法）
- **不要手改 `lib/client.js`**：改 `src/client/**` 后 `npm run build`；提交时把生成物一起提交
- 提交信息用英文一句话；版本号在 `package.json`
- 回滚：`git checkout <tag> -- .`；profile 回滚见 §5

## 10. 这次工程化做了什么（v0.12.0）

**拆分**：1631 行的 `lib/client.js` → `src/client/` 下 46 个文件（45 个 JS 模块 + 1 份 `styles.css`，见 §4），
按「纯函数 / hooks / 展示组件 / 编排」分层。`changes-tab.js` 从 ~700 行降到 179 行，每个 `hooks/*`
只负责一次读取或一段交互。

**打包**：`scripts/build.mjs`（rollup，纯 JS，不依赖原生二进制）把 `src/client/index.js` 打成**与原文件同格式**的
`lib/client.js`：

```text
window.__ModuleLoader__.load({ id, factory: (require) => { ... } })
```

- Host 只认这个格式，所以 rollup 用 `format: "iife"` + `name`，再由脚本套上 loader 外壳（HEADER/FOOTER）。
- `require` 是 factory 的参数；`src/client/loader.js` 里直接写 `require(name)`，rollup 不会去解析它（不是 import），
  运行时自然落到 factory 参数上。这样源码全是普通 ESM，不需要 define 插件。
- `styles.css` 用一个小 rollup 插件当字符串内联，`styles.js` 在加载时注入一次 `<style data-plugin-css>`。
- `node scripts/build.mjs --check` 只比对不写盘，用来防「改了源码忘打包」。

**格式化**：prettier 3（`.prettierrc.json`：100 列 / 2 空格 / 双引号 / 分号 / LF），范围含 `lib/index.js`、
`styles.css`、`scripts/`、`test/`；`lib/client.js` 与 `*.md` 在 `.prettierignore` 里。

**测试**（`test/`，`node --test`）：

- `test/support/harness.mjs`：在 Node 里装 `window`/`document`/`fetch` 和一个带依赖比较的 react 替代，加载
  打包后的 `lib/client.js`，可 `render` / `settle`（按 deps 跑 effect，跟 React 一样）。
- `test/bundle.test.mjs`：注册结果、By turn/Overall 渲染、已删除文件、空会话、列表失败、二进制 payload。
- `test/diff.test.mjs`：`diffLines`（含 coarse 降级）、`toHunks`、`sliceHunk`、`reverseHunks`、`splitRows`、
  `buildComparison` 的七种状态（含 `no-base`）。
- `test/host.test.mjs`：桩 `ctx` + 临时工作区，验四条路由（list 折叠、file 现读/ENOENT、base 的
  原文/absent/not-captured/越界、exists 的 file/missing）。

三个文件共 30 条断言，`npm test` 单进程跑完约 0.3s。

**等价性证据**：`scripts/compare-bundles.mjs <旧 bundle>` 用同一套 stub 渲染 11 个场景（By turn / Overall ×
Split / Inline × Full、已删除、二进制、drift、空会话、列表失败），元素树（tag + 可序列化 props + 文本）
逐字节相同；样式表按语义归一化后相同（prettier 只做了 `.5px`→`0.5px`、`[a=b]`→`[a="b"]`、
`content:''`→`content:""`、补分号这类等价改写）。打包产物 108,766 字符 / 109,400 字节
（原 77,023 字节；差在 prettier 展开的 CSS 字符串与源码缩进/注释，非功能差异）。
复跑：先把旧 bundle 取回来，再执行脚本。
Git Bash / sh：`git show HEAD~1:lib/client.js > .baseline-client.js`；
PowerShell 必须走 cmd，否则 `>` 会写成 UTF-16：`cmd /c "git show HEAD~1:lib/client.js > .baseline-client.js"`。
（顺带发现：旧 `lib/client.js` 开头带一个 UTF-8 BOM，新产物没有——浏览器按 UTF-8 解码，无影响。）

