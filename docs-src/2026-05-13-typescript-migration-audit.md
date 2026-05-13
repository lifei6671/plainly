# Plainly JavaScript -> TypeScript 迁移审计

## 1. 结论

- 可以迁移，但**不建议一次性把全部 `.js/.jsx` 直接改成 `.ts/.tsx`**。
- 当前仓库更适合采用**渐进式迁移**：
  - 先补齐构建、测试、发布链路对 TypeScript 的支持；
  - 再从低耦合、低风险目录开始迁；
  - 最后处理 `MobX store + App/Lib 入口 + Node/CJS 脚本` 这些高风险区域。
- 综合评估结果：
  - **技术可行性：高**
  - **一次性全量迁移风险：中高**
  - **分阶段迁移风险：中**

## 2. 本次审计依据

本次判断基于仓库真实结构、配置与抽样代码，而不是泛泛经验：

- 已存在 TypeScript 基础设施：
  - `tsconfig.json`
  - `tsconfig.server.json`
  - `src/server/*.ts`
  - `src/data/store/*.ts`
- 当前 `tsconfig.json` 已开启：
  - `allowJs: true`
  - `checkJs: false`
  - `noEmit: true`
- 当前 Vite 构建支持 `.[jt]sx?`
- 已执行 `pnpm exec tsc -p tsconfig.json --noEmit`
  - 当前基线通过，说明**渐进迁移路径是成立的**

## 3. 现状统计

### 3.1 文件规模

- `.js` 文件约 `100` 个
- `.jsx` 文件约 `93` 个
- `.ts/.tsx` 文件约 `9` 个

### 3.2 主要分布

- `src/component/MenuLeft`：`44`
- `src/template`：`35`
- `src/utils`：`22`
- `src/icon`：`18`
- `src/component/Dialog`：`10`
- `src/search`：`10`
- `src/store`：`7`
- `config`：`7`
- `src/component/ImageHosting`：`7`

### 3.3 当前仓库形态

这个仓库不是“完全没有 TS 的老 JS 项目”，而是：

- **TypeScript 已接入，但源码主体仍以 JS/JSX 为主**
- **前端运行时、测试链、npm 发布链、Node 脚本链并存**
- **既是应用仓库，也带库发布能力**

这意味着迁移不仅仅是“改后缀”，还要同步考虑：

- 应用构建
- 测试执行
- npm 发布
- 类型声明产物
- Electron/Node/Worker 侧脚本语义

## 4. 风险判断

### 4.1 低风险区域

这类文件通常依赖浅、边界清晰，适合最先迁移：

- `src/template/**`
- `src/icon/**`
- 一部分纯函数型 `src/utils/**`
- `worker/api.js`
- `worker/index.js`

特征：

- 主要是静态对象、模板映射、简单工具函数、无复杂状态注入
- 改成 `.ts/.tsx` 后，类型收益比较直接
- 对全局运行时影响较小

### 4.2 中风险区域

这类文件通常可以迁，但需要配合接口定义、测试和少量重构：

- `src/search/**`
- `src/component/ImageHosting/**`
- `src/utils/**` 中带异步、第三方 SDK、DOM 操作的模块
- `stories/**`
- 非核心 `layout` / `dialog` / `component` 组件

特征：

- 有一定跨模块引用
- 可能依赖浏览器 API、第三方库、动态 import、测试 mock
- 迁移时容易暴露隐式数据结构和空值处理问题

### 4.3 高风险区域

这类文件不建议早迁，也不建议多处同时并行写入：

- `src/store/**`
- `src/App.jsx`
- `src/Lib.jsx`
- `src/index.jsx`
- `main.js`
- `watch.js`
- `config/**/*.js`
- `scripts/**/*.js`

高风险原因如下：

### A. MobX 装饰器链路重

`src/store/*.js` 和 `src/App.jsx` 中大量使用：

- `@observable`
- `@action`
- `@inject`
- `@observer`

这会把风险从“文件改后缀”升级为“编译器与装饰器兼容性改造”：

- TS 编译选项要与 Babel/Vite 保持一致
- 注入式 props 需要补类型
- store 字段默认值、可空性、实例初始化时序会显性化

### B. 发布链未完整接住 TS

当前 `package.json` 中 `publish:npm` 仍只处理：

- `.js`
- `.jsx`

这意味着如果直接把库入口及相关源码改为 `.ts/.tsx`，**npm 发布链会先坏掉**。

### C. 测试链对 TS 支持不完整

当前 Jest 匹配已经包含 `ts/tsx`，但 Babel 配置没有完整体现测试编译 TS 的链路约束。

风险表现：

- 测试可能在“跑得起来”和“正式发布可用”之间出现断层
- 单测通过不等于 npm 产物可发布

### D. Node/CJS 脚本区语义不同

以下文件大量使用 CommonJS：

- `main.js`
- `watch.js`
- `config/**/*.js`
- `scripts/**/*.js`

这些文件迁移到 TS 后，常见连带问题包括：

- `module` / `require` / `exports` 语义处理
- Node ESM/CJS 边界
- 执行入口命令需要同步调整
- 构建脚本与运行脚本的文件扩展名、输出位置需要重新约定

## 5. 当前最关键的真实风险点

这几个点是本次审计里最需要优先处理的，不解决就不适合开始大规模迁移：

### 5.1 发布脚本只转译 JS/JSX

`publish:npm` 现在只输出 `.js,.jsx`。

影响：

- 一旦库源码迁成 `.ts/.tsx`，发布物可能不完整
- `typings`、入口文件、实际产物之间可能脱节

### 5.2 `docs/` 是构建输出目录

Vite `build.outDir = "docs"`。

影响：

- 不适合把源码文档、迁移清单、设计文档存放在 `docs/`
- 后续任何 build 都有概率把这些文档清掉

### 5.3 核心入口耦合广

`src/App.jsx`、`src/Lib.jsx` 同时连接：

- MobX store
- 编辑器实例
- 预览逻辑
- 登录态
- 图床逻辑
- 本地/远端数据存储

影响：

- 入口文件改 TS 时，容易把一大批隐式类型问题同时拉出来
- 如果工具链和 store 还没稳定，会造成连锁改动

## 6. 推荐迁移策略

### 6.1 总原则

- **先铺路，再迁码**
- **先叶子节点，再核心入口**
- **先运行时源码，再脚本配置**
- **每一阶段都要能独立构建和验证**

### 6.2 推荐阶段

### Phase 0：补齐基础设施

目标：让仓库具备“JS/TS 并存且可稳定验证”的能力。

建议内容：

- 明确 TS 编译、测试、发布链路
- 校准 Babel/Jest/Vite/npm publish 的职责边界
- 明确装饰器策略
- 明确库入口和声明文件生成方式

完成标志：

- `build`
- `test`
- `lint`
- `publish:npm`

都能在 JS/TS 混合状态下稳定运行

### Phase 1：低风险叶子模块

建议优先迁移：

- `src/template/**`
- `src/icon/**`
- 简单 `src/utils/**`

目标：

- 建立迁移模板
- 验证 import 路径、别名、tsx 组件写法、基础类型风格

完成标志：

- 这些目录迁完后，应用仍可正常启动
- 不引入额外工具链问题

### Phase 2：中风险业务工具模块

建议迁移：

- `src/search/**`
- `src/component/ImageHosting/**`
- 剩余 `src/utils/**`
- `worker/**`

目标：

- 把数据结构、异步接口、第三方 SDK 参数先类型化
- 在核心 UI 入口之前，把业务底座先稳住

完成标志：

- 搜索、图床、worker 相关功能可回归
- 测试和构建链不回退

### Phase 3：普通 React 组件

建议迁移：

- 非 `inject` 型组件
- 展示型组件
- 对话框、菜单、侧边栏中耦合较低的部分

目标：

- 把组件 props 类型逐步补齐
- 减少后续 `App.jsx` 迁移时的类型噪音

完成标志：

- 大部分组件边界已有明确 props 类型
- TSX 写法与现有 Babel/Vite 流程兼容

### Phase 4：核心状态与入口

最后处理：

- `src/store/**`
- `src/App.jsx`
- `src/Lib.jsx`
- `src/index.jsx`

目标：

- 统一 store 类型
- 明确注入 props
- 解决装饰器与运行时初始化顺序问题

完成标志：

- 核心页面功能回归通过
- 不再依赖大量 `any`
- 入口、状态、组件边界基本稳定

### Phase 5：脚本与配置区

最后再决定是否迁移：

- `main.js`
- `watch.js`
- `config/**/*.js`
- `scripts/**/*.js`

建议：

- 这一阶段不是必须马上做
- 如果收益不大，可以保留 JS

原因：

- 这些文件对“业务类型安全”的收益有限
- 但对“工具链稳定性”的风险较高

## 7. 建议暂时不要做的事

- 不要直接全仓批量改后缀
- 不要先动 `src/store/**`
- 不要先动 `App.jsx` / `Lib.jsx`
- 不要在发布链没补齐前改库入口
- 不要把 `config/`、`scripts/`、`main.js` 当成第一批迁移目标

## 8. 并行迁移的建议边界

如果要并行推进，建议按**物理隔离 + 语义隔离**拆分：

- 可并行：
  - `src/template/**`
  - `src/icon/**`
  - 局部 `src/utils/**`
- 谨慎并行：
  - 不同子目录下的普通组件
- 不建议并行：
  - `src/store/**`
  - `src/App.jsx`
  - `src/Lib.jsx`
  - 会同时影响测试链和发布链的配置文件

## 9. 验收口径

每一阶段都建议至少验证以下内容：

- 类型检查：`pnpm exec tsc -p tsconfig.json --noEmit`
- 构建：`pnpm build`
- 测试：`pnpm test`
- Lint：`pnpm lint`

如果开始动库发布链，还要补一条：

- 发布验证：`pnpm publish:npm`

## 10. 最终建议

如果目标是“把仓库尽量 TS 化，同时不把现有功能链路打断”，推荐采用下面的执行策略：

1. 先做一轮**迁移基建修正**，只改配置和发布/测试链
2. 再做一轮**低风险目录迁移**
3. 然后做一轮**中风险业务模块迁移**
4. 最后再决定是否进入 `store + App + Lib` 核心区
5. Node/CJS 脚本区按收益决定，不必强求全迁

一句话总结：

> 这个项目**能迁**，但不适合“全仓一把梭”；最稳的路线是先把工具链铺平，再从叶子模块逐步收口到核心入口。
