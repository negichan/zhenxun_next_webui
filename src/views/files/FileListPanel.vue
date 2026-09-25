<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
    Archive,
    ArchiveRestore,
    Check,
    ChevronDown,
    ChevronUp,
    ClipboardPaste,
    Copy,
    Download,
    Edit2,
    Package,
    Scissors,
    Trash2,
} from "lucide-vue-next";
import type { FileItem } from "@/types/api-next.types";
import { ZXContextMenu, menuSep } from "@/components/zxcomponent/ContextMenu";
import type { ZXContextMenuItem } from "@/components/zxcomponent/ContextMenu";
import { getFileIcon } from "@/components/FileEditorModal/fileIcons";
import FolderIcon from "@/components/zxcomponent/icons/FolderIcon.vue";

type SortField = "name" | "size" | "mtime";
type SortDir = "asc" | "desc";

const props = defineProps<{
    files: FileItem[];
    loading: boolean;
    isEmpty: boolean;
    searchQuery: string;
    selectedPaths: Set<string>;
    sortField: SortField;
    sortDir: SortDir;
    canPaste?: boolean;
}>();

const emit = defineEmits<{
    open: [file: FileItem];
    "toggle-select": [file: FileItem];
    "clear-selection": [];
    "enter-folder": [file: FileItem];
    rename: [file: FileItem];
    delete: [files: FileItem[]];
    download: [files: FileItem[]];
    "preview-archive": [file: FileItem];
    "extract-archive": [file: FileItem];
    compress: [files: FileItem[]];
    sort: [field: SortField];
    copy: [files: FileItem[]];
    cut: [files: FileItem[]];
    paste: [destDir?: string];
}>();

const scrollEl = ref<HTMLElement | null>(null);

const normPath = (p: string | undefined) =>
    String(p || "").replace(/\\/g, "/");

const isSelected = (file: FileItem) => {
    const p = normPath(file.path);
    return !!p && props.selectedPaths.has(p);
};

/** 选中/列表变化时尽量保住滚动位置 */
const lockScrollTop = () => {
    const el = scrollEl.value;
    if (!el) return;
    const top = el.scrollTop;
    void nextTick(() => {
        const node = scrollEl.value;
        if (!node) return;
        const max = Math.max(0, node.scrollHeight - node.clientHeight);
        node.scrollTop = Math.min(top, max);
    });
};

watch(() => props.selectedPaths, lockScrollTop);
watch(() => props.files, lockScrollTop);

onMounted(lockScrollTop);
onBeforeUnmount(() => {
    /* noop */
});

const formatFileSize = (bytes: number | undefined | null, isFile = true) => {
    if (!isFile) return "-";
    if (bytes === undefined || bytes === null) return "--";
    if (bytes === 0) return "0 B";

    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
};

const formatTime = (timestamp: string | number | undefined) => {
    if (timestamp === undefined) return "--";

    const date =
        typeof timestamp === "number"
            ? new Date(timestamp * 1000)
            : new Date(timestamp);

    return date.toLocaleString("zh-CN");
};

const getFileIconStyle = (file: FileItem) => {
    if (!file.is_file) {
        return "text-zx-primary";
    }

    if (!file.is_image) {
        return "text-zx-text-muted";
    }

    const ext = file.name.split(".").pop()?.toLowerCase();
    const colorMap: Record<string, string> = {
        jpg: "text-zx-text-muted",
        jpeg: "text-zx-text-muted",
        png: "text-zx-text-muted",
        gif: "text-zx-text-muted",
        svg: "text-zx-text-muted",
        webp: "text-zx-text-muted",
        bmp: "text-zx-text-muted",
        ico: "text-zx-text-muted",
    };

    return colorMap[ext || ""] || "text-zx-text-muted";
};

const ZIP_EXTS = ["zip", "jar", "apk", "whl", "epub"];
const TAR_SUFFIXES = [
    ".tar.gz",
    ".tgz",
    ".tar.bz2",
    ".tbz2",
    ".tar.xz",
    ".txz",
    ".tar",
];

const isArchive = (file: FileItem) => {
    if (!file.is_file) return false;
    const name = file.name.toLowerCase();
    return (
        TAR_SUFFIXES.some((s) => name.endsWith(s)) ||
        ZIP_EXTS.includes(name.split(".").pop() || "")
    );
};

const handleOpen = (file: FileItem) => {
    if (file.is_file) {
        emit("open", file);
        return;
    }

    emit("enter-folder", file);
};

/** 单击选中，双击打开 */
const onRowClick = (file: FileItem, e: MouseEvent) => {
    if (e.detail >= 2) {
        handleOpen(file);
        return;
    }
    emit("toggle-select", file);
};

const rowSelectedCls =
    "bg-zx-primary-soft/70 shadow-[inset_2px_0_0_0_var(--zx-color-primary)]";

const menuTargets = (file: FileItem): FileItem[] => {
    if (isSelected(file)) {
        return props.files.filter((f) => isSelected(f));
    }
    return [file];
};

const openFileMenu = (e: MouseEvent, file: FileItem) => {
    const targets = menuTargets(file);
    const batch = targets.length > 1;

    const items: ZXContextMenuItem[] = [];

    if (!batch) {
        items.push({
            label: file.is_file ? "打开文件" : "打开文件夹",
            icon: file.is_file ? getFileIcon(file.name).icon : FolderIcon,
            action: () => handleOpen(file),
        });
        items.push(menuSep());
    }

    items.push(
        {
            label: batch ? `复制选中项 (${targets.length})` : "复制",
            icon: Copy,
            action: () => emit("copy", targets),
        },
        {
            label: batch ? `剪切选中项 (${targets.length})` : "剪切",
            icon: Scissors,
            action: () => emit("cut", targets),
        },
        {
            label: "粘贴到此处",
            icon: ClipboardPaste,
            disabled: !props.canPaste,
            action: () =>
                emit("paste", file.is_file ? undefined : file.path),
        },
    );

    items.push(
        menuSep(),
        {
            label: batch ? `下载选中项 (${targets.length})` : "下载",
            icon: Download,
            action: () => emit("download", targets),
        },
    );

    if (!batch && isArchive(file)) {
        items.push(
            {
                label: "预览压缩包内容",
                icon: Archive,
                action: () => emit("preview-archive", file),
            },
            {
                label: "解压到新文件夹",
                icon: ArchiveRestore,
                action: () => emit("extract-archive", file),
            },
        );
    }

    items.push({
        label: batch ? "压缩选中项为 zip" : "压缩为 zip",
        icon: Package,
        action: () => emit("compress", targets),
    });

    if (!batch && file.is_file) {
        items.push({
            label: "重命名",
            icon: Edit2,
            action: () => emit("rename", file),
        });
    }

    items.push(
        menuSep(),
        {
            label: batch ? `删除选中项 (${targets.length})` : "删除",
            icon: Trash2,
            danger: true,
            action: () => emit("delete", targets),
        },
    );

    ZXContextMenu.show({
        x: e.clientX,
        y: e.clientY,
        items,
    });
};

const openEmptyMenu = (e: MouseEvent) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest("[data-file-row]") || target?.closest("input")) return;
    e.preventDefault();
    ZXContextMenu.show({
        x: e.clientX,
        y: e.clientY,
        items: [
            {
                label: "粘贴到此处",
                icon: ClipboardPaste,
                disabled: !props.canPaste,
                action: () => emit("paste"),
            },
            menuSep(),
            {
                label: "全选",
                icon: Check,
                disabled: !props.files.length,
                action: () => {
                    props.files.forEach((f) => {
                        if (!isSelected(f)) emit("toggle-select", f);
                    });
                },
            },
        ],
    });
};
</script>

<template>
    <div
        class="relative min-h-0 flex-1 overflow-hidden rounded-3xl border-1 border-slate-200 bg-white shadow-sm select-none"
    >
        <div
            v-if="loading && !files.length"
            class="absolute inset-0 z-10 flex items-center justify-center"
        >
            <div class="text-center text-zx-text-subtle">
                <FolderIcon class="mx-auto mb-4 h-12 w-12 animate-pulse" />
                <p>加载中...</p>
            </div>
        </div>

        <div
            v-else-if="isEmpty || !files.length"
            class="absolute inset-0 flex items-center justify-center"
            @contextmenu.prevent="openEmptyMenu"
        >
            <div class="text-center text-zx-text-subtle">
                <FolderIcon class="mx-auto mb-4 h-16 w-16 opacity-50" />
                <p>{{ loading ? "加载中..." : "此文件夹为空" }}</p>
                <p v-if="props.canPaste && !loading" class="mt-1 text-[11px]">
                    右键可粘贴到此处
                </p>
            </div>
        </div>

        <!-- 滚动区：absolute 撑满面板，不依赖 h-full 百分比 -->
        <div
            v-else
            ref="scrollEl"
            class="absolute inset-0 overflow-x-hidden overflow-y-auto px-2"
            style="overflow-anchor: none"
            @click.self="emit('clear-selection')"
            @contextmenu.self="openEmptyMenu"
        >
            <table class="w-full">
                <thead
                    class="sticky top-0 z-10 border-b-1 border-gray-200 bg-white"
                >
                    <tr>
                        <th class="w-10 pl-6 pr-0 pt-6 pb-4"></th>
                        <th
                            class="px-6 pt-6 pb-4 text-left text-xs font-medium tracking-wider text-zx-text-muted uppercase"
                        >
                            <span
                                class="inline-flex cursor-pointer items-center gap-1 select-none hover:text-zx-text"
                                @click="emit('sort', 'name')"
                            >
                                名称
                                <ChevronUp
                                    v-if="
                                        props.sortField === 'name' &&
                                        props.sortDir === 'asc'
                                    "
                                    class="h-3 w-3 text-zx-primary"
                                />
                                <ChevronDown
                                    v-else-if="
                                        props.sortField === 'name' &&
                                        props.sortDir === 'desc'
                                    "
                                    class="h-3 w-3 text-zx-primary"
                                />
                            </span>
                        </th>
                        <th
                            class="px-6 pt-6 pb-4 text-left text-xs font-medium tracking-wider text-zx-text-muted uppercase"
                        >
                            <span
                                class="inline-flex cursor-pointer items-center gap-1 select-none hover:text-zx-text"
                                @click="emit('sort', 'size')"
                            >
                                大小
                                <ChevronUp
                                    v-if="
                                        props.sortField === 'size' &&
                                        props.sortDir === 'asc'
                                    "
                                    class="h-3 w-3 text-zx-primary"
                                />
                                <ChevronDown
                                    v-else-if="
                                        props.sortField === 'size' &&
                                        props.sortDir === 'desc'
                                    "
                                    class="h-3 w-3 text-zx-primary"
                                />
                            </span>
                        </th>
                        <th
                            class="hidden px-6 pt-6 pb-4 text-left text-xs font-medium tracking-wider text-zx-text-muted uppercase md:table-cell"
                        >
                            <span
                                class="inline-flex cursor-pointer items-center gap-1 select-none hover:text-zx-text"
                                @click="emit('sort', 'mtime')"
                            >
                                修改时间
                                <ChevronUp
                                    v-if="
                                        props.sortField === 'mtime' &&
                                        props.sortDir === 'asc'
                                    "
                                    class="h-3 w-3 text-zx-primary"
                                />
                                <ChevronDown
                                    v-else-if="
                                        props.sortField === 'mtime' &&
                                        props.sortDir === 'desc'
                                    "
                                    class="h-3 w-3 text-zx-primary"
                                />
                            </span>
                        </th>
                        <th
                            class="px-6 pt-6 pb-4 text-right text-xs font-medium tracking-wider text-zx-text-muted uppercase"
                        >
                            操作
                        </th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                    <tr
                        v-for="file in files"
                        :key="file.path || file.name"
                        data-file-row
                        class="cursor-pointer transition-colors hover:bg-gray-50"
                        :class="isSelected(file) ? rowSelectedCls : ''"
                        @click="onRowClick(file, $event)"
                        @contextmenu.prevent="openFileMenu($event, file)"
                    >
                        <td class="pl-6 pr-0 py-2">
                            <label
                                class="flex h-6 w-6 cursor-pointer items-center justify-center"
                                title="选择"
                                @click.stop
                            >
                                <input
                                    type="checkbox"
                                    class="peer sr-only"
                                    :checked="isSelected(file)"
                                    @change="emit('toggle-select', file)"
                                />
                                <span
                                    class="flex h-4.5 w-4.5 items-center justify-center rounded-md border border-gray-300 bg-white transition-colors peer-checked:border-zx-primary peer-checked:bg-zx-primary peer-focus-visible:ring-2 peer-focus-visible:ring-zx-primary/40"
                                >
                                    <Check
                                        v-if="isSelected(file)"
                                        class="h-3 w-3 text-white"
                                    />
                                </span>
                            </label>
                        </td>
                        <td class="px-4 py-2">
                            <div class="ml-2 flex items-center gap-3">
                                <div
                                    :class="getFileIconStyle(file)"
                                    class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-2xl"
                                >
                                    <FolderIcon
                                        v-if="!file.is_file"
                                        class="h-5 w-5"
                                    />
                                    <component
                                        :is="getFileIcon(file.name).icon"
                                        v-else
                                        class="h-5 w-5"
                                        :class="getFileIcon(file.name).class"
                                    />
                                </div>
                                <span class="truncate text-sm text-zx-text">
                                    {{ file.name }}
                                </span>
                            </div>
                        </td>
                        <td class="px-4 py-2 text-sm text-zx-text-muted">
                            {{
                                file.size_formatted ||
                                formatFileSize(file.size, file.is_file)
                            }}
                        </td>
                        <td
                            class="hidden px-4 py-2 text-sm text-zx-text-muted md:table-cell"
                        >
                            {{ file.mtime_formatted || formatTime(file.mtime) }}
                        </td>
                        <td class="px-4 py-2">
                            <div
                                class="flex items-center justify-end gap-2"
                                @click.stop
                            >
                                <button
                                    v-if="file.is_file"
                                    class="btn-touch cursor-pointer rounded-2xl p-1.5 transition-colors hover:text-zx-primary"
                                    title="重命名"
                                    @click.stop="emit('rename', file)"
                                >
                                    <Edit2 class="h-4 w-4" />
                                </button>
                                <button
                                    class="btn-touch cursor-pointer rounded-2xl p-1.5 transition-colors hover:text-zx-danger"
                                    title="删除"
                                    @click.stop="emit('delete', [file])"
                                >
                                    <Trash2 class="h-4 w-4" />
                                </button>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>

            <!-- 窄屏卡片列表 -->
            <div class="divide-y divide-gray-100 md:hidden">
                <div
                    v-for="file in files"
                    :key="`m-${file.path || file.name}`"
                    data-file-row
                    class="p-3 transition-colors hover:bg-gray-50"
                    :class="isSelected(file) ? rowSelectedCls : ''"
                    @click="onRowClick(file, $event)"
                    @contextmenu.prevent="openFileMenu($event, file)"
                >
                    <div
                        class="flex items-start gap-3"
                        @click.stop="onRowClick(file, $event)"
                    >
                        <label
                            class="flex h-10 w-6 flex-shrink-0 cursor-pointer items-center justify-center"
                            title="选择"
                            @click.stop
                        >
                            <input
                                type="checkbox"
                                class="peer sr-only"
                                :checked="isSelected(file)"
                                @change="emit('toggle-select', file)"
                            />
                            <span
                                class="flex h-4.5 w-4.5 items-center justify-center rounded-md border border-gray-300 bg-white transition-colors peer-checked:border-zx-primary peer-checked:bg-zx-primary"
                            >
                                <Check
                                    v-if="isSelected(file)"
                                    class="h-3 w-3 text-white"
                                />
                            </span>
                        </label>
                        <div
                            :class="getFileIconStyle(file)"
                            class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl"
                        >
                            <FolderIcon
                                v-if="!file.is_file"
                                class="h-6 w-6"
                            />
                            <component
                                :is="getFileIcon(file.name).icon"
                                v-else
                                class="h-6 w-6"
                                :class="getFileIcon(file.name).class"
                            />
                        </div>
                        <div class="min-w-0 flex-1">
                            <div class="truncate text-sm text-zx-text">
                                {{ file.name }}
                            </div>
                            <div class="mt-0.5 text-xs text-zx-text-muted">
                                {{
                                    file.is_file
                                        ? file.size_formatted ||
                                          formatFileSize(file.size, true)
                                        : "文件夹"
                                }}
                                ·
                                {{
                                    file.mtime_formatted ||
                                    formatTime(file.mtime)
                                }}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
