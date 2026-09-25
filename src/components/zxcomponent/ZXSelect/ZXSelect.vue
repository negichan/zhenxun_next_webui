<script setup lang="ts">
/**
 * ZXSelect - 现代下拉选择器组件（对齐 shadcn Select 规范）
 *
 * 1. 采用 shadcn Select 的 item-aligned 垂直对齐核心交互：展开时面板垂直位移，当前选中的项直接覆盖对齐触发器；
 * 2. 严格遵循 DESIGN.md：选中项使用高饱和实色底 bg-zx-primary + 对比字 text-[color:var(--zx-color-on-primary)]；
 * 3. 背景与边框走标准 bg-white border-slate-200，由 theme.css 在深浅色主题间动态自适应，严禁使用任何反转的 dark: 类；
 * 4. 触发器 hover / focus-visible / 展开态统一 1px 主题色边框，transition-colors duration-200 平滑过渡；箭头旋转与变色同拍；
 * 5. 滚动条默认使用 scrollbar-hide 隐藏，面板采用 calc(100vh - 24px) 充分高度，杜绝多余滚动条与箭头干扰。
 * 6. mode="dropdown"：菜单胶囊形态（筛选/工具栏），非表单输入框；默认 popper 定位；文案在除箭头外的左侧区域居中。
 */
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import type { Component } from "vue";
import { ChevronDown, ChevronRight } from "lucide-vue-next";
import { zxDDPop } from "@/composables/useGsapTransition";

export interface ZXSelectOption {
    label: string;
    value: string;
    disabled?: boolean;
    /** 分隔线项：渲染为细分隔线而非可点行 */
    separator?: boolean;
    /** 分组标题：不可点击的提示小标题 */
    header?: boolean;
    /** 右侧附加说明或提示文本 */
    shortcut?: string;
    /** 左侧图标列（任一选项带 icon 时整列保留对齐） */
    icon?: Component;
    /** 二级菜单：悬停该项时在右侧弹出子面板 */
    children?: ZXSelectOption[];
    /** 点击后不关闭面板（适合多选场景） */
    keepOpen?: boolean;
}

/** 兼容旧代码类型别名 */
export type ZXDropdownOption = ZXSelectOption;

const props = withDefaults(
    defineProps<{
        options: ZXSelectOption[];
        modelValue: string;
        placeholder?: string;
        triggerClass?: string;
        panelClass?: string;
        /** 紧凑模式：更小的行距与字号 */
        compact?: boolean;
        /**
         * 外观形态：
         * - 'select'（默认）：表单下拉（白底描边输入框感）
         * - 'dropdown'：菜单下拉胶囊（工具栏筛选，灰底全圆角，非表单）
         */
        mode?: "select" | "dropdown";
        /**
         * 定位模式：
         * - 'item-aligned'：面板垂直位移，当前选中的值精准重合对齐触发器
         * - 'popper'：常规下拉，面板居于触发器下方/上方（dropdown 默认）
         * 不传时：select → item-aligned，dropdown → popper
         */
        position?: "item-aligned" | "popper";
    }>(),
    {
        placeholder: "请选择",
        compact: false,
        mode: "select",
    },
);

const emit = defineEmits<{
    (e: "update:modelValue", value: string): void;
}>();

const triggerRef = ref<HTMLElement | null>(null);
const panelRef = ref<HTMLElement | null>(null);
const subRef = ref<HTMLElement | null>(null);
const open = ref(false);
const pos = ref({ x: 0, y: 0 });
const triggerWidth = ref(160);

const sub = ref<{ x: number; y: number; options: ZXSelectOption[] } | null>(null);

const hasIcons = computed(() =>
    props.options.some((o) => o.icon || o.children?.some((c) => c.icon)),
);

const isDropdownMode = computed(() => props.mode === "dropdown");

const isItemAligned = computed(() => {
    if (props.position) return props.position === "item-aligned";
    if (isDropdownMode.value) return false;
    return !props.compact;
});

const currentLabel = () =>
    props.options.find((opt) => opt.value === props.modelValue)?.label ??
    props.placeholder ??
    "请选择";

const computedTriggerClass = computed(() => {
    if (props.triggerClass) return props.triggerClass;
    if (isDropdownMode.value) {
        return props.compact
            ? "btn-touch inline-flex h-8 flex-shrink-0 cursor-pointer items-center rounded-full border border-slate-200 bg-gray-100 pl-3 pr-2 text-xs font-medium text-zx-text-muted transition-colors duration-200 hover:border-slate-300 hover:bg-gray-200 hover:text-zx-text"
            : "btn-touch inline-flex h-[38px] min-w-[120px] flex-shrink-0 cursor-pointer items-center rounded-full border border-slate-200 bg-gray-100 pl-3.5 pr-2.5 text-xs font-medium text-zx-text-muted transition-colors duration-200 hover:border-slate-300 hover:bg-gray-200 hover:text-zx-text";
    }
    return props.compact
        ? "inline-flex h-7 items-center justify-between gap-1.5 rounded-lg border border-slate-200 bg-white px-2 text-xs text-zx-text shadow-2xs transition-colors duration-200 hover:border-zx-primary focus-visible:border-zx-primary focus:outline-none cursor-pointer"
        : "inline-flex h-9 min-w-[160px] items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs sm:text-sm text-zx-text shadow-2xs transition-colors duration-200 hover:border-zx-primary focus-visible:border-zx-primary focus:outline-none cursor-pointer";
});

const toggle = () => {
    open.value = !open.value;
    if (!open.value) {
        sub.value = null;
        triggerRef.value?.blur();
    }
};

const select = (opt: ZXSelectOption) => {
    if (opt.disabled || opt.separator || opt.header) return;
    emit("update:modelValue", opt.value);
    if (opt.keepOpen) return;
    open.value = false;
    sub.value = null;
    triggerRef.value?.blur();
};

/** 二级菜单：定位到触发项右侧（屏内防溢出） */
const openSub = (opt: ZXSelectOption, e: MouseEvent) => {
    if (!opt.children?.length || opt.disabled) {
        sub.value = null;
        return;
    }
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const h = Math.min(opt.children.length * 32 + 12, 360);
    const w = 180;
    let x = r.right - 2;
    let y = r.top - 4;
    if (x + w > window.innerWidth - 8) {
        x = Math.max(8, r.left - w + 2);
    }
    if (y + h > window.innerHeight - 8) {
        y = Math.max(8, window.innerHeight - h - 8);
    }
    sub.value = { x, y, options: opt.children };
};

/** 视口内防溢出与值对齐定位（对齐 shadcn Select item-aligned 规范） */
const updatePos = () => {
    const trigger = triggerRef.value;
    const panel = panelRef.value;
    if (!trigger || !panel) return;

    const triggerRect = trigger.getBoundingClientRect();
    triggerWidth.value = Math.round(triggerRect.width);

    // 水平对齐：左边缘对齐触发器，视口右侧自动夹取
    const panelWidth = Math.max(panel.offsetWidth, triggerRect.width);
    const x = Math.max(8, Math.min(triggerRect.left, window.innerWidth - panelWidth - 8));

    const viewportHeight = window.innerHeight;
    const panelHeight = panel.offsetHeight;
    let y = triggerRect.bottom + 6;

    if (isItemAligned.value) {
        // 查找当前选中项元素
        const selectedEl =
            panel.querySelector<HTMLElement>('[data-selected="true"]') ||
            panel.querySelector<HTMLElement>("button[data-dropdown-item]");

        if (selectedEl) {
            const itemHeight = selectedEl.offsetHeight;

            // 若列表内容产生滚动，将选中项在滚动可视区内居中
            if (panel.scrollHeight > panel.clientHeight) {
                const desiredScroll =
                    selectedEl.offsetTop - (panel.clientHeight - itemHeight) / 2;
                panel.scrollTop = Math.max(0, desiredScroll);
            }

            // 计算选中项相对于 panel 顶部的实时相对位置
            const itemRect = selectedEl.getBoundingClientRect();
            const panelRect = panel.getBoundingClientRect();
            const itemRelativeY = itemRect.top - panelRect.top;

            // 核心公式：将选中项垂直中心精确重合对齐触发器中心
            const targetY =
                triggerRect.top -
                itemRelativeY +
                (triggerRect.height - itemHeight) / 2;

            // 视口边界夹取（保留 8px 安全边距）
            y = Math.max(8, Math.min(targetY, viewportHeight - panelHeight - 8));
        } else {
            // 无目标项时回退为常规对齐
            y = triggerRect.bottom + 6;
            if (y + panelHeight > viewportHeight - 8) {
                y = Math.max(8, triggerRect.top - panelHeight - 6);
            }
        }
    } else {
        // 常规 popper 模式：在触发器下方展开，放不下向上翻折
        y = triggerRect.bottom + 6;
        if (y + panelHeight > viewportHeight - 8) {
            y = Math.max(8, triggerRect.top - panelHeight - 6);
        }
    }

    pos.value = { x, y };
};

const onPointerDown = (e: PointerEvent) => {
    if (!open.value) return;
    const target = e.target as Node;
    if (
        triggerRef.value?.contains(target) ||
        panelRef.value?.contains(target) ||
        subRef.value?.contains(target)
    ) {
        return;
    }
    open.value = false;
    sub.value = null;
};

const onKeydown = (e: KeyboardEvent) => {
    if (open.value && e.key === "Escape") {
        open.value = false;
        sub.value = null;
        triggerRef.value?.blur();
    }
};

let openTriggerTop = 0;
const onScrollDismiss = () => {
    if (!open.value) return;
    const top = triggerRef.value?.getBoundingClientRect().top ?? 0;
    if (Math.abs(top - openTriggerTop) > 24) {
        open.value = false;
        sub.value = null;
        triggerRef.value?.blur();
    }
};

const onDismiss = () => {
    if (open.value) {
        open.value = false;
        sub.value = null;
        triggerRef.value?.blur();
    }
};

watch(open, (visible) => {
    if (visible) {
        nextTick(() => {
            updatePos();
            openTriggerTop = triggerRef.value?.getBoundingClientRect().top ?? 0;
        });
    } else {
        sub.value = null;
    }
});

onMounted(() => {
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeydown);
    window.addEventListener("scroll", onScrollDismiss, true);
    window.addEventListener("resize", onDismiss);
});

onUnmounted(() => {
    window.removeEventListener("pointerdown", onPointerDown, true);
    window.removeEventListener("keydown", onKeydown);
    window.removeEventListener("scroll", onScrollDismiss, true);
    window.removeEventListener("resize", onDismiss);
});
</script>

<template>
    <button
        ref="triggerRef"
        :class="[
            computedTriggerClass,
            open
                ? isDropdownMode
                    ? 'border-slate-300! bg-gray-200! text-zx-text!'
                    : 'border-zx-primary!'
                : '',
        ]"
        type="button"
        @click="toggle"
    >
        <slot name="trigger" :label="currentLabel()" :open="open">
            <!-- dropdown：文案在「除箭头外」的左侧区域居中，箭头贴右 -->
            <template v-if="isDropdownMode">
                <span
                    class="min-w-0 flex-1 truncate text-center font-medium transition-colors duration-200"
                >
                    {{ currentLabel() }}
                </span>
                <ChevronDown
                    class="h-4 w-4 shrink-0 transition-all duration-200"
                    :class="
                        open
                            ? 'rotate-180 text-zx-text'
                            : 'text-zx-text-muted'
                    "
                />
            </template>
            <!-- select：表单布局，文案 + 箭头两端对齐 -->
            <template v-else>
                <span
                    class="truncate font-normal transition-colors duration-200"
                    :class="modelValue ? 'text-zx-text' : 'text-zx-text-subtle'"
                >
                    {{ currentLabel() }}
                </span>
                <ChevronDown
                    class="h-4 w-4 shrink-0 text-zx-text-muted transition-all duration-200"
                    :class="open ? 'rotate-180 text-zx-primary' : ''"
                />
            </template>
        </slot>
    </button>

    <Teleport to="body">
        <Transition :css="false" @enter="zxDDPop.onEnter" @leave="zxDDPop.onLeave">
            <div
                v-if="open"
                ref="panelRef"
                class="fixed z-9999 flex flex-col gap-0.5 max-h-[calc(100vh-24px)] max-w-[min(460px,92vw)] overflow-y-auto overscroll-contain scrollbar-hide rounded-lg border border-slate-200 bg-white p-1 shadow-lg select-none"
                :class="[
                    compact ? 'min-w-32' : 'min-w-[160px]',
                    panelClass,
                ]"
                :style="{
                    left: `${pos.x}px`,
                    top: `${pos.y}px`,
                    minWidth: `${triggerWidth}px`,
                }"
            >
                <template v-for="opt in options" :key="opt.value || opt.label">
                    <!-- 分隔线 -->
                    <div
                        v-if="opt.separator"
                        class="-mx-0.5 my-1 h-px bg-slate-100"
                        aria-hidden="true"
                    />

                    <!-- 分组标题 -->
                    <div
                        v-else-if="opt.header"
                        class="px-2 py-1 text-[11px] font-semibold text-zx-text-subtle select-none tracking-wider uppercase"
                    >
                        {{ opt.label }}
                    </div>

                    <!-- 选项 -->
                    <button
                        v-else
                        :disabled="opt.disabled"
                        :data-dropdown-item="true"
                        :data-value="opt.value"
                        :data-selected="opt.value === modelValue ? 'true' : undefined"
                        class="group flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg text-left whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-40"
                        :class="[
                            compact ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-xs sm:text-sm',
                            opt.value === modelValue
                                ? 'bg-zx-primary text-[color:var(--zx-color-on-primary)] font-medium shadow-2xs'
                                : 'text-zx-text hover:bg-zx-primary-soft hover:text-zx-primary',
                        ]"
                        type="button"
                        @click="
                            opt.children?.length
                                ? openSub(opt, $event)
                                : select(opt)
                        "
                        @mouseenter="openSub(opt, $event)"
                    >
                        <span class="flex min-w-0 flex-1 items-center gap-2">
                            <!-- 图标位 -->
                            <component
                                :is="opt.icon"
                                v-if="opt.icon"
                                class="h-4 w-4 shrink-0 transition-colors"
                                :class="opt.value === modelValue ? 'text-[color:var(--zx-color-on-primary)]' : 'text-zx-text-muted group-hover:text-zx-primary'"
                            />
                            <span v-else-if="hasIcons" class="h-4 w-4 shrink-0" aria-hidden="true" />
                            <slot name="option" :option="opt">
                                <span class="truncate">{{ opt.label }}</span>
                            </slot>
                        </span>

                        <!-- 右侧区域：附加文本 / 二级子选项指示符 -->
                        <span
                            v-if="opt.shortcut"
                            class="shrink-0 font-mono text-[11px] tracking-wider transition-colors"
                            :class="opt.value === modelValue ? 'text-[color:var(--zx-color-on-primary)]/80' : 'text-zx-text-subtle'"
                        >
                            {{ opt.shortcut }}
                        </span>
                        <ChevronRight
                            v-if="opt.children?.length"
                            class="h-3.5 w-3.5 shrink-0 transition-colors"
                            :class="opt.value === modelValue ? 'text-[color:var(--zx-color-on-primary)]/80' : 'text-zx-text-muted group-hover:text-zx-primary'"
                        />
                    </button>
                </template>
            </div>
        </Transition>
    </Teleport>

    <!-- 二级菜单面板（悬停带 children 的项时弹出） -->
    <Teleport to="body">
        <Transition :css="false" @enter="zxDDPop.onEnter" @leave="zxDDPop.onLeave">
            <div
                v-if="sub"
                ref="subRef"
                class="fixed z-[10000] flex flex-col gap-0.5 max-h-[calc(100vh-24px)] min-w-36 overflow-y-auto overscroll-contain scrollbar-hide rounded-lg border border-slate-200 bg-white p-1 shadow-lg select-none"
                :style="{ left: `${sub.x}px`, top: `${sub.y}px` }"
            >
                <template v-for="c in sub.options" :key="c.value || c.label">
                    <div
                        v-if="c.separator"
                        class="-mx-0.5 my-1 h-px bg-slate-100"
                        aria-hidden="true"
                    />
                    <div
                        v-else-if="c.header"
                        class="px-2 py-1 text-[11px] font-semibold text-zx-text-subtle select-none tracking-wider uppercase"
                    >
                        {{ c.label }}
                    </div>
                    <button
                        v-else
                        :disabled="c.disabled"
                        class="group flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg text-left whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-40"
                        :class="[
                            compact ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-xs sm:text-sm',
                            c.value === modelValue
                                ? 'bg-zx-primary text-[color:var(--zx-color-on-primary)] font-medium shadow-2xs'
                                : 'text-zx-text hover:bg-zx-primary-soft hover:text-zx-primary',
                        ]"
                        type="button"
                        @click="select(c)"
                    >
                        <span class="flex min-w-0 flex-1 items-center gap-2">
                            <component
                                :is="c.icon"
                                v-if="c.icon"
                                class="h-4 w-4 shrink-0 transition-colors"
                                :class="c.value === modelValue ? 'text-[color:var(--zx-color-on-primary)]' : 'text-zx-text-muted group-hover:text-zx-primary'"
                            />
                            <span class="truncate">{{ c.label }}</span>
                        </span>
                        <span
                            v-if="c.shortcut"
                            class="shrink-0 font-mono text-[11px] tracking-wider transition-colors"
                            :class="c.value === modelValue ? 'text-[color:var(--zx-color-on-primary)]/80' : 'text-zx-text-subtle'"
                        >
                            {{ c.shortcut }}
                        </span>
                    </button>
                </template>
            </div>
        </Transition>
    </Teleport>
</template>
