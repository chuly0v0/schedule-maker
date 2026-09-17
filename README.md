# 日程长图生成器

一个纯静态网页：左侧编辑日程表格，右侧实时生成固定格式的手机竖版长图，并可下载 PNG、高清 PNG 和 SVG。

## 本地使用

直接打开 `dist/index.html` 即可使用，无需安装依赖或启动服务器。

## 部署到 GitHub Pages

1. 在 GitHub 创建一个新仓库，并将本目录推送到仓库的 `main` 分支。
2. 打开仓库的 **Settings → Pages**。
3. 在 **Build and deployment** 中将 Source 设为 **GitHub Actions**。
4. 推送后，仓库自带的 `Deploy GitHub Pages` 工作流会自动发布 `dist` 目录。

页面全部使用相对路径，因此既支持个人主页仓库，也支持带仓库名称的项目主页地址。
