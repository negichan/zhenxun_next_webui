# DESIGN.md — UI/UX 设计规范

本文档是 `zhenxun_webui` 项目的**唯一官方 UI / UX 设计与样式规范**。
所有开发者及 AI Agent 在进行任何界面开发、样式修改或组件实现时，**必须严格遵循本文档的定义**。

可视化参考基准页在运行时访问：`/ui`（源码：`src/views/ui/UI.vue`）。

---

## 核心设计原则与基准

1. **唯一绝对基准**：以 `src/views/ui/UI.vue` 运行时呈现的语义定义为**唯一绝对标准**。
   - 遇到任何颜色不一致、样式冲突时，**绝对禁止修改 `UI.vue` 中的标准语义定义**，必须以其为准去修改其他业务组件与样式！
2. **饱和实底 + 纯白对比字**：状态标签、徽标以及高亮选中的筛选胶囊，必须使用**高饱和实色底 + 纯白文字 `#ffffff`**（品牌主色使用配套变量 `var(--zx-color-on-primary)`）。**严禁使用半透淡色底**（如 `bg-green-100 text-green-700`、`bg-blue-50` 等淡色块方案已被彻底否决）。
3. **组件规范化**：跨页面通用控件必须复用 `src/components/zxcomponent/` 目录下的统一组件，禁止手写拼接非标样式。**本文档不维护组件清单**（组件会持续增加，写进文档必然滞后）——写界面前先翻该目录、必要时对照 `/ui` 基准页确认形态；目录里已有的，一律复用。
4. **克制现代，严禁滥用 Emoji**：界面设计遵循克制、现代、整洁与统一的专业视觉标准。除明确豁免场景外，**严禁在正式 UI 界面、功能按钮、状态标签、日志等级及通知弹窗中使用 Emoji** 代替矢量图标或堆砌花哨表情。

---

## 全局语义标准色规范（核心铁律）

### 1. 标准语义色对照表

| 语义角色 (Variant) | 标准色 Hex / Token | 对比字颜色 | 核心业务场景与语义规范 |
| :--- | :--- | :--- | :--- |
| `primary` | `var(--zx-color-primary)` / `bg-zx-primary` | `var(--zx-color-on-primary)` | 品牌强调、全部选项、通用激活/选中态 |
| `success` | `#22c55e` / `var(--zx-color-success)` | `#ffffff` | 启用、已安装、已完成、在线、成功状态 |
| `warning` | `#f59e0b` / `var(--zx-color-warning)` | `#ffffff` | 注意、待处理、三方插件、常驻 |
| `danger` | `#ef4444` / `var(--zx-color-danger)` | `#ffffff` | 错误、失败、删除、下线、危险操作 |
| `info` | `#3b82f6` / `var(--zx-color-info)` | `#ffffff` | 提示、版本号、链接、一般信息 |
| `neutral` | `#9ca3af` / `var(--zx-color-neutral)` | `#ffffff` | 禁用、未安装、占位、无状态 |
| `purple` | `#8b5cf6` / `var(--zx-color-purple)` | `#ffffff` | 内置插件、置顶推荐、特殊业务分类 |
| `cyan` | `#06b6d4` / `var(--zx-color-cyan)` | `#ffffff` | 字典、数据类、扩展标识 |

### 2. 状态与筛选按钮规范

- **状态/类型筛选胶囊激活态**：
  - 插件管理与商店等筛选条中，激活态按钮严格对齐上述标准色，未激活态使用统一中性浅灰：
    - 「全部」激活态：`bg-zx-primary text-[color:var(--zx-color-on-primary)] shadow-2xs`
    - 「启用」/「已安装」激活态：`bg-[#22c55e] text-white shadow-2xs`
    - 「禁用」/「未安装」激活态：`bg-[#9ca3af] text-white shadow-2xs`
    - 「内置」激活态：`bg-[#8b5cf6] text-white shadow-2xs`
    - 「三方」激活态：`bg-[#f59e0b] text-white shadow-2xs`
    - 未激活态：`bg-gray-100 text-gray-500 hover:bg-gray-200`（统一加 `btn-touch cursor-pointer rounded-2xl px-3 py-1.5 text-xs font-medium transition-colors`）；
  - 严禁私自引入未经规定的 Tailwind 临时颜色类作为状态筛选高亮。

---

## 主题体系

- 主题变量定义在 `src/assets/theme.css` / `src/theme/`，运行时切换，全部以 **`--zx-color-*`** 为准；
- Tailwind 通过 `--color-zx-*` 映射出工具类：`text-zx-primary`、`bg-zx-primary-soft`、`bg-zx-primary-tint`、`text-zx-danger`、`bg-zx-danger-soft` 等，**优先用这些工具类**而不是写死颜色；
- `bg-white` / `slate-*` / `gray-*` 这批中性色在深色主题下会被 `theme.css` 自动反转，可以放心用作卡片底色和描边；
- **文本颜色用语义 token，不用中性色**：
  - 正文：`text-zx-text`
  - 强调：`text-zx-text-strong`
  - 次级/图标：`text-zx-text-muted`
  - 弱化：`text-zx-text-subtle`
  - 占位符：`placeholder:text-zx-text-subtle`（注意 `placeholder-slate-400` 这类写法在 Tailwind v4 是无效类）；
- 注意历史上存在 `--zx-color-*` 与 `--color-zx-*` 两套前缀，工具类走后者，CSS `var()` 走前者；
- **彩色实体底上的文字一律用配套对比字变量**：
  - 主色底：`text-[color:var(--zx-color-on-primary)]`
  - 语义底：`var(--zx-color-on-success/-warning/-danger/-info/-primary-soft 对应档)`（通用按钮与徽标组件已内置对比字，无需自己加）。
  - 对比字由 `src/theme/colorGenerator.ts` 的 `contrastTextFor()` 统一计算（**YIQ 感知亮度** >0.55 配深灰 `#334155`、否则白）。
  - **禁止** `bg-zx-* text-white` 硬编码（深色主题下 text-white 会被反转，且自定义亮主色下对比错乱），**禁止**使用 HSL 亮度判断对比字。

---

## 组件目录约定

- **`src/components/zxcomponent/`**：只放跨页面复用的通用基础组件（组件库性质）。**本文档不列举组件名单**——组件会持续增加，写进文档必然滞后，有哪些可用一律以目录内实际文件为准（用法与视觉见 `/ui` 基准页）；
- **页面自用组件**：放到所属页面/模块的专用目录：`src/views/<页面>/components/`（如 `views/plugin/components/PluginCard`、`views/manage/components/FriendCard`）或 `src/components/home/`（header 专属：User、HomeHeader、Island、RequestCenter 等）；
- 新建组件前先判断：别的页面也会用 → `zxcomponent`；只有本页面用 → 页面私有目录。

---

## 卡片与圆角规范

- **标准卡片**：`rounded-3xl border border-slate-200 bg-white shadow-sm`（浅内边距 + `overflow-hidden` 按需）。
- **全局大圆角家族**：
  - `rounded-2xl/3xl/4xl` 经 `theme.css` 接到 `--zx-radius-card`（3xl 为基准，2xl 为 -0.5rem，4xl 为 +0.5rem）；
  - 用户在 设置 → 外观 →「卡片圆角」中可实时调节（0–32px，localStorage 覆写，换肤后自动重放）；
  - 新卡片仍写 `rounded-3xl` / `rounded-2xl` 即可自动跟随配置；
  - `rounded-xl/lg` 等控件档不跟随全局大圆角；需要固定小圆角的窗口（如文件编辑器工作台，macOS 风格 12px）固定用 `rounded-xl`。

---

## 徽标 / Tag 规范

- **统一复用 `zxcomponent/` 里的徽标组件**（已自动注册），尺寸与圆角由组件内置（走 MD3 chip 规范的 8dp 圆角，**全圆胶囊已被否决**），业务侧不要覆写；
- **配色**：实色底 + 配套 `on-*` 对比字，底色与标准语义对照表完全一致，禁止在组件上手写硬编码色值或 soft 半透底；
- **语义档**：`primary`（品牌强调/选中）、`success`（启用/完成/在线）、`warning`（注意/待处理/常驻）、`danger`（错误/删除/下线）、`info`（提示/版本/链接）、`neutral`（禁用/占位）、`purple`（内置/置顶）、`cyan`（字典/数据类）；
- 自定义颜色：使用组件的 `color` prop（实色底 + 亮度自动计算对比字）；
- 群角色徽标：群主 `bg-red-500 text-white`、管理员 `bg-blue-500 text-white`、成员 `bg-gray-200 text-gray-500`。

---

## 图标与 Emoji 使用规范（严禁滥用 Emoji）

1. **统一矢量图标体系**：
   - 全局一律使用 **Lucide Vue 图标库**（如 `<CheckCircle2>`、`<AlertCircle>`、`<XCircle>`、`<Info>`、`<Bug>`、`<Clock>`、`<Trash2>` 等）；
   - 图标颜色严格跟随语义或文本色彩 Token（`text-zx-text-muted`、`text-zx-primary` 等），禁止用彩色 Emoji 字符充当 UI 按钮或标识（如 `⚠️`、`❌`、`🐛`、`⏱`、`✨`、`📌` 等）。
2. **通知弹窗语义规范**：
   - 通知组件的 `type` 属性必须严格使用标准枚举：`type: "success" | "error" | "warning" | "info"`；
   - **严禁向 `type` 传递 Emoji 字符串**（如 `type: "🥳"`、`type: "😭"`、`type: "🎉"`、`type: "🧹"` 等）；通知组件已内置标准矢量 SVG 图标与主题动画。
3. **允许使用 Emoji 的严格例外场景**：
   - **头部个性化问候语**：如 `HomeGreeting.vue`（“下午好，继续加油！”等时间段拟人化情境）；
   - **趣味动效粒子**：如 `Confetti` 彩屑特效中的可配置趣味碎片；
   - **用户生成内容（UGC）**：真实聊天消息气泡正文、QQ 昵称原生展示、第三方 API 原始返回正文。
   除上述明确豁免场景外，业务代码、系统配置、设置面板与设计系统一律禁止引入 Emoji。

---

## 按钮规范

- **统一复用 `zxcomponent/` 里的按钮组件**（已全局自动注册），具体 props 与档位以组件源码和 `/ui` 基准页为准，本文档不重复维护；
- 按钮一律胶囊形 + `btn-touch` 微压反馈 + 统一禁用态，图标与文字直接塞默认 slot；
- **主按钮文字**：必须使用 `--zx-color-on-primary` 变量（禁止写死 `text-white`，避免深色主题反转）；
- **特殊交互形态**（分段切换、分页、下拉菜单、弹窗骨架、搜索框、空状态等）**先去目录里找对应组件**——这些形态项目里都已有统一实现；确实没有才允许手写，写完记得沉淀成通用组件。

---

## 页面头部与信息胶囊

- **页面头部（HomeHeader）**：
  - 左侧：用户卡（`User.vue`，`rounded-3xl border bg-white shadow-sm`，跟随全局卡片圆角配置；头像保持 `rounded-full` 圆形）+ 问候语；
  - 右侧：**岛屿（Island）** → 右侧动作圆钮组 → `h-5 w-[1px] bg-slate-200` 竖分隔线隔开；
  - 动作圆钮：`h-9 w-9 rounded-full border border-slate-200 bg-white shadow-sm hover:scale-105`（铃铛/主题/Bot/设置）。
- **岛屿（Island，header 里的信息胶囊）**：
  - 标题胶囊：`rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm hover:scale-105`，彩色图标 + 标签文字；
  - 统计胶囊：`数字（语义色 font-black，v-odometer 滚动动画）+ h-3 w-[1px] bg-black/30 竖线 + 灰色小标签`，每个统计一个胶囊；
  - 数字色按语义：总数 blue、已启用 green、禁用 gray、内置 purple 等。

---

## 工具栏规范（插件页/通用标准）

- 工具栏本身是一张标准卡片：`rounded-3xl border border-slate-200 bg-white p-3 sm:p-4`，搜索/筛选/统计/切换全集成；
- **分段切换 / 搜索框 / 分页**：一律复用 `zxcomponent/` 里对应的组件，容器与选中态样式由组件内置，不在业务侧手抄类名；
- **状态与类型筛选**：未选中一律 `bg-gray-100 text-gray-500 hover:bg-gray-200`，激活态严格对齐标准色（全部 primary、启用/已安装 `#22c55e`、禁用/未安装 `#9ca3af`、内置 `#8b5cf6`、三方 `#f59e0b`，文字纯白且带 `shadow-2xs`），严禁使用淡色半透底；
- **筛选下拉按钮**：复用下拉选择组件，通过其触发器样式入参（如 `trigger-class`）套 `rounded-full border bg-gray-100 text-gray-500 hover:text-gray-700`，不要另写一套下拉；
- **卡片网格**：`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4`。

---

## 首页（Dashboard）

- **大网格布局**：`2xl:grid-cols-[0.6fr_1fr_24rem]`，右栏固定 24rem；
- **资源卡**：进度条 `h-2 rounded-full`，按使用率换语义色（绿 → 黄 → 橙）；
- **时间线**：圆点（首条 `border-zx-primary` 加粗）+ `w-px bg-slate-200` 连线 + 头像。

---

## 弹窗与确认交互

- **确认框 / 简单输入弹窗**：**一律复用 `zxcomponent/` 里的确认框组件**（默认插槽可放自定义内容、支持危险操作二次确认），禁止随意手写 Teleport 弹窗；
- **常规弹窗**：一律复用目录里的弹窗组件（遮罩层级、白色圆角容器、点遮罩/按 Esc 关闭、进出场动效都已内置）；只有文件编辑器工作台这类特殊布局才自定义骨架，此时遮罩仍用 `glass-overlay`、动效仍走 GSAP 预设 `useGsapTransition`；
- **设置弹窗（SettingsModal）**：居中固定尺寸骨架（`w-[min(960px,94vw)] × h-[min(700px,88vh)]`），左侧分组分类导航 + 右侧内容区，无顶部标题栏（标题在侧栏顶部、关闭钮悬浮内容区右上），每页带大标题 + 一行描述，无分割线靠留白分区，退出登录钉在侧边栏最底部，版本号与前端更新收在「关于」页；
- **通知**：统一复用目录里的通知组件，其 `type` 枚举遵循上文 Emoji 规范。

---

## 表单控件规范

- **一律复用 `src/components/zxcomponent/` 下已有的表单控件组件**，本文档不再逐一列举组件名、路径与 props（去目录里看，视觉与用法对照 `/ui` 基准页）；
- **禁止**在业务页面裸写 `<input>` / `<select>` / `<textarea>` 拼样式，也不要重复实现同类控件；目录里确实没有的形态，才新建通用组件放进该目录；
- 表内 / 树内的紧凑 inline 编辑（改名、单元格即时编辑等）可保留原生元素，但样式必须与 `/ui` 展示的控件档位一致；
- **明确豁免**：精确到时分秒的范围筛选继续用原生 `<input type="datetime-local" step="1">`；聊天输入用富文本 `rich-editor`。

> **禁止引入 Element Plus**：项目已彻底移除 Element Plus 依赖，禁止引入任何 `el-*` 组件！加载态用 `animate-spin` 圆环，骨架屏用 `animate-pulse` 色块。

---

## 性能与渲染约定

- **固定行高列表**：使用 `useVirtualList` 虚拟滚动；
- **动态变动行高**（图片/聊天气泡）：使用 `useDynamicVirtualList`；
- **聊天主界面**：采用「底部窗口渲染」，仅渲染最近 N 条，动态扩窗 + 滚动锚定，进入会话瞬时置底。

---

## 前端已知布局陷阱与约定

- **标题规范**：不自创副标题文案；页面头部大标题已全部移除，保持界面开阔；
- **间距规则**：`space-x-*` 对常驻 `v-show` 元素会产生死边距，间距优先使用 `gap-*`；
- **层叠上下文**：无 `@layer` 的规则会压过 Tailwind utilities，需要覆盖工具类时放入 `@layer components`；
- **多列瀑布流**：CSS `column-count` 会虚报固有宽度，容器必须增加 `contain: inline-size`。
