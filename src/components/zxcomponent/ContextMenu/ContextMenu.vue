<script setup lang="ts">
import { ctxPop } from "@/composables/useGsapTransition";
/**
 * 全局右键菜单面板（单例，由 index.ts 挂载并驱动 state）
 * 位置自动防溢出；点击菜单外 / Escape / 滚动 / 窗口缩放时关闭。
 * 支持二级子菜单（悬停展开）。
 * 触控：菜单打开时铺透明遮罩，首次点按只关菜单、不穿透到下层。
 */
import { nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { ChevronRight } from "lucide-vue-next";
import type { ZXContextMenuItem, ZXContextMenuState } from "./index";

const props = defineProps<{ state: ZXContextMenuState }>();

const menuRef = ref<HTMLElement | null>(null);
const pos = ref({ x: 0, y: 0 });

/** 二级菜单：挂在一级项右侧 */
const subMenu = ref<{
    items: ZXContextMenuItem[];
    x: number;
    y: number;
} | null>(null);
const subMenuRef = ref<HTMLElement | null>(null);

const hide = () => {
    props.state.visible = false;
    subMenu.value = null;
};

/** 遮罩关闭：走 ZXContextMenu.hide 以同步吞掉随后的 click 穿透 */
const dismissViaOverlay = () => {
    import("./index").then(({ ZXContextMenu }) => ZXContextMenu.hide());
};

/** 视口内防溢出定位 */
const updatePos = () => {
    const el = menuRef.value;
    const w = el?.offsetWidth ?? 160;
    const h = el?.offsetHeight ?? 100;
    pos.value = {
        x: Math.max(4, Math.min(props.state.x, window.innerWidth - w - 8)),
        y: Math.max(4, Math.min(props.state.y, window.innerHeight - h - 8)),
    };
};

watch(
    () => props.state.visible,
    visible => {
        if (visible) nextTick(updatePos);
        else subMenu.value = null;
    },
);

const onKeydown = (e: KeyboardEvent) => {
    if (props.state.visible && e.key === "Escape") hide();
};

const onDismiss = () => {
    if (props.state.visible) hide();
};

const itemCls = (item: ZXContextMenuItem) => {
    if (item.danger) return "text-red-500 hover:bg-zx-danger-soft";
    if (item.success) return "text-emerald-600 hover:bg-zx-success-soft";
    return "text-zx-text-muted hover:bg-slate-100";
};

const handleClick = (item: ZXContextMenuItem, e: MouseEvent) => {
    if (item.disabled || item.divider) return;
    // 触控没有 hover：带子菜单的项点按直接展开
    if (item.children?.length) {
        openSubMenu(item, e);
        return;
    }
    hide();
    item.action?.();
};

const openSubMenu = (item: ZXContextMenuItem, e: MouseEvent) => {
    if (item.disabled || !item.children?.length) {
        subMenu.value = null;
        return;
    }
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const kids = item.children;
    nextTick(() => {
        const sh = subMenuRef.value?.offsetHeight ?? 80;
        const sw = subMenuRef.value?.offsetWidth ?? 140;
        let x = r.right - 2;
        let y = r.top - 4;
        if (x + sw > window.innerWidth - 8) x = r.left - sw + 2;
        if (y + sh > window.innerHeight - 8) {
            y = Math.max(8, window.innerHeight - sh - 8);
        }
        subMenu.value = { items: kids, x, y };
    });
};

onMounted(() => {
    window.addEventListener("keydown", onKeydown);
    window.addEventListener("scroll", onDismiss, true);
    window.addEventListener("resize", onDismiss);
});

onUnmounted(() => {
    window.removeEventListener("keydown", onKeydown);
    window.removeEventListener("scroll", onDismiss, true);
    window.removeEventListener("resize", onDismiss);
});
</script>

<template>
    <div
        v-if="state.visible"
        class="fixed inset-0 z-9998"
        @click.prevent.stop="dismissViaOverlay"
    ></div>
    <Transition :css="false" @enter="ctxPop.onEnter" @leave="ctxPop.onLeave">
        <div
            v-if="state.visible"
            ref="menuRef"
            class="fixed z-9999 flex min-w-36 flex-col gap-0.5 touch-manipulation overflow-visible rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg"
            :style="{ left: `${pos.x}px`, top: `${pos.y}px` }"
            @contextmenu.prevent
        >
            <template
                v-for="(item, index) in state.items"
                :key="index"
            >
                <div
                    v-if="item.divider"
                    class="my-0.5 h-px bg-slate-200/80"
                    aria-hidden="true"
                />
                <button
                    v-else
                    :disabled="item.disabled"
                    :class="itemCls(item)"
                    class="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors disabled:pointer-events-none disabled:opacity-40"
                    type="button"
                    @click="handleClick(item, $event)"
                    @mouseenter="openSubMenu(item, $event)"
                    @mouseleave="!item.children?.length && (subMenu = null)"
                >
                    <!-- 图标位固定：无图标也占位，文字对齐 -->
                    <component
                        :is="item.icon"
                        v-if="item.icon"
                        class="size-4 shrink-0"
                    />
                    <span v-else class="size-4 shrink-0" aria-hidden="true" />
                    <span class="flex-1 whitespace-nowrap">{{ item.label }}</span>
                    <span
                        v-if="item.shortcut"
                        class="text-[11px] text-zx-text-subtle"
                        >{{ item.shortcut }}</span
                    >
                    <ChevronRight
                        v-if="item.children?.length"
                        class="h-3.5 w-3.5 shrink-0 text-zx-text-subtle"
                    />
                </button>
            </template>
        </div>
    </Transition>

    <!-- 二级菜单 -->
    <Transition :css="false" @enter="ctxPop.onEnter" @leave="ctxPop.onLeave">
        <div
            v-if="state.visible && subMenu"
            ref="subMenuRef"
            class="fixed z-10000 flex min-w-32 flex-col gap-0.5 touch-none rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg"
            :style="{ left: `${subMenu.x}px`, top: `${subMenu.y}px` }"
            @click.stop
        >
            <template
                v-for="(item, index) in subMenu.items"
                :key="index"
            >
                <div
                    v-if="item.divider"
                    class="my-0.5 h-px bg-slate-200/80"
                    aria-hidden="true"
                />
                <button
                    v-else
                    :disabled="item.disabled"
                    :class="itemCls(item)"
                    class="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors disabled:pointer-events-none disabled:opacity-40"
                    type="button"
                    @click="handleClick(item, $event)"
                >
                    <component
                        :is="item.icon"
                        v-if="item.icon"
                        class="size-4 shrink-0"
                    />
                    <span v-else class="size-4 shrink-0" aria-hidden="true" />
                    <span class="whitespace-nowrap">{{ item.label }}</span>
                </button>
            </template>
        </div>
    </Transition>
</template>
