# Plainly 文档公开与公开阅读 SSR 设计方案

## 1. 背景

当前 Plainly 已具备以下基础：

- 前端主应用为 React + Vite
- Node 侧已有数据服务入口：`src/server/index.ts`
- Cloudflare Workers 侧已有入口：`worker/index.ts`、`worker/api.ts`
- 远端模式下，已登录用户可管理目录、文档、配置

本次需要扩展一个新的“文档公开”能力，并约束 SSR 的适用范围：

- 只有已登录用户可以设置一篇文档是否公开
- 用户可以设置公开时长：
  - 长期公开
  - 一段时间内公开
- 用户可以设置公开方式：
  - 完全公开
  - 密码可访问
- 公开阅读列表页统一使用 `/read`
- 在 `remote` 模式下，公开阅读列表页使用 SSR
- 在 `remote` 模式下，且文档满足“长期公开 + 不需要密码”时，单篇公开访问页使用纯阅读页 SSR
- 其他公开场景不要求 SSR

## 2. 目标

本次设计目标如下：

1. 为已登录用户提供文档公开设置能力
2. 在现有编辑器内增加统一入口，管理文档名称、目录与公开设置
3. 为公开链接建立独立标识，不暴露内部 `document_id`
4. 同时支持普通 Node 运行时和 Cloudflare Workers
5. 提供一个博客首页形态的公开阅读列表页
6. 仅在 `remote` 模式下对目标场景启用 SSR，避免把整个编辑器链路服务端化

## 3. 非目标

本次不处理以下内容：

- 不把整个编辑器页面改造成 SSR 应用
- 不为所有公开场景统一做 SSR
- 不在本次引入复杂的权限模型，如组织共享、多人协作、白名单访问
- 不在本次做公开内容的版本历史能力
- 不在本次把现有浏览器端渲染链完全重写为纯服务端 Markdown 渲染器

## 4. 用户侧功能范围

### 4.1 设置入口

远端模式下，状态栏左下角当前会显示：

- 当前登录状态
- 归属目录
- 文件名

本次改造后：

- 仅当用户已登录时，左下角“文件名”区域可点击
- 点击后弹出统一的“文档设置”弹窗
- 未登录用户不允许打开公开设置
- 离线模式不提供文档公开能力

### 4.2 弹窗能力

弹窗统一管理以下内容：

- 文件名称
- 所属目录
- 是否公开
- 公开方式
  - 完全公开
  - 密码访问
- 公开时间
  - 长期公开
  - 指定时间范围
- 分享链接展示
- 复制分享链接
- 重置分享链接

### 4.3 SSR 规则

仅在 `remote` 模式下使用 SSR。

其中：

- `GET /read`
  - 返回公开阅读列表页 SSR
  - 按创建时间倒序展示已公开文档
- `GET /read/:shareId`
  - 仅以下场景使用 SSR：
    - 已开启公开
    - 访问方式为“完全公开”
    - 公开时长为“长期公开”
    - 分享未过期

以下场景不使用单篇 SSR：

- 密码访问
- 指定时间范围公开
- 未公开
- 已过期
- `offline` 模式

## 5. 总体方案

本次采用：

- **分享配置独立建模**
- **公开链接独立标识**
- **快照式 SSR**

核心原则：

1. 文档本身仍然是编辑器内的业务对象
2. 公开访问能力独立建模，不污染现有文档主链路
3. SSR 只服务于公开阅读列表页和目标公开阅读页，不服务于编辑器
4. Node 与 Workers 共用公开策略判断和 HTML 组装逻辑

## 6. 为什么不直接复用现有前端渲染链做服务端实时渲染

当前渲染逻辑主要依赖 `src/utils/converter.ts`，该模块存在明显浏览器依赖：

- 依赖 `document`
- 依赖 `window`
- 依赖 DOM 查询和样式内联
- 依赖部分前端 UI 反馈能力

因此不能直接把现有渲染逻辑无改造地搬到 Node / Workers 上做实时 SSR。

如果强行实时 SSR，需要：

- 重写纯服务端 Markdown 渲染链
- 处理主题样式与内联逻辑的服务端实现
- 兼容 Node 与 Workers 的运行时差异

这会显著抬高改造成本和风险，不适合作为本次第一阶段方案。

因此本次采用 **快照式 SSR**：

- 前端在合适时机生成可公开阅读的 HTML 快照
- 服务端在符合 SSR 条件时，直接返回完整阅读页 HTML

## 7. 数据模型设计

不建议把分享配置字段直接塞进 `documents` 表。

建议新增独立表：`document_shares`

这样做的原因：

- 分享能力与文档元数据职责分离
- 便于生成和重置独立的公开链接
- 便于后续扩展公开访问控制
- 便于 Node / Workers 两侧保持一致的数据结构

### 7.1 建议字段

```ts
type ShareAccessType = "public" | "password";
type ShareDurationType = "permanent" | "range";

interface DocumentShareRecord {
  id?: number;
  user_id: number;
  document_id: string;

  share_id: string;
  enabled: boolean;
  listed: boolean;

  access_type: ShareAccessType;
  duration_type: ShareDurationType;

  start_at?: number | null;
  end_at?: number | null;

  password_hash?: string | null;
  password_salt?: string | null;
  password_algo?: "pbkdf2-sha256" | null;
  password_version?: number | null;

  html_snapshot?: string | null;
  title_snapshot?: string | null;
  excerpt_snapshot?: string | null;

  snapshot_version?: number | null;
  snapshot_hash?: string | null;
  last_snapshot_at?: number | null;

  created_at: number;
  updated_at: number;
}
```

### 7.2 字段语义

- `share_id`
  - 对外公开标识
  - 不复用 `document_id`
  - 用于生成公开链接
  - 使用至少 128-bit 随机熵生成
  - 推荐 `base64url(randomBytes(16))` 或等价强度方案
  - 不允许使用保留字，例如 `api`、`u`、`s`、`p`、`assets`、`admin`

- `user_id`
  - 仅用于标记这条分享配置的归属用户
  - 当前方案默认 `remote` 模式为单租户实例
  - `/read` 展示的是当前实例内可公开文档，不做跨租户聚合

- `document_id`
  - 复用现有文档主键
  - 继续保持当前字符串 ID 语义，不额外暴露到公开路由

- `enabled`
  - 是否开启公开

- `listed`
  - 是否允许出现在 `/read` 首页
  - 仅表示“可展示在公开首页”
  - 不等同于“持有链接即可访问”

- `access_type`
  - `public`：无密码
  - `password`：密码访问

- `duration_type`
  - `permanent`：长期公开
  - `range`：指定时间范围

- `start_at` / `end_at`
  - 仅当 `duration_type=range` 时生效

- `password_hash` / `password_salt` / `password_algo`
  - 使用统一的 `PBKDF2-SHA-256`
  - Node 与 Workers 均通过 WebCrypto API 实现
  - `password_salt` 使用随机 16 字节，base64 存储
  - 迭代次数使用统一常量，不允许两端各自定义

- `password_version`
  - 仅在 `access_type=password` 时生效
  - 首次设置密码时初始化为 `1`
  - 每次修改密码时递增
  - 访问 cookie 必须携带该版本号
  - 若 cookie 中版本号与当前分享记录不一致，必须视为失效并重新输入密码

- `html_snapshot`
  - 公开阅读页主体 HTML 快照

- `title_snapshot`
  - 阅读页标题快照
  - 入库前必须纯文本化与规范化
  - 输出到 HTML 时再按上下文做 escape

- `excerpt_snapshot`
  - 阅读页摘要快照
  - 入库前必须纯文本化与规范化
  - 输出到 HTML 时再按上下文做 escape

- `snapshot_version`
  - 用于标记快照对应的文档版本
  - 建议直接绑定文档保存后的修订版本号或 `updated_at`
  - 服务端更新快照时必须拒绝过期版本，避免旧快照覆盖新快照

- `snapshot_hash`
  - 基于清洗后的快照内容做结构化 SHA-256
  - 推荐 `sha256(JSON.stringify({html, title, excerpt}))`
  - 用于支持同版本幂等重试与冲突判断

### 7.3 建议索引

- `UNIQUE(user_id, document_id)`
  - 保持每篇文档在当前单租户实例内只对应一条分享配置
- `UNIQUE(share_id)`
  - 保证公开链接唯一
- `INDEX(document_id)`
  - 便于按文档主键读写分享配置
- `INDEX(enabled, listed, access_type, duration_type, start_at, end_at)`
  - 用于 `/read` 列表过滤公开可见文档
- `INDEX(documents.created_at)`
  - 用于 `/read` 列表倒序排序

### 7.3 表约束建议

- `UNIQUE (user_id, document_id)`
  - 每个用户的一篇文档只有一条分享配置

- `UNIQUE (share_id)`
  - 确保公开链接唯一

### 7.4 公开访问路由

公开阅读列表首页：

```txt
/read
```

单篇公开阅读页：

```txt
/read/:shareId
```

示例：

```txt
https://example.com/read
https://example.com/read/8d4f6c7b1a2e4f3d
```

## 8. 前端交互设计

### 8.1 统一弹窗

建议把现有 `RenameFileDialog` 升级为统一的 `DocumentSettingsDialog`。

它统一承载：

- 文件名修改
- 目录选择
- 公开设置

这样能避免：

- 重命名入口和公开设置入口分裂
- 用户在多个地方找设置
- 后续文档级属性越来越散

### 8.2 弹窗布局建议

分为两个区域：

#### 基本信息

- 文件名称
- 所属目录

#### 公开设置

- 开关：是否公开
- 开关：是否显示在公开首页（`listed`）
- 单选：完全公开 / 密码访问
- 单选：长期公开 / 时间范围
- 时间范围控件
- 密码输入框
- 分享链接
- 复制链接按钮
- 重置链接按钮

### 8.3 可见性规则

- 远端模式 + 已登录：展示全部设置
- 远端模式 + 未登录：不允许设置公开
- 离线模式：不显示公开设置区

### 8.4 表单校验规则

- 未登录禁止提交公开设置
- 开启公开时，若不存在 `share_id`，自动生成
- `access_type=password` 时，密码不能为空
- `duration_type=range` 时，开始和结束时间必须合法
- 若结束时间早于开始时间，禁止提交
- 当公开类型从“长期公开 + 无密码”切换为“密码访问”或“时间范围公开”时，服务端必须自动把 `listed` 重算为 `false`
- 只有用户在设置弹窗中显式重新开启 `listed` 时，密码或限时公开文档才允许继续出现在 `/read`

## 9. 快照式 SSR 方案

### 9.1 方案说明

本次 SSR 不做“服务端实时 Markdown 渲染”，而是采用“前端生成 HTML 快照，服务端输出完整文档”的方式。

### 9.2 快照内容

建议生成以下快照内容：

- `html_snapshot`
- `title_snapshot`
- `excerpt_snapshot`

其中：

- 单篇 SSR 阅读页主要使用 `html_snapshot`
- 公开阅读列表页主要使用 `title_snapshot` 与 `excerpt_snapshot`
- 列表查询禁止读取 `html_snapshot`，避免无意义大字段扫描

### 9.3 快照生成时机

建议至少在以下时机触发：

1. 用户在文档设置弹窗里保存公开配置时
2. 文档内容保存成功后，如果当前文档处于公开中，则更新快照

### 9.4 快照版本与并发控制

- 前端上传快照时必须同时带上 `snapshot_version`
- `snapshot_version` 必须绑定到文档保存后的真实版本，而不是前端本地临时状态
- 服务端仅接受 `snapshot_version > 当前已存快照版本` 的新快照更新
- 若 `snapshot_version` 相同：
  - 相同 payload 的重复提交可按幂等重试处理
  - 不同 payload 必须拒绝覆盖
- 如果收到过期快照，服务端返回冲突错误并拒绝覆盖
- 快照清洗、入库、版本比较必须在同一次服务端写入中完成

### 9.5 快照优点

- 不依赖 Node / Workers 上的 DOM
- 不需要立即重写现有前端渲染链
- 运行时成本低
- 两端服务端实现简单

### 9.6 快照缺点

- 公开页不是“请求时实时渲染”，而是“基于最近一次快照”
- 如果内容变化但快照未刷新，公开内容可能短暂滞后

### 9.7 本次接受该权衡

考虑到当前目标是先落地一版稳定能力，这个权衡是可接受的。

## 10. SSR 页面行为

### 10.1 仅在目标条件下启用

只有在 `remote` 模式下，才启用 SSR。

离线模式不输出 SSR 页面。

### 10.2 公开阅读列表页

路由：

- `GET /read`

行为：

- 服务端直接返回完整 SSR HTML
- 当前阶段按单个 `remote` 实例的数据空间列出可公开文档
- 默认仅展示 `listed = true` 的公开文档
- 按 `created_at DESC` 倒序排序
- 第一版默认输出最近 20 条
- 预留 `?page=` 分页参数，避免后续改动 URL 结构
- 列表页默认不做浏览器长期缓存
- 列表页可使用短时 CDN 缓存，但必须配合 purge

这里的 `created_at` 明确定义为：

- 文档主记录的创建时间
- 不是 `document_shares` 这条分享记录的创建时间

这样列表语义更接近博客首页，而不是“最近刚开启公开的文档列表”。

默认规则：

- 长期公开 + 无密码：默认 `listed = true`
- 密码访问：默认 `listed = false`
- 指定时间范围公开：默认 `listed = false`

如果后续需要，也允许用户显式把部分公开文档设为 `listed = true`，但前提是服务端在公开策略变更时必须先自动重算默认值，避免历史 `listed = true` 残留导致误展示。

列表准入条件统一为：

- `enabled = true`
- `listed = true`
- 当前时间满足公开时间窗口

以下文档不出现在公开列表中：

- 未开启公开
- 已过期
- 尚未到公开开始时间
- `listed = false`

列表项建议展示：

- 标题
- 摘要
- 创建时间
- 公开类型标识
  - 完全公开
  - 需密码
  - 限时公开
- 指向单篇公开页的链接
- 列表查询仅选择：
  - `share_id`
  - `title_snapshot`
  - `excerpt_snapshot`
  - `access_type`
  - `duration_type`
  - 文档主记录的 `created_at`

列表页不读取 `html_snapshot`。

实现上：

- 列表查询必须 `JOIN documents`
- `created_at` 取自 `documents.created_at`
- 不允许错误地使用 `document_shares.created_at` 替代

SEO 建议：

- 长期公开 + 无密码 + `listed = true`：允许 `index,follow`
- 密码访问、限时公开、`listed = false`：默认 `noindex,nofollow`

### 10.3 单篇 SSR 阅读页

当以下条件全部满足时：

- `enabled = true`
- `access_type = public`
- `duration_type = permanent`
- 分享未过期
- `html_snapshot` 存在
- `snapshot_version` 存在
- `snapshot_hash` 存在
- 快照已通过服务端 sanitize
- 内容满足最小可展示要求

公开路由直接返回完整 SSR HTML。

### 10.4 单篇 SSR 页内容

服务端返回完整 HTML 文档，包括：

- `<title>`
- `<meta name="description">`
- 页面基础样式
- 文章主体 HTML

主体阅读内容来源于：

- `html_snapshot`

单篇页 robots 建议：

- `listed = true` 且 `access_type=public` 且 `duration_type=permanent`：允许 `index,follow`
- 其他单篇公开页：默认 `noindex,nofollow`

### 10.5 单篇 SSR 响应缓存策略

仅当本次请求实际返回的是单篇 SSR 阅读页，且文章最后修改时间距当前时间已超过 7 天时：

- 输出浏览器缓存头：`Cache-Control: public, max-age=60, must-revalidate`
- 输出 CDN 缓存头：`CDN-Cache-Control: public, max-age=604800`
- 浏览器缓存默认仅保留短时间
- 长时间缓存只放在 CDN 层

这样做的目的：

- 老文章内容变化概率低，适合走更激进的公开缓存
- 降低 Node / Workers 在公开访问场景下的重复渲染与回源压力

如果文章最后修改时间未超过 7 天，则不输出这组 CDN 7 天长期缓存头，并继续使用短浏览器缓存策略。

缓存失效规则：

- 用户重置 `share_id` 后，必须主动 purge：
  - `/read/{oldShareId}`
  - `/read/{newShareId}`
  - `/read`
- 若 `share_id` 不变，但快照内容发生更新，服务端在快照写入成功后必须主动 purge `/read/:shareId`
- 若列表页内容受影响，服务端同时应主动 purge `/read`
- 若文档公开状态发生变化，例如 `enabled` 从 `false -> true` 或 `true -> false`，也必须主动 purge `/read`

### 10.6 SSR 页不包含编辑能力

SSR 阅读页是只读页面，不包含：

- 编辑器
- MobX 注入
- 编辑工具栏
- 应用级交互逻辑

## 11. 非 SSR 场景的访问方案

### 11.1 密码访问

当分享配置为密码访问时：

- `GET /read/:shareId`
  - 返回轻量访问页
  - 提示输入密码
- `POST /read/:shareId/access`
  - 校验密码
- 校验成功后：
  - 再请求公开内容接口
  - 前端把快照内容渲染成只读页面

### 11.2 时间范围公开

当分享配置为时间范围公开时：

- `GET /read/:shareId`
  - 返回轻量访问壳页
- 前端再请求公开内容接口
- 是否满足公开时间窗口由服务端判断
- 服务端允许访问时，前端才展示内容

### 11.3 时间范围 + 密码访问

流程为：

- 先走访问页
- 校验时间
- 再校验密码
- 成功后拉取只读内容

## 12. 接口设计

### 12.1 已登录文档设置接口

建议新增：

- `GET /api/documents/:id/settings`
- `PUT /api/documents/:id/settings`
- `PUT /api/documents/:id/share/snapshot`

读取接口返回：

```ts
interface DocumentShareSettings {
  enabled: boolean;
  listed: boolean;
  shareId?: string;
  accessType: "public" | "password";
  durationType: "permanent" | "range";
  startAt?: number | null;
  endAt?: number | null;
  passwordConfigured: boolean;
  passwordVersion?: number;
  publicUrl?: string;
}

interface DocumentSettingsPayload {
  meta: DocumentMeta | null;
  categories: Category[];
  share: DocumentShareSettings | null;
}
```

默认值语义：

- `accessType` 默认 `public`
- `durationType` 默认 `permanent`
- `listed` 按公开规则自动计算默认值
- `passwordVersion` 在无密码场景下为空

更新接口请求体建议：

```ts
interface UpdateDocumentSettingsInput {
  meta?: {
    name?: string;
    category_id?: string;
  };
  share?: {
    enabled?: boolean;
    listed?: boolean;
    accessType?: "public" | "password";
    durationType?: "permanent" | "range";
    startAt?: number | null;
    endAt?: number | null;
    password?: string | null;
    regenerateShareId?: boolean;
  };
}
```

补充约束：

- 设置接口不直接承载 `htmlSnapshot`
- 文档基础信息与公开配置可以一起保存
- 快照更新必须走独立接口
- 若 `accessType` 从 `public` 切换到 `password`，或 `durationType` 从 `permanent` 切换到 `range`，服务端保存时必须先把 `listed` 默认重算为 `false`
- 若用户在同一次提交中显式传入 `listed=true`，仍需经过服务端规则校验后才允许生效

快照更新接口请求体建议：

```ts
interface UpdateShareSnapshotInput {
  htmlSnapshot: string;
  titleSnapshot: string;
  excerptSnapshot: string;
  snapshotVersion: number;
}
```

快照接口约束：

- `snapshotVersion` 必须提供
- 服务端应先做轻量版本判断
- 只有在当前版本可能被接受时，才继续执行 HTML sanitize
- 最终写入时必须在同一次条件更新中再次校验版本，避免竞态覆盖
- 服务端必须基于清洗后的结果计算 `snapshot_hash`
- 若 `snapshotVersion` 过期，返回冲突错误，拒绝覆盖当前快照
- `html_snapshot` 强制限制在 `1MB ~ 2MB` 以内，超限返回 `413` 或 `400`
- `title_snapshot` 强制限制在 `200` 字以内
- `excerpt_snapshot` 强制限制在 `300` 字以内

### 12.2 公开访问接口

建议新增：

- `GET /read`
- `GET /read/:shareId`
- `POST /read/:shareId/access`
- `GET /read/:shareId/content`

#### `GET /read`

职责：

- 仅在 `remote` 模式下输出 SSR 列表页
- 查询当前实例内处于公开状态的文档
- 仅展示 `enabled = true && listed = true && 当前时间有效` 的文档
- 按文档主记录的 `created_at DESC` 倒序排序
- 支持分页参数预留
- `page >= 1`
- `pageSize` 默认 `20`
- `pageSize` 最大 `50`
- 严禁 `SELECT *`
- 查询时必须 `JOIN documents`
- 返回公开阅读列表页 HTML

缓存建议：

- 浏览器侧：`Cache-Control: no-store`
- CDN 侧：允许短时缓存，但必须配合 `/read` purge

#### `GET /read/:shareId`

职责：

- 判断分享是否存在
- 判断是否过期
- 判断是否符合 SSR 条件
- 判断当前是否为 `remote` 模式
- 当返回单篇 SSR 阅读页时，浏览器始终使用短缓存，CDN 再按文章最后修改时间决定是否附带 7 天缓存头
- 决定返回：
  - SSR 阅读页
  - 密码页
  - 非 SSR 壳页
  - 404 / 410

安全响应头建议：

- `Content-Security-Policy: default-src 'none'; img-src https: http: data:; style-src 'self' 'unsafe-inline'; script-src 'none'; frame-ancestors 'none'`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`

#### `POST /read/:shareId/access`

职责：

- 校验密码
- 以 `shareId + IP` 作为限流维度做失败计数
- 超过阈值后返回 `429`
- 校验成功后写入短期访问 cookie

约束：

- 访问 cookie 使用短期签名票据，而不是无状态明文标记
- cookie 负载至少包含：
  - `shareId`
  - `exp`
  - `purpose`
  - `iat`
  - `passwordVersion`
- 如有密钥轮换需求，可增加 `kid`
- 服务端通过统一密钥做签名校验，Node 与 Workers 使用同一套校验规则
- 默认有效期建议为 `24h`
- cookie 到期后必须重新输入密码
- 访问 cookie 使用 `HttpOnly`
- 访问 cookie 使用 `Secure`
- 访问 cookie 使用 `SameSite=Lax`
- 实际响应时 cookie 的 Path 使用 `/read/{actualShareId}`

#### `GET /read/:shareId/content`

职责：

- 在满足访问条件后返回公开只读内容
- 服务端校验公开时间是否仍然有效
- 对密码访问场景，服务端校验访问 cookie 是否存在且签名合法
- 内容以快照为主
- 仅返回服务端清洗后的快照内容

返回规则建议：

- 尚未到公开开始时间：返回 `403`
- 已超过公开结束时间：返回 `410`
- 密码访问但 cookie 无效或缺失：返回 `403`

统一状态码语义建议：

- `404`：分享不存在
- `403`：分享存在，但当前访问条件不满足
- `410`：分享曾有效，但当前已过期或已失效
- `429`：触发限流

#### `GET /read/:shareId/assets/:assetId`

职责：

- 返回当前公开文档在公开阅读页中引用的受控图片资源
- 服务端校验 share 当前仍有效
- 服务端校验当前文档确实引用了该资源
- 服务端校验当前访问条件满足后才允许读取

实现约束：

- 首版只覆盖“站内受控图片资源”，不把通用附件下载纳入首版范围
- 对已经写入 Markdown 的外部 `http(s)` 图片 URL，不做代理改写，继续直接访问原图床
- 对有限制的 `data:image`，继续以内联方式输出，不走 `/assets` 路由
- 只有“站内相对路径图片”或“未来落到站内私有存储的图片资源”才改写为 `/read/:shareId/assets/:assetId`
- 不在资源读取请求时临时重新解析整份 `html_snapshot`
- 服务端在快照写入成功后，必须基于清洗后的 HTML 提取内部资源引用
- 提取结果应写入独立的资源引用关系，例如 `document_share_assets`
- 资源关系至少应包含：`document_id`、`asset_id`、`snapshot_hash`、`updated_at`
- `asset_id` 首版建议使用站内图片资源记录 ID，若暂时没有独立资源表，可退一步使用“规范化相对路径 + 文档上下文”生成稳定 ID
- 读取资源时仅根据“share 当前有效 + 资源关系存在 + 当前访问条件满足”放行

### 12.3 文档生命周期边界

- 删除文档：
  - 对应公开分享立即失效
  - `/read/:shareId` 后续应返回 `410` 或等价失效状态
- 重命名文档：
  - 不改变 `share_id`
  - 下次刷新快照时同步更新标题与摘要
- 移动目录：
  - 不改变 `share_id`
  - 不影响当前公开访问状态
- 复制文档：
  - 默认不继承原文档的公开配置
  - 新文档需要重新生成自己的分享配置与 `share_id`
- 导入文档：
  - 默认不附带历史公开配置
  - 需要用户在当前实例内重新决定是否公开

## 13. Node 与 Cloudflare Workers 的落地方式

### 13.1 共用模块

建议新增共享模块：

- `src/share/types.ts`
  - 分享相关类型定义

- `src/share/policy.ts`
  - 分享访问策略判断
  - 是否公开
  - 是否过期
  - 是否需要密码
  - 是否应当走 SSR

- `src/share/html.ts`
  - 公开阅读列表页 HTML 组装
  - 单篇只读 SSR 页面 HTML 组装

- `src/share/snapshot.ts`
  - 前端快照生成封装
  - 快照版本辅助逻辑
  - 快照 hash 计算辅助逻辑

- `src/share/security.ts`
  - HTML sanitize
  - 密码哈希与校验
  - 访问限流辅助逻辑
  - 访问 cookie 签名与校验

### 13.2 Node 侧

在 `src/server/index.ts` 中：

- 新增已登录文档设置接口
- 新增 `/read` 路由
- 新增公开访问接口
- 公开访问路由放在登录认证中间件之外

### 13.3 Workers 侧

在 `worker/index.ts` 中：

- 优先判断 `/read` 路由
- 把分享访问导向 Worker 侧处理

在 `worker/api.ts` 中：

- 新增文档设置接口
- 新增公开访问接口
- 复用共享的访问策略判断逻辑

### 13.4 数据访问边界

Node 与 Workers 共用：

- 分享规则
- 公开列表过滤与排序规则
- 页面 HTML 组装逻辑
- 密码哈希策略
- 快照版本比较规则

Node 与 Workers 不共用：

- 具体数据库调用实现
- 各自运行时下的存储初始化

## 14. 安全设计

### 14.1 密码存储

密码访问的密码必须哈希存储，不能明文存储。

建议：

- Node 与 Workers 统一使用 `PBKDF2-SHA-256`
- 两端统一通过 WebCrypto API 实现
- 保存 `password_hash`、`password_salt`、`password_algo`
- `password_salt` 使用随机 16 字节并以 base64 存储
- 迭代次数固定为 `100000`
- 这个值是兼顾 Workers CPU 限制与基础抗暴力破解能力后的首版取值
- 若第一阶段 PoC 证明该值在目标 Workers 计划下不可接受，允许统一下调，但必须保持单一全局常量

### 14.2 分享标识安全

`share_id` 必须使用随机生成，不允许使用：

- 自增 ID
- 直接暴露 `document_id`

### 14.3 时间判断

公开时间有效性必须由服务端判断，不能依赖客户端时间。

### 14.4 公开快照的 HTML 安全

本次方案基于 HTML 快照，因此需要注意：

- 如果正文允许嵌入原始 HTML，公开页存在潜在 XSS 风险

这不是后续增强项，而是上线前必须完成的门槛：

- 服务端接收 `htmlSnapshot` 后必须先执行 HTML sanitize
- 仅允许清洗后的结果入库
- SSR 页面和公开内容接口都只允许输出清洗后的快照
- 若清洗结果为空或不满足最小可展示要求，服务端可拒绝本次快照写入
- 第一阶段必须先完成 Workers 运行时下的 sanitize PoC，再进入公开访问实现阶段
- 若共用 `src/share/security.ts` 无法同时覆盖 Node 与 Workers，则必须保持统一接口，按运行时拆分底层实现

首版 sanitize 白名单正式拍板如下：

- 允许标签：
  - 排版与结构：`article`、`aside`、`blockquote`、`br`、`div`、`figure`、`figcaption`、`hr`、`p`、`section`、`span`
  - 标题：`h1` ~ `h6`
  - 文本强调：`strong`、`em`、`i`、`del`
  - 列表：`ul`、`ol`、`li`
  - 代码：`pre`、`code`
  - 表格：`table`、`thead`、`tbody`、`tr`、`th`、`td`
  - 链接与图片：`a`、`img`
- 允许属性：
  - 全局：`class`、`title`、`lang`、`dir`、`role`、`aria-label`、`aria-hidden`
  - 链接：`href`、`target`、`rel`
  - 图片：`src`、`alt`、`title`、`width`、`height`
  - 表格单元格：`align`、`colspan`、`rowspan`
  - 表头额外允许：`scope`
- 允许 URL：
  - `href` 仅允许 `http:`、`https:`、站内相对路径、`./`、`../`、锚点 `#`
  - `img src` 仅允许 `http:`、`https:`、站内相对路径、`./`、`../`
  - `img src` 允许有限制的 `data:image/(png|gif|jpeg|jpg|webp);base64,...`
- 强制移除：
  - 所有事件属性，例如 `onclick`
  - 所有内联 `style`
  - `javascript:` 等非白名单协议
- 明确不允许并整节点移除：
  - `script`、`style`、`iframe`、`svg`、`object`、`template`、`noscript`、`math`
- 对未知非白名单标签：
  - 若运行时支持，优先“移除标签但保留文本/子节点”
  - 若不支持，再退化为整节点移除
- 对链接补充约束：
  - `target` 仅允许 `_self`、`_blank`
  - 若 `target=_blank`，服务端必须补齐 `rel="nofollow noopener noreferrer"`

SSR 页面模板拼装时必须区分：

- `titleText`
- `descriptionText`
- `bodySafeHtml`

其中 `titleText` 和 `descriptionText` 必须使用纯文本 + escape，`bodySafeHtml` 只能来自服务端清洗后的快照。

> 注意：若后续要引入新的 HTML sanitize 依赖，需要单独确认依赖变更。

### 14.4.1 SSR 页面安全响应头

- `Content-Security-Policy: default-src 'none'; img-src https: http: data:; style-src 'self' 'unsafe-inline'; script-src 'none'; frame-ancestors 'none'`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`

### 14.5 密码暴力破解防护

- `POST /read/:shareId/access` 必须做速率限制
- 限流维度使用 `shareId + IP`
- 默认阈值建议为 10 次失败 / 分钟
- 超过阈值返回 `429`
- Workers 可使用 KV / Durable Object 一类能力保存失败计数
- Node 单实例环境可使用内存保存失败计数
- Node 生产多实例环境必须使用共享持久化存储，例如 Redis

### 14.6 公开缓存一致性

- 快照写入成功后必须触发对应公开页缓存失效
- 若影响列表展示，同时失效 `/read`
- 若公开状态从开启变为关闭，或从关闭变为开启，也必须失效 `/read`
- 不能只依赖 7 天 TTL 等待自然过期

### 14.7 公开资源访问策略

- 公开 HTML 中引用的图片、附件、资源访问方式必须显式定义
- 默认不能因为文档公开，就自动把所有私有附件直接暴露为永久公开 URL
- 第一版建议：
  - 首版只处理图片资源，不承诺通用附件下载代理
  - 已经上传到外部图床/R2/OSS/七牛并写成完整 `http(s)` URL 的图片，视为外部公开资源，不再额外代理
  - 只有站内私有图片资源才通过 `shareId` 受控代理访问
  - 只有满足公开访问条件时才允许读取
  - 无法通过 `shareId` 授权的站内私有资源，不允许在公开页中直接可见
  - 快照写入成功后立即提取并持久化资源引用关系，资源读取阶段只使用持久化关系做授权判断
  - 如果后续产品真的引入“文档附件下载”，再单独扩展附件路由与附件授权模型

## 15. 建议的实现顺序

详细的可执行清单见：

- [2026-05-14-document-share-ssr-task-checklist.md](/d:/wx_lifeilin/github.com/lifei6671/plainly/docs-src/2026-05-14-document-share-ssr-task-checklist.md:1)

### 第一阶段：数据与接口铺路

1. 扩展分享相关类型定义
2. 为 SQLite / D1 增加 `document_shares` 表
3. 完成 Workers 运行时下的 HTML sanitize PoC
4. 完成 Workers 下 PBKDF2 迭代次数与延迟 PoC
5. 确定 PBKDF2、HTML sanitize、限流、签名 cookie 的共享实现
6. 实现 Node / Workers 的文档设置读写接口

### 第二阶段：前端入口与弹窗

1. 把左下角文件名改为可点击入口
2. 新建或升级为统一的 `DocumentSettingsDialog`
3. 接入分享设置的表单读写

### 第三阶段：快照能力

1. 在前端封装公开快照生成逻辑
2. 在保存设置和保存文档时刷新快照
3. 接入 `snapshot_version` 并完成过期快照拒绝逻辑
4. 接入 `snapshot_hash` 计算与幂等判断

### 第四阶段：公开访问

1. 实现 `/read` 路由
2. 实现 `/read/:shareId` 路由
3. 实现密码访问接口
4. 实现公开内容读取接口
5. 实现长期公开无密码场景的单篇 SSR 页
6. 实现公开阅读列表页 SSR
7. 接入公开页与列表页缓存 purge
8. 接入公开资源受控访问策略

### 第五阶段：验证与补全

1. 回归登录态与未登录态差异
2. 回归各种公开组合场景
3. 回归 Node / Workers 两侧行为一致性

## 16. 测试建议

### 16.1 策略判断测试

至少覆盖：

- `remote` 模式下公开列表可 SSR
- `offline` 模式下不输出 SSR
- 过期快照上传会被拒绝
- 相同 `snapshot_version` + 相同 payload 的重试可幂等通过
- 未公开
- 长期公开 + 无密码
- 长期公开 + 有密码
- 时间范围公开 + 无密码
- 时间范围公开 + 有密码
- 已过期
- 尚未到公开开始时间

### 16.2 接口测试

至少覆盖：

- 已登录用户读取文档设置
- 已登录用户保存文档设置
- 公开阅读列表返回倒序结果
- 公开阅读列表过滤掉未生效和已过期文档
- 公开阅读列表默认只展示 `listed = true` 的文档
- 公开策略切换后 `listed` 会按规则自动重算
- 公开阅读列表只查询必要字段
- 生成分享链接
- 重置分享链接
- 密码访问成功 / 失败
- 密码访问触发限流并返回 `429`
- 修改密码后旧 cookie 立即失效
- 公开内容访问成功 / 失败
- 非引用资源不能通过 `/read/:shareId/assets/:assetId` 读取
- 快照更新后公开页缓存被主动失效
- Node / Workers 对签名 cookie 的校验结果一致
- Node / Workers 对 `snapshot_hash` 的计算结果一致

### 16.3 前端交互测试

至少覆盖：

- 左下角文件名入口点击
- 未登录时不允许设置公开
- 弹窗表单校验
- `listed` 开关的默认值与手动切换
- 复制链接
- 时间范围校验
- `/read` 列表跳转到单篇公开页
- 密码文档在列表中显示“需密码”标识
- 非 listed 文档不会出现在 `/read` 首页

## 17. 当前推荐结论

本次推荐正式方案如下：

- 入口上：点击左下角文件名，打开统一文档设置弹窗
- 数据上：新增独立 `document_shares` 表
- 链接上：使用独立 `share_id`
- 首页展示上：增加 `listed` 控制是否出现在 `/read`
- 渲染上：采用快照式 SSR
- 列表上：使用 `/read` 作为公开阅读首页，并通过 SSR 输出
- SSR 运行时上：仅 `remote` 模式启用 SSR
- 单篇 SSR 触发条件上：仅“长期公开 + 无密码”走纯阅读页 SSR
- 缓存上：浏览器只做短缓存，CDN 可做长缓存，并在快照更新后主动 purge
- 其他公开场景：统一走非 SSR 的受控访问页
- 运行时上：Node 与 Workers 共用访问策略与 HTML 组装逻辑

## 18. 待你确认或修改的点

以下内容建议你在正式开工前最终拍板：

1. 文档设置弹窗是否直接替代现有重命名弹窗
2. 是否允许用户主动“立即失效当前公开链接”
3. 列表页第一版默认每页条数
   - 20
   - 50
4. 多租户场景下是否要升级公开列表路由模型
   - 保持当前单租户实例模型
   - 未来改为带租户上下文的公开列表路由

## 19. 涉及的现有代码位置

本方案直接关联到以下现有文件：

- `src/App.tsx`
- `src/component/Dialog/RenameFileDialog.tsx`
- `src/layout/Dialog.tsx`
- `src/data/store/types.ts`
- `src/data/store/schema.ts`
- `src/data/store/remote/RemoteDataStore.ts`
- `src/data/store/browser/BrowserDataStore.ts`
- `src/server/index.ts`
- `src/server/NodeDataStore.ts`
- `worker/index.ts`
- `worker/api.ts`
- `src/utils/converter.ts`
