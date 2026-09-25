<script setup lang="ts" generic="T extends string | number | boolean">
import { computed, markRaw, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { Component } from "vue";
import { gsap } from "gsap";

/**
 * 分段控制器选项项定义
 */
export interface SegmentedOption<V = string | number | boolean> {
    /** 显示文案 */
    label?: string;
    /** 选项值 */
    value: V;
    /** 可选 Lucide 图标组件 */
    icon?: Component;
    /** 可选徽标计数或文案 */
    badge?: string | number;
    /** 是否禁用单个选项 */
    disabled?: boolean;
}

export type RawSegmentedOption<V = string | number | boolean> =
    | V
    | SegmentedOption<V>;

/**
 * 通用分段控制器（滑块式指示器）
 * 选中态是「一颗滑动胶囊」在选项下方滑动，而非整块变色。
 *
 * 用法：
 *   <ZxSegmented v-model="activeTab" :options="['群组', '好友']" />
 *   <ZxSegmented v-model="viewMode" :options="viewOptions" accent="primary" />
 *   <ZxSegmented v-model="range" :options="rangeOptions" size="sm" block />
 */
interface Props {
    /** 当前绑定值 */
    modelValue: T;
    /** 选项列表（支持对象数组或原始值数组） */
    options: readonly RawSegmentedOption<T>[];
    /** 尺寸档位：sm | md | lg */
    size?: "sm" | "md" | "lg";
    /**
     * 选中态视觉风格：
     * - 'primary': 白底滑块 + 主题色字
     * - 'neutral': 白底滑块 + 深灰字
     * - 'filled-primary': 主题色实底滑块 + 对比白字
     */
    accent?: "primary" | "neutral" | "filled-primary";
    /** 是否撑满父容器宽度（各选项等宽均分） */
    block?: boolean;
    /** 是否整体禁用 */
    disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    size: "md",
    accent: "primary",
    block: false,
    disabled: false,
});

const emit = defineEmits<{
    (e: "update:modelValue", val: T): void;
    (e: "change", val: T): void;
}>();

const normalizedOptions = computed<SegmentedOption<T>[]>(() => {
    return props.options.map((opt) => {
        if (typeof opt === "object" && opt !== null && "value" in opt) {
            return {
                ...opt,
                icon: opt.icon ? markRaw(opt.icon) : undefined,
            } as SegmentedOption<T>;
        }
        return {
            label: String(opt),
            value: opt as T,
        };
    });
});

/** 触控优先 pointerdown 点选；click 作回退，时间窗去重避免连发 */
let lastSelectAt = 0;
const handleSelect = (option: SegmentedOption<T>) => {
    if (props.disabled || option.disabled) return;
    const now = Date.now();
    if (now - lastSelectAt < 350) return;
    lastSelectAt = now;
    if (props.modelValue !== option.value) {
        emit("update:modelValue", option.value);
        emit("change", option.value);
    }
};

const rootRef = ref<HTMLElement | null>(null);
const thumbElRef = ref<HTMLElement | null>(null);
const itemRefs = new Map<string, HTMLElement>();

const setItemRef = (el: unknown, value: T) => {
    const key = String(value);
    if (el instanceof HTMLElement) itemRefs.set(key, el);
    else itemRefs.delete(key);
};

/** 滑块几何（仅用于 v-show；实际位置/尺寸由 GSAP 写在 DOM 上） */
const thumb = ref({ ready: false });
let thumbTween: gsap.core.Timeline | null = null;
let lastKey = "";

const measureTarget = () => {
    const root = rootRef.value;
    if (!root) return null;
    const key = String(props.modelValue);
    const el =
        itemRefs.get(key) ??
        root.querySelector<HTMLElement>(`[data-seg-value="${CSS.escape(key)}"]`);
    if (!el) return null;
    const rootRect = root.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return {
        key,
        left: r.left - rootRect.left,
        top: r.top - rootRect.top,
        width: r.width,
        height: r.height,
    };
};

/**
 * 三段动效：
 * 1) 前伸：领先边朝目标伸出一截（落后边不动）
 * 2) 一起挪：整体平移到目标附近（仍保持拉伸）
 * 3) 收回：宽度弹回目标胶囊
 */
const animateThumbTo = (
    to: NonNullable<ReturnType<typeof measureTarget>>,
    animate: boolean,
) => {
    const el = thumbElRef.value;
    if (!el) return;

    thumb.value = { ready: true };

    const fromX = Number(gsap.getProperty(el, "x")) || 0;
    const fromW = Number(gsap.getProperty(el, "width")) || 0;

    if (!animate) {
        thumbTween?.kill();
        gsap.set(el, {
            x: to.left,
            y: to.top,
            width: to.width,
            height: to.height,
        });
        return;
    }

    const movingRight = to.left >= fromX;
    const dist = Math.abs(to.left - fromX) || Math.abs(to.width - fromW);
    const reach = Math.max(dist * 0.55, 8);

    // 容器内容宽度：滑块任何一帧都不得越界
    const maxW = rootRef.value?.clientWidth ?? to.left + to.width;
    const clampBox = (x: number, w: number) => {
        const width = Math.min(Math.max(w, to.width), Math.max(maxW, to.width));
        const left = Math.min(Math.max(x, 0), Math.max(0, maxW - width));
        return { x: left, width };
    };

    // 1) 前伸：领先边朝目标伸出，但不越过目标/容器边界
    let p1: { x: number; width: number };
    if (movingRight) {
        const startRight = fromX + fromW;
        const limit = Math.min(startRight + reach, to.left + to.width, maxW);
        p1 = clampBox(fromX, Math.max(limit - fromX, to.width));
    } else {
        const startLeft = fromX;
        const limit = Math.max(startLeft - reach, to.left, 0);
        p1 = clampBox(limit, Math.max(startLeft + fromW - limit, to.width));
    }

    // 2) 一起挪到目标 left（宽度保持前伸态，且仍被钳在容器内）
    const p2 = clampBox(to.left, p1.width);

    thumbTween?.kill();
    thumbTween = gsap
        .timeline()
        .set(el, {
            x: fromX,
            y: to.top,
            width: fromW || to.width,
            height: to.height,
        })
        // 前伸
        .to(el, {
            x: p1.x,
            width: p1.width,
            duration: 0.1,
            ease: "power2.out",
        })
        // 一起挪到目标
        .to(el, {
            x: p2.x,
            width: p2.width,
            duration: 0.12,
            ease: "power2.out",
        })
        // 收回
        .to(el, {
            x: to.left,
            width: to.width,
            duration: 0.12,
            ease: "back.out(1.4)",
        });
};

const updateThumb = (animate = true) => {
    const to = measureTarget();
    if (!to) {
        thumb.value = { ...thumb.value, ready: false };
        return;
    }
    const changed = to.key !== lastKey;
    lastKey = to.key;
    animateThumbTo(to, animate && changed);
};

watch(
    () => [props.modelValue, props.size, props.block, props.options],
    async () => {
        await nextTick();
        updateThumb();
    },
    { deep: true },
);

let resizeObserver: ResizeObserver | null = null;

onMounted(async () => {
    await nextTick();
    updateThumb(false);
    if (typeof ResizeObserver !== "undefined" && rootRef.value) {
        resizeObserver = new ResizeObserver(() => updateThumb(false));
        resizeObserver.observe(rootRef.value);
    }
    window.addEventListener("resize", () => updateThumb(false));
});

onBeforeUnmount(() => {
    thumbTween?.kill();
    resizeObserver?.disconnect();
});

/** 容器尺寸样式（全圆角胶囊） */
const containerSizeClasses = computed(() => {
    switch (props.size) {
        case "sm":
            return "p-0.5 text-xs";
        case "lg":
            return "p-1.5 text-sm sm:text-base";
        case "md":
        default:
            return "p-1 text-xs sm:text-sm";
    }
});

/** 选项按钮尺寸样式 */
const itemSizeClasses = computed(() => {
    switch (props.size) {
        case "sm":
            return "px-2.5 py-1 gap-1.5";
        case "lg":
            return "px-4 py-2 gap-2";
        case "md":
        default:
            return "px-3 py-1.5 gap-1.5";
    }
});

const iconSizeClasses = computed(() => {
    switch (props.size) {
        case "sm":
            return "h-3.5 w-3.5";
        case "lg":
            return "h-4.5 w-4.5";
        case "md":
        default:
            return "h-4 w-4";
    }
});

/** 滑块底色 */
const thumbClass = computed(() => {
    switch (props.accent) {
        case "neutral":
            return "bg-white shadow-sm";
        case "filled-primary":
            return "bg-zx-primary shadow-sm";
        case "primary":
        default:
            return "bg-white shadow-sm";
    }
});

/** 选中文字色 */
const activeTextClass = computed(() => {
    switch (props.accent) {
        case "neutral":
            return "text-zx-text-strong font-semibold";
        case "filled-primary":
            return "text-[color:var(--zx-color-on-primary)] font-semibold";
        case "primary":
        default:
            return "text-zx-primary font-semibold";
    }
});

const inactiveClasses = "text-zx-text-muted hover:text-zx-text font-medium";
</script>

<template>
    <div
        ref="rootRef"
        role="tablist"
        class="relative inline-flex items-center select-none rounded-full bg-slate-100 transition-colors touch-manipulation"
        :class="[
            containerSizeClasses,
            block ? 'flex w-full' : 'inline-flex',
            disabled ? 'opacity-50 cursor-not-allowed' : '',
        ]"
    >
        <!-- 滑块指示器（GSAP 拉伸→收回，几何由 GSAP 写 DOM） -->
        <div
            ref="thumbElRef"
            v-show="thumb.ready"
            class="pointer-events-none absolute top-0 left-0 rounded-full"
            :class="thumbClass"
            aria-hidden="true"
        />

        <button
            v-for="(option, index) in normalizedOptions"
            :key="String(option.value)"
            :ref="(el) => setItemRef(el, option.value)"
            type="button"
            role="tab"
            :data-seg-value="String(option.value)"
            :aria-selected="modelValue === option.value"
            :disabled="disabled || option.disabled"
            class="btn-touch relative z-[1] flex items-center justify-center transition-colors duration-200"
            :class="[
                itemSizeClasses,
                block ? 'flex-1 min-w-0' : '',
                option.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
                modelValue === option.value ? activeTextClass : inactiveClasses,
            ]"
            @pointerdown.prevent="handleSelect(option)"
            @click="handleSelect(option)"
        >
            <slot
                name="item"
                :option="option"
                :selected="modelValue === option.value"
                :index="index"
            >
                <component
                    :is="option.icon"
                    v-if="option.icon"
                    class="flex-shrink-0 transition-colors duration-200"
                    :class="[
                        iconSizeClasses,
                        modelValue === option.value
                            ? accent === 'filled-primary'
                                ? 'text-inherit'
                                : 'text-zx-primary'
                            : 'text-zx-text-subtle',
                    ]"
                />

                <span class="truncate">
                    <slot
                        name="label"
                        :option="option"
                        :selected="modelValue === option.value"
                        :index="index"
                    >
                        {{ option.label ?? option.value }}
                    </slot>
                </span>

                <span
                    v-if="option.badge !== undefined && option.badge !== null"
                    class="ml-0.5 inline-flex items-center justify-center rounded-full px-1.5 py-0.2 text-[10px] font-bold leading-tight tabular-nums transition-colors duration-200"
                    :class="[
                        modelValue === option.value
                            ? accent === 'filled-primary'
                                ? 'bg-white/20 text-inherit'
                                : 'bg-zx-primary-soft text-zx-primary'
                            : 'bg-slate-200/80 text-zx-text-muted',
                    ]"
                >
                    {{ option.badge }}
                </span>
            </slot>
        </button>
    </div>
</template>
