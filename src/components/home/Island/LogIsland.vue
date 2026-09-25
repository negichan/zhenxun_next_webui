<script setup lang="ts">
import { FileText } from "lucide-vue-next";
import { storeToRefs } from "pinia";
import { useLogsStore } from "@/store/logs.ts";

const logsStore = useLogsStore();

const { autoScroll } = storeToRefs(logsStore);

// 清空日志
const clearLogs = () => {
    logsStore.clearLogs();
};
</script>

<template>
    <div class="flex w-full items-center justify-between">
        <div
            class="group flex w-fit items-center space-x-3 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm transition-all hover:scale-105"
        >
            <FileText class="h-5 w-5 text-zx-primary" />
            <span class="text-sm font-medium text-zx-text">实时日志</span>
        </div>
        <div class="flex w-full items-center space-x-2 sm:w-auto">
            <button
                @click="autoScroll = !autoScroll"
                :class="
                    autoScroll
                        ? 'bg-zx-primary-soft text-zx-primary'
                        : 'bg-gray-100 text-zx-text-muted'
                "
                class="btn-touch flex-shrink-0 cursor-pointer rounded-2xl px-3 py-1.5 text-sm font-medium shadow-sm transition-colors"
            >
                自动滚动 {{ autoScroll ? "开" : "关" }}
            </button>
            <button
                @click="clearLogs"
                class="btn-touch flex-shrink-0 cursor-pointer rounded-2xl px-3 py-1.5 text-sm font-medium text-zx-danger shadow-sm transition-colors hover:bg-zx-danger-soft"
            >
                清空日志
            </button>
        </div>
    </div>
</template>

<style scoped></style>
