<script setup lang="ts">
import { computed, onActivated, onMounted, ref, watch } from "vue";
import { Bar } from "vue-chartjs";
import {
    BarElement,
    CategoryScale,
    Chart as ChartJS,
    type ChartDataset,
    type ChartOptions,
    Filler,
    Legend,
    LinearScale,
    LineElement,
    PointElement,
    Title,
    Tooltip,
} from "chart.js";
import {
    Activity,
    Flame,
    MessageSquare,
    Minus,
    RefreshCw,
    TrendingDown,
    TrendingUp,
    Zap,
} from "lucide-vue-next";
import { storeToRefs } from "pinia";
import { analyticsApi, mainApi } from "@/utils/api-next";
import { ZXNotification } from "@/services/ui";
import { useGlobalStore } from "@/store/global";
import { useAnalyticsStore } from "@/store/analytics";
import type { ActiveGroup, HotPlugin } from "@/types/main.types";
import type {
    AnalyticsOverview,
    FavorabilityRank,
    FriendStatistics,
    GoldRank,
    Granularity,
    GroupStatistics,
    MessageHeatmap,
    TrendData,
} from "@/types/api-next.types";
import { createBarOptions, getChartColors } from "@/utils/chart-theme";
import ZxButton from "@/components/zxcomponent/ZxButton.vue";
import StatisticsCard from "@/views/dashboard/StatisticsCard.vue";
import RankList, { type RankListItem } from "./components/RankList.vue";
import DetailStatsTable from "./components/DetailStatsTable.vue";
import EconomyRankCard from "./components/EconomyRankCard.vue";
import WordCloudCard from "./components/WordCloudCard.vue";
import ActivityHeatmap from "./components/ActivityHeatmap.vue";
import FunnelBarList from "./components/FunnelBarList.vue";

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler,
    BarElement,
);

const globalStore = useGlobalStore();
const analyticsStore = useAnalyticsStore();
const { startTime, endTime, granularity, selectedQuickRange, refreshSignal } =
    storeToRefs(analyticsStore);

// ==================== 时间范围 ====================
const quickTimeRanges = [
    { label: "1天", value: "1d", hours: 24 },
    { label: "7天", value: "7d", hours: 7 * 24 },
    { label: "30天", value: "30d", hours: 30 * 24 },
    { label: "90天", value: "90d", hours: 90 * 24 },
    { label: "自定义", value: "custom", hours: null },
] as const;

const granularityOptions = [
    { label: "小时", value: "hour" as Granularity },
    { label: "天", value: "day" as Granularity },
    { label: "周", value: "week" as Granularity },
    { label: "月", value: "month" as Granularity },
] as const;

const showCustomRange = computed(() => selectedQuickRange.value === "custom");

const formatLocalIso = (date: Date): string => {
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const startTimeLocal = computed({
    get: () => (startTime.value || "").slice(0, 19),
    set: (v: string) => {
        startTime.value = v ? (v.length === 16 ? `${v}:00` : v) : "";
    },
});

const endTimeLocal = computed({
    get: () => (endTime.value || "").slice(0, 19),
    set: (v: string) => {
        endTime.value = v ? (v.length === 16 ? `${v}:00` : v) : "";
    },
});

const rangeLabel = computed(() => {
    if (!startTime.value || !endTime.value) return "";
    const start = startTime.value.slice(0, 10);
    const end = endTime.value.slice(0, 10);
    const days = Math.max(
        1,
        Math.round(
            (new Date(endTime.value).getTime() -
                new Date(startTime.value).getTime()) /
                86400000,
        ),
    );
    return `${start} ~ ${end}`;
});

const handleQuickRange = (
    rangeOrVal:
        | (typeof quickTimeRanges)[number]
        | (typeof quickTimeRanges)[number]["value"],
) => {
    const val = typeof rangeOrVal === "string" ? rangeOrVal : rangeOrVal.value;
    const range = quickTimeRanges.find((r) => r.value === val);
    selectedQuickRange.value = val;
    if (!range || range.value === "custom") {
        if (!startTime.value || !endTime.value) {
            analyticsStore.setDefaultTimeRange(30 * 24);
        }
        return;
    }
    analyticsStore.setDefaultTimeRange(range.hours || 30 * 24);
    void refreshAll();
};

const handleGranularity = (value: Granularity) => {
    granularity.value = value;
    void loadTrendData();
};

const applyCustomRange = () => {
    if (!startTime.value || !endTime.value) {
        ZXNotification({
            title: "呜呼～",
            message: "请先选择起止时间 (っ °Д °;) っ",
            type: "error",
            position: "top-right",
        });
        return;
    }
    if (new Date(startTime.value) >= new Date(endTime.value)) {
        ZXNotification({
            title: "呜呼～",
            message: "起始时间要早于结束时间 (っ °Д °;) っ",
            type: "error",
            position: "top-right",
        });
        return;
    }
    const diffHours =
        (new Date(endTime.value).getTime() -
            new Date(startTime.value).getTime()) /
        3600000;
    if (diffHours > 7 * 24 && granularity.value === "hour") {
        granularity.value = "day";
    }
    void refreshAll();
};

// ==================== 加载状态 ====================
const isOverviewLoading = ref(false);
const isTrendLoading = ref(false);
const isRankLoading = ref(false);
const isDetailLoading = ref(false);
const isEconomyLoading = ref(false);
const isHeatmapLoading = ref(false);
const isWordCloudLoading = ref(false);

const isRefreshing = computed(
    () =>
        isOverviewLoading.value ||
        isTrendLoading.value ||
        isRankLoading.value ||
        isDetailLoading.value ||
        isEconomyLoading.value ||
        isHeatmapLoading.value ||
        isWordCloudLoading.value,
);

// ==================== 数据 ====================
const overview = ref<AnalyticsOverview | null>(null);
const trendData = ref<TrendData | null>(null);
const prevTrendData = ref<TrendData | null>(null);
const heatmap = ref<MessageHeatmap | null>(null);
const wordCloudWords = ref<import("@/types/api-next.types").WordCloudItem[]>([]);
const groupStats = ref<GroupStatistics[]>([]);
const friendStats = ref<FriendStatistics[]>([]);
const activeGroups = ref<ActiveGroup[]>([]);
const hotPlugins = ref<HotPlugin[]>([]);
const favorability = ref<FavorabilityRank[]>([]);
const goldRanks = ref<GoldRank[]>([]);

const showMessages = ref(true);
const showCalls = ref(true);
const showPrevPeriod = ref(true);

const toggleSeries = (series: "msg" | "call") => {
    if (series === "msg") {
        if (showMessages.value && !showCalls.value) return;
        showMessages.value = !showMessages.value;
    } else {
        if (showCalls.value && !showMessages.value) return;
        showCalls.value = !showCalls.value;
    }
};

// ==================== KPI：与首页 Dashboard 统计卡同款 ====================
const kpiCards = computed(() => {
    const o = overview.value;
    const trend = trendData.value;
    const messageCount = o?.message_count ?? trend?.total_message_count ?? null;
    const callCount =
        o?.plugin_call_count ?? trend?.total_plugin_call_count ?? null;
    const points = trend?.data_points?.length ?? 0;
    const avgDaily =
        o?.avg_daily_messages ??
        (trend && points > 0
            ? Math.round(trend.total_message_count / points)
            : null);
    const callRate =
        messageCount && callCount !== null
            ? (callCount / messageCount) * 100
            : null;

    const pct = (curr: number | null, prev: number | null) => {
        if (curr === null || prev === null || !prev) return null;
        return ((curr - prev) / prev) * 100;
    };

    const msgDelta = o ? pct(o.message_count, o.prev_message_count) : null;
    const callDelta = o
        ? pct(o.plugin_call_count, o.prev_plugin_call_count)
        : null;

    const toTrend = (d: number | null): "up" | "down" | "stable" => {
        if (d === null) return "stable";
        return d >= 0 ? "up" : "down";
    };

    return [
        {
            key: "msg",
            title: "区间消息",
            value: messageCount ?? 0,
            icon: MessageSquare,
            colorClass: "text-sky-500",
            change: msgDelta,
            trend: toTrend(msgDelta),
            showPercent: false,
        },
        {
            key: "call",
            title: "区间调用",
            value: callCount ?? 0,
            icon: Zap,
            colorClass: "text-amber-500",
            change: callDelta,
            trend: toTrend(callDelta),
            showPercent: false,
        },
        {
            key: "avg",
            title: "日均消息",
            value: avgDaily ?? 0,
            icon: Activity,
            colorClass: "text-emerald-500",
            change: null,
            trend: "stable" as const,
            showPercent: false,
        },
        {
            key: "rate",
            title: "调用率",
            value: callRate === null ? 0 : Number(callRate.toFixed(1)),
            icon: Flame,
            colorClass: "text-violet-500",
            change: null,
            trend: "stable" as const,
            showPercent: true,
        },
    ];
});

const activeGroupItems = computed<RankListItem[]>(() =>
    activeGroups.value.map((g) => ({
        id: g.group_id,
        name: g.name || g.group_id,
        value: g.chat_num,
        avatar: g.ava_img,
        subtitle: g.group_id,
    })),
);

const hotPluginItems = computed<RankListItem[]>(() =>
    hotPlugins.value.map((p) => ({
        id: p.module || p.plugin_name || String(p.call_count),
        name: p.plugin_name || p.module || "未知插件",
        value: p.call_count,
    })),
);

const favorabilityItems = computed<RankListItem[]>(() =>
    favorability.value.map((u) => ({
        id: u.user_id,
        name: u.user_name,
        value: Number(u.favorability),
        avatar: u.ava_url,
        subtitle: u.user_id,
    })),
);

const goldItems = computed<RankListItem[]>(() =>
    goldRanks.value.map((u) => ({
        id: u.user_id,
        name: u.user_name,
        value: Number(u.gold),
        avatar: u.ava_url,
        subtitle: u.user_id,
    })),
);

// ==================== 趋势：本期堆叠柱 + 上期灰线 ====================
const chartColors = getChartColors();

const formatLabel = (timestamp: string) => {
    const date = new Date(timestamp);
    if (granularity.value === "hour") {
        return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:00`;
    }
    if (granularity.value === "week") {
        return `第${Math.ceil(date.getDate() / 7)}周`;
    }
    if (granularity.value === "month") {
        return `${date.getFullYear()}年${date.getMonth() + 1}月`;
    }
    return `${date.getMonth() + 1}/${date.getDate()}`;
};

const chartOptions = computed<ChartOptions<"bar">>(() =>
    createBarOptions({
        plugins: {
            legend: { display: false },
            tooltip: {
                mode: "index",
                intersect: false,
            },
        },
        scales: {
            x: {
                stacked: true,
                grid: { display: false },
                ticks: {
                    maxRotation: 0,
                    autoSkip: true,
                    maxTicksLimit: 12,
                },
            },
            y: {
                stacked: true,
                beginAtZero: true,
                ticks: { precision: 0 },
            },
        },
    }),
);

const chartData = computed(() => {
    if (!trendData.value?.data_points?.length) return null;
    const labels = trendData.value.data_points.map((p) =>
        formatLabel(p.timestamp),
    );

    const datasets: ChartDataset<"bar" | "line">[] = [];

    if (showMessages.value) {
        datasets.push({
            type: "bar",
            label: "消息",
            data: trendData.value.data_points.map((p) => p.message_count),
            backgroundColor: chartColors.blue.solid,
            borderRadius: 0,
            borderSkipped: false,
            maxBarThickness: 28,
            categoryPercentage: 0.72,
            barPercentage: 0.9,
            stack: "curr",
        });
    }
    if (showCalls.value) {
        datasets.push({
            type: "bar",
            label: "调用",
            data: trendData.value.data_points.map((p) => p.plugin_call_count),
            backgroundColor: chartColors.pink.solid,
            borderRadius: showMessages.value
                ? { topLeft: 6, topRight: 6 }
                : 6,
            borderSkipped: false,
            maxBarThickness: 28,
            categoryPercentage: 0.72,
            barPercentage: 0.9,
            stack: "curr",
        });
    }

    if (showPrevPeriod.value && prevTrendData.value?.data_points?.length) {
        const prevPoints = prevTrendData.value.data_points;
        // 对齐点数：多退少补 null，线会断开但不串位
        const aligned = trendData.value.data_points.map((_, i) => {
            const p = prevPoints[i];
            if (!p) return null;
            if (showMessages.value && showCalls.value) {
                return p.message_count + p.plugin_call_count;
            }
            if (showMessages.value) return p.message_count;
            return p.plugin_call_count;
        });
        datasets.push({
            type: "line",
            label: "上期",
            data: aligned,
            borderColor: chartColors.slate.solid,
            backgroundColor: "transparent",
            borderWidth: 2,
            borderDash: [5, 4],
            pointRadius: 0,
            pointHoverRadius: 4,
            tension: 0.3,
            fill: false,
            order: 0,
        });
    }

    return {
        labels,
        // 混合 bar + line：放宽为 bar ChartData 以通过 vue-chartjs 类型
        datasets: datasets as unknown as ChartDataset<"bar">[],
    };
});

// ==================== API ====================
const loadOverview = async () => {
    try {
        isOverviewLoading.value = true;
        const res = await analyticsApi.getOverview({
            start_time: startTime.value,
            end_time: endTime.value,
        });
        if (res?.success && res?.data) overview.value = res.data;
    } catch (error) {
        console.error("加载区间概览失败:", error);
    } finally {
        isOverviewLoading.value = false;
    }
};

const loadTrendData = async () => {
    try {
        isTrendLoading.value = true;
        const start = new Date(startTime.value);
        const end = new Date(endTime.value);
        const span = Math.max(end.getTime() - start.getTime(), 3600000);
        const prevStart = new Date(start.getTime() - span);
        const prevEnd = start;

        const [currRes, prevRes] = await Promise.all([
            analyticsApi.getTrendData({
                start_time: startTime.value,
                end_time: endTime.value,
                granularity: granularity.value as Granularity,
            }),
            analyticsApi.getTrendData({
                start_time: formatLocalIso(prevStart),
                end_time: formatLocalIso(prevEnd),
                granularity: granularity.value as Granularity,
            }),
        ]);
        if (currRes?.success && currRes?.data) trendData.value = currRes.data;
        if (prevRes?.success && prevRes?.data) prevTrendData.value = prevRes.data;
    } catch (error) {
        console.error("加载趋势数据失败:", error);
        ZXNotification({
            title: "呜呼～",
            message: "趋势数据加载失败了 (っ °Д °;) っ",
            type: "error",
            position: "top-right",
        });
    } finally {
        isTrendLoading.value = false;
    }
};

const loadHeatmap = async () => {
    try {
        isHeatmapLoading.value = true;
        const res = await analyticsApi.getHeatmap({
            start_time: startTime.value,
            end_time: endTime.value,
        });
        if (res?.success && res?.data) heatmap.value = res.data;
    } catch (error) {
        console.error("加载热力图失败:", error);
    } finally {
        isHeatmapLoading.value = false;
    }
};

const loadWordCloud = async () => {
    try {
        isWordCloudLoading.value = true;
        const res = await analyticsApi.getWordCloud({
            start_time: startTime.value,
            end_time: endTime.value,
            limit: 80,
        });
        if (res?.success && res?.data) {
            wordCloudWords.value = res.data.words ?? [];
        }
    } catch (error) {
        console.error("加载词云失败:", error);
    } finally {
        isWordCloudLoading.value = false;
    }
};

const loadDetailStatistics = async () => {
    try {
        isDetailLoading.value = true;
        const res = await analyticsApi.getStatistics({
            start_time: startTime.value,
            end_time: endTime.value,
        });
        if (res?.success && res?.data) {
            groupStats.value = res.data.groups ?? [];
            friendStats.value = res.data.friends ?? [];
        }
    } catch (error) {
        console.error("加载明细统计失败:", error);
    } finally {
        isDetailLoading.value = false;
    }
};

const loadRankData = async () => {
    try {
        isRankLoading.value = true;
        const [groupRes, pluginRes] = await Promise.all([
            mainApi.getActiveGroups(
                undefined,
                undefined,
                startTime.value,
                endTime.value,
            ),
            mainApi.getHotPlugins(
                undefined,
                undefined,
                startTime.value,
                endTime.value,
            ),
        ]);
        if (groupRes?.success && groupRes?.data) {
            activeGroups.value = groupRes.data;
        }
        if (pluginRes?.success && pluginRes?.data) {
            hotPlugins.value = pluginRes.data as HotPlugin[];
        }
    } catch (error) {
        console.error("加载榜单失败:", error);
    } finally {
        isRankLoading.value = false;
    }
};

const loadEconomy = async () => {
    try {
        isEconomyLoading.value = true;
        const [favRes, goldRes] = await Promise.all([
            analyticsApi.getFavorabilityTop10(),
            analyticsApi.getGoldTop10(),
        ]);
        if (favRes?.success && favRes?.data) favorability.value = favRes.data;
        if (goldRes?.success && goldRes?.data) goldRanks.value = goldRes.data;
    } catch (error) {
        console.error("加载经济榜单失败:", error);
    } finally {
        isEconomyLoading.value = false;
    }
};

const refreshAll = async () => {
    if (!startTime.value || !endTime.value) {
        analyticsStore.setDefaultTimeRange(30 * 24);
    }
    await Promise.all([
        loadOverview(),
        loadTrendData(),
        loadHeatmap(),
        loadDetailStatistics(),
        loadRankData(),
        loadWordCloud(),
    ]);
};

const refreshManual = async () => {
    await Promise.all([refreshAll(), loadEconomy()]);
};

watch(refreshSignal, () => {
    void refreshAll();
});

onMounted(() => {
    void refreshManual();
});

onActivated(() => {
    if (overview.value) {
        void refreshAll();
    }
});
</script>

<template>
    <!-- 根容器锁高度，滚动交给内部面板（对齐 Config 页，避免被 Home 胶片带裁掉） -->
    <div class="analytics-page-root flex h-full min-h-0 w-full flex-col overflow-hidden">
        <div
            class="analytics-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain pb-6 sm:gap-4"
        >
        <!-- 页头：标题 + 范围 + 刷新；窄屏/自定义时补充控件 -->
        <div class="shrink-0 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
            <div
                class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
            >
                <div class="min-w-0">
                    <h1 class="text-base font-bold text-zx-text-strong sm:text-lg">
                        数据统计
                    </h1>
                    <p class="mt-0.5 text-xs text-zx-text-subtle">
                        消息 · 插件调用 · 活跃全景
                    </p>
                </div>

                <div class="flex flex-wrap items-center gap-2 sm:gap-3">
                    <span
                        v-if="rangeLabel"
                        class="max-w-full truncate rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs tabular-nums text-zx-text-muted"
                    >
                        {{ rangeLabel }}
                    </span>
                    <ZxButton
                        variant="outline"
                        size="sm"
                        :disabled="isRefreshing"
                        @click="refreshManual"
                    >
                        <RefreshCw
                            class="h-4 w-4"
                            :class="isRefreshing ? 'animate-spin' : ''"
                        />
                        刷新
                    </ZxButton>
                </div>
            </div>

            <div
                v-if="!globalStore.isDesktopMode || showCustomRange"
                class="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:gap-3"
            >
                <div
                    v-if="!globalStore.isDesktopMode"
                    class="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3"
                >
                    <div class="min-w-0 overflow-x-auto pb-0.5">
                        <ZxSegmented
                            :model-value="selectedQuickRange"
                            :options="quickTimeRanges"
                            size="sm"
                            @update:model-value="handleQuickRange"
                        />
                    </div>
                    <div class="min-w-0 overflow-x-auto pb-0.5">
                        <ZxSegmented
                            v-model="granularity"
                            :options="granularityOptions"
                            size="sm"
                            @change="handleGranularity"
                        />
                    </div>
                </div>

                <div
                    v-if="showCustomRange"
                    class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3"
                >
                    <label
                        class="flex flex-col gap-1 text-xs text-zx-text-muted sm:flex-row sm:items-center sm:gap-2 sm:text-sm"
                    >
                        起始
                        <input
                            v-model="startTimeLocal"
                            type="datetime-local"
                            step="1"
                            class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-zx-text transition-colors focus:bg-white focus:outline-none sm:w-[190px]"
                        />
                    </label>
                    <label
                        class="flex flex-col gap-1 text-xs text-zx-text-muted sm:flex-row sm:items-center sm:gap-2 sm:text-sm"
                    >
                        结束
                        <input
                            v-model="endTimeLocal"
                            type="datetime-local"
                            step="1"
                            class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-zx-text transition-colors focus:bg-white focus:outline-none sm:w-[190px]"
                        />
                    </label>
                    <ZxButton size="sm" @click="applyCustomRange">应用</ZxButton>
                </div>
            </div>
        </div>

        <!-- KPI：首页同款统计卡 -->
        <div class="grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
            <StatisticsCard
                v-for="card in kpiCards"
                :key="card.key"
                :title="card.title"
                :value="card.value"
                :icon="card.icon"
                :icon-color-class="card.colorClass"
                :change="card.change"
                :trend-icon="
                    card.trend === 'up'
                        ? TrendingUp
                        : card.trend === 'down'
                          ? TrendingDown
                          : Minus
                "
                :trend-color-class="
                    card.trend === 'up'
                        ? 'text-green-500'
                        : card.trend === 'down'
                          ? 'text-red-500'
                          : 'text-zx-text-subtle'
                "
                :show-percent="card.showPercent"
                :loading="
                    (isOverviewLoading && !overview) ||
                    (isTrendLoading && !trendData)
                "
            />
        </div>

        <!-- 左：热力图；右：趋势（窄屏纵排） -->
        <div
            class="grid shrink-0 grid-cols-1 gap-3 sm:gap-4 xl:grid-cols-[minmax(280px,auto)_minmax(0,1fr)]"
        >
            <div
                class="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
            >
                <div class="mb-1">
                    <h3
                        class="text-sm font-semibold text-zx-text-strong sm:text-base"
                    >
                        消息活跃时段
                    </h3>
                </div>
                <ActivityHeatmap :data="heatmap" :loading="isHeatmapLoading" />
            </div>

            <div
                class="min-w-0 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
            >
                <div
                    class="mb-3 flex flex-wrap items-center justify-between gap-2 sm:mb-4"
                >
                    <div>
                        <h3
                            class="text-sm font-semibold text-zx-text-strong sm:text-base"
                        >
                            消息与调用趋势
                        </h3>
                        <p class="mt-0.5 text-xs text-zx-text-subtle">
                            {{
                                granularityOptions.find(
                                    (o) => o.value === granularity,
                                )?.label
                            }}
                            粒度 · 虚线为上一等长周期
                        </p>
                    </div>
                    <div class="flex flex-wrap items-center gap-1.5">
                        <button
                            type="button"
                            class="btn-touch rounded-full border px-2.5 py-1 text-xs font-medium transition-colors"
                            :class="
                                showMessages
                                    ? 'text-white'
                                    : 'border-slate-200 text-zx-text-muted hover:border-slate-300'
                            "
                            :style="
                                showMessages
                                    ? {
                                          backgroundColor:
                                              chartColors.blue.solid,
                                          borderColor: chartColors.blue.solid,
                                      }
                                    : undefined
                            "
                            @click="toggleSeries('msg')"
                        >
                            消息
                        </button>
                        <button
                            type="button"
                            class="btn-touch rounded-full border px-2.5 py-1 text-xs font-medium transition-colors"
                            :class="
                                showCalls
                                    ? 'text-white'
                                    : 'border-slate-200 text-zx-text-muted hover:border-slate-300'
                            "
                            :style="
                                showCalls
                                    ? {
                                          backgroundColor:
                                              chartColors.pink.solid,
                                          borderColor: chartColors.pink.solid,
                                      }
                                    : undefined
                            "
                            @click="toggleSeries('call')"
                        >
                            调用
                        </button>
                        <button
                            type="button"
                            class="btn-touch rounded-full border px-2.5 py-1 text-xs font-medium transition-colors"
                            :class="
                                showPrevPeriod
                                    ? 'border-slate-600 bg-slate-600 text-white'
                                    : 'border-slate-200 text-zx-text-muted hover:border-slate-400'
                            "
                            @click="showPrevPeriod = !showPrevPeriod"
                        >
                            上期
                        </button>
                    </div>
                </div>
                <div class="relative h-48 sm:h-64 xl:h-72">
                    <div
                        v-if="isTrendLoading"
                        class="absolute inset-0 flex items-center justify-center"
                    >
                        <div
                            class="h-7 w-7 animate-spin rounded-full border-2 border-zx-primary border-b-transparent"
                        ></div>
                    </div>
                    <Bar
                        v-else-if="chartData && chartData.datasets.length > 0"
                        :data="chartData"
                        :options="chartOptions"
                    />
                    <ZxEmptyState
                        v-else
                        text="暂无趋势数据"
                        size="md"
                        class="h-full justify-center"
                    />
                </div>
            </div>
        </div>

        <!-- 排行：活跃 / 插件 / 经济 -->
        <div class="grid shrink-0 grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2">
            <div
                class="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
            >
                <div class="mb-3 flex items-baseline justify-between gap-2">
                    <h3 class="text-sm font-semibold text-zx-text-strong">
                        活跃群组
                    </h3>
                    <span class="text-[11px] text-zx-text-subtle">消息</span>
                </div>
                <FunnelBarList
                    :items="activeGroupItems"
                    :loading="isRankLoading"
                    :max="10"
                    list-height="320px"
                    empty-text="暂无活跃群组"
                />
            </div>

            <div
                class="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
            >
                <div class="mb-3 flex items-baseline justify-between gap-2">
                    <h3 class="text-sm font-semibold text-zx-text-strong">
                        热门插件
                    </h3>
                    <span class="text-[11px] text-zx-text-subtle">调用</span>
                </div>
                <FunnelBarList
                    :items="hotPluginItems"
                    :loading="isRankLoading"
                    :max="10"
                    list-height="320px"
                    :show-avatar="false"
                    empty-text="暂无插件调用"
                />
            </div>

            <EconomyRankCard
                :favorability-items="favorabilityItems"
                :gold-items="goldItems"
                :loading="isEconomyLoading"
            />
            <WordCloudCard
                :words="wordCloudWords"
                :loading="isWordCloudLoading"
            />
        </div>

        <!-- 明细表 -->
        <DetailStatsTable
            class="shrink-0"
            :groups="groupStats"
            :friends="friendStats"
            :loading="isDetailLoading"
        />
        </div>
    </div>
</template>

<style scoped>
/* 压住 Home 胶片带给页面根的 overflow-y:auto，滚动统一交给内部面板 */
.analytics-page-root {
    overflow: hidden !important;
}

/* flex 列滚动容器里，overflow:hidden 的卡片默认可被压到 0 高；
   禁止收缩，高度按内容撑开，才能滚到底 */
.analytics-scroll > * {
    flex-shrink: 0;
}
</style>
