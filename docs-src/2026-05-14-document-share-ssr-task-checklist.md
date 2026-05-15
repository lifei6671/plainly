# Document Share SSR 执行清单

> **For agentic workers:** 推荐按任务逐项推进并回写勾选状态；每完成一个阶段，先做一次代码评审和验证，再进入下一阶段。

**目标：** 为文档公开分享能力落地一版可上线的快照式 SSR，包括公开首页 `/read`、单篇公开页 `/read/:shareId`、密码访问、快照同步、资源受控访问与缓存一致性。

**方案基线：** 以 [2026-05-14-document-share-ssr-design.md](./2026-05-14-document-share-ssr-design.md:1) 为准；本清单只负责把方案拆成可执行任务，不重复讨论设计取舍。

**完成标准：**
- 公开设置、快照、公开访问三条链路都能跑通
- Node 与 Workers 在分享策略、密码校验、cookie 签名、快照 hash 上行为一致
- 关键安全项全部落地：sanitize、限流、签名 cookie、CSP、资源受控访问、缓存 purge

---

## 0. 开工前阻塞项

- [x] 完成 Workers 运行时下的 HTML sanitize PoC
  - 验证恶意 HTML、中文长文、代码块、表格、图片、有限制 `data:image`
  - 输出结论：选用什么 sanitize 实现、Node/Workers 是否共用同一接口
- [x] 完成 Workers 下 `PBKDF2-SHA-256` PoC
  - 以当前文档约定的迭代次数为起点验证延迟
  - 若超出可接受范围，统一调整全局常量，不允许 Node/Workers 分叉
- [x] 最终确认 sanitize 白名单
  - 标签、属性、协议、`svg`、`style`、`iframe` 是否允许全部写死
- [x] 最终确认公开资源代理策略
  - 首版 `/read/:shareId/assets/:assetId` 只覆盖站内受控图片资源，不覆盖通用附件
  - 资源引用关系表保持单独建表

**阶段通过标准：**
- 两个 PoC 都有明确可执行结论
- 设计文档里不再存在“实现时再决定”的关键安全项

## 1. 数据层与迁移

- [x] 创建 `document_shares` 表迁移
  - 字段以设计文档 `DocumentShareRecord` 为准
  - 包含 `listed`、`password_version`、`snapshot_version`、`snapshot_hash`
- [x] 创建公开资源引用关系表
  - 建议名：`document_share_assets`
  - 至少包含 `document_id`、`asset_id`、`snapshot_hash`、`updated_at`
- [x] 加入索引
  - `UNIQUE(user_id, document_id)`
  - `UNIQUE(share_id)`
  - `INDEX(document_id)`
  - `INDEX(enabled, listed, access_type, duration_type, start_at, end_at)`
  - 列表排序依赖的 `documents.created_at` 索引
- [x] 为 Node 侧数据访问层增加分享配置与资源关系的读写封装
- [x] 为 Workers / D1 侧增加等价的数据访问封装

**阶段通过标准：**
- 本地迁移可执行
- 能按 `document_id` 读写分享配置
- 能按 `share_id` 查询公开访问所需最小数据集

## 2. 共享策略与安全模块

- [x] 新建或完善 `src/share/types.ts`
  - 放分享配置、公开访问状态、cookie 负载等类型
- [x] 新建或完善 `src/share/policy.ts`
  - 统一判断：是否公开、是否过期、是否需要密码、是否允许 SSR、是否允许进入 `/read`
- [x] 新建或完善 `src/share/security.ts`
  - HTML sanitize
  - `PBKDF2-SHA-256` 哈希与校验
  - 签名 cookie 的签发与校验
  - 限流辅助逻辑
- [x] 新建或完善 `src/share/snapshot.ts`
  - `snapshot_hash` 计算
  - `snapshot_version` 比较辅助
- [x] 抽出统一访问决策函数
  - 建议职责：输出 `404 / 403 / 410 / 429 / allow`

**阶段通过标准：**
- Node 与 Workers 可复用同一套策略判断
- 密码哈希、cookie 签名、snapshot hash 都能做跨运行时一致性测试

## 3. 已登录设置接口

- [x] 实现 `GET /api/documents/:id/settings`
  - 返回 `DocumentSettingsPayload`
  - 带 `listed`、`passwordVersion`、`publicUrl`
- [x] 实现 `PUT /api/documents/:id/settings`
  - 保存分享配置
  - 处理 `enabled`、`listed`、`accessType`、`durationType`、时间范围、密码更新、`regenerateShareId`
- [x] 落实 `listed` 联动规则
  - 从“长期公开 + 无密码”切到“密码访问”或“限时公开”时，服务端先自动重算 `listed=false`
  - 若本次提交显式传 `listed=true`，必须再经过服务端规则校验
- [x] 落实 `password_version` 更新规则
  - 首次设置密码写入 `1`
  - 改密码时递增
  - 切换回无密码时清理无效密码状态
- [x] 实现 `PUT /api/documents/:id/share/snapshot`
  - 两段式版本判断
  - sanitize 后计算 `snapshot_hash`
  - 过期版本拒绝覆盖

**阶段通过标准：**
- 设置接口不再承载 `htmlSnapshot`
- 快照接口独立可用
- 分享配置切换后，数据库状态与文档约定一致

## 4. 前端设置入口与弹窗

- [x] 把左下角文件名入口改成统一文档设置入口
- [x] 新建或升级 `DocumentSettingsDialog`
  - 基本信息区
  - 公开设置区
- [x] 接入公开设置字段
  - 是否公开
  - 是否显示在公开首页（`listed`）
  - 完全公开 / 密码访问
  - 长期公开 / 时间范围
  - 密码输入
  - 分享链接、复制、重置
- [x] 接入读取接口与保存接口
- [x] 落实前端可见性规则
  - `remote + 已登录` 才展示设置
  - `remote + 未登录` 禁止设置公开
  - `offline` 不显示公开设置区

**阶段通过标准：**
- 用户可以在一个弹窗里完成重命名、目录调整和公开设置
- `listed` 的默认值与联动行为符合后端规则

## 5. 快照生成与同步

- [x] 封装前端快照生成逻辑
  - `htmlSnapshot`
  - `titleSnapshot`
  - `excerptSnapshot`
- [x] 在“保存公开设置成功后”触发快照刷新
- [x] 在“文档内容保存成功后，如果当前处于公开中”触发快照刷新
- [x] 处理快照冲突
  - `snapshot_version` 过期时提示刷新或重试
  - 同版本同 payload 支持幂等重试
- [x] 服务端在快照写入成功后提取内部资源引用
  - 写入 `document_share_assets`

**阶段通过标准：**
- 新文档首次公开后能生成快照
- 公开中的文档修改内容后能刷新快照和资源引用关系

## 6. 公开访问路由

- [x] 实现 `GET /read`
  - SSR 列表页
  - `enabled=true && listed=true && 当前时间有效`
  - `JOIN documents`
  - 按 `documents.created_at DESC`
- [x] 实现 `GET /read/:shareId`
  - 根据访问策略返回 SSR 阅读页、密码页或非 SSR 壳页
- [x] 实现 `POST /read/:shareId/access`
  - 密码校验
  - 限流
  - 写入签名 cookie
- [x] 实现 `GET /read/:shareId/content`
  - 服务端判定时间窗口
  - 服务端校验 cookie
  - 返回清洗后的快照内容
- [x] 实现 `GET /read/:shareId/assets/:assetId`
  - 校验 share 有效
  - 校验资源引用关系存在
  - 校验当前访问条件满足
- [x] 在单篇 SSR 页与列表页落地 robots / CSP / 其他安全头

**阶段通过标准：**
- `/read`、`/read/:shareId`、`/read/:shareId/content`、`/read/:shareId/assets/:assetId` 能形成完整闭环
- 长期公开无密码文档可直接 SSR 打开
- 密码或限时文档可通过受控页访问

## 7. 缓存与失效

- [x] 落实单篇页浏览器短缓存
- [x] 落实单篇页 CDN 长缓存规则
  - 仅对“最后修改时间超过 7 天”的文档启用 7 天 CDN 缓存
- [x] 落实 `/read` 列表页缓存策略
  - 浏览器 `no-store`
  - CDN 短缓存
- [x] 接入主动 purge
  - 快照更新后 purge `/read/:shareId`
  - 影响列表时 purge `/read`
  - `enabled`、`listed`、公开策略变化影响列表可见性时 purge `/read`
  - 重置 `share_id` 时 purge 旧 `/read/{oldShareId}`、新 `/read/{newShareId}`、`/read`

**阶段通过标准：**
- 内容更新后访客不会长时间看到旧页面
- 新公开/取消公开/重置链接后，列表与单篇页缓存都能及时收敛

## 8. 测试与回归

- [x] 策略判断测试
  - 长期公开 / 密码访问 / 限时公开 / 已过期 / 未开始
  - `/read` 是否可展示
  - 是否应走 SSR
- [x] 接口测试
  - 设置读取与保存
  - 快照更新冲突
  - 密码访问成功 / 失败 / 限流
  - 修改密码后旧 cookie 失效
  - 非引用资源禁止访问
- [ ] Node / Workers 一致性测试
  - PBKDF2
  - cookie 签名
  - base64url
  - `snapshot_hash`
  - sanitize 输出
- [ ] 前端交互测试
  - 文件名入口
  - 弹窗校验
  - `listed` 默认值与切换
  - 复制链接
  - 时间范围校验
- [ ] 手工回归
  - `remote` 与 `offline`
  - 已登录与未登录
  - 长期公开无密码
  - 密码公开
  - 限时公开
  - 删除文档 / 复制文档 / 重置分享链接

**阶段通过标准：**
- 关键场景都有自动化覆盖
- 手工回归没有发现“旧内容缓存”“密码失效不一致”“资源越权”这类阻断问题

## 9. 推荐执行顺序

- [ ] 先完成 `0 + 1 + 2`
- [ ] 再完成 `3`
- [ ] 然后并行推进 `4` 与 `5`
- [x] 收口后推进 `6 + 7`
- [ ] 最后执行 `8`

**不建议的顺序：**
- 先做公开页，再补快照和安全模块
- 先做前端弹窗，再补设置接口与数据结构
- 未完成 PoC 就直接进入 Workers 公开访问实现

## 10. 每阶段评审点

- [ ] 阶段 0 结束后做一次方案评审
- [ ] 阶段 3 结束后做一次接口评审
- [ ] 阶段 6 结束后做一次公开访问与安全评审
- [ ] 阶段 8 结束后做一次上线前回归评审

## 11. 首版上线最小范围

如果想先收敛首版范围，建议以下能力必须进首版：

- [ ] 已登录公开设置
- [ ] 快照生成与同步
- [ ] `/read`
- [ ] `/read/:shareId`
- [ ] `/read/:shareId/content`
- [ ] `/read/:shareId/assets/:assetId`
- [ ] 密码访问
- [ ] sanitize / 签名 cookie / 限流 / CSP
- [x] 缓存 purge

以下能力可以作为首版后的增强项：

- [ ] 更复杂的 SEO 优化
- [ ] 更丰富的公开首页样式
- [ ] 更细粒度的资源类型策略
- [ ] 多租户公开列表模型
