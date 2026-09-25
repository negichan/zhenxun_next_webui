<script setup lang="ts">
/**
 * SQL Editor — 对齐 Supabase SQL 页：
 * 顶栏 Prettify / Save / Run；编辑器；底部 Results | Chart + 行数。
 * 字号固定 12–13px（不跟全局 rem 放大）。
 */
import { ref } from "vue";
import { Clock, Play, Save, Sparkles } from "lucide-vue-next";
import { databaseApi } from "@/utils/api-next";
import { ZXNotification } from "@/services/ui";
import { useDatabaseStore } from "@/store/database";
import SqlLogModal from "@/views/database/components/SqlLogModal.vue";

defineProps<{ compact?: boolean }>();

const databaseStore = useDatabaseStore();
const { openSqlLog } = databaseStore;

const sql = ref("-- Write SQL here\nSELECT 1;");
const running = ref(false);
const resultTab = ref<"results" | "chart">("results");
const result = ref<{ columns: string[]; rows: Record<string, any>[] } | null>(
    null,
);
const message = ref("");

const formatCell = (v: unknown) => {
    if (v === null || v === undefined) return "NULL";
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
};

const prettify = () => {
    sql.value = sql.value
        .replace(/\s+/g, " ")
        .replace(/\s*,\s*/g, ",\n  ")
        .replace(/\b(select|from|where|order by|group by|limit|insert into|values|update|set|delete from)\b/gi, "\n$1")
        .trim();
};

const saveSnippet = () => {
    ZXNotification({
        title: "已保存",
        message: "查询片段已保存到本地标签（开发中：接入后端 snippets）",
        type: "success",
        position: "top-right",
    });
};

const run = async () => {
    const q = sql.value.trim();
    if (!q || q.startsWith("--")) {
        const body = q
            .split("\n")
            .filter((l) => !l.trim().startsWith("--"))
            .join("\n")
            .trim();
        if (!body) {
            ZXNotification({
                title: "提示",
                message: "SQL 不能为空哦～",
                type: "info",
                position: "top-right",
            });
            return;
        }
    }
    running.value = true;
    message.value = "";
    try {
        const res = await databaseApi.executeSql({ sql: q });
        if (!res?.success) {
            result.value = null;
            message.value = res?.message || "执行失败";
            ZXNotification({
                title: "执行失败",
                message: message.value,
                type: "error",
                position: "top-right",
            });
            return;
        }
        const payload = res.data;
        if (payload?.data && Array.isArray(payload.data)) {
            const rows = payload.data;
            result.value = {
                columns: rows.length ? Object.keys(rows[0]) : [],
                rows,
            };
            resultTab.value = "results";
            message.value = `Success. ${rows.length} rows`;
        } else {
            result.value = null;
            message.value = payload?.message || "Success. No rows returned";
        }
        ZXNotification({
            title: "执行成功～",
            message: message.value,
            type: "success",
            position: "top-right",
        });
    } catch (e: any) {
        result.value = null;
        message.value =
            e?.response?.data?.message || e?.message || "执行失败";
        ZXNotification({
            title: "执行失败",
            message: message.value,
            type: "error",
            position: "top-right",
        });
    } finally {
        running.value = false;
    }
};
</script>

<template>
    <div
        class="flex h-full min-h-0 w-full flex-col overflow-hidden bg-white text-xs"
    >
        <!-- 顶栏工具 -->
        <div
            class="flex h-9 flex-shrink-0 items-center gap-1 border-b border-slate-200 px-2"
        >
            <button
                type="button"
                class="btn-touch flex h-7 items-center gap-1 rounded-md px-2 text-xs text-zx-text-muted hover:bg-slate-100 hover:text-zx-primary"
                title="Prettify SQL"
                @click="prettify"
            >
                <Sparkles class="h-3.5 w-3.5" />
                <span class="hidden sm:inline">Prettify</span>
            </button>
            <button
                type="button"
                class="btn-touch flex h-7 items-center gap-1 rounded-md px-2 text-xs text-zx-text-muted hover:bg-slate-100 hover:text-zx-primary"
                @click="saveSnippet"
            >
                <Save class="h-3.5 w-3.5" />
                <span class="hidden sm:inline">Save</span>
            </button>
            <button
                type="button"
                class="btn-touch flex h-7 items-center gap-1 rounded-md px-2 text-xs text-zx-text-muted hover:bg-slate-100"
                @click="openSqlLog"
            >
                <Clock class="h-3.5 w-3.5" />
            </button>
            <div class="flex-1"></div>
            <span class="hidden text-[11px] text-zx-text-subtle md:inline">
                Database · Ctrl/⌘+Enter
            </span>
            <ZxButton
                size="sm"
                class="!h-7 !px-3 !text-xs"
                :disabled="running || !sql.trim()"
                @click="run"
            >
                <Play class="h-3.5 w-3.5" />
                <span>{{ running ? "Running..." : "Run" }}</span>
            </ZxButton>
        </div>

        <!-- 编辑器 -->
        <textarea
            v-model="sql"
            class="min-h-24 w-full flex-1 resize-none border-b border-slate-200 bg-slate-50/40 px-3 py-2 font-mono text-xs leading-5 text-zx-text-strong outline-none focus:bg-white placeholder:text-zx-text-subtle"
            placeholder="-- Write SQL here"
            spellcheck="false"
            @keydown.meta.enter.prevent="run"
            @keydown.ctrl.enter.prevent="run"
        ></textarea>

        <!-- Results / Chart -->
        <div
            class="flex h-8 flex-shrink-0 items-center gap-2 border-b border-slate-200 px-2"
        >
            <button
                type="button"
                class="btn-touch h-6 rounded-md px-2 text-xs"
                :class="
                    resultTab === 'results'
                        ? 'bg-slate-100 font-medium text-zx-primary'
                        : 'text-zx-text-muted hover:text-zx-text'
                "
                @click="resultTab = 'results'"
            >
                Results
            </button>
            <button
                type="button"
                class="btn-touch h-6 rounded-md px-2 text-xs"
                :class="
                    resultTab === 'chart'
                        ? 'bg-slate-100 font-medium text-zx-primary'
                        : 'text-zx-text-muted hover:text-zx-text'
                "
                @click="resultTab = 'chart'"
            >
                Chart
            </button>
            <div class="flex-1"></div>
            <span class="tabular-nums text-xs text-zx-text-muted">
                {{ result?.rows.length ?? 0 }} rows
            </span>
        </div>

        <div class="min-h-0 flex-1 overflow-hidden">
            <div
                v-if="resultTab === 'chart'"
                class="flex h-full items-center justify-center text-xs text-zx-text-subtle"
            >
                Chart 视图待接入
            </div>
            <div
                v-else-if="message && !result"
                class="flex h-full flex-col items-center justify-center gap-1 px-4 text-center"
            >
                <p class="text-xs text-zx-text-muted">{{ message }}</p>
            </div>
            <div
                v-else-if="!result"
                class="flex h-full items-center justify-center text-xs text-zx-text-subtle"
            >
                Run 查询后在此查看结果
            </div>
            <div v-else class="h-full overflow-auto">
                <table class="w-max min-w-full border-collapse">
                    <thead class="sticky top-0 z-10 bg-slate-50">
                        <tr>
                            <th
                                v-for="col in result.columns"
                                :key="col"
                                class="border-b border-slate-200 px-2.5 py-1.5 text-left font-semibold whitespace-nowrap text-zx-text"
                            >
                                {{ col }}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr
                            v-for="(row, i) in result.rows"
                            :key="i"
                            class="hover:bg-slate-50"
                        >
                            <td
                                v-for="col in result.columns"
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

        <SqlLogModal />
    </div>
</template>
