<template>
    <div class="zx-editor-container">
        <div v-if="!hideToolbar" class="editor-toolbar">
            <div class="toolbar-left">
                <select
                    v-model="selectedLanguage"
                    class="toolbar-select"
                    :disabled="readonly"
                    title="语言"
                >
                    <option
                        v-for="lang in languages"
                        :key="lang.value"
                        :value="lang.value"
                    >
                        {{ lang.label }}
                    </option>
                </select>

                <select
                    v-model="selectedEncoding"
                    class="toolbar-select"
                    title="文件编码"
                >
                    <option value="utf-8">UTF-8</option>
                    <option value="gbk">GBK</option>
                </select>

                <button
                    v-if="!isPreviewing"
                    class="toolbar-chip"
                    type="button"
                    @click="changeEOL"
                >
                    <WrapText class="icon" />
                    <span>{{ currentEolLabel }}</span>
                </button>

                <button
                    v-if="!isPreviewing"
                    class="toolbar-chip"
                    type="button"
                    @click="toggleWordWrap"
                >
                    <Settings class="icon" />
                    <span>{{ wordWrap ? "自动换行" : "不换行" }}</span>
                </button>
            </div>

            <div class="toolbar-right">
                <!-- Markdown 模式切换：编辑 / 编辑与预览 / 预览 -->
                <div v-if="isMarkdown" class="preview-segmented">
                    <button
                        type="button"
                        :class="{ 'segmented-active': mdMode === 'edit' }"
                        title="仅编辑"
                        @click="setMdMode('edit')"
                    >
                        <PenLine class="icon" />
                    </button>
                    <button
                        type="button"
                        :class="{ 'segmented-active': mdMode === 'split' }"
                        title="编辑与预览 (双栏分屏)"
                        @click="setMdMode('split')"
                    >
                        <SquareSplitHorizontal class="icon" />
                    </button>
                    <button
                        type="button"
                        :class="{ 'segmented-active': mdMode === 'preview' }"
                        title="仅预览"
                        @click="setMdMode('preview')"
                    >
                        <Eye class="icon" />
                    </button>
                </div>
                <template v-if="!isPreviewing">
                    <button
                        v-if="monacoReady"
                        class="toolbar-chip"
                        type="button"
                        title="查找 (Ctrl+F)"
                        @click="openFind"
                    >
                        <Search class="icon" />
                        <span>查找</span>
                    </button>
                    <button
                        v-if="monacoReady && monacoLang === 'json'"
                        class="toolbar-chip"
                        type="button"
                        title="格式化 JSON"
                        @click="formatDocument"
                    >
                        <Braces class="icon" />
                        <span>格式化</span>
                    </button>
                    <ZxButton
                        variant="ghost"
                        size="sm"
                        :disabled="!isDirty || readonly"
                        @click="handleReset"
                    >
                        <RefreshCw class="icon" />
                        重置
                    </ZxButton>
                    <ZxButton
                        size="sm"
                        :disabled="readonly"
                        @click="handleSave"
                    >
                        <Save class="icon" />
                        保存
                    </ZxButton>
                </template>
            </div>
        </div>

        <!-- 编辑与预览区域 -->
        <div ref="editorSplitRef" class="flex min-h-0 flex-1 overflow-hidden">
            <!-- 编辑视图：monaco 就绪前先用轻量 textarea 兜底渲染，保持挂载（v-show） -->
            <div
                v-show="!isMarkdown || mdMode !== 'preview'"
                class="editor-wrapper min-h-0 overflow-hidden"
                :class="{
                    'is-monaco': monacoReady,
                    'flex-1 w-full': !isMarkdown || mdMode === 'edit',
                }"
                :style="
                    isMarkdown && mdMode === 'split'
                        ? { width: `${100 - previewRatio}%` }
                        : {}
                "
            >
                <template v-if="!monacoReady">
                    <div class="line-number-gutter" aria-hidden="true">
                        <span v-for="line in lineCount" :key="line">{{
                            line
                        }}</span>
                    </div>
                    <div class="editor-content-host">
                        <!-- 语法高亮层：垫在透明文本的 textarea 下面 -->
                        <div
                            ref="highlightRef"
                            class="editor-highlight"
                            :class="{ 'is-wrap': wordWrap }"
                            aria-hidden="true"
                            v-html="highlightHtml"
                        ></div>
                        <textarea
                            ref="textareaRef"
                            v-model="content"
                            class="editor-textarea"
                            :class="{
                                'whitespace-pre': !wordWrap,
                                'has-highlight': highlightHtml !== '',
                            }"
                            :readonly="readonly"
                            spellcheck="false"
                            @input="handleInput"
                            @keydown="handleKeydown"
                            @scroll="syncOverlayScroll"
                            @keyup="onTextareaCursor"
                            @click="onTextareaCursor"
                            @focus="onTextareaCursor"
                        />
                    </div>
                </template>
                <div v-show="monacoReady" ref="monacoHost" class="monaco-host h-full w-full"></div>

                <div v-if="loading" class="loading-overlay">
                    <div class="loading-content">
                        <Loader2 class="loading-icon" />
                        <p>加载中...</p>
                    </div>
                </div>
            </div>

            <!-- Markdown 分屏拖拽手柄 Splitter (仅双栏分屏时显示) -->
            <div
                v-if="isMarkdown && mdMode === 'split'"
                class="group relative z-20 w-1 -ml-0.5 flex-shrink-0 cursor-col-resize select-none bg-slate-200 hover:bg-zx-primary active:bg-zx-primary transition-colors"
                :class="{ 'bg-zx-primary': isDraggingPreview }"
                title="拖拽调节预览栏宽度，双击居中"
                @pointerdown.prevent="startDragPreview"
                @dblclick="resetPreviewRatio"
            >
                <div class="absolute inset-y-0 -left-1.5 -right-1.5 cursor-col-resize"></div>
            </div>

            <!-- Markdown 预览视图：双栏分屏 或 纯预览 -->
            <div
                v-if="isMarkdown && mdMode !== 'edit'"
                class="min-h-0 overflow-y-auto bg-white"
                :class="mdMode === 'split' ? '' : 'flex-1 w-full'"
                :style="
                    mdMode === 'split'
                        ? { width: `${previewRatio}%` }
                        : {}
                "
            >
                <MarkdownPreview :content="content" :path="path" />
            </div>
        </div>

        <!-- 状态栏：光标位置 / 字符数 / 换行符 / 编码 / 语言 -->
        <div v-if="!hideStatusbar" class="editor-statusbar">
            <span>行 {{ cursorLine }}，列 {{ cursorCol }}</span>
            <span>{{ charCount.toLocaleString() }} 字符</span>
            <span class="flex-1"></span>
            <span>{{ currentEolLabel }}</span>
            <span>{{ encodingLabel }}</span>
            <span class="hidden sm:inline">{{ languageLabel }}</span>
        </div>
    </div>
</template>

<script setup lang="ts">
import {
    computed,
    nextTick,
    onBeforeUnmount,
    onMounted,
    ref,
    watch,
} from "vue";
import {
    Braces,
    Eye,
    Loader2,
    PenLine,
    RefreshCw,
    Save,
    Search,
    Settings,
    SquareSplitHorizontal,
    WrapText,
} from "lucide-vue-next";
import {
    highlightCode,
    resolveShikiLang,
    selectLangToShiki,
} from "./highlighter";
import { loadMonaco } from "./monacoLoader";
import { defineZxThemes, zxThemeName } from "./monacoTheme";
import MarkdownPreview from "./MarkdownPreview.vue";
import type * as MonacoNamespace from "monaco-editor/editor/editor.api";
import { useThemeStore } from "@/store/theme";

interface Props {
    modelValue?: string;
    language?: string;
    path?: string;
    readonly?: boolean;
    loading?: boolean;
    hideToolbar?: boolean;
    hideStatusbar?: boolean;
    /** 文件实际编码（读取接口探测），保存时随写回参数传给后端 */
    encoding?: string;
    /** 编辑器字号大小（默认 14） */
    fontSize?: number;
}

const props = withDefaults(defineProps<Props>(), {
    modelValue: "",
    language: "plaintext",
    path: "",
    readonly: false,
    loading: false,
    hideToolbar: false,
    hideStatusbar: false,
    encoding: "utf-8",
    fontSize: 14,
});

const emit = defineEmits<{
    "update:modelValue": [value: string];
    save: [content: string, encoding: string];
}>();

const languages = [
    { label: "自动检测", value: "auto" },
    { label: "Plain Text", value: "plaintext" },
    { label: "JavaScript", value: "javascript" },
    { label: "TypeScript", value: "typescript" },
    { label: "Vue", value: "vue" },
    { label: "Python", value: "python" },
    { label: "JSON", value: "json" },
    { label: "YAML", value: "yaml" },
    { label: "TOML", value: "toml" },
    { label: "HTML", value: "html" },
    { label: "XML", value: "xml" },
    { label: "CSS", value: "css" },
    { label: "SCSS", value: "scss" },
    { label: "Less", value: "less" },
    { label: "Markdown", value: "markdown" },
    { label: "SQL", value: "sql" },
    { label: "Shell", value: "shell" },
    { label: "Batch", value: "bat" },
    { label: "Dockerfile", value: "dockerfile" },
    { label: "Go", value: "go" },
    { label: "Rust", value: "rust" },
    { label: "Java", value: "java" },
    { label: "C", value: "c" },
    { label: "C++", value: "cpp" },
];

const detectLanguage = () => {
    if (props.language && props.language !== "auto") return props.language;

    const ext = props.path.split(".").pop()?.toLowerCase();
    const langMap: Record<string, string> = {
        bat: "bat",
        bash: "shell",
        c: "c",
        cpp: "cpp",
        cjs: "javascript",
        css: "css",
        dockerfile: "dockerfile",
        go: "go",
        h: "c",
        hpp: "cpp",
        htm: "html",
        html: "html",
        ini: "ini",
        java: "java",
        js: "javascript",
        json: "json",
        jsonc: "json",
        jsx: "javascript",
        less: "less",
        md: "markdown",
        markdown: "markdown",
        mjs: "javascript",
        py: "python",
        rs: "rust",
        scss: "scss",
        sh: "shell",
        sql: "sql",
        svg: "xml",
        toml: "toml",
        ts: "typescript",
        tsx: "typescript",
        vue: "vue",
        xml: "xml",
        yaml: "yaml",
        yml: "yaml",
    };

    return langMap[ext || ""] || "plaintext";
};

const textareaRef = ref<HTMLTextAreaElement | null>(null);
const content = ref(props.modelValue);
const initialValue = ref(props.modelValue);
const selectedLanguage = ref(detectLanguage());
const currentEOL = ref<"lf" | "crlf">("lf");
const wordWrap = ref(localStorage.getItem("zx-editor-wordwrap") !== "false");
const selectedEncoding = ref(
    ["utf-8", "gbk"].includes(props.encoding) ? props.encoding : "utf-8",
);

watch(
    () => props.encoding,
    (enc) => {
        if (["utf-8", "gbk"].includes(enc)) selectedEncoding.value = enc;
    },
);

const isDirty = computed(() => content.value !== initialValue.value);
const lineCount = computed(() => Math.max(content.value.split("\n").length, 1));
const currentEolLabel = computed(() =>
    currentEOL.value === "lf" ? "LF" : "CRLF",
);
const charCount = computed(() => content.value.length);
const languageLabel = computed(
    () =>
        languages.find((l) => l.value === selectedLanguage.value)?.label ||
        "Plain Text",
);
const encodingLabel = computed(() =>
    selectedEncoding.value === "gbk" ? "GBK" : "UTF-8",
);

// 光标位置（monaco / textarea 双引擎各自上报）
const cursorLine = ref(1);
const cursorCol = ref(1);

const setTextCursor = (pos: number) => {
    const before = content.value.slice(0, pos);
    const lines = before.split("\n");
    cursorLine.value = lines.length;
    cursorCol.value = (lines[lines.length - 1] || "").length + 1;
};

/** textarea 兜底引擎的光标上报 */
const onTextareaCursor = () => {
    const ta = textareaRef.value;
    if (ta) setTextCursor(ta.selectionStart);
};

const normalizeEOL = (value: string) =>
    currentEOL.value === "crlf"
        ? value.replace(/\r?\n/g, "\r\n")
        : value.replace(/\r\n/g, "\n");

const handleInput = () => {
    emit("update:modelValue", content.value);
};

const handleSave = () => {
    const raw = monacoEditor ? monacoEditor.getValue() : content.value;
    content.value = raw;
    emit("save", normalizeEOL(raw), selectedEncoding.value);
    initialValue.value = raw;
};

const handleReset = () => {
    if (!isDirty.value) return;
    content.value = initialValue.value;
    syncMonacoValue();
    emit("update:modelValue", content.value);
};

const changeEOL = () => {
    currentEOL.value = currentEOL.value === "lf" ? "crlf" : "lf";
};

const toggleWordWrap = () => {
    wordWrap.value = !wordWrap.value;
    localStorage.setItem("zx-editor-wordwrap", String(wordWrap.value));
};

const handleKeydown = (event: KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        handleSave();
        return;
    }

    if (event.key === "Tab") {
        event.preventDefault();
        insertAtCursor("    ");
    }
};

const insertAtCursor = (text: string) => {
    const textarea = textareaRef.value;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    content.value =
        content.value.slice(0, start) + text + content.value.slice(end);
    emit("update:modelValue", content.value);

    nextTick(() => {
        textarea.selectionStart = textarea.selectionEnd = start + text.length;
    });
};

const syncOverlayScroll = () => {
    const textarea = textareaRef.value;
    if (!textarea) return;

    const overlay = highlightRef.value;
    if (overlay) {
        overlay.scrollTop = textarea.scrollTop;
        overlay.scrollLeft = textarea.scrollLeft;
    }

    const gutter = textarea
        .closest(".editor-wrapper")
        ?.querySelector(".line-number-gutter") as HTMLElement | null;
    if (gutter) gutter.scrollTop = textarea.scrollTop;
};

// ==================== Monaco 引擎（CDN 优先，失败回退本地打包） ====================
const monacoHost = ref<HTMLElement | null>(null);
const monacoReady = ref(false);
let monacoInstance: typeof MonacoNamespace | null = null;
let monacoEditor: MonacoNamespace.editor.IStandaloneCodeEditor | null = null;
let applyingMonacoValue = false;

// 编辑器语言（含 shiki 命名）→ monaco 语言 id
const MONACO_LANG_MAP: Record<string, string> = {
    bat: "bat",
    c: "cpp",
    cpp: "cpp",
    cjs: "javascript",
    css: "css",
    docker: "dockerfile",
    dockerfile: "dockerfile",
    go: "go",
    h: "cpp",
    hpp: "cpp",
    htm: "html",
    html: "html",
    ini: "ini",
    java: "java",
    javascript: "javascript",
    json: "json",
    jsx: "javascript",
    less: "less",
    md: "markdown",
    markdown: "markdown",
    mjs: "javascript",
    plaintext: "plaintext",
    py: "python",
    python: "python",
    rs: "rust",
    rust: "rust",
    scss: "scss",
    sh: "shell",
    shell: "shell",
    shellscript: "shell",
    sql: "sql",
    svg: "xml",
    toml: "ini",
    ts: "typescript",
    tsx: "typescript",
    typescript: "typescript",
    vue: "html",
    xml: "xml",
    yaml: "yaml",
    yml: "yaml",
};

const monacoLang = computed(() => {
    const key =
        selectedLanguage.value === "auto"
            ? resolveShikiLang(props.path.split(".").pop()?.toLowerCase())
            : selectLangToShiki(selectedLanguage.value) ||
              selectedLanguage.value;
    return MONACO_LANG_MAP[key] || "plaintext";
});

// ==================== 专业编辑功能（monaco） ====================
const openFind = () => {
    monacoEditor?.getAction("actions.find")?.run();
};

const formatDocument = async () => {
    if (!monacoEditor) return;
    await monacoEditor.getAction("editor.action.formatDocument")?.run();
    // 格式化的变更通过 onDidChangeModelContent 自动同步回 content
};

const syncMonacoValue = () => {
    if (monacoEditor && monacoEditor.getValue() !== content.value) {
        applyingMonacoValue = true;
        monacoEditor.setValue(content.value);
        applyingMonacoValue = false;
    }
};

onMounted(async () => {
    try {
        monacoInstance = await loadMonaco();
        if (!monacoHost.value) return;
        defineZxThemes(monacoInstance);
        monacoEditor = monacoInstance.editor.create(monacoHost.value, {
            value: content.value,
            language: monacoLang.value,
            theme: zxThemeName(editorShikiTheme.value),
            "semanticHighlighting.enabled": true,
            bracketPairColorization: {
                enabled: true,
                independentColorPoolPerBracketType: true,
            },
            guides: {
                bracketPairs: true,
                bracketPairsHorizontal: true,
                highlightActiveBracketPair: true,
                indentation: true,
                highlightActiveIndentation: true,
            },
            automaticLayout: true,
            fontFamily: '"JetBrains Mono", "Cascadia Mono", Consolas, monospace',
            fontSize: props.fontSize,
            lineHeight: Math.round(props.fontSize * 1.55),
            fontLigatures: false,
            minimap: { enabled: false },
            wordWrap: wordWrap.value ? "on" : "off",
            scrollBeyondLastLine: false,
            tabSize: 4,
            cursorBlinking: "blink",
            cursorSmoothCaretAnimation: "off",
            renderLineHighlight: "none",
            smoothScrolling: true,
            padding: { top: 10, bottom: 10 },
            scrollbar: {
                vertical: "auto",
                horizontal: "auto",
                verticalScrollbarSize: 6,
                horizontalScrollbarSize: 6,
                arrowSize: 0,
                useShadows: false,
            },
        });
        monacoEditor.onDidChangeModelContent(() => {
            if (applyingMonacoValue) return;
            content.value = monacoEditor!.getValue();
            emit("update:modelValue", content.value);
        });
        monacoEditor.onDidChangeCursorPosition((e) => {
            cursorLine.value = e.position.lineNumber;
            cursorCol.value = e.position.column;
        });
        monacoEditor.addCommand(
            monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS,
            () => handleSave(),
        );
        monacoReady.value = true;
    } catch (e) {
        console.warn("Monaco 初始化失败，继续使用轻量编辑器", e);
    }
});

watch(monacoLang, (lang) => {
    const model = monacoEditor?.getModel();
    if (model && monacoInstance) {
        monacoInstance.editor.setModelLanguage(model, lang);
    }
});

watch(wordWrap, (wrap) => {
    monacoEditor?.updateOptions({ wordWrap: wrap ? "on" : "off" });
});

watch(currentEOL, (eol) => {
    const model = monacoEditor?.getModel();
    if (!model) return;
    // EndOfLineSequence：LF=1, CRLF=2（monaco 0.56 未从 editor.api 顶层导出）
    model.setEOL((eol === "crlf" ? 2 : 1) as MonacoNamespace.editor.EndOfLineSequence);
});

watch(
    () => props.readonly,
    (readonly) => {
        monacoEditor?.updateOptions({ readOnly: readonly });
    },
);

// ==================== 语法高亮（shiki 按需加载，主题跟随应用深浅色） ====================
const themeStore = useThemeStore();
const editorShikiTheme = computed(() =>
    themeStore.effectiveMode === "dark" ? "dark" : "light",
);
const highlightRef = ref<HTMLElement | null>(null);
const highlightHtml = ref("");

const shikiLang = computed(() => {
    if (selectedLanguage.value === "auto") {
        return resolveShikiLang(props.path.split(".").pop()?.toLowerCase());
    }
    return selectLangToShiki(selectedLanguage.value);
});

let highlightTimer: number | undefined;
let highlightSeq = 0;

const requestHighlight = () => {
    if (monacoReady.value) return; // monaco 引擎接管后垫层不再需要
    window.clearTimeout(highlightTimer);
    const seq = ++highlightSeq;
    highlightTimer = window.setTimeout(async () => {
        try {
            const html = await highlightCode(
                content.value,
                shikiLang.value,
                editorShikiTheme.value,
            );
            if (seq !== highlightSeq) return;
            highlightHtml.value = html;
            nextTick(syncOverlayScroll);
        } catch {
            if (seq === highlightSeq) highlightHtml.value = "";
        }
    }, 250);
};

watch([content, shikiLang, editorShikiTheme], requestHighlight, {
    immediate: true,
});

// 应用深浅切换时同步 monaco 主题（颜色值从主题变量重读）
watch(editorShikiTheme, () => {
    if (!monacoInstance || !monacoEditor) return;
    defineZxThemes(monacoInstance);
    monacoInstance.editor.setTheme(zxThemeName(editorShikiTheme.value));
});

// ==================== Markdown 预览与模式 ====================
const isMarkdown = computed(() => {
    if (selectedLanguage.value === "markdown") return true;
    if (selectedLanguage.value === "auto" && props.path) {
        const ext = props.path.split(".").pop()?.toLowerCase();
        return ext === "md" || ext === "markdown";
    }
    return false;
});

export type MarkdownViewMode = "edit" | "split" | "preview";
const mdMode = ref<MarkdownViewMode>("edit");
const isPreviewing = computed(() => mdMode.value === "preview");

const setMdMode = (mode: MarkdownViewMode) => {
    mdMode.value = mode;
    nextTick(() => {
        monacoEditor?.layout();
    });
};

// ==================== Markdown 分屏宽度拖拽 ====================
const editorSplitRef = ref<HTMLElement | null>(null);
const previewRatio = ref(
    Math.max(20, Math.min(80, Number(localStorage.getItem("zx-editor-preview-ratio")) || 50)),
);
const isDraggingPreview = ref(false);
let cleanupPreviewDrag: (() => void) | null = null;

const resetPreviewRatio = () => {
    previewRatio.value = 50;
    localStorage.setItem("zx-editor-preview-ratio", "50");
    nextTick(() => {
        monacoEditor?.layout();
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
            monacoEditor?.layout();
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
        localStorage.setItem("zx-editor-preview-ratio", String(previewRatio.value));
        nextTick(() => {
            monacoEditor?.layout();
        });
    };

    cleanupPreviewDrag = () => {
        isDraggingPreview.value = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerUp);
        if (rafId) cancelAnimationFrame(rafId);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
};

// 文件切换时回到编辑视图
watch(
    () => props.path,
    () => {
        mdMode.value = "edit";
    },
);

onBeforeUnmount(() => {
    cleanupPreviewDrag?.();
    window.clearTimeout(highlightTimer);
    monacoEditor?.getModel()?.dispose();
    monacoEditor?.dispose();
    monacoEditor = null;
});

watch(
    () => props.modelValue,
    (newValue) => {
        if (newValue === content.value) return;
        content.value = newValue || "";
        initialValue.value = newValue || "";
        syncMonacoValue();
    },
);

watch(
    () => [props.language, props.path],
    () => {
        selectedLanguage.value = detectLanguage();
    },
);

watch(
    () => props.fontSize,
    (newSize) => {
        if (!monacoEditor) return;
        monacoEditor.updateOptions({
            fontSize: newSize,
            lineHeight: Math.round(newSize * 1.55),
        });
    },
);

defineExpose({
    getContent: () => content.value,
    setValue: (value: string) => {
        content.value = value;
        initialValue.value = value;
        emit("update:modelValue", value);
    },
    getEditor: () => textareaRef.value,
});
</script>

<style scoped>
.zx-editor-container {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-radius: 0.5rem;
    background-color: var(--zx-color-surface);
}

.editor-toolbar {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    overflow-x: auto;
    border-bottom: 1px solid var(--zx-color-border);
    background-color: var(--zx-color-surface-muted);
    padding: 0.5rem 0.75rem;
}

.toolbar-left,
.toolbar-right {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 0.375rem;
}

.toolbar-select,
.toolbar-chip {
    display: inline-flex;
    height: 2rem;
    align-items: center;
    gap: 0.25rem;
    border: 1px solid transparent;
    border-radius: 9999px;
    background-color: var(--zx-color-surface);
    padding: 0 0.625rem;
    color: var(--zx-color-text-muted);
    font-size: 0.75rem;
    line-height: 1;
    white-space: nowrap;
    cursor: pointer;
    transition:
        background-color 0.15s,
        border-color 0.15s;
}

.toolbar-select {
    cursor: pointer;
    appearance: none;
}

.toolbar-select:hover,
.toolbar-chip:hover {
    border-color: var(--zx-color-border);
    color: var(--zx-color-text-strong);
}

.toolbar-select:disabled {
    cursor: not-allowed;
    opacity: 0.5;
}

.icon {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
}

/* 编辑 / 预览 分段切换 */
.preview-segmented {
    display: inline-flex;
    align-items: center;
    gap: 0.125rem;
    border-radius: 1rem;
    background-color: var(--zx-gray-100);
    padding: 0.25rem;
}

.preview-segmented button {
    display: inline-flex;
    height: 1.75rem;
    width: 1.75rem;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: 9999px;
    background: transparent;
    padding: 0;
    color: var(--zx-color-text-muted);
    font-size: 0.75rem;
    line-height: 1;
    cursor: pointer;
    transition:
        background-color 0.15s,
        color 0.15s;
}

.preview-segmented button:hover {
    color: var(--zx-color-text-strong);
}

.preview-segmented .segmented-active {
    background-color: var(--zx-color-surface);
    color: var(--zx-color-primary);
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.06);
}

.editor-wrapper {
    position: relative;
    display: grid;
    min-height: 250px;
    flex: 1;
    grid-template-columns: auto minmax(0, 1fr);
    overflow: hidden;
}

.editor-statusbar {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 1rem;
    border-top: 1px solid var(--zx-color-border);
    background-color: var(--zx-color-surface-muted);
    padding: 0.25rem 1rem;
    color: var(--zx-color-text-subtle);
    font-size: 0.6875rem;
    line-height: 1.4rem;
    user-select: none;
}

/* 预览态：单列布局（md-preview 视图在 MarkdownPreview 子组件内） */
.editor-wrapper:has(> .md-preview) {
    grid-template-columns: minmax(0, 1fr);
    overflow-y: auto;
}

.editor-wrapper.is-monaco {
    grid-template-columns: minmax(0, 1fr);
}

.monaco-host {
    min-width: 0;
    min-height: 0;
}

.editor-content-host {
    position: relative;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
}

/* 高亮层垫在 textarea 下面，字体度量必须与 textarea 完全一致 */
.editor-highlight {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
    padding: 0.75rem 1rem;
    color: var(--zx-color-text-strong);
    font-family: "JetBrains Mono", "Cascadia Mono", Consolas, monospace;
    font-size: 0.875rem;
    line-height: 1.55rem;
    tab-size: 4;
    user-select: none;
}

.editor-highlight :deep(pre) {
    margin: 0;
    padding: 0;
    background: transparent !important;
    font: inherit;
    tab-size: 4;
    white-space: pre;
}

.editor-highlight.is-wrap :deep(pre) {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
}

.editor-highlight :deep(code) {
    display: block;
    font: inherit;
    tab-size: 4;
}

.line-number-gutter {
    min-width: 3.5rem;
    overflow: hidden;
    border-right: 1px solid var(--zx-color-border);
    background-color: var(--zx-color-surface-muted);
    padding: 0.75rem 0.75rem 0.75rem 0.5rem;
    color: var(--zx-color-text-subtle);
    font-family: "JetBrains Mono", "Cascadia Mono", Consolas, monospace;
    font-size: 0.875rem;
    line-height: 1.55rem;
    text-align: right;
    user-select: none;
}

.line-number-gutter span {
    display: block;
}

.editor-textarea {
    width: 100%;
    height: 100%;
    resize: none;
    overflow: auto;
    border: 0;
    background-color: var(--zx-color-surface);
    padding: 0.75rem 1rem;
    color: var(--zx-color-text-strong);
    font-family: "JetBrains Mono", "Cascadia Mono", Consolas, monospace;
    font-size: 0.875rem;
    line-height: 1.55rem;
    outline: none;
    tab-size: 4;
}

.editor-textarea:not(.whitespace-pre) {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
}

/* 高亮开启时 textarea 文字透明、只留光标 */
.editor-textarea.has-highlight {
    color: transparent;
    caret-color: var(--zx-color-text-strong);
}

.loading-overlay {
    position: absolute;
    inset: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: color-mix(in srgb, var(--zx-color-surface) 82%, transparent);
}

.loading-content {
    text-align: center;
}

.loading-icon {
    margin: 0 auto;
    width: 2.5rem;
    height: 2.5rem;
    color: var(--zx-color-primary);
    animation: spin 1s linear infinite;
}

.loading-content p {
    margin-top: 0.5rem;
    color: var(--zx-color-text-muted);
    font-size: 0.875rem;
}

@media (min-width: 640px) {
    .editor-toolbar {
        padding: 0.5rem 1rem;
    }

    .toolbar-left,
    .toolbar-right {
        gap: 0.5rem;
    }

    .toolbar-select,
    .toolbar-chip {
        padding: 0 0.75rem;
        font-size: 0.8125rem;
    }

    .editor-wrapper {
        min-height: 400px;
    }
}

@keyframes spin {
    from {
        transform: rotate(0deg);
    }
    to {
        transform: rotate(360deg);
    }
}
</style>
