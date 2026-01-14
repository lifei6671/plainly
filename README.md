# Plainly

<p align="center">
  <a href="https://github.com/lifei6671/plainly/actions/workflows/ci.yml?branch=main"><img src="https://img.shields.io/github/actions/workflow/status/clawdbot/clawdbot/ci.yml?branch=main&style=for-the-badge" alt="CI status"></a>
  <a href="https://github.com/lifei6671/plainly/releases"><img src="https://img.shields.io/github/v/release/lifei6671/plainly?include_prereleases&style=for-the-badge" alt="GitHub release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-gpl3.0-blue.svg?style=for-the-badge" alt="GPL 3.0 License"></a>
</p>

## 简介

本项目基于 [markdown-nice](https://github.com/whaoa/markdown-nice) 进行二次开发，再次对原项目所有贡献者表示感谢。

Markdown Nice 是一个可编辑主题的 Markdown 编辑器，适用于公众号等排版场景。

- 支持 Cloudflare R2 作为图床
- 升级 nodejs 支持的版本，目前支持 node v20 以上版本打包
- 支持使用 tauri 打包成本地应用
- 新增文档列表管理功能，支持新建文档、查看历史文档以及编辑和删除历史文档
- 支持图床配置的导入和导出，方便跨浏览器同步配置

欢迎在线使用：<https://mdnice.disign.me>

> 有疑问请参考 [如何有效的解决 mdnice 相关问题？](https://github.com/mdnice/markdown-nice/issues/163)

## 快速开始

### 环境要求

- Node.js 20+
- pnpm 9+
- Rust 工具链（仅在打包 Tauri 应用时需要）

### 安装依赖

```bash
pnpm install
```

### 本地开发

```bash
pnpm dev
```

### 构建 Web 版本

```bash
pnpm build
```

构建产物输出到 `docs/` 目录。

### 打包 Tauri 应用

```bash
pnpm tauri:dev
pnpm tauri:build
```

Tauri 构建产物输出在 `src-tauri/target/release/bundle/`。

### 部署到 Cloudflare Worker

先修改根目录的 wrangler.toml ，将配置修改为你的系信息。

在执行打包和部署命令：

```bash
pnpm build
npx wrangler deply
```


## 常用脚本

- `pnpm dev`：启动本地开发
- `pnpm build`：构建前端静态资源
- `pnpm preview`：本地预览构建产物
- `pnpm tauri:dev`：启动 Tauri 开发模式
- `pnpm tauri:build`：构建 Tauri 安装包
- `pnpm lint`：运行 ESLint 修复

## 发布 Release

项目内置 GitHub Actions：当推送 tag 时会自动构建 Web 与 Tauri 安装包，并发布到同名 Release。

```bash
git tag v1.6.12
git push origin v1.6.12
```

对应配置见 `.github/workflows/release.yml`。

## 主题

目前内置原版所有主题，可在编辑器页面顶部主题菜单中查看，如下所示：

- 默认主题 `@zhning12`
- 山吹 `@ElyhG`
- [蔷薇紫](https://mp.weixin.qq.com/s/x0xqSpQixW2xj5qXCgWSyA) `@HeyRain`
- [全栈蓝](https://mp.weixin.qq.com/s/_lO3cd0FcF0Dg3TRnHPdwg) `@Nealyang`
- [凝夜紫](https://mp.weixin.qq.com/s/0IDhUGxZtMDFGD-Z9Ij_Cg) `@童欧巴` : 适配微信以及Safari的深色模式。“凝夜紫”，寓意在深色模式中也可以发光。
- [萌绿](https://mp.weixin.qq.com/s/iK3r9I28NMWApEydH046-w) `@koala`
- [极简黑](https://mp.weixin.qq.com/s/6UQmAhyXQY6AaYcyd1npIg) `@小鱼` : 公众号自律神仙ScarSu同款~
- [橙心](https://mp.weixin.qq.com/s?__biz=MzIwNTA4NzI1Mw==&mid=2247485062&idx=1&sn=0eaa314bb165c71a8f57c8baf4226f57&source=41#wechat_redirect) `@zhning12`
- 墨黑 `@Mayandev`
- 姹紫 `@djmaxwow`
- [绿意](https://mp.weixin.qq.com/s/gpancJ62Dkd4ccXzFg2g5Q) `@夜尽天明`
- 嫩青 `@画手`
- [WeChat-Format](https://mp.weixin.qq.com/s?__biz=MzIwNTA4NzI1Mw==&mid=2247485061&idx=1&sn=36047ec080d1daaf63d733d18e546ba7&source=41#wechat_redirect) `@画手`
- [兰青](https://mp.weixin.qq.com/s/iL8xlH0I3yOEOrhcBqc0kg) `@Krahets`
- [前端之巅同款](https://mp.weixin.qq.com/s/sSJwPflpzan1R_7kmBRwmQ) `@HeyRain`
- 极客黑 `@hyper-xx`
- 红绯 `@HeyRain`
- [蓝莹](https://mp.weixin.qq.com/s/OfRQaBe3XVXXjE7f84nSwA) `@谭淞宸`
- [科技蓝](https://mp.weixin.qq.com/s/hEQA4GEFycBjvScko4DeqQ) `@夜尽天明`
- [简](https://mp.weixin.qq.com/s/JawcVvG_y8igDK5reRDktg) `@aco`

## License

GPL-3.0
