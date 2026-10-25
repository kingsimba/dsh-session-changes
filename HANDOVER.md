# 交接文档 — dsh-session-changes

写给下一位接手的人（或新 Session 的 AI）。读完这一页你应该能：知道它是什么、现在到哪一步、怎么验证、还剩什么。

> **2026-10-26 01:25 更新**：0.11.0 的 Host 半边（首次改前备份 + `.base` 路由）已在**真实运行的 App**里跑通，
> 不再是「只做过单元级验证」。浏览器端 `Overall` 的最终观感仍待人工确认（见 §6）。

---

## 1. 这是什么

一个 DSH Web GUI 的本地插件：右侧栏多一个 **Changes** 页，用来 review「这次会话改了哪些文件」。

- 代码：`C:\Users\kingsimba\Documents\deepseek-harness\default-workspace\plugins\dsh-session-changes`
- 安装方式：Plugins → Add plugin → 粘贴上面的**绝对路径**；`~/.dsh/profiles/desktop/node_modules/dsh-session-changes` 是指向这里的 junction，所以**改代码立即生效**（刷新方式见 §5）
- 版本：`0.11.0`，git 仓库就在插件目录里，tag 从 `v0.3.0` 到 `v0.11.0`

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

**客户端**（`lib/client.js`）：

- `Overall`：`base`（或 absent→空）vs `wholeState.text`（当前文件）→ `diffLines` + `toHunks` → 交给渲染器。**这条路径是精确的，不会漂移。**
- `Overall` 的 base 取不到（404）时：`comparison` 落到 `lib/client.js:1396` 的 `reverseHunks` 旧重建逻辑——这是**数据缺失的降级**，不是 bug。典型场景：文件在「Host 带上 capture 代码」之前就被本会话改过。
- `By turn`：仍用 Host 的 per-turn hunk（`api/changes.diff`）。
- `By turn + Full`：仍走旧的 `reverseHunks` 重建；重建失败会**降级为「当前文件 + 标注」**（`AnnotatedPane`）并显示提示，不再死路。

## 4. 目录与文件

```
plugins/dsh-session-changes/
├─ package.json          # dsh.bundle.patch + dsh.client（version 0.11.0）
├─ cordis.patch.yml      # insert: session-changes 行
├─ README.md             # 面向用户的功能说明
├─ HANDOVER.md           # 本文件
├─ lib/index.js          # Host：三条路由 + 首次改动前备份 + 清理
├─ lib/client.js         # 浏览器：列表、模式、布局、diff 渲染（约 1450 行）
└─ profile/              # 快照：~/.dsh/profiles/desktop 的 cordis.patch.yml 与 package.json
```

`lib/client.js` 里的重要函数（按出现顺序）：`groupFiles` / `groupOverall` → `reverseHunks` / `diffLines` / `sliceHunk` / `toHunks` → `readWholeFile` / `readBase` → `DiffPane`（Split）/ `UnifiedPane`（Inline）/ `AnnotatedPane`（降级）→ `ChangesTab`（状态与编排）。

**工作区里的测试夹具**（`default-workspace`，随时可整目录删）：`diff-demo/` 下
`src/app.js`（有真实前像，最适合验 `Overall`）、`src/queue.js`（新文件 → `.absent` 分支）、
`src/util.js`、`data/config.json`、`notes-zh.md`（中文/长行）、`changelog.txt`（36 行够滚动）、
`README.md`；另有改过的 `base.js` 与 `.tmp/asar-*.mjs`。`diff-demo/` 是 0.11.0 那次测试留下的。

## 5. 改动怎么生效（很容易踩）

- **只改 `lib/client.js`** → 浏览器强刷 `Ctrl+Shift+R`
- **改了 `lib/index.js` / `cordis.patch.yml` / `package.json`** → 必须让 Host 重新挂载：重启 DSH，或 Plugins 里把 bundle 关开一次
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
8. 静态检查：`node --check lib/index.js`、`node --check lib/client.js`
9. Host 逻辑脱机自测（不需要跑 App，也不用登录）：
   - 用桩 `ctx` 加载 `lib/index.js`、调用 `mod.apply(ctx)`，桩要提供
     `connection.fetch.register` / `sessionQuery.listEvents` / `workspaceChanges.summary`
     （返回 `{ cwd: <workspace> }`）/ `fs.processPath` / `effect` / `on`
   - 然后直接 `await handler(new Request(url))` 打 `.base` / `.file`
   - 现成脚本：`node .tmp/route-check.mjs`（在 `default-workspace` 下跑；里面的 `SESSION` 常量按需改）
   - §6 那 8 条就是这么验的，可直接复用

## 8. 待办 / 已知缺口

1. **只差浏览器端确认**：`Overall` 渲染（§6 表下那段）。其余数据链路已实测通过。
2. `By turn + Full` 仍是逆向重建（因为按决定只存「首次改前」）。要精确需要**每轮**存一份（`<sid>/t<N>/…`），当时被否掉了。若以后想升级，改 `captureBefore` 的 key 加 turn，并在 `turn/start` 时记录 turn。
3. 死代码/小债：`ChangesTab` 里旧的 `retry(key, entry)`（`lib/client.js:1072`）已无人调用；`WholeFilePane` 已被 `UnifiedPane` + `AnnotatedPane` 取代并删除；README 里有关 `Full` 的旧描述已更新，但可以再校对一遍。
4. `.dsh/session-changes/` 会出现在工作区目录树里（由 `node:fs` 写入，不被记录器计入改动列表）。若以后工作区建 git 仓，务必加 `.gitignore`。
5. 备份未做体积上限/二进制处理：超大文件会照样复制一份。需要的话加 `maxFileBytes` 并跳过二进制。
6. `captureBefore` 里 `capturedPaths.add(rel)` 发生在读文件**之前**；若 `stat` 成功但目标不是文件（目录等），函数直接 `return`，rel 已被记为「已捕获」且本会话不再重试。异常路径（非 ENOENT）会 `captured.delete(rel)`，不受影响。正常只改文件的场景碰不到。

## 9. 约定

- 每次改完：`node --check` → 能跑的最小验证 → `git add -A && git commit`，必要时打 tag（`v0.x.y`）
- 提交信息用英文一句话；版本号在 `package.json`
- 回滚：`git checkout <tag> -- .`；profile 回滚见 §5
