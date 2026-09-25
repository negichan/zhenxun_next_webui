<script setup lang="ts">
import { computed, ref } from "vue";
import RankList, { type RankListItem } from "./RankList.vue";

type TabKey = "favor" | "gold";

const props = withDefaults(
    defineProps<{
        favorabilityItems: RankListItem[];
        goldItems: RankListItem[];
        loading?: boolean;
    }>(),
    { loading: false },
);

const activeTab = ref<TabKey>("favor");

const tabs = [
    { label: "好感度", value: "favor" as const },
    { label: "金币", value: "gold" as const },
];

const items = computed(() =>
    activeTab.value === "favor" ? props.favorabilityItems : props.goldItems,
);

const emptyText = computed(() =>
    activeTab.value === "favor" ? "暂无好感度数据" : "暂无金币数据",
);
</script>

<template>
    <div
        class="flex min-h-0 shrink-0 flex-col rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
    >
        <div class="mb-3 flex items-center justify-between gap-3">
            <h3 class="text-sm font-semibold text-zx-text-strong">排行</h3>
            <ZxSegmented v-model="activeTab" :options="tabs" size="sm" />
        </div>

        <RankList
            :key="activeTab"
            :items="items"
            :loading="loading"
            :tone="activeTab === 'favor' ? 'cyan' : 'amber'"
            :max="10"
            :empty-text="emptyText"
        />
    </div>
</template>
