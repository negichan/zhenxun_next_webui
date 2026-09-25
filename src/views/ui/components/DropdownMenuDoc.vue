<script setup lang="ts">
import { computed, ref } from "vue";
import {
    ZXDropdownMenu,
    type ZXDropdownMenuOption,
} from "@/components/zxcomponent/ZXDropdownMenu";
import {
    Cloud,
    Download,
    FileCode,
    FilePlus,
    FileText,
    FolderPlus,
    HelpCircle,
    Info,
    Laptop,
    LogOut,
    Moon,
    Printer,
    Redo,
    Save,
    Share2,
    Sliders,
    Sparkles,
    Sun,
    Trash2,
    Undo,
} from "lucide-vue-next";
import DocPreview from "./DocPreview.vue";

// ==================== 1. 桌面应用菜单栏 ====================
const lastAction = ref("");

// 文件菜单
const fileMenuOptions: ZXDropdownMenuOption[] = [
    { label: "新建文件", value: "new-file", icon: FilePlus, shortcut: "Ctrl+N" },
    { label: "新建文件夹", value: "new-folder", icon: FolderPlus },
    { separator: true, label: "", value: "" },
    { label: "保存", value: "save", icon: Save, shortcut: "Ctrl+S" },
    { label: "另存为...", value: "save-as", shortcut: "Ctrl+Shift+S" },
    { separator: true, label: "", value: "" },
    {
        label: "导出",
        value: "export",
        icon: Download,
        children: [
            { label: "导出为 Markdown (.md)", value: "export-md" },
            { label: "导出为 PDF 文档", value: "export-pdf" },
            { label: "导出为 JSON 树", value: "export-json" },
        ],
    },
    { separator: true, label: "", value: "" },
    { label: "退出编辑", value: "exit", icon: LogOut, danger: true },
];

// 编辑菜单
const editMenuOptions: ZXDropdownMenuOption[] = [
    { label: "撤销", value: "undo", icon: Undo, shortcut: "Ctrl+Z" },
    { label: "重做", value: "redo", icon: Redo, shortcut: "Ctrl+Y" },
    { separator: true, label: "", value: "" },
    { label: "剪切", value: "cut", shortcut: "Ctrl+X" },
    { label: "复制", value: "copy", shortcut: "Ctrl+C" },
    { label: "粘贴", value: "paste", shortcut: "Ctrl+V" },
    { separator: true, label: "", value: "" },
    { label: "全选", value: "select-all", shortcut: "Ctrl+A" },
];

// 视图菜单（带状态勾选）
const wrapChecked = ref(true);
const minimapChecked = ref(false);
const lineNumbersChecked = ref(true);

const viewMenuOptions = computed<ZXDropdownMenuOption[]>(() => [
    {
        label: "自动换行",
        value: "toggle-wrap",
        shortcut: "Alt+Z",
        checked: wrapChecked.value,
        keepOpen: true,
    },
    {
        label: "代码缩略图",
        value: "toggle-minimap",
        checked: minimapChecked.value,
        keepOpen: true,
    },
    {
        label: "显示行号",
        value: "toggle-lines",
        checked: lineNumbersChecked.value,
        keepOpen: true,
    },
    { separator: true, label: "", value: "" },
    {
        label: "外观主题",
        value: "theme",
        children: [
            { label: "浅色明亮 (Light)", value: "theme-light", icon: Sun },
            { label: "深色夜间 (Dark)", value: "theme-dark", icon: Moon },
            { label: "跟随系统 (System)", value: "theme-auto", icon: Laptop },
        ],
    },
]);

// 帮助菜单
const helpMenuOptions: ZXDropdownMenuOption[] = [
    { label: "快捷键速查", value: "shortcuts", icon: HelpCircle },
    { label: "开发规范与文档", value: "docs", icon: FileCode },
    { separator: true, label: "", value: "" },
    { label: "关于真寻 WebUI", value: "about", icon: Info },
];

const handleMenuSelect = (opt: ZXDropdownMenuOption) => {
    if (opt.value === "toggle-wrap") wrapChecked.value = !wrapChecked.value;
    else if (opt.value === "toggle-minimap") minimapChecked.value = !minimapChecked.value;
    else if (opt.value === "toggle-lines") lineNumbersChecked.value = !lineNumbersChecked.value;

    lastAction.value = `${opt.label} (${opt.value})`;
};

// ==================== 2. 功能按钮下拉菜单 ====================
const exportAction = ref("");
const actionButtonOptions: ZXDropdownMenuOption[] = [
    { header: true, label: "常用操作", value: "" },
    { label: "复制链接分享", value: "share-link", icon: Share2 },
    { label: "云端同步备份", value: "cloud-sync", icon: Cloud },
    { separator: true, label: "", value: "" },
    { header: true, label: "危险区域", value: "" },
    { label: "清空所有更改", value: "reset-all", icon: Trash2, danger: true },
];

const handleActionSelect = (opt: ZXDropdownMenuOption) => {
    exportAction.value = opt.label;
};

const menubarCode = `<!-- 桌面级应用菜单栏 (ZXDropdownMenu) -->
<div class="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
    <ZXDropdownMenu
        placeholder="文件(F)"
        :options="fileMenuOptions"
        trigger-class="flex h-7 cursor-pointer items-center rounded-lg px-2.5 text-xs font-medium text-zx-text transition-colors hover:bg-zx-primary-soft hover:text-zx-primary"
        @select="handleMenuSelect"
    />
    <ZXDropdownMenu
        placeholder="编辑(E)"
        :options="editMenuOptions"
        trigger-class="flex h-7 cursor-pointer items-center rounded-lg px-2.5 text-xs font-medium text-zx-text transition-colors hover:bg-zx-primary-soft hover:text-zx-primary"
        @select="handleMenuSelect"
    />
    <ZXDropdownMenu
        placeholder="视图(V)"
        :options="viewMenuOptions"
        trigger-class="flex h-7 cursor-pointer items-center rounded-lg px-2.5 text-xs font-medium text-zx-text transition-colors hover:bg-zx-primary-soft hover:text-zx-primary"
        @select="handleMenuSelect"
    />
    <ZXDropdownMenu
        placeholder="帮助(H)"
        :options="helpMenuOptions"
        trigger-class="flex h-7 cursor-pointer items-center rounded-lg px-2.5 text-xs font-medium text-zx-text transition-colors hover:bg-zx-primary-soft hover:text-zx-primary"
        @select="handleMenuSelect"
    />
</div>`;

const actionButtonCode = `<!-- 功能按钮挂载动作下拉菜单 -->
<ZXDropdownMenu
    :options="actionButtonOptions"
    trigger-class="inline-flex h-9 items-center gap-2 rounded-lg bg-zx-primary px-4 text-xs font-semibold text-[color:var(--zx-color-on-primary)] shadow-sm hover:opacity-90 cursor-pointer"
    @select="handleActionSelect"
>
    <template #trigger>
        <span>快捷操作</span>
        <Sliders class="h-3.5 w-3.5" />
    </template>
</ZXDropdownMenu>`;
</script>

<template>
    <div class="space-y-6">
        <!-- 1. 桌面级应用菜单栏 -->
        <DocPreview
            id="desktop-menubar"
            title="桌面应用菜单栏（Application Menu Bar）"
            description="文件编辑器、数据库工作台等桌面级体验专用的独立应用菜单栏组件。基于 Popper 定位在触发按钮下方贴合展开，支持快捷键提示、级联子菜单、状态复选框与危险警示项。"
            :code="menubarCode"
            align="start"
        >
            <div class="flex flex-col gap-4">
                <div class="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
                    <ZXDropdownMenu
                        placeholder="文件(F)"
                        :options="fileMenuOptions"
                        trigger-class="flex h-7 cursor-pointer items-center rounded-lg px-2.5 text-xs font-medium text-zx-text transition-colors hover:bg-zx-primary-soft hover:text-zx-primary"
                        @select="handleMenuSelect"
                    />
                    <ZXDropdownMenu
                        placeholder="编辑(E)"
                        :options="editMenuOptions"
                        trigger-class="flex h-7 cursor-pointer items-center rounded-lg px-2.5 text-xs font-medium text-zx-text transition-colors hover:bg-zx-primary-soft hover:text-zx-primary"
                        @select="handleMenuSelect"
                    />
                    <ZXDropdownMenu
                        placeholder="视图(V)"
                        :options="viewMenuOptions"
                        trigger-class="flex h-7 cursor-pointer items-center rounded-lg px-2.5 text-xs font-medium text-zx-text transition-colors hover:bg-zx-primary-soft hover:text-zx-primary"
                        @select="handleMenuSelect"
                    />
                    <ZXDropdownMenu
                        placeholder="帮助(H)"
                        :options="helpMenuOptions"
                        trigger-class="flex h-7 cursor-pointer items-center rounded-lg px-2.5 text-xs font-medium text-zx-text transition-colors hover:bg-zx-primary-soft hover:text-zx-primary"
                        @select="handleMenuSelect"
                    />
                </div>

                <div class="flex flex-wrap items-center gap-3 text-xs text-zx-text-subtle">
                    <span>最后触发动作：<code class="text-zx-text font-mono font-medium">{{ lastAction || "（等待点击菜单项）" }}</code></span>
                    <span class="text-slate-300">|</span>
                    <span>自动换行：<code class="font-mono" :class="wrapChecked ? 'text-zx-success' : 'text-slate-400'">{{ wrapChecked ? "开启" : "关闭" }}</code></span>
                    <span class="text-slate-300">|</span>
                    <span>显示行号：<code class="font-mono" :class="lineNumbersChecked ? 'text-zx-success' : 'text-slate-400'">{{ lineNumbersChecked ? "开启" : "关闭" }}</code></span>
                </div>
            </div>
        </DocPreview>

        <!-- 2. 操作按钮下拉菜单 -->
        <DocPreview
            id="action-button-menu"
            title="操作按钮下拉菜单（Action Dropdown）"
            description="除了顶部菜单条，ZXDropdownMenu 还可以自定义任意触发按钮（通过 #trigger 插槽）。支持危险操作标红高亮、分组小标题与分隔线。"
            :code="actionButtonCode"
            align="start"
        >
            <div class="flex flex-wrap items-center gap-4">
                <ZXDropdownMenu
                    :options="actionButtonOptions"
                    trigger-class="inline-flex h-9 items-center gap-2 rounded-xl bg-zx-primary px-4 text-xs font-semibold text-[color:var(--zx-color-on-primary)] shadow-sm hover:opacity-90 cursor-pointer transition-opacity"
                    @select="handleActionSelect"
                >
                    <template #trigger>
                        <span>快捷操作</span>
                        <Sliders class="h-3.5 w-3.5" />
                    </template>
                </ZXDropdownMenu>

                <span class="text-xs text-zx-text-subtle">
                    执行操作：<code class="text-zx-text font-mono">{{ exportAction || "（未选择）" }}</code>
                </span>
            </div>
        </DocPreview>
    </div>
</template>
