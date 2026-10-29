# 交接文档 — dsh-session-changes

写给下一位接手的人（或新 Session 的 AI）。读完这一页你应该能：知道它是什么、现在到哪一步、怎么验证、还剩什么。

> **2026-10-29「选中 token 高亮」**：diff 里双击（或拖选）一个标识符，视图内所有同名 token 标黄；
> 整词匹配（`motorState` 不命中 `motorStateCache`），支持 `sensor::LidarData` 这类限定名。高亮用
> CSS Custom Highlight API，不碰 DOM 文本，所以 **Ctrl+C 仍可用**；没有该 API 时回退到 `<mark>`。
> 选中状态在 `DetailBody`（带 viewKey），换文件/范围、Esc 或单击即清。详见 §3.6。
> 同日修复：文件已删除且前像也为空（新建后又删掉，或 Accept 掉了删除）时，列表不再残留
> `+0 −0` 的幽灵行——`buildRows` 现在只在**计数读不到**时才保留 missing 行。

> **2026-10-28「侧栏收起/展开不再卡长 diff」**：
> ① 现象：diff 很长（尤其 **Full** 作用域）时，点右侧栏的收起/展开，动画会明显卡顿。
> ② 根因：侧栏每次展开/收起都会让 `sidebar.right.pane.tab` 的 body 重渲染一次；`buildRows` 每次
> 返回新行对象 → `selected` 变新 → `useComparison` 失效 → 整个文件重新 diff；`DetailBody` 每次
> 又构造新的 payload → `SplitDiff`/`InlineDiff` 的 `buildDiffModel`（编号、成对、Shiki 高亮）也
> 失效。于是**只因为面板宽度/可见性变化**，长 diff 就被重新 diff、重新高亮、重新创建上万节点。
> ③ 修复：`rows`、`selected`、`totals` 用 `useMemo`；`DetailPane` 用 `useMemo` 缓存元素，并在依赖里
> 列全动作闭包会读的 baseline/whole/selection/busy（只换几何时 React 直接跳过整棵对比树）；
> `DetailBody` 的 payload 改由 `useMemo` 按真正的内容输入生成；`useFileList` 对**未变化的列表**
> 保留原数组（展开时不再把每个文件的计数与对比全部重读）；`useResizable` 去掉 `ResizeObserver`，
> 改用左栏 CSS `max-width` 兜底（原来它会在宽度变化时逐帧 `setState`，还会把用户拖好的宽度压小）。
> 回归测试：`bundle.test.mjs` 的 "reopening the tab re-reads the list but not every comparison"。
> 详见 §3.5 与 §7。

> **2026-10-27 v0.15.2「切换 Session 恢复现场 + 不再闪现 undefined」**：
> ① 新增 `session-memory.js`：按 Session 记住**选中的文件路径**、**最后一次行计数**、
> **对比区滚动偏移**（按 session/file/scope/layout/wrap 分 key）。页面级内存，刷新页面即清空。
> ② `TabBody` 给 `ChangesTab` 加 `key={sessionId}`：侧栏复用 slot 换 Session 时干净重挂载；
> 挂载时从 memory 恢复选中与计数，`useSelection` 增加 `ready` 门闩，列表首次 loading 的空数组
> 不会清掉恢复的选中。
> ③ 列表行计数改为从 memory 播种：切换回来立刻有数字；完全 accept 的文件在用缓存计数过滤后
> **不会先出现再消失**。未读到的计数显示安静的 `…`，不再渲染 `+undefined −undefined`
> （`Counts` 组件）。`useFileCounts` 新增 `forget(paths)`，整文件/整列表动作成功后先隐藏对应行。
> ④ `SplitDiff` / `InlineDiff` 在内容真正渲染出来后恢复 `scrollTop/scrollLeft`（左右 lane 各一份），
> 滚动时实时写回；`viewKey` 由 Session + 文件 + Full/hunks 组成，布局/换行再分 key。
> ⑤ `useBase` / `useWholeFile` 增加 `loadedKey` 门闩：文件切换后的第一帧不再拿上一个文件的文本
> 参与 diff（否则会短暂混合，也会让滚动恢复作用在旧内容上）。
> 详见 §3.4。

> **2026-10-27 v0.15.1「accept 不重读、滚动位置不丢」**：
> ① 逐块 accept/revert 成功后不再 `refreshAll()`：`useBase` / `useWholeFile` 新增 `apply()`，
> 用已经算好的文本直接更新对比；`useFileCounts` 新增 `apply()`，用同一对文本更新该行计数。
> 因此一次块操作**零重读**（测试用请求计数断言），diff 组件不卸载、滚动条不动。
> ② `useBase` / `useWholeFile` 改为 **stale-while-revalidate**：非首次读取时保留上一次 ready 状态，
> 不再先置 `loading`。以前每次自动/手动/整批刷新都会把 diff 换成一句 loading，组件卸载后
> 重新挂载 → 滚动回到开头；现在后台刷新在原地更新，滚动位置保留。
> ③ `useFileCounts` 加了 generation 守卫，避免动作前发出的旧读取在 `apply()` 之后覆盖新计数/前像缓存。
> 详见 §3.3。

> **2026-10-27 v0.15.0「整文件 / 整列表操作 + 去掉双重刷新」**：
> ① 左侧每个文件行悬停出现 `Accept` / `Revert`，作用于**该文件的全部剩余改动**；列表顶部新增
> `Accept All` / `Revert All` 行，**Revert All 先在行内问一次确认**（不弹 `window.confirm`）。
> ② 新增 `POST api/session-changes.apply-file` / `.apply-all`：用 `copyFile` **按字节**改前像/当前文件，
> 二进制不会被 UTF-8 解码破坏；apply-all 对每个文件独立计数，单个失败不会中断整批。
> ③ 修「accept 后刷新两次」：每个挂载的 Tab 生成 `clientId`，watch 流带 `client=id`，写请求带 `source:id`；
> Host 用 `source` 标记本次写造成的 `file` 帧（revert 的 `fs.watch` 回显用 1.5s 的 `recentWrites`
> 按路径归因），对应 Tab 的流直接跳过，其他 Tab 照常刷新。
> 详见 §3.1、§3.2 与 §4 的新文件。

> **2026-10-27 v0.14.0「逐块接受 / 还原」**：diff 视图里每个红/绿改动块在鼠标悬停时出现
> `Accept` / `Revert` 两个按钮（Split 的绿块在右栏、纯删除块在左栏红块，Inline 为改动行；移开即消失）。
> **Accept** 把该块的「新行」写回 **首次改前快照**（`<workspace>/.dsh/session-changes/<sid>/<rel>`），
> 该块随即不再算作改动；**Revert** 把该块的「旧行」写回**磁盘上的当前文件**。
> 新建文件的所有行被整体 Revert 时删除该文件（恢复到「会话前不存在」）。
> 两条新路由 `POST api/session-changes.accept` / `.revert` 都带 `expect`（浏览器读到的被替换侧
> 文本的 SHA-256）；Host 在写前重算，不匹配返回 `409 changed`，**绝不覆盖** diff 打开之后 Agent
> 又改过的内容。写 Host 路由后必须重启 DSH 或关开 bundle 才生效；客户端改完 `pnpm run build` 后强刷。
> 详见 §3.1 与 §4 的新文件。

> **2026-10-27 发布准备**：0.13.1 整理为可发布包（移除 `private`，补 `engines.dsh`、MIT LICENSE、icon、
> `locale/*.json` 的 meta 与 npm 元数据）；安装文档改为 npm / Git / 本地目录三种入口。

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
> 只动 `src/client/styles.css` → `pnpm run build` 后强刷即可，Host 不用重挂载。

---

## 1. 这是什么

一个 DSH Web GUI 的本地插件：右侧栏多一个 **Changes** 页，用来 review「这次会话改了哪些文件」。

- 代码：`C:\Users\kingsimba\Documents\deepseek-harness\default-workspace\plugins\dsh-session-changes`
- 安装方式：Plugins → Add plugin → npm 包名 `dsh-session-changes` / Git URL / 本地绝对路径；开发时
  `~/.dsh/profiles/desktop/node_modules/dsh-session-changes` 是指向这里的 junction，所以**改代码立即生效**（刷新方式见 §5）
- 版本：`0.15.2`，git 仓库就在插件目录里，tag 从 `v0.3.0` 到 `v0.12.1`（`v0.13.x`、`v0.14.x`、`v0.15.x` 待打）

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
| `GET /api/session-changes.list?sessionId` | 前像存储的索引：该 Session 文件工具碰过的文件（前端列表） |
| `GET /api/session-changes.file?sessionId&path` | 文件**当前**内容（`node:fs`，上限 4MB；binary/too-large 归一成错误码） |
| `GET /api/session-changes.base?sessionId&path` | 文件的**首次改前原文**；新建返回 `{absent:true}`；未捕获 404 |
| `GET /api/session-changes.watch?sessionId&client` | ndjson 失效流：`ready` / `file` / `added` / `ping`；`fs.watch` 观察列表里的文件；带 `client` 时跳过该 Tab 自己写入造成的帧 |
| `POST /api/session-changes.open?sessionId&path` | 用桌面默认应用打开一个**已捕获**的文件 |
| `POST /api/session-changes.accept` | body `{sessionId,path,text,expect,source}`；把 `text` 写回**前像**，删掉 `.absent`（如存在） |
| `POST /api/session-changes.revert` | body 同上；把 `text` 写回**磁盘文件**；`text===""` 且前像为 absent 时删除该文件 |
| `POST /api/session-changes.apply-file` | body `{sessionId,path,action,source}`；整文件 accept（当前字节→前像）或 revert（前像字节→当前文件，absent 则删） |
| `POST /api/session-changes.apply-all` | body `{sessionId,action,source}`；对 `listFiles` 的每个文件做一次 apply-file，返回 `{ok,files,failed}` |

### 3.1 逐块接受 / 还原（v0.14.0）

- 客户端 `diff/blocks.js` 把每个 hunk 的连续 `-`/`+` 行切成一个 **change block**：带 `oldStart/oldLines`
  与 `newStart/newLines`（纯插入 `oldLines=0`，纯删除 `newLines=0`）以及 `deleted[]`/`added[]` 文本。
  `diff/model.js` 把 block 挂到对应行（`splitRows` 把 `row.block` 带到配对行上），`ROW_CAP` 截断的
  hunk 标 `editable:false`，不出按钮。
- `components/block-actions.js` 渲染一对按钮；它们就在改动行里，靠 CSS `:hover`/`:focus-within`
  显隐（`styles.css` 里 `.dsc-actions` 用 `position: sticky; right`，长行横向滚动时也停在右缘）。
  Split 的按钮落在**有 new 侧的那一半**（绿块在右栏）；纯删除行没有 new 侧，按钮落在左栏红块上。
  Inline 每个改动行各一份。
- 点击后 `changes-tab.js` 用 `text-patch.js` 的 `spliceLines` 在本地拼出该侧的完整新文本：
  - accept：`base.split("\n")` 的 `[oldStart-1, oldStart-1+oldLines)` 换成 `added`；
  - revert：当前文本的 `[newStart-1, newStart-1+newLines)` 换成 `deleted`。
  然后 `hashText(被替换侧原文)`（WebCrypto SHA-256）作为 `expect` POST 给 Host。
- Host 在写前重新读取被替换侧并算同一个 SHA-256：不一致 → `409 {error:"changed"}`，不写。
  成功后 `notify(sessionId,{t:"file",source})`；**执行动作的 Tab 不再重读**，而是把已算好的
  `text` 通过 `useBase.apply()` / `useWholeFile.apply()` 直接写进对比，并用同一对文本调用
  `useFileCounts.apply()` 更新该行计数——diff 不卸载，滚动位置不动。冲突时显示 `applyConflict`
  提示，并 `refreshAll()` 一次以显示 Host 实际持有的内容（这次刷新也不卸载，见 §3.3）。
- 新建文件整体 revert（`text===""` 且 `.absent` 存在）→ `rm` 该文件，返回 `{ok:true,deleted:true}`。
- 注意：**accept 会覆盖前像里的旧行**，没有第二份备份；误接受只能靠文件自身 VCS 找回。

### 3.2 整文件 / 整列表，以及单次刷新（v0.15.0）

- 列表行：`components/file-row.js` 从 `<button>` 改成 `div.dsc-row` + 内层 `button.dsc-row-main`
  （按钮不能嵌套 button）；`.dsc-row-actions` 绝对定位在行右端，`:hover`/`:focus-within` 显示，
  同时隐藏 `.dsc-counts`。动作调用 `applyFile(action, path)`。
- 顶部整列表行：`components/all-row.js`，`Accept All` 直接 `applyAll("accept")`；`Revert All` 先
  `setConfirmRevertAll(true)`，同一行变成问题 + `Revert`/`Cancel`，只有 confirm 才发写请求。
  `rows.length === 0` 时整行不渲染，列表变空会自动收起确认。
- Host `applyWholeFile` 用 `copyFile` 而不是读写文本：二进制/任意字节原样复制；accept 时删 `.absent`，
  revert 时 absent 则 `rm`、否则 `mkdir -p` 后 `copyFile`。`handleApplyAll` 逐文件 try/catch，
  返回 `{files,failed}`，客户端用 `applyPartial` 提示部分失败。
- **单次刷新**：`changes-tab.js` 为每个挂载的 Tab 生成 `clientId`（`client-id.js`），
  `watchChanges` 带 `client=`，三类写请求带 `source=`。Host：
  - `handleWatch` 的 `send` 丢弃 `frame.source === clientId` 的帧；
  - `handleApply*` 的 `notify` 带上 `source`；
  - revert 在写盘前 `markWrite(sessionId, absolute, source)`，`handleWatch` 的 `fs.watch` 回调用
    `writeSource(...)`（`RECENT_WRITE_MS = 1500`，按 `sessionId\0absolute` 记录、只读不消费，所有
    stream 都能读到同一归因）给 fs 回显打上 `source`。这样**执行动作的 Tab 两条帧都跳过**，
    其他 Tab 照常收到；执行 Tab 只在 POST 成功后 `refreshAll()` 一次。
  - 已知残余：revert 后 1.5s 内 Agent 对**同一文件**的写入会被误归因，动作 Tab 会跳过那一帧
    （其他 Tab 仍刷新），下一次失效或手动 ↻ 会补上。

### 3.3 不重读与滚动保持（v0.15.1）

- `use-base.js` / `use-whole-file.js` 返回 `{ state, apply }`：
  - effect 里只在 **key 变化**（session 或 path 变）时 `setState({phase:"loading"})`；同一文件因
    `nonce` 重读时保留上一次 ready 状态。以前无条件置 loading 会让 `buildComparison` 变 pending，
    `DetailBody` 把 diff 换成一句 note，`SplitDiff` 卸载，滚动条回到 0。
  - `apply()` 直接写入已知文本；用 `version` ref 让**动作前发出的在途读取**无法覆盖它；
    key 不匹配（用户在请求期间切了文件）时忽略。
- `use-file-counts.js` 返回 `{ counts, apply }`：
  - `apply(path, before, after, extra)` 更新一行计数并把新前像写进缓存；
  - effect 用 `generation` ref 守卫：`apply` 之后，之前那轮读取即使晚到也不会覆盖计数/缓存；
    新读到的前像先收集在局部 Map，通过守卫后才提交。
- 逐块 accept/revert：本地 `apply` 两边，**不发任何 GET**；行计数若归零，列表行自然消失
  （`buildRows` 的既有规则）。`baseVersion` 只在**整文件/整列表 accept** 时 bump，用来丢弃
  所有前像缓存并重读一次。
- 整文件/整列表操作仍然 `refreshAll()`（需要刷新其他文件的计数与二进制标记）；靠
  stale-while-revalidate 保住已挂载的 diff 和滚动位置。自动刷新、手动 ↻ 同样受益。

### 3.4 切换 Session 的现场恢复（v0.15.2）

- `session-memory.js`（页面级 Map，刷新页面即清空）：
  - `readSelection/writeSelection(sessionId, path)`；
  - `readCounts/writeCounts(sessionId, counts)`；
  - `readScroll/writeScroll(key, {top,left,top2?,left2?})`。
- `components/tab-body.js`：`h(ChangesTab, { ...props, key: props.sessionId })`。侧栏换 Session/workspace
  时强制重挂载，`useState(() => readSelection(sessionId))` 才能读到该 Session 的现场。
- `hooks/use-selection.js`：新增 `ready`；只有列表不再 `loading` 才决定「选中是否还在列表里」。
  否则首次 mount 的空 `files` 会立刻把恢复的选中清成 null。
- `hooks/use-file-counts.js`：
  - 初始 state 从 `readCounts(sessionId)` 播种；`files` 为空时 effect 直接返回，**不要**用 `{}` 覆盖缓存；
  - 每次读完成、每次 `apply()`、每次 `forget()` 都写回 memory；
  - `forget(paths)` 用于整文件/整列表动作成功后立即隐藏行（0/0），随后 `refreshAll` 再核对。
- `components/counts.js`：`added`/`deleted` 为 undefined 时渲染 muted `…`，不再出现 `+undefined −undefined`。
- 滚动恢复：
  - `DetailBody` 组成 `viewKey = sessionId + "\0" + path + "\0" + (full|hunks)`，传给两个 diff 组件；
  - `SplitDiff` / `InlineDiff` 再按 layout + wrap 加后缀得到 `memoryKey`；
  - 内容 `model` 首次非空时 `restore()`（左右 lane 分别恢复，wrapped/inline 恢复 `.dsc-dbody`），
    之后同一 key 的 model 变化不再覆盖用户滚动；
  - `onScroll` 实时 `remember()`；key 变化/卸载时也尝试保存（DOM 已卸载时为 no-op）。
  - `restored` 按 `memoryKey` 重置：换文件、换 Session、换布局/换行都会重新恢复对应 key 的位置。
- `useBase` / `useWholeFile`：返回 `state: loadedKey.current === key ? state : undefined`。选择切换后的
  第一帧若还拿着上一个文件的数据，会混合出错误 diff，并让滚动恢复作用在旧内容上；门闩把它挡掉。

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

### 3.5 几何/可见性变化不重算 diff（2026-10-28）

- 侧栏用 `transform` 滑出、grid 轨道做过渡；但 `sidebar.right.pane.tab` 的 body 仍会因 layout store
  变化而重渲染。因此「面板动一下」不能等于「diff 重算一次」。
- 稳定链：`useFileList` 对相同列表保留原数组 → `buildRows` 按 `[files, counts]` memo → `selected`
  按 `[rows, selectedPath]` memo → `useComparison` 不失效 → `DetailBody` 的 payload memo →
  `buildDiffModel` 复用（编号、成对、Shiki 高亮都不再重跑）。
- `changes-tab.js` 用 `useMemo` 缓存 `DetailPane` 元素。React 在 `oldProps === newProps` 时会直接
  bail out，所以只换几何时整棵对比树被跳过。依赖必须列全 `applyBlock` / `applyFile` / `applyAll`
  闭包会读的值（`selectedPath`、`baseState`、`wholeState`、`rows`、`busyKey` 等），否则缓存元素会
  拿旧基线去 accept/revert。
- `components/list-pane.js` 用 `maxWidth: calc(100% - MIN_RIGHT)` 兜底，替代 `useResizable` 里原来的
  `ResizeObserver`：后者会在宽度过渡的每一帧 `setState`，并把用户拖好的宽度压到 180 且不再恢复。
- 不要把 `busy` / `actionError` 放进 `DetailBody` 的 payload memo：payload 只描述内容；按钮状态变化
  时重渲染外壳即可，模型和行不需要重算。

### 3.6 选中 token 高亮（2026-10-29）

- 选区：`.dsc-dbody` 的 `onMouseUp` → `token-highlight.js` 的 `selectedToken()`：非折叠、至少一端在
  `.dsc-code` 内、且 `tokenOf()` 认作一个标识符（`a`、`a::b`、`a.b`、`a->b`；空白/超 200 字符/数字不算）。
- 匹配：`diff/tokens.js` 用 `(?<![\p{ID_Continue}$])…(?!…)` 做整词命中；每行先拼整行再切 syntax
  span，所以被 tokenizer 拆开的 `sensor` / `::` / `LidarData` 仍算一个。`patternFor` 缓存 32 条。
- 渲染：`hooks/use-token-highlight.js` 把 `collectRanges()` 的 Range 注册到
  `CSS.highlights.set("dsc-token-hit", …)`，**DOM 文本不变**，选区与 Ctrl+C 保留；没有该 API 时
  `DiffText` 用 `sliceSpans` 包 `<mark class="dsc-tok">`。样式是亮黄 + 深色字，见 `styles.css`。
- 清除：选中状态存在 `DetailBody`（按 viewKey），换文件/范围自然失效；折叠选区、非 token 选区或
  Esc（token 非空时才挂 keydown）都会清。**不渲染计数条**：顶部出现/消失会让视图跳动。

## 4. 目录与文件

```
plugins/dsh-session-changes/
├─ package.json          # dsh.bundle.patch + dsh.client + pnpm scripts（version 0.15.2）
├─ cordis.patch.yml      # insert: session-changes 行
├─ README.md             # 面向用户的功能说明（含 Development 一节）
├─ HANDOVER.md           # 本文件
├─ .prettierrc.json      # 100 列 / 2 空格 / 双引号 / 分号
├─ .prettierignore       # 跳过生成物 lib/client.js 与 *.md
├─ scripts/build.mjs     # rollup：src/client → lib/client.js，带 --check
├─ src/client/           # 浏览器端源码（拆分后的真身，见下）
├─ lib/index.js          # Host：九条路由（list/file/base/watch/open/accept/revert/apply-file/apply-all）+ 前像存储（无 recorder 依赖，无构建步骤）
├─ lib/client.js         # 【生成物】rollup 打包结果，别手改
├─ test/                 # harness + diff/bundle 测试（node --test）
└─ profile/              # 快照：~/.dsh/profiles/desktop 的 cordis.patch.yml 与 package.json
```

```
src/client/
├─ index.js               # apply / inject：注册 tab 类型、guide、字典、pane body、快捷键命令（session.changes.open）
├─ changes-tab.js         # 状态与编排（唯一持有页面级 useState 的组件）
├─ hooks/
│   ├─ use-file-list.js     # list（前像存储的索引）+ 刷新计数
│   ├─ use-file-counts.js   # 每行 +N −M：pre-image → 当前文件（缓存、上限、missing/binary/oversized；apply 本地更新一行）
│   ├─ use-auto-refresh.js  # 订阅 Host 的失效流（fs.watch / 捕获通知），debounce 1s 后刷新
│   ├─ use-selection.js     # 选中项跟随列表重建（按 path）；ready 之前不裁决
│   ├─ use-whole-file.js    # .file，missing/binary/oversized 归一成 phase；重读保留 ready；apply 本地写入
│   ├─ use-base.js          # .base；重读保留 ready；apply 本地写入
│   ├─ use-comparison.js    # buildComparison 的 memo
│   ├─ use-token-highlight.js # 把选中 token 的 Range 注册到 CSS.highlights（不碰 DOM 文本）
│   └─ use-resizable.js     # 宽度、拖拽、键盘微调（宽度上限交给左栏 CSS max-width）
├─ components/
│   ├─ list-pane.js         # 左栏：标题/统计/状态 + 顶部 Accept All / Revert All
│   ├─ all-row.js           # 整列表操作行（Revert All 的行内确认）
│   ├─ list-rows.js         # 文件夹标题 + 文件行
│   ├─ file-row.js          # 一行文件（删除线状态 + 悬停 Accept/Revert）
│   ├─ counts.js            # +N −M / binary / too large
│   ├─ right-head.js        # 右栏工具条
│   ├─ detail-pane.js       # 工具条 + body
│   ├─ detail-body.js       # 该显示 pane / note 的判定
│   ├─ split-diff.js        # Split 布局（两条同步滚动的 lane / 换行网格）
│   ├─ inline-diff.js       # Inline 布局（单栏）
│   ├─ diff-text.js         # 高亮文本单元格 + 网格双栏
│   ├─ block-actions.js     # 每个改动行的 Accept / Revert 悬停按钮
│   ├─ pane-note.js         # loading/error/binary/oversized 与顶部提示（两布局共用）
│   ├─ error-boundary.js    # TabBoundary
│   └─ tab-body.js          # 注册给 slot 的 body
├─ diff/
│   ├─ lines.js             # diffLines（LCS，超预算降级 coarse）
│   ├─ hunks.js             # sliceHunk / toHunks
│   ├─ blocks.js            # hunkBlocks：每个改动块的两侧精确行范围
│   ├─ rows.js              # hunkRows / splitRows / hunkLabel（block 随行传递）
│   ├─ highlight.js         # highlightedSide
│   ├─ tokens.js            # tokenOf / matchRanges / sliceSpans（纯函数）
│   └─ model.js             # 按 ROW_CAP 截断 + 编号 + 成对 + 高亮 + block 的统一模型
├─ locale/{en,zh,fallback}.js
├─ api.js                 # 所有 fetch（list/file/base + watch + accept/revert + apply-file/all）
├─ session-memory.js      # 页面级按 Session 记住选中/计数/滚动（切换 Session 恢复现场）
├─ token-highlight.js     # 选区→token、token→CSS Highlight Range 的 DOM 侧工具
├─ client-id.js           # 每个 Tab 的 clientId：watch 与写请求都带它，Host 据此跳过自己的回显
├─ text-patch.js          # spliceLines（按块拼完整文本）+ hashText（SHA-256 expect）
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

- **改浏览器端**（`src/client/**`）→ `pnpm run build` → 浏览器强刷 `Ctrl+Shift+R`
- **改了 `lib/index.js` / `cordis.patch.yml` / `package.json`** → 必须让 Host 重新挂载：重启 DSH，或 Plugins 里把 bundle 关开一次
- ⚠️ **`lib/client.js` 是生成物**：手改会被下次 build 覆盖，`pnpm run build:check` 也会报 stale。
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
8. 在对比区双击一个变量名：同名 token 应标黄且 Ctrl+C 仍能复制（CSS Highlight 不碰选区）；
   Esc / 单击 / 换文件或范围后清除
9. 静态检查与单测：`pnpm run verify`（= prettier --check + `build.mjs --check` + `node --test test/`）。
   没有 node_modules 时至少跑 `node --check lib/index.js`、`node --check lib/client.js`。
10. Host 逻辑脱机自测（不需要跑 App，也不用登录）：
   - 用桩 `ctx` 加载 `lib/index.js`、调用 `mod.apply(ctx)`，桩要提供
     `connection.fetch.register` / `sessionQuery.listEvents` / `workspaceChanges.summary`
     （返回 `{ cwd: <workspace> }`）/ `fs.processPath` / `effect` / `on`
   - 然后直接 `await handler(new Request(url))` 打 `.base` / `.file`
   - 现成脚本：`node .tmp/route-check.mjs`（在 `default-workspace` 下跑；里面的 `SESSION` 常量按需改）
   - §6 那 8 条就是这么验的，可直接复用

> **在 DSH 自己的沙箱里**：本机实测 `pnpm install` 可以完成（pnpm 10 默认跳过依赖的 build 脚本，
> 不像 `npm install` 那样因 lifecycle spawn 子进程报 `spawn EPERM`）；本机的 pnpm store 落在仓库内的
> `.pnpm-store/`（已加进 `.gitignore`）。`pnpm run build` / `format` / `test` / `verify` 都能正常跑。`pnpm test` 特意用了
> `--test-isolation=none`（单进程），因为 `node --test` 默认给每个测试文件 spawn 一个子进程，在沙箱里同样 EPERM；
> 想要并行隔离的那套（沙箱外）用 `pnpm run test:isolated`。实在没有 node_modules 时，退回
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

- 每次改完：`pnpm run format` → `pnpm run verify` → `git add -A && git commit`，必要时打 tag（`v0.x.y`）
  （在 DSH 沙箱里 pnpm 不可用时，见 §7 末尾的 node 直调写法）
- **不要手改 `lib/client.js`**：改 `src/client/**` 后 `pnpm run build`；提交时把生成物一起提交
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
- `test/bundle.test.mjs`：注册、列表与对比渲染、已删除/二进制/空会话/列表失败，以及块 / 文件行 /
  整列表的 Accept-Revert 标记与点击后发出的请求体（含 `source`）、选中 token 后的 split/inline
  高亮与清除。
- `test/diff.test.mjs`：diff 引擎、hunk 与 change block 范围、`spliceLines`、`buildComparison` 的七种状态、
  token 识别 / 整词匹配 / 跨 syntax span 的切分与 Range。
- `test/host.test.mjs`：桩 `ctx` + 临时工作区，验九条路由（含 409 冲突、二进制按字节复制、整批 `{files,failed}`、
  watch 对自身写入回显的过滤）。
- `test/watch.test.mjs`：1 s debounce、ndjson 解析、watch 的 `client` 参数。
- `test/memory.test.mjs`：Session 级选中、计数、滚动缓存的读写与清除。

六个测试文件共 80 条断言，`pnpm test` 单进程约 8 s（大头是渲染 harness 每次 settle 的 200 ms 级等待）。

**等价性证据**：`scripts/compare-bundles.mjs <旧 bundle>` 用同一套 stub 渲染 11 个场景（By turn / Overall ×
Split / Inline × Full、已删除、二进制、drift、空会话、列表失败），元素树（tag + 可序列化 props + 文本）
逐字节相同；样式表按语义归一化后相同（prettier 只做了 `.5px`→`0.5px`、`[a=b]`→`[a="b"]`、
`content:''`→`content:""`、补分号这类等价改写）。打包产物 108,766 字符 / 109,400 字节
（原 77,023 字节；差在 prettier 展开的 CSS 字符串与源码缩进/注释，非功能差异）。
复跑：先把旧 bundle 取回来，再执行脚本。
Git Bash / sh：`git show HEAD~1:lib/client.js > .baseline-client.js`；
PowerShell 必须走 cmd，否则 `>` 会写成 UTF-16：`cmd /c "git show HEAD~1:lib/client.js > .baseline-client.js"`。
（顺带发现：旧 `lib/client.js` 开头带一个 UTF-8 BOM，新产物没有——浏览器按 UTF-8 解码，无影响。）

