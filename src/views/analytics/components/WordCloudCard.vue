<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { WordCloudItem } from "@/types/api-next.types";

const props = withDefaults(
    defineProps<{
        words?: WordCloudItem[];
        loading?: boolean;
    }>(),
    {
        words: () => [],
        loading: false,
    },
);

const rootRef = ref<HTMLElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const empty = ref(false);

let ro: ResizeObserver | null = null;

const COLORS = [
    "#3b82f6",
    "#06b6d4",
    "#8b5cf6",
    "#f59e0b",
    "#22c55e",
    "#64748b",
    "#ec4899",
    "#0ea5e9",
];

function draw() {
    const canvas = canvasRef.value;
    const root = rootRef.value;
    if (!canvas || !root) return;

    const w = root.clientWidth;
    const h = root.clientHeight;
    if (w < 40 || h < 40) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const list = props.words.filter((x) => x.value > 0);
    empty.value = list.length === 0;
    if (!list.length) return;

    const max = list[0].value;
    const min = list[list.length - 1].value || 1;
    const maxFont = Math.max(18, Math.min(36, w * 0.11));
    const minFont = 11;

    // 椭圆螺旋布局：大词靠中心，小词向外
    const placed: { x: number; y: number; bw: number; bh: number }[] = [];
    const cx = w / 2;
    const cy = h / 2;

    const fits = (
        x: number,
        y: number,
        bw: number,
        bh: number,
    ): boolean => {
        const pad = 3;
        if (
            x - bw / 2 - pad < 0 ||
            y - bh / 2 - pad < 0 ||
            x + bw / 2 + pad > w ||
            y + bh / 2 + pad > h
        ) {
            return false;
        }
        for (const p of placed) {
            if (
                Math.abs(x - p.x) < (bw + p.bw) / 2 + pad &&
                Math.abs(y - p.y) < (bh + p.bh) / 2 + pad
            ) {
                return false;
            }
        }
        return true;
    };

    list.forEach((item, idx) => {
        const t =
            max === min ? 1 : (item.value - min) / Math.max(1, max - min);
        const font = Math.round(minFont + (maxFont - minFont) * Math.pow(t, 0.7));
        const color = COLORS[idx % COLORS.length];
        ctx.font = `600 ${font}px system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif`;
        const metrics = ctx.measureText(item.text);
        const bw = metrics.width + 4;
        const bh = font * 1.15;

        let x = cx;
        let y = cy;
        let found = false;
        // 椭圆螺旋向外找落点
        for (let step = 0; step < 800; step++) {
            const angle = step * 0.35;
            const radius = 1.4 * step;
            x = cx + Math.cos(angle) * radius * 1.15;
            y = cy + Math.sin(angle) * radius * 0.72;
            if (fits(x, y, bw, bh)) {
                found = true;
                break;
            }
        }
        if (!found && idx > 3) return;
        if (!found) {
            x = cx + (idx % 3) * 20 - 20;
            y = cy + Math.floor(idx / 3) * 18 - 18;
        }

        placed.push({ x, y, bw, bh });
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.55 + t * 0.45;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(item.text, x, y);
        ctx.globalAlpha = 1;
    });
}

onMounted(() => {
    ro = new ResizeObserver(() => draw());
    if (rootRef.value) ro.observe(rootRef.value);
    draw();
});

onBeforeUnmount(() => {
    ro?.disconnect();
    ro = null;
});

watch(
    () => [props.words, props.loading],
    () => {
        if (!props.loading) draw();
    },
    { deep: true },
);
</script>

<template>
    <div
        class="flex min-h-0 shrink-0 flex-col rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
    >
        <div class="mb-2 flex items-center justify-between gap-2">
            <h3 class="text-sm font-semibold text-zx-text-strong">词云</h3>
            <span class="text-[11px] text-zx-text-subtle">区间热词</span>
        </div>

        <div ref="rootRef" class="relative h-[220px] w-full sm:h-[280px] lg:h-[320px]">
            <div
                v-if="loading"
                class="absolute inset-0 flex items-center justify-center"
            >
                <div
                    class="h-7 w-7 animate-spin rounded-full border-2 border-zx-primary border-b-transparent"
                ></div>
            </div>
            <ZxEmptyState
                v-else-if="empty"
                text="暂无热词"
                size="sm"
                class="absolute inset-0"
            />
            <canvas ref="canvasRef" class="absolute inset-0"></canvas>
        </div>
    </div>
</template>
