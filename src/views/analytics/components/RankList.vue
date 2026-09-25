<script setup lang="ts">
import { computed } from "vue";
import { ZXNotification } from "@/services/ui";

export interface RankListItem {
    id: string;
    name: string;
    value: number;
    avatar?: string;
    subtitle?: string;
}

const props = withDefaults(
    defineProps<{
        items: RankListItem[];
        loading?: boolean;
        /** 条形纯色：primary / cyan / amber（均取标准语义色相） */
        tone?: "primary" | "cyan" | "amber";
        valueSuffix?: string;
        emptyText?: string;
        max?: number;
    }>(),
    {
        loading: false,
        tone: "primary",
        valueSuffix: "",
        emptyText: "暂无数据",
        max: 10,
    },
);

const displayItems = computed(() => props.items.slice(0, props.max));

const maxValue = computed(() =>
    Math.max(...displayItems.value.map((i) => i.value), 1),
);

const barClass = computed(() => {
    if (props.tone === "cyan") return "bg-cyan-500";
    if (props.tone === "amber") return "bg-amber-500";
    return "bg-zx-primary";
});

const barTrackClass = computed(() => {
    if (props.tone === "cyan") return "bg-cyan-100";
    if (props.tone === "amber") return "bg-amber-100";
    return "bg-zx-primary-soft";
});

/** 名次徽标：MD3 chip 8dp 圆角，前三实色底 + 白字（金 warning / 银 neutral / 铜 warning 深档） */
const rankChip = (rank: number) => {
    if (rank === 1)
        return "bg-[#f59e0b] text-white";
    if (rank === 2) return "bg-gray-400 text-white";
    if (rank === 3) return "bg-[#d97706] text-white";
    return "bg-slate-100 text-zx-text-muted";
};

const isTop = (rank: number) => rank <= 3;

const copyId = async (id: string) => {
    if (!id) return;
    try {
        await navigator.clipboard.writeText(id);
        ZXNotification({
            title: "已复制",
            message: id,
            type: "info",
            position: "top-right",
        });
    } catch {
        ZXNotification({
            title: "复制失败",
            message: "浏览器拒绝了剪贴板权限 (っ °Д °;) っ",
            type: "error",
            position: "top-right",
        });
    }
};
</script>

<template>
    <div class="flex min-h-0 flex-col">
        <div
            v-if="loading"
            class="flex flex-1 items-center justify-center py-10"
        >
            <div
                class="h-7 w-7 animate-spin rounded-full border-2 border-zx-primary border-b-transparent"
            ></div>
        </div>

        <ZxEmptyState
            v-else-if="displayItems.length === 0"
            :text="emptyText"
            size="sm"
            class="flex-1 justify-center"
        />

        <ol
            v-else
            class="flex max-h-[320px] flex-col gap-1 overflow-y-auto overscroll-contain pr-1"
        >
            <li
                v-for="(item, index) in displayItems"
                :key="item.id"
                class="group rounded-2xl px-2.5 py-2.5 transition-colors hover:bg-slate-50"
                :class="isTop(index + 1) ? 'bg-slate-50/60' : ''"
            >
                <div class="flex items-center gap-3">
                    <span
                        class="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-xs font-semibold tabular-nums"
                        :class="rankChip(index + 1)"
                    >
                        {{ index + 1 }}
                    </span>

                    <ZxAvatar
                        :src="item.avatar"
                        :name="item.name"
                        :size="isTop(index + 1) ? 'md' : 'sm'"
                        class="flex-shrink-0"
                    />

                    <div class="min-w-0 flex-1">
                        <div class="flex items-baseline justify-between gap-3">
                            <div class="min-w-0">
                                <div
                                    class="truncate text-sm font-semibold text-zx-text-strong"
                                    :title="item.name"
                                >
                                    {{ item.name }}
                                </div>
                                <button
                                    v-if="item.subtitle"
                                    type="button"
                                    class="mt-0.5 max-w-full truncate text-left text-[11px] text-zx-text-subtle transition-colors hover:text-zx-primary"
                                    :title="`点击复制 ${item.subtitle}`"
                                    @click="copyId(item.subtitle)"
                                >
                                    {{ item.subtitle }}
                                </button>
                            </div>
                            <div
                                class="flex-shrink-0 text-right text-sm font-bold tabular-nums text-zx-text-strong"
                            >
                                {{ item.value.toLocaleString() }}{{ valueSuffix }}
                            </div>
                        </div>
                        <div
                            class="mt-2 h-1.5 overflow-hidden rounded-full"
                            :class="barTrackClass"
                        >
                            <div
                                class="h-full rounded-full transition-all duration-500"
                                :class="barClass"
                                :style="{
                                    width: `${Math.max((item.value / maxValue) * 100, 3)}%`,
                                }"
                            ></div>
                        </div>
                    </div>
                </div>
            </li>
        </ol>
    </div>
</template>
