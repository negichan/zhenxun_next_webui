<script setup lang="ts">
/**
 * 编辑器窗格组件（EditorPane）：
 * 单个编辑器组（Editor Group）的完整容器：
 * - 顶部标签栏（EditorTabBar）
 * - 右上角悬浮动作（EditorActions）
 * - 内容区：Monaco / Markdown 分屏 / 图片 / Hex / 压缩包 / 空态
 * 支持多组并排复用（VSCode 列式布局）。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { FileCode2, Loader2 } from "lucide-vue-next";
import MarkdownPreview from "@/components/ZXTextEditor/MarkdownPreview.vue";
import ArchiveBrowser from "@/components/zxcomponent/ArchiveBrowser.vue";
import EditorTabBar, { type MarkdownViewMode } from "./EditorTabBar.vue";
import EditorActions from "./EditorActions.vue";
import HexView from "./HexView.vue";
import TableEditorView from "./db/TableEditorView.vue";
import { imageDataUrl } from "../useWorkbench";
import type { Workbench } from "../useWorkbench";
import {
    clearDraggingTab,
    currentDraggingGroup,
    currentDraggingTab,
} from "../types";
import type { EditorGroupId } from "../types";

const props = withDefaults(
    defineProps<{
        wb: Workbench;
        group: EditorGroupId;
        isMobile?: boolean;
    }>(),
    {
        isMobile: false,
    },
);

const contentAreaRef = ref<HTMLElement | null>(null);
const editorHostRef = ref<HTMLElement | null>(null);
const editorSplitRef = ref<HTMLElement | null>(null);

type PaneDropZone = "left" | "right" | "top" | "bottom" | "center" | null;
const paneDropZone = ref<PaneDropZone>(null);

watch(currentDraggingTab, (tab) => {
    if (!tab) paneDropZone.value = null;
});

const onContentDragOver = (e: DragEvent) => {
    if (
        !currentDraggingTab.value ||
        !contentAreaRef.value ||
        props.wb.tabs.value.length <= 1
    ) {
        paneDropZone.value = null;
        return;
    }

    e.preventDefault();
    if (e.dataTransfer) {
        e.dataTransfer.dropEffect = "move";
    }

    const rect = contentAreaRef.value.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const relX = (e.clientX - rect.left) / rect.width;
    const relY = (e.clientY - rect.top) / rect.height;

    const THRESHOLD = 1 / 6;
    const distLeft = relX;
    const distRight = 1 - relX;
    const distTop = relY;
    const distBottom = 1 - relY;
    const minDist = Math.min(distLeft, distRight, distTop, distBottom);

    if (minDist < THRESHOLD) {
        if (minDist === distLeft) {
            paneDropZone.value = "left";
        } else if (minDist === distRight) {
            paneDropZone.value = "right";
        } else if (minDist === distTop) {
            paneDropZone.value = "top";
        } else {
            paneDropZone.value = "bottom";
        }
    } else {
        paneDropZone.value = "center";
    }
};

const onContentDragLeave = (e: DragEvent) => {
    if (!contentAreaRef.value) return;
    const related = e.relatedTarget as Node | null;
    if (!related || !contentAreaRef.value.contains(related)) {
        paneDropZone.value = null;
    }
};

const onContentDrop = (e: DragEvent) => {
    e.preventDefault();
    const zone = paneDropZone.value;
    paneDropZone.value = null;
    const tab = currentDraggingTab.value;
    const fromGroup = currentDraggingGroup.value;
    clearDraggingTab();

    if (!tab || props.wb.tabs.value.length <= 1 || !zone) return;

    if (zone === "center") {
        if (fromGroup !== props.group) {
            props.wb.moveTabToGroup(tab.id, props.group);
        }
        props.wb.activate(tab.id, props.group);
        return;
    }

    if (zone === "right") {
        props.wb.splitTabToRight(tab.id);
    } else if (zone === "left") {
        props.wb.splitTabToLeft(tab.id);
    } else if (zone === "bottom") {
        props.wb.splitTabToBottom(tab.id);
    } else if (zone === "top") {
        props.wb.splitTabToTop(tab.id);
    }
};

const activeTab = computed(() => props.wb.activeTabInGroup(props.group));

/** 表编辑器顶栏「SQL」：通知外层打开右侧 SQL 控制台 */
const emit = defineEmits<{ openSqlConsole: [] }>();

const onOpenSqlConsole = () => {
    emit("openSqlConsole");
};

const isDbTab = computed(() => {
    const t = activeTab.value;
    return t?.kind === "table" || t?.viewMode === "table";
});

/** 侧栏双击列 → 当前表编辑器要定位的列 */
const tableFocusColumn = computed(() => {
    const f = props.wb.tableFocusColumn.value;
    if (!f) return undefined;
    const t = activeTab.value;
    if (!t) return undefined;
    const name =
        t.tableName ||
        t.name.replace(/^表\s*·\s*/, "") ||
        t.path.replace(/^db:\/\/table\//, "");
    return f.table === name ? f.column : undefined;
});

const needsMonaco = computed(() => {
    const t = activeTab.value;
    // SQL 标签：kind=sql 但走 Monaco 文本
    return !!t && t.viewMode === "text";
});

// ==================== Markdown 预览与分屏 ====================
const mdMode = ref<MarkdownViewMode>("edit");
const previewRatio = ref(
    Math.max(20, Math.min(80, Number(localStorage.getItem(`zx-editor-preview-ratio-${props.group}`)) || 50)),
);
const isDraggingPreview = ref(false);
let cleanupPreviewDrag: (() => void) | null = null;

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

watch(mdMode, () => {
    nextTick(() => {
        props.wb.layoutAll();
    });
});

const resetPreviewRatio = () => {
    previewRatio.value = 50;
    localStorage.setItem(`zx-editor-preview-ratio-${props.group}`, "50");
    nextTick(() => {
        props.wb.layoutAll();
    });
};

const startDragPreview = (e: PointerEvent) => {
    if (!editorSplitRef.value) return;
    isDraggingPreview.value = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const startX = e.clientX;
    const containerW = editorSplitRef.value.clientWidth || 800;
    const startR = previewRatio.value;
    let rafId: number | null = null;

    const onPointerMove = (moveEvent: PointerEvent) => {
        const delta = moveEvent.clientX - startX;
        const deltaRatio = (delta / containerW) * 100;
        const newRatio = startR - deltaRatio;
        previewRatio.value = Math.max(20, Math.min(80, Math.round(newRatio * 10) / 10));

        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
            props.wb.layoutAll();
        });
    };

    const onPointerUp = () => {
        isDraggingPreview.value = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerUp);
        cleanupPreviewDrag = null;
        if (rafId) cancelAnimationFrame(rafId);
        localStorage.setItem(`zx-editor-preview-ratio-${props.group}`, String(previewRatio.value));
        nextTick(() => {
            props.wb.layoutAll();
        });
    };

    cleanupPreviewDrag = onPointerUp;
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
};

onMounted(() => {
    if (!editorHostRef.value) return;
    if (props.group === "g0" && !props.wb.isMonacoReady.value) {
        void props.wb.init(editorHostRef.value);
    } else {
        props.wb.initGroupEditor(props.group, editorHostRef.value);
    }
});

onBeforeUnmount(() => {
    cleanupPreviewDrag?.();
    if (props.group !== "g0") {
        props.wb.disposeGroupEditor(props.group);
    }
});

const onPaneFocus = () => {
    props.wb.activeGroupId.value = props.group;
};
</script>

<template>
    <div
        class="flex min-w-0 min-h-0 flex-1 flex-col overflow-hidden bg-white"
        @pointerdown="onPaneFocus"
    >
        <EditorTabBar
            :wb="wb"
            :group="group"
            :md-mode="mdMode"
            @update:md-mode="mdMode = $event"
        />

        <div
            ref="contentAreaRef"
            class="relative min-h-0 flex-1 overflow-hidden"
            @dragover="onContentDragOver"
            @dragleave="onContentDragLeave"
            @drop="onContentDrop"
        >
            <!-- 拖拽放置指示 -->
            <div
                v-if="paneDropZone"
                class="pointer-events-none absolute z-30 bg-zx-primary/20"
                :class="[
                    paneDropZone === 'left' ? 'left-0 top-0 bottom-0 w-1/2' : '',
                    paneDropZone === 'right' ? 'right-0 top-0 bottom-0 w-1/2' : '',
                    paneDropZone === 'top' ? 'left-0 right-0 top-0 h-1/2' : '',
                    paneDropZone === 'bottom' ? 'left-0 right-0 bottom-0 h-1/2' : '',
                    paneDropZone === 'center' ? 'inset-0 w-full h-full' : '',
                ]"
            ></div>

            <EditorActions :wb="wb" />

            <!-- 文本视图主区域 -->
            <div
                v-show="activeTab?.viewMode === 'text'"
                ref="editorSplitRef"
                class="absolute inset-0 flex overflow-hidden"
            >
                <div
                    v-show="!isMarkdownText || mdMode !== 'preview'"
                    class="relative h-full overflow-hidden"
                    :style="
                        isMarkdownText && mdMode === 'split'
                            ? { width: `${100 - previewRatio}%` }
                            : { width: '100%' }
                    "
                >
                    <div
                        ref="editorHostRef"
                        class="h-full w-full"
                        @dragover.prevent
                        @drop.prevent
                    ></div>
                </div>

                <div
                    v-if="isMarkdownText && mdMode === 'split'"
                    class="group relative z-20 w-1 -ml-0.5 flex-shrink-0 cursor-col-resize select-none bg-slate-200"
                    title="拖拽调节预览栏宽度，双击居中"
                    @pointerdown.prevent="startDragPreview"
                    @dblclick="resetPreviewRatio"
                >
                    <div class="absolute inset-y-0 -left-1.5 -right-1.5 cursor-col-resize"></div>
                </div>

                <div
                    v-if="isMarkdownText && mdMode !== 'edit'"
                    class="h-full overflow-y-auto bg-white"
                    :style="
                        mdMode === 'split'
                            ? { width: `${previewRatio}%` }
                            : { width: '100%' }
                    "
                >
                    <MarkdownPreview
                        v-if="activeTab"
                        :content="wb.contentText.value"
                        :path="activeTab.path"
                    />
                </div>
            </div>

            <!-- 数据表：文件编辑器内嵌表编辑器（与底部状态栏表语境配套） -->
            <TableEditorView
                v-if="
                    activeTab &&
                    (activeTab.kind === 'table' ||
                        activeTab.viewMode === 'table')
                "
                :key="`table:${activeTab.id}`"
                :table-name="
                    activeTab.tableName ||
                    activeTab.name.replace(/^表\s*·\s*/, '') ||
                    activeTab.path.replace(/^db:\/\/table\//, '')
                "
                :focus-column="tableFocusColumn"
                class="absolute inset-0"
                @open-sql-console="onOpenSqlConsole"
            />

            <!-- 压缩包浏览 -->
            <ArchiveBrowser
                v-if="activeTab?.viewMode === 'archive'"
                :key="activeTab.path"
                :archive-path="activeTab.path"
                :archive-name="activeTab.name"
                :layout="isMobile ? 'dialog' : 'panel'"
                class="absolute inset-0"
            />

            <!-- 图片预览 -->
            <div
                v-if="activeTab?.viewMode === 'image'"
                class="absolute inset-0 flex items-center justify-center overflow-auto bg-slate-100/60 p-6"
            >
                <img
                    v-if="activeTab.bytesB64"
                    :src="imageDataUrl(activeTab)"
                    :alt="activeTab.name"
                    class="max-h-full max-w-full rounded-lg shadow-md"
                />
            </div>

            <!-- Hex 视图 -->
            <HexView
                v-else-if="activeTab?.viewMode === 'hex' && activeTab.bytesB64"
                :bytes-b64="activeTab.bytesB64"
                class="absolute inset-0"
            />

            <!-- 空态 -->
            <div
                v-if="!activeTab"
                class="absolute inset-0 flex flex-col items-center justify-center gap-3"
            >
                <FileCode2 class="h-20 w-20 text-zx-text-subtle" />
                <p class="text-sm text-zx-text-subtle">没有打开的文件</p>
            </div>

            <!-- 加载遮罩 -->
            <div
                v-if="!!activeTab && (activeTab.isLoading || activeTab.bytesLoading || (needsMonaco && !wb.isMonacoReady.value))"
                class="absolute inset-0 z-10 flex items-center justify-center bg-white/70"
            >
                <Loader2 class="h-8 w-8 animate-spin text-zx-primary" />
            </div>
        </div>
    </div>
</template>
