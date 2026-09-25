<script setup lang="ts">
/**
 * ZxPagination - 现代通用分页组件（对齐 shadcn Pagination 规范）
 *
 * 采用 shadcn UI Pagination 设计语言：
 * 1. 结构清晰：Previous / Next 按钮搭配页码列表与 MoreHorizontal 省略号指示；
 * 2. 严格遵循 DESIGN.md：选中页码采用饱满实色底 bg-zx-primary 与纯白对比字 text-[color:var(--zx-color-on-primary)]；
 * 3. 悬停与文本色彩 Token 化：hover:bg-slate-100 text-zx-text，由主题自适应深浅色；
 * 4. 支持紧凑模式（compact）、每页条数切换（showSizeChanger）、条数摘要与快速跳页。
 */
import { computed, ref, watch } from "vue";
import {
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    MoreHorizontal,
} from "lucide-vue-next";
import { ZXSelect, type ZXSelectOption } from "./ZXSelect";

export interface ZxPaginationProps {
    /** 当前页码（从 1 开始，支持 v-model） */
    modelValue?: number;
    /** 别名页码（兼容旧传参） */
    page?: number;
    /** 数据总量 */
    total?: number;
    /** 总页数（若传入则优先使用） */
    totalPages?: number;
    /** 每页条数（支持 v-model:pageSize） */
    pageSize?: number;
    /** 是否禁用 */
    disabled?: boolean;
    /** 是否显示前置汇总文案 */
    showTotal?: boolean;
    /** 自定义汇总文字 */
    summaryText?: string;
    /** 紧凑模式：更小尺寸（h-7）并隐藏文字 */
    compact?: boolean;
    /** 微型模式：工具栏内嵌 |< < n/N > >|，无页码列表与摘要 */
    mini?: boolean;
    /** 排布对齐方式：'between'（摘要左，翻页右）、'center'（居中）、'start'、'end' */
    align?: "between" | "center" | "start" | "end";
    /** 是否显示首尾跳页按钮 */
    showEdges?: boolean;
    /** 是否显示每页条数下拉切换器 */
    showSizeChanger?: boolean;
    /** 可选每页条数配置 */
    pageSizeOptions?: number[];
    /** 是否显示快速跳页输入框 */
    showQuickJumper?: boolean;
}

const props = withDefaults(defineProps<ZxPaginationProps>(), {
    modelValue: 1,
    total: 0,
    pageSize: 20,
    disabled: false,
    showTotal: true,
    summaryText: "",
    compact: false,
    mini: false,
    align: "between",
    showEdges: false,
    showSizeChanger: false,
    pageSizeOptions: () => [10, 20, 50, 100],
    showQuickJumper: false,
});

const emit = defineEmits<{
    (e: "update:modelValue", page: number): void;
    (e: "update:page", page: number): void;
    (e: "update:pageSize", size: number): void;
    (e: "change", page: number): void;
    (e: "change-delta", delta: number): void;
    (e: "page-size-change", size: number): void;
}>();

const currentPage = computed(() => {
    if (props.page !== undefined) return props.page;
    return props.modelValue ?? 1;
});

const resolvedTotalPages = computed(() => {
    if (props.totalPages !== undefined) return Math.max(1, props.totalPages);
    return Math.max(1, Math.ceil(props.total / props.pageSize));
});

const pageSummary = computed(() => {
    if (props.summaryText) return props.summaryText;
    if (props.total <= 0) return "共 0 条";
    const start = (currentPage.value - 1) * props.pageSize + 1;
    const end = Math.min(currentPage.value * props.pageSize, props.total);
    return `显示 ${start}-${end} 条，共 ${props.total} 条`;
});

type PageItem =
    | { type: "page"; value: number }
    | { type: "ellipsis-left" }
    | { type: "ellipsis-right" };

/** 智能窗口分页算法（对齐 shadcn / Radix 风格） */
const visiblePages = computed<PageItem[]>(() => {
    const total = resolvedTotalPages.value;
    const current = currentPage.value;

    if (total <= 7) {
        return Array.from({ length: total }, (_, i) => ({
            type: "page",
            value: i + 1,
        }));
    }

    const items: PageItem[] = [];

    if (current <= 4) {
        for (let i = 1; i <= 5; i++) {
            items.push({ type: "page", value: i });
        }
        items.push({ type: "ellipsis-right" });
        items.push({ type: "page", value: total });
    } else if (current >= total - 3) {
        items.push({ type: "page", value: 1 });
        items.push({ type: "ellipsis-left" });
        for (let i = total - 4; i <= total; i++) {
            items.push({ type: "page", value: i });
        }
    } else {
        items.push({ type: "page", value: 1 });
        items.push({ type: "ellipsis-left" });
        items.push({ type: "page", value: current - 1 });
        items.push({ type: "page", value: current });
        items.push({ type: "page", value: current + 1 });
        items.push({ type: "ellipsis-right" });
        items.push({ type: "page", value: total });
    }

    return items;
});

const setPage = (target: number) => {
    if (props.disabled) return;
    const clamped = Math.max(1, Math.min(target, resolvedTotalPages.value));
    if (clamped !== currentPage.value) {
        const delta = clamped - currentPage.value;
        emit("update:modelValue", clamped);
        emit("update:page", clamped);
        emit("change", clamped);
        emit("change-delta", delta);
    }
};

// 每页条数下拉选项
const pageSizeStr = ref(String(props.pageSize));
watch(
    () => props.pageSize,
    (val) => {
        pageSizeStr.value = String(val);
    },
);

const selectSizeOptions = computed<ZXSelectOption[]>(() =>
    props.pageSizeOptions.map((s) => ({
        label: `${s} 条/页`,
        value: String(s),
    })),
);

const handlePageSizeChange = (val: string) => {
    const size = Number(val);
    if (!isNaN(size) && size > 0) {
        emit("update:pageSize", size);
        emit("page-size-change", size);
        // 重置回第 1 页或计算合法页
        setPage(1);
    }
};

// 快速跳转输入
const jumpInput = ref("");
const handleJump = () => {
    const p = parseInt(jumpInput.value, 10);
    if (!isNaN(p)) {
        setPage(p);
        jumpInput.value = "";
    }
};

const alignClass = computed(() => {
    switch (props.align) {
        case "center":
            return "justify-center";
        case "start":
            return "justify-start";
        case "end":
            return "justify-end";
        case "between":
        default:
            return "justify-between";
    }
});
</script>

<template>
    <nav
        aria-label="分页导航"
        class="flex flex-wrap items-center gap-3 select-none text-xs"
        :class="alignClass"
        role="navigation"
    >
        <!-- 统计摘要 -->
        <div v-if="showTotal" class="text-xs text-zx-text-subtle">
            <slot
                name="summary"
                :current="currentPage"
                :text="pageSummary"
                :total="total"
                :total-pages="resolvedTotalPages"
            >
                <span>{{ pageSummary }}</span>
            </slot>
        </div>

        <!-- 微型分页：工具栏内嵌（|< < n/N > >|） -->
        <div v-if="mini" class="flex items-center gap-0.5">
            <button
                :disabled="disabled || currentPage <= 1"
                aria-label="首页"
                class="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-zx-text-muted transition-colors hover:bg-slate-100 hover:text-zx-text-strong disabled:pointer-events-none disabled:opacity-35"
                type="button"
                @click="setPage(1)"
            >
                <ChevronsLeft class="h-3.5 w-3.5" />
            </button>
            <button
                :disabled="disabled || currentPage <= 1"
                aria-label="上一页"
                class="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-zx-text-muted transition-colors hover:bg-slate-100 hover:text-zx-text-strong disabled:pointer-events-none disabled:opacity-35"
                type="button"
                @click="setPage(currentPage - 1)"
            >
                <ChevronLeft class="h-3.5 w-3.5" />
            </button>
            <input
                :value="currentPage"
                :disabled="disabled"
                :max="resolvedTotalPages"
                class="mx-0.5 h-6 w-9 rounded-md border border-slate-200 bg-white text-center font-mono text-[11px] tabular-nums text-zx-text outline-none focus:border-zx-primary disabled:opacity-40"
                min="1"
                title="当前页"
                type="number"
                @change="
                    setPage(
                        Number(($event.target as HTMLInputElement).value) || 1,
                    )
                "
                @keydown.enter="($event.target as HTMLInputElement).blur()"
            />
            <span class="tabular-nums text-[11px] text-zx-text-subtle">
                / {{ resolvedTotalPages }}
            </span>
            <button
                :disabled="disabled || currentPage >= resolvedTotalPages"
                aria-label="下一页"
                class="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-zx-text-muted transition-colors hover:bg-slate-100 hover:text-zx-text-strong disabled:pointer-events-none disabled:opacity-35"
                type="button"
                @click="setPage(currentPage + 1)"
            >
                <ChevronRight class="h-3.5 w-3.5" />
            </button>
            <button
                :disabled="disabled || currentPage >= resolvedTotalPages"
                aria-label="末页"
                class="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-zx-text-muted transition-colors hover:bg-slate-100 hover:text-zx-text-strong disabled:pointer-events-none disabled:opacity-35"
                type="button"
                @click="setPage(resolvedTotalPages)"
            >
                <ChevronsRight class="h-3.5 w-3.5" />
            </button>
        </div>

        <!-- 翻页控制区 (shadcn PaginationContent) -->
        <div v-else class="flex flex-wrap items-center gap-1 sm:gap-1.5">
            <!-- 首页按钮 -->
            <button
                v-if="showEdges"
                :class="[
                    compact ? 'h-7 w-7' : 'h-9 w-9',
                    disabled || currentPage <= 1
                        ? 'pointer-events-none opacity-40 text-zx-text-subtle'
                        : 'text-zx-text hover:bg-slate-100 hover:text-zx-text-strong cursor-pointer',
                ]"
                :disabled="disabled || currentPage <= 1"
                aria-label="首页"
                class="inline-flex items-center justify-center rounded-lg transition-colors"
                type="button"
                @click="setPage(1)"
            >
                <ChevronsLeft :class="compact ? 'h-3.5 w-3.5' : 'h-4 w-4'" />
            </button>

            <!-- 上一页 (PaginationPrevious) -->
            <button
                :class="[
                    compact ? 'h-7 px-2 text-xs' : 'h-9 px-2.5 sm:px-3 text-sm font-medium',
                    disabled || currentPage <= 1
                        ? 'pointer-events-none opacity-40 text-zx-text-subtle'
                        : 'text-zx-text hover:bg-slate-100 hover:text-zx-text-strong cursor-pointer',
                ]"
                :disabled="disabled || currentPage <= 1"
                aria-label="上一页"
                class="inline-flex items-center justify-center gap-1 rounded-lg transition-colors"
                type="button"
                @click="setPage(currentPage - 1)"
            >
                <ChevronLeft :class="compact ? 'h-3.5 w-3.5' : 'h-4 w-4'" />
                <span v-if="!compact" class="hidden sm:inline">上一页</span>
            </button>

            <!-- 页码项与省略号 (PaginationLink & PaginationEllipsis) -->
            <template
                v-for="(item, idx) in visiblePages"
                :key="item.type === 'page' ? `p-${item.value}` : `el-${idx}`"
            >
                <!-- 具体页码 -->
                <button
                    v-if="item.type === 'page'"
                    :aria-current="item.value === currentPage ? 'page' : undefined"
                    :class="[
                        compact
                            ? 'h-7 min-w-7 px-2 text-xs'
                            : 'h-9 min-w-9 px-3 text-sm font-medium',
                        item.value === currentPage
                            ? 'bg-zx-primary text-[color:var(--zx-color-on-primary)] shadow-2xs font-semibold'
                            : 'text-zx-text hover:bg-slate-100 hover:text-zx-text-strong',
                    ]"
                    :disabled="disabled"
                    class="inline-flex cursor-pointer items-center justify-center rounded-lg transition-colors disabled:pointer-events-none disabled:opacity-40"
                    type="button"
                    @click="setPage(item.value)"
                >
                    {{ item.value }}
                </button>

                <!-- 省略号 -->
                <span
                    v-else
                    :class="compact ? 'h-7 w-7' : 'h-9 w-9'"
                    aria-hidden="true"
                    class="inline-flex items-center justify-center text-zx-text-muted"
                >
                    <MoreHorizontal :class="compact ? 'h-3.5 w-3.5' : 'h-4 w-4'" />
                </span>
            </template>

            <!-- 下一页 (PaginationNext) -->
            <button
                :class="[
                    compact ? 'h-7 px-2 text-xs' : 'h-9 px-2.5 sm:px-3 text-sm font-medium',
                    disabled || currentPage >= resolvedTotalPages
                        ? 'pointer-events-none opacity-40 text-zx-text-subtle'
                        : 'text-zx-text hover:bg-slate-100 hover:text-zx-text-strong cursor-pointer',
                ]"
                :disabled="disabled || currentPage >= resolvedTotalPages"
                aria-label="下一页"
                class="inline-flex items-center justify-center gap-1 rounded-lg transition-colors"
                type="button"
                @click="setPage(currentPage + 1)"
            >
                <span v-if="!compact" class="hidden sm:inline">下一页</span>
                <ChevronRight :class="compact ? 'h-3.5 w-3.5' : 'h-4 w-4'" />
            </button>

            <!-- 末页按钮 -->
            <button
                v-if="showEdges"
                :class="[
                    compact ? 'h-7 w-7' : 'h-9 w-9',
                    disabled || currentPage >= resolvedTotalPages
                        ? 'pointer-events-none opacity-40 text-zx-text-subtle'
                        : 'text-zx-text hover:bg-slate-100 hover:text-zx-text-strong cursor-pointer',
                ]"
                :disabled="disabled || currentPage >= resolvedTotalPages"
                aria-label="末页"
                class="inline-flex items-center justify-center rounded-lg transition-colors"
                type="button"
                @click="setPage(resolvedTotalPages)"
            >
                <ChevronsRight :class="compact ? 'h-3.5 w-3.5' : 'h-4 w-4'" />
            </button>

            <!-- 每页条数切换器 -->
            <div v-if="showSizeChanger" class="ml-1 sm:ml-2">
                <ZXSelect
                    :model-value="pageSizeStr"
                    :options="selectSizeOptions"
                    compact
                    trigger-class="h-7 rounded-md border border-slate-200 bg-white px-2 text-xs text-zx-text shadow-2xs hover:border-slate-300"
                    @update:model-value="handlePageSizeChange"
                />
            </div>

            <!-- 快速跳页 -->
            <div
                v-if="showQuickJumper"
                class="ml-1 flex items-center gap-1 text-xs text-zx-text-subtle sm:ml-2"
            >
                <span>跳至</span>
                <input
                    v-model="jumpInput"
                    :disabled="disabled"
                    :max="resolvedTotalPages"
                    class="h-7 w-12 rounded-md border border-slate-200 bg-white px-1 text-center text-xs text-zx-text shadow-2xs focus:border-zx-primary focus:outline-none"
                    min="1"
                    type="number"
                    @keydown.enter="handleJump"
                />
                <span>页</span>
            </div>
        </div>
    </nav>
</template>
