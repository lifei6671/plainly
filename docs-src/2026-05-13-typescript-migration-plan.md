# Plainly TypeScript Full Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不破坏现有功能的前提下，将仓库内现存 `.js/.jsx` 逐步迁移为 `.ts/.tsx`，并最终收口到“运行时源码、测试、构建、发布链均以 TypeScript 为主”的稳定状态。

**Architecture:** 采用“先铺路、再迁码、最后收严约束”的渐进式迁移路线。先修复工具链对 TypeScript 的编译、测试、发布支持，再按依赖深度从叶子模块迁到业务模块、普通组件、状态层、入口层，最后处理 Node/Electron/脚本配置区并关闭 `allowJs`。

**Tech Stack:** React 18、Vite 5、MobX 5、Jest 23、Babel、TypeScript 5、Electron、Cloudflare Worker、pnpm。

---

## 当前进度

- [x] `Task 1` 已完成实现与验证
- [x] `Task 2` 已完成实现与验证
- [x] `Task 3` 已完成实现与验证
- [x] `Task 4` 已完成实现与验证
- [x] `Task 5` 已完成实现与验证
- [x] `Task 6` 已完成实现与验证
- [x] `Task 7` 已完成实现与验证
- [x] `Task 8` 已完成实现与验证
- [ ] `Task 9` 未开始

说明：

- 当前勾选以“代码实现 + 命令验证完成”为准
- 各任务里的 `git commit` 步骤尚未执行，因此仍保持未勾选
- `Task 5` 完成后，额外修复了主题菜单的 `eventKey/warnKey` React 控制台告警

---

## 迁移总规则

- 保持功能不变，**只做类型化与必要的兼容性修正**，不夹带产品重构。
- 每一批迁移都必须满足：
  - 仅迁移一个清晰的文件组；
  - 先通过本批验证，再进入下一批；
  - 不允许同时改 `store + App + 发布链` 这类会产生连锁反应的区域。
- 迁移过程中统一采用：
  - React 组件：`.tsx`
  - 非 JSX 运行时代码：`.ts`
  - Node ESM 脚本：必要时使用 `.mts`
  - 仅在必要时保留 `.js`：
    - 生成脚本或第三方工具明确要求的配置文件
    - 迁移收益明显低于风险的文件
- 所有 import 在迁移过程中统一收敛为**无扩展名引用**，避免 `.js/.ts/.tsx` 混用导致解析漂移。

## 停机线

满足以下任一条件，必须暂停继续迁移，先修正基建或方案：

- `pnpm build` 失败
- `pnpm test` 失败
- `pnpm lint` 失败
- `pnpm publish:npm` 产物不完整
- `src/App`、`src/Lib`、`src/store` 以外的低风险文件迁移，反向引爆高风险核心区大面积修改
- 为了迁移单个批次，不得不引入新的架构抽象或大量 `any`

## 全程验证命令

每一批至少执行以下命令：

```bash
pnpm exec tsc -p tsconfig.json --noEmit
pnpm lint
pnpm test
pnpm build
```

涉及库发布链的批次，额外执行：

```bash
pnpm publish:npm
```

涉及 Storybook 或 Electron/Node 入口的批次，按需追加：

```bash
pnpm storybook
pnpm watch
```

## 文件分组总览

### A. 基建与工具链

- `package.json`
- `.eslintrc`
- `tsconfig.json`
- `tsconfig.server.json`
- `vite.config.mjs`
- `src/index.d.ts`
- `src/global-shim.js`
- `src/serviceWorker.js`

### B. 低风险静态与叶子模块

- `src/template/basic.js`
- `src/template/index.js`
- `src/template/code/atomOneDark.js`
- `src/template/code/atomOneLight.js`
- `src/template/code/github.js`
- `src/template/code/monokai.js`
- `src/template/code/vs2015.js`
- `src/template/code/xcode.js`
- `src/template/macCode/macAtomOneDark.js`
- `src/template/macCode/macAtomOneLight.js`
- `src/template/macCode/macGithub.js`
- `src/template/macCode/macMonokai.js`
- `src/template/macCode/macVs2015.js`
- `src/template/macCode/macXcode.js`
- `src/template/markdown/blue.js`
- `src/template/markdown/blueCyan.js`
- `src/template/markdown/blueMountain.js`
- `src/template/markdown/custom.js`
- `src/template/markdown/cuteGreen.js`
- `src/template/markdown/cyan.js`
- `src/template/markdown/extremeBlack.js`
- `src/template/markdown/fullStackBlue.js`
- `src/template/markdown/geekBlack.js`
- `src/template/markdown/green.js`
- `src/template/markdown/ink.js`
- `src/template/markdown/nightPurple.js`
- `src/template/markdown/normal.js`
- `src/template/markdown/orangeHeart.js`
- `src/template/markdown/purple.js`
- `src/template/markdown/red.js`
- `src/template/markdown/rose.js`
- `src/template/markdown/scienceBlue.js`
- `src/template/markdown/shanchui.js`
- `src/template/markdown/simple.js`
- `src/template/markdown/wechatFormat.js`
- `src/icon/Close.jsx`
- `src/icon/Copy.jsx`
- `src/icon/Down.jsx`
- `src/icon/Environment.jsx`
- `src/icon/FontCase.jsx`
- `src/icon/GitHub.jsx`
- `src/icon/Inbox.jsx`
- `src/icon/index.jsx`
- `src/icon/Juejin.jsx`
- `src/icon/Mobile.jsx`
- `src/icon/More.jsx`
- `src/icon/PC.jsx`
- `src/icon/Rabbit.jsx`
- `src/icon/Replace.jsx`
- `src/icon/ReplaceAll.jsx`
- `src/icon/Smile.jsx`
- `src/icon/Wechat.jsx`
- `src/icon/Zhihu.jsx`

### C. 运行时工具模块

- `src/utils/appContext.js`
- `src/utils/configStore.js`
- `src/utils/constant.js`
- `src/utils/converter.js`
- `src/utils/editorKeyEvents.js`
- `src/utils/helper.js`
- `src/utils/hotkey.js`
- `src/utils/imageCompress.js`
- `src/utils/imageFilename.js`
- `src/utils/imageHosting.js`
- `src/utils/imageHosting.test.js`
- `src/utils/langHighlight.js`
- `src/utils/markdown-it-imageflow.js`
- `src/utils/markdown-it-li.js`
- `src/utils/markdown-it-linkfoot.js`
- `src/utils/markdown-it-math.js`
- `src/utils/markdown-it-mermaid.js`
- `src/utils/markdown-it-removepre.js`
- `src/utils/markdown-it-span.js`
- `src/utils/pluginCenter.js`
- `src/utils/qiuniu.js`
- `src/utils/sitdownConverter.js`

### D. 搜索与图床业务模块

- `src/search/cache.js`
- `src/search/db.js`
- `src/search/index.js`
- `src/search/jieba-tokenizer.js`
- `src/search/lunr-index.js`
- `src/search/markdown.js`
- `src/search/remark-remove-code.js`
- `src/search/tokenizer.js`
- `src/search/version.js`
- `src/search/wasm-prewarm.js`
- `src/component/ImageHosting/AliOSS.jsx`
- `src/component/ImageHosting/configSync.js`
- `src/component/ImageHosting/configSync.test.js`
- `src/component/ImageHosting/configSyncConsumers.test.js`
- `src/component/ImageHosting/QiniuOSS.jsx`
- `src/component/ImageHosting/R2.jsx`
- `src/component/ImageHosting/Smms.jsx`
- `worker/api.js`
- `worker/index.js`

### E. 普通 UI 组件与布局

- `src/layout/Dialog.jsx`
- `src/layout/EditorMenu.jsx`
- `src/layout/Navbar.jsx`
- `src/layout/Sidebar.jsx`
- `src/layout/StyleEditor.jsx`
- `src/component/Auth/AuthModal.jsx`
- `src/component/Dialog/AboutDialog.jsx`
- `src/component/Dialog/CategoryManageDialog.jsx`
- `src/component/Dialog/DocumentListDialog.jsx`
- `src/component/Dialog/FormDialog.jsx`
- `src/component/Dialog/HistoryDialog.jsx`
- `src/component/Dialog/ImageDialog.jsx`
- `src/component/Dialog/LinkDialog.jsx`
- `src/component/Dialog/NewFileDialog.jsx`
- `src/component/Dialog/RenameFileDialog.jsx`
- `src/component/Dialog/SitDownDialog.jsx`
- `src/component/LocalHistory/index.jsx`
- `src/component/LocalHistory/indexdb.jsx`
- `src/component/LocalHistory/util.jsx`
- `src/component/SearchBox/index.jsx`
- `src/component/Sidebar/Juejin.jsx`
- `src/component/Sidebar/PreviewType.jsx`
- `src/component/Sidebar/Wechat.jsx`
- `src/component/Sidebar/Zhihu.jsx`
- `src/component/MenuLeft/CodeTheme.jsx`
- `src/component/MenuLeft/File.jsx`
- `src/component/MenuLeft/File/CategoryManage.jsx`
- `src/component/MenuLeft/File/DocumentList.jsx`
- `src/component/MenuLeft/File/ExportConfig.jsx`
- `src/component/MenuLeft/File/ExportMarkdown.jsx`
- `src/component/MenuLeft/File/ExportPdf.jsx`
- `src/component/MenuLeft/File/ImportConfig.jsx`
- `src/component/MenuLeft/File/ImportFile.jsx`
- `src/component/MenuLeft/File/NewFile.jsx`
- `src/component/MenuLeft/File/RenameFile.jsx`
- `src/component/MenuLeft/Function.jsx`
- `src/component/MenuLeft/Function/History.jsx`
- `src/component/MenuLeft/Function/Reset.jsx`
- `src/component/MenuLeft/Function/Search.jsx`
- `src/component/MenuLeft/Function/SitDown.jsx`
- `src/component/MenuLeft/Help.jsx`
- `src/component/MenuLeft/Help/About.jsx`
- `src/component/MenuLeft/LogIn.jsx`
- `src/component/MenuLeft/Paragraph.jsx`
- `src/component/MenuLeft/Pattern.jsx`
- `src/component/MenuLeft/Pattern/Bold.jsx`
- `src/component/MenuLeft/Pattern/Code.jsx`
- `src/component/MenuLeft/Pattern/Del.jsx`
- `src/component/MenuLeft/Pattern/Font.jsx`
- `src/component/MenuLeft/Pattern/Form.jsx`
- `src/component/MenuLeft/Pattern/Format.jsx`
- `src/component/MenuLeft/Pattern/Image.jsx`
- `src/component/MenuLeft/Pattern/InlineCode.jsx`
- `src/component/MenuLeft/Pattern/Italic.jsx`
- `src/component/MenuLeft/Pattern/Link.jsx`
- `src/component/MenuLeft/Pattern/LinkToFoot.jsx`
- `src/component/MenuLeft/Setting.jsx`
- `src/component/MenuLeft/Setting/ContainImgName.jsx`
- `src/component/MenuLeft/Setting/ImageHostingConfig.jsx`
- `src/component/MenuLeft/Setting/SyncScroll.jsx`
- `src/component/MenuLeft/Setting/UploadLocation.jsx`
- `src/component/MenuLeft/Theme.jsx`
- `src/component/MenuLeft/User.jsx`
- `src/component/MenuLeft/View.jsx`
- `src/component/MenuLeft/View/EditArea.jsx`
- `src/component/MenuLeft/View/FullScreen.jsx`
- `src/component/MenuLeft/View/PreviewArea.jsx`
- `src/component/MenuLeft/View/ThemeArea.jsx`

### F. 核心状态与入口

- `src/store/content.js`
- `src/store/dialog.js`
- `src/store/imageHosting.js`
- `src/store/navbar.js`
- `src/store/title.js`
- `src/store/userInfo.js`
- `src/store/view.js`
- `src/App.jsx`
- `src/App.test.js`
- `src/Lib.jsx`
- `src/index.jsx`

### G. 根入口、脚本与配置区

- `main.js`
- `watch.js`
- `stories/allImageHosting.js`
- `stories/defaultImageHosting.js`
- `stories/index.js`
- `stories/noneImageHosting.js`
- `stories/online.js`
- `scripts/build.js`
- `scripts/copy-jieba-wasm.js`
- `scripts/gen-cf-headers.mjs`
- `scripts/gen-node-headers.mjs`
- `scripts/gen-worker-schema.mjs`
- `scripts/start.js`
- `scripts/test.js`
- `config/env.js`
- `config/jest/cssTransform.js`
- `config/jest/fileTransform.js`
- `config/paths.js`
- `config/webpack.config.js`
- `config/webpack.config.lib.js`
- `config/webpackDevServer.config.js`

---

### Task 1: 固化迁移基线并补齐 TypeScript 工具链

**Files:**
- Modify: `package.json`
- Modify: `.eslintrc`
- Modify: `tsconfig.json`
- Modify: `tsconfig.server.json`
- Modify: `vite.config.mjs`
- Modify: `src/index.d.ts`
- Modify: `src/global-shim.js`
- Modify: `src/serviceWorker.js`

- [x] **Step 1: 记录当前基线输出**

Run:

```bash
pnpm exec tsc -p tsconfig.json --noEmit
pnpm lint
pnpm test
pnpm build
pnpm publish:npm
```

Expected:

- `tsc` 通过
- 现有 `lint/test/build` 能运行
- 明确 `publish:npm` 当前是否只处理 `.js/.jsx`

- [x] **Step 2: 明确 TS 编译职责边界**

目标决策：

- Vite 继续负责应用构建
- TypeScript 负责类型检查
- Babel/Jest 负责测试转译
- npm 发布链必须能处理 `.ts/.tsx`

必须产出：

- `package.json` 中 `build`、`test`、`lint`、`publish:npm` 的新职责定义
- `tsconfig.json` 中迁移期与收口期的配置边界

- [x] **Step 3: 补齐测试链与发布链对 TS 的支持**

重点检查：

- Jest 是否真的能跑 `.ts/.tsx`
- Babel 是否需要显式支持 TypeScript
- npm 发布链如何从 `src/**` 产出 `lib/**`
- `typings` 是否与发布产物一致

停机线：

- 如果需要新增第三方依赖，先在执行时单独确认

- [x] **Step 4: 统一 import 解析策略**

需要统一：

- 代码中不再显式写 `.ts/.tsx`
- `tsconfig`、Vite、Jest、ESLint 对扩展名解析一致
- 迁移过程允许 `js/ts` 共存，但解析规则只能有一套

- [x] **Step 5: 重新跑全量验证并保存结果**

Run:

```bash
pnpm exec tsc -p tsconfig.json --noEmit
pnpm lint
pnpm test
pnpm build
pnpm publish:npm
```

Expected:

- 工具链在“JS/TS 混合状态”下稳定

- [ ] **Step 6: 提交本阶段**

```bash
git add package.json .eslintrc tsconfig.json tsconfig.server.json vite.config.mjs src/index.d.ts src/global-shim.js src/serviceWorker.js
git commit -m "chore: prepare typescript migration toolchain"
```

### Task 2: 迁移模板与图标叶子模块

**Files:**
- Modify: `src/template/basic.js`
- Modify: `src/template/index.js`
- Modify: `src/template/code/atomOneDark.js`
- Modify: `src/template/code/atomOneLight.js`
- Modify: `src/template/code/github.js`
- Modify: `src/template/code/monokai.js`
- Modify: `src/template/code/vs2015.js`
- Modify: `src/template/code/xcode.js`
- Modify: `src/template/macCode/macAtomOneDark.js`
- Modify: `src/template/macCode/macAtomOneLight.js`
- Modify: `src/template/macCode/macGithub.js`
- Modify: `src/template/macCode/macMonokai.js`
- Modify: `src/template/macCode/macVs2015.js`
- Modify: `src/template/macCode/macXcode.js`
- Modify: `src/template/markdown/blue.js`
- Modify: `src/template/markdown/blueCyan.js`
- Modify: `src/template/markdown/blueMountain.js`
- Modify: `src/template/markdown/custom.js`
- Modify: `src/template/markdown/cuteGreen.js`
- Modify: `src/template/markdown/cyan.js`
- Modify: `src/template/markdown/extremeBlack.js`
- Modify: `src/template/markdown/fullStackBlue.js`
- Modify: `src/template/markdown/geekBlack.js`
- Modify: `src/template/markdown/green.js`
- Modify: `src/template/markdown/ink.js`
- Modify: `src/template/markdown/nightPurple.js`
- Modify: `src/template/markdown/normal.js`
- Modify: `src/template/markdown/orangeHeart.js`
- Modify: `src/template/markdown/purple.js`
- Modify: `src/template/markdown/red.js`
- Modify: `src/template/markdown/rose.js`
- Modify: `src/template/markdown/scienceBlue.js`
- Modify: `src/template/markdown/shanchui.js`
- Modify: `src/template/markdown/simple.js`
- Modify: `src/template/markdown/wechatFormat.js`
- Modify: `src/icon/Close.jsx`
- Modify: `src/icon/Copy.jsx`
- Modify: `src/icon/Down.jsx`
- Modify: `src/icon/Environment.jsx`
- Modify: `src/icon/FontCase.jsx`
- Modify: `src/icon/GitHub.jsx`
- Modify: `src/icon/Inbox.jsx`
- Modify: `src/icon/index.jsx`
- Modify: `src/icon/Juejin.jsx`
- Modify: `src/icon/Mobile.jsx`
- Modify: `src/icon/More.jsx`
- Modify: `src/icon/PC.jsx`
- Modify: `src/icon/Rabbit.jsx`
- Modify: `src/icon/Replace.jsx`
- Modify: `src/icon/ReplaceAll.jsx`
- Modify: `src/icon/Smile.jsx`
- Modify: `src/icon/Wechat.jsx`
- Modify: `src/icon/Zhihu.jsx`

- [x] **Step 1: 先迁 `src/template/**`**

动作：

- 所有纯对象/映射文件改为 `.ts`
- `index.js` 改为 `.ts`
- 为模板对象补充只读结构类型

要求：

- 不改变模板内容
- 不重命名业务常量

- [x] **Step 2: 运行模板批次验证**

Run:

```bash
pnpm exec tsc -p tsconfig.json --noEmit
pnpm build
```

Expected:

- 模板 import 全部可解析
- 预览相关构建不报错

- [x] **Step 3: 再迁 `src/icon/**`**

动作：

- 所有图标组件改为 `.tsx`
- `src/icon/index.jsx` 改为 `.tsx`
- 明确图标 props 类型，优先复用 React 标准 SVG props

- [x] **Step 4: 运行图标批次验证**

Run:

```bash
pnpm exec tsc -p tsconfig.json --noEmit
pnpm lint
pnpm build
```

Expected:

- 所有图标组件无类型错误
- UI 构建正常

- [ ] **Step 5: 提交本阶段**

```bash
git add src/template src/icon
git commit -m "refactor: migrate template and icon modules to typescript"
```

### Task 3: 迁移运行时工具模块

**Files:**
- Modify: `src/utils/appContext.js`
- Modify: `src/utils/configStore.js`
- Modify: `src/utils/constant.js`
- Modify: `src/utils/converter.js`
- Modify: `src/utils/editorKeyEvents.js`
- Modify: `src/utils/helper.js`
- Modify: `src/utils/hotkey.js`
- Modify: `src/utils/imageCompress.js`
- Modify: `src/utils/imageFilename.js`
- Modify: `src/utils/imageHosting.js`
- Modify: `src/utils/imageHosting.test.js`
- Modify: `src/utils/langHighlight.js`
- Modify: `src/utils/markdown-it-imageflow.js`
- Modify: `src/utils/markdown-it-li.js`
- Modify: `src/utils/markdown-it-linkfoot.js`
- Modify: `src/utils/markdown-it-math.js`
- Modify: `src/utils/markdown-it-mermaid.js`
- Modify: `src/utils/markdown-it-removepre.js`
- Modify: `src/utils/markdown-it-span.js`
- Modify: `src/utils/pluginCenter.js`
- Modify: `src/utils/qiuniu.js`
- Modify: `src/utils/sitdownConverter.js`

- [x] **Step 1: 按依赖方向拆成三个小批次**

顺序固定：

1. `constant/appContext/pluginCenter`
2. `converter/helper/hotkey/editorKeyEvents/langHighlight/markdown-it*`
3. `imageHosting/imageCompress/imageFilename/qiuniu/sitdownConverter/configStore`

原因：

- 先迁无副作用常量与上下文
- 再迁编辑器与渲染辅助
- 最后迁第三方 SDK 与异步配置链

- [x] **Step 2: 每个小批次迁移后执行快速验证**

Run:

```bash
pnpm exec tsc -p tsconfig.json --noEmit
pnpm test -- --runInBand
pnpm build
```

Expected:

- 工具函数测试通过
- 编辑器相关模块仍可构建

- [x] **Step 3: 对第三方 SDK 接口补最小必要类型**

重点模块：

- `src/utils/imageHosting.js`
- `src/utils/qiuniu.js`
- `src/utils/imageCompress.js`
- `src/utils/sitdownConverter.js`

要求：

- 只补参数/返回值/配置对象类型
- 不在本阶段引入业务逻辑重写

- [ ] **Step 4: 提交本阶段**

```bash
git add src/utils
git commit -m "refactor: migrate runtime utility modules to typescript"
```

### Task 4: 迁移搜索、图床与 Worker 业务模块

**Files:**
- Modify: `src/search/cache.js`
- Modify: `src/search/db.js`
- Modify: `src/search/index.js`
- Modify: `src/search/jieba-tokenizer.js`
- Modify: `src/search/lunr-index.js`
- Modify: `src/search/markdown.js`
- Modify: `src/search/remark-remove-code.js`
- Modify: `src/search/tokenizer.js`
- Modify: `src/search/version.js`
- Modify: `src/search/wasm-prewarm.js`
- Modify: `src/component/ImageHosting/AliOSS.jsx`
- Modify: `src/component/ImageHosting/configSync.js`
- Modify: `src/component/ImageHosting/configSync.test.js`
- Modify: `src/component/ImageHosting/configSyncConsumers.test.js`
- Modify: `src/component/ImageHosting/QiniuOSS.jsx`
- Modify: `src/component/ImageHosting/R2.jsx`
- Modify: `src/component/ImageHosting/Smms.jsx`
- Modify: `worker/api.js`
- Modify: `worker/index.js`

- [x] **Step 1: 先迁 `src/search/**`**

目标：

- 明确索引缓存、token、DB 记录结构
- 给搜索入口导出稳定类型

- [x] **Step 2: 验证搜索批次**

Run:

```bash
pnpm exec tsc -p tsconfig.json --noEmit
pnpm test -- --runInBand
pnpm build
```

Expected:

- 搜索相关测试与构建通过

- [x] **Step 3: 再迁 `src/component/ImageHosting/**` 与其测试**

目标：

- 明确配置对象、上传结果、错误返回结构
- 保持与 `src/utils/imageHosting` 的接口一致

- [x] **Step 4: 最后迁 `worker/**`**

目标：

- Cloudflare Worker `fetch` 和 API handler 类型化
- 不更改路由行为

- [x] **Step 5: 执行本阶段完整验证**

Run:

```bash
pnpm exec tsc -p tsconfig.json --noEmit
pnpm test
pnpm build
```

Expected:

- 搜索、图床、Worker 不回归

- [ ] **Step 6: 提交本阶段**

```bash
git add src/search src/component/ImageHosting worker
git commit -m "refactor: migrate search and image hosting modules to typescript"
```

### Task 5: 迁移普通 UI 组件与布局层

**Files:**
- Modify: `src/layout/Dialog.jsx`
- Modify: `src/layout/EditorMenu.jsx`
- Modify: `src/layout/Navbar.jsx`
- Modify: `src/layout/Sidebar.jsx`
- Modify: `src/layout/StyleEditor.jsx`
- Modify: `src/component/Auth/AuthModal.jsx`
- Modify: `src/component/Dialog/AboutDialog.jsx`
- Modify: `src/component/Dialog/CategoryManageDialog.jsx`
- Modify: `src/component/Dialog/DocumentListDialog.jsx`
- Modify: `src/component/Dialog/FormDialog.jsx`
- Modify: `src/component/Dialog/HistoryDialog.jsx`
- Modify: `src/component/Dialog/ImageDialog.jsx`
- Modify: `src/component/Dialog/LinkDialog.jsx`
- Modify: `src/component/Dialog/NewFileDialog.jsx`
- Modify: `src/component/Dialog/RenameFileDialog.jsx`
- Modify: `src/component/Dialog/SitDownDialog.jsx`
- Modify: `src/component/LocalHistory/index.jsx`
- Modify: `src/component/LocalHistory/indexdb.jsx`
- Modify: `src/component/LocalHistory/util.jsx`
- Modify: `src/component/SearchBox/index.jsx`
- Modify: `src/component/Sidebar/Juejin.jsx`
- Modify: `src/component/Sidebar/PreviewType.jsx`
- Modify: `src/component/Sidebar/Wechat.jsx`
- Modify: `src/component/Sidebar/Zhihu.jsx`
- Modify: `src/component/MenuLeft/CodeTheme.jsx`
- Modify: `src/component/MenuLeft/File.jsx`
- Modify: `src/component/MenuLeft/File/CategoryManage.jsx`
- Modify: `src/component/MenuLeft/File/DocumentList.jsx`
- Modify: `src/component/MenuLeft/File/ExportConfig.jsx`
- Modify: `src/component/MenuLeft/File/ExportMarkdown.jsx`
- Modify: `src/component/MenuLeft/File/ExportPdf.jsx`
- Modify: `src/component/MenuLeft/File/ImportConfig.jsx`
- Modify: `src/component/MenuLeft/File/ImportFile.jsx`
- Modify: `src/component/MenuLeft/File/NewFile.jsx`
- Modify: `src/component/MenuLeft/File/RenameFile.jsx`
- Modify: `src/component/MenuLeft/Function.jsx`
- Modify: `src/component/MenuLeft/Function/History.jsx`
- Modify: `src/component/MenuLeft/Function/Reset.jsx`
- Modify: `src/component/MenuLeft/Function/Search.jsx`
- Modify: `src/component/MenuLeft/Function/SitDown.jsx`
- Modify: `src/component/MenuLeft/Help.jsx`
- Modify: `src/component/MenuLeft/Help/About.jsx`
- Modify: `src/component/MenuLeft/LogIn.jsx`
- Modify: `src/component/MenuLeft/Paragraph.jsx`
- Modify: `src/component/MenuLeft/Pattern.jsx`
- Modify: `src/component/MenuLeft/Pattern/Bold.jsx`
- Modify: `src/component/MenuLeft/Pattern/Code.jsx`
- Modify: `src/component/MenuLeft/Pattern/Del.jsx`
- Modify: `src/component/MenuLeft/Pattern/Font.jsx`
- Modify: `src/component/MenuLeft/Pattern/Form.jsx`
- Modify: `src/component/MenuLeft/Pattern/Format.jsx`
- Modify: `src/component/MenuLeft/Pattern/Image.jsx`
- Modify: `src/component/MenuLeft/Pattern/InlineCode.jsx`
- Modify: `src/component/MenuLeft/Pattern/Italic.jsx`
- Modify: `src/component/MenuLeft/Pattern/Link.jsx`
- Modify: `src/component/MenuLeft/Pattern/LinkToFoot.jsx`
- Modify: `src/component/MenuLeft/Setting.jsx`
- Modify: `src/component/MenuLeft/Setting/ContainImgName.jsx`
- Modify: `src/component/MenuLeft/Setting/ImageHostingConfig.jsx`
- Modify: `src/component/MenuLeft/Setting/SyncScroll.jsx`
- Modify: `src/component/MenuLeft/Setting/UploadLocation.jsx`
- Modify: `src/component/MenuLeft/Theme.jsx`
- Modify: `src/component/MenuLeft/User.jsx`
- Modify: `src/component/MenuLeft/View.jsx`
- Modify: `src/component/MenuLeft/View/EditArea.jsx`
- Modify: `src/component/MenuLeft/View/FullScreen.jsx`
- Modify: `src/component/MenuLeft/View/PreviewArea.jsx`
- Modify: `src/component/MenuLeft/View/ThemeArea.jsx`

- [x] **Step 1: 按“布局 -> 对话框 -> 侧边栏/搜索 -> MenuLeft”顺序迁移**

顺序固定原因：

- `layout` 决定整体 props 形态
- `Dialog/Auth/Sidebar/SearchBox` 依赖中等
- `MenuLeft/**` 文件最多，且大量依赖 store 与 utils，必须最后迁

- [x] **Step 2: 对非 `inject` 组件先补显式 props**

要求：

- 优先使用明确 props interface/type
- 不用 `React.FC` 包裹所有组件
- 事件参数与回调参数要显式

- [x] **Step 3: 对 `inject/observer` 组件暂时使用最小可行类型**

要求：

- 本阶段只收敛组件边界
- 不在这里解决 `store` 的最终强类型定义
- 必要时允许局部过渡类型，但不能把整个组件退回 `any`

- [x] **Step 4: 分批验证**

Run:

```bash
pnpm exec tsc -p tsconfig.json --noEmit
pnpm lint
pnpm build
```

Expected:

- UI 层批次构建稳定
- 组件 props 类型错误可控

- [ ] **Step 5: 提交本阶段**

```bash
git add src/layout src/component
git commit -m "refactor: migrate ui components to typescript"
```

### Task 6: 迁移核心 Store 层

**Files:**
- Modify: `src/store/content.js`
- Modify: `src/store/dialog.js`
- Modify: `src/store/imageHosting.js`
- Modify: `src/store/navbar.js`
- Modify: `src/store/title.js`
- Modify: `src/store/userInfo.js`
- Modify: `src/store/view.js`

- [x] **Step 1: 先为每个 Store 定义状态结构和公开动作签名**

要求：

- 字段类型先明确
- action 方法参数与副作用写清
- 不在本任务引入新 store 抽象

- [x] **Step 2: 统一处理 MobX 装饰器兼容**

必须确认：

- 迁移后仍保持当前 MobX 运行方式
- TypeScript、Vite、测试链对装饰器语义一致

- [x] **Step 3: `content/navbar/dialog/view` 先迁，`userInfo/imageHosting/title` 后迁**

原因：

- `content/navbar/dialog/view` 是 UI 主链
- `userInfo/imageHosting/title` 更依赖外围模块，放后面更稳

- [x] **Step 4: 验证 Store 批次**

Run:

```bash
pnpm exec tsc -p tsconfig.json --noEmit
pnpm test -- --runInBand
pnpm build
```

Expected:

- store 实例初始化不报错
- 持久化读写与默认值逻辑不回归

- [ ] **Step 5: 提交本阶段**

```bash
git add src/store
git commit -m "refactor: migrate mobx stores to typescript"
```

### Task 7: 迁移应用入口与顶层装配

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/App.test.js`
- Modify: `src/Lib.jsx`
- Modify: `src/index.jsx`

- [x] **Step 1: 先迁 `src/Lib.jsx` 与 `src/index.jsx`**

目标：

- 明确 Provider 注入边界
- 明确公共导出组件 props

- [x] **Step 2: 再迁 `src/App.jsx`**

重点：

- `inject/observer` 后的 props 类型
- 编辑器实例类型
- 登录态与数据源切换类型
- Mermaid/MathJax/DOM ref 类型

- [x] **Step 3: 修复并迁移 `src/App.test.js`**

要求：

- 测试用例跟随入口类型变更
- 不修改产品行为断言

- [x] **Step 4: 运行核心入口验证**

Run:

```bash
pnpm exec tsc -p tsconfig.json --noEmit
pnpm test
pnpm build
pnpm publish:npm
```

Expected:

- 应用入口、库入口、测试、发布链同时稳定

- [ ] **Step 5: 提交本阶段**

```bash
git add src/App.* src/App.test.* src/Lib.* src/index.*
git commit -m "refactor: migrate app entrypoints to typescript"
```

### Task 8: 迁移 Storybook、Electron、Node 脚本与配置区

**Files:**
- Modify: `main.js`
- Modify: `watch.js`
- Modify: `stories/allImageHosting.js`
- Modify: `stories/defaultImageHosting.js`
- Modify: `stories/index.js`
- Modify: `stories/noneImageHosting.js`
- Modify: `stories/online.js`
- Modify: `scripts/build.js`
- Modify: `scripts/copy-jieba-wasm.js`
- Modify: `scripts/gen-cf-headers.mjs`
- Modify: `scripts/gen-node-headers.mjs`
- Modify: `scripts/gen-worker-schema.mjs`
- Modify: `scripts/start.js`
- Modify: `scripts/test.js`
- Modify: `config/env.js`
- Modify: `config/jest/cssTransform.js`
- Modify: `config/jest/fileTransform.js`
- Modify: `config/paths.js`
- Modify: `config/webpack.config.js`
- Modify: `config/webpack.config.lib.js`
- Modify: `config/webpackDevServer.config.js`

- [x] **Step 1: 先迁 stories**

目标：

- 保持组件演示层与 TSX 组件兼容
- 不先碰 CJS 配置区

- [x] **Step 2: 再迁 Electron/Watch 根入口**

重点：

- `main.js`
- `watch.js`

要求：

- 明确 Node 运行方式
- 不改变现有启动行为

- [x] **Step 3: 最后迁 `scripts/**` 与 `config/**`**

要求：

- 保持测试与构建脚本职责不变
- CommonJS/ESM 边界在本批统一处理
- 若迁移收益明显低于代价，可保留个别配置文件为 `.js`

- [x] **Step 4: 执行本阶段全量验证**

Run:

```bash
pnpm exec tsc -p tsconfig.json --noEmit
pnpm lint
pnpm test
pnpm build
pnpm publish:npm
pnpm watch
```

Expected:

- 脚本与配置区不会破坏主应用构建

- [ ] **Step 5: 提交本阶段**

```bash
git add main.* watch.* stories scripts config
git commit -m "refactor: migrate runtime scripts and config to typescript"
```

### Task 9: 关闭 JS 过渡配置并完成收口

**Files:**
- Modify: `tsconfig.json`
- Modify: `package.json`
- Modify: `.eslintrc`
- Modify: 仓库内所有剩余 `.js/.jsx` 运行时代码

- [ ] **Step 1: 清点剩余 `.js/.jsx`**

Run:

```bash
rg --files -g "*.js" -g "*.jsx" -g "!node_modules/**"
```

Expected:

- 只剩明确批准保留的文件

- [ ] **Step 2: 关闭迁移期宽松设置**

目标：

- 去掉 `allowJs`
- 保留必要的兼容配置
- 确保 lint 与测试链仍稳定

- [ ] **Step 3: 做最终全量验证**

Run:

```bash
pnpm exec tsc -p tsconfig.json --noEmit
pnpm lint
pnpm test
pnpm build
pnpm publish:npm
```

Expected:

- 仓库运行时源码已无未计划残留 `.js/.jsx`
- 功能链路和发布链路均不破坏

- [ ] **Step 4: 提交收口阶段**

```bash
git add tsconfig.json package.json .eslintrc
git add src worker stories scripts config main.* watch.*
git commit -m "chore: complete javascript to typescript migration"
```

## 功能回归清单

每完成一个大任务，至少手工验证以下行为：

- 编辑器可正常输入 Markdown
- 右侧预览可正常渲染
- 模板切换正常
- 代码高亮正常
- 图床配置与上传入口正常
- 搜索功能正常
- 本地历史正常
- 登录、注册、登出与远端数据切换正常
- 分类管理与文档列表正常
- 导出与导入入口正常

## 最终完成定义

满足以下条件才算本计划完成：

- 仓库现存运行时 `.js/.jsx` 已全部迁移，或仅保留明确批准保留的配置文件
- `pnpm exec tsc -p tsconfig.json --noEmit` 通过
- `pnpm lint` 通过
- `pnpm test` 通过
- `pnpm build` 通过
- `pnpm publish:npm` 通过
- 关键人工功能回归全部通过
