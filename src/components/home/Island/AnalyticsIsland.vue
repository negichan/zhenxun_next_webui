<script setup lang="ts">
import { Activity, RotateCw } from "lucide-vue-next";
import { useAnalyticsStore } from "@/store/analytics";
import { storeToRefs } from "pinia";

const analyticsStore = useAnalyticsStore();
const { granularity, selectedQuickRange, startTime, endTime } =
    storeToRefs(analyticsStore);

const quickTimeRanges = [
    { label: "1天", value: "1d", hours: 24 },
    { label: "7天", value: "7d", hours: 7 * 24 },
    { label: "30天", value: "30d", hours: 30 * 24 },
    { label: "90天", value: "90d", hours: 90 * 24 },
    { label: "自定义", value: "custom", hours: null },
] as const;

const granularityOptions = [
    { label: "时", value: "hour" },
    { label: "天", value: "day" },
    { label: "周", value: "week" },
    { label: "月", value: "month" },
] as const;

const handleRangeChange = (val: (typeof quickTimeRanges)[number]["value"]) => {
    selectedQuickRange.value = val;
    const range = quickTimeRanges.find((r) => r.value === val);
    if (!range || range.value === "custom") {
        if (!analyticsStore.startTime || !analyticsStore.endTime) {
            analyticsStore.setDefaultTimeRange(30 * 24);
        }
        return;
    }
    analyticsStore.setDefaultTimeRange(range.hours || 30 * 24);
    analyticsStore.triggerRefresh();
};

const handleGranularityChange = (
    val: (typeof granularityOptions)[number]["value"],
) => {
    granularity.value = val;
    analyticsStore.triggerRefresh();
};

const refresh = () => {
    if (!startTime.value || !endTime.value) {
        analyticsStore.setDefaultTimeRange(30 * 24);
    }
    analyticsStore.triggerRefresh();
};
</script>

<template>
    <!-- 全部胶囊包裹，与 PluginIsland 同档 -->
    <div class="flex w-fit max-w-full flex-wrap items-center gap-2">
        <div
            class="group flex w-fit items-center space-x-3 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm transition-all hover:scale-105"
        >
            <Activity class="h-5 w-5 text-zx-primary" />
            <span class="text-sm font-medium whitespace-nowrap text-zx-text">
                数据统计
            </span>
        </div>

        <!-- 时间范围：白胶囊 + 内按钮（h-9 与标题/刷新对齐） -->
        <div
            class="flex h-9 w-fit items-center space-x-0.5 rounded-full border border-slate-200 bg-white px-1 shadow-sm"
        >
            <button
                v-for="range in quickTimeRanges"
                :key="range.value"
                type="button"
                class="btn-touch flex h-full items-center rounded-full px-2.5 text-xs font-medium whitespace-nowrap transition-all duration-200"
                :class="
                    selectedQuickRange === range.value
                        ? 'bg-zx-primary text-[color:var(--zx-color-on-primary)] shadow-2xs'
                        : 'text-zx-text-muted hover:bg-gray-100 hover:text-zx-text'
                "
                @click="handleRangeChange(range.value)"
            >
                {{ range.label }}
            </button>
        </div>

        <!-- 粒度：手机收起 -->
        <div
            class="hidden h-9 w-fit items-center space-x-0.5 rounded-full border border-slate-200 bg-white px-1 shadow-sm sm:flex"
        >
            <button
                v-for="opt in granularityOptions"
                :key="opt.value"
                type="button"
                class="btn-touch flex h-full items-center rounded-full px-2.5 text-xs font-medium whitespace-nowrap transition-all duration-200"
                :class="
                    granularity === opt.value
                        ? 'bg-zx-primary text-[color:var(--zx-color-on-primary)] shadow-2xs'
                        : 'text-zx-text-muted hover:bg-gray-100 hover:text-zx-text'
                "
                @click="handleGranularityChange(opt.value)"
            >
                {{ opt.label }}
            </button>
        </div>

        <button
            type="button"
            class="btn-touch flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm transition-all hover:scale-105 hover:bg-gray-50"
            title="刷新数据"
            @click="refresh"
        >
            <RotateCw class="h-4 w-4 text-zx-text-muted" />
        </button>
    </div>
</template>
