<script setup lang="ts">
/**
 * 通用日期时间选择器（zxcomponent）
 * type: date | time | datetime
 * variant: full | icon | panel（panel = 无触发器，外部 openPicker + anchor）
 * modelValue: ISO 字符串
 */
import {
    computed,
    nextTick,
    onMounted,
    onUnmounted,
    reactive,
    ref,
    watch,
} from "vue";
import { gsap } from "gsap";
import {
    CalendarDays,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Clock,
    MapPin,
} from "lucide-vue-next";
import TimezoneMapPicker from "./TimezoneMapPicker.vue";
import {
    OVERLAY_ID,
    useOverlayStack,
} from "@/composables/useOverlayStack";

const props = withDefaults(
    defineProps<{
        modelValue: string;
        placeholder?: string;
        /** date=仅日期 / time=仅时间 / datetime=日期+时间 */
        type?: "date" | "time" | "datetime";
        /**
         * full = 完整触发条
         * icon = 仅时钟/日历图标钮
         * panel = 不渲染触发器，只出面板
         */
        variant?: "full" | "icon" | "panel";
        /** variant=panel 时的定位锚点 */
        anchor?: HTMLElement | null;
        /**
         * 返回值格式：
         * - iso（默认）: 2026-04-24T16:12:02.062+08:00
         * - postgres | pg | timestamp: 2026-04-24 16:12:02.062914+08:00
         * - datetime-local: 2026-04-24T16:12:02
         * - date / time
         * - 自定义 token: YYYY-MM-DD HH:mm:ss.SSSSSS ZZ
         */
        valueFormat?: string;
    }>(),
    {
        placeholder: "选择时间",
        type: "datetime",
        variant: "full",
        anchor: null,
        valueFormat: "iso",
    },
);

const emit = defineEmits<{ "update:modelValue": [value: string] }>();

const triggerRef = ref<HTMLElement | null>(null);
const panelRef = ref<HTMLElement | null>(null);
const open = ref(false);
const pos = ref({ x: 0, y: 0 });

const { pushOverlay, removeOverlay } = useOverlayStack();

const showDate = computed(() => props.type === "date" || props.type === "datetime");
const showTime = computed(() => props.type === "time" || props.type === "datetime");
const showPrecision = computed(() => props.type === "datetime");

/** 面板宽度：按形态 */
const PANEL_W = computed(() => {
    if (props.type === "date") return 340;
    if (props.type === "time") return 168;
    return 600;
});

const pad = (n: number) => String(n).padStart(2, "0");

/** 解析多种时间串（含 PG：2026-04-24 16:12:02.062914+08:00） */
const parseDate = (v: string): Date | null => {
    if (!v || v === "null" || v === "undefined") return null;
    let s = String(v).trim().replace(" ", "T");
    s = s.replace(/([+-]\d{2})$/, "$1:00");
    s = s.replace(/\.(\d{3})\d+/, ".$1");
    let d = new Date(s);
    if (Number.isNaN(d.getTime())) d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
};

/** 微秒（6 位）+ 时区偏移（分钟），选择器内可编辑 */
const micros = ref("000000");
const tzOffsetMin = ref(-new Date().getTimezoneOffset());
const tzText = ref("");

const offsetToText = (min: number) => {
    const sign = min < 0 ? "-" : "+";
    const abs = Math.abs(min);
    return `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
};

const parseTzText = (s: string): number | null => {
    const t = s.trim();
    if (/^utc$/i.test(t) || t === "Z" || t === "z") return 0;
    const m = t.match(/^([+-])(\d{1,2}):?(\d{2})?$/);
    if (!m) return null;
    const sign = m[1] === "-" ? -1 : 1;
    const h = parseInt(m[2], 10);
    const mi = parseInt(m[3] || "0", 10);
    if (!Number.isFinite(h) || !Number.isFinite(mi)) return null;
    return sign * (h * 60 + mi);
};

/** 从 modelValue 抓微秒与时区 */
const captureFrac = (raw: unknown) => {
    const s = String(raw ?? "");
    const m = s.match(/\.(\d+)/);
    micros.value = m
        ? m[1].padEnd(6, "0").slice(0, 6)
        : `${String(new Date().getMilliseconds()).padStart(3, "0")}000`;
    const tzm = s.match(/([+-])(\d{2}):?(\d{2})\s*$/);
    if (tzm) {
        const sign = tzm[1] === "-" ? -1 : 1;
        tzOffsetMin.value =
            sign * (parseInt(tzm[2], 10) * 60 + parseInt(tzm[3], 10));
    } else if (/[zZ]\s*$/.test(s)) {
        tzOffsetMin.value = 0;
    } else {
        tzOffsetMin.value = -new Date().getTimezoneOffset();
    }
    tzText.value = offsetToText(tzOffsetMin.value);
};

const onMicrosInput = () => {
    micros.value = micros.value.replace(/\D/g, "").padEnd(6, "0").slice(0, 6);
    emitCurrent();
};

const onTzCommit = () => {
    const n = parseTzText(tzText.value);
    if (n === null) {
        tzText.value = offsetToText(tzOffsetMin.value);
        return;
    }
    tzOffsetMin.value = n;
    tzText.value = offsetToText(n);
    emitCurrent();
};

/** 世界地图选时区 */
const tzMapOpen = ref(false);

const onTzMapSelect = (p: { offset: number; label: string }) => {
    tzOffsetMin.value = p.offset;
    tzText.value = p.label;
    emitCurrent();
    // 只关地图，日期时间面板保持打开
    tzMapOpen.value = false;
};

/** 按 valueFormat 序列化（含微秒 / 时区） */
const formatValue = (d: Date) => {
    const fmt = props.valueFormat || "iso";
    if (fmt === "iso") return d.toISOString();

    const Y = d.getFullYear();
    const M = pad(d.getMonth() + 1);
    const D = pad(d.getDate());
    const H = pad(d.getHours());
    const Mi = pad(d.getMinutes());
    const S = pad(d.getSeconds());
    const frac = micros.value || "000000";
    const tz = offsetToText(tzOffsetMin.value);

    if (fmt === "postgres" || fmt === "pg" || fmt === "timestamp") {
        return `${Y}-${M}-${D} ${H}:${Mi}:${S}.${frac}${tz}`;
    }
    if (fmt === "datetime-local" || fmt === "local") {
        return `${Y}-${M}-${D}T${H}:${Mi}:${S}`;
    }
    if (fmt === "date") return `${Y}-${M}-${D}`;
    if (fmt === "time") return `${H}:${Mi}:${S}`;

    return fmt
        .replace(/YYYY/g, String(Y))
        .replace(/MM/g, M)
        .replace(/DD/g, D)
        .replace(/HH/g, H)
        .replace(/mm/g, Mi)
        .replace(/ss/g, S)
        .replace(/SSSSSS/g, frac)
        .replace(/SSS/g, frac.slice(0, 3))
        .replace(/ZZ/g, tz);
};

const formatDay = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const formatTime = (d: Date) =>
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

const displayText = computed(() => {
    const d = parseDate(props.modelValue);
    if (!d) return "";
    if (props.type === "date") {
        return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
    }
    if (props.type === "time") return formatTime(d);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${formatTime(d)}`;
});

const triggerIconClass = computed(() =>
    props.type === "time" ? Clock : CalendarDays,
);

// ==================== 日历 ====================
const panelMode = ref<"day" | "year" | "month">("day");
const viewYear = ref(new Date().getFullYear());
const viewMonth = ref(new Date().getMonth());
const yearPageStart = ref(Math.floor(new Date().getFullYear() / 10) * 10);

const hh = ref(0);
const mm = ref(0);
const ss = ref(0);
const selectedDay = ref("");

const syncFromValue = () => {
    captureFrac(props.modelValue);
    const d = parseDate(props.modelValue) || new Date();
    viewYear.value = d.getFullYear();
    viewMonth.value = d.getMonth();
    yearPageStart.value = Math.floor(d.getFullYear() / 10) * 10;
    hh.value = d.getHours();
    mm.value = d.getMinutes();
    ss.value = d.getSeconds();
    if (props.type !== "time") selectedDay.value = formatDay(d);
    panelMode.value = "day";
};

const emitCurrent = () => {
    const base =
        showDate.value && selectedDay.value
            ? new Date(`${selectedDay.value}T00:00:00`)
            : parseDate(props.modelValue) || new Date();
    if (Number.isNaN(base.getTime())) return;
    if (showTime.value) base.setHours(hh.value, mm.value, ss.value, base.getMilliseconds());
    else base.setHours(0, 0, 0, 0);
    emit("update:modelValue", formatValue(base));
};

// ==================== 时间滚轮（transform + GSAP） ====================
type TimeKind = "hh" | "mm" | "ss";
const TIME_ITEM_H = 36;
const TIME_VISIBLE = 5;
/** 固定可视高度：禁止 flex 撑开整屏 */
const TIME_VIEW_H = TIME_ITEM_H * TIME_VISIBLE;
const WHEEL_REPEAT = 11;
/** 中心行：固定在可视区中线 */
const centerRowTop = TIME_ITEM_H * Math.floor((TIME_VISIBLE - 1) / 2);

const timeUnits = computed(() => [
    { key: "hh" as const, label: "时", val: hh.value, max: 23 },
    { key: "mm" as const, label: "分", val: mm.value, max: 59 },
    { key: "ss" as const, label: "秒", val: ss.value, max: 59 },
]);

/** 顶部时间文本：可编辑，与滚轮双向同步 */
const timeText = computed(() => `${pad(hh.value)}:${pad(mm.value)}:${pad(ss.value)}`);
const timeDraft = ref("");
const timeEditing = ref(false);

const beginTimeEdit = () => {
    timeEditing.value = true;
    timeDraft.value = timeText.value;
    void nextTick(() => {
        timeInputEl.value?.focus();
        timeInputEl.value?.select();
    });
};

const commitTimeEdit = () => {
    if (!timeEditing.value) return;
    timeEditing.value = false;
    const m = timeDraft.value.trim().match(/^(\d{1,2})\s*[:\s]\s*(\d{1,2})(?:\s*[:\s]\s*(\d{1,2}))?$/);
    if (!m) return;
    const h = Math.max(0, Math.min(23, parseInt(m[1], 10) || 0));
    const mi = Math.max(0, Math.min(59, parseInt(m[2], 10) || 0));
    const s = Math.max(0, Math.min(59, parseInt(m[3] ?? "0", 10) || 0));
    if (h !== hh.value) {
        hh.value = h;
        animateToValue("hh", h);
    }
    if (mi !== mm.value) {
        mm.value = mi;
        animateToValue("mm", mi);
    }
    if (s !== ss.value) {
        ss.value = s;
        animateToValue("ss", s);
    }
    emitCurrent();
};

const cancelTimeEdit = () => {
    timeEditing.value = false;
};

const onTimeEditKey = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
        e.preventDefault();
        commitTimeEdit();
    } else if (e.key === "Escape") {
        e.preventDefault();
        cancelTimeEdit();
    }
};

const maxOf = (k: TimeKind) => (k === "hh" ? 23 : 59);
const valOf = (k: TimeKind) =>
    k === "hh" ? hh.value : k === "mm" ? mm.value : ss.value;
const cycleOf = (k: TimeKind) => maxOf(k) + 1;
const midBaseOf = (k: TimeKind) => Math.floor(WHEEL_REPEAT / 2) * cycleOf(k);
const itemTotalOf = (k: TimeKind) => cycleOf(k) * WHEEL_REPEAT;
const toVal = (k: TimeKind, idx: number) => {
    const c = cycleOf(k);
    return ((idx % c) + c) % c;
};

const wheelIdx = reactive<Record<TimeKind, number>>({ hh: 0, mm: 0, ss: 0 });
const animIdx: Record<TimeKind, number> = { hh: 0, mm: 0, ss: 0 };

const setTime = (k: TimeKind, v: number) => {
    const n = toVal(k, v);
    if (k === "hh") hh.value = n;
    else if (k === "mm") mm.value = n;
    else ss.value = n;
    emitCurrent();
};

const stripEls = ref<Partial<Record<TimeKind, HTMLElement | null>>>({});
const tweens: Partial<Record<TimeKind, gsap.core.Tween>> = {};

const setStripRef = (kind: TimeKind, el: unknown) => {
    stripEls.value[kind] = (el as HTMLElement | null) ?? null;
};

const killTween = (k: TimeKind) => {
    tweens[k]?.kill();
    tweens[k] = undefined as unknown as gsap.core.Tween;
};

const applyStrip = (k: TimeKind, idx: number) => {
    const el = stripEls.value[k];
    if (!el) return;
    el.style.transform = `translate3d(0, ${centerRowTop - idx * TIME_ITEM_H}px, 0)`;
};

const placeAt = (k: TimeKind, idx: number) => {
    animIdx[k] = idx;
    wheelIdx[k] = idx;
    applyStrip(k, idx);
};

const animateToIdx = (k: TimeKind, targetIdx: number) => {
    const el = stripEls.value[k];
    if (!el) {
        placeAt(k, targetIdx);
        return;
    }
    killTween(k);
    const from = animIdx[k];
    const proxy = { idx: from };
    if (Math.abs(from - targetIdx) < 0.001) {
        placeAt(k, targetIdx);
        return;
    }
    tweens[k] = gsap.to(proxy, {
        idx: targetIdx,
        duration: 0.32,
        ease: "power3.out",
        onUpdate: () => applyStrip(k, proxy.idx),
        onComplete: () => {
            animIdx[k] = targetIdx;
            const val = toVal(k, targetIdx);
            const c = cycleOf(k);
            const total = itemTotalOf(k);
            let finalIdx = targetIdx;
            if (targetIdx < c || targetIdx > total - c - 1) {
                finalIdx = midBaseOf(k) + val;
                animIdx[k] = finalIdx;
                applyStrip(k, finalIdx);
            }
            wheelIdx[k] = finalIdx;
        },
    });
};

const animateToValue = (k: TimeKind, targetVal: number) => {
    const c = cycleOf(k);
    const val = toVal(k, targetVal);
    setTime(k, val);
    const cur = animIdx[k];
    let delta = val - toVal(k, cur);
    if (delta > c / 2) delta -= c;
    if (delta < -c / 2) delta += c;
    animateToIdx(k, cur + delta);
};

const syncTimeWheels = () => {
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            if (!showTime.value) return;
            killTween("hh");
            killTween("mm");
            killTween("ss");
            placeAt("hh", midBaseOf("hh") + hh.value);
            placeAt("mm", midBaseOf("mm") + mm.value);
            placeAt("ss", midBaseOf("ss") + ss.value);
        });
    });
};

const onWheelStep = (k: TimeKind, e: WheelEvent) => {
    e.preventDefault();
    const dir = e.deltaY > 0 ? 1 : e.deltaY < 0 ? -1 : 0;
    if (!dir) return;
    killTween(k);
    animateToValue(k, valOf(k) + dir);
};

// 触控拖拽
const dragState = ref<{
    kind: TimeKind;
    pointerId: number;
    startY: number;
    startIdx: number;
    moved: boolean;
} | null>(null);
let suppressClick = false;

const onDragStart = (k: TimeKind, e: PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    killTween(k);
    editingKind.value = null;
    const el = e.currentTarget as HTMLElement;
    try {
        el.setPointerCapture(e.pointerId);
    } catch {
        /* ignore */
    }
    dragState.value = {
        kind: k,
        pointerId: e.pointerId,
        startY: e.clientY,
        startIdx: animIdx[k],
        moved: false,
    };
};

const onDragMove = (e: PointerEvent) => {
    const d = dragState.value;
    if (!d || d.pointerId !== e.pointerId) return;
    const dy = e.clientY - d.startY;
    if (Math.abs(dy) > 3) d.moved = true;
    const idx = d.startIdx - dy / TIME_ITEM_H;
    animIdx[d.kind] = idx;
    applyStrip(d.kind, idx);
};

const onDragEnd = (e: PointerEvent) => {
    const d = dragState.value;
    if (!d || d.pointerId !== e.pointerId) return;
    const k = d.kind;
    dragState.value = null;
    if (d.moved) {
        suppressClick = true;
        window.setTimeout(() => {
            suppressClick = false;
        }, 80);
        const total = itemTotalOf(k);
        const snapIdx = Math.max(0, Math.min(total - 1, Math.round(animIdx[k])));
        const val = toVal(k, snapIdx);
        setTime(k, val);
        animateToIdx(k, snapIdx);
        return;
    }
    animateToValue(k, valOf(k));
};

const editingKind = ref<TimeKind | null>(null);
const editBuffer = ref("");
const editInputEl = ref<HTMLInputElement | null>(null);
const timeInputEl = ref<HTMLInputElement | null>(null);

const startEditTime = async (k: TimeKind) => {
    if (editingKind.value === k) return;
    editingKind.value = k;
    editBuffer.value = pad(valOf(k));
    await nextTick();
    editInputEl.value?.focus();
    editInputEl.value?.select();
};

const commitEditTime = () => {
    const k = editingKind.value;
    if (!k) return;
    const max = maxOf(k);
    const n = parseInt(editBuffer.value.replace(/\D/g, ""), 10);
    if (!Number.isNaN(n)) {
        animateToValue(k, Math.max(0, Math.min(max, n)));
    }
    editingKind.value = null;
};

const cancelEditTime = () => {
    if (!editingKind.value) return;
    const k = editingKind.value;
    editingKind.value = null;
    animateToValue(k, valOf(k));
};

const onItemClick = (k: TimeKind, idx: number) => {
    if (suppressClick || dragState.value) return;
    if (idx === wheelIdx[k]) {
        void startEditTime(k);
        return;
    }
    editingKind.value = null;
    animateToValue(k, toVal(k, idx));
};

// ==================== 日历交互 ====================
const pickDay = (d: Date) => {
    selectedDay.value = formatDay(d);
    viewYear.value = d.getFullYear();
    viewMonth.value = d.getMonth();
    emitCurrent();
};

const setNow = () => {
    const d = new Date();
    viewYear.value = d.getFullYear();
    viewMonth.value = d.getMonth();
    yearPageStart.value = Math.floor(d.getFullYear() / 10) * 10;
    hh.value = d.getHours();
    mm.value = d.getMinutes();
    ss.value = d.getSeconds();
    selectedDay.value = formatDay(d);
    panelMode.value = "day";
    editingKind.value = null;
    micros.value = `${String(d.getMilliseconds()).padStart(3, "0")}000`;
    tzOffsetMin.value = -d.getTimezoneOffset();
    tzText.value = offsetToText(tzOffsetMin.value);
    emit("update:modelValue", formatValue(d));
    syncTimeWheels();
};

const prevMonth = () => {
    if (panelMode.value !== "day") return;
    if (viewMonth.value === 0) {
        viewYear.value -= 1;
        viewMonth.value = 11;
    } else viewMonth.value -= 1;
};

const nextMonth = () => {
    if (panelMode.value !== "day") return;
    if (viewMonth.value === 11) {
        viewYear.value += 1;
        viewMonth.value = 0;
    } else viewMonth.value += 1;
};

const openYearPanel = () => {
    yearPageStart.value = Math.floor(viewYear.value / 10) * 10;
    panelMode.value = panelMode.value === "year" ? "day" : "year";
};

const openMonthPanel = () => {
    panelMode.value = panelMode.value === "month" ? "day" : "month";
};

const yearPageYears = computed(() => {
    const start = yearPageStart.value;
    return Array.from({ length: 12 }, (_, i) => start - 1 + i);
});

const monthLabels = [
    "1月", "2月", "3月", "4月", "5月", "6月",
    "7月", "8月", "9月", "10月", "11月", "12月",
];

const pickYear = (y: number) => {
    viewYear.value = y;
    yearPageStart.value = Math.floor(y / 10) * 10;
    panelMode.value = "month";
};

const pickMonth = (m: number) => {
    viewMonth.value = m;
    panelMode.value = "day";
};

const shiftYearPage = (delta: number) => {
    yearPageStart.value += delta * 10;
};

interface DayCell {
    date: Date;
    inMonth: boolean;
    key: string;
}

const cells = computed<DayCell[]>(() => {
    const first = new Date(viewYear.value, viewMonth.value, 1);
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(first);
    start.setDate(first.getDate() - offset);
    const list: DayCell[] = [];
    for (let i = 0; i < 42; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        list.push({
            date: d,
            inMonth: d.getMonth() === viewMonth.value,
            key: formatDay(d),
        });
    }
    return list;
});

const todayStr = formatDay(new Date());
const weekdays = ["一", "二", "三", "四", "五", "六", "日"];

// ==================== 开合 ====================
const updatePos = () => {
    const trigger = props.anchor || triggerRef.value;
    const panel = panelRef.value;
    if (!trigger || !panel) return;
    const r = trigger.getBoundingClientRect();
    const w = PANEL_W.value;
    const x = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
    let y = r.bottom + 6;
    if (y + panel.offsetHeight > window.innerHeight - 8) {
        y = Math.max(8, r.top - panel.offsetHeight - 6);
    }
    pos.value = { x, y };
};

const syncPanelOpen = () => {
    syncFromValue();
    void nextTick(async () => {
        syncTimeWheels();
        await nextTick();
        updatePos();
    });
};

const toggle = () => {
    open.value = !open.value;
    if (open.value) syncPanelOpen();
};

const openPicker = () => {
    open.value = true;
    syncPanelOpen();
};

const closePicker = () => {
    open.value = false;
};

// 外点关闭 / Esc 交给浮层栈：只关最上层
watch(open, (v) => {
    if (v) {
        pushOverlay({
            id: OVERLAY_ID.dateTimePicker,
            el: () => panelRef.value,
            anchors: () => [triggerRef.value, props.anchor],
            onClose: () => {
                open.value = false;
            },
            closeOnOutsideClick: true,
            closeOnEsc: true,
        });
    } else {
        removeOverlay(OVERLAY_ID.dateTimePicker);
        if (tzMapOpen.value) tzMapOpen.value = false;
    }
});

onUnmounted(() => {
    removeOverlay(OVERLAY_ID.dateTimePicker);
    killTween("hh");
    killTween("mm");
    killTween("ss");
});

watch(
    () => props.modelValue,
    () => {
        captureFrac(props.modelValue);
        if (!open.value) return;
        const d = parseDate(props.modelValue);
        if (!d) return;
        hh.value = d.getHours();
        mm.value = d.getMinutes();
        ss.value = d.getSeconds();
        if (showDate.value) selectedDay.value = formatDay(d);
        syncTimeWheels();
    },
);

defineExpose({ open, toggle, openPicker, closePicker });
</script>

<template>
    <!-- 触发器 -->
    <button
        v-if="variant !== 'panel'"
        ref="triggerRef"
        type="button"
        class="zx-dtp-trigger btn-touch cursor-pointer transition-colors"
        :class="
            variant === 'icon'
                ? `flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zx-text-muted hover:bg-slate-100/80 hover:text-zx-text ${open ? 'bg-slate-100 text-zx-primary' : ''}`
                : `flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-transparent px-2.5 py-1.5 text-left text-xs hover:border-slate-300 ${modelValue ? 'text-zx-text' : 'text-zx-text-subtle'}`
        "
        :title="variant === 'icon' ? '选择日期时间' : undefined"
        @click.stop="toggle"
    >
        <component
            :is="triggerIconClass"
            class="shrink-0"
            :class="
                variant === 'icon'
                    ? 'h-4 w-4'
                    : 'h-3.5 w-3.5 text-zx-text-muted'
            "
        />
        <template v-if="variant === 'full'">
            <span class="min-w-0 flex-1 truncate font-mono">
                {{ displayText || placeholder }}
            </span>
            <ChevronDown
                class="h-3.5 w-3.5 shrink-0 text-zx-text-muted transition-transform"
                :class="open ? 'rotate-180' : ''"
            />
        </template>
    </button>

    <Teleport to="body">
        <div
            v-if="open"
            ref="panelRef"
            class="zx-dtp-panel fixed z-[10000] flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-lg"
            :style="{
                left: `${pos.x}px`,
                top: `${pos.y}px`,
                width: `${PANEL_W}px`,
            }"
            @click.stop
            @pointerdown.stop
            @focusout.stop
        >
            <!-- 日期 -->
            <div
                v-if="showDate"
                class="flex min-w-0 flex-1 flex-col rounded-xl border border-slate-200 bg-white p-3"
            >
                <div class="flex items-center justify-between pb-1.5">
                    <button
                        type="button"
                        class="btn-touch flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-zx-text-muted hover:bg-slate-100 hover:text-zx-text"
                        @click="
                            panelMode === 'year'
                                ? shiftYearPage(-1)
                                : panelMode === 'day'
                                  ? prevMonth()
                                  : undefined
                        "
                    >
                        <ChevronLeft class="h-4 w-4" />
                    </button>
                    <div
                        class="flex min-w-0 items-center gap-1 text-sm text-zx-text-strong"
                    >
                        <template v-if="panelMode === 'year'">
                            <span class="font-semibold tabular-nums"
                                >{{ yearPageYears[1] }} - {{ yearPageYears[10] }}</span
                            >
                        </template>
                        <template v-else>
                            <button
                                type="button"
                                class="btn-touch cursor-pointer rounded px-1 font-semibold hover:bg-slate-100"
                                @click="openYearPanel"
                            >
                                {{ viewYear }} 年
                            </button>
                            <button
                                type="button"
                                class="btn-touch cursor-pointer rounded px-1 font-semibold hover:bg-slate-100"
                                :class="panelMode === 'month' ? 'text-zx-primary' : ''"
                                @click="openMonthPanel"
                            >
                                {{ viewMonth + 1 }} 月
                            </button>
                        </template>
                    </div>
                    <button
                        type="button"
                        class="btn-touch flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-zx-text-muted hover:bg-slate-100 hover:text-zx-text"
                        @click="
                            panelMode === 'year'
                                ? shiftYearPage(1)
                                : panelMode === 'day'
                                  ? nextMonth()
                                  : undefined
                        "
                    >
                        <ChevronRight class="h-4 w-4" />
                    </button>
                </div>

                <template v-if="panelMode === 'day'">
                    <div
                        class="grid grid-cols-7 pb-2 text-center text-[11px] text-zx-text-subtle"
                    >
                        <span v-for="w in weekdays" :key="w">{{ w }}</span>
                    </div>
                    <div class="grid grid-cols-7 gap-x-3 gap-y-2 text-center">
                        <button
                            v-for="c in cells"
                            :key="c.key"
                            type="button"
                            class="btn-touch mx-auto flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-[13px] transition-colors"
                            :class="
                                c.key === selectedDay
                                    ? 'bg-zx-primary font-medium text-[color:var(--zx-color-on-primary)]'
                                    : c.key === todayStr && c.inMonth
                                      ? 'bg-zx-dirty font-medium text-[color:var(--zx-color-on-dirty)]'
                                      : c.inMonth
                                        ? 'text-zx-text hover:bg-slate-100'
                                        : 'text-zx-text-subtle hover:bg-slate-50'
                            "
                            @click="pickDay(c.date)"
                        >
                            {{ c.date.getDate() }}
                        </button>
                    </div>
                </template>

                <template v-else-if="panelMode === 'year'">
                    <div class="grid grid-cols-4 gap-2 pt-1">
                        <button
                            v-for="y in yearPageYears"
                            :key="y"
                            type="button"
                            class="btn-touch cursor-pointer rounded-lg py-2.5 text-sm transition-colors"
                            :class="
                                y === viewYear
                                    ? 'bg-zx-primary font-medium text-[color:var(--zx-color-on-primary)]'
                                    : y < yearPageStart || y > yearPageStart + 9
                                        ? 'text-zx-text-subtle hover:bg-slate-50'
                                        : 'text-zx-text hover:bg-slate-100'
                            "
                            @click="pickYear(y)"
                        >
                            {{ y }}
                        </button>
                    </div>
                </template>

                <template v-else>
                    <div class="grid grid-cols-4 gap-2 pt-1">
                        <button
                            v-for="(label, mi) in monthLabels"
                            :key="label"
                            type="button"
                            class="btn-touch cursor-pointer rounded-lg py-3.5 text-sm transition-colors"
                            :class="
                                mi === viewMonth
                                    ? 'bg-zx-primary font-medium text-[color:var(--zx-color-on-primary)]'
                                    : 'text-zx-text hover:bg-slate-100'
                            "
                            @click="pickMonth(mi)"
                        >
                            {{ label }}
                        </button>
                    </div>
                </template>
            </div>

            <!-- 时间滚轮（固定高度） -->
            <div
                v-if="showTime"
                class="flex shrink-0 flex-col rounded-xl border border-slate-200 bg-white p-2"
                :style="{ width: '140px' }"
            >
                <div
                    class="mb-2 flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1.5 transition-colors focus-within:border-zx-primary"
                >
                    <Clock class="h-3.5 w-3.5 shrink-0 text-zx-text-muted" />
                    <input
                        v-if="timeEditing"
                        ref="timeInputEl"
                        v-model="timeDraft"
                        class="min-w-0 flex-1 border-0 bg-transparent font-mono text-xs tabular-nums text-zx-text outline-none"
                        inputmode="numeric"
                        @click.stop
                        @keydown="onTimeEditKey"
                        @blur="commitTimeEdit"
                    />
                    <button
                        v-else
                        type="button"
                        class="min-w-0 flex-1 cursor-text truncate text-left font-mono text-xs tabular-nums text-zx-text hover:text-zx-primary"
                        title="点击可直接输入 HH:mm:ss"
                        @click.stop="beginTimeEdit"
                    >
                        {{ pad(hh) }}:{{ pad(mm) }}:{{ pad(ss) }}
                    </button>
                </div>

                <div
                    class="relative shrink-0 overflow-hidden"
                    :style="{ height: `${TIME_VIEW_H}px` }"
                >
                    <div
                        class="pointer-events-none absolute inset-x-0 z-0 rounded-md border border-slate-300 bg-slate-50/70"
                        :style="{
                            top: `${centerRowTop}px`,
                            height: `${TIME_ITEM_H}px`,
                        }"
                    />

                    <div class="relative z-[1] flex h-full items-stretch">
                        <template
                            v-for="(unit, ui) in timeUnits"
                            :key="unit.key"
                        >
                            <div
                                v-if="ui > 0"
                                class="relative w-3.5 shrink-0"
                                aria-hidden="true"
                            >
                                <div
                                    class="absolute inset-x-0 flex items-center justify-center font-mono text-sm text-zx-text-subtle"
                                    :style="{
                                        top: `${centerRowTop}px`,
                                        height: `${TIME_ITEM_H}px`,
                                    }"
                                >
                                    :
                                </div>
                            </div>

                            <div
                                class="dtp-wheel-mask relative min-w-0 flex-1 touch-none overflow-hidden select-none"
                                :style="{ touchAction: 'none' }"
                                @wheel.prevent="onWheelStep(unit.key, $event)"
                                @pointerdown="onDragStart(unit.key, $event)"
                                @pointermove="onDragMove"
                                @pointerup="onDragEnd"
                                @pointercancel="onDragEnd"
                            >
                                <div
                                    :ref="(el) => setStripRef(unit.key, el)"
                                    class="will-change-transform"
                                >
                                    <div
                                        v-for="i in itemTotalOf(unit.key)"
                                        :key="i - 1"
                                        class="flex items-center justify-center"
                                        :style="{ height: `${TIME_ITEM_H}px` }"
                                    >
                                        <input
                                            v-if="
                                                editingKind === unit.key &&
                                                i - 1 === wheelIdx[unit.key]
                                            "
                                            ref="editInputEl"
                                            v-model="editBuffer"
                                            inputmode="numeric"
                                            maxlength="2"
                                            class="w-9 border-0 bg-transparent text-center font-mono text-base font-semibold text-zx-primary outline-none"
                                            @click.stop
                                            @keydown.enter.prevent="commitEditTime"
                                            @keydown.esc.prevent="cancelEditTime"
                                            @blur="commitEditTime"
                                        />
                                        <button
                                            v-else
                                            type="button"
                                            class="flex h-full w-full cursor-pointer items-center justify-center font-mono tabular-nums"
                                            :class="
                                                i - 1 === wheelIdx[unit.key]
                                                    ? 'text-base font-semibold text-zx-primary'
                                                    : 'text-sm text-zx-text-muted'
                                            "
                                            @click.stop="onItemClick(unit.key, i - 1)"
                                        >
                                            {{ pad(toVal(unit.key, i - 1)) }}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </template>
                    </div>
                </div>

                <div class="mt-1 flex flex-shrink-0 items-stretch">
                    <template
                        v-for="(unit, ui) in timeUnits"
                        :key="unit.key"
                    >
                        <div v-if="ui > 0" class="w-3.5 shrink-0"></div>
                        <div
                            class="min-w-0 flex-1 text-center text-[10px] text-zx-text-subtle"
                        >
                            {{ unit.label }}
                        </div>
                    </template>
                </div>

                <button
                    type="button"
                    class="btn-touch mt-2 w-full flex-shrink-0 cursor-pointer rounded-md border border-slate-200 px-1 py-1.5 text-[11px] text-zx-text-muted transition-colors hover:bg-slate-50 hover:text-zx-text"
                    @click="setNow"
                >
                    当前时间
                </button>
            </div>

            <!-- 微秒 / 时区：独立列，仅在完整 datetime 毫秒时区形态下展示 -->
            <div
                v-if="showPrecision"
                class="flex w-[140px] shrink-0 flex-col justify-center gap-3 self-stretch rounded-xl border border-slate-200 bg-white p-2"
            >
                <label class="flex flex-col gap-1">
                    <span class="text-[10px] text-zx-text-subtle">微秒</span>
                    <input
                        v-model="micros"
                        maxlength="6"
                        inputmode="numeric"
                        class="w-full rounded-md border border-slate-200 bg-transparent px-2 py-1.5 font-mono text-xs tabular-nums text-zx-text outline-none focus:border-zx-primary"
                        @change="onMicrosInput"
                        @blur="onMicrosInput"
                    />
                </label>
                <label class="flex flex-col gap-1">
                    <span class="text-[10px] text-zx-text-subtle">时区</span>
                    <div class="flex items-center gap-1">
                        <input
                            v-model="tzText"
                            class="min-w-0 flex-1 rounded-md border border-slate-200 bg-transparent px-2 py-1.5 font-mono text-xs tabular-nums text-zx-text outline-none focus:border-zx-primary"
                            placeholder="+08:00"
                            @change="onTzCommit"
                            @blur="onTzCommit"
                        />
                        <button
                            type="button"
                            class="btn-touch flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-slate-200 text-zx-text-muted hover:border-zx-primary hover:text-zx-primary"
                            title="地图选择时区"
                            @click.stop="tzMapOpen = true"
                        >
                            <MapPin class="h-3.5 w-3.5" />
                        </button>
                    </div>
                </label>
                <div
                    class="mt-auto pt-1 font-mono text-[10px] break-all text-zx-text-subtle"
                >
                    .{{ micros }}{{ tzText }}
                </div>
            </div>
        </div>
    </Teleport>

    <!-- 世界地图时区选择 -->
    <TimezoneMapPicker
        v-model:open="tzMapOpen"
        :model-value="tzText"
        @select="onTzMapSelect"
    />
</template>

<style scoped>
.dtp-wheel-mask {
    -webkit-mask-image: linear-gradient(
        to bottom,
        transparent 0%,
        rgba(0, 0, 0, 0.22) 16%,
        #000 40%,
        #000 60%,
        rgba(0, 0, 0, 0.22) 84%,
        transparent 100%
    );
    mask-image: linear-gradient(
        to bottom,
        transparent 0%,
        rgba(0, 0, 0, 0.22) 16%,
        #000 40%,
        #000 60%,
        rgba(0, 0, 0, 0.22) 84%,
        transparent 100%
    );
}
</style>
