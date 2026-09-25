<script setup lang="ts">
/**
 * 底部面板 — VSCode 终端位：
 * 在「左侧栏右边」这一列的编辑器下方（侧栏通高，不被面板切断）
 * 顶部拖拽调高（鼠标/触控） · 标签栏 · 最大化/关闭
 * 默认标签为「输出」；mode=sql 时定位到 SQL 结果
 */
import { ref, watch } from "vue";
import { ChevronDown, ChevronUp, X } from "lucide-vue-next";
import SqlResultsPanel from "./db/SqlResultsPanel.vue";
import { startPointerDrag } from "../pointerDrag";
import type { Workbench } from "../useWorkbench";

type PanelTab = "output" | "sql";

const props = withDefaults(
    defineProps<{
        open: boolean;
        mode?: PanelTab | "empty";
        wb?: Workbench;
    }>(),
    { mode: "output" },
);

const emit = defineEmits<{ close: [] }>();

/** 输出在前，默认选中输出 */
const tabs: { id: PanelTab; label: string }[] = [
    { id: "output", label: "输出" },
    { id: "sql", label: "SQL" },
];

const activeTab = ref<PanelTab>("output");
const height = ref(220);
const maximized = ref(false);
const lastHeight = ref(220);

const selectTab = (id: PanelTab) => {
    activeTab.value = id;
};

watch(
    () => props.mode,
    (m) => {
        if (!props.open) return;
        activeTab.value = m === "sql" ? "sql" : "output";
    },
    { immediate: true },
);

const toggleMaximize = () => {
    if (maximized.value) {
        height.value = lastHeight.value;
        maximized.value = false;
    } else {
        lastHeight.value = height.value;
        height.value = Math.min(480, Math.round(window.innerHeight * 0.45));
        maximized.value = true;
    }
};

const onDragStart = (e: PointerEvent) => {
    const startY = e.clientY;
    const startH = height.value;
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
    maximized.value = false;
    startPointerDrag(e, {
        onMove: (ev) => {
            height.value = Math.max(
                100,
                Math.min(640, startH + (startY - ev.clientY)),
            );
            lastHeight.value = height.value;
        },
        onUp: () => {
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
        },
    });
};
</script>

<template>
    <div
        v-if="open"
        class="relative flex flex-col overflow-hidden border-t border-slate-200 bg-white"
        :style="{ height: height + 'px' }"
    >
        <!-- 顶部拖拽条（触控热区加大） -->
        <div
            class="absolute inset-x-0 top-0 z-20 h-2 cursor-row-resize touch-none"
            title="拖拽调节面板高度"
            @pointerdown.prevent="onDragStart"
        >
            <div
                class="absolute inset-x-0 -top-1 h-4 cursor-row-resize"
            />
        </div>

        <!-- 标签栏 -->
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
                    @click="selectTab(t.id)"
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
                    :title="maximized ? '还原高度' : '最大化'"
                    @click="toggleMaximize"
                >
                    <ChevronDown v-if="maximized" class="h-3.5 w-3.5" />
                    <ChevronUp v-else class="h-3.5 w-3.5" />
                </button>
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

        <!-- 内容 -->
        <div class="min-h-0 flex-1 overflow-hidden">
            <SqlResultsPanel
                v-if="activeTab === 'sql' && wb"
                :wb="wb"
                class="h-full"
            />
            <ZxEmptyState
                v-else
                text="暂无输出"
                size="sm"
                class="h-full justify-center"
            />
        </div>
    </div>
</template>
