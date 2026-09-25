<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from "vue";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-vue-next";

const props = withDefaults(
    defineProps<{
        /** "YYYY-MM-DD" 或空串表示未选择 */
        modelValue: string;
        placeholder?: string;
    }>(),
    { placeholder: "选择时间" },
);

const emit = defineEmits<{ "update:modelValue": [value: string] }>();

// ==================== 开合与定位（面板 Teleport 到 body，同 ZXDropdown） ====================
const triggerRef = ref<HTMLElement | null>(null);
const panelRef = ref<HTMLElement | null>(null);
const open = ref(false);
const pos = ref({ x: 0, y: 0 });

const PANEL_WIDTH = 240;

/** 优先左对齐触发器，视口右侧空间不足时自动向内自适应，底部放不下时向上翻 */
const updatePos = () => {
    const trigger = triggerRef.value;
    const panel = panelRef.value;
    if (!trigger || !panel) return;
    const r = trigger.getBoundingClientRect();
    const x = Math.max(
        8,
        Math.min(r.left, window.innerWidth - PANEL_WIDTH - 8),
    );
    let y = r.bottom + 6;
    if (y + panel.offsetHeight > window.innerHeight - 8) {
        y = Math.max(8, r.top - panel.offsetHeight - 6);
    }
    pos.value = { x, y };
};

const toggle = () => {
    open.value = !open.value;
    if (open.value) {
        // 让日历定位到已选日期（无选中则今天）
        const base = props.modelValue ? new Date(props.modelValue) : new Date();
        viewYear.value = base.getFullYear();
        viewMonth.value = base.getMonth();
        nextTick(updatePos);
    }
};

const onPointerDown = (e: PointerEvent) => {
    if (!open.value) return;
    const target = e.target as Node;
    if (
        triggerRef.value?.contains(target) ||
        panelRef.value?.contains(target)
    ) {
        return;
    }
    open.value = false;
};

const onKeydown = (e: KeyboardEvent) => {
    if (open.value && e.key === "Escape") open.value = false;
};

const onDismiss = () => {
    if (open.value) open.value = false;
};

onMounted(() => {
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeydown);
    window.addEventListener("scroll", onDismiss, true);
    window.addEventListener("resize", onDismiss);
});

onUnmounted(() => {
    window.removeEventListener("pointerdown", onPointerDown, true);
    window.removeEventListener("keydown", onKeydown);
    window.removeEventListener("scroll", onDismiss, true);
    window.removeEventListener("resize", onDismiss);
});

// ==================== 日历逻辑 ====================
const viewYear = ref(new Date().getFullYear());
const viewMonth = ref(new Date().getMonth());

const pad = (n: number) => String(n).padStart(2, "0");

const format = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const prevMonth = () => {
    if (viewMonth.value === 0) {
        viewYear.value -= 1;
        viewMonth.value = 11;
    } else {
        viewMonth.value -= 1;
    }
};

const nextMonth = () => {
    if (viewMonth.value === 11) {
        viewYear.value += 1;
        viewMonth.value = 0;
    } else {
        viewMonth.value += 1;
    }
};

interface DayCell {
    date: Date;
    inMonth: boolean;
}

/** 6x7 网格，含前后月补位 */
const cells = computed<DayCell[]>(() => {
    const first = new Date(viewYear.value, viewMonth.value, 1);
    // 周一作为一周开始
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(first);
    start.setDate(first.getDate() - offset);
    const cells: DayCell[] = [];
    for (let i = 0; i < 42; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        cells.push({
            date: d,
            inMonth: d.getMonth() === viewMonth.value,
        });
    }
    return cells;
});

const todayStr = format(new Date());

const select = (d: Date) => {
    emit("update:modelValue", format(d));
    open.value = false;
};

const clear = () => {
    emit("update:modelValue", "");
    open.value = false;
};

const weekdays = ["一", "二", "三", "四", "五", "六", "日"];
</script>

<template>
    <button
        ref="triggerRef"
        class="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-left text-xs transition-colors hover:border-slate-300"
        :class="modelValue ? 'text-zx-text' : 'text-zx-text-subtle'"
        type="button"
        @click="toggle"
    >
        <CalendarDays class="h-3.5 w-3.5 shrink-0 text-zx-text-subtle" />
        <span class="min-w-0 flex-1 truncate">
            {{ modelValue || placeholder }}
        </span>
        <X
            v-if="modelValue"
            class="h-3 w-3 shrink-0 rounded-full p-0.5 text-zx-text-subtle hover:bg-slate-100 hover:text-zx-text-muted"
            @click.stop="clear"
        />
    </button>

    <!-- 日历面板：Teleport 到 body + fixed 定位，不受父级层叠/裁剪影响 -->
    <Teleport to="body">
        <div
            v-if="open"
            ref="panelRef"
            class="fixed z-9999 w-60 rounded-2xl border border-slate-200 bg-white p-3 shadow-lg"
            :style="{ left: `${pos.x}px`, top: `${pos.y}px` }"
        >
            <div class="flex items-center justify-between pb-2">
                <button
                    class="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-zx-text-subtle transition-colors hover:bg-slate-100 hover:text-zx-text-muted"
                    type="button"
                    @click="prevMonth"
                >
                    <ChevronLeft class="h-4 w-4" />
                </button>
                <p class="text-sm font-semibold text-zx-text">
                    {{ viewYear }} 年 {{ viewMonth + 1 }} 月
                </p>
                <button
                    class="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-zx-text-subtle transition-colors hover:bg-slate-100 hover:text-zx-text-muted"
                    type="button"
                    @click="nextMonth"
                >
                    <ChevronRight class="h-4 w-4" />
                </button>
            </div>

            <div
                class="grid grid-cols-7 pb-1 text-center text-[10px] text-zx-text-subtle"
            >
                <span v-for="w in weekdays" :key="w">{{ w }}</span>
            </div>

            <div class="grid grid-cols-7 gap-y-0.5 text-center">
                <button
                    v-for="(cell, i) in cells"
                    :key="i"
                    class="mx-auto flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-xs transition-colors"
                    :class="[
                        cell.inMonth ? 'text-zx-text' : 'text-zx-text-subtle',
                        format(cell.date) === modelValue
                            ? 'bg-zx-primary font-semibold text-[color:var(--zx-color-on-primary)]'
                            : format(cell.date) === todayStr
                              ? 'ring-1 ring-zx-primary'
                              : 'hover:bg-slate-100',
                    ]"
                    type="button"
                    @click="select(cell.date)"
                >
                    {{ cell.date.getDate() }}
                </button>
            </div>

            <div class="flex items-center justify-between border-t border-slate-100 pt-2">
                <button
                    class="cursor-pointer rounded-md px-2 py-0.5 text-xs text-zx-primary transition-colors hover:bg-slate-100"
                    type="button"
                    @click="select(new Date())"
                >
                    今天
                </button>
                <button
                    class="cursor-pointer rounded-md px-2 py-0.5 text-xs text-zx-text-subtle transition-colors hover:bg-slate-100 hover:text-zx-text-muted"
                    type="button"
                    @click="clear"
                >
                    清除
                </button>
            </div>
        </div>
    </Teleport>
</template>
