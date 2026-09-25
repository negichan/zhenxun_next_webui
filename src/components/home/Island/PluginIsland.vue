<script lang="ts" setup>
import { Blocks, RotateCw } from "lucide-vue-next";
import { usePluginStore } from "@/store/plugin.ts";
import { storeToRefs } from "pinia";
import { computed } from "vue";

const pluginStore = usePluginStore();

const { loading, plugins } = storeToRefs(pluginStore);
const { loadPlugins } = pluginStore;

const stats = computed(() => {
    const total = plugins.value.length;
    const active = plugins.value.filter((p) => p.is_enabled).length;
    const builtin = plugins.value.filter((p) => p.is_builtin).length;
    return {
        total,
        active,
        inactive: total - active,
        builtin,
        third: total - builtin,
    };
});
</script>

<template>
    <!-- w-fit：不要撑满 header -->
    <div class="flex w-fit items-center gap-2">
        <div
            class="group flex w-fit items-center space-x-3 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm transition-all hover:scale-105"
        >
            <Blocks class="h-5 w-5 text-blue-500" />
            <span class="text-sm font-medium whitespace-nowrap text-zx-text"
                >插件管理</span
            >
        </div>

        <!-- 核心统计：平板也保留（禁用/内置 xl 再出） -->
        <div class="flex items-center gap-2">
            <div
                class="group flex w-fit items-center space-x-2 rounded-full border border-slate-200 bg-white px-3 py-2 shadow-sm transition-all hover:scale-105 sm:px-4"
            >
                <span
                    v-odometer="stats.total"
                    class="text-sm font-black text-blue-500"
                ></span>
                <div class="h-3 w-[1px] bg-black/30"></div>
                <span class="text-xs whitespace-nowrap text-zx-text-muted"
                    >总数</span
                >
            </div>
            <div
                class="group flex w-fit items-center space-x-2 rounded-full border border-slate-200 bg-white px-3 py-2 shadow-sm transition-all hover:scale-105 sm:px-4"
            >
                <span
                    v-odometer="stats.active"
                    class="text-sm font-black text-green-500"
                ></span>
                <div class="h-3 w-[1px] bg-black/30"></div>
                <span class="text-xs whitespace-nowrap text-zx-text-muted"
                    >启用</span
                >
            </div>
            <!-- 扩展统计：xl 以上 -->
            <div class="hidden items-center gap-2 xl:flex">
                <div
                    class="group flex w-fit items-center space-x-2 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm transition-all hover:scale-105"
                >
                    <span
                        v-odometer="stats.inactive"
                        class="text-sm font-black text-zx-text-muted"
                    ></span>
                    <div class="h-3 w-[1px] bg-black/30"></div>
                    <span class="text-xs whitespace-nowrap text-zx-text-muted"
                        >禁用</span
                    >
                </div>
                <div
                    class="group flex w-fit items-center space-x-2 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm transition-all hover:scale-105"
                >
                    <span
                        v-odometer="stats.builtin"
                        class="text-sm font-black text-purple-500"
                    ></span>
                    <div class="h-3 w-[1px] bg-black/30"></div>
                    <span class="text-xs whitespace-nowrap text-zx-text-muted"
                        >内置</span
                    >
                </div>
            </div>
        </div>

        <button
            :disabled="loading"
            class="btn-touch flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm transition-all hover:scale-105 hover:bg-gray-50 disabled:opacity-50"
            title="刷新列表"
            @click="loadPlugins"
        >
            <RotateCw class="h-4 w-4 text-zx-text-muted" :class="{ 'animate-spin': loading }" />
        </button>
    </div>
</template>

<style scoped></style>
