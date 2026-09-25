<script setup lang="ts">
import { computed } from "vue";
import ZxEmptyState from "@/components/zxcomponent/ZxEmptyState.vue";
import type { RankListItem } from "./RankList.vue";

const props = withDefaults(
    defineProps<{
        items: RankListItem[];
        loading?: boolean;
        emptyText?: string;
        max?: number;
        valueSuffix?: string;
        /** 列表最大高度，不足时随内容收缩 */
        listHeight?: string;
        /** 群聊等带头像；插件关掉 */
        showAvatar?: boolean;
    }>(),
    {
        loading: false,
        emptyText: "暂无数据",
        max: 10,
        valueSuffix: "",
        listHeight: "320px",
        showAvatar: true,
    },
);

const rows = computed(() => {
    const sorted = [...props.items]
        .sort((a, b) => b.value - a.value)
        .slice(0, props.max);
    const top = sorted[0]?.value || 1;
    return sorted.map((item, index) => {
        const pct = Math.max((item.value / top) * 100, 4);
        return {
            ...item,
            pct,
            rank: index + 1,
        };
    });
});
</script>

<template>
    <div>
        <div
            v-if="loading"
            class="space-y-4"
            :style="{ maxHeight: listHeight }"
        >
            <div v-for="i in 4" :key="i" class="space-y-2">
                <div class="flex items-center gap-2.5">
                    <div
                        v-if="showAvatar"
                        class="h-8 w-8 animate-pulse rounded-full bg-slate-100"
                    ></div>
                    <div class="h-4 flex-1 animate-pulse rounded bg-slate-100"></div>
                </div>
                <div class="h-3 animate-pulse rounded-full bg-slate-100"></div>
            </div>
        </div>

        <ZxEmptyState
            v-else-if="rows.length === 0"
            size="sm"
            :text="emptyText"
        />

        <ul
            v-else
            class="scroll-area -mr-4 flex max-h-[320px] flex-col gap-3 overflow-y-auto pr-3 sm:-mr-5"
            :style="{ maxHeight: listHeight }"
        >
            <li v-for="row in rows" :key="row.id">
                <div class="mb-1.5 flex items-center gap-2.5">
                    <!-- 头像（仅 showAvatar） -->
                    <div v-if="showAvatar" class="relative flex-shrink-0">
                        <ZxAvatar
                            :src="row.avatar"
                            :name="row.name"
                            size="sm"
                        />
                    </div>

                    <div class="min-w-0 flex-1">
                        <div
                            class="truncate text-sm text-zx-text"
                            :title="row.name"
                        >
                            {{ row.name }}
                        </div>
                        <div
                            v-if="row.subtitle && showAvatar"
                            class="truncate text-[11px] text-zx-text-subtle"
                        >
                            {{ row.subtitle }}
                        </div>
                    </div>

                    <span
                        class="flex-shrink-0 text-sm font-bold tabular-nums text-zx-text-strong"
                    >
                        {{ row.value.toLocaleString() }}{{ valueSuffix }}
                    </span>

                    <span
                        class="flex-shrink-0 text-[11px] font-medium tabular-nums"
                        :class="
                            row.rank <= 3
                                ? 'text-zx-primary'
                                : 'text-zx-text-subtle'
                        "
                    >
                        #{{ row.rank }}
                    </span>
                </div>

                <div class="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                        class="h-full rounded-full bg-zx-primary transition-all duration-500"
                        :style="{ width: `${row.pct}%` }"
                    ></div>
                </div>
            </li>
        </ul>
    </div>
</template>

<style scoped>
/* 始终预留滚动条槽位，出现时不引起宽度跳动（外观走全局滚动条） */
.scroll-area {
    scrollbar-gutter: stable;
}

@media (prefers-reduced-motion: reduce) {
    .scroll-area * {
        transition: none !important;
    }
}
</style>
