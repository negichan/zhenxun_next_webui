<script setup lang="ts">
import { ref } from "vue";
import {
    ZXSelect,
    type ZXSelectOption,
} from "@/components/zxcomponent/ZXSelect";
import {
    AlertCircle,
    CheckCircle2,
    Clock,
    Globe,
    Sparkles,
    XCircle,
} from "lucide-vue-next";
import DocPreview from "./DocPreview.vue";

// 1. 基础选择 (item-aligned)
const basicVal = ref("popular");
const basicOptions: ZXSelectOption[] = [
    { label: "按调用热度排序", value: "popular" },
    { label: "按最新发布时间", value: "latest" },
    { label: "按内存消耗降序", value: "memory" },
    { label: "按评分最高优先", value: "rating" },
];

// 1b. 菜单下拉胶囊
const sourceVal = ref("zhenxun");
const sourceOptions: ZXSelectOption[] = [
    { label: "真寻源", value: "zhenxun" },
    { label: "NoneBot源", value: "nonebot" },
];

// 2. 带矢量图标
const statusVal = ref("running");
const statusOptions: ZXSelectOption[] = [
    { label: "运行中 (Running)", value: "running", icon: CheckCircle2 },
    { label: "等待就绪 (Pending)", value: "pending", icon: Clock },
    { label: "告警异常 (Warning)", value: "warning", icon: AlertCircle },
    { label: "已停用 (Stopped)", value: "stopped", icon: XCircle },
];

// 3. 分组与分隔线
const groupVal = ref("vue");
const groupOptions: ZXSelectOption[] = [
    { header: true, label: "前端框架", value: "" },
    { label: "Vue 3", value: "vue", icon: Sparkles },
    { label: "React", value: "react" },
    { label: "Svelte", value: "svelte" },
    { separator: true, label: "", value: "" },
    { header: true, label: "后端运行环境", value: "" },
    { label: "Node.js", value: "node" },
    { label: "Python", value: "python" },
    { label: "Go", value: "go" },
];

// 4. 紧凑模式
const compactVal = ref("cn");
const regionOptions: ZXSelectOption[] = [
    { label: "中国大陆 (CN)", value: "cn", icon: Globe },
    { label: "中国香港 (HK)", value: "hk", icon: Globe },
    { label: "亚太区域 (AP)", value: "ap", icon: Globe },
    { label: "全球边缘 (Global)", value: "global", icon: Globe },
];

const basicCode = `<!-- 1. 基础下拉选择器 (ZXSelect) -->
<ZXSelect
    v-model="basicVal"
    :options="basicOptions"
    placeholder="请选择排序方式"
/>

<!-- 1b. 菜单下拉胶囊 (mode="dropdown"，工具栏/筛选) -->
<ZXSelect
    v-model="sourceVal"
    :options="sourceOptions"
    mode="dropdown"
/>`;

const statusCode = `<!-- 2. 带矢量图标 -->
<ZXSelect
    v-model="statusVal"
    :options="statusOptions"
    placeholder="请选择运行状态"
/>`;

const groupCode = `<!-- 3. 分组小标题与细分隔线 -->
<ZXSelect
    v-model="groupVal"
    :options="groupOptions"
    placeholder="请选择框架"
/>`;

const compactCode = `<!-- 4. 紧凑模式 (compact) -->
<ZXSelect
    v-model="compactVal"
    :options="regionOptions"
    compact
    placeholder="选择地区"
/>`;
</script>

<template>
    <div class="space-y-6">
        <!-- 1. 基础开箱即用 -->
        <DocPreview
            id="basic-select"
            title="基础选择（ZXSelect）"
            description="开箱即用的现代化下拉选择器。触发器 hover / focus / 展开态统一 1px 主题色边框并以 200ms 平滑过渡；采用 item-aligned 规范：面板展开时垂直位移使选中项直接覆盖对齐触发器，饱满实色底与纯白高对比字高亮呈现，且内部无冗余滚动条遮挡。mode=dropdown 为工具栏菜单胶囊形态（灰底全圆角、popper 定位），非表单输入框。"
            :code="basicCode"
            align="start"
        >
            <div class="flex flex-wrap items-center gap-4">
                <ZXSelect
                    v-model="basicVal"
                    :options="basicOptions"
                    placeholder="请选择排序方式"
                />
                <ZXSelect
                    v-model="sourceVal"
                    :options="sourceOptions"
                    mode="dropdown"
                />
                <span class="text-xs text-zx-text-subtle">
                    已选值：<code class="text-zx-text font-mono">{{ basicVal }}</code>
                    /
                    <code class="text-zx-text font-mono">{{ sourceVal }}</code>
                </span>
            </div>
        </DocPreview>

        <!-- 2. 带矢量图标 -->
        <DocPreview
            id="with-icons"
            title="带矢量图标（With Icons）"
            description="选项支持配置 Lucide Vue 矢量图标，组件自动保持整列图标与文字基线对齐。选中态高亮使用高饱和实色底与纯白文字，视觉层次分明。"
            :code="statusCode"
            align="start"
        >
            <div class="flex flex-wrap items-center gap-4">
                <ZXSelect
                    v-model="statusVal"
                    :options="statusOptions"
                    placeholder="请选择运行状态"
                />
                <span class="text-xs text-zx-text-subtle">
                    选中状态：<code class="text-zx-text font-mono">{{ statusVal }}</code>
                </span>
            </div>
        </DocPreview>

        <!-- 3. 分组与分隔线 -->
        <DocPreview
            id="groups-separators"
            title="分组与分隔线（Groups & Separators）"
            description="使用 header 传入分组小标题，使用 separator 划分分类区域，呈现整齐规范的信息层次。"
            :code="groupCode"
            align="start"
        >
            <div class="flex flex-wrap items-center gap-4">
                <ZXSelect
                    v-model="groupVal"
                    :options="groupOptions"
                    placeholder="请选择框架"
                />
                <span class="text-xs text-zx-text-subtle">
                    选中框架：<code class="text-zx-text font-mono">{{ groupVal }}</code>
                </span>
            </div>
        </DocPreview>

        <!-- 4. 紧凑模式 -->
        <DocPreview
            id="compact-select"
            title="紧凑模式（Compact Mode）"
            description="传入 compact 属性即可启用紧凑高度（h-7）与小字号，自适应 rounded-lg 与主题色悬停 / 聚焦过渡，适合表格行内操作、分页器条数切换以及工具栏筛选区域。"
            :code="compactCode"
            align="start"
        >
            <div class="flex flex-wrap items-center gap-4">
                <ZXSelect
                    v-model="compactVal"
                    :options="regionOptions"
                    compact
                    placeholder="选择地区"
                />
                <span class="text-xs text-zx-text-subtle">
                    选中节点：<code class="text-zx-text font-mono">{{ compactVal }}</code>
                </span>
            </div>
        </DocPreview>
    </div>
</template>
