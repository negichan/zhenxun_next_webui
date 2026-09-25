<script lang="ts" setup>
import { Blocks, RotateCw } from "lucide-vue-next";
import { useStoreStore } from "@/store/store.ts";
import { storeToRefs } from "pinia";
import { computed } from "vue";
import { StorePlugin } from "@/types";

const storeStore = useStoreStore();

const { loading, storeData } = storeToRefs(storeStore);
const { loadStoreData } = storeStore;

// 统计信息
const stats = computed(() => {
    if (!storeData.value) return { total: 0, installed: 0, available: 0 };
    const total = storeData.value.plugin_list.length;
    const installed = storeData.value.plugin_list.filter(
        (p: StorePlugin) => p.is_installed,
    ).length;
    return { total, installed, available: total - installed };
});
</script>

<template>
    <!-- w-fit：与 PluginIsland 一致，不要撑满 header -->
    <div class="flex w-fit items-center gap-2">
        <div
            class="group flex w-fit items-center space-x-3 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm transition-all hover:scale-105"
        >
            <Blocks class="h-5 w-5 text-blue-500" />
            <span class="text-sm font-medium whitespace-nowrap text-zx-text">插件管理</span>
        </div>

        <!-- 核心统计：与 PluginIsland 同档（xl 再出全量） -->
        <div class="flex items-center gap-2">
            <div
                class="group flex w-fit items-center space-x-2 rounded-full border border-slate-200 bg-white px-3 py-2 shadow-sm transition-all hover:scale-105 sm:px-4"
            >
                <span
                    v-odometer="stats.total"
                    class="text-sm font-black text-blue-500"
                ></span>
                <div class="h-3 w-[1px] bg-black/30"></div>
                <span class="text-xs whitespace-nowrap text-zx-text-muted">总插件数</span>
            </div>
            <div
                class="group flex w-fit items-center space-x-2 rounded-full border border-slate-200 bg-white px-3 py-2 shadow-sm transition-all hover:scale-105 sm:px-4"
            >
                <span
                    v-odometer="stats.installed"
                    class="text-sm font-black text-green-500"
                ></span>
                <div class="h-3 w-[1px] bg-black/30"></div>
                <span class="text-xs whitespace-nowrap text-zx-text-muted">已安装</span>
            </div>
            <div class="hidden items-center gap-2 xl:flex">
                <div
                    class="group flex w-fit items-center space-x-2 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm transition-all hover:scale-105"
                >
                    <span
                        v-odometer="stats.available"
                        class="text-sm font-black text-orange-500"
                    ></span>
                    <div class="h-3 w-[1px] bg-black/30"></div>
                    <span class="text-xs whitespace-nowrap text-zx-text-muted">可安装</span>
                </div>
            </div>
        </div>

        <button
            @click="loadStoreData"
            :disabled="loading"
            class="btn-touch flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm transition-all hover:scale-105 hover:bg-gray-50 disabled:opacity-50"
            title="刷新列表"
        >
            <RotateCw class="h-4 w-4 text-zx-text-muted" :class="{ 'animate-spin': loading }" />
        </button>
    </div>
</template>

<style scoped></style>
