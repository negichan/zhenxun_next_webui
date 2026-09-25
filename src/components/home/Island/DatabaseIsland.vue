<script setup lang="ts">
import { Clock, Database } from "lucide-vue-next";
import { useDatabaseStore } from "@/store/database.ts";

const databaseStore = useDatabaseStore();
const { openSqlLog } = databaseStore;
</script>

<template>
    <div class="flex w-full items-center justify-between">
        <div
            class="group flex w-fit items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm transition-all hover:scale-105"
        >
            <Database class="h-5 w-5 text-zx-primary" />
            <span class="text-sm font-medium text-zx-text">数据库</span>
        </div>
        <div class="flex items-center gap-2">
            <button
                type="button"
                @click="openSqlLog"
                class="btn-touch flex cursor-pointer items-center gap-2 rounded-2xl bg-white px-3 py-2 text-sm font-medium text-zx-text shadow-sm transition-colors hover:bg-gray-200 sm:px-4"
            >
                <Clock class="h-4 w-4" />
                <span class="hidden sm:inline">SQL 日志</span>
            </button>
        </div>
    </div>
</template>
