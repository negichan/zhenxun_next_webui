<!-- markdownlint-disable MD033 MD041 -->
<div align="center">

# 真寻 WebUI

<h4>绪山真寻 Bot 的 Web 管理后台 · Vue 3 + TypeScript</h4>

[![Release](https://img.shields.io/github/v/release/negichan/zhenxun_new_webui?color=76bad9)](https://github.com/negichan/zhenxun_new_webui/releases)
[![Stars](https://img.shields.io/github/stars/negichan/zhenxun_new_webui?style=social)](https://github.com/negichan/zhenxun_new_webui/stargazers)
[![License](https://img.shields.io/badge/license-MIT-yellow)](./LICENSE)
[![Vue](https://img.shields.io/badge/Vue-3.5-42b883?logo=vuedotjs&logoColor=white)](https://vuejs.org/)
[![Vite](https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white)](https://vite.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![pnpm](https://img.shields.io/badge/pnpm-only-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)

[视觉规范](./DESIGN.md) ｜ [协作规范](./AGENTS.md) ｜ [Issues](https://github.com/negichan/zhenxun_new_webui/issues) ｜ [发布页](https://github.com/negichan/zhenxun_new_webui/releases)

“后台就交给真寻酱吧！”

</div>

真寻 Bot 的配套管理面板。插件、文件、配置、数据统计与聊天都在浏览器里完成，不用再翻 YAML 和日志文件。
界面由自研组件与语义色规范手工搭建，不依赖任何第三方 UI 组件库，深浅主题与移动端手感都做了适配。

## 快速开始

### 面板用户

在真寻中启用 WebUI 插件并重启，访问 `http://<后端地址>:8080/next/`。
首次启动会自动拉取前端构建，之后可在 **设置 → 关于 → 前端更新** 里检查并一键更新。

### 源码构建

```bash
pnpm install
pnpm build
```

产物 `dist/` 覆盖到真寻目录下的 `data/web_ui/dist` 即可生效。

### 开发调试

```bash
pnpm dev
```

默认监听 `http://localhost:3000`，`/zhenxun` 已反代到本机 `8080` 后端。

## 预览

<table>
  <tr>
    <td colspan="2"><img src="docs/screenshots/dashboard.png" alt="仪表盘"></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/screenshots/analytics.png" alt="数据统计"></td>
    <td width="50%"><img src="docs/screenshots/plugin.png" alt="插件管理"></td>
  </tr>
</table>

> 截图来自真实运行实例，QQ 号与机器规格、资源占用等敏感信息已做遮蔽或替换处理。

## 社区

- 后端与插件本体：[zhenxun_bot](https://github.com/HibiKier/zhenxun_bot)
- 使用与开发问题欢迎开 [Issue](https://github.com/negichan/zhenxun_new_webui/issues) 交流。

<a href="https://github.com/negichan/zhenxun_new_webui">
<img src="https://api.star-history.com/svg?repos=negichan/zhenxun_new_webui&type=Date" width="600" alt="Star History">
</a>

## 声明

项目仅供学习交流使用，严禁用于任何商业用途和非法行为。

## 许可证

[MIT](./LICENSE)
