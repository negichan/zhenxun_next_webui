<script setup lang="ts">
import { storeToRefs } from "pinia";
import { CheckCircle, Clock, XCircle } from "lucide-vue-next";
import { useDatabaseStore } from "@/store/database";

const databaseStore = useDatabaseStore();
const { showSqlLog, sqlLogList, sqlLogLoading, sqlLogTotal } =
    storeToRefs(databaseStore);
const { closeSqlLog } = databaseStore;

const formatTime = (iso: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
};
</script>

<template>
    <ZxModal
        v-model="showSqlLog"
        :title="'SQL 执行日志' + (sqlLogTotal ? ` (${sqlLogTotal} 条)` : '')"
        :icon="Clock"
        width="max-w-[600px]"
        @close="closeSqlLog"
    >
        <div v-if="sqlLogLoading" class="py-8 text-center text-zx-text-subtle">
            <Clock class="mx-auto mb-2 h-8 w-8 animate-pulse" />
            <p>加载中...</p>
        </div>
        <ZxEmptyState
            v-else-if="sqlLogList.length === 0"
            :icon="Clock"
            text="暂无日志记录"
            sub-text="执行 SQL 后会出现在这里"
            size="md"
        />
        <div v-else class="space-y-2">
            <div
                v-for="log in sqlLogList"
                :key="log.id"
                :class="log.is_success ? 'bg-green-50' : 'bg-red-50'"
                class="rounded-2xl p-3"
            >
                <div class="mb-2 flex items-center justify-between gap-2">
                    <div class="flex min-w-0 items-center gap-2">
                        <CheckCircle
                            v-if="log.is_success"
                            class="h-4 w-4 flex-shrink-0 text-green-600"
                        />
                        <XCircle
                            v-else
                            class="h-4 w-4 flex-shrink-0 text-red-600"
                        />
                        <span
                            class="truncate text-sm font-medium text-zx-text"
                        >
                            {{ formatTime(log.created_at) }}
                        </span>
                    </div>
                </div>
                <pre
                    class="font-mono text-xs break-all whitespace-pre-wrap text-zx-text-muted"
                >{{ log.sql }}</pre>
                <p
                    v-if="log.message"
                    class="mt-1 text-xs break-all text-zx-text-muted"
                >
                    {{ log.message }}
                </p>
            </div>
        </div>
    </ZxModal>
</template>
