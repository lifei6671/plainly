# AGENTS.md

本文件是本仓库的 Agent 协作规范。优先遵守用户当前指令；若与本文件冲突，以更具体、更近的用户指令为准。

## 沟通与协作

- 默认使用简体中文沟通，结论清晰、短句优先。
- 先阅读真实代码和 diff，再判断问题；不要基于猜测给方案。
- 用户要求“检查未提交更改”时，按 code review 模式输出：问题优先、按严重程度排序、提供文件和行号。
- 用户要求“修复”时，默认直接实现、验证并汇报结果，不停留在抽象方案。
- 不要覆盖、回滚或整理与当前任务无关的用户改动。

## 工作流

1. 先确认任务范围和相关文件。
2. 对 bugfix/行为变更先补回归测试，确认测试能失败，再做最小实现。
3. 修改代码保持 surgical change，只动必要区域。
4. 修改后运行与改动相关的最小测试集，再视风险运行类型检查或构建。
5. 最终回复必须说明改了什么、验证命令和结果；如果没跑某项验证，要明确说明。

## 并行与任务拆分

- 只有在任务之间没有写冲突、没有强依赖时才并行。
- 并行任务最多 5 个，按语义边界拆分，不按文件大小机械拆分。
- 并行探索可以使用独立 agent；最终合并必须由主 Agent 复核真实 diff 和测试结果。
- 同一文件的重叠修改默认串行处理。

## 项目技术栈

- 包管理器：`pnpm`
- 前端：React 18、Vite、TypeScript、MobX、Ant Design 4
- 测试：Jest 23，`jsdom`
- 服务端/SSR：`src/server`、`src/share`
- Cloudflare Worker 构建：`pnpm build:cf`
- Tauri 桌面壳：`src-tauri`

## 常用命令

```bash
pnpm test
pnpm test -- --runTestsByPath <file...>
pnpm lint:types
pnpm exec tsc -p tsconfig.json --noEmit
pnpm lint:js
pnpm exec eslint src --ext js,jsx,ts,tsx
pnpm exec eslint <changed-file...>
pnpm build:cf
pnpm build:app
```

优先运行与改动相关的窄测试；涉及 SSR、分享页、安全清洗、构建产物时，至少运行相关测试和 `pnpm exec tsc -p tsconfig.json --noEmit`。

提交前如果改动了 `src/**/*.{ts,tsx,js,jsx}`，必须对相关文件运行 ESLint。pre-commit 会通过 `lint-staged` 执行 `eslint --fix "<staged-file...>"`；测试文件若被 ignore 只会输出 warning，真正阻断提交的是 ESLint error。

## 代码风格

- 遵守现有代码风格，不做无关重构。
- Prettier 关键配置：2 空格、双引号、分号、`printWidth: 120`、`trailingComma: all`。
- TypeScript/React 代码优先保持现有 class component、MobX decorator 等项目惯例。
- 不新增依赖，除非用户明确确认。
- 不手动编辑 lockfile，除非依赖变更已被用户确认且由包管理器生成。

## 测试要求

- bugfix 必须有能复现问题的回归测试，除非用户明确要求跳过。
- 测试应覆盖真实行为，不只验证 mock 调用。
- 异步渲染、SSR 快照、Mermaid、MathJax、安全清洗等路径要覆盖失败降级和边界输入。
- 如果测试因环境问题无法运行，要说明命令、失败原因和风险。

## 安全与边界

- 严禁提交密钥、Token、密码或真实生产配置。
- 涉及 HTML/SVG/CSS 清洗、CSP、公开分享、密码访问、限流、SSR 输出时，优先从安全角度复核。
- 不在未确认情况下执行破坏性命令，例如 `git reset --hard`、删除用户文件、批量移动文件。
- 不在未确认情况下新增第三方库或升级依赖。

## Review 输出规范

Code review 时：

- 先列 findings，再给简短总结。
- 只报告离散、可执行、作者会修的问题。
- 使用 `[P1]`、`[P2]` 等标注严重度。
- 如果需要行内评论，使用 `::code-comment{...}` 指令并提供最小行号范围。
- 没有问题时直接说明“未发现需要修复的问题”，并补充剩余风险或未运行的验证。

## 当前仓库重点风险区

- `src/share/security.ts`：HTML/SVG/CSS 清洗，改动需补安全回归测试。
- `src/share/browserSnapshot.ts`：分享快照、Mermaid/MathJax 渲染等待、并发版本冲突。
- `src/share/read.ts`：SSR 分享页 HTML、CSP、公开阅读体验。
- `src/component/Dialog/RenameFileDialog.tsx`：文档设置、公开分享、快照同步入口。
- `worker`、`src/server`：Cloudflare/Node 运行差异，改动后注意对应测试与构建。

## 完成定义

一次任务完成必须满足：

- 代码变更和用户目标直接相关。
- 相关测试、类型检查和 ESLint 已运行，结果可报告。
- 未引入无关格式化或大面积重构。
- 已说明残留风险、未验证项或需要用户确认的后续动作。
