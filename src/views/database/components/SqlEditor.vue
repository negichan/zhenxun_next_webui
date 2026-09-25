<script setup lang="ts">
import { Clock, Play } from "lucide-vue-next";

const sql = defineModel<string>({ required: true });

defineProps<{
    executing: boolean;
}>();

const emit = defineEmits<{
    execute: [];
    openLog: [];
}>();
</script>

<template>
    <div class="flex flex-shrink-0 flex-col gap-2 border-b border-gray-100 p-3 sm:p-4">
        <div class="flex items-center justify-between gap-2">
            <span class="text-xs text-zx-text-subtle">Ctrl / ⌘ + Enter 执行</span>
            <ZxButton variant="ghost" size="sm" @click="emit('openLog')">
                <Clock class="h-4 w-4" />
                <span>日志</span>
            </ZxButton>
        </div>
        <div class="flex flex-col gap-2 sm:flex-row sm:items-stretch">
            <textarea
                v-model="sql"
                placeholder="输入 SQL 语句，例如 SELECT * FROM users LIMIT 20"
                rows="3"
                class="min-h-20 w-full flex-1 resize-y rounded-2xl border border-gray-200 bg-slate-50/60 px-3 py-2 font-mono text-sm leading-6 text-zx-text outline-none transition-colors focus:border-zx-primary focus:bg-white placeholder:text-zx-text-subtle"
                @keydown.meta.enter.prevent="emit('execute')"
                @keydown.ctrl.enter.prevent="emit('execute')"
            ></textarea>
            <div class="flex items-end sm:flex-col sm:justify-end">
                <ZxButton
                    :disabled="executing || !sql.trim()"
                    @click="emit('execute')"
                >
                    <Play class="h-4 w-4" />
                    <span>{{ executing ? "执行中..." : "执行" }}</span>
                </ZxButton>
            </div>
        </div>
    </div>
</template>
