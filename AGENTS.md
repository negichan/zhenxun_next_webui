# AGENTS.md — Agent 开发与协作规范

供所有 AI Agent 及开发者参考的 `zhenxun_webui` 核心工作与开发规范。**在进行任何开发前请完整阅读本文档**。

技术栈：Vue 3 `<script setup>` + TypeScript + Tailwind CSS v4 + GSAP（动效）+ Pinia。

---

## ⚠️ 最高优先级：UI/UX 设计规范强指引

项目已建立完整的 UI/UX 设计规范体系并独立归档至 **[DESIGN.md](./DESIGN.md)**。

**所有涉及界面、样式、颜色、布局、组件选择与动效的改动，必须首先阅读并绝对遵从 [DESIGN.md](./DESIGN.md)！**

### 核心铁律速查（必须遵守）

1. **唯一绝对视觉基准**：
   - 以 `src/views/ui/UI.vue`（浏览器访问 `/ui`）展示的语义色与规范为**唯一绝对标准**；
   - 遇到任何颜色不一致或样式冲突时，**绝对禁止修改 `UI.vue` 中的标准语义定义**，必须以其为准去修改其他业务组件与样式！
2. **全局标准语义色**：
   - 必须严格遵守 8 大语义色标准：`primary` (主色), `success` (`#22c55e`), `warning` (`#f59e0b`), `danger` (`#ef4444`), `info` (`#3b82f6`), `neutral` (`#9ca3af`), `purple` (`#8b5cf6`), `cyan` (`#06b6d4`)；
   - **饱满实色底 + 纯白对比字**：状态标签、徽标、激活筛选胶囊必须使用高饱和实色底 + 纯白对比字（主色使用 `var(--zx-color-on-primary)`），**严禁使用淡色半透底**；
   - 插件管理与商店等状态/类型筛选按钮激活态严格对齐标准色。
3. **全局组件优先**：
   - 写任何界面控件前，**先翻 `src/components/zxcomponent/` 目录**，已有通用组件一律复用，不要重复造轮子；
   - 严禁手写拼装非标样式类。具体有哪些组件、各自的视觉与用法，以该目录实际文件和 `/ui` 基准页为准（本文档不维护组件清单）；
   - 该目录确实没有对应形态时，才新建通用组件并放入该目录。
4. **克制现代，严禁滥用 Emoji**：
   - 严禁在 UI 界面、功能按钮、状态标签或弹窗通知的 `type` 中传入 Emoji 替代标准矢量图标（头部问候语与粒子动效等明确豁免场景除外，详见 `DESIGN.md`）。

👉 **完整的设计系统、颜色 Token、组件规范、卡片圆角与布局陷阱详见：[DESIGN.md](./DESIGN.md)**。

---

## 核心红线与技术约束

1. **包管理（pnpm 专用）**：
   - 依赖严格由 **pnpm** 管理，**严禁执行 `npm install`**（npm 改写 node_modules 会破坏依赖树导致双 Vue 实例 `renderSlot` 读取 null 白屏崩溃）；
   - 新增依赖一律使用 `pnpm add <pkg>`。
2. **类型检查与构建质量**：
   - 完成代码改动后，必须运行 `pnpm type-check` 验证，确保 **0 错误**。
3. **严禁引入 Element Plus**：
   - 项目已彻底移除 Element Plus 依赖，**严禁再引入任何 `el-*` 组件**；
   - 加载态统一使用 `animate-spin` 圆环，骨架屏统一使用 `animate-pulse` 色块。
4. **后端插件软链接与运行仓库路径**：
   - 仓库根目录 `zhenxun-plugin/` 是 Windows junction，指向 `C:\Users\Hanako\PycharmProjects\zhenxun_bot-main\zhenxun\plugins\zhenxun_new_webui-webui`；
   - **后端真实运行副本是 `C:\Users\Hanako\PycharmProjects\zhenxun_bot-main`**，切勿修改闲置副本；
   - 端口约定：前端开发服务器 `localhost:5173`，后端 `localhost:8080`，构建输出 base `/next/`。

---

## 用户协作习惯与代码规范

1. **交流风格**：中文交流，简短直接。不要长篇大论，直接指出关键改动与结论。
2. **代码漂移预警**：用户会随时自行调整或手改代码，**每次修改前务必重新读取目标文件现状**；做单块替换时需精准匹配上下文，严防误删相邻既有逻辑。
3. **验证策略**：日常小样式改动用户会自行在浏览器中查看验证，无需过度横向插桩或无意义调用浏览器截图；重点保障代码逻辑、TypeScript 类型校验通过以及严格符合设计规范。

---

## 关键文档索引

- 🎨 **[DESIGN.md](./DESIGN.md)** — 项目全局 UI/UX 设计规范、语义标准色表、组件库用法
- 🖥️ **运行时基准页** — 本地启动后访问 `/ui`
