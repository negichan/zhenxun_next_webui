<script setup lang="ts">
/**
 * 侧边栏容器：explorer = 文件树；search = 全局搜索；database = 数据表/SQL。
 */
import { ref } from "vue";
import FileTree from "./FileTree.vue";
import SearchPanel from "./SearchPanel.vue";
import DatabaseSidebar from "./DatabaseSidebar.vue";
import type { SidebarPanel } from "../types";
import type { Workbench } from "../useWorkbench";

defineProps<{
    wb: Workbench;
    activePanel: SidebarPanel;
}>();

const treeRef = ref<InstanceType<typeof FileTree> | null>(null);
const dbRef = ref<InstanceType<typeof DatabaseSidebar> | null>(null);

const emit = defineEmits<{ openSqlConsole: [] }>();

defineExpose({
    revealPath: (path: string) => {
        if (path.startsWith("db://")) return;
        treeRef.value?.revealPath(path);
    },
    startCreate: (kind: "file" | "folder") =>
        treeRef.value?.startCreateAtRoot(kind),
    renamePath: async (path: string) => {
        if (path.startsWith("db://")) return;
        await treeRef.value?.renamePath(path);
    },
    deletePath: async (path: string) => {
        if (path.startsWith("db://")) return;
        await treeRef.value?.deletePath(path);
    },
    reload: () => {
        treeRef.value?.reload();
        dbRef.value?.reload();
    },
    reloadDb: () => dbRef.value?.reload(),
    newSqlFile: () => dbRef.value?.newSqlFile(),
    openSqlConsole: () => emit("openSqlConsole"),
});
</script>

<template>
    <div
        class="flex h-full w-full select-none overflow-hidden border-r border-slate-200 bg-white"
    >
        <FileTree
            v-show="activePanel === 'explorer'"
            ref="treeRef"
            class="h-full min-h-0 flex-1"
            :wb="wb"
        />

        <SearchPanel
            v-if="activePanel === 'search'"
            class="h-full min-w-0 flex-1"
            :wb="wb"
        />

        <DatabaseSidebar
            v-show="activePanel === 'database'"
            ref="dbRef"
            class="h-full min-h-0 flex-1"
            :wb="wb"
            @open-sql-console="emit('openSqlConsole')"
        />
    </div>
</template>
