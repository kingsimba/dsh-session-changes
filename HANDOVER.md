# 交接文档 — dsh-session-changes

写给下一位接手的人（或新 Session 的 AI）。读完这一页你应该能：知道它是什么、现在到哪一步、怎么验证、还剩什么。

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
- `tools/pre-execute`（`prepend: true`）把 `exec → session` 记进 `WeakMap`；intent 的 `actor` 就是那个 `exec`。
- 绝对路径取法：`ctx.fs.processPath(target)`（与随包的 `workspace-changes` 完全一致）。
- **每个 Session、每个文件只备份第一次**：`capturedPaths: Map<storeRoot, Set<relPath>>`。
- 落盘：`<workspace>/.dsh/session-changes/<sessionId>/<relative path>`；新建文件写 `<rel>.absent` 标记。
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
├─ lib/client.js         # 浏览器：列表、模式、布局、diff 渲染（约 1500 行）
└─ profile/              # 快照：~/.dsh/profiles/desktop 的 cordis.patch.yml 与 package.json
```

`lib/client.js` 里的重要函数（按出现顺序）：`groupFiles` / `groupOverall` → `reverseHunks` / `diffLines` / `sliceHunk` / `toHunks` → `readWholeFile` / `readBase` → `DiffPane`（Split）/ `UnifiedPane`（Inline）/ `AnnotatedPane`（降级）→ `ChangesTab`（状态与编排）。

## 5. 改动怎么生效（很容易踩）

- **只改 `lib/client.js`** → 浏览器强刷 `Ctrl+Shift+R`
- **改了 `lib/index.js` / `cordis.patch.yml` / `package.json`** → 必须让 Host 重新挂载：重启 DSH，或 Plugins 里把 bundle 关开一次
- ⚠️ **不要拨插件列表里那个 row 开关**：它会往 `~/.dsh/profiles/desktop/cordis.patch.yml` 写
  `- id: session-changes` + `disabled: true`，再打开也不会清掉，结果就是「插件消失」。
  真要修就改那个文件（删掉那两行）再重启；`profile/` 里有可用版本的快照。

## 6. 怎么验（下次接手先跑这几步）

1. 重启 DSH（因为这次动过 Host 半边）→ `Ctrl+Shift+R` → 侧栏 `+` → **Changes**
2. 会话里让 Agent 改一个文件；确认工作区出现
   `<workspace>/.dsh/session-changes/<sessionId>/<相对路径>`，内容是该文件**改之前**的原文
3. 该文件再被改一次 → 备份**不应**被覆盖
4. 打开该文件 → `Overall` → `Full`：应显示「会话说开始 → 现在」的整文件对比，**行号连续**，且**不再出现**「无法还原该对比的起点」
5. 切 `Inline` / `Split` 各看一遍；点不同的 turn chip，左侧列表应随之变化
6. 静态检查：`node --check lib/index.js`、`node --check lib/client.js`
7. Host 逻辑可以脱机自测（不需要跑 App）：用桩 `ctx` 加载 `lib/index.js`、调用 `mod.apply(ctx)`，模拟
   `tools/pre-execute` → `fs/write-intent`（**先**调 hook **再**写文件）→ 检查备份 → 调 `.base` 路由 → 调
   `session/disposed` 检查目录被删。上一轮就是这么验的，四条断言全过。

## 7. 待办 / 已知缺口

1. **最重要的未验证项**：`Overall` 现在优先走 `base` 路由，但这条新链路**还没在真实 App 里点过**（只做了 Host 单元级验证）。请重点测 §6 第 2–4 步。
2. `By turn + Full` 仍是逆向重建（因为按决定只存「首次改前」）。要精确需要**每轮**存一份（`<sid>/t<N>/…`），当时被否掉了。若以后想升级，改 `captureBefore` 的 key 加 turn，并在 `turn/start` 时记录 turn。
3. 死代码/小债：`ChangesTab` 里旧的 `retry(key, entry)` 已无人调用；`WholeFilePane` 已被 `UnifiedPane` + `AnnotatedPane` 取代并删除；README 里有关 `Full` 的旧描述已更新，但可以再校对一遍。
4. `.dsh/session-changes/` 会出现在工作区目录树里（由 `node:fs` 写入，不被记录器计入改动列表）。若以后工作区建 git 仓，务必加 `.gitignore`。
5. 备份未做体积上限/二进制处理：超大文件会照样复制一份。需要的话加 `maxFileBytes` 并跳过二进制。

## 8. 约定

- 每次改完：`node --check` → 能跑的最小验证 → `git add -A && git commit`，必要时打 tag（`v0.x.y`）
- 提交信息用英文一句话；版本号在 `package.json`
- 回滚：`git checkout <tag> -- .`；profile 回滚见 §5
