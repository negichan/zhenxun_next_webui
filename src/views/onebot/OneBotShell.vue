<script setup lang="ts">
/**
 * OneBot Bot 端（模拟端）壳（主站 /bot 路由，弹窗窗口加载）
 *
 * 沿用 Bot 端自己的登录与后端指向（可连任意后端），与主站登录态互不影响。
 * onMounted 时清理历史上独立构建留下的 /debug 作用域 Service Worker，
 * 避免旧缓存壳继续拦截弹窗窗口。
 */
import { onMounted, ref } from "vue";
import { AppWindow, Loader2 } from "lucide-vue-next";
import LoginView from "@/onebot/LoginView.vue";
import OneBotPage from "@/onebot/OneBotPage.vue";
import {
    authApi,
    getToken,
    setUnauthorizedHandler,
    updateApiBaseUrl,
} from "@/onebot/api";

type Phase = "checking" | "login" | "ready";

const phase = ref<Phase>("checking");

// 仅在"由主站脚本打开的弹窗"里显示：转为普通标签页后弹窗自关。
// 直接在地址栏打开（opener 为空）时没有转的必要
const canReturnToTab = !!window.opener && !window.opener.closed;

const returnToTab = () => {
    // 无特性参数的 window.open = 普通浏览器标签页（带标签栏和地址栏）
    window.open(window.location.href, "_blank");
    // 本窗口由主站脚本打开，允许脚本自关；直接打开的场景关不掉也无妨
    window.close();
};

setUnauthorizedHandler(() => {
    phase.value = "login";
});

onMounted(async () => {
    // 历史遗留：独立构建时代的 /debug 作用域 Service Worker，反注册掉
    navigator.serviceWorker
        ?.getRegistrations()
        .then(registrations => {
            registrations
                .filter(r => r.scope.includes("/debug"))
                .forEach(r => r.unregister());
        })
        .catch(() => {});

    const token = getToken();
    if (!token) {
        phase.value = "login";
        return;
    }
    try {
        updateApiBaseUrl();
        const res = await authApi.verifyToken(token);
        phase.value = res.data?.valid ? "ready" : "login";
    } catch {
        // 后端暂时不可达时不丢登录态，进入主界面由用户自行重试
        phase.value = "ready";
    }
});
</script>

<template>
    <div class="h-dvh w-full">
        <LoginView v-if="phase === 'login'" @success="phase = 'ready'" />
        <OneBotPage v-else-if="phase === 'ready'" />
        <div
            v-else
            class="flex h-full w-full items-center justify-center text-zx-primary"
        >
            <Loader2 class="size-8 animate-spin" />
        </div>

        <!-- 弹窗转标签页 -->
        <button
            v-if="canReturnToTab"
            class="btn-touch fixed right-4 bottom-4 z-50 flex cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-white/90 px-3.5 py-2 text-xs font-semibold text-zx-text-muted shadow-sm backdrop-blur-sm transition-colors hover:border-zx-primary hover:text-zx-primary"
            type="button"
            title="转为普通浏览器标签页"
            @click="returnToTab"
        >
            <AppWindow class="size-3.5" />
            转为标签页
        </button>
    </div>
</template>
