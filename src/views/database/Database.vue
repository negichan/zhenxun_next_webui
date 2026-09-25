<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
    CheckCircle,
    Database,
    FileText,
    Terminal,
} from "lucide-vue-next";
import { databaseApi } from "@/utils/api-next";
import { ZXNotification } from "@/services/ui";
import { useDatabaseStore } from "@/store/database.ts";
import type {
    SqlExecuteResult,
    TableColumn,
    TableDataResult,
    TableRowData,
} from "@/types/api-next.types";
import TableSidebar from "./components/TableSidebar.vue";
import SqlEditor from "./components/SqlEditor.vue";
import QueryResultTable from "./components/QueryResultTable.vue";
import StructureTable from "./components/StructureTable.vue";
import SqlLogModal from "./components/SqlLogModal.vue";
import EditableDataPanel from "./components/EditableDataPanel.vue";

const databaseStore = useDatabaseStore();
const { openSqlLog } = databaseStore;

type DetailView = "data" | "structure" | "sql";

const selectedTable = ref("");
const tableList = ref<string[]>([]);
const tableColumns = ref<TableColumn[]>([]);
const tableData = ref<TableRowData[]>([]);
const dataLoading = ref(false);

const currentPage = ref(1);
const pageSize = ref(20);
const totalRows = ref(0);

const sqlEditor = ref("");
const sqlResult = ref<{ columns: string[]; rows: Record<string, any>[] } | null>(
    null,
);
const sqlExecuting = ref(false);

const detailView = ref<DetailView>("data");
const viewOptions = [
    { label: "数据", value: "data" as const },
    { label: "结构", value: "structure" as const },
    { label: "SQL", value: "sql" as const, icon: Terminal },
];

const pageInfo = computed(() => {
    if (totalRows.value === 0) return "共 0 条";
    const start = (currentPage.value - 1) * pageSize.value + 1;
    const end = Math.min(currentPage.value * pageSize.value, totalRows.value);
    return `显示 ${start}-${end} 条，共 ${totalRows.value} 条`;
});

const totalPages = computed(() =>
    Math.max(1, Math.ceil(totalRows.value / pageSize.value)),
);

const headerTitle = computed(() => {
    if (detailView.value === "sql") return "SQL 控制台";
    return selectedTable.value || "请选择表";
});

const headerBadge = computed(() => {
    if (detailView.value === "sql") {
        if (!sqlResult.value) return "";
        return `${sqlResult.value.rows.length} 行结果`;
    }
    if (!selectedTable.value) return "";
    return `${totalRows.value} 行 / ${tableColumns.value.length} 字段`;
});

const refreshTableData = (page?: number) => {
    loadTableColumns();
    loadTableData(page ?? currentPage.value);
};

const loadTableList = async () => {
    try {
        const res = await databaseApi.getTableList();
        if (res?.success && res.data) {
            tableList.value = res.data;
            if (tableList.value.length > 0 && !selectedTable.value) {
                selectTable(tableList.value[0]);
            }
        }
    } catch {
        ZXNotification({
            title: "呜呼～",
            message: "表列表加载失败了 (っ °Д °;) っ",
            type: "error",
            position: "top-right",
        });
    }
};

const loadTableColumns = async () => {
    if (!selectedTable.value) return;
    try {
        const res = await databaseApi.getTableColumns(selectedTable.value);
        if (res?.success && res.data) {
            tableColumns.value = res.data;
        }
    } catch {
        tableColumns.value = [];
    }
};

const loadTableData = async (page = 1) => {
    if (!selectedTable.value) return;
    dataLoading.value = true;
    try {
        const res = await databaseApi.getTableData(
            selectedTable.value,
            page,
            pageSize.value,
        );
        if (res?.success && res.data) {
            const payload = res.data as TableDataResult;
            tableData.value = payload.items ?? [];
            totalRows.value = payload.total ?? 0;
            currentPage.value = page;
        }
    } catch {
        ZXNotification({
            title: "呜呼～",
            message: "数据加载失败了 (っ °Д °;) っ",
            type: "error",
            position: "top-right",
        });
    } finally {
        dataLoading.value = false;
    }
};

const selectTable = (tableName: string) => {
    selectedTable.value = tableName;
    // 停在 SQL 时不打断，方便对着表写查询
    if (detailView.value !== "sql") {
        detailView.value = "data";
    }
    tableColumns.value = [];
    tableData.value = [];
    currentPage.value = 1;
    totalRows.value = 0;
    loadTableColumns();
    loadTableData(1);
};

const changePage = (delta: number) => {
    const next = currentPage.value + delta;
    if (next >= 1 && next <= totalPages.value) {
        loadTableData(next);
    }
};

const executeSql = async () => {
    const sql = sqlEditor.value.trim();
    if (!sql) {
        ZXNotification({
            title: "提示",
            message: "SQL 不能为空哦～",
            type: "info",
            position: "top-right",
        });
        return;
    }

    sqlExecuting.value = true;
    try {
        const res = await databaseApi.executeSql({ sql });
        if (!res?.success) {
            ZXNotification({
                title: "执行失败",
                message: res?.message || "SQL 执行失败了 (´；ω；`)",
                type: "error",
                position: "top-right",
            });
            return;
        }

        const payload = res.data as SqlExecuteResult | null;
        if (payload?.data && Array.isArray(payload.data)) {
            const rows = payload.data;
            sqlResult.value = {
                columns: rows.length > 0 ? Object.keys(rows[0]) : [],
                rows,
            };
            ZXNotification({
                title: "执行成功～",
                message: `返回 ${rows.length} 条记录`,
                type: "success",
                position: "top-right",
                confetti: true,
            });
        } else {
            sqlResult.value = null;
            ZXNotification({
                title: "执行成功～",
                message: payload?.message || "SQL 执行成功！",
                type: "success",
                position: "top-right",
                confetti: true,
            });
            loadTableList();
            if (selectedTable.value) {
                loadTableColumns();
                loadTableData(1);
            }
        }
    } catch (error: any) {
        ZXNotification({
            title: "执行失败",
            message:
                error?.response?.data?.message ||
                error?.message ||
                "SQL 执行失败了 (´；ω；`)",
            type: "error",
            position: "top-right",
        });
    } finally {
        sqlExecuting.value = false;
    }
};

onMounted(() => {
    loadTableList();
});
</script>

<template>
    <div
        class="database-page flex h-full w-full flex-col gap-3 overflow-hidden sm:gap-4"
    >
        <div class="grid min-h-0 flex-1 gap-3 lg:grid-cols-[17rem_minmax(0,1fr)]">
            <TableSidebar
                :tables="tableList"
                :selected="selectedTable"
                @select="selectTable"
            />

            <section
                class="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
            >
                <div
                    class="flex flex-shrink-0 flex-col gap-3 border-b border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                    <div class="min-w-0">
                        <div class="flex min-w-0 items-center gap-2">
                            <span class="truncate font-semibold text-zx-text">
                                {{ headerTitle }}
                            </span>
                            <span
                                v-if="headerBadge"
                                class="hidden rounded-full bg-slate-100 px-2 py-0.5 text-xs text-zx-text-muted sm:inline-flex"
                            >
                                {{ headerBadge }}
                            </span>
                        </div>
                    </div>

                    <ZxSegmented
                        v-model="detailView"
                        :options="viewOptions"
                        size="sm"
                    />
                </div>

                <div class="min-h-0 flex-1 overflow-hidden">
                    <!-- SQL 控制台 -->
                    <div
                        v-if="detailView === 'sql'"
                        class="flex h-full min-h-0 flex-col"
                    >
                        <SqlEditor
                            v-model="sqlEditor"
                            :executing="sqlExecuting"
                            @execute="executeSql"
                            @open-log="openSqlLog"
                        />
                        <div class="min-h-0 flex-1 overflow-hidden">
                            <ZxEmptyState
                                v-if="!sqlResult"
                                :icon="FileText"
                                text="暂无结果"
                                sub-text="执行查询后在此查看"
                                size="md"
                                class="h-full justify-center"
                            />
                            <ZxEmptyState
                                v-else-if="sqlResult.rows.length === 0"
                                :icon="CheckCircle"
                                text="执行成功，无返回数据"
                                size="md"
                                class="h-full justify-center"
                            />
                            <QueryResultTable
                                v-else
                                :columns="sqlResult.columns"
                                :rows="sqlResult.rows"
                            />
                        </div>
                    </div>

                    <!-- 空态 -->
                    <div
                        v-else-if="!selectedTable"
                        class="flex h-full items-center justify-center text-zx-text-subtle"
                    >
                        <div class="text-center">
                            <Database class="mx-auto mb-4 h-16 w-16 opacity-50" />
                            <p>请选择一个数据表</p>
                        </div>
                    </div>

                    <!-- 表数据（含编辑模式） -->
                    <EditableDataPanel
                        v-else-if="detailView === 'data'"
                        :table-name="selectedTable"
                        :columns="tableColumns"
                        :rows="tableData"
                        :loading="dataLoading"
                        :page="currentPage"
                        :total-pages="totalPages"
                        :page-info="pageInfo"
                        @refresh="refreshTableData"
                        @change-page="changePage"
                    />

                    <!-- 表结构 -->
                    <StructureTable
                        v-else
                        :columns="tableColumns"
                    />
                </div>
            </section>
        </div>

        <SqlLogModal />
    </div>
</template>
