<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { ZXConfetti } from "@/components/zxcomponent/Confetti/index";
import defaultAva from "@/assets/img/avatar.webp";
import { resolveStickerUrl } from "@/utils/stickers";

interface NotificationItem {
    id: number;
    title?: string;
    message?: string;
    type?: string;
    position: string;
    duration: number;
    remaining: number;
    createdAt: number;
    confetti?: boolean | object;
    avatar?: string;
    subtitle?: string;
    stickerUrl?: string;
    customClass?: string;
    contentClass?: string;
    onClose?: () => void;
}

const MAX_PER_POSITION = 99;
const maxVisible = ref(4);
const notifications = ref<NotificationItem[]>([]);
const timers = new Map<number, { timer: ReturnType<typeof setTimeout>; start: number }>();
const closingIds = ref<Set<number>>(new Set());
const enteringIds = ref<Set<number>>(new Set());

// 记录各通知项的实际高度（用于平发展开时的偏移量精确计算）
const cardHeights = ref<Record<number, number>>({});

// 记录各位置堆叠是否被鼠标悬停展开
const hoveredPositions = ref<Record<string, boolean>>({});

// 按位置分组
const groupedNotifications = computed(() => {
    const groups: Record<string, NotificationItem[]> = {};
    for (const n of notifications.value) {
        if (!groups[n.position]) groups[n.position] = [];
        groups[n.position].push(n);
    }
    return groups;
});

// 获取当前位置按时间倒序且不超过最大可视数量的通知列表
function getVisibleCards(list: NotificationItem[]) {
    return [...list].reverse().slice(0, maxVisible.value);
}

// 判断是否为无标题的轻量 Toast（类似 Sonner / shadcn toast）
function isCompactToast(item?: NotificationItem) {
    if (!item) return false;
    if (item.avatar || item.subtitle || item.stickerUrl) return false;
    return !item.title || !item.message;
}

function onAvatarError(e: Event) {
    const img = e.target as HTMLImageElement;
    img.src = defaultAva;
}

// 暴露设置最大同时显示数量方法
function setMaxVisible(count: number) {
    if (typeof count === "number" && count > 0) {
        maxVisible.value = count;
    }
}

// 暴露方法供外部调用
function addNotification(config: any) {
    const id = Date.now() + Math.random();
    const {
        title = "",
        message = "",
        type = "info",
        duration = 3000,
        position = "top-center",
        onClose,
        customClass = "",
        contentClass = "text-zx-text-muted",
        confetti = false,
        avatar = "",
        subtitle = "",
        sticker = "",
        maxVisible: configMaxVisible,
        dedupe = true,
    } = config;

    // 同文案仍在展示/退场中：直接忽略，避免失败重试连着弹一样的
    if (dedupe !== false) {
        const dup = notifications.value.find(
            (n) =>
                n.type === type &&
                n.title === title &&
                n.message === message &&
                (closingIds.value.has(n.id) || Date.now() - n.createdAt < 8000),
        );
        if (dup) return;
    }

    if (typeof configMaxVisible === "number" && configMaxVisible > 0) {
        maxVisible.value = configMaxVisible;
    }

    const list = notifications.value.filter((n) => n.position === position);
    if (list.length >= MAX_PER_POSITION) {
        const oldest = list[0];
        removeNotification(oldest.id, oldest.onClose);
    }

    const stickerUrl = sticker ? resolveStickerUrl(sticker) : "";

    const notification: NotificationItem = {
        id,
        title,
        message,
        type,
        position,
        onClose,
        customClass,
        contentClass,
        duration,
        remaining: duration,
        createdAt: Date.now(),
        confetti,
        avatar,
        subtitle,
        stickerUrl,
    };

    enteringIds.value.add(id);
    notifications.value.push(notification);

    setTimeout(() => {
        enteringIds.value.delete(id);
    }, 30);

    nextTick(() => {
        if (confetti) {
            requestAnimationFrame(() => {
                const el = document.querySelector<HTMLElement>(
                    `[data-notification-id="${id}"]`,
                );
                const confettiConfig =
                    typeof confetti === "boolean" ? {} : confetti;
                if (el) {
                    ZXConfetti.atElement(el, confettiConfig);
                } else {
                    ZXConfetti({
                        x: window.innerWidth - 180,
                        y: 60,
                        ...confettiConfig,
                    });
                }
            });
        }
    });

    if (duration > 0) {
        startTimer(notification);
    }
}

defineExpose({ addNotification, setMaxVisible });

// 启动计时器
function startTimer(item: NotificationItem) {
    const id = item.id;
    const start = Date.now();
    const timer = setTimeout(() => {
        removeNotification(id, item.onClose);
    }, item.remaining);

    timers.set(id, { timer, start });
}

// 暂停计时器
function pauseTimer(item: NotificationItem) {
    const t = timers.get(item.id);
    if (!t) return;
    clearTimeout(t.timer);
    item.remaining -= Date.now() - t.start;
    timers.delete(item.id);
}

// 恢复计时器
function resumeTimer(item: NotificationItem) {
    if (item.duration > 0 && item.remaining > 0 && !timers.has(item.id)) {
        startTimer(item);
    }
}

// 移除通知（带退场过渡）
function removeNotification(id: number, onClose?: () => void) {
    if (closingIds.value.has(id)) return;
    closingIds.value.add(id);

    const t = timers.get(id);
    if (t) {
        clearTimeout(t.timer);
        timers.delete(id);
    }

    setTimeout(() => {
        notifications.value = notifications.value.filter((n) => n.id !== id);
        closingIds.value.delete(id);
        delete cardHeights.value[id];
        if (onClose) onClose();
    }, 220);
}

// 手动关闭
function manualClose(item: NotificationItem) {
    removeNotification(item.id, item.onClose);
}

// 鼠标悬停进入：展开叠层并暂停当前位置的所有计时器
function handleContainerMouseEnter(pos: string) {
    hoveredPositions.value[pos] = true;
    const list = groupedNotifications.value[pos] || [];
    for (const item of list) {
        pauseTimer(item);
    }
}

// 鼠标移出：收起叠层并恢复计时器
function handleContainerMouseLeave(pos: string) {
    hoveredPositions.value[pos] = false;
    const list = groupedNotifications.value[pos] || [];
    for (const item of list) {
        resumeTimer(item);
    }
}

// 测量卡片真实高度
function setCardRef(el: any, id: number) {
    if (el && el instanceof HTMLElement) {
        const h = el.offsetHeight;
        if (h && cardHeights.value[id] !== h) {
            cardHeights.value[id] = h;
        }
    }
}

const STACK_PEEK = 8;
const STACK_SCALE_STEP = 0.025;

function getCardHeight(item: NotificationItem) {
    return cardHeights.value[item.id] || (isCompactToast(item) ? 48 : 80);
}

/** 折叠叠层：浅色略压暗、深色略提亮（不用 opacity，避免透出底层文字） */
function stackDepthFilter(index: number) {
    if (index <= 0) return "none";
    const isDark = document.documentElement.classList.contains(
        "theme-zhenxun-dark",
    );
    if (isDark) {
        return `brightness(${(1 + Math.min(index, 5) * 0.008).toFixed(3)})`;
    }
    return `brightness(${(1 - Math.min(index, 5) * 0.012).toFixed(3)})`;
}

/**
 * 折叠态叠层几何
 * 按真实高度推每张的 y，保证后面每张都露出 STACK_PEEK，避免高压住矮卡
 */
function getCollapseLayout(list: NotificationItem[], isTop: boolean) {
    const scales = list.map((_, i) => 1 - i * STACK_SCALE_STEP);
    const visualH = list.map((item, i) => getCardHeight(item) * scales[i]);
    const ys: number[] = [0];
    if (!list.length) return { ys, scales, visualH };

    if (isTop) {
        // 向下露边：后卡底边 = 前卡底边 + PEEK（后卡更高时对齐顶边，避免冒出顶部）
        let bottom = visualH[0];
        for (let i = 1; i < list.length; i++) {
            const y = Math.max(ys[i - 1], bottom + STACK_PEEK - visualH[i]);
            ys.push(y);
            bottom = y + visualH[i];
        }
    } else {
        // 向上露边：后卡顶边 = 前卡顶边 + PEEK（后卡更高时贴底，避免掉出底部）
        let top = visualH[0];
        for (let i = 1; i < list.length; i++) {
            const y = Math.min(ys[i - 1], visualH[i] - (top + STACK_PEEK), 0);
            ys.push(y);
            top = visualH[i] - y;
        }
    }
    return { ys, scales, visualH };
}

// 计算各通知项在堆叠中的样式（3D 叠层 + 依次展开算法）
function getCardStyle(
    item: NotificationItem,
    index: number,
    list: NotificationItem[],
    position: string,
) {
    const isTop = position.startsWith("top-");
    const isHovered = !!hoveredPositions.value[position];
    const isClosing = closingIds.value.has(item.id);
    const visibleCards = getVisibleCards(list);
    const totalVisible = visibleCards.length;

    // 退出动画：纯垂直方向轻微滑出并淡化，消除向右滑动对点击和视口边缘的干扰
    if (isClosing) {
        const exitY = isTop ? -16 : 16;
        return {
            transform: `translate3d(0, ${exitY}px, 0) scale(0.95)`,
            opacity: 0,
            pointerEvents: "none" as const,
            transition:
                "transform 200ms cubic-bezier(0.16, 1, 0.3, 1), opacity 180ms ease",
        };
    }

    // 进场初始状态（保持 100% 实底不透明，杜绝半透明导致底层卡片文字透光混乱）
    if (enteringIds.value.has(item.id)) {
        return {
            transform: `translate3d(0, ${isTop ? -24 : 24}px, 0) scale(0.96)`,
            opacity: 1,
            pointerEvents: "none" as const,
            zIndex: 60,
            transition: "none",
        };
    }

    // 依次展开交错延迟：展开时自上向下逐张延迟 40ms，收起时自下向上反向回收
    const staggerDelay = isHovered
        ? index * 40
        : Math.max(0, (totalVisible - 1 - index) * 25);

    // 悬停展开状态（所有可视通知波浪式依次展开为完整垂直列表）
    if (isHovered) {
        let offset = 0;
        for (let i = 0; i < index; i++) {
            const prev = list[i];
            const defaultH = isCompactToast(prev) ? 48 : 80;
            const h = cardHeights.value[prev?.id] || defaultH;
            offset += h + 10;
        }

        return {
            transform: `translate3d(0, ${isTop ? offset : -offset}px, 0) scale(1)`,
            zIndex: 100 - index,
            opacity: 1,
            filter: "none",
            pointerEvents: "auto" as const,
            transition:
                `transform 280ms cubic-bezier(0.16, 1, 0.3, 1) ${staggerDelay}ms, opacity 220ms ease ${staggerDelay}ms, filter 220ms ease ${staggerDelay}ms`,
        };
    }

    // 默认折叠收起状态（按真实高度露边；用 brightness 微调明暗，不透明度保持 1 防止透字）
    if (index === 0) {
        // 第一张（最上层主卡片）
        return {
            transform: "translate3d(0, 0, 0) scale(1)",
            zIndex: 50,
            opacity: 1,
            pointerEvents: "auto" as const,
            transition:
                `transform 280ms cubic-bezier(0.16, 1, 0.3, 1) ${staggerDelay}ms, opacity 240ms ease ${staggerDelay}ms`,
        };
    } else if (index < maxVisible.value) {
        const { ys, scales } = getCollapseLayout(list, isTop);
        const stepY = ys[index] ?? index * (isTop ? STACK_PEEK : -STACK_PEEK);
        const stepScale = scales[index] ?? 1 - index * STACK_SCALE_STEP;

        return {
            transform: `translate3d(0, ${stepY}px, 0) scale(${stepScale})`,
            zIndex: 50 - index,
            opacity: 1,
            filter: stackDepthFilter(index),
            pointerEvents: index <= 1 ? ("auto" as const) : ("none" as const),
            transition:
                `transform 280ms cubic-bezier(0.16, 1, 0.3, 1) ${staggerDelay}ms, filter 240ms ease ${staggerDelay}ms, opacity 240ms ease ${staggerDelay}ms`,
        };
    } else {
        // 超过 maxVisible 限制，折叠在最深层隐藏
        const maxStepY = maxVisible.value * (isTop ? STACK_PEEK : -STACK_PEEK);
        const maxStepScale = 1 - maxVisible.value * STACK_SCALE_STEP;
        return {
            transform: `translate3d(0, ${maxStepY}px, 0) scale(${maxStepScale})`,
            zIndex: 50 - index,
            opacity: 0,
            pointerEvents: "none" as const,
            transition:
                "transform 280ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms ease",
        };
    }
}

// 动态计算视口容器高度，避免展开时超出 hover 感应区
function getViewportHeight(pos: string, list: NotificationItem[]) {
    const visibleCards = getVisibleCards(list);
    if (visibleCards.length === 0) return 0;
    const isTop = pos.startsWith("top-");
    const isHovered = !!hoveredPositions.value[pos];

    if (!isHovered) {
        const { ys, visualH } = getCollapseLayout(visibleCards, isTop);
        let extent = 0;
        for (let i = 0; i < visibleCards.length; i++) {
            extent = Math.max(extent, isTop ? ys[i] + visualH[i] : visualH[i] - ys[i]);
        }
        return extent + 12;
    }

    let total = 0;
    for (let i = 0; i < visibleCards.length; i++) {
        const item = visibleCards[i];
        const h = getCardHeight(item);
        total += h + (i < visibleCards.length - 1 ? 10 : 0);
    }
    return total + 12;
}
</script>

<template>
    <Teleport to="body">
        <div
            v-for="(rawList, position) in groupedNotifications"
            :key="position"
            :class="['fixed z-[9999] pointer-events-none select-none transition-all duration-300', position]"
            :style="{
                height: `${getViewportHeight(position, rawList)}px`,
                minHeight: rawList.length > 0 && isCompactToast(getVisibleCards(rawList)[0]) ? '48px' : '80px',
            }"
            @mouseenter="handleContainerMouseEnter(position)"
            @mouseleave="handleContainerMouseLeave(position)"
        >
            <!-- 3D 叠层容器（按配置最多同时呈现 maxVisible 篇通知） -->
            <div class="relative h-full w-80 min-w-80 max-w-[calc(100vw-32px)] pointer-events-auto">
                <div
                    v-for="(item, index) in getVisibleCards(rawList)"
                    :key="item.id"
                    :ref="(el) => setCardRef(el, item.id)"
                    :data-index="index"
                    :data-notification-id="item.id"
                    :class="[
                        'notification-item absolute left-0 right-0 min-w-80 rounded-xl border border-slate-200 bg-white transition-all duration-300',
                        isCompactToast(item) ? 'min-h-12 px-4 py-2.5 flex items-center' : 'min-h-20 px-4 py-4 block',
                        position.startsWith('top-') ? 'top-0 origin-top' : 'bottom-0 origin-bottom',
                        index === 0 && !hoveredPositions[position] && rawList.length > 1 ? 'shadow-md' : 'shadow-sm',
                        item.type,
                        item.customClass,
                    ]"
                    :style="getCardStyle(item, index, getVisibleCards(rawList), position)"
                    @mouseenter="pauseTimer(item)"
                    @mouseleave="resumeTimer(item)"
                >
                    <div
                        class="relative flex w-full"
                        :class="isCompactToast(item) ? 'items-center' : 'items-start'"
                    >
                        <div
                            class="logo shrink-0"
                            :class="isCompactToast(item) ? 'flex items-center justify-center' : 'self-start'"
                        >
                            <!--头像模式（如 bot 上下线通知）-->
                            <img
                                v-if="item.avatar"
                                :src="item.avatar"
                                class="size-12 shrink-0 rounded-full object-cover"
                                @error="onAvatarError"
                            />
                            <!--表情包模式（如 33 宇宙真寻升华等生动反馈）-->
                            <div
                                v-else-if="item.stickerUrl"
                                class="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-50 p-0.5 shadow-xs border border-slate-100"
                            >
                                <img
                                    :src="item.stickerUrl"
                                    :alt="item.title || 'sticker'"
                                    class="h-full w-full object-contain select-none pointer-events-none transition-transform hover:scale-105"
                                />
                            </div>
                            <!--info-->
                            <div v-else-if="item.type === 'info'">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke-width="1.5"
                                    stroke="currentColor"
                                    class="text-blue-500"
                                    :class="isCompactToast(item) ? 'size-5' : 'size-6'"
                                >
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z"
                                    />
                                </svg>
                            </div>
                            <!--warning-->
                            <div v-else-if="item.type === 'warning'">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke-width="1.5"
                                    stroke="currentColor"
                                    class="text-orange-500"
                                    :class="isCompactToast(item) ? 'size-5' : 'size-6'"
                                >
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
                                    />
                                </svg>
                            </div>
                            <!--success-->
                            <div v-else-if="item.type === 'success'">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke-width="1.5"
                                    stroke="currentColor"
                                    class="text-green-500"
                                    :class="isCompactToast(item) ? 'size-5' : 'size-6'"
                                >
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                                    />
                                </svg>
                            </div>
                            <!--error-->
                            <div v-else-if="item.type === 'error'">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke-width="1.5"
                                    stroke="currentColor"
                                    class="text-red-500"
                                    :class="isCompactToast(item) ? 'size-5' : 'size-6'"
                                >
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                                    />
                                </svg>
                            </div>
                            <!--custom-->
                            <div v-else>
                                {{ item.type }}
                            </div>
                        </div>
                        <div
                            class="content w-full min-w-0 pl-2.5 pr-6"
                            :class="isCompactToast(item) ? 'flex items-center' : ''"
                        >
                            <!--头像模式：名字 / ID 副标题 / 带图标的上下线消息-->
                            <template v-if="item.avatar">
                                <div class="notification-header">
                                    <strong
                                        v-if="item.title"
                                        class="title block"
                                        >{{ item.title }}</strong
                                    >
                                    <span
                                        v-if="item.subtitle"
                                        class="mt-0.5 block text-xs text-zx-text-subtle"
                                    >
                                        {{ item.subtitle }}
                                    </span>
                                </div>
                                <!-- 上下线消息：状态色文字 + 尾部小圆点-->
                                <span
                                    :class="
                                        item.type === 'success'
                                            ? 'text-emerald-600'
                                            : item.type === 'warning'
                                              ? 'text-rose-600'
                                              : 'text-zx-text-muted'
                                    "
                                    class="mt-1.5 inline-flex items-center gap-1.5 text-sm font-medium"
                                >
                                    {{ item.message }}
                                    <!-- 环状波动小点（animate-ping）-->
                                    <span class="relative inline-flex size-2">
                                        <span
                                            class="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                                            :class="
                                                item.type === 'success'
                                                    ? 'bg-emerald-400'
                                                    : item.type === 'warning'
                                                      ? 'bg-rose-400'
                                                      : 'bg-slate-400'
                                            "
                                        ></span>
                                        <span
                                            class="relative inline-flex size-2 rounded-full"
                                            :class="
                                                item.type === 'success'
                                                    ? 'bg-emerald-500'
                                                    : item.type === 'warning'
                                                      ? 'bg-rose-500'
                                                      : 'bg-slate-400'
                                            "
                                        ></span>
                                    </span>
                                </span>
                            </template>
                            <!--无标题紧凑通知模式-->
                            <template v-else-if="isCompactToast(item)">
                                <div
                                    class="message text-sm font-medium leading-5 select-text"
                                    :class="item.contentClass && item.contentClass !== 'text-zx-text-muted' ? item.contentClass : 'text-zx-text'"
                                >
                                    {{ item.message || item.title }}
                                </div>
                            </template>
                            <!--默认带标题模式-->
                            <template v-else>
                                <div class="notification-header">
                                    <strong v-if="item.title" class="title">{{
                                        item.title
                                    }}</strong>
                                </div>
                                <div
                                    class="message mt-2 text-sm"
                                    :class="item.contentClass"
                                >
                                    {{ item.message }}
                                </div>
                            </template>
                            <div
                                class="absolute right-0 cursor-pointer text-zx-text-subtle hover:text-zx-text-muted transition-colors flex items-center justify-center p-1"
                                :class="isCompactToast(item) ? 'top-1/2 -translate-y-1/2' : 'top-0'"
                                @click.stop="manualClose(item)"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke-width="1.5"
                                    stroke="currentColor"
                                    class="size-4"
                                >
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        d="M6 18 18 6M6 6l12 12"
                                    />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </Teleport>
</template>

<style scoped>
.top-center {
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
}

.top-right {
    top: 20px;
    right: 20px;
}

.top-left {
    top: 20px;
    left: 20px;
}

.bottom-center {
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
}

.bottom-left {
    bottom: 20px;
    left: 20px;
}

.bottom-right {
    bottom: 20px;
    right: 20px;
}

.notification-item {
    will-change: transform, opacity;
}
</style>
