<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import {
    Check,
    Pencil,
    Plus,
    Trash2,
    X,
} from "lucide-vue-next";
import { databaseApi } from "@/utils/api-next";
import { ZXMessageBox, ZXNotification } from "@/services/ui";
import type { TableColumn, TableRowData } from "@/types/api-next.types";
import QueryResultTable from "./QueryResultTable.vue";

const props = defineProps<{
    tableName: string;
    columns: TableColumn[];
    rows: TableRowData[];
    loading: boolean;
    page: number;
    totalPages: number;
    pageInfo: string;
}>();

const emit = defineEmits<{
    refresh: [page?: number];
    "change-page": [delta: number];
}>();

const pkName = computed(() => {
    const pk = props.columns.find((c) => c.primary_key);
    return pk?.name ?? null;
});

const canEdit = computed(() => Boolean(pkName.value) || props.columns.length > 0);
const canMutateRows = computed(() => Boolean(pkName.value));

const editMode = ref(false);
const savingKey = ref<string | null>(null);
const inserting = ref(false);

/** 行草稿：key = String(rowId) 或 __new__ */
const drafts = reactive<Record<string, Record<string, any>>>({});

const colNames = computed(() => props.columns.map((c) => c.name));

const rowKey = (row: TableRowData, index: number) => {
    if (pkName.value) {
        const id = row.data?.[pkName.value] ?? row.id;
        return String(id);
    }
    return `idx-${index}`;
};

const isDirty = (key: string) => {
    const draft = drafts[key];
    if (!draft) return false;
    return Object.keys(draft).length > 0;
};

const cellValue = (row: TableRowData, index: number, col: string) => {
    const key = rowKey(row, index);
    const draft = drafts[key];
    if (draft && col in draft) return draft[col];
    const v = row.data?.[col];
    return v === null || v === undefined ? "" : String(v);
};

const onCellInput = (row: TableRowData, index: number, col: string, event: Event) => {
    const key = rowKey(row, index);
    if (!drafts[key]) drafts[key] = {};
    const next = (event.target as HTMLInputElement | HTMLTextAreaElement).value;
    const original = row.data?.[col];
    const originalStr =
        original === null || original === undefined ? "" : String(original);
    if (next === originalStr) {
        delete drafts[key][col];
        if (Object.keys(drafts[key]).length === 0) delete drafts[key];
    } else {
        drafts[key][col] = next;
    }
};

const exitEditMode = () => {
    editMode.value = false;
    inserting.value = false;
    for (const k of Object.keys(drafts)) delete drafts[k];
};

const enterEditMode = () => {
    if (!props.columns.length) return;
    editMode.value = true;
};

const saveRow = async (row: TableRowData, index: number) => {
    if (!pkName.value || !props.tableName) return;
    const key = rowKey(row, index);
    const draft = drafts[key];
    if (!draft || Object.keys(draft).length === 0) return;

    savingKey.value = key;
    try {
        const res = await databaseApi.updateRow(props.tableName, row.id, {
            data: draft,
        });
        if (res?.success) {
            delete drafts[key];
            ZXNotification({
                title: "保存成功～",
                message: res.data?.message || "行已更新",
                type: "success",
                position: "top-right",
            });
            emit("refresh", props.page);
        } else {
            ZXNotification({
                title: "保存失败",
                message: res?.message || "更新失败了 (´；ω；`)",
                type: "error",
                position: "top-right",
            });
        }
    } catch (e: any) {
        ZXNotification({
            title: "保存失败",
            message: e?.response?.data?.message || e?.message || "更新失败了",
            type: "error",
            position: "top-right",
        });
    } finally {
        savingKey.value = null;
    }
};

const revertRow = (row: TableRowData, index: number) => {
    const key = rowKey(row, index);
    delete drafts[key];
};

const deleteRow = async (row: TableRowData, index: number) => {
    if (!pkName.value || !props.tableName) return;
    const id = row.data?.[pkName.value] ?? row.id;
    const confirmed = await ZXMessageBox({
        title: "删除确认",
        message: `确定删除 ${pkName.value}=${id} 这一行吗？此操作不可撤销。`,
        confirmButtonText: "删除",
        cancelButtonText: "取消",
        type: "warning",
    });
    if (!confirmed) return;

    const key = rowKey(row, index);
    savingKey.value = key;
    try {
        const res = await databaseApi.deleteRow(props.tableName, id);
        if (res?.success) {
            delete drafts[key];
            ZXNotification({
                title: "已删除～",
                message: res.data?.message || "行已删除",
                type: "success",
                position: "top-right",
            });
            emit("refresh", props.page);
        } else {
            ZXNotification({
                title: "删除失败",
                message: res?.message || "删除失败了",
                type: "error",
                position: "top-right",
            });
        }
    } catch (e: any) {
        ZXNotification({
            title: "删除失败",
            message: e?.response?.data?.message || e?.message || "删除失败了",
            type: "error",
            position: "top-right",
        });
    } finally {
        savingKey.value = null;
    }
};

/** 新行草稿 */
const newRowDraft = reactive<Record<string, any>>({});

const startInsert = () => {
    inserting.value = true;
    for (const c of colNames.value) newRowDraft[c] = "";
};

const cancelInsert = () => {
    inserting.value = false;
    for (const k of Object.keys(newRowDraft)) delete newRowDraft[k];
};

const saveInsert = async () => {
    if (!props.tableName) return;
    const data: Record<string, any> = {};
    for (const c of colNames.value) {
        const v = newRowDraft[c];
        if (v === "" || v === undefined || v === null) continue;
        data[c] = v;
    }
    if (Object.keys(data).length === 0) {
        ZXNotification({
            title: "提示",
            message: "请至少填写一个字段",
            type: "info",
            position: "top-right",
        });
        return;
    }

    savingKey.value = "__new__";
    try {
        const res = await databaseApi.insertRow(props.tableName, { data });
        if (res?.success) {
            cancelInsert();
            ZXNotification({
                title: "插入成功～",
                message: res.data?.message || "新行已插入",
                type: "success",
                position: "top-right",
                confetti: true,
            });
            emit("refresh", 1);
        } else {
            ZXNotification({
                title: "插入失败",
                message: res?.message || "插入失败了",
                type: "error",
                position: "top-right",
            });
        }
    } catch (e: any) {
        ZXNotification({
            title: "插入失败",
            message: e?.response?.data?.message || e?.message || "插入失败了",
            type: "error",
            position: "top-right",
        });
    } finally {
        savingKey.value = null;
    }
};

// 换表 / 退出编辑时清空草稿
watch(
    () => props.tableName,
    () => exitEditMode(),
);

const isLongText = (col: TableColumn) => {
    const t = (col.type || "").toLowerCase();
    return t.includes("text") || t.includes("json") || t.includes("blob");
};
</script>

<template>
    <div class="flex h-full min-h-0 flex-col overflow-hidden">
        <!-- 操作条 -->
        <div
            class="flex flex-shrink-0 flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-3 py-2 sm:px-4"
        >
            <div class="flex items-center gap-2">
                <ZxButton
                    v-if="!editMode"
                    variant="outline"
                    size="sm"
                    :disabled="!canEdit"
                    @click="enterEditMode"
                >
                    <Pencil class="h-3.5 w-3.5" />
                    <span>编辑</span>
                </ZxButton>
                <template v-else>
                    <ZxButton variant="ghost" size="sm" @click="exitEditMode">
                        <X class="h-3.5 w-3.5" />
                        <span>退出</span>
                    </ZxButton>
                    <ZxButton
                        v-if="!inserting"
                        variant="outline"
                        size="sm"
                        @click="startInsert"
                    >
                        <Plus class="h-3.5 w-3.5" />
                        <span>新增行</span>
                    </ZxButton>
                </template>
                <span
                    v-if="editMode && !canMutateRows"
                    class="text-xs text-amber-600"
                >
                    该表无主键，仅支持新增
                </span>
            </div>
        </div>

        <!-- 加载 / 空 -->
        <div v-if="loading" class="flex min-h-0 flex-1 items-center justify-center">
            <div class="text-center text-zx-text-subtle">
                <div
                    class="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-zx-primary border-b-transparent"
                />
                <p>加载中...</p>
            </div>
        </div>
        <ZxEmptyState
            v-else-if="!inserting && rows.length === 0"
            text="此表为空"
            :sub-text="editMode ? '点「新增行」插入数据' : ''"
            size="md"
            class="flex-1 justify-center"
        />

        <!-- 只读表格 -->
        <div v-else-if="!editMode" class="flex min-h-0 flex-1 flex-col">
            <div class="min-h-0 flex-1">
                <QueryResultTable
                    :columns="colNames"
                    :rows="rows.map((r) => r.data ?? {})"
                />
            </div>
            <div class="border-t border-gray-100 p-3">
                <ZxPagination
                    :page="page"
                    :total-pages="totalPages"
                    :summary-text="pageInfo"
                    @change-delta="(delta) => emit('change-page', delta)"
                />
            </div>
        </div>

        <!-- 编辑表格 -->
        <div v-else class="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div class="min-h-0 flex-1 overflow-auto">
                <table class="w-max min-w-full border-collapse">
                    <thead class="sticky top-0 z-10 bg-gray-50">
                        <tr>
                            <th
                                v-for="col in columns"
                                :key="col.name"
                                class="border-b border-gray-200 px-3 py-2.5 text-left text-xs font-medium tracking-wider whitespace-nowrap text-zx-text-muted"
                            >
                                <span class="flex items-center gap-1">
                                    {{ col.name }}
                                    <ZxTag
                                        v-if="col.primary_key"
                                        variant="warning"
                                        class="scale-90"
                                    >
                                        PK
                                    </ZxTag>
                                </span>
                            </th>
                            <th
                                class="border-b border-gray-200 px-2 py-2.5 text-right text-xs font-medium whitespace-nowrap text-zx-text-muted"
                            >
                                操作
                            </th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100 bg-white">
                        <!-- 插入行 -->
                        <tr v-if="inserting" class="bg-zx-primary-tint/40">
                            <td
                                v-for="col in columns"
                                :key="col.name"
                                class="px-2 py-1.5 align-top"
                            >
                                <textarea
                                    v-if="isLongText(col)"
                                    v-model="newRowDraft[col.name]"
                                    rows="2"
                                    class="w-full min-w-28 resize-y rounded-lg border border-slate-200 bg-white px-2 py-1 font-mono text-xs outline-none focus:border-zx-primary"
                                    :placeholder="col.primary_key ? '自增可留空' : ''"
                                />
                                <input
                                    v-else
                                    v-model="newRowDraft[col.name]"
                                    type="text"
                                    class="w-full min-w-24 rounded-lg border border-slate-200 bg-white px-2 py-1.5 font-mono text-xs outline-none focus:border-zx-primary"
                                    :placeholder="col.primary_key ? '自增可留空' : ''"
                                />
                            </td>
                            <td class="px-2 py-1.5 text-right whitespace-nowrap">
                                <div class="flex items-center justify-end gap-1">
                                    <ZxButton
                                        size="sm"
                                        :disabled="savingKey === '__new__'"
                                        @click="saveInsert"
                                    >
                                        <Check class="h-3.5 w-3.5" />
                                    </ZxButton>
                                    <ZxButton
                                        variant="ghost"
                                        circle
                                        size="sm"
                                        @click="cancelInsert"
                                    >
                                        <X class="h-3.5 w-3.5" />
                                    </ZxButton>
                                </div>
                            </td>
                        </tr>

                        <tr
                            v-for="(row, index) in rows"
                            :key="rowKey(row, index)"
                            :class="
                                isDirty(rowKey(row, index))
                                    ? 'bg-amber-50/60'
                                    : 'hover:bg-gray-50'
                            "
                        >
                            <td
                                v-for="col in columns"
                                :key="col.name"
                                class="px-1.5 py-1 align-top"
                            >
                                <textarea
                                    v-if="isLongText(col)"
                                    :value="cellValue(row, index, col.name)"
                                    rows="2"
                                    class="w-full min-w-32 resize-y rounded-lg border border-transparent bg-transparent px-2 py-1 font-mono text-xs outline-none focus:border-zx-primary focus:bg-white"
                                    @input="onCellInput(row, index, col.name, $event)"
                                />
                                <input
                                    v-else
                                    :value="cellValue(row, index, col.name)"
                                    type="text"
                                    class="w-full min-w-24 rounded-lg border border-transparent bg-transparent px-2 py-1.5 font-mono text-xs outline-none focus:border-zx-primary focus:bg-white"
                                    @input="onCellInput(row, index, col.name, $event)"
                                />
                            </td>
                            <td class="px-2 py-1 text-right whitespace-nowrap">
                                <div class="flex items-center justify-end gap-1">
                                    <ZxButton
                                        v-if="isDirty(rowKey(row, index))"
                                        size="sm"
                                        :disabled="savingKey === rowKey(row, index)"
                                        @click="saveRow(row, index)"
                                    >
                                        <Check class="h-3.5 w-3.5" />
                                    </ZxButton>
                                    <ZxButton
                                        v-if="isDirty(rowKey(row, index))"
                                        variant="ghost"
                                        circle
                                        size="sm"
                                        @click="revertRow(row, index)"
                                    >
                                        <X class="h-3.5 w-3.5" />
                                    </ZxButton>
                                    <ZxButton
                                        v-if="canMutateRows"
                                        variant="danger"
                                        circle
                                        size="sm"
                                        :disabled="savingKey === rowKey(row, index)"
                                        @click="deleteRow(row, index)"
                                    >
                                        <Trash2 class="h-3.5 w-3.5" />
                                    </ZxButton>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div class="border-t border-gray-100 p-3">
                <ZxPagination
                    :page="page"
                    :total-pages="totalPages"
                    :summary-text="pageInfo"
                    @change-delta="(delta) => emit('change-page', delta)"
                />
            </div>
        </div>
    </div>
</template>
