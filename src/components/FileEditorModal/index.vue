<script setup lang="ts">
/**
 * VSCode 式文件编辑工作台（窗口弹窗，可全屏）。
 * 布局：活动栏 / 侧边栏（文件树·搜索）/ 标签栏 + monaco 编辑区 / 底部状态栏。
 * 编辑内核为 monaco 多 model（见 useWorkbench），Ctrl+S 在此统一接管避免双触发。
 */
import {
    computed,
    h,
    nextTick,
    onBeforeUnmount,
    onMounted,
    reactive,
    ref,
    watch,
} from "vue";
import {
    ArrowDown,
    ArrowLeft,
    ArrowRight,
    ArrowUp,
    Braces,
    ChevronsDownUp,
    ChevronsUpDown,
    Clipboard,
    Code,
    Copy,
    Database,
    Eye,
    FileCode2,
    FilePlus2,
    FileSearch,
    FolderPlus,
    Hash,
    Keyboard,
    Layers,
    List,
    ListChecks,
    ListPlus,
    Loader2,
    Map,
    Maximize,
    Minimize,
    Minus,
    Paintbrush,
    PanelLeft,
    PanelRight,
    Pencil,
    Redo2,
    RefreshCw,
    Replace,
    RotateCcw,
    Save,
    SaveAll,
    Scissors,
    Search,
    SlidersHorizontal,
    SquareSplitHorizontal,
    SquareSplitVertical,
    TextCursorInput,
    Trash2,
    Type,
    Undo2,
    X,
    ZoomIn,
    ZoomOut,
} from "lucide-vue-next";
import { modalJelly } from "@/composables/useGsapTransition";
import { gsap } from "gsap";
import { animationsEnabled, useGlobalStore } from "@/store/global";
import { ZXMessageBox } from "@/services/ui";
import EditorActivityBar from "./components/EditorActivityBar.vue";
import EditorSidebar from "./components/EditorSidebar.vue";
import EditorPane from "./components/EditorPane.vue";
import EditorStatusBar from "./components/EditorStatusBar.vue";
import EditorRightPanel from "./components/EditorRightPanel.vue";
import { useWorkbench } from "./useWorkbench";
import { getFileIcon } from "./fileIcons";
import { startPointerDrag } from "./pointerDrag";
import { ZXDropdownMenu } from "@/components/zxcomponent/ZXDropdownMenu";
import type { ZXDropdownMenuOption as ZXDropdownOption } from "@/components/zxcomponent/ZXDropdownMenu";
import type { SidebarPanel } from "./types";
import ZxButton from "components/zxcomponent/ZxButton.vue";

const globalStore = useGlobalStore();
/** 移动端：侧栏变浮层覆盖编辑区且默认收起（窄屏挤压会把编辑区压瘪） */
const isMobile = computed(() => globalStore.isMobileMode);

interface Props {
    initialFile?: { path: string; name: string } | null;
    /** 打开时侧栏面板；database = 直接进数据库面板 */
    initialPanel?: SidebarPanel | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{ close: [] }>();

const wb = useWorkbench();

// ==================== 快速打开（Ctrl+P，转到菜单） ====================
const quickOpen = reactive({ open: false, query: "" });
const quickOpenIndex = ref(0);
const quickOpenInputRef = ref<HTMLInputElement | null>(null);
const quickOpenResults = computed(() => {
    const q = quickOpen.query.trim().toLowerCase();
    const list = wb.quickOpenFiles.value;
    if (!q) return list.slice(0, 50);
    const starts: typeof list = [];
    const contains: typeof list = [];
    for (const f of list) {
        const name = f.name.toLowerCase();
        const path = f.path.toLowerCase();
        if (name.startsWith(q)) starts.push(f);
        else if (name.includes(q) || path.includes(q)) contains.push(f);
    }
    return [...starts, ...contains].slice(0, 50);
});
const toggleQuickOpen = async () => {
    quickOpen.open = !quickOpen.open;
    if (quickOpen.open) {
        quickOpen.query = "";
        quickOpenIndex.value = 0;
        void wb.refreshQuickOpen();
        await nextTick();
        quickOpenInputRef.value?.focus();
    }
};
const openQuickPick = (f: { path: string; name: string }) => {
    wb.openFile(f.path, f.name);
    quickOpen.open = false;
};
const moveQuickOpen = (delta: number) => {
    const len = quickOpenResults.value.length;
    if (!len) return;
    quickOpenIndex.value = (quickOpenIndex.value + delta + len) % len;
};
const applyQuickOpen = () => {
    const f = quickOpenResults.value[quickOpenIndex.value];
    if (f) openQuickPick(f);
};

/** 设置菜单：快捷键映射说明弹窗 */
const showKeymap = () => {
    const rows: Array<[string, string]> = [
        ["Ctrl+S / Ctrl+Alt+S", "保存 / 全部保存"],
        ["Ctrl+N / Ctrl+W", "新建文件 / 关闭当前标签"],
        ["Ctrl+B / F11 / Alt+Z", "侧边栏 / 全屏 / 自动换行"],
        ["Ctrl+P", "快速打开项目文件"],
        ["Ctrl+Shift+F", "在项目文件中查找"],
        ["Ctrl+G / Ctrl+Shift+O", "转到行 / 转到符号"],
        ["Ctrl+F / Ctrl+H", "查找 / 替换（编辑器聚焦时）"],
        ["Ctrl+/ / Shift+Alt+A", "行注释 / 块注释（编辑器聚焦时）"],
        ["Alt+↑↓ / Shift+Alt+↑↓", "移动行 / 复制行（编辑器聚焦时）"],
        ["Ctrl+D / Ctrl+Shift+L", "添加下一个匹配 / 全部匹配（编辑器聚焦时）"],
    ];
    ZXMessageBox({
        title: "键盘快捷键",
        type: "info",
        confirmButtonText: "知道了",
        slots: {
            default: () =>
                h(
                    "div",
                    { class: "mt-2 space-y-1.5 text-left text-xs" },
                    rows.map(([k, v]) =>
                        h("div", { class: "flex items-center justify-between gap-4" }, [
                            h(
                                "span",
                                {
                                    class:
                                        "rounded-md bg-gray-100 px-2 py-0.5 font-mono text-[11px] text-zx-text",
                                },
                                k,
                            ),
                            h("span", { class: "text-zx-text-muted" }, v),
                        ]),
                    ),
                ),
        },
    });
};

// 窗口 UI 状态
const isFullscreen = ref(false);
const minimized = ref(false);
/** Transition 挂载开关；关闭 = 播放离场动画后 emit close */
const visible = ref(true);
const isSidebarOpen = ref(!globalStore.isMobileMode);
const activePanel = ref<SidebarPanel>(
    props.initialPanel === "database" ? "database" : "explorer",
);
/** 右侧栏开关；SQL 控制台挂在右栏 Tab 内 */
const isRightPanelOpen = ref(false);
/** 面板开合或调宽后，主编辑区 monaco 需要重算布局 */
const onRightPanelLayout = () => {
    nextTick(() => {
        wb.layoutAll();
    });
};
watch(isRightPanelOpen, () => onRightPanelLayout());

/** 打开右侧栏（默认 SQL Tab）；关闭同栏则收起 */
const openRightSqlConsole = () => {
    isRightPanelOpen.value = true;
    onRightPanelLayout();
};

const toggleRightPanel = () => {
    isRightPanelOpen.value = !isRightPanelOpen.value;
    onRightPanelLayout();
};

const toggleLeftPanel = () => {
    isSidebarOpen.value = !isSidebarOpen.value;
    onRightPanelLayout();
};

const rightSqlTableName = computed(() => {
    const t = wb.activeTab.value;
    if (!t) return "";
    return (
        t.tableName ||
        t.name.replace(/^表\s*·\s*/, "") ||
        (t.path.startsWith("db://table/")
            ? t.path.replace(/^db:\/\/table\//, "")
            : "")
    );
});

const toggleFullscreen = () => {
    isFullscreen.value = !isFullscreen.value;
    nextTick(() => {
        wb.layoutAll();
    });
};

// ==================== 窗口拖拽平移与八向缩放 ====================
const getInitialWinRect = () => {
    if (typeof window === "undefined") {
        return { x: 40, y: 40, w: 1280, h: 860 };
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // 打开时贴视口约 78%×88%（4K 也按比例放大）；小屏最小尺寸不越过视口
    const w = Math.max(Math.min(680, vw), Math.round(vw * 0.78));
    const h = Math.max(Math.min(480, vh), Math.round(vh * 0.88));
    const x = Math.max(0, Math.round((vw - w) / 2));
    const y = Math.max(0, Math.round((vh - h) / 2));
    return { x, y, w, h };
};

const winRect = reactive(getInitialWinRect());

const clampWindowToViewport = () => {
    if (isFullscreen.value) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (winRect.w > vw) winRect.w = vw;
    if (winRect.h > vh) winRect.h = vh;
    const minX = -winRect.w + 100;
    const maxX = vw - 100;
    const minY = 0;
    const maxY = vh - 40;
    winRect.x = Math.max(minX, Math.min(maxX, winRect.x));
    winRect.y = Math.max(minY, Math.min(maxY, winRect.y));
};

// 窗口拖动平移（Header）
const isDraggingWindow = ref(false);
let cleanupWindowDrag: (() => void) | null = null;

const onHeaderMouseDown = (e: PointerEvent) => {
    if (isFullscreen.value) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest("button, .zx-dropdown, input, select, textarea, [role='button']")) {
        return;
    }

    isDraggingWindow.value = true;
    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const startWinX = winRect.x;
    const startWinY = winRect.y;

    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";

    cleanupWindowDrag = () => {
        isDraggingWindow.value = false;
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
        cleanupWindowDrag = null;
    };

    startPointerDrag(e, {
        onMove: (ev) => {
            const dx = ev.clientX - startMouseX;
            const dy = ev.clientY - startMouseY;
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const minX = -winRect.w + 120;
            const maxX = vw - 120;
            const minY = 0;
            const maxY = vh - 40;
            winRect.x = Math.max(minX, Math.min(maxX, startWinX + dx));
            winRect.y = Math.max(minY, Math.min(maxY, startWinY + dy));
        },
        onUp: () => {
            cleanupWindowDrag?.();
        },
    });
};

const onHeaderDblClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest("button, .zx-dropdown, input, select, textarea, [role='button']")) {
        return;
    }
    toggleFullscreen();
};

// 八向缩放手柄
type ResizeDir = "n" | "s" | "w" | "e" | "nw" | "ne" | "sw" | "se";
const isResizingWindow = ref(false);
let cleanupWindowResize: (() => void) | null = null;

const startResizeWindow = (e: PointerEvent, dir: ResizeDir) => {
    if (isFullscreen.value) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    isResizingWindow.value = true;

    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const { x: startX, y: startY, w: startW, h: startH } = winRect;

    const cursorMap: Record<ResizeDir, string> = {
        n: "ns-resize",
        s: "ns-resize",
        w: "ew-resize",
        e: "ew-resize",
        nw: "nwse-resize",
        se: "nwse-resize",
        ne: "nesw-resize",
        sw: "nesw-resize",
    };
    document.body.style.userSelect = "none";
    document.body.style.cursor = cursorMap[dir] || "default";

    const MIN_W = 580;
    const MIN_H = 380;
    let rafId: number | null = null;

    const finish = () => {
        isResizingWindow.value = false;
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
        cleanupWindowResize = null;
        if (rafId) cancelAnimationFrame(rafId);
        nextTick(() => {
            wb.monaco.value?.editor?.getEditors().forEach((ed) => ed.layout());
        });
    };
    cleanupWindowResize = finish;

    startPointerDrag(e, {
        onMove: (ev) => {
            const dx = ev.clientX - startMouseX;
            const dy = ev.clientY - startMouseY;
            const vw = window.innerWidth;
            const vh = window.innerHeight;

            if (dir.includes("e")) {
                const maxW = vw - startX;
                winRect.w = Math.max(MIN_W, Math.min(maxW, startW + dx));
            } else if (dir.includes("w")) {
                const maxDx = startW - MIN_W;
                const clampedDx = Math.min(maxDx, Math.max(-startX, dx));
                winRect.x = startX + clampedDx;
                winRect.w = startW - clampedDx;
            }

            if (dir.includes("s")) {
                const maxH = vh - startY;
                winRect.h = Math.max(MIN_H, Math.min(maxH, startH + dy));
            } else if (dir.includes("n")) {
                const maxDy = startH - MIN_H;
                const clampedDy = Math.min(maxDy, Math.max(-startY, dy));
                winRect.y = startY + clampedDy;
                winRect.h = startH - clampedDy;
            }

            if (rafId) cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => {
                wb.monaco.value?.editor?.getEditors().forEach((ed) => ed.layout());
            });
        },
        onUp: () => finish(),
    });
};

// ==================== 侧边栏宽度调节（VSCode 式拖拽） ====================
const workbenchBodyRef = ref<HTMLElement | null>(null);
const sidebarWidth = ref(
    Math.max(180, Math.min(600, Number(localStorage.getItem("zx-editor-sidebar-width")) || 256)),
);
const isDraggingSidebar = ref(false);
let cleanupSidebarDrag: (() => void) | null = null;

const resetSidebarWidth = () => {
    sidebarWidth.value = 256;
    localStorage.setItem("zx-editor-sidebar-width", "256");
    nextTick(() => {
        wb.layoutAll();
    });
};

const startDragSidebar = (e: PointerEvent) => {
    isDraggingSidebar.value = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const startX = e.clientX;
    const startW = sidebarWidth.value;
    let rafId: number | null = null;

    const finish = () => {
        isDraggingSidebar.value = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        cleanupSidebarDrag = null;
        if (rafId) cancelAnimationFrame(rafId);
        localStorage.setItem("zx-editor-sidebar-width", String(sidebarWidth.value));
        nextTick(() => {
            wb.layoutAll();
        });
    };
    cleanupSidebarDrag = finish;

    startPointerDrag(e, {
        onMove: (moveEvent) => {
            const delta = moveEvent.clientX - startX;
            const maxW = workbenchBodyRef.value
                ? Math.max(180, Math.min(600, workbenchBodyRef.value.clientWidth * 0.45))
                : 600;
            sidebarWidth.value = Math.max(180, Math.min(maxW, Math.round(startW + delta)));

            if (rafId) cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => {
                wb.layoutAll();
            });
        },
        onUp: () => finish(),
    });
};

// 侧边栏折叠展开（动态配合当前 sidebarWidth）
const onSidebarEnter = (el: Element, done: () => void) => {
    if (!animationsEnabled()) {
        done();
        return;
    }
    gsap.fromTo(
        el,
        { width: 0 },
        {
            width: sidebarWidth.value,
            duration: 0.15,
            ease: "power2.out",
            onComplete: () => {
                done();
                nextTick(() => {
                    wb.layoutAll();
                });
            },
        },
    );
};

const onSidebarLeave = (el: Element, done: () => void) => {
    if (!animationsEnabled()) {
        done();
        return;
    }
    gsap.to(el, {
        width: 0,
        duration: 0.15,
        ease: "power2.in",
        onComplete: () => {
            done();
            nextTick(() => {
                wb.layoutAll();
            });
        },
    });
};

// ==================== 编辑器组列宽 / 行高拖拽（VSCode 式） ====================
const editorContainerRef = ref<HTMLElement | null>(null);
/** 拖拽中直接改 DOM flex，避免响应式权重触发整树重渲染（图片分栏时尤其卡） */
const applyFlexStyle = (el: HTMLElement | null | undefined, w: number) => {
    if (!el) return;
    el.style.flex = `${w} 0 0%`;
};

const startColumnDragAt = (colIndex: number, e: PointerEvent) => {
    const root = editorContainerRef.value;
    if (!root) return;
    const n = wb.columnWeights.value.length;
    if (colIndex < 1 || colIndex >= n) return;

    const leftEl = root.querySelector<HTMLElement>(`[data-editor-col="${colIndex - 1}"]`);
    const rightEl = root.querySelector<HTMLElement>(`[data-editor-col="${colIndex}"]`);
    if (!leftEl || !rightEl) return;

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const containerW = root.clientWidth || 800;
    const startClientX = e.clientX;
    const wA = wb.columnWeights.value[colIndex - 1] ?? 1;
    const wB = wb.columnWeights.value[colIndex] ?? 1;
    const startSum = wA + wB;
    let nextA = wA;
    let nextB = wB;
    let rafId: number | null = null;

    const onMove = (ev: PointerEvent) => {
        const deltaPx = ev.clientX - startClientX;
        const deltaRatio = (deltaPx / containerW) * startSum;
        nextA = Math.max(0.08, Math.min(startSum - 0.08, wA + deltaRatio));
        nextB = startSum - nextA;
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
            applyFlexStyle(leftEl, nextA);
            applyFlexStyle(rightEl, nextB);
        });
    };

    const onUp = () => {
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        if (rafId) cancelAnimationFrame(rafId);
        const weights = [...wb.columnWeights.value];
        weights[colIndex - 1] = nextA;
        weights[colIndex] = nextB;
        wb.columnWeights.value = weights;
        nextTick(() => wb.layoutAll());
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
};

const startGroupRowDrag = (colIndex: number, rowIndex: number, e: PointerEvent) => {
    const root = editorContainerRef.value;
    const col = wb.layoutColumns.value[colIndex];
    if (!root || !col || rowIndex < 1 || rowIndex >= col.length) return;
    const upperId = col[rowIndex - 1];
    const lowerId = col[rowIndex];
    if (!upperId || !lowerId) return;

    const colEl = root.querySelector<HTMLElement>(`[data-editor-col="${colIndex}"]`);
    // EditorPane 根节点带 data-editor-pane
    const upperEl = colEl?.querySelector<HTMLElement>(`[data-editor-pane="${upperId}"]`);
    const lowerEl = colEl?.querySelector<HTMLElement>(`[data-editor-pane="${lowerId}"]`);

    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
    const containerH = root.clientHeight || 600;
    const startClientY = e.clientY;
    const wU = wb.groupWeights[upperId] ?? 1;
    const wL = wb.groupWeights[lowerId] ?? 1;
    const startSum = wU + wL;
    let nextU = wU;
    let nextL = wL;
    let rafId: number | null = null;

    const onMove = (ev: PointerEvent) => {
        const deltaPx = ev.clientY - startClientY;
        const deltaRatio = (deltaPx / containerH) * startSum;
        nextU = Math.max(0.08, Math.min(startSum - 0.08, wU + deltaRatio));
        nextL = startSum - nextU;
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
            applyFlexStyle(upperEl, nextU);
            applyFlexStyle(lowerEl, nextL);
        });
    };

    const onUp = () => {
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        if (rafId) cancelAnimationFrame(rafId);
        wb.groupWeights[upperId] = nextU;
        wb.groupWeights[lowerId] = nextL;
        nextTick(() => wb.layoutAll());
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
};

const sidebarRef = ref<InstanceType<typeof EditorSidebar> | null>(null);

const activeTab = computed(() => wb.activeTab.value);

/** 标题栏居中标题：文件名 — 所在目录（VSCode 风格） */
// ==================== 标题栏菜单栏（VSCode 式，仅文件编辑器相关能力） ====================
const textReady = computed(
    () =>
        !!activeTab.value &&
        wb.isMonacoReady.value &&
        activeTab.value?.viewMode === "text",
);
const SEP = (id: string): ZXDropdownOption => ({
    label: "",
    value: id,
    disabled: true,
    separator: true,
});

const menus = computed<{ id: string; label: string; options: ZXDropdownOption[] }[]>(
    () => [
        {
            id: "file",
            label: "文件",
            options: [
                { label: "新建文件", value: "f-new-file", shortcut: "Ctrl+N", icon: FilePlus2 },
                { label: "新建文件夹", value: "f-new-folder" },
                SEP("sep-f1"),
                { label: "保存", value: "f-save", shortcut: "Ctrl+S", icon: Save, disabled: !activeTab.value },
                { label: "全部保存", value: "f-save-all", shortcut: "Ctrl+Alt+S" },
                { label: "重载当前文件", value: "f-revert", disabled: !activeTab.value || activeTab.value?.kind !== "text" },
                SEP("sep-f2"),
                { label: "重命名", value: "f-rename", shortcut: "F2", disabled: !activeTab.value },
                { label: "删除文件", value: "f-delete", icon: Trash2, disabled: !activeTab.value },
                SEP("sep-f3"),
                { label: "刷新工作区", value: "f-refresh" },
                SEP("sep-f4"),
                { label: "关闭当前标签", value: "f-close-tab", shortcut: "Ctrl+W", disabled: !activeTab.value },
                { label: "关闭其他标签", value: "f-close-others", disabled: wb.tabs.value.length <= 1 },
            ],
        },
        {
            id: "edit",
            label: "编辑",
            options: [
                { label: "撤销", value: "e-undo", shortcut: "Ctrl+Z", icon: Undo2, disabled: !textReady.value },
                { label: "重做", value: "e-redo", shortcut: "Ctrl+Y", icon: Redo2, disabled: !textReady.value },
                SEP("sep-e1"),
                { label: "剪切", value: "e-cut", shortcut: "Ctrl+X", icon: Scissors, disabled: !textReady.value },
                { label: "复制", value: "e-copy", shortcut: "Ctrl+C", icon: Copy, disabled: !textReady.value },
                { label: "粘贴", value: "e-paste", shortcut: "Ctrl+V", icon: Clipboard, disabled: !textReady.value },
                SEP("sep-e2"),
                { label: "查找", value: "e-find", shortcut: "Ctrl+F", disabled: !textReady.value },
                { label: "替换", value: "e-replace", shortcut: "Ctrl+H", disabled: !textReady.value },
                { label: "在项目文件中查找", value: "e-find-project", shortcut: "Ctrl+Shift+F" },
            ],
        },
        {
            id: "select",
            label: "选择",
            options: [
                { label: "全选", value: "s-all", shortcut: "Ctrl+A", icon: TextCursorInput, disabled: !textReady.value },
                SEP("sep-s1"),
                { label: "添加下一个匹配项", value: "s-next-match", shortcut: "Ctrl+D", disabled: !textReady.value },
                { label: "选择所有匹配项", value: "s-all-matches", shortcut: "Ctrl+Shift+L", disabled: !textReady.value },
            ],
        },
        {
            id: "view",
            label: "查看",
            options: [
                { label: "自动换行", value: "v-wrap", shortcut: "Alt+Z", checked: wb.wordWrap.value },
                { label: "显示缩略图", value: "v-minimap", checked: wb.minimapEnabled.value },
                { label: "显示行号", value: "v-line-numbers", checked: wb.lineNumbersEnabled.value },
                {
                    label: "显示不可见字符",
                    value: "v-whitespace-root",
                    children: [
                        {
                            label: "全部显示",
                            value: "v-ws-all-on",
                            checked:
                                wb.showSpaces.value &&
                                wb.showTabs.value &&
                                wb.renderControlChars.value,
                        },
                        {
                            label: "全部隐藏",
                            value: "v-ws-all-off",
                            checked:
                                !wb.showSpaces.value &&
                                !wb.showTabs.value &&
                                !wb.renderControlChars.value,
                        },
                        SEP("sep-ws"),
                        {
                            label: "空格",
                            value: "v-ws-space",
                            checked: wb.showSpaces.value,
                            keepOpen: true,
                        },
                        {
                            label: "Tab",
                            value: "v-ws-tab",
                            checked: wb.showTabs.value,
                            keepOpen: true,
                        },
                        {
                            label: "回车",
                            value: "v-ws-control",
                            checked: wb.renderControlChars.value,
                            keepOpen: true,
                        },
                    ],
                },
                SEP("sep-v0"),
                {
                    label: isSidebarOpen.value ? "隐藏左面板" : "显示左面板",
                    value: "v-left-panel",
                    checked: isSidebarOpen.value,
                },
                {
                    label: isRightPanelOpen.value ? "隐藏右面板" : "显示右面板",
                    value: "v-right-panel",
                    checked: isRightPanelOpen.value,
                },
                SEP("sep-v1"),
                // 未拆分：先提供拆分入口；已拆分：再切换左右/上下方向
                ...(wb.isSplit.value
                    ? [
                          {
                              label:
                                  wb.splitDirection.value === "vertical"
                                      ? "切换为左右分栏"
                                      : "切换为上下分栏",
                              value: "v-toggle-split-direction",
                              icon:
                                  wb.splitDirection.value === "vertical"
                                      ? SquareSplitHorizontal
                                      : SquareSplitVertical,
                          } as ZXDropdownOption,
                      ]
                    : [
                          {
                              label: "向右拆分编辑器",
                              value: "v-split-right",
                              icon: SquareSplitHorizontal,
                              disabled: !activeTab.value,
                          } as ZXDropdownOption,
                          {
                              label: "向下拆分编辑器",
                              value: "v-split-bottom",
                              icon: SquareSplitVertical,
                              disabled: !activeTab.value,
                          } as ZXDropdownOption,
                      ]),
                SEP("sep-v3"),
                { label: "放大字号", value: "v-zoom-in", shortcut: "Ctrl+=" },
                { label: "缩小字号", value: "v-zoom-out", shortcut: "Ctrl+-" },
            ],
        },
        {
            id: "goto",
            label: "转到",
            options: [
                { label: "快速打开项目文件...", value: "g-quick-open", shortcut: "Ctrl+P", icon: FileCode2 },
                { label: "转到行 / 列...", value: "g-goto-line", shortcut: "Ctrl+G", disabled: !textReady.value },
                { label: "转到符号 / 函数...", value: "g-goto-symbol", shortcut: "Ctrl+Shift+O", disabled: !textReady.value },
                SEP("sep-g1"),
                { label: "后退光标位置", value: "g-back", shortcut: "Alt+←" },
                { label: "前进光标位置", value: "g-forward", shortcut: "Alt+→" },
            ],
        },
        {
            id: "database",
            label: "数据库",
            options: [
                {
                    label: "打开数据库侧栏",
                    value: "db-sidebar",
                    icon: Database,
                    checked: activePanel.value === "database" && isSidebarOpen.value,
                },
                { label: "刷新数据库", value: "db-refresh", icon: RefreshCw },
                SEP("sep-db1"),
                { label: "新建 SQL 文件", value: "db-new-sql" },
                {
                    label: isRightPanelOpen.value
                        ? "隐藏 SQL 控制台"
                        : "SQL 控制台",
                    value: "db-open-sql",
                    checked: isRightPanelOpen.value,
                },
            ],
        },
        {
            // JetBrains「Code」：格式化 / 注释 / 行操作 / 折叠
            id: "code",
            label: "代码",
            options: [
                { label: "格式化文档", value: "e-format", shortcut: "Shift+Alt+F", icon: Code, disabled: !textReady.value },
                SEP("sep-c1"),
                { label: "切换行注释", value: "e-comment-line", shortcut: "Ctrl+/", icon: ListChecks, disabled: !textReady.value },
                { label: "切换块注释", value: "e-comment-block", shortcut: "Shift+Alt+A", disabled: !textReady.value },
                SEP("sep-c2"),
                { label: "向上复制行", value: "s-copy-up", shortcut: "Shift+Alt+↑", disabled: !textReady.value },
                { label: "向下复制行", value: "s-copy-down", shortcut: "Shift+Alt+↓", disabled: !textReady.value },
                { label: "向上移动行", value: "s-move-up", shortcut: "Alt+↑", disabled: !textReady.value },
                { label: "向下移动行", value: "s-move-down", shortcut: "Alt+↓", disabled: !textReady.value },
                SEP("sep-c3"),
                { label: "删除当前行", value: "c-delete-line", shortcut: "Ctrl+Shift+K", disabled: !textReady.value },
                { label: "合并到上一行", value: "c-join-lines", shortcut: "Ctrl+Shift+J", disabled: !textReady.value },
                SEP("sep-c4"),
                { label: "折叠全部代码", value: "v-fold-all", shortcut: "Ctrl+K 0", icon: ChevronsDownUp, disabled: !textReady.value },
                { label: "展开全部代码", value: "v-unfold-all", shortcut: "Ctrl+K J", icon: ChevronsUpDown, disabled: !textReady.value },
            ],
        },
        {
            id: "prefs",
            label: "设置",
            options: [
                {
                    label: "缩进",
                    value: "p-indent",
                    icon: Type,
                    children: [
                        { label: "2 空格", value: "p-indent-2", icon: Type, checked: wb.indentMode.value === "2" },
                        { label: "4 空格", value: "p-indent-4", icon: Type, checked: wb.indentMode.value === "4" },
                        { label: "Tab 缩进", value: "p-indent-tab", icon: Type, checked: wb.indentMode.value === "tab" },
                        { label: "自定义...", value: "p-indent-custom", icon: SlidersHorizontal },
                    ],
                },
                { label: "快捷键映射...", value: "p-keymap", icon: Keyboard },
            ],
        },
    ],
);

const onMenu = (value: string) => {
    if (value.startsWith("sep-")) return;
    switch (value) {
        // ---- 文件 ----
        case "f-new-file":
            isSidebarOpen.value = true;
            activePanel.value = "explorer";
            sidebarRef.value?.startCreate("file");
            break;
        case "f-new-folder":
            isSidebarOpen.value = true;
            activePanel.value = "explorer";
            sidebarRef.value?.startCreate("folder");
            break;
        case "f-save":
            wb.saveActive();
            break;
        case "f-save-all":
            void wb.saveAllTabs();
            break;
        case "f-revert":
            void wb.revertActive();
            break;
        case "f-rename":
            isSidebarOpen.value = true;
            activePanel.value = "explorer";
            if (activeTab.value)
                void sidebarRef.value?.renamePath(activeTab.value.path);
            break;
        case "f-delete":
            isSidebarOpen.value = true;
            activePanel.value = "explorer";
            if (activeTab.value)
                void sidebarRef.value?.deletePath(activeTab.value.path);
            break;
        case "f-refresh":
            sidebarRef.value?.reload();
            void wb.refreshQuickOpen();
            break;
        case "f-close-tab":
            if (activeTab.value) wb.closeTab(activeTab.value.id);
            break;
        case "f-close-others": {
            const others = wb.tabs.value.filter((t) => t.id !== wb.activeTabId.value);
            if (!others.length) break;
            const dirty = others.filter((t) => t.isDirty);
            const doClose = () => wb.closeOtherTabs();
            if (dirty.length) {
                ZXMessageBox({
                    title: "关闭其他标签页",
                    type: "warning",
                    message: `有 ${dirty.length} 个未保存标签将被关闭，未保存的修改会丢失，确定吗？`,
                    cancelButtonText: "取消",
                    confirmButtonText: "关闭",
                    confirmButtonHoverBg: "var(--zx-color-danger)",
                    onConfirm: doClose,
                });
            } else doClose();
            break;
        }
        // ---- 编辑 ----
        case "e-undo":
            wb.runEditorCommand("undo");
            break;
        case "e-redo":
            wb.runEditorCommand("redo");
            break;
        case "e-cut":
            wb.runEditorCommand("editor.action.clipboardCutAction");
            break;
        case "e-copy":
            wb.runEditorCommand("editor.action.clipboardCopyAction");
            break;
        case "e-paste":
            wb.runEditorCommand("editor.action.clipboardPasteAction");
            break;
        case "e-find":
            wb.runEditorCommand("actions.find");
            break;
        case "e-replace":
            wb.runEditorCommand("editor.action.startFindReplaceAction");
            break;
        case "e-find-project":
            activePanel.value = "search";
            isSidebarOpen.value = true;
            break;
        case "e-format":
            wb.runEditorCommand("editor.action.formatDocument");
            break;
        case "e-comment-line":
            wb.runEditorCommand("editor.action.commentLine");
            break;
        case "e-comment-block":
            wb.runEditorCommand("editor.action.blockComment");
            break;
        case "c-delete-line":
            wb.runEditorCommand("editor.action.deleteLines");
            break;
        case "c-join-lines":
            wb.runEditorCommand("editor.action.joinLines");
            break;
        // ---- 选择 ----
        case "s-all":
            wb.selectAll();
            break;
        case "s-copy-up":
            wb.runEditorCommand("editor.action.copyLinesUpAction");
            break;
        case "s-copy-down":
            wb.runEditorCommand("editor.action.copyLinesDownAction");
            break;
        case "s-move-up":
            wb.runEditorCommand("editor.action.moveLinesUpAction");
            break;
        case "s-move-down":
            wb.runEditorCommand("editor.action.moveLinesDownAction");
            break;
        case "s-next-match":
            wb.runEditorCommand("editor.action.addSelectionToNextFindMatch");
            break;
        case "s-all-matches":
            wb.runEditorCommand("editor.action.selectHighlights");
            break;
        // ---- 查看 ----
        case "v-sidebar":
            isSidebarOpen.value = !isSidebarOpen.value;
            break;
        case "v-fullscreen":
            isFullscreen.value = !isFullscreen.value;
            break;
        case "v-wrap":
            wb.toggleWordWrap();
            break;
        case "v-minimap":
            wb.toggleMinimap();
            break;
        case "v-line-numbers":
            wb.toggleLineNumbers();
            break;
        case "v-ws-all-on":
            wb.setInvisibleAll(true);
            break;
        case "v-ws-all-off":
            wb.setInvisibleAll(false);
            break;
        case "v-ws-space":
            wb.toggleShowSpaces();
            break;
        case "v-ws-tab":
            wb.toggleShowTabs();
            break;
        case "v-ws-control":
            wb.toggleRenderControlChars();
            break;
        case "v-left-panel":
            toggleLeftPanel();
            break;
        case "v-right-panel":
            toggleRightPanel();
            break;
        case "v-fold-all":
            wb.runEditorCommand("editor.foldAll");
            break;
        case "v-unfold-all":
            wb.runEditorCommand("editor.unfoldAll");
            break;
        case "v-split-right":
            if (activeTab.value) wb.splitTabToRight(activeTab.value.id);
            break;
        case "v-split-bottom":
            if (activeTab.value) wb.splitTabToBottom(activeTab.value.id);
            break;
        case "v-toggle-split-direction":
            wb.toggleSplitDirection();
            break;
        case "v-zoom-in":
            wb.runEditorCommand("editor.action.fontZoomIn");
            break;
        case "v-zoom-out":
            wb.runEditorCommand("editor.action.fontZoomOut");
            break;
        // ---- 转到 ----
        case "g-quick-open":
            void toggleQuickOpen();
            break;
        // ---- 数据库 ----
        case "db-sidebar":
            isSidebarOpen.value = true;
            activePanel.value = "database";
            break;
        case "db-refresh":
            isSidebarOpen.value = true;
            activePanel.value = "database";
            sidebarRef.value?.reloadDb?.();
            break;
        case "db-new-sql":
            isSidebarOpen.value = true;
            activePanel.value = "database";
            sidebarRef.value?.newSqlFile?.();
            break;
        case "db-open-sql":
            if (isRightPanelOpen.value) {
                isRightPanelOpen.value = false;
                onRightPanelLayout();
            } else {
                openRightSqlConsole();
            }
            break;
        case "db-sql-panel":
            // 底部面板暂下线；SQL 统一走右栏
            openRightSqlConsole();
            break;
        case "g-goto-line":
            wb.runEditorCommand("editor.action.gotoLine");
            break;
        case "g-goto-symbol":
            wb.runEditorCommand("editor.action.quickOutline");
            break;
        case "g-back":
            wb.runEditorCommand("editor.action.previousCursor");
            break;
        case "g-forward":
            wb.runEditorCommand("editor.action.nextCursor");
            break;
        // ---- 设置 ----
        case "p-indent-2":
            wb.setIndent("2");
            break;
        case "p-indent-4":
            wb.setIndent("4");
            break;
        case "p-indent-tab":
            wb.setIndent("tab");
            break;
        case "p-indent-custom": {
            let value = String(wb.tabSize.value);
            ZXMessageBox({
                title: "自定义缩进",
                type: "info",
                message: "输入缩进的空格数（1 - 8）：",
                cancelButtonText: "取消",
                confirmButtonText: "确定",
                slots: {
                    default: () =>
                        h("input", {
                            class:
                                "mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm text-zx-text focus:border-zx-primary focus:outline-none",
                            value,
                            autofocus: true,
                            onInput: (e: Event) =>
                                (value = (e.target as HTMLInputElement).value),
                        }),
                },
                onConfirm: () => {
                    const n = Math.min(8, Math.max(1, parseInt(value, 10) || 4));
                    wb.setIndent(n);
                },
            });
            break;
        }
        case "p-keymap":
            showKeymap();
            break;
    }
};

// 文件树自动 reveal 定位（数据库虚拟标签不进文件树）
watch(
    () => wb.activeTabId.value,
    (path) => {
        if (path && !path.startsWith("db://")) sidebarRef.value?.revealPath(path);
        // 打开 SQL 标签时自动拉起底栏结果
        const tab = wb.tabs.value.find((t) => t.id === path);
        if (tab?.kind === "sql") wb.openBottomSql();
        if (path && isMobile.value) isSidebarOpen.value = false;
    },
);

const handleTogglePanel = (panel: SidebarPanel) => {
    if (activePanel.value === panel) {
        isSidebarOpen.value = !isSidebarOpen.value;
    } else {
        activePanel.value = panel;
        isSidebarOpen.value = true;
    }
};

const doClose = () => {
    visible.value = false;
};

const tryCloseWindow = () => {
    const dirty = wb.dirtyTabs.value;
    if (dirty.length > 0) {
        ZXMessageBox({
            title: "未保存的修改",
            message: `存在 ${dirty.length} 个未保存的文件（${dirty
                .map((t) => t.name)
                .join("、")}），确定要退出编辑器吗？`,
            cancelButtonText: "继续编辑",
            confirmButtonText: "放弃并关闭",
            onConfirm: doClose,
        });
        return;
    }
    doClose();
};

const handleKeydown = (e: KeyboardEvent) => {
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    // 快速打开浮层优先处理
    if (quickOpen.open) {
        if (e.key === "Escape") {
            e.preventDefault();
            quickOpen.open = false;
        }
        return; // 上下/回车由输入框自身处理
    }
    if (mod && e.altKey && key === "s") {
        e.preventDefault();
        void wb.saveAllTabs();
    } else if (mod && !e.shiftKey && !e.altKey && key === "s") {
        e.preventDefault();
        wb.saveActive();
    } else if (mod && !e.shiftKey && !e.altKey && key === "n") {
        e.preventDefault();
        onMenu("f-new-file");
    } else if (mod && !e.shiftKey && !e.altKey && key === "w") {
        e.preventDefault();
        onMenu("f-close-tab");
    } else if (mod && !e.shiftKey && !e.altKey && key === "b") {
        e.preventDefault();
        isSidebarOpen.value = !isSidebarOpen.value;
    } else if (e.key === "F11") {
        e.preventDefault();
        isFullscreen.value = !isFullscreen.value;
    } else if (e.altKey && !e.shiftKey && key === "z") {
        e.preventDefault();
        wb.toggleWordWrap();
    } else if (mod && !e.shiftKey && !e.altKey && key === "p") {
        e.preventDefault();
        void toggleQuickOpen();
    } else if (mod && e.shiftKey && !e.altKey && key === "f") {
        e.preventDefault();
        activePanel.value = "search";
        isSidebarOpen.value = true;
    } else if (mod && !e.shiftKey && !e.altKey && key === "g") {
        e.preventDefault();
        wb.runEditorCommand("editor.action.gotoLine");
    } else if (mod && e.shiftKey && !e.altKey && key === "o") {
        e.preventDefault();
        wb.runEditorCommand("editor.action.quickOutline");
    } else if (e.altKey && e.key === "ArrowLeft") {
        e.preventDefault();
        wb.runEditorCommand("editor.action.previousCursor");
    } else if (e.altKey && e.key === "ArrowRight") {
        e.preventDefault();
        wb.runEditorCommand("editor.action.nextCursor");
    } else if (e.key === "Escape") {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        if (minimized.value) {
            minimized.value = false;
            return;
        }
        if (isFullscreen.value) {
            toggleFullscreen();
            return;
        }
        tryCloseWindow();
    }
};

onMounted(() => {
    clampWindowToViewport();
    window.addEventListener("resize", clampWindowToViewport);
    window.addEventListener("keydown", handleKeydown);
});

// 分栏/就绪变化后重算 monaco 布局；就绪前隐藏窗口，标签壳已恢复完再显示
watch(
    () => wb.isSplit.value,
    () => {
        nextTick(() => {
            wb.layoutAll();
        });
    },
);
const modalRootRef = ref<HTMLElement | null>(null);
let hasPlayedEnter = false;
watch(
    () => wb.isReady.value,
    (ready) => {
        if (!ready) return;
        nextTick(() => {
            wb.layoutAll();
            // 就绪后再确保停在本次打开的文件上（路径归一后 openFile 会 activate）
            if (props.initialFile?.path) {
                void wb.openFile(props.initialFile.path, props.initialFile.name);
            }
            // 等 modal-content 从 v-show 露出来后再播进场（否则挂在 display:none 上等于没动画）
            const el = modalRootRef.value;
            if (el && !hasPlayedEnter) {
                hasPlayedEnter = true;
                void modalJelly.onEnter(el, () => {});
            }
        });
    },
);

// 编辑器已打开时，文件页再次点文件 → initialFile 变化也要打开新标签
watch(
    () => props.initialFile,
    (file) => {
        if (!file) return;
        // 记下用户本次要打开的文件：会话恢复后优先进入它，不被旧标签抢焦点
        wb.setSessionPreferPath(file.path);
        if (wb.isReady.value) wb.openFile(file.path, file.name);
    },
    { immediate: true },
);

// 外部指定侧栏面板（文件页「数据库」按钮）；null 不覆盖当前面板
watch(
    () => props.initialPanel,
    (panel) => {
        if (!panel) return;
        activePanel.value = panel;
        isSidebarOpen.value = true;
    },
);

onBeforeUnmount(() => {
    cleanupSidebarDrag?.();
    cleanupWindowDrag?.();
    cleanupWindowResize?.();
    window.removeEventListener("resize", clampWindowToViewport);
    window.removeEventListener("keydown", handleKeydown);
    wb.dispose();
});
</script>

<template>
    <Teleport to="body">
        <Transition
            :css="false"
            @leave="modalJelly.onLeave"
            @after-leave="emit('close')"
        >
            <div
                v-if="visible"
                ref="modalRootRef"
                class="file-editor-modal fixed inset-0 z-50 select-none"
                :class="isFullscreen ? '' : 'pointer-events-none'"
            >
                <!-- 就绪前：加载态（DOM 已挂载以便 monaco/会话恢复） -->
                <div
                    v-if="!wb.isReady.value"
                    class="pointer-events-auto absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-white/70"
                >
                    <div
                        class="h-8 w-8 animate-spin rounded-full border-2 border-zx-primary border-b-transparent"
                    />
                    <p class="text-xs text-zx-text-muted">
                        正在恢复工作区…
                    </p>
                </div>

                <div
                    v-show="!minimized && wb.isReady.value"
                    class="glass-overlay absolute inset-0 pointer-events-auto"
                    @click="tryCloseWindow"
                ></div>
                <div
                    v-show="!minimized && wb.isReady.value"
                    class="modal-content relative z-1 flex flex-col overflow-hidden border border-slate-200 bg-white shadow-2xl pointer-events-auto"
                    :class="
                        isFullscreen
                            ? 'fixed inset-0 h-full w-full rounded-none'
                            : 'rounded-xl'
                    "
                    :style="
                        isFullscreen
                            ? undefined
                            : {
                                  position: 'absolute',
                                  left: `${winRect.x}px`,
                                  top: `${winRect.y}px`,
                                  width: `${winRect.w}px`,
                                  height: `${winRect.h}px`,
                              }
                    "
                    @click.stop
                >
                    <!-- 窗口八向缩放手柄（仅非全屏） -->
                    <template v-if="!isFullscreen">
                        <div
                            class="absolute -top-1.5 left-3 right-3 h-3 z-40 cursor-ns-resize touch-none"
                            @pointerdown.prevent="startResizeWindow($event, 'n')"
                        ></div>
                        <div
                            class="absolute -bottom-1.5 left-3 right-3 h-3 z-40 cursor-ns-resize touch-none"
                            @pointerdown.prevent="startResizeWindow($event, 's')"
                        ></div>
                        <div
                            class="absolute -left-1.5 top-3 bottom-3 w-3 z-40 cursor-ew-resize touch-none"
                            @pointerdown.prevent="startResizeWindow($event, 'w')"
                        ></div>
                        <div
                            class="absolute -right-1.5 top-3 bottom-3 w-3 z-40 cursor-ew-resize touch-none"
                            @pointerdown.prevent="startResizeWindow($event, 'e')"
                        ></div>
                        <div
                            class="absolute -top-2 -left-2 h-5 w-5 z-40 cursor-nwse-resize touch-none"
                            @pointerdown.prevent="startResizeWindow($event, 'nw')"
                        ></div>
                        <div
                            class="absolute -top-2 -right-2 h-5 w-5 z-40 cursor-nesw-resize touch-none"
                            @pointerdown.prevent="startResizeWindow($event, 'ne')"
                        ></div>
                        <div
                            class="absolute -bottom-2 -left-2 h-5 w-5 z-40 cursor-nesw-resize touch-none"
                            @pointerdown.prevent="startResizeWindow($event, 'sw')"
                        ></div>
                        <div
                            class="absolute -bottom-2 -right-2 h-5 w-5 z-40 cursor-nwse-resize touch-none"
                            @pointerdown.prevent="startResizeWindow($event, 'se')"
                        ></div>
                    </template>

                    <!-- 窗口标题栏：左侧侧栏开关 / 居中标题 / 右侧全屏与关闭 -->
                    <header
                        class="flex h-9 flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white pl-1 pr-1.5 select-none"
                        :class="isFullscreen ? '' : isDraggingWindow ? 'cursor-grabbing' : 'cursor-grab'"
                        @pointerdown="onHeaderMouseDown"
                        @dblclick="onHeaderDblClick"
                    >
                        <div class="flex flex-shrink-0 items-center gap-1">
                            <ZXDropdownMenu
                                v-for="menu in menus"
                                :key="menu.id"
                                :model-value="'__none'"
                                :placeholder="menu.label"
                                :options="menu.options"
                                compact
                                panel-class="min-w-56"
                                trigger-class="flex h-7 cursor-pointer items-center rounded-lg px-2.5 text-xs font-medium text-zx-text transition-colors hover:bg-zx-primary-soft hover:text-zx-primary"
                                active-trigger-class="bg-zx-primary-soft text-zx-primary font-semibold"
                                @update:model-value="onMenu"
                            >
                                <template #trigger>
                                    <span>{{ menu.label }}</span>
                                </template>
                            </ZXDropdownMenu>
                        </div>

                        <div class="flex flex-shrink-0 items-center gap-0.5">
                            <ZxButton
                                variant="ghost"
                                circle
                                size="sm"
                                :class="isSidebarOpen ? 'text-zx-primary' : ''"
                                :title="isSidebarOpen ? '隐藏左面板' : '显示左面板'"
                                @click="toggleLeftPanel"
                            >
                                <PanelLeft class="h-3.5 w-3.5" />
                            </ZxButton>
                            <ZxButton
                                variant="ghost"
                                circle
                                size="sm"
                                :class="
                                    isRightPanelOpen ? 'text-zx-primary' : ''
                                "
                                :title="
                                    isRightPanelOpen
                                        ? '隐藏右面板'
                                        : '显示右面板'
                                "
                                @click="toggleRightPanel()"
                            >
                                <PanelRight class="h-3.5 w-3.5" />
                            </ZxButton>
                            <ZxButton
                                variant="ghost"
                                circle
                                size="sm"
                                title="最小化"
                                @click="minimized = true"
                            >
                                <Minus class="h-3.5 w-3.5" />
                            </ZxButton>
                            <ZxButton
                                variant="ghost"
                                circle
                                size="sm"
                                :title="isFullscreen ? '退出全屏' : '全屏编辑'"
                                @click="toggleFullscreen"
                            >
                                <Minimize v-if="isFullscreen" class="h-3.5 w-3.5" />
                                <Maximize v-else class="h-3.5 w-3.5" />
                            </ZxButton>
                            <ZxButton
                                variant="ghost"
                                circle
                                size="sm"
                                class="relative"
                                title="关闭编辑器 (Esc)"
                                @click="tryCloseWindow"
                            >
                                <!-- 有未保存修改时关闭钮显示圆点（VSCode） -->
                                <span
                                    v-if="wb.dirtyTabs.value.length > 0"
                                    class="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-zx-warning"
                                ></span>
                                <X v-else class="h-4 w-4" />
                            </ZxButton>
                        </div>
                    </header>

            <!-- 活动栏 | 侧栏(通高) | 右侧列(编辑器上 / 底栏下) -->
            <div ref="workbenchBodyRef" class="relative flex min-h-0 flex-1 overflow-hidden">
                <EditorActivityBar
                    :active-panel="activePanel"
                    @toggle-panel="handleTogglePanel"
                />

                        <Transition
                            :css="false"
                            @enter="onSidebarEnter"
                            @leave="onSidebarLeave"
                        >
                            <div
                                v-show="isSidebarOpen"
                                class="h-full flex-shrink-0 overflow-hidden"
                                :style="{ width: `${sidebarWidth}px` }"
                            >
                                <EditorSidebar
                                    ref="sidebarRef"
                                    :wb="wb"
                                    :active-panel="activePanel"
                                    @open-sql-console="openRightSqlConsole"
                                />
                            </div>
                        </Transition>

                        <div
                            v-if="isSidebarOpen"
                            class="group relative z-20 w-1 -ml-0.5 flex-shrink-0 cursor-col-resize touch-none select-none bg-transparent"
                            title="拖拽调节侧边栏宽度，双击重置"
                            @pointerdown.prevent="startDragSidebar"
                            @dblclick="resetSidebarWidth"
                        >
                            <div class="absolute inset-y-0 -left-2 -right-2 cursor-col-resize"></div>
                        </div>

                        <!-- 左侧栏右边：编辑器在上、底部面板在下 -->
                        <div class="flex min-w-0 min-h-0 flex-1 overflow-hidden">
                            <div class="flex min-w-0 min-h-0 flex-1 flex-col overflow-hidden">
                            <div
                                ref="editorContainerRef"
                                class="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-white"
                            >
                        <!-- VSCode 式列式编辑器组：列间左右、列内上下 -->
                        <div class="flex min-h-0 flex-1 overflow-hidden">
                            <template
                                v-for="(col, ci) in wb.layoutColumns.value"
                                :key="`col-${ci}`"
                            >
                                <div
                                    v-if="ci > 0"
                                    class="relative z-20 w-1 flex-shrink-0 cursor-col-resize select-none bg-slate-200"
                                    title="拖拽调节列宽"
                                    @pointerdown.prevent="startColumnDragAt(ci, $event)"
                                >
                                    <div
                                        class="absolute inset-y-0 -left-1.5 -right-1.5 cursor-col-resize"
                                    ></div>
                                </div>
                                <div
                                    class="flex min-w-0 min-h-0 flex-1 flex-col overflow-hidden"
                                    :data-editor-col="ci"
                                    :style="{
                                        flex: `${wb.columnWeights.value[ci] ?? 1} 0 0%`,
                                    }"
                                >
                                    <template
                                        v-for="(gid, gi) in col"
                                        :key="gid"
                                    >
                                        <div
                                            v-if="gi > 0"
                                            class="relative z-20 h-1 flex-shrink-0 cursor-row-resize select-none bg-slate-200"
                                            title="拖拽调节组高"
                                            @pointerdown.prevent="
                                                startGroupRowDrag(ci, gi, $event)
                                            "
                                        >
                                            <div
                                                class="absolute inset-x-0 -top-1.5 -bottom-1.5 cursor-row-resize"
                                            ></div>
                                        </div>
                                        <EditorPane
                                            :wb="wb"
                                            :group="gid"
                                            :is-mobile="isMobile"
                                            :data-editor-pane="gid"
                                            :style="{
                                                flex: `${wb.groupWeights[gid] ?? 1} 0 0%`,
                                            }"
                                            @open-sql-console="openRightSqlConsole"
                                        />
                                    </template>
                                </div>
                            </template>
                        </div>

                    <!-- 快速打开（Ctrl+P）：顶部浮层，文件名过滤 + 键盘导航 -->
                    <div
                        v-if="quickOpen.open"
                        class="absolute left-1/2 top-2 z-40 w-[min(560px,94%)] -translate-x-1/2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
                    >
                        <input
                            ref="quickOpenInputRef"
                            v-model="quickOpen.query"
                            class="w-full bg-transparent px-4 py-2.5 text-sm text-zx-text placeholder:text-zx-text-subtle focus:outline-none"
                            placeholder="输入文件名快速打开…（↑↓ 选择，Enter 打开，Esc 关闭）"
                            type="text"
                            @keydown.down.prevent="moveQuickOpen(1)"
                            @keydown.up.prevent="moveQuickOpen(-1)"
                            @keydown.enter.prevent="applyQuickOpen"
                            @keydown.esc.prevent="quickOpen.open = false"
                        />
                        <div
                            class="max-h-72 overflow-y-auto border-t border-slate-100 py-1"
                        >
                            <button
                                v-for="(f, i) in quickOpenResults"
                                :key="f.path"
                                type="button"
                                class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors"
                                :class="
                                    i === quickOpenIndex
                                        ? 'bg-zx-primary-soft text-zx-primary'
                                        : 'text-zx-text hover:bg-slate-100'
                                "
                                @click="openQuickPick(f)"
                                @mousemove="quickOpenIndex = i"
                            >
                                <component
                                    :is="getFileIcon(f.name).icon"
                                    class="h-3.5 w-3.5 flex-shrink-0"
                                />
                                <span class="flex-shrink-0 font-medium">{{
                                    f.name
                                }}</span>
                                <span
                                    class="ml-auto truncate text-[10px] text-zx-text-subtle"
                                    >{{ f.path }}</span
                                >
                            </button>
                            <div
                                v-if="!quickOpenResults.length"
                                class="px-4 py-6 text-center text-xs text-zx-text-subtle"
                            >
                                {{
                                    wb.quickOpenLoading.value
                                        ? "正在扫描工作区文件…"
                                        : "没有匹配的文件"
                                }}
                            </div>
                        </div>
                    </div>
                    <!-- /quickOpen 或列表 -->
                    </div>
                    <!-- /editorContainer F -->
                    </div>
                    <!-- /编辑器列 E；右栏与 E 并排 -->
                    <EditorRightPanel
                        :open="isRightPanelOpen"
                        :table-name="rightSqlTableName"
                        @close="isRightPanelOpen = false"
                        @resized="onRightPanelLayout"
                    />
                    </div>
                    <!-- /D 左侧栏右边 -->
            </div>
            <!-- /C workbenchBody -->

            <!-- 底部状态栏（modal-content 内，与 workbenchBody 并列） -->
            <EditorStatusBar :wb="wb" />
                </div>
                <!-- /B modal-content -->

                <!-- 最小化：右下角悬浮球，点击还原 -->
                <div
                    v-if="minimized"
                    class="pointer-events-auto absolute bottom-6 right-6 z-10 flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-white py-2 pl-2 pr-4 shadow-xl transition-transform hover:scale-105"
                    title="还原文件编辑器"
                    @click="minimized = false"
                >
                    <span
                        class="relative flex h-8 w-8 items-center justify-center rounded-full bg-zx-primary-soft text-zx-primary"
                    >
                        <FileCode2 class="h-4 w-4" />
                        <span
                            v-if="wb.dirtyTabs.value.length > 0"
                            class="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-zx-warning"
                        ></span>
                    </span>
                    <span class="max-w-[160px] truncate text-xs font-medium text-zx-text-muted">
                        {{ activeTab?.name || "文件编辑器" }}
                    </span>
                </div>
            </div>
            <!-- /A modalRoot -->
        </Transition>
    </Teleport>
</template>

<style scoped>
kbd {
    display: inline-block;
    min-width: 1.25rem;
    border: 1px solid var(--zx-color-border);
    border-radius: 0.25rem;
    background-color: var(--zx-color-surface-muted);
    padding: 0 0.25rem;
    text-align: center;
    font-size: 10px;
    line-height: 1.4;
}

/* 搜索结果跳转后的短暂高亮（monaco decoration className） */
:global(.wb-match-flash) {
    outline: 2px solid var(--zx-color-primary);
    background: color-mix(in srgb, var(--zx-color-primary) 18%, transparent);
}

/* 左侧行改动条：新增绿 / 修改蓝 / 删除红（相对打开或保存时的磁盘基线）
   margin-left 推离行号，避免贴得太近 */
:global(.wb-diff-added),
:global(.wb-diff-modified),
:global(.wb-diff-deleted) {
    width: 3px !important;
    margin-left: 8px !important;
}

:global(.wb-diff-added) {
    background: #22c55e;
}

:global(.wb-diff-modified) {
    background: #3b82f6;
}

:global(.wb-diff-deleted) {
    background: #ef4444;
    box-shadow: 2px 0 0 0 #ef444466;
}
</style>
