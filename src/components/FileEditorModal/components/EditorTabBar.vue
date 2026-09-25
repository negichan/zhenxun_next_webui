<script setup lang="ts">
/**
 * 标签栏：整行只放标签，右侧动作组已移到编辑器悬浮动作（EditorActions）。
 * 溢出时显示自绘横向滚动条（可拖拽、点击轨道跳转），并支持滚轮横向滚动。
 * 右侧专用区：md 预览开关 + 更多操作（关闭标签页 / 关闭全部）。
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
    Binary,
    Ellipsis,
    Eye,
    FileText,
    Image as ImageIcon,
    PenLine,
    Save,
    SquareSplitHorizontal,
    SquareSplitVertical,
    X,
} from "lucide-vue-next";
import { ZXSelect, type ZXSelectOption } from "@/components/zxcomponent/ZXSelect";
import { getWorkbenchTabIcon } from "../fileIcons";
import type { Workbench } from "../useWorkbench";
import type { EditorGroupId, EditorTab } from "../types";
import {
    clearDraggingTab,
    currentDraggingGroup,
    currentDraggingTab,
    setDraggingTab,
} from "../types";

export type MarkdownViewMode = "edit" | "split" | "preview";

const props = withDefaults(
    defineProps<{
        wb: Workbench;
        mdMode: MarkdownViewMode;
        group: EditorGroupId;
    }>(),
    {},
);

const emit = defineEmits<{
    "update:mdMode": [mode: MarkdownViewMode];
}>();

const scrollRef = ref<HTMLElement | null>(null);
const thumb = ref({ visible: false, width: 0, left: 0 });
let dragging: { startX: number; startLeft: number } | null = null;
let ro: ResizeObserver | null = null;

const displayTabs = computed(() => props.wb.tabsInGroup(props.group));

const currentActiveTabId = computed(
    () => props.wb.activeTabInGroup(props.group)?.id || "",
);

const activeTab = computed(() => props.wb.activeTabInGroup(props.group));

/** 数据库标签：表 / SQL 用徽标样式，与文件标签区分 */
const isTableTab = (tab: EditorTab) => tab.kind === "table";
const isSqlTab = (tab: EditorTab) => tab.kind === "sql";
const isDbTab = (tab: EditorTab) => isTableTab(tab) || isSqlTab(tab);

/** md 文本标签显示"预览"开关 */
const isMarkdownText = computed(() => {
    const tab = activeTab.value;
    if (!tab || tab.viewMode !== "text") return false;
    const name = tab.name.toLowerCase();
    return (
        name.endsWith(".md") ||
        name.endsWith(".markdown") ||
        tab.language === "markdown"
    );
});

const moreMenu = computed<ZXSelectOption[]>(() => [
    {
        label: "向右拆分编辑器",
        value: "split-right",
        icon: SquareSplitHorizontal,
        disabled: !activeTab.value,
    },
    {
        label: "向下拆分编辑器",
        value: "split-bottom",
        icon: SquareSplitVertical,
        disabled: !activeTab.value,
    },
    {
        label: "切换为上下/左右分栏",
        value: "toggle-split-direction",
        icon:
            props.wb.splitDirection.value === "horizontal"
                ? SquareSplitVertical
                : SquareSplitHorizontal,
        disabled: !props.wb.isSplit.value,
    },
    {
        label: "关闭当前标签",
        value: "close-tab",
        shortcut: "Ctrl+W",
        icon: X,
        disabled: !activeTab.value,
    },
    {
        label: "关闭其他标签",
        value: "close-others",
        disabled: props.wb.tabs.value.length <= 1,
    },
    {
        label: "全部保存",
        value: "save-all",
        shortcut: "Ctrl+Alt+S",
        icon: Save,
        disabled: props.wb.dirtyTabs.value.length === 0,
    },
    {
        label: "关闭全部标签",
        value: "close-all",
        disabled: props.wb.tabs.value.length === 0,
    },
]);

const onMore = (value: string) => {
    if (value === "split-right" && activeTab.value) {
        props.wb.splitTabToRight(activeTab.value.id);
    } else if (value === "split-bottom" && activeTab.value) {
        props.wb.splitTabToBottom(activeTab.value.id);
    } else if (value === "toggle-split-direction") {
        props.wb.toggleSplitDirection();
    } else if (value === "close-tab" && activeTab.value) {
        props.wb.closeTab(activeTab.value.id);
    } else if (value === "close-others") {
        props.wb.closeOtherTabs();
    } else if (value === "save-all") {
        void props.wb.saveAllTabs();
    } else if (value === "close-all") {
        props.wb.closeAllTabs();
    }
};

const updateThumb = () => {
    const el = scrollRef.value;
    if (!el) return;
    const { scrollWidth, clientWidth, scrollLeft } = el;
    if (scrollWidth <= clientWidth + 1) {
        thumb.value = { visible: false, width: 0, left: 0 };
        return;
    }
    const ratio = clientWidth / scrollWidth;
    const widthPct = Math.max(ratio * 100, 6);
    const travel = scrollWidth - clientWidth;
    thumb.value = {
        visible: true,
        width: widthPct,
        left: travel > 0 ? (scrollLeft / travel) * (100 - widthPct) : 0,
    };
};

/** 滚轮在标签栏上直接横向滚动 */
const onWheel = (e: WheelEvent) => {
    const el = scrollRef.value;
    if (!el) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
    }
};

const onThumbDown = (e: PointerEvent) => {
    const el = scrollRef.value;
    if (!el) return;
    dragging = { startX: e.clientX, startLeft: el.scrollLeft };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
};

const onThumbMove = (e: PointerEvent) => {
    const el = scrollRef.value;
    if (!dragging || !el) return;
    const track = el.clientWidth;
    const thumbW = (thumb.value.width / 100) * track;
    const travel = el.scrollWidth - el.clientWidth;
    const dx = e.clientX - dragging.startX;
    el.scrollLeft =
        dragging.startLeft + (dx / Math.max(track - thumbW, 1)) * travel;
};

const onThumbUp = () => {
    dragging = null;
};

/** 点击轨道空白处：按比例跳转 */
const onTrackDown = (e: MouseEvent) => {
    const el = scrollRef.value;
    const track = e.currentTarget as HTMLElement;
    if (!el || e.target !== track) return;
    const rect = track.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    el.scrollTo({
        left: frac * el.scrollWidth - el.clientWidth / 2,
        behavior: "smooth",
    });
};

// DOM 更新后立即重算（不依赖 rAF，后台/遮挡窗格下 rAF 可能停摆）
watch(
    () => displayTabs.value.length,
    () => updateThumb(),
    { flush: "post" },
);
watch(
    () => currentActiveTabId.value,
    () => updateThumb(),
    { flush: "post" },
);

onMounted(() => {
    updateThumb();
    if (scrollRef.value) {
        scrollRef.value.addEventListener("scroll", updateThumb, {
            passive: true,
        });
        ro = new ResizeObserver(updateThumb);
        ro.observe(scrollRef.value);
    }
});

onBeforeUnmount(() => {
    ro?.disconnect();
    scrollRef.value?.removeEventListener("scroll", updateThumb);
});

// ==================== 标签页拖拽换位与占位指示 ====================
const draggedIndex = ref<number | null>(null);
const placeholderGap = ref<number | null>(null);

const setTargetGap = (gap: number) => {
    if (props.wb.tabs.value.length <= 1) {
        placeholderGap.value = null;
        return;
    }
    const fromIndex = draggedIndex.value;
    const fromGroup = currentDraggingGroup.value;

    if (fromGroup === props.group && fromIndex !== null) {
        // 如果落在当前标签所在位置（自身左侧 gap=fromIndex 或右侧 gap=fromIndex+1），原位展示，不插入占位符
        if (gap === fromIndex || gap === fromIndex + 1) {
            placeholderGap.value = null;
            return;
        }
    }
    placeholderGap.value = gap;
};

const onDragStart = (e: DragEvent, index: number) => {
    draggedIndex.value = index;
    const tab = displayTabs.value[index];
    if (tab) {
        setDraggingTab(tab, props.group);
        props.wb.activate(tab.id, props.group); // 拖哪个标签就打开到哪个标签
    }
    if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = "move";
        // 严禁设置 text/plain，防止在编辑器内拖拽时被作为文本输入（如 $0）
        e.dataTransfer.setData("application/x-zhenxun-tab", tab?.id || "");
    }
};

const onDragOver = (e: DragEvent, index: number) => {
    e.preventDefault();
    if (!currentDraggingTab.value || props.wb.tabs.value.length <= 1) return;
    if (e.dataTransfer) {
        e.dataTransfer.dropEffect = "move";
    }
    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    const mid = rect.left + rect.width / 2;
    const isLeft = e.clientX < mid;
    const targetGap = isLeft ? index : index + 1;
    setTargetGap(targetGap);
};

const onScrollRefDragOver = (e: DragEvent) => {
    if (!currentDraggingTab.value || props.wb.tabs.value.length <= 1) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    if (e.target === scrollRef.value) {
        // 鼠标悬停在标签栏空白末尾处
        setTargetGap(displayTabs.value.length);
    }
};

const onScrollRefDragLeave = (e: DragEvent) => {
    const related = e.relatedTarget as Node | null;
    if (!related || !scrollRef.value?.contains(related)) {
        placeholderGap.value = null;
    }
};

const onDropAtGap = (gap: number) => {
    const draggingTab = currentDraggingTab.value;
    const fromGroup = currentDraggingGroup.value;
    const fromIndex = draggedIndex.value;

    placeholderGap.value = null;
    draggedIndex.value = null;
    clearDraggingTab();

    if (!draggingTab || props.wb.tabs.value.length <= 1) return;

    // 跨组拖到当前组标签栏
    if (fromGroup !== props.group) {
        props.wb.moveTabToGroup(draggingTab.id, props.group);
        const groupTabs = props.wb.tabsInGroup(props.group);
        const newFromIndex = groupTabs.findIndex((t) => t.id === draggingTab.id);
        if (newFromIndex !== -1 && newFromIndex !== gap) {
            const toIdx = gap > newFromIndex ? gap - 1 : gap;
            props.wb.moveTab(newFromIndex, toIdx, props.group);
        }
        props.wb.activate(draggingTab.id, props.group);
        return;
    }

    // 同组内换位
    if (fromIndex === null) return;
    if (gap === fromIndex || gap === fromIndex + 1) {
        props.wb.activate(draggingTab.id, props.group);
        return;
    }

    const toIndex = gap < fromIndex ? gap : gap - 1;
    props.wb.moveTab(fromIndex, toIndex, props.group);
    props.wb.activate(draggingTab.id, props.group);
};

const onDrop = (e: DragEvent, index: number) => {
    e.preventDefault();
    if (props.wb.tabs.value.length <= 1) return;
    if (placeholderGap.value !== null) {
        onDropAtGap(placeholderGap.value);
    } else {
        onDropAtGap(index);
    }
};

const onScrollRefDrop = (e: DragEvent) => {
    e.preventDefault();
    if (props.wb.tabs.value.length <= 1) return;
    if (placeholderGap.value !== null) {
        onDropAtGap(placeholderGap.value);
    } else {
        onDropAtGap(displayTabs.value.length);
    }
};

const onDragEnd = () => {
    draggedIndex.value = null;
    placeholderGap.value = null;
    clearDraggingTab();
};

watch(currentDraggingTab, (tab) => {
    if (!tab) {
        placeholderGap.value = null;
        draggedIndex.value = null;
    }
});
</script>

<template>
    <div
        v-if="displayTabs.length > 0"
        class="editor-tab-bar flex flex-shrink-0 select-none flex-col border-b border-slate-200 bg-white"
    >
        <div class="flex h-8 min-w-0 items-stretch">
            <!-- 标签滚动区 -->
            <div
                ref="scrollRef"
                class="flex min-w-0 flex-1 items-stretch overflow-x-auto scrollbar-hide"
                @wheel="onWheel"
                @dragover="onScrollRefDragOver"
                @dragleave="onScrollRefDragLeave"
                @drop="onScrollRefDrop"
            >
                <template v-for="(tab, index) in displayTabs" :key="tab.id">
                    <!-- 预先占位指示背景（在当前标签前插入） -->
                    <div
                        v-if="placeholderGap === index"
                        class="relative flex h-full flex-shrink-0 items-center gap-1.5 border-r border-dashed border-zx-primary/40 bg-zx-primary/10 pl-2.5 pr-2.5 text-xs select-none transition-all duration-150"
                        @dragover.prevent
                        @drop.prevent="onDropAtGap(index)"
                    >
                        <component
                            v-if="currentDraggingTab"
                            :is="getWorkbenchTabIcon(currentDraggingTab).icon"
                            class="h-3.5 w-3.5 flex-shrink-0 opacity-50 text-zx-primary"
                            :class="getWorkbenchTabIcon(currentDraggingTab).class"
                        />
                        <span
                            v-if="currentDraggingTab"
                            class="max-w-[120px] truncate text-[11px] font-medium opacity-60 text-zx-primary"
                        >
                            {{ currentDraggingTab.name }}
                        </span>
                    </div>

                    <!-- 标签项 -->
                    <div
                        draggable="true"
                        class="no-tile-glow group relative flex h-full flex-shrink-0 cursor-pointer items-center gap-1.5 border-r border-slate-200 pl-2.5 pr-1.5 text-xs transition-colors"
                        :class="[
                            currentActiveTabId === tab.id
                                ? 'bg-white font-medium text-zx-primary'
                                : 'text-zx-text-muted hover:bg-slate-100 hover:text-zx-text-strong',
                            draggedIndex === index ? 'opacity-35' : '',
                        ]"
                        :title="tab.path"
                        @click="wb.activate(tab.id, group)"
                        @auxclick.middle.prevent="wb.closeTab(tab.id)"
                        @dragstart="onDragStart($event, index)"
                        @dragover="onDragOver($event, index)"
                        @drop="onDrop($event, index)"
                        @dragend="onDragEnd"
                    >
                        <!-- 顶部色条：主色 / 表 / SQL / dirty 均由主题变量推导 -->
                        <div
                            v-if="currentActiveTabId === tab.id || tab.isDirty"
                            class="absolute inset-x-0 top-0 h-0.5"
                            :class="
                                tab.isDirty
                                    ? 'bg-zx-dirty'
                                    : isTableTab(tab)
                                      ? 'bg-zx-tab-table'
                                      : isSqlTab(tab)
                                        ? 'bg-zx-tab-sql'
                                        : 'bg-zx-primary'
                            "
                        />
                        <template v-if="isTableTab(tab)">
                            <component
                                :is="getWorkbenchTabIcon(tab).icon"
                                class="h-3.5 w-3.5 flex-shrink-0"
                            />
                            <span
                                class="max-w-[160px] truncate text-xs"
                                :class="[
                                    tab.isPreview ? 'italic' : '',
                                    tab.missing ? 'font-medium text-zx-danger' : '',
                                ]"
                                :title="tab.missing ? '表不存在或无法打开' : tab.path"
                            >
                                <span
                                    :class="
                                        tab.missing
                                            ? 'text-zx-danger'
                                            : currentActiveTabId === tab.id
                                              ? 'text-zx-tab-table/80'
                                              : 'text-zx-text-subtle'
                                    "
                                    >表</span
                                >
                                {{ tab.name }}
                            </span>
                        </template>
                        <template v-else-if="isSqlTab(tab)">
                            <component
                                :is="getWorkbenchTabIcon(tab).icon"
                                class="h-4 w-4 flex-shrink-0 object-contain"
                            />
                            <span
                                class="max-w-[160px] truncate text-xs"
                                :class="[
                                    tab.isPreview ? 'italic' : '',
                                    tab.missing ? 'font-medium text-zx-danger' : '',
                                ]"
                                :title="tab.missing ? 'SQL 源文件已不存在' : tab.path"
                            >
                                <span
                                    :class="
                                        tab.missing
                                            ? 'text-zx-danger'
                                            : currentActiveTabId === tab.id
                                              ? 'text-zx-tab-sql/80'
                                              : 'text-zx-text-subtle'
                                    "
                                    >SQL</span
                                >
                                {{ tab.name }}
                            </span>
                        </template>
                        <template v-else>
                            <component
                                :is="getWorkbenchTabIcon(tab).icon"
                                class="h-3.5 w-3.5 flex-shrink-0"
                                :class="getWorkbenchTabIcon(tab).class"
                            />
                            <span
                                class="max-w-[160px] truncate"
                                :class="[
                                    tab.isPreview && !tab.missing ? 'italic' : '',
                                    tab.missing ? 'font-medium text-zx-danger' : '',
                                ]"
                                :title="tab.missing ? '源文件已不存在或无法打开' : tab.path"
                                >{{ tab.name }}</span
                            >
                        </template>
                        <!-- 固定宽槽位：dirty 圆点与关闭钮互换，悬停不改宽度 -->
                        <span
                            class="relative flex h-4 w-4 flex-shrink-0 items-center justify-center"
                        >
                            <span
                                v-if="tab.isDirty"
                                class="absolute inset-0 flex items-center justify-center transition-opacity group-hover:opacity-0"
                                title="未保存"
                            >
                                <span
                                    class="h-2 w-2 rounded-full bg-current text-zx-text-muted"
                                ></span>
                            </span>
                            <button
                                class="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full text-zx-text-subtle transition-opacity hover:bg-slate-200 hover:text-zx-text"
                                :class="
                                    currentActiveTabId === tab.id
                                        ? 'opacity-100'
                                        : 'opacity-0 group-hover:opacity-100'
                                "
                                :title="
                                    tab.isDirty
                                        ? '关闭（有未保存修改）'
                                        : '关闭标签页'
                                "
                                type="button"
                                @click.stop="wb.closeTab(tab.id)"
                            >
                                <X class="h-3 w-3" />
                            </button>
                        </span>
                    </div>
                </template>

                <!-- 预先占位指示背景（在末尾插入） -->
                <div
                    v-if="placeholderGap === displayTabs.length"
                    class="relative flex h-full flex-shrink-0 items-center gap-1.5 border-r border-dashed border-zx-primary/40 bg-zx-primary/10 pl-2.5 pr-2.5 text-xs select-none transition-all duration-150"
                    @dragover.prevent
                    @drop.prevent="onDropAtGap(displayTabs.length)"
                >
                    <component
                        v-if="currentDraggingTab"
                        :is="getWorkbenchTabIcon(currentDraggingTab).icon"
                        class="h-3.5 w-3.5 flex-shrink-0 opacity-50 text-zx-primary"
                        :class="getWorkbenchTabIcon(currentDraggingTab).class"
                    />
                    <span
                        v-if="currentDraggingTab"
                        class="max-w-[120px] truncate text-[11px] font-medium opacity-60 text-zx-primary"
                    >
                        {{ currentDraggingTab.name }}
                    </span>
                </div>
            </div>

            <!-- 右侧专用区：模式切换（MD 或 图片） + 更多操作 -->
            <div
                class="flex flex-shrink-0 items-center gap-1.5  px-1.5"
            >
                <!-- Markdown 模式切换（仅编辑 / 编辑与预览 / 仅预览） -->
                <div
                    v-if="isMarkdownText"
                    class="flex items-center rounded-md border border-slate-200 bg-slate-200/50 p-0.5 text-xs"
                >
                    <button
                        type="button"
                        class="flex h-5 w-5 items-center justify-center rounded transition-colors cursor-pointer"
                        :class="
                            mdMode === 'edit'
                                ? 'bg-white font-medium text-zx-primary shadow-xs'
                                : 'text-zx-text-muted hover:text-zx-text'
                        "
                        title="仅编辑"
                        @click="emit('update:mdMode', 'edit')"
                    >
                        <PenLine class="h-3 w-3" />
                    </button>
                    <button
                        type="button"
                        class="flex h-5 w-5 items-center justify-center rounded transition-colors cursor-pointer"
                        :class="
                            mdMode === 'split'
                                ? 'bg-white font-medium text-zx-primary shadow-xs'
                                : 'text-zx-text-muted hover:text-zx-text'
                        "
                        title="编辑与预览 (双栏分屏)"
                        @click="emit('update:mdMode', 'split')"
                    >
                        <SquareSplitHorizontal class="h-3 w-3" />
                    </button>
                    <button
                        type="button"
                        class="flex h-5 w-5 items-center justify-center rounded transition-colors cursor-pointer"
                        :class="
                            mdMode === 'preview'
                                ? 'bg-white font-medium text-zx-primary shadow-xs'
                                : 'text-zx-text-muted hover:text-zx-text'
                        "
                        title="仅预览"
                        @click="emit('update:mdMode', 'preview')"
                    >
                        <Eye class="h-3 w-3" />
                    </button>
                </div>

                <!-- 图片三段式模式切换（图片预览 / 文本视图 / 十六进制视图） -->
                <div
                    v-else-if="activeTab && activeTab.kind === 'image'"
                    class="flex items-center rounded-md border border-slate-200 bg-slate-200/50 p-0.5 text-xs"
                >
                    <button
                        type="button"
                        class="flex h-5 w-5 items-center justify-center rounded transition-colors cursor-pointer"
                        :class="
                            activeTab.viewMode === 'image'
                                ? 'bg-white font-medium text-zx-primary shadow-xs'
                                : 'text-zx-text-muted hover:text-zx-text'
                        "
                        title="图片预览"
                        @click="wb.setViewMode(activeTab, 'image')"
                    >
                        <ImageIcon class="h-3 w-3" />
                    </button>
                    <button
                        type="button"
                        class="flex h-5 w-5 items-center justify-center rounded transition-colors cursor-pointer"
                        :class="
                            activeTab.viewMode === 'text'
                                ? 'bg-white font-medium text-zx-primary shadow-xs'
                                : 'text-zx-text-muted hover:text-zx-text'
                        "
                        title="文本视图"
                        @click="wb.setViewMode(activeTab, 'text')"
                    >
                        <FileText class="h-3 w-3" />
                    </button>
                    <button
                        type="button"
                        class="flex h-5 w-5 items-center justify-center rounded transition-colors cursor-pointer"
                        :class="
                            activeTab.viewMode === 'hex'
                                ? 'bg-white font-medium text-zx-primary shadow-xs'
                                : 'text-zx-text-muted hover:text-zx-text'
                        "
                        title="十六进制视图"
                        @click="wb.setViewMode(activeTab, 'hex')"
                    >
                        <Binary class="h-3 w-3" />
                    </button>
                </div>

                <ZXSelect
                    :model-value="'__none'"
                    placeholder="更多操作"
                    :options="moreMenu"
                    compact
                    trigger-class="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-zx-text-muted transition-colors hover:bg-zx-primary-soft hover:text-zx-primary"
                    @update:model-value="onMore"
                >
                    <template #trigger>
                        <Ellipsis class="h-3.5 w-3.5" />
                    </template>
                </ZXSelect>
            </div>
        </div>

        <!-- 自绘横向滚动条（仅溢出时显示） -->
        <div
            v-if="thumb.visible"
            class="h-[5px] flex-shrink-0 px-1 pb-[2px]"
            @mousedown="onTrackDown"
        >
            <div
                class="h-full cursor-pointer rounded-full bg-slate-300/80 transition-colors hover:bg-slate-400/80"
                :style="{
                    width: `${thumb.width}%`,
                    marginLeft: `${thumb.left}%`,
                }"
                @pointerdown="onThumbDown"
                @pointermove="onThumbMove"
                @pointerup="onThumbUp"
                @pointercancel="onThumbUp"
            ></div>
        </div>
    </div>
</template>
