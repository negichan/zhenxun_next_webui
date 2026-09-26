<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { storeToRefs } from "pinia";
import { fileApi } from "@/utils/api-next";
import type { FileItem } from "@/types/api-next.types";
import { ZXMessageBox, ZXNotification } from "@/services/ui";
import { useFilesStore } from "@/store/files";
import { pasteWithConflict } from "@/composables/usePasteConflict";
import FileBreadcrumbBar from "./FileBreadcrumbBar.vue";
import FileListPanel from "./FileListPanel.vue";
import { isArchiveFile } from "@/components/FileEditorModal/fileIcons";
import { openImageViewer } from "@/directives/imageViewer";
import NewItemDialog from "./NewItemDialog.vue";
import RenameDialog from "./RenameDialog.vue";

const FileEditorModal = defineAsyncComponent(
    () => import("@/components/FileEditorModal"),
);
const ArchivePreviewModal = defineAsyncComponent(
    () => import("./ArchivePreviewModal.vue"),
);

const fileStore = useFilesStore();

const { showNewDialog } = storeToRefs(fileStore);

const currentPath = ref("");
const pathSegments = ref<string[]>([]);
const fileList = ref<FileItem[]>([]);
const loading = ref(false);
const searchQuery = ref("");

// ==================== 列头排序 ====================
type SortField = "name" | "size" | "mtime";
type SortDir = "asc" | "desc";
const sortField = ref<SortField>(
    (localStorage.getItem("zx-files-sort-field") as SortField) || "name",
);
const sortDir = ref<SortDir>(
    (localStorage.getItem("zx-files-sort-dir") as SortDir) || "asc",
);

const onSort = (field: SortField) => {
    if (sortField.value === field) {
        sortDir.value = sortDir.value === "asc" ? "desc" : "asc";
    } else {
        sortField.value = field;
        sortDir.value = "asc";
    }
    localStorage.setItem("zx-files-sort-field", sortField.value);
    localStorage.setItem("zx-files-sort-dir", sortDir.value);
};

// ==================== 多选（复选框驱动） ====================
const selectedPaths = ref<Set<string>>(new Set());

/** 统一为正斜杠，避免 Windows 反斜杠导致选中对不上 */
const normalizePath = (p: string) =>
    String(p || "")
        .replace(/\\/g, "/")
        .replace(/\/{2,}/g, "/");

const clearSelection = () => {
    selectedPaths.value = new Set();
};

// 复选框切换：只增删该项
const toggleSelect = (file: FileItem) => {
    const path = normalizePath(resolveFilePath(file));
    if (!path) return;
    const next = new Set(selectedPaths.value);
    if (next.has(path)) {
        next.delete(path);
    } else {
        next.add(path);
    }
    selectedPaths.value = next;
};

const selectAll = () => {
    selectedPaths.value = new Set(
        sortedFileList.value
            .map((f) => normalizePath(resolveFilePath(f)))
            .filter(Boolean),
    );
};

/** 当前选中的文件对象（地址栏批量操作用） */
const getSelectedFiles = () =>
    sortedFileList.value.filter((f) =>
        selectedPaths.value.has(normalizePath(resolveFilePath(f))),
    );

const hasAnyModalOpen = () =>
    showEditor.value ||
    showNewDialog.value ||
    showRenameDialog.value ||
    showArchivePreview.value;

const handleKeydown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest("input, textarea, select, [contenteditable]")) return;
    if (hasAnyModalOpen()) return;

    // 有文本选区时放行系统复制/剪切，避免抢走 Ctrl+C/X
    const selection = String(window.getSelection() ?? "").trim();
    if (selection) return;

    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === "a") {
        e.preventDefault();
        selectAll();
    } else if (mod && e.key.toLowerCase() === "c") {
        e.preventDefault();
        copyFiles(getSelectedFiles());
    } else if (mod && e.key.toLowerCase() === "x") {
        e.preventDefault();
        cutFiles(getSelectedFiles());
    } else if (mod && e.key.toLowerCase() === "v") {
        e.preventDefault();
        void pasteFiles();
    } else if (e.key === "Escape") {
        clearSelection();
    }
};

const resolveFilePath = (file: FileItem) =>
    file.path ||
    (currentPath.value
        ? `${currentPath.value}/${file.name}`
        : file.name || "");

// ==================== 复制 / 剪切 / 粘贴 / 复制地址 ====================
type ClipItem = { path: string; name: string; isFile: boolean };
type ClipState = { mode: "copy" | "cut"; items: ClipItem[] };
const clipboard = ref<ClipState | null>(null);
/** 工作区根（面包屑最外层），预留相对路径计算 */
const workspaceRoot = ref("");

const notifyOk = (title: string, message: string) => {
    ZXNotification({
        title,
        message,
        type: "success",
        position: "top-right",
    });
};

const toClipItems = (files: FileItem[]): ClipItem[] =>
    files
        .map((f) => ({
            path: resolveFilePath(f),
            name: f.name,
            isFile: f.is_file,
        }))
        .filter((x) => !!x.path);

const copyFiles = (files: FileItem[]) => {
    const items = toClipItems(files);
    if (!items.length) return;
    clipboard.value = { mode: "copy", items };
    notifyOk(
        "已复制",
        items.length === 1
            ? `${items[0].name}`
            : `${items.length} 项（粘贴到当前目录）`,
    );
};

const cutFiles = (files: FileItem[]) => {
    const items = toClipItems(files);
    if (!items.length) return;
    clipboard.value = { mode: "cut", items };
    notifyOk(
        "已剪切",
        items.length === 1
            ? `${items[0].name}`
            : `${items.length} 项（粘贴到当前目录）`,
    );
};

const onPasteTo = (dest?: string) => {
    void pasteFiles(dest);
};

const canPaste = () => !!clipboard.value?.items.length;

/** destDir 省略 = 当前目录；右键文件夹时粘贴进该文件夹；同名弹窗询问 */
const pasteFiles = async (destDir?: string) => {
    const clip = clipboard.value;
    if (!clip?.items.length) return;
    const dest = destDir || currentPath.value || "";

    const result = await pasteWithConflict({
        items: clip.items,
        mode: clip.mode,
        destDir: dest,
    });

    if (result.cancelled) {
        notifyOk("已取消粘贴", "未修改目标目录");
        return;
    }

    if (clip.mode === "cut" && result.ok > 0) clipboard.value = null;

    if (result.ok > 0) {
        notifyOk(
            clip.mode === "copy" ? "粘贴成功" : "移动成功",
            result.failed
                ? `成功 ${result.ok} 项，失败/跳过 ${result.failed} 项`
                : `${result.ok} 项已放入目标目录`,
        );
    } else if (result.failed > 0) {
        ZXNotification({
            title: "粘贴失败",
            message: "没有项目被粘贴 (´；ω；`)，后端需支持 /file/copy 与 /file/move",
            type: "error",
            position: "top-right",
        });
    }

    await loadFileList(currentPath.value);

    if (result.createdNames.length) {
        const next = new Set<string>();
        for (const f of fileList.value) {
            if (result.createdNames.includes(f.name)) {
                next.add(normalizePath(resolveFilePath(f)));
            }
        }
        selectedPaths.value = next;
    }
};

const absolutePathOf = (file: FileItem) => resolveFilePath(file);

const relativePathOf = (file: FileItem) => {
    const full = resolveFilePath(file).replace(/\\/g, "/");
    const root = workspaceRoot.value.replace(/\\/g, "/").replace(/\/+$/, "");
    if (!root) return full;
    if (full === root) return ".";
    if (full.startsWith(`${root}/`)) return full.slice(root.length + 1);
    return full;
};

const copyPathText = async (text: string, kind: string) => {
    try {
        await navigator.clipboard?.writeText(text);
        notifyOk(`已复制${kind}`, text);
    } catch {
        ZXNotification({
            title: "复制地址失败",
            message: "剪贴板不可用 (´；ω；`)",
            type: "error",
            position: "top-right",
        });
    }
};

// ==================== 编辑器 / 图片预览 ====================
const showEditor = ref(false);
const editorInitialFile = ref<{
    path: string;
    name: string;
    content?: string;
} | null>(null);
/** 打开编辑器时的侧栏面板；null = 默认文件树 */
const editorInitialPanel = ref<"explorer" | "search" | "database" | null>(null);

const newItemType = ref<"file" | "folder">("file");
const newItemName = ref("");

const showRenameDialog = ref(false);
const renamingFile = ref<FileItem | null>(null);
const newName = ref("");

// ==================== 压缩包预览 ====================
const showArchivePreview = ref(false);
const archivePreviewTarget = ref<{ path: string; name: string } | null>(null);

const loadFileList = async (path = "") => {
    loading.value = true;

    try {
        const res = await fileApi.getFileList(path || undefined);

        if (res?.success && res?.data) {
            const raw = res.data.files || [];
            // 过滤无效项；补齐 name/path，路径统一正斜杠
            fileList.value = raw
                .filter((f) => f && (f.name || f.path))
                .map((f) => {
                    const path = normalizePath(
                        f.path ||
                            (res.data?.current_path
                                ? `${res.data.current_path}/${f.name}`
                                : f.name || ""),
                    );
                    const name =
                        f.name ||
                        path.split("/").filter(Boolean).pop() ||
                        "";
                    return { ...f, name, path };
                })
                .filter((f) => !!f.name);
            pathSegments.value = res.data.path_segments || [];
            currentPath.value = normalizePath(
                res.data.current_path || path,
            );
            if (!res.data.path_segments?.length) {
                workspaceRoot.value = currentPath.value;
            }
            clearSelection();
        } else {
            ZXNotification({
                title: "加载失败",
                message: res?.message || "文件列表加载失败了 (っ °Д °;) っ",
                type: "error",
                position: "top-right",
            });
        }
    } catch (error) {
        ZXNotification({
            title: "呜呼～",
            message: "文件列表加载失败了 (っ °Д °;) っ",
            type: "error",
            position: "top-right",
        });
    } finally {
        loading.value = false;
    }
};

const enterFolder = (folder: FileItem) => {
    if (!folder.is_file) {
        loadFileList(resolveFilePath(folder));
    }
};

const goBack = () => {
    if (pathSegments.value.length > 0) {
        loadFileList(pathSegments.value.slice(0, -1).join("/"));
        return;
    }

    if (currentPath.value) {
        loadFileList("");
    }
};

const handleDelete = async (files: FileItem[]) => {
    if (files.length === 0) return;

    const message =
        files.length === 1
            ? `确定要删除 "${files[0].name}" 吗？此操作不可恢复！`
            : `确定要删除选中的 ${files.length} 项吗？此操作不可恢复！`;

    ZXMessageBox({
        title: files.length === 1 ? (files[0].is_file ? "删除文件" : "删除文件夹") : "批量删除",
        message,
        cancelButtonText: "取消",
        confirmButtonText: "删除",
        type: "error",
        onConfirm: async () => {
            let failed = 0;
            for (const file of files) {
                try {
                    const fullPath = resolveFilePath(file);
                    const res = file.is_file
                        ? await fileApi.deleteFile(fullPath)
                        : await fileApi.deleteFolder(fullPath);
                    if (!res?.success) failed++;
                } catch {
                    failed++;
                }
            }

            if (failed === 0) {
                ZXNotification({
                    title: "删除成功～",
                    message:
                        files.length === 1
                            ? `"${files[0].name}" 已经删除成功啦！`
                            : `${files.length} 项已经全部删除啦！`,
                    type: "info",
                    position: "top-right",
                });
            } else {
                ZXNotification({
                    title: "删除失败",
                    message: `有 ${failed} 项删除失败了 (´；ω；\`)`,
                    type: "error",
                    position: "top-right",
                });
            }
            loadFileList(currentPath.value);
        },
    });
};

const openEditor = async (file: FileItem) => {
    if (!file.is_file) return;

    const fullPath = resolveFilePath(file);

    if (file.is_image) {
        try {
            const res = await fileApi.readFile(fullPath, {
                skipInterceptor: true,
                as_image: true,
            });

            if (res?.success && res?.data && res.data.content) {
                // 复用聊天界面的全局图片查看器（缩放/旋转/左右翻页）
                openImageViewer([res.data.content]);
            }
        } catch (error) {
            ZXNotification({
                title: "加载失败",
                message: "图片加载失败了 (´；ω；`)",
                type: "error",
                position: "top-right",
            });
        }

        return;
    }

    // 压缩包走独立的预览页（不进文件编辑器）
    if (isArchiveFile(file.name)) {
        handlePreviewArchive(file);
        return;
    }

    // 内容与编码由编辑器弹窗自行读取（需要探测编码）
    editorInitialPanel.value = "explorer";
    editorInitialFile.value = {
        path: fullPath,
        name: file.name,
    };
    showEditor.value = true;
};

/** 打开编辑器并直接切到数据库面板 */
const openDatabasePanel = async () => {
    editorInitialFile.value = null;
    if (!showEditor.value) {
        editorInitialPanel.value = "database";
        showEditor.value = true;
        return;
    }
    // 已打开：强制触发侧栏切换（同值 watch 不会响）
    editorInitialPanel.value = null;
    await nextTick();
    editorInitialPanel.value = "database";
};

const handleNew = async () => {
    if (!newItemName.value.trim()) {
        ZXNotification({
            title: "提示",
            message: "名称不能为空哦～",
            type: "info",
            position: "top-right",
        });
        return;
    }

    try {
        const res =
            newItemType.value === "file"
                ? await fileApi.createFile(
                      currentPath.value || undefined,
                      newItemName.value,
                  )
                : await fileApi.createFolder(
                      currentPath.value || undefined,
                      newItemName.value,
                  );

        if (res?.success) {
            ZXNotification({
                title: "新建成功～",
                message: `${newItemType.value === "file" ? "文件" : "文件夹"} "${newItemName.value}" 创建成功啦！`,
                type: "success",
                position: "top-right",
                confetti: true,
            });
            showNewDialog.value = false;
            newItemName.value = "";
            loadFileList(currentPath.value);
        }
    } catch (error) {
        ZXNotification({
            title: "创建失败",
            message: "创建失败了 (´；ω；`)",
            type: "error",
            position: "top-right",
        });
    }
};

const openRenameDialog = (file: FileItem) => {
    renamingFile.value = file;
    newName.value = file.name;
    showRenameDialog.value = true;
};

const handleRename = async () => {
    if (!newName.value.trim() || !renamingFile.value) {
        ZXNotification({
            title: "提示",
            message: "名称不能为空哦～",
            type: "info",
            position: "top-right",
        });
        return;
    }

    if (newName.value === renamingFile.value.name) {
        showRenameDialog.value = false;
        return;
    }

    try {
        const res = await fileApi.rename(
            resolveFilePath(renamingFile.value),
            newName.value,
        );

        if (res?.success) {
            ZXNotification({
                title: "重命名成功～",
                message: `"${renamingFile.value.name}" 已成功重命名为 "${newName.value}" 啦！`,
                type: "success",
                position: "top-right",
            });
            showRenameDialog.value = false;
            renamingFile.value = null;
            newName.value = "";
            loadFileList(currentPath.value);
        }
    } catch (error) {
        ZXNotification({
            title: "重命名失败",
            message: "重命名操作失败了 (´；ω；`)",
            type: "error",
            position: "top-right",
        });
    }
};

// ==================== 下载 ====================
const downloading = ref(false);

const saveBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "download";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
};

const handleDownload = async (files: FileItem[]) => {
    if (files.length === 0 || downloading.value) return;
    downloading.value = true;

    try {
        const { blob, filename } = await fileApi.downloadFiles(
            files.map((f) => resolveFilePath(f)),
        );
        saveBlob(blob, filename || files[0].name);
    } catch (error) {
        ZXNotification({
            title: "下载失败",
            message:
                (error as Error)?.message || "下载失败了 (´；ω；`)",
            type: "error",
            position: "top-right",
        });
    } finally {
        downloading.value = false;
    }
};

// ==================== 压缩包 ====================
const handlePreviewArchive = (file: FileItem) => {
    archivePreviewTarget.value = {
        path: resolveFilePath(file),
        name: file.name,
    };
    showArchivePreview.value = true;
};

const handleExtractArchive = async (file?: FileItem) => {
    // 右键直接解压时传 file；从预览弹窗解压时用当前目标
    const target = file
        ? { path: resolveFilePath(file), name: file.name }
        : archivePreviewTarget.value;
    if (!target) return;
    try {
        const res = await fileApi.extractArchive(target.path);
        if (res?.success && res?.data) {
            ZXNotification({
                title: "解压成功～",
                message: `已解压 ${res.data.file_count} 个文件到 "${res.data.dest_path.split(/[\\/]/).pop()}" ！`,
                type: "success",
                position: "top-right",
            });
            showArchivePreview.value = false;
            loadFileList(currentPath.value);
        }
    } catch (error) {
        ZXNotification({
            title: "解压失败",
            message:
                (error as any)?.response?.data?.message ||
                "解压操作失败了 (´；ω；`)",
            type: "error",
            position: "top-right",
        });
    }
};

const handleCompress = async (files: FileItem[]) => {
    if (files.length === 0) return;

    try {
        const res = await fileApi.compressFiles(
            files.map((f) => resolveFilePath(f)),
        );
        if (res?.success && res?.data) {
            ZXNotification({
                title: "压缩成功～",
                message: `已打包 ${res.data.file_count} 个文件到 "${res.data.dest_path.split(/[\\/]/).pop()}" ！`,
                type: "success",
                position: "top-right",
            });
            loadFileList(currentPath.value);
        }
    } catch (error) {
        ZXNotification({
            title: "压缩失败",
            message:
                (error as any)?.response?.data?.message ||
                "压缩操作失败了 (´；ω；`)",
            type: "error",
            position: "top-right",
        });
    }
};

const sortedFileList = computed(() => {
    const query = searchQuery.value.toLowerCase().trim();
    const files = query
        ? fileList.value.filter((file) =>
              file.name.toLowerCase().includes(query),
          )
        : fileList.value;

    const dir = sortDir.value === "asc" ? 1 : -1;
    const field = sortField.value;

    return [...files]
        .filter((f) => f && f.name)
        .sort((a, b) => {
        // 文件夹始终排前（名称排序时；大小/时间也保持文件夹优先）
        if (!a.is_file && b.is_file) return -1;
        if (a.is_file && !b.is_file) return 1;

        if (field === "size") {
            return ((a.size ?? -1) - (b.size ?? -1)) * dir;
        }
        if (field === "mtime") {
            const ta = a.mtime ? new Date(a.mtime).getTime() || 0 : 0;
            const tb = b.mtime ? new Date(b.mtime).getTime() || 0 : 0;
            return (ta - tb) * dir;
        }
        return a.name.localeCompare(b.name, "zh-CN") * dir;
    });
});

onMounted(() => {
    loadFileList();
    window.addEventListener("keydown", handleKeydown);
});

onBeforeUnmount(() => {
    window.removeEventListener("keydown", handleKeydown);
});
</script>

<template>
    <!-- 页面根：锁定高度，列表在面板内部滚动 -->
    <div
        class="files-page-root flex h-full min-h-0 w-full flex-col overflow-hidden gap-3 sm:gap-4"
    >
        <FileBreadcrumbBar
            class="flex-shrink-0"
            v-model:search-query="searchQuery"
            :current-path="currentPath"
            :path-segments="pathSegments"
            :selected-count="selectedPaths.size"
            @back="goBack"
            @home="loadFileList('')"
            @navigate="loadFileList"
            @new="showNewDialog = true"
            @open-database="openDatabasePanel"
            @clear-selection="clearSelection"
            @compress-selected="handleCompress(getSelectedFiles())"
            @delete-selected="handleDelete(getSelectedFiles())"
            @download-selected="handleDownload(getSelectedFiles())"
        />

        <FileListPanel
            class="min-h-0 flex-1"
            :files="sortedFileList"
            :is-empty="fileList.length === 0"
            :loading="loading"
            :search-query="searchQuery"
            :selected-paths="selectedPaths"
            :sort-field="sortField"
            :sort-dir="sortDir"
            :can-paste="canPaste()"
            @sort="onSort"
            @clear-selection="clearSelection"
            @toggle-select="toggleSelect"
            @compress="handleCompress"
            @delete="handleDelete"
            @download="handleDownload"
            @enter-folder="enterFolder"
            @extract-archive="handleExtractArchive"
            @open="openEditor"
            @preview-archive="handlePreviewArchive"
            @rename="openRenameDialog"
            @copy="copyFiles"
            @cut="cutFiles"
            @paste="onPasteTo"
        />

        <NewItemDialog
            v-model="showNewDialog"
            v-model:item-name="newItemName"
            v-model:item-type="newItemType"
            @confirm="handleNew"
        />

        <RenameDialog
            v-model="showRenameDialog"
            v-model:name="newName"
            @confirm="handleRename"
        />

        <FileEditorModal
            v-if="showEditor"
            :initial-file="editorInitialFile"
            :initial-panel="editorInitialPanel"
            @close="showEditor = false"
        />

        <ArchivePreviewModal
            v-if="showArchivePreview && archivePreviewTarget"
            :archive-path="archivePreviewTarget.path"
            :archive-name="archivePreviewTarget.name"
            @close="showArchivePreview = false"
            @extract="handleExtractArchive()"
        />
    </div>
</template>

<style>
/* 压住 Home 胶片带给页面根的 overflow-y:auto，滚动交给列表面板 */
.files-page-root {
    overflow: hidden !important;
}
</style>
