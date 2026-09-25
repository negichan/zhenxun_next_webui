<script setup lang="ts">
/**
 * ZXDropdownMenu - 应用程序下拉菜单组件（桌面应用菜单栏 / 动作菜单规范）
 *
 * 专用于顶部菜单栏（如文件编辑器）、上下文功能菜单等；
 * Popper 贴靠模式在触发器下方展开，支持多级级联子菜单、勾选状态项、快捷键与分隔线；
 * 严格遵循 DESIGN.md 主题色彩规范，自适应浅深色模式。
 */
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import type { Component } from "vue";
import { Check, ChevronRight } from "lucide-vue-next";
import { zxDDPop } from "@/composables/useGsapTransition";

export interface ZXDropdownMenuOption {
    label: string;
    value: string;
    disabled?: boolean;
    /** 分隔线项：渲染为细分隔线而非可点击行 */
    separator?: boolean;
    /** 分组标题：不可点击的提示小标题 */
    header?: boolean;
    /** 右侧快捷键提示（如 'Ctrl+S', 'Alt+Z'） */
    shortcut?: string;
    /** 勾选标记（开关型菜单项，如 '自动换行', '显示行号'） */
    checked?: boolean;
    /** 左侧图标 */
    icon?: Component;
    /** 危险操作标红 */
    danger?: boolean;
    /** 二级子菜单 */
    children?: ZXDropdownMenuOption[];
    /** 点击后不关闭面板（适合连续操作） */
    keepOpen?: boolean;
}

const props = withDefaults(
    defineProps<{
        options: ZXDropdownMenuOption[];
        modelValue?: string;
        placeholder?: string;
        triggerClass?: string;
        /** 展开激活态触发器额外类名 */
        activeTriggerClass?: string;
        panelClass?: string;
        /** 紧凑模式：更小的行距与字号（默认针对菜单栏开启） */
        compact?: boolean;
    }>(),
    {
        placeholder: "菜单",
        compact: true,
        activeTriggerClass: "bg-zx-primary-soft text-zx-primary font-semibold",
    },
);

const emit = defineEmits<{
    (e: "update:modelValue", value: string): void;
    (e: "select", option: ZXDropdownMenuOption): void;
}>();

const triggerRef = ref<HTMLElement | null>(null);
const panelRef = ref<HTMLElement | null>(null);
const subRef = ref<HTMLElement | null>(null);
const open = ref(false);
const pos = ref({ x: 0, y: 0 });

const sub = ref<{ x: number; y: number; options: ZXDropdownMenuOption[] } | null>(null);

const hasCheckOrIcon = computed(() =>
    props.options.some((o) => o.icon || o.checked !== undefined),
);

const toggle = () => {
    open.value = !open.value;
    if (!open.value) sub.value = null;
};

const select = (opt: ZXDropdownMenuOption) => {
    if (opt.disabled || opt.separator || opt.header) return;
    emit("update:modelValue", opt.value);
    emit("select", opt);
    if (opt.keepOpen) return;
    open.value = false;
    sub.value = null;
    triggerRef.value?.blur();
};

const openSub = (opt: ZXDropdownMenuOption, e: MouseEvent) => {
    if (!opt.children?.length || opt.disabled) {
        sub.value = null;
        return;
    }
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const h = Math.min(opt.children.length * 30 + 12, 360);
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

const updatePos = () => {
    const trigger = triggerRef.value;
    const panel = panelRef.value;
    if (!trigger || !panel) return;

    const tr = trigger.getBoundingClientRect();
    const pw = panel.offsetWidth;
    const ph = panel.offsetHeight;

    const x = Math.max(8, Math.min(tr.left, window.innerWidth - pw - 8));
    let y = tr.bottom + 4;
    if (y + ph > window.innerHeight - 8) {
        y = Math.max(8, tr.top - ph - 4);
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
    }
};

let openTriggerTop = 0;
const onScrollDismiss = () => {
    if (!open.value) return;
    const top = triggerRef.value?.getBoundingClientRect().top ?? 0;
    if (Math.abs(top - openTriggerTop) > 24) {
        open.value = false;
        sub.value = null;
    }
};

const onDismiss = () => {
    if (open.value) {
        open.value = false;
        sub.value = null;
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
            triggerClass ||
                'inline-flex h-7 cursor-pointer items-center rounded-lg px-2.5 text-xs font-medium text-zx-text transition-colors hover:bg-zx-primary-soft hover:text-zx-primary',
            open && activeTriggerClass ? activeTriggerClass : '',
        ]"
        type="button"
        @click="toggle"
    >
        <slot name="trigger" :open="open">
            <span>{{ placeholder }}</span>
        </slot>
    </button>

    <Teleport to="body">
        <Transition :css="false" @enter="zxDDPop.onEnter" @leave="zxDDPop.onLeave">
            <div
                v-if="open"
                ref="panelRef"
                class="fixed z-9999 flex flex-col gap-0.5 max-h-[calc(100vh-24px)] min-w-44 max-w-[min(460px,92vw)] overflow-y-auto overscroll-contain scrollbar-hide rounded-lg border border-slate-200 bg-white p-1 shadow-lg select-none"
                :class="panelClass"
                :style="{ left: `${pos.x}px`, top: `${pos.y}px` }"
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
                        class="px-2 py-1 text-[11px] font-semibold text-zx-text-subtle tracking-wider uppercase"
                    >
                        {{ opt.label }}
                    </div>

                    <!-- 菜单项 -->
                    <button
                        v-else
                        :disabled="opt.disabled"
                        class="group flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg text-left whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-40"
                        :class="[
                            compact ? 'px-2 py-1 text-xs' : 'px-2.5 py-1.5 text-sm',
                            opt.danger
                                ? 'text-zx-danger hover:bg-zx-danger-soft hover:text-zx-danger'
                                : 'text-zx-text hover:bg-zx-primary-soft hover:text-zx-primary',
                        ]"
                        type="button"
                        @click="opt.children?.length ? openSub(opt, $event) : select(opt)"
                        @mouseenter="openSub(opt, $event)"
                    >
                        <span class="flex min-w-0 flex-1 items-center gap-2">
                            <!-- 勾选与图标列 -->
                            <span
                                v-if="hasCheckOrIcon"
                                class="flex h-3.5 w-3.5 shrink-0 items-center justify-center text-zx-text"
                            >
                                <Check
                                    v-if="opt.checked"
                                    class="h-3.5 w-3.5 stroke-[2.5]"
                                />
                                <component
                                    :is="opt.icon"
                                    v-else-if="opt.icon"
                                    class="h-3.5 w-3.5 text-zx-text-muted group-hover:text-zx-primary"
                                />
                            </span>

                            <slot name="option" :option="opt">
                                <span class="truncate">{{ opt.label }}</span>
                            </slot>
                        </span>

                        <!-- 快捷键提示 -->
                        <span
                            v-if="opt.shortcut"
                            class="shrink-0 font-mono text-[11px] text-zx-text-subtle tracking-wider"
                        >
                            {{ opt.shortcut }}
                        </span>

                        <!-- 子菜单箭头 -->
                        <ChevronRight
                            v-if="opt.children?.length"
                            class="h-3.5 w-3.5 shrink-0 text-zx-text-muted group-hover:text-zx-primary"
                        />
                    </button>
                </template>
            </div>
        </Transition>
    </Teleport>

    <!-- 二级级联子菜单 -->
    <Teleport to="body">
        <Transition :css="false" @enter="zxDDPop.onEnter" @leave="zxDDPop.onLeave">
            <div
                v-if="sub"
                ref="subRef"
                class="fixed z-[10000] flex flex-col gap-0.5 max-h-[calc(100vh-24px)] min-w-40 overflow-y-auto overscroll-contain scrollbar-hide rounded-lg border border-slate-200 bg-white p-1 shadow-lg select-none"
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
                        class="px-2 py-1 text-[11px] font-semibold text-zx-text-subtle tracking-wider uppercase"
                    >
                        {{ c.label }}
                    </div>
                    <button
                        v-else
                        :disabled="c.disabled"
                        class="group flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg text-left whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-40"
                        :class="[
                            compact ? 'px-2 py-1 text-xs' : 'px-2.5 py-1.5 text-sm',
                            c.danger
                                ? 'text-zx-danger hover:bg-zx-danger-soft hover:text-zx-danger'
                                : 'text-zx-text hover:bg-zx-primary-soft hover:text-zx-primary',
                        ]"
                        type="button"
                        @click="select(c)"
                    >
                        <span class="flex min-w-0 flex-1 items-center gap-2">
                            <span
                                v-if="sub.options.some((o) => o.icon || o.checked !== undefined)"
                                class="flex h-3.5 w-3.5 shrink-0 items-center justify-center text-zx-text"
                            >
                                <Check
                                    v-if="c.checked"
                                    class="h-3.5 w-3.5 stroke-[2.5]"
                                />
                                <component
                                    :is="c.icon"
                                    v-else-if="c.icon"
                                    class="h-3.5 w-3.5 text-zx-text-muted group-hover:text-zx-primary"
                                />
                            </span>
                            <span class="truncate">{{ c.label }}</span>
                        </span>
                        <span
                            v-if="c.shortcut"
                            class="shrink-0 font-mono text-[11px] text-zx-text-subtle tracking-wider group-hover:text-zx-primary/80"
                        >
                            {{ c.shortcut }}
                        </span>
                    </button>
                </template>
            </div>
        </Transition>
    </Teleport>
</template>
