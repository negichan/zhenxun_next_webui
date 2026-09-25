<script setup lang="ts">
import { Bell, Bot, Settings, Palette, Ellipsis, X } from "lucide-vue-next";
import { computed, defineAsyncComponent, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useThemeStore } from "@/store/theme";
import { useManageStore } from "@/store/manage.ts";
import { onClickOutside } from "@vueuse/core";
import { gsap } from "gsap";
import { openBotClient } from "@/config/menu";
import ThemeCustomizer from "./ThemeCustomizer.vue";
import RequestCenter from "./RequestCenter.vue";
// 设置弹窗懒加载：首开才拉 chunk（平时不进首屏包）；
// 首开挂载后保持常驻，关闭退场动画由组件内部 Transition 接管
const SettingsModal = defineAsyncComponent(
    () => import("./SettingsModal.vue"),
);

const themeStore = useThemeStore();
const manageStore = useManageStore();
const { requestDialogOpen, friendRequests, groupRequests } =
    storeToRefs(manageStore);

// 铃铛徽标 = 当前 bot 的待处理请求总数
const messageCount = computed(
    () => friendRequests.value.length + groupRequests.value.length,
);

const showThemePanel = ref(false);
const themePanelRef = ref<HTMLElement | null>(null);

onClickOutside(themePanelRef, () => {
    showThemePanel.value = false;
});

// 设置弹窗（桌面端与紧凑菜单共用一个状态）
const showSettingsModal = ref(false);
const settingsModalLoaded = ref(false);
watch(showSettingsModal, (v) => {
    if (v) settingsModalLoaded.value = true;
});

// 移动端 / 平板端（lg 以下）：三个按钮收纳为一个展开菜单
const showCompactMenu = ref(false);
const compactThemeOpen = ref(false);
const compactRef = ref<HTMLElement | null>(null);
const requestWrapRef = ref<HTMLElement | null>(null);

// 展开/收起：收起时把主题面板状态一起复位——否则"开面板 → 点···收起 →
// 再点···展开"会因为 compactThemeOpen 仍是 true 而直接打开主题面板
const toggleCompact = () => {
    if (showCompactMenu.value) {
        showCompactMenu.value = false;
        compactThemeOpen.value = false;
    } else {
        showCompactMenu.value = true;
    }
};

onClickOutside(compactRef, () => {
    showCompactMenu.value = false;
    compactThemeOpen.value = false;
});

// 点铃铛容器以外的地方（含主题按钮/页面其他区域）时关闭请求面板；
// 点铃铛本身属于容器内部，交给 toggle 正常开合
onClickOutside(requestWrapRef, () => {
    requestDialogOpen.value = false;
});

const openRequestCenter = () => {
    requestDialogOpen.value = true;
    showCompactMenu.value = false;
    compactThemeOpen.value = false;
    showThemePanel.value = false;
};

// 主题面板进出场：与请求面板同款（gsap 驱动）
// 快速连点保护：杀旧补间 + 令牌保证最新钩子的 done 生效
const onDropdownEnter = (el: Element, done: () => void) => {
    gsap.killTweensOf(el);
    const state = el as Element & { _tipDone?: () => void };
    state._tipDone = done;
    gsap.fromTo(
        el,
        { autoAlpha: 0, y: -8, scale: 0.96 },
        {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: 0.18,
            ease: "power2.out",
            onComplete: () => state._tipDone?.(),
        },
    );
};

const onDropdownLeave = (el: Element, done: () => void) => {
    gsap.killTweensOf(el);
    const state = el as Element & { _tipDone?: () => void };
    state._tipDone = done;
    gsap.to(el, {
        autoAlpha: 0,
        y: -6,
        scale: 0.96,
        duration: 0.15,
        ease: "power2.in",
        onComplete: () => state._tipDone?.(),
    });
};

// 折叠按钮列的进出场：容器整体从"···"下滑出，按钮再轻交错跟进；
// 进出都把容器与按钮的补间杀干净，leave 结束清内联样式防残留
const onStackEnter = (el: Element, done: () => void) => {
    const buttons = [...el.querySelectorAll(":scope > button")];
    const targets = [el, ...buttons];
    gsap.killTweensOf(targets);
    // 按钮自带 transition-all（hover 过渡），会和 gsap 每帧写入打架——先压掉，
    // 动画结束再恢复
    gsap.set(targets, { transition: "none" });
    const state = el as Element & { _tipDone?: () => void };
    state._tipDone = done;
    gsap.fromTo(
        el,
        { autoAlpha: 0, y: -12 },
        {
            autoAlpha: 1,
            y: 0,
            duration: 0.22,
            ease: "power2.out",
            onComplete: () => state._tipDone?.(),
        },
    );
    gsap.fromTo(
        buttons,
        { autoAlpha: 0, y: -6 },
        {
            autoAlpha: 1,
            y: 0,
            duration: 0.24,
            ease: "power2.out",
            stagger: 0.05,
            onComplete: () => {
                gsap.set(buttons, { clearProps: "transition" });
            },
        },
    );
};

const onStackLeave = (el: Element, done: () => void) => {
    const buttons = [...el.querySelectorAll(":scope > button")];
    const targets = [el, ...buttons];
    gsap.killTweensOf(targets);
    gsap.set(targets, { transition: "none" });
    const state = el as Element & { _tipDone?: () => void };
    state._tipDone = done;
    gsap.to(el, {
        autoAlpha: 0,
        y: -8,
        duration: 0.16,
        ease: "power2.in",
        onComplete: () => {
            gsap.set(targets, { clearProps: "all" });
            state._tipDone?.();
        },
    });
};

// 两个面板互斥：打开一个就显式关掉另一个
const toggleRequestPanel = () => {
    requestDialogOpen.value = !requestDialogOpen.value;
    showThemePanel.value = false;
};

const toggleThemePanel = () => {
    showThemePanel.value = !showThemePanel.value;
    requestDialogOpen.value = false;
};

// 打开 Bot 端（模拟端）独立窗口；紧凑堆叠里点完顺手收起菜单
const openBotClientWindow = () => {
    openBotClient();
    showCompactMenu.value = false;
    compactThemeOpen.value = false;
};
</script>

<template>
    <div class="flex items-center space-x-1 sm:space-x-2">
        <!-- 桌面端：三个独立按钮 -->
        <div class="hidden items-center space-x-1 sm:space-x-2 lg:flex">
            <div ref="requestWrapRef" class="relative hidden lg:block">
                <button
                    class="bell-btn group relative flex h-9 w-9 max-sm:h-10 max-sm:w-10 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm backdrop-blur-md transition-all hover:scale-105 hover:shadow-md"
                    title="请求处理"
                    @click="toggleRequestPanel"
                >
                    <Bell class="h-4.5 w-4.5 transition-colors sm:h-4 sm:w-4" :class="messageCount > 0 ? 'text-zx-danger bell-notify' : 'text-zx-text-muted group-hover:text-zx-danger'" />
                    <span v-if="messageCount > 0" class="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold leading-none text-white">{{ messageCount }}</span>
                </button>
                <RequestCenter variant="desktop" />
            </div>

            <div class="relative" ref="themePanelRef">
                <button
                    class="flex h-9 w-9 max-sm:h-10 max-sm:w-10 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm backdrop-blur-md transition-all hover:scale-105 hover:shadow-md"
                    title="主题选择"
                    @click="toggleThemePanel"
                >
                    <Palette class="h-4.5 w-4.5 text-zx-text-muted sm:h-4 sm:w-4" />
                </button>
                <Transition :css="false" @enter="onDropdownEnter" @leave="onDropdownLeave">
                    <div
                        v-if="showThemePanel"
                        class="absolute right-0 top-full mt-2 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-lg"
                    >
                        <ThemeCustomizer
                            @applied="showThemePanel = false"
                            @close="showThemePanel = false"
                        />
                    </div>
                </Transition>
            </div>

            <button
                class="flex h-9 w-9 max-sm:h-10 max-sm:w-10 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm backdrop-blur-md transition-all hover:scale-105 hover:shadow-md"
                title="Bot 端（模拟端）"
                @click="openBotClientWindow"
            >
                <Bot class="h-4.5 w-4.5 text-zx-text-muted sm:h-4 sm:w-4" />
            </button>

            <button
                class="flex h-9 w-9 max-sm:h-10 max-sm:w-10 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm backdrop-blur-md transition-all hover:scale-105 hover:shadow-md"
                title="设置"
                @click="showSettingsModal = true"
            >
                <Settings class="h-4.5 w-4.5 text-zx-text-muted sm:h-4 sm:w-4" />
            </button>
        </div>

        <!-- 移动端 / 平板端：收纳为一个按钮，点开菜单 -->
        <div class="relative lg:hidden" ref="compactRef">
            <button
                class="flex h-9 w-9 max-sm:h-10 max-sm:w-10 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm backdrop-blur-md transition-all hover:scale-105 hover:shadow-md"
                title="更多"
                @click="toggleCompact"
            >
                <X
                    v-if="showCompactMenu"
                    class="h-4.5 w-4.5 text-zx-text-muted sm:h-4 sm:w-4"
                />
                <Ellipsis
                    v-else
                    class="h-4.5 w-4.5 text-zx-text-muted sm:h-4 sm:w-4"
                />
                <span v-if="messageCount > 0" class="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold leading-none text-white">{{ messageCount }}</span>
            </button>
            <Transition :css="false" @enter="onStackEnter" @leave="onStackLeave">
                <div
                    v-if="showCompactMenu"
                    class="absolute right-0 top-full z-20 mt-3 flex flex-col items-end gap-3"
                >
                    <!-- 主题面板：补回面板壳并固定宽度（按钮列容器是透明
                         弹性布局，裸放会宽度失控） -->
                    <div
                        v-if="compactThemeOpen"
                        class="w-72 max-sm:w-[calc(100vw-32px)] rounded-2xl border border-slate-200 bg-white max-sm:p-5 p-3 shadow-lg"
                    >
                        <ThemeCustomizer
                            @applied="
                                compactThemeOpen = false;
                                showCompactMenu = false;
                            "
                            @close="compactThemeOpen = false"
                        />
                    </div>
                    <template v-else>
                        <button
                            class="relative flex h-9 w-9 max-sm:h-10 max-sm:w-10 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm backdrop-blur-md transition-all hover:scale-105 hover:shadow-md"
                            title="请求处理"
                            type="button"
                            @click="openRequestCenter"
                        >
                            <Bell
                                class="h-4.5 w-4.5 text-zx-text-muted sm:h-4 sm:w-4"
                                :class="messageCount > 0 ? 'text-zx-danger' : ''"
                            />
                            <span
                                v-if="messageCount > 0"
                                class="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold leading-none text-white"
                            >{{ messageCount }}</span>
                        </button>
                        <button
                            class="flex h-9 w-9 max-sm:h-10 max-sm:w-10 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm backdrop-blur-md transition-all hover:scale-105 hover:shadow-md"
                            title="主题选择"
                            type="button"
                            @click="compactThemeOpen = true"
                        >
                            <Palette
                                class="h-4.5 w-4.5 text-zx-text-muted sm:h-4 sm:w-4"
                            />
                        </button>
                        <button
                            class="flex h-9 w-9 max-sm:h-10 max-sm:w-10 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm backdrop-blur-md transition-all hover:scale-105 hover:shadow-md"
                            title="Bot 端（模拟端）"
                            type="button"
                            @click="openBotClientWindow"
                        >
                            <Bot
                                class="h-4.5 w-4.5 text-zx-text-muted sm:h-4 sm:w-4"
                            />
                        </button>
                        <button
                            class="flex h-9 w-9 max-sm:h-10 max-sm:w-10 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm backdrop-blur-md transition-all hover:scale-105 hover:shadow-md"
                            title="设置"
                            type="button"
                            @click="
                                showSettingsModal = true;
                                showCompactMenu = false;
                            "
                        >
                            <Settings
                                class="h-4.5 w-4.5 text-zx-text-muted sm:h-4 sm:w-4"
                            />
                        </button>
                    </template>
                </div>
            </Transition>
            <RequestCenter variant="compact" />
        </div>

        <SettingsModal
            v-if="settingsModalLoaded"
            :visible="showSettingsModal"
            @close="showSettingsModal = false"
        />
    </div>
</template>

<style scoped>
@keyframes bell-ring {
    0% { transform: rotate(0); }
    15% { transform: rotate(14deg); }
    30% { transform: rotate(-12deg); }
    45% { transform: rotate(10deg); }
    60% { transform: rotate(-8deg); }
    75% { transform: rotate(4deg); }
    90% { transform: rotate(-2deg); }
    100% { transform: rotate(0); }
}

.bell-btn:hover :deep(svg),
.bell-notify {
    animation: bell-ring 0.6s ease-in-out infinite;
    transform-origin: top center;
}
</style>
