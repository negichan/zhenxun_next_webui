<script setup lang="ts">
/**
 * 右侧栏 — Tab 结构（当前仅 SQL）
 * - 左缘拖拽调宽 / 双击重置（手柄样式与左侧栏一致）
 * - 打开后默认显示「SQL」Tab
 * 控制台本体由 RightSqlConsole 填满
 */
import { onBeforeUnmount, ref, watch } from "vue";
import { X } from "lucide-vue-next";
import { startPointerDrag } from "../pointerDrag";
import RightSqlConsole from "./db/RightSqlConsole.vue";

type PanelTab = "sql";

const props = defineProps<{
    open: boolean;
    /** SQL 控制台预填表名 */
    tableName?: string;
}>();

const emit = defineEmits<{
    close: [];
    resized: [];
}>();

const WIDTH_KEY = "zx-editor-right-panel-width";
const MIN_W = 260;
const DEFAULT_W = 420;

const panelRef = ref<HTMLElement | null>(null);
const width = ref(
    Math.max(MIN_W, Number(localStorage.getItem(WIDTH_KEY)) || DEFAULT_W),
);
let cleanupWidthDrag: (() => void) | null = null;

/** 目前只有 SQL 一个 Tab */
const tabs: { id: PanelTab; label: string }[] = [
    { id: "sql", label: "SQL" },
];

const activeTab = ref<PanelTab>("sql");

watch(
    () => props.open,
    (open) => {
        if (open) activeTab.value = "sql";
    },
    { immediate: true },
);

const clampWidth = (w: number) => {
    const parentW = panelRef.value?.parentElement?.clientWidth ?? 1200;
    const maxW = Math.max(
        MIN_W + 40,
        Math.min(720, Math.floor(parentW * 0.55)),
    );
    return Math.max(MIN_W, Math.min(maxW, Math.round(w)));
};

const resetWidth = () => {
    width.value = DEFAULT_W;
    localStorage.setItem(WIDTH_KEY, String(DEFAULT_W));
    requestAnimationFrame(() => emit("resized"));
};

/** 向左拖变宽（手柄样式与左侧栏一致） */
const startDragWidth = (e: PointerEvent) => {
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const startX = e.clientX;
    const startW = width.value;
    let rafId: number | null = null;

    const finish = () => {
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        cleanupWidthDrag = null;
        if (rafId) cancelAnimationFrame(rafId);
        localStorage.setItem(WIDTH_KEY, String(width.value));
        emit("resized");
    };
    cleanupWidthDrag = finish;

    startPointerDrag(e, {
        onMove: (moveEvent) => {
            const delta = startX - moveEvent.clientX;
            const next = clampWidth(startW + delta);
            if (rafId) cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => {
                width.value = next;
            });
        },
        onUp: () => finish(),
    });
};

onBeforeUnmount(() => {
    cleanupWidthDrag?.();
});
</script>

<template>
    <div
        v-if="open"
        ref="panelRef"
        class="relative flex h-full min-h-0 flex-shrink-0 flex-col overflow-hidden border-l border-slate-200 bg-white"
        :style="{ width: `${width}px` }"
    >
        <!-- 与左侧栏同一套拖拽手柄：透明命中区，无额外高亮 -->
        <div
            class="absolute inset-y-0 left-0 z-20 w-1 -ml-0.5 cursor-col-resize touch-none select-none bg-transparent"
            title="拖拽调节右侧栏宽度，双击重置"
            @pointerdown.prevent="startDragWidth"
            @dblclick="resetWidth"
        >
            <div class="absolute inset-y-0 -left-2 -right-2 cursor-col-resize"></div>
        </div>

        <!-- 标签栏：与底部面板同一套 -->
        <div
            class="flex h-8 flex-shrink-0 items-stretch border-b border-slate-200 bg-white select-none"
        >
            <div class="flex min-w-0 flex-1 items-stretch overflow-x-auto">
                <button
                    v-for="t in tabs"
                    :key="t.id"
                    type="button"
                    class="btn-touch relative flex items-center px-3 text-[11px] font-semibold tracking-wide transition-colors"
                    :class="
                        activeTab === t.id
                            ? 'bg-white text-zx-primary'
                            : 'text-zx-text-muted hover:text-zx-text'
                    "
                    @click="activeTab = t.id"
                >
                    {{ t.label }}
                    <span
                        v-if="activeTab === t.id"
                        class="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-zx-primary"
                    />
                </button>
            </div>
            <div class="flex items-center gap-0.5 pr-1">
                <button
                    type="button"
                    class="btn-touch flex h-6 w-6 cursor-pointer items-center justify-center rounded text-zx-text-subtle transition-colors hover:bg-slate-100 hover:text-zx-text"
                    title="关闭面板"
                    @click="emit('close')"
                >
                    <X class="h-3.5 w-3.5" />
                </button>
            </div>
        </div>

        <!-- 内容：当前仅 SQL -->
        <div v-if="activeTab === 'sql'" class="min-h-0 flex-1 overflow-hidden">
            <RightSqlConsole
                :table-name="tableName"
                embedded
                @resized="emit('resized')"
            />
        </div>
        <div v-else class="min-h-0 flex-1 overflow-hidden"></div>
    </div>
</template>
