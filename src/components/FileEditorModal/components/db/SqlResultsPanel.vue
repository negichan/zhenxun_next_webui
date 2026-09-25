<script setup lang="ts">
/**
 * SQL 编辑器底部栏结果面板：Results | Chart + Run
 * 内容来自当前激活的 Monaco sql 标签（wb.activeTab）
 */
import { computed, ref } from "vue";
import { storeToRefs } from "pinia";
import { Play } from "lucide-vue-next";
import { useDatabaseStore } from "@/store/database";
import type { Workbench } from "../../useWorkbench";

const props = defineProps<{
    wb: Workbench;
}>();

const dbStore = useDatabaseStore();
const { sqlResult, sqlRunning } = storeToRefs(dbStore);

const resultTab = ref<"results" | "chart">("results");

const activeTab = computed(() => props.wb.activeTab.value);
const isSqlTab = computed(() => activeTab.value?.kind === "sql");

const formatCell = (v: unknown) => {
    if (v === null || v === undefined) return "NULL";
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
};

const run = async () => {
    const tab = activeTab.value;
    if (!tab || tab.kind !== "sql") return;
    const sql = tab.model?.getValue() ?? tab.initialContent ?? "";
    await dbStore.runSql(sql);
};
</script>

<template>
    <div
        class="no-tile-glow flex h-full min-h-0 w-full flex-col overflow-hidden text-xs"
    >
        <!-- 工具条：左侧次级切换，右侧 Run / 行数（贴近 VSCode 输出面板） -->
        <div
            class="flex h-7 flex-shrink-0 items-center gap-1 border-b border-slate-100 px-2"
        >
            <button
                type="button"
                class="btn-touch h-5 rounded px-2 text-[11px]"
                :class="
                    resultTab === 'results'
                        ? 'bg-slate-100 font-medium text-zx-primary'
                        : 'text-zx-text-subtle hover:text-zx-text-muted'
                "
                @click="resultTab = 'results'"
            >
                Results
            </button>
            <button
                type="button"
                class="btn-touch h-5 rounded px-2 text-[11px]"
                :class="
                    resultTab === 'chart'
                        ? 'bg-slate-100 font-medium text-zx-primary'
                        : 'text-zx-text-subtle hover:text-zx-text-muted'
                "
                @click="resultTab = 'chart'"
            >
                Chart
            </button>
            <div class="flex-1"></div>
            <span
                v-if="sqlResult?.rows?.length != null"
                class="tabular-nums text-[11px] text-zx-text-subtle"
            >
                {{ sqlResult.rows.length }} rows
            </span>
            <ZxButton
                size="sm"
                class="!h-6 !px-2.5"
                :disabled="!isSqlTab || sqlRunning"
                @click="run"
            >
                <Play class="h-3 w-3" />
                <span>{{ sqlRunning ? "Running..." : "Run" }}</span>
            </ZxButton>
        </div>

        <div class="min-h-0 flex-1 overflow-auto">
            <div
                v-if="!isSqlTab"
                class="flex h-full items-center justify-center text-[11px] text-zx-text-subtle"
            >
                打开 SQL 文件后可在此运行并查看结果
            </div>
            <div
                v-else-if="resultTab === 'chart'"
                class="flex h-full items-center justify-center text-[11px] text-zx-text-subtle"
            >
                Chart 视图待接入
            </div>
            <div
                v-else-if="!sqlResult"
                class="flex h-full items-center justify-center text-[11px] text-zx-text-subtle"
            >
                点 Run 执行当前 SQL
            </div>
            <div
                v-else-if="!sqlResult.ok"
                class="flex h-full items-center justify-center p-3 text-xs text-zx-danger"
            >
                {{ sqlResult.message }}
            </div>
            <div
                v-else-if="!sqlResult.rows.length"
                class="flex h-full flex-col items-center justify-center gap-1 p-3 text-center"
            >
                <p class="text-xs text-zx-text-muted">{{ sqlResult.message }}</p>
            </div>
            <table v-else class="w-max min-w-full border-collapse text-xs">
                <thead class="sticky top-0 z-10 bg-slate-50">
                    <tr>
                        <th
                            v-for="col in sqlResult.columns"
                            :key="col"
                            class="border-b border-slate-200 px-2.5 py-1.5 text-left font-semibold whitespace-nowrap text-zx-text"
                        >
                            {{ col }}
                        </th>
                    </tr>
                </thead>
                <tbody>
                    <tr
                        v-for="(row, i) in sqlResult.rows"
                        :key="i"
                        class="hover:bg-slate-50"
                    >
                        <td
                            v-for="col in sqlResult.columns"
                            :key="col"
                            class="border-b border-slate-100 px-2.5 py-1 font-mono break-all whitespace-pre-wrap text-zx-text align-top"
                        >
                            <span
                                v-if="row[col] === null || row[col] === undefined"
                                class="text-zx-text-subtle italic"
                                >NULL</span
                            >
                            <span v-else>{{ formatCell(row[col]) }}</span>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>
