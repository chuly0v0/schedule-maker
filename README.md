# 日程长图生成器

一个无需服务器的纯静态网页。左侧填写日程，右侧实时生成手机竖版长图。

## 功能

- 相同日期和卡片标题自动分组
- 自动保存当前浏览器中的草稿
- 导入和导出 Excel 表格
- 导出 PNG、高清 PNG 和 SVG
- 支持 Emoji、长标签换行和重点日期标记
- 支持本地打开与 GitHub Pages 部署

## 项目结构

```text
dist/                              GitHub Pages 实际发布目录
  index.html                       页面入口
  app.js                           表格、预览、存储和导入导出逻辑
  styles.css                       页面样式
  favicon.svg                      网站图标
  vendor/xlsx.full.min.js          本地 Excel 读写库
.github/workflows/deploy-pages.yml GitHub Pages 自动部署工作流
```

## 本地使用

直接打开 `dist/index.html`，无需安装依赖或启动服务器。

## 部署到 GitHub Pages

### 1. 创建 GitHub 仓库

在 GitHub 新建一个空仓库，例如 `schedule-maker`。创建时不要勾选自动生成 README、`.gitignore` 或 License。

### 2. 提交当前版本

在本项目目录中运行：

```powershell
git add dist .github/workflows/deploy-pages.yml README.md
git commit -m "Prepare GitHub Pages release"
```

### 3. 添加 GitHub 远程仓库并推送

当前项目已经有一个名为 `origin` 的内部远程地址。建议另外添加名为 `github` 的远程地址，避免覆盖原地址：

```powershell
git remote add github https://github.com/你的用户名/schedule-maker.git
git push -u github main
```

如果之前已经添加过 `github`，更新地址后再推送：

```powershell
git remote set-url github https://github.com/你的用户名/schedule-maker.git
git push -u github main
```

### 4. 启用 GitHub Pages

进入 GitHub 仓库：

1. 打开 **Settings → Pages**。
2. 在 **Build and deployment** 中把 **Source** 设为 **GitHub Actions**。
3. 打开仓库的 **Actions** 页面，等待 `Deploy GitHub Pages` 任务变为绿色。

部署完成后的地址通常是：

```text
https://你的用户名.github.io/schedule-maker/
```

### 5. 后续更新

修改完成后运行：

```powershell
git add dist
git commit -m "Update schedule maker"
git push github main
```

每次推送到 `main` 分支都会自动重新发布 `dist` 目录。

## 注意事项

- 页面全部使用相对路径，支持带仓库名称的 GitHub Pages 地址。
- Excel 库已保存在项目内，部署后不依赖外部 CDN。
- 草稿保存在浏览器本地；本地文件和 GitHub Pages 网站属于不同地址，草稿不会自动互相迁移。
- 不要删除 `dist/vendor/xlsx.full.min.js`，否则 Excel 导入导出会失效。
