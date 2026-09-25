<script setup lang="ts">
import { dropdownPop } from "@/composables/useGsapTransition";
import { onBeforeUnmount, onMounted, ref } from "vue";
import { useBotStore } from "@/store/bot";
import { Check, ChevronDown } from "lucide-vue-next";
import { useGlobalStore } from "@/store/global";
import avatar from "@/assets/img/avatar.webp";
import { auth } from "@/utils/auth.ts";
import { whiteScreen } from "components/zxcomponent/WhiteScreen";
import ZxEmptyState from "@/components/zxcomponent/ZxEmptyState.vue";

defineOptions({ inheritAttrs: false });

const globalStore = useGlobalStore();
const botStore = useBotStore();

// 下拉菜单状态
const dropdownOpen = ref(false);
const dropdownRef = ref<HTMLElement | null>(null);

// 切换下拉菜单
const toggleDropdown = () => {
    if (botStore.selectedBot?.self_id) {
        dropdownOpen.value = !dropdownOpen.value;
    }
};

// 选择 Bot
const selectBot = (botId: string) => {
    botStore.setSelectedBot(botId);
    dropdownOpen.value = false;
};

// 点击外部关闭下拉菜单
const handleClickOutside = (event: MouseEvent) => {
    if (
        dropdownRef.value &&
        !dropdownRef.value.contains(event.target as Node)
    ) {
        dropdownOpen.value = false;
    }
};

onMounted(async () => {
    document.addEventListener("click", handleClickOutside);

    try {
        // 1. 获取列表
        await botStore.getBotList();

        if (!botStore.botList[0]?.self_id) {
            // 不清除登录态：红屏上的"启用模拟端"接入协议端后
            // 要靠这个 token 直接进入首页。
            // 本会话点过红屏"强制访问"的话不再重复拦截（刷新场景）
            if (!auth.hasForceEnter()) {
                await whiteScreen.error();
            }
            return;
        }

        // 2. 如果当前没有选中任何 Bot，且列表不为空，则默认选中第一个
        if (!botStore.selectedBotId) {
            botStore.setSelectedBot(<string>botStore.botList[0].self_id);
        }
    } catch (error) {
        console.error("初始化 Bot 列表失败:", error);
    }
});

onBeforeUnmount(() => {
    document.removeEventListener("click", handleClickOutside);
});
</script>

<template>
    <div
        v-tile-glow="110"
        ref="dropdownRef"
        v-bind="$attrs"
        class="relative flex h-15 min-w-0 flex-1 items-center gap-2 rounded-full border border-slate-200 bg-white p-1 pr-1.5 shadow-sm sm:w-72 sm:flex-initial sm:gap-2 sm:pr-2"
    >
        <div class="avatar h-full flex-shrink-0 cursor-pointer rounded-full">
            <ZxAvatar
                :src="botStore.selectedBot?.ava_url || avatar"
                :name="botStore.selectedBot?.nickname"
                size="xl"
                class="!h-full !w-auto aspect-square"
            />
        </div>
        <div class="right flex min-w-0 flex-1 items-center gap-2">
            <div
                class="username truncate text-sm font-medium sm:text-base"
                :title="botStore.selectedBot?.nickname ?? undefined"
            >
                {{ botStore.selectedBot?.nickname || "等待接入协议端" }}
            </div>
        </div>
        <ZxButton
            variant="ghost"
            circle
            class="max-sm:h-10 max-sm:w-10"
            title="切换 Bot"
            @click="toggleDropdown"
        >
            <ChevronDown
                class="size-4 transition-transform duration-200"
                :class="{ 'rotate-180': dropdownOpen }"
            />
        </ZxButton>
    </div>

    <Teleport to="body">
        <Transition :css="false" @enter="dropdownPop.onEnter" @leave="dropdownPop.onLeave">
            <div
                v-if="dropdownOpen"
                class="fixed z-[9999] overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-lg"
                :style="{
                    top: dropdownRef
                        ? `${dropdownRef.getBoundingClientRect().bottom + 8}px`
                        : '0px',
                    left: dropdownRef
                        ? `${dropdownRef.getBoundingClientRect().left}px`
                        : '0px',
                    width: dropdownRef
                        ? `${dropdownRef.offsetWidth}px`
                        : 'auto',
                    minWidth: '200px',
                }"
            >
                <div
                    v-for="bot in botStore.botList"
                    :key="bot.self_id || 'unknown'"
                    class="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-slate-100"
                    :style="{
                        width: dropdownRef
                            ? `${dropdownRef.offsetWidth - 16}px`
                            : 'auto',
                    }"
                    :class="{
                        'bg-zx-primary-tint text-zx-primary':
                            botStore.selectedBotId === bot.self_id,
                    }"
                    @click="selectBot(<string>bot.self_id)"
                >
                    <ZxAvatar
                        :src="bot.ava_url || avatar"
                        :name="bot.nickname"
                        size="sm"
                        class="flex-shrink-0"
                    />
                    <div class="min-w-0 flex-1">
                        <div
                            class="truncate text-sm font-medium"
                        >
                            {{ bot.nickname || bot.self_id }}
                        </div>
                        <div class="truncate text-xs text-zx-text-subtle">
                            {{ bot.self_id }}
                        </div>
                    </div>
                    <Check
                        v-if="botStore.selectedBotId === bot.self_id"
                        class="size-4 flex-shrink-0 text-zx-primary"
                    />
                </div>

                <ZxEmptyState
                    v-if="botStore.botList.length === 0"
                    size="sm"
                    text="暂无可用的 Bot"
                />
            </div>
        </Transition>
    </Teleport>
</template>

<style scoped>
@layer base {
    img {
        max-width: none;
    }
}

/* 下拉菜单动画 */

</style>
