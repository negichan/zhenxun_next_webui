<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import {
    Check,
    ChevronRight,
    Database,
    Search,
    Table2,
} from "lucide-vue-next";
import { ZXSelect, type ZXSelectOption } from "@/components/zxcomponent/ZXSelect";
import { zxDDPop } from "@/composables/useGsapTransition";
import { scrollElementInContainer } from "@/composables/scrollInView";
import { LANGUAGE_OPTIONS } from "../useWorkbench";
import type { Workbench } from "../useWorkbench";
import { getFileIcon, getLanguageIcon, getLanguageBadge } from "../fileIcons";

const props = defineProps<{
    wb: Workbench;
}>();

const activeTab = computed(() => props.wb.activeTab.value);

/** 数据库表 / SQL 标签：底部状态栏切换为表编辑语境 */
const isTableTab = computed(() => {
    const t = activeTab.value;
    return !!t && (t.kind === "table" || t.viewMode === "table");
});
const isSqlTab = computed(() => {
    const t = activeTab.value;
    return !!t && t.kind === "sql";
});
const isDbTab = computed(() => isTableTab.value || isSqlTab.value);

const dbTableName = computed(() => {
    const t = activeTab.value;
    if (!t) return "";
    return (
        t.tableName ||
        t.name.replace(/^表\s*·\s*/, "") ||
        t.path.replace(/^db:\/\/table\//, "")
    );
});

/**
 * 状态栏路径：锚定工作区根（根名 + 相对目录链，不含文件名本身），
 * 目录链过长时中段以 … 收缩；容器是 flex-row-reverse（文件名固定最右），
 * 数组首元素紧贴文件名，故按「由内到外」倒序输出。
 */
const pathSegments = computed(() => {
    const tab = activeTab.value;
    if (!tab) return [];
    const path = (tab.path || "").replace(/\\/g, "/");
    const root = (props.wb.rootPath.value || "").replace(/\/+$/, "");
    let dirs: string[];
    if (root && path.startsWith(`${root}/`)) {
        dirs = [
            root.split("/").pop() || root,
            ...path.slice(root.length + 1).split("/").slice(0, -1),
        ];
    } else {
        // 根路径未就绪或文件在工作区外：退化为绝对目录链
        dirs = path.split("/").filter(Boolean).slice(0, -1);
    }
    dirs = dirs.filter(Boolean);
    if (dirs.length > 4) dirs = [dirs[0], "…", ...dirs.slice(-2)];
    return [...dirs].reverse();
});

const encodingLabel = computed(() =>
    activeTab.value?.encoding === "gbk" ? "GBK" : "UTF-8",
);

const eolLabel = computed(() =>
    activeTab.value?.eol === "crlf" ? "CRLF" : "LF",
);

const encodingOptions: ZXSelectOption[] = [
    { label: "UTF-8", value: "utf-8" },
    { label: "GBK", value: "gbk" },
];

const eolOptions: ZXSelectOption[] = [
    { label: "LF", value: "lf" },
    { label: "CRLF", value: "crlf" },
];

const tabSizeOptions: ZXSelectOption[] = [
    { label: "2 个空格", value: "2" },
    { label: "4 个空格", value: "4" },
    { label: "8 个空格", value: "8" },
];

const currentLanguageLabel = computed(() => {
    const lang = activeTab.value?.language;
    if (!lang) return "Plain Text";
    const found = LANGUAGE_OPTIONS.find((l) => l.value === lang);
    return found ? found.label : lang;
});

// ==================== 语言选择下拉浮层（在按钮附近弹出 + 顶部搜索 + 图标/语言/全称） ====================
const isLangOpen = ref(false);
const langSearchQuery = ref("");
const langHighlightIndex = ref(0);
const langTriggerRef = ref<HTMLButtonElement | null>(null);
const langPanelRef = ref<HTMLElement | null>(null);
const langListRef = ref<HTMLElement | null>(null);
const langSearchInputRef = ref<HTMLInputElement | null>(null);
const langPos = ref({ x: 0, y: 0 });
let openTriggerTop = 0;

const filteredLanguages = computed(() => {
    const q = langSearchQuery.value.trim().toLowerCase();
    if (!q) return LANGUAGE_OPTIONS;
    return LANGUAGE_OPTIONS.filter(
        (l) =>
            l.label.toLowerCase().includes(q) ||
            l.value.toLowerCase().includes(q) ||
            l.fullName.toLowerCase().includes(q),
    );
});

const scrollHighlightIntoView = () => {
    nextTick(() => {
        if (!langListRef.value) return;
        const items = langListRef.value.querySelectorAll<HTMLElement>("[data-lang-item]");
        const target = items[langHighlightIndex.value];
        scrollElementInContainer(langListRef.value, target ?? null);
    });
};

const moveHighlight = (step: number) => {
    const list = filteredLanguages.value;
    if (!list.length) return;
    const len = list.length;
    langHighlightIndex.value = (langHighlightIndex.value + step + len) % len;
    scrollHighlightIntoView();
};

const confirmHighlight = () => {
    const list = filteredLanguages.value;
    if (!list.length) return;
    const index = Math.max(0, Math.min(langHighlightIndex.value, list.length - 1));
    const target = list[index];
    if (target) {
        onSelectLanguage(target.value);
    }
};

const updateLangPos = () => {
    if (!langTriggerRef.value) return;
    const r = langTriggerRef.value.getBoundingClientRect();
    const w = langPanelRef.value?.offsetWidth || 320;
    const h = langPanelRef.value?.offsetHeight || 320;
    let x = r.right - w;
    if (x < 8) x = Math.max(8, r.left);
    if (x + w > window.innerWidth - 8) {
        x = window.innerWidth - w - 8;
    }
    let y = r.top - h - 6;
    if (y < 8) {
        y = Math.max(8, r.bottom + 6);
    }
    langPos.value = { x, y };
};

const toggleLangDropdown = () => {
    isLangOpen.value = !isLangOpen.value;
};

const onSelectLanguage = (value: string) => {
    props.wb.setLanguage(value);
    isLangOpen.value = false;
    langTriggerRef.value?.blur();
};

const onPointerDown = (e: PointerEvent) => {
    if (!isLangOpen.value) return;
    const target = e.target as Node;
    if (
        langTriggerRef.value?.contains(target) ||
        langPanelRef.value?.contains(target)
    ) {
        return;
    }
    isLangOpen.value = false;
};

const onKeydown = (e: KeyboardEvent) => {
    if (!isLangOpen.value) return;
    if (e.isComposing || e.keyCode === 229) return;

    if (e.key === "Escape") {
        e.preventDefault();
        isLangOpen.value = false;
        langTriggerRef.value?.blur();
        return;
    }

    if (e.key === "ArrowDown") {
        e.preventDefault();
        moveHighlight(1);
    } else if (e.key === "ArrowUp") {
        e.preventDefault();
        moveHighlight(-1);
    } else if (e.key === "ArrowRight") {
        const input = langSearchInputRef.value;
        if (
            document.activeElement !== input ||
            !langSearchQuery.value ||
            (input &&
                input.selectionStart === input.selectionEnd &&
                input.selectionStart === langSearchQuery.value.length)
        ) {
            e.preventDefault();
            moveHighlight(1);
        }
    } else if (e.key === "ArrowLeft") {
        const input = langSearchInputRef.value;
        if (
            document.activeElement !== input ||
            !langSearchQuery.value ||
            (input &&
                input.selectionStart === input.selectionEnd &&
                input.selectionStart === 0)
        ) {
            e.preventDefault();
            moveHighlight(-1);
        }
    } else if (e.key === "Enter") {
        e.preventDefault();
        confirmHighlight();
    }
};

const onScrollDismiss = () => {
    if (!isLangOpen.value) return;
    const top = langTriggerRef.value?.getBoundingClientRect().top ?? 0;
    if (Math.abs(top - openTriggerTop) > 24) {
        isLangOpen.value = false;
    }
};

const onDismiss = () => {
    if (isLangOpen.value) isLangOpen.value = false;
};

watch(langSearchQuery, () => {
    langHighlightIndex.value = 0;
    nextTick(() => {
        if (langListRef.value) {
            langListRef.value.scrollTop = 0;
        }
    });
});

watch(isLangOpen, (open) => {
    if (open) {
        langSearchQuery.value = "";
        const currentLang = activeTab.value?.language;
        const foundIdx = LANGUAGE_OPTIONS.findIndex((l) => l.value === currentLang);
        langHighlightIndex.value = foundIdx >= 0 ? foundIdx : 0;
        nextTick(() => {
            updateLangPos();
            openTriggerTop =
                langTriggerRef.value?.getBoundingClientRect().top ?? 0;
            langSearchInputRef.value?.focus();
            scrollHighlightIntoView();
        });
    }
});

onMounted(() => {
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeydown);
    window.addEventListener("scroll", onScrollDismiss, true);
    window.addEventListener("resize", onDismiss);
});

onUnmounted(() => {
    window.removeEventListener("pointerdown", onPointerDown, true);
    window.removeEventListener("keydown", onKeydown);
    window.removeEventListener("scroll", onScrollDismiss, true);
    window.removeEventListener("resize", onDismiss);
});
</script>

<template>
    <div
        class="flex h-6 flex-shrink-0 select-none items-stretch justify-between border-t border-slate-200 bg-slate-100/80 text-[11px] text-zx-text-muted"
    >
        <!-- 左侧：当前文件路径（WebStorm 式，左端截断保住文件名） -->
        <div class="flex min-w-0 items-stretch">
            <template v-if="activeTab && isTableTab">
                <span
                    class="flex min-w-0 items-center gap-1.5 px-2 text-zx-text-muted"
                >
                    <Table2 class="h-3 w-3 flex-shrink-0 text-zx-primary" />
                    <span class="flex-shrink-0 whitespace-nowrap">
                        表 · {{ dbTableName }}
                    </span>
                    <ChevronRight
                        class="h-3 w-3 flex-shrink-0 text-zx-text-subtle"
                    />
                    <Database
                        class="h-3 w-3 flex-shrink-0 text-zx-text-subtle"
                    />
                    <span class="truncate text-zx-text-subtle">
                        {{ activeTab.path }}
                    </span>
                </span>
            </template>
            <template v-else-if="activeTab && isSqlTab">
                <span
                    class="flex min-w-0 items-center gap-1.5 px-2 text-zx-text-muted"
                >
                    <Database class="h-3 w-3 flex-shrink-0 text-zx-primary" />
                    <span class="flex-shrink-0 whitespace-nowrap">
                        SQL · {{ activeTab.name }}
                    </span>
                    <span class="truncate text-zx-text-subtle">
                        {{ activeTab.path }}
                    </span>
                </span>
            </template>
            <template v-else-if="activeTab">
                <span class="flex min-w-0 items-center gap-1 px-2 text-zx-text-subtle">
                    <span class="flex min-w-0 flex-row-reverse items-center overflow-hidden">
                        <span class="flex-shrink-0 whitespace-nowrap text-zx-text-muted">{{
                            activeTab.name
                        }}</span>
                        <component
                            :is="getFileIcon(activeTab.name).icon"
                            class="mx-0.5 h-3 w-3 flex-shrink-0"
                            :class="getFileIcon(activeTab.name).class"
                        />
                        <template v-for="(seg, i) in pathSegments" :key="i">
                            <ChevronRight class="mx-0.5 h-3 w-3 flex-shrink-0 text-zx-text-subtle" />
                            <span class="truncate whitespace-nowrap">{{ seg }}</span>
                        </template>
                    </span>
                </span>
            </template>
            <span v-else class="flex items-center px-2 text-zx-text-subtle">就绪</span>
        </div>

        <!-- 右侧：数据库语境 / 光标·缩进·EOL·编码·语言 -->
        <div class="flex items-stretch">
            <template v-if="activeTab && isTableTab">
                <span class="flex items-center px-2 font-medium text-zx-primary">
                    表编辑器
                </span>
                <span
                    v-if="activeTab.missing"
                    class="flex items-center px-2 font-medium text-zx-danger"
                >
                    表不存在
                </span>
            </template>
            <template v-else-if="activeTab && isSqlTab">
                <span class="flex items-center px-2 font-medium text-zx-primary">
                    SQL
                </span>
                <span
                    class="flex items-center px-2 text-zx-text-subtle"
                >
                    {{ currentLanguageLabel }}
                </span>
                <span
                    v-if="activeTab.missing"
                    class="flex items-center px-2 font-medium text-zx-danger"
                >
                    源文件缺失
                </span>
            </template>
            <template v-else-if="activeTab && activeTab.viewMode !== 'text'">
                <span class="flex items-center px-2 font-medium text-zx-primary">
                    {{
                        activeTab.viewMode === "hex"
                            ? "Hex 只读"
                            : activeTab.viewMode === "archive"
                              ? "压缩包浏览"
                              : "图片预览"
                    }}
                </span>
                <span
                    v-if="activeTab.bytesB64"
                    class="flex items-center px-2 text-zx-text-subtle"
                >
                    {{ Math.ceil(activeTab.bytesB64.length * 0.75).toLocaleString() }} 字节
                </span>
            </template>
            <template v-else>
                <span class="flex items-center px-2">
                    行 {{ wb.cursorLine.value }}, 列 {{ wb.cursorCol.value }}
                </span>

                <template v-if="activeTab">
                    <ZXSelect
                        :model-value="String(wb.tabSize.value)"
                        :options="tabSizeOptions"
                        compact
                        trigger-class="hidden h-full cursor-pointer items-center px-2 text-[11px] text-zx-text-muted transition-colors hover:bg-black/10 hover:text-zx-text-strong focus:outline-none sm:flex"
                        @update:model-value="(v: string) => wb.setTabSize(Number(v))"
                    >
                        <template #trigger>
                            <span>空格: {{ wb.tabSize.value }}</span>
                        </template>
                    </ZXSelect>

                    <ZXSelect
                        :model-value="activeTab.eol"
                        :options="eolOptions"
                        compact
                        trigger-class="flex h-full cursor-pointer items-center px-2 text-[11px] text-zx-text-muted transition-colors hover:bg-black/10 hover:text-zx-text-strong focus:outline-none"
                        @update:model-value="(v: string) => wb.setEol(v === 'crlf' ? 'crlf' : 'lf')"
                    >
                        <template #trigger="{ label }">
                            <span>{{ label }}</span>
                        </template>
                    </ZXSelect>

                    <ZXSelect
                        :model-value="activeTab.encoding"
                        :options="encodingOptions"
                        compact
                        trigger-class="flex h-full cursor-pointer items-center px-2 text-[11px] text-zx-text-muted transition-colors hover:bg-black/10 hover:text-zx-text-strong focus:outline-none"
                        @update:model-value="(v: string) => wb.setEncoding(v === 'gbk' ? 'gbk' : 'utf-8')"
                    >
                        <template #trigger="{ label }">
                            <span>{{ label }}</span>
                        </template>
                    </ZXSelect>

                    <button
                        ref="langTriggerRef"
                        class="flex h-full cursor-pointer items-center gap-1.5 px-2 text-[11px] text-zx-text-muted transition-colors hover:bg-black/10 hover:text-zx-text-strong focus:outline-none"
                        :class="isLangOpen ? 'bg-black/10 text-zx-text-strong' : ''"
                        title="选择语言模式"
                        type="button"
                        @click="toggleLangDropdown"
                    >
                        <component
                            :is="getLanguageIcon(activeTab.language).icon"
                            class="h-3 w-3 flex-shrink-0"
                            :class="getLanguageIcon(activeTab.language).class"
                        />
                        <span>{{ currentLanguageLabel }}</span>
                    </button>
                </template>

                <span v-else class="flex items-center px-2 text-zx-text-subtle">
                    没有打开的文件
                </span>

                <span class="hidden items-center px-2 text-zx-text-subtle sm:flex">
                    {{ wb.contentText.value.length.toLocaleString() }} 字符
                </span>
            </template>
        </div>
    </div>

    <!-- 语言选择下拉浮层（在按钮附近弹出 + 顶部搜索 + 图标/语言/全称） -->
    <Teleport to="body">
        <Transition :css="false" @enter="zxDDPop.onEnter" @leave="zxDDPop.onLeave">
            <div
                v-if="isLangOpen"
                ref="langPanelRef"
                class="fixed z-9999 flex w-76 max-h-80 flex-col overflow-hidden rounded-xl border border-slate-200 bg-[var(--zx-color-surface-muted)] shadow-xl"
                :style="{ left: `${langPos.x}px`, top: `${langPos.y}px` }"
            >
                <!-- 顶部搜索框 -->
                <div class="border-b border-slate-100 p-1.5">
                    <div
                        class="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1 transition-colors focus-within:border-zx-primary"
                    >
                        <Search class="h-3 w-3 flex-shrink-0 text-zx-text-subtle" />
                        <input
                            ref="langSearchInputRef"
                            v-model="langSearchQuery"
                            class="w-full bg-transparent text-[11px] text-zx-text placeholder:text-zx-text-subtle focus:outline-none"
                            placeholder="搜索语言名称或扩展名…"
                            type="text"
                            @keydown.esc.stop="isLangOpen = false"
                        />
                    </div>
                </div>

                <!-- 语言选项列表 -->
                <div
                    ref="langListRef"
                    class="flex-1 overflow-y-auto overscroll-contain py-1"
                >
                    <button
                        v-for="(opt, i) in filteredLanguages"
                        :key="opt.value"
                        data-lang-item
                        type="button"
                        class="mx-1 flex w-[calc(100%-8px)] cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1 text-left transition-colors"
                        :class="[
                            i === langHighlightIndex
                                ? 'bg-zx-primary-soft text-zx-primary font-medium'
                                : opt.value === activeTab?.language
                                  ? 'bg-slate-100 text-zx-primary font-medium'
                                  : 'text-zx-text hover:bg-slate-100 hover:text-zx-text-strong',
                        ]"
                        @mouseenter="langHighlightIndex = i"
                        @click="onSelectLanguage(opt.value)"
                    >
                        <div class="flex min-w-0 items-center gap-2">
                            <component
                                :is="getLanguageIcon(opt.value).icon"
                                class="h-3.5 w-3.5 flex-shrink-0"
                                :class="getLanguageIcon(opt.value).class"
                            />
                            <div class="flex min-w-0 flex-col">
                                <span class="truncate text-[11px] font-medium leading-tight">{{
                                    opt.label
                                }}</span>
                                <span
                                    class="truncate text-[9.5px] text-zx-text-subtle leading-tight"
                                    >{{ opt.fullName }}</span
                                >
                            </div>
                        </div>
                        <div class="flex flex-shrink-0 items-center gap-1.5">
                            <span
                                v-if="getLanguageBadge(opt.value)"
                                class="rounded bg-slate-200/60 px-1 py-0.5 text-[9px] font-mono leading-none text-zx-text-subtle"
                            >
                                {{ getLanguageBadge(opt.value) }}
                            </span>
                            <Check
                                v-if="opt.value === activeTab?.language"
                                class="h-3 w-3 flex-shrink-0 text-zx-primary"
                            />
                        </div>
                    </button>
                    <div
                        v-if="!filteredLanguages.length"
                        class="px-4 py-4 text-center text-[11px] text-zx-text-subtle"
                    >
                        没有找到匹配的语言
                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>
