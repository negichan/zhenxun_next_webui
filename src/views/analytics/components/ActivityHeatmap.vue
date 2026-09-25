<script setup lang="ts">
import { computed } from "vue";
import type { MessageHeatmap } from "@/types/api-next.types";

const props = defineProps<{
    data: MessageHeatmap | null;
    loading?: boolean;
}>();

/** 3 小时一行（8 行），高度取中间档 */
const BUCKET = 3;
const CELL_H = 28;
const GAP = 4;
const COL_W = 52;
const COL_GAP = 10;
const LABEL_W = 40;

const hourMatrix = computed(() => props.data?.matrix ?? []);
const hourCount = computed(() => props.data?.hours?.length ?? 24);

const buckets = computed(() => {
    const count = Math.ceil(hourCount.value / BUCKET);
    return Array.from({ length: count }, (_, i) => {
        const start = i * BUCKET;
        const end = Math.min(start + BUCKET, hourCount.value);
        return { start, end, label: `${start}时` };
    });
});

/** 按天 × 3h 桶聚合 */
const bucketMatrix = computed(() => {
    return dayLabels.value.map((_, d) =>
        buckets.value.map((b) => {
            let sum = 0;
            for (let h = b.start; h < b.end; h++) {
                sum += hourMatrix.value[d]?.[h] ?? 0;
            }
            return sum;
        }),
    );
});

const bucketMax = computed(() => {
    const flat = bucketMatrix.value.flat();
    return flat.length ? Math.max(...flat) : (props.data?.max_count ?? 1);
});

const levelOf = (value: number) => {
    if (value <= 0) return 0;
    const t = value / (bucketMax.value || 1);
    if (t < 0.2) return 1;
    if (t < 0.4) return 2;
    if (t < 0.6) return 3;
    if (t < 0.8) return 4;
    return 5;
};

const levelStyle = (level: number) => {
    if (level <= 0) {
        return { background: "var(--zx-color-surface-muted, #f8fafc)" };
    }
    const strength = 14 + (level / 5) * 86;
    return {
        background: `color-mix(in srgb, var(--zx-color-primary) ${strength}%, var(--zx-color-surface, #ffffff))`,
    };
};

const cellStyle = (value: number) => levelStyle(levelOf(value));

interface Segment {
    count: number;
    level: number;
    total: number;
    label: string;
}

/** 同色 3h 桶纵向合并 */
const columns = computed(() => {
    return dayLabels.value.map((day, d) => {
        const values = bucketMatrix.value[d] ?? [];
        const levels = values.map(levelOf);
        const segments: Segment[] = [];
        let i = 0;
        while (i < levels.length) {
            let j = i;
            while (j + 1 < levels.length && levels[j + 1] === levels[i]) {
                j++;
            }
            const total = values.slice(i, j + 1).reduce((s, v) => s + v, 0);
            const bStart = buckets.value[i];
            const bEnd = buckets.value[j];
            segments.push({
                count: j - i + 1,
                level: levels[i],
                total,
                label: `${day} ${bStart.start}-${bEnd.end}时 · ${total} 条`,
            });
            i = j + 1;
        }
        return { day, segments };
    });
});

const legendSwatches = computed(() => {
    const max = bucketMax.value;
    if (max <= 0) return [];
    return [0.15, 0.35, 0.55, 0.75, 1].map((r) =>
        cellStyle(Math.max(1, Math.round(max * r))),
    );
});

const dayLabels = computed(() =>
    (props.data?.weekdays ?? []).map((d) => d.replace("周", "")),
);

const segHeight = (count: number) => count * CELL_H + (count - 1) * GAP;
</script>

<template>
    <div class="flex flex-col gap-3">
        <div v-if="loading" class="flex items-center justify-center py-10">
            <div
                class="h-7 w-7 animate-spin rounded-full border-2 border-zx-primary border-b-transparent"
            ></div>
        </div>

        <ZxEmptyState
            v-else-if="!data || data.total === 0"
            text="该时间范围内暂无消息"
            size="sm"
            class="justify-center"
        />

        <template v-else>
            <div
                class="flex items-center justify-end gap-1.5 text-[11px] tabular-nums text-zx-text-subtle"
            >
                <span>0</span>
                <span
                    v-for="(swatch, i) in legendSwatches"
                    :key="i"
                    class="h-2.5 w-4 rounded-[3px]"
                    :style="swatch"
                ></span>
                <span>{{ bucketMax.toLocaleString() }}</span>
            </div>

            <div class="overflow-x-auto">
                <div class="inline-flex flex-col">
                    <div
                        class="inline-flex items-start"
                        :style="{ gap: `${COL_GAP}px` }"
                    >
                        <div
                            class="flex flex-shrink-0 flex-col"
                            :style="{ gap: `${GAP}px`, width: `${LABEL_W}px` }"
                        >
                            <div
                                v-for="bucket in buckets"
                                :key="bucket.label"
                                class="flex items-center justify-end pr-1 text-[11px] text-zx-text-muted"
                                :style="{ height: `${CELL_H}px` }"
                            >
                                {{ bucket.label }}
                            </div>
                        </div>

                        <div
                            v-for="col in columns"
                            :key="col.day"
                            class="flex flex-col"
                            :style="{
                                gap: `${GAP}px`,
                                width: `${COL_W}px`,
                            }"
                        >
                            <div
                                v-for="(seg, si) in col.segments"
                                :key="si"
                                class="group relative w-full rounded-md transition-[filter] duration-150 hover:brightness-95"
                                :style="{
                                    height: `${segHeight(seg.count)}px`,
                                    ...levelStyle(seg.level),
                                }"
                                :title="seg.label"
                            >
                                <span
                                    class="pointer-events-none absolute inset-0 flex items-center justify-center px-0.5 text-center text-[10px] font-semibold tabular-nums opacity-0 transition-opacity group-hover:opacity-100"
                                    :class="
                                        seg.level >= 4
                                            ? 'text-white'
                                            : 'text-zx-text-strong'
                                    "
                                >
                                    {{ seg.total }}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div
                        class="inline-flex items-start"
                        :style="{ gap: `${COL_GAP}px`, marginTop: '4px' }"
                    >
                        <div :style="{ width: `${LABEL_W}px` }"></div>
                        <div
                            v-for="col in columns"
                            :key="`label-${col.day}`"
                            class="text-center text-xs font-medium text-zx-text-muted"
                            :style="{ width: `${COL_W}px` }"
                        >
                            {{ col.day }}
                        </div>
                    </div>
                </div>
            </div>
        </template>
    </div>
</template>
