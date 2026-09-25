<script setup lang="ts">
import { modalJelly } from "@/composables/useGsapTransition";
import { computed, ref, watch } from "vue";
import type { Component } from "vue";
import {
    X,
    LogOut,
    Wrench,
    Palette,
    FlaskConical,
    AlertCircle,
    ArrowRight,
    Info,
    Github,
    MessageCircle,
} from "lucide-vue-next";
import { auth } from "@/utils/auth.ts";
import { useGlobalStore } from "@/store/global.ts";
import { ZXMessageBox, ZXNotification } from "@/services/ui";
import { router } from "@/router/index.js";
import { version } from "@/version";
import logo from "@/assets/img/title.webp";
import { getRadiusOverride, setRadiusOverride } from "@/theme/radius";
import { OVERLAY_ID, useZxOverlay } from "@/composables/useOverlayStack";
import ZxTag from "@/components/zxcomponent/ZxTag.vue";
import ZxButton from "@/components/zxcomponent/ZxButton.vue";
import ZxSwitch from "@/components/zxcomponent/ZxSwitch.vue";
import { aiApi, mainApi } from "@/utils/api-next";
import {
    MOCK_MODE as mockAvailable,
    isMockEnabled,
    setMockEnabled,
} from "virtual:mock-mode";

interface Props {
    visible: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{ close: [] }>();

const rootRef = ref<HTMLElement | null>(null);
const openState = computed({
    get: () => props.visible,
    set: () => emit("close"),
});
useZxOverlay({
    id: OVERLAY_ID.settings,
    open: openState,
    el: () => rootRef.value,
    onClose: () => emit("close"),
});

// 设置分类：往里加内容时先在这里注册一个分区，再到模板对应分支填内容
interface Section {
    id: string;
    label: string;
    icon: Component;
}

interface SectionGroup {
    label: string;
    items: Section[];
}

const sectionGroups: SectionGroup[] = [
    {
        label: "偏好",
        items: [
            { id: "general", label: "通用", icon: Wrench },
            { id: "appearance", label: "外观", icon: Palette },
        ],
    },
    {
        label: "高级",
        items: [{ id: "experimental", label: "实验性功能", icon: FlaskConical }],
    },
    {
        label: "其他",
        items: [{ id: "about", label: "关于", icon: Info }],
    },
];

const openExternalUrl = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
};

const activeSection = ref<string>(sectionGroups[0].items[0].id);

// 实验性：协议劫持状态管理
const hijackLoading = ref(false);
const hijackToggling = ref(false);
const hijackEnabled = ref(false);
const hijackInterceptedCount = ref(0);
const supportedProtocols = ref<string[]>(["chat", "response", "claude"]);

// 实验性：本地 Mock 假数据（仅 dev 构建暴露，生产包无此开关）
const mockModeEnabled = ref(isMockEnabled());
const handleToggleMock = (val: boolean) => {
    setMockEnabled(val);
    mockModeEnabled.value = val;
    ZXNotification({
        title: val ? "Mock 模式已开启" : "Mock 模式已关闭",
        message: "即将刷新页面使开关生效",
        type: "info",
        position: "top-right",
    });
    // 适配器在模块初始化时安装，切换后需整页刷新
    setTimeout(() => window.location.reload(), 400);
};

const loadHijackStatus = async () => {
    hijackLoading.value = true;
    try {
        const res = await aiApi.getProtocolHijackStatus();
        if (res?.success && res.data) {
            hijackEnabled.value = res.data.enabled;
            supportedProtocols.value = res.data.supported_protocols;
            hijackInterceptedCount.value = res.data.intercepted_count;
        }
    } catch (error) {
        console.error("加载协议劫持状态失败:", error);
    } finally {
        hijackLoading.value = false;
    }
};

const handleToggleHijack = async (val: boolean) => {
    if (hijackToggling.value) return;
    hijackToggling.value = true;
    try {
        const res = await aiApi.updateProtocolHijackStatus(val);
        if (res?.success) {
            hijackEnabled.value = val;
            ZXNotification({
                title: val ? "协议适配与劫持已开启" : "协议适配与劫持已关闭",
                message: val
                    ? "已开启协议适配，chat / response / claude 请求已被接管"
                    : "已关闭协议劫持，恢复原生调用模式",
                type: val ? "success" : "info",
                position: "top-right",
            });
        }
    } catch (err: any) {
        ZXNotification({
            title: "切换失败",
            message: err?.message || "更新协议劫持状态失败",
            type: "error",
            position: "top-right",
        });
    } finally {
        hijackToggling.value = false;
    }
};

const goToTelemetry = () => {
    emit("close");
    globalStore.setExperimentalFeaturesEnabled(true);
    router.push({ path: "/config", query: { subtab: "protocols" } });
};

// 前端更新：查询本地/最新 Release 版本，一键从 GitHub 拉取并热替换 dist
interface WebuiVersion {
    local: string | null;
    latest: string | null;
    has_update: boolean;
}
const webuiVersion = ref<WebuiVersion | null>(null);
const checkingUpdate = ref(false);
const updatingWebui = ref(false);

const loadWebuiVersion = async () => {
    if (checkingUpdate.value) return;
    checkingUpdate.value = true;
    try {
        const res = await mainApi.getWebuiVersion();
        if (res?.success && res.data) webuiVersion.value = res.data;
    } catch (error) {
        console.error("检查前端更新失败:", error);
    } finally {
        checkingUpdate.value = false;
    }
};

const doUpdateWebui = () => {
    const latest = webuiVersion.value?.latest;
    if (!latest || updatingWebui.value) return;
    ZXMessageBox({
        title: "更新前端",
        message: `将从 GitHub Release 更新前端到 ${latest}，完成后页面会自动刷新，确定继续？`,
        cancelButtonText: "取消",
        confirmButtonText: "立即更新",
        onConfirm: async () => {
            updatingWebui.value = true;
            try {
                const res = await mainApi.updateWebui();
                if (res?.success) {
                    ZXNotification({
                        title: "前端已更新",
                        message: res.message || "正在刷新页面…",
                        type: "success",
                        position: "top-right",
                    });
                    setTimeout(() => window.location.reload(), 1200);
                }
            } catch (err: any) {
                ZXNotification({
                    title: "更新失败",
                    message: err?.message || "拉取最新版本失败",
                    type: "error",
                    position: "top-right",
                });
            } finally {
                updatingWebui.value = false;
            }
        },
    });
};

watch(
    () => props.visible,
    (val) => {
        if (val) {
            loadHijackStatus();
            loadWebuiVersion();
        }
    },
    { immediate: true },
);

// 卡片圆角覆写（null = 跟随主题预设 1.5rem）
const radiusOverride = ref<number | null>(getRadiusOverride());
const PRESET_RADIUS_PX = 24;
const radiusValue = computed(() => radiusOverride.value ?? PRESET_RADIUS_PX);
const onRadiusInput = (e: Event) => {
    const v = Number((e.target as HTMLInputElement).value);
    radiusOverride.value = v;
    setRadiusOverride(v);
};
const resetRadius = () => {
    radiusOverride.value = null;
    setRadiusOverride(null);
};

const globalStore = useGlobalStore();

const handleLogout = () => {
    emit("close");
    ZXMessageBox({
        title: "退出登录",
        message: "你是否要退出登录",
        cancelButtonText: "取消",
        onConfirm: () => {
            auth.logout();
            router.push({ name: "Login" });
        },
    });
};
</script>

<template>
    <Teleport to="body">
        <Transition :css="false" @enter="modalJelly.onEnter" @leave="modalJelly.onLeave">
            <div
                v-if="visible"
                ref="rootRef"
                class="fixed inset-0 z-50 flex items-center justify-center"
            >
                <div class="glass-overlay absolute h-full w-full"></div>
                <div
                    class="modal-content relative z-1 flex h-[min(700px,88vh)] w-[min(960px,94vw)] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl sm:flex-row"
                >
                    <!-- 左侧：标题 + 分组导航 + 退出登录（窄屏时导航横排在上方） -->
                    <aside class="flex w-full shrink-0 flex-col p-3 sm:w-52 sm:p-3.5">
                        <p
                            class="hidden select-none px-2.5 text-xl font-bold text-zx-text-strong sm:block"
                        >
                            设置
                        </p>
                        <nav
                            class="flex flex-1 gap-1 overflow-x-auto sm:mt-5 sm:flex-col sm:overflow-y-auto"
                        >
                            <template
                                v-for="group in sectionGroups"
                                :key="group.label"
                            >
                                <p
                                    class="hidden shrink-0 select-none px-2.5 pb-1.5 pt-4 text-[11px] font-semibold tracking-widest text-zx-text-subtle sm:block"
                                >
                                    {{ group.label }}
                                </p>
                                <button
                                    v-for="section in group.items"
                                    :key="section.id"
                                    class="flex shrink-0 cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition-colors"
                                    :class="
                                        activeSection === section.id
                                            ? 'bg-zx-primary-tint font-semibold text-zx-primary'
                                            : 'font-medium text-[var(--zx-color-text-muted)] hover:bg-[var(--zx-color-surface-muted)] hover:text-[var(--zx-color-text)]'
                                    "
                                    type="button"
                                    @click="activeSection = section.id"
                                >
                                    <component
                                        :is="section.icon"
                                        class="h-[17px] w-[17px] shrink-0"
                                    />
                                    <span>{{ section.label }}</span>
                                </button>
                            </template>
                        </nav>

                        <!-- 侧边栏最底下：退出登录 -->
                        <button
                            class="mt-2 flex shrink-0 cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium text-[var(--zx-color-text-muted)] transition-colors hover:bg-zx-danger-soft hover:text-zx-danger sm:mt-3"
                            type="button"
                            @click="handleLogout"
                        >
                            <LogOut class="h-[17px] w-[17px] shrink-0" />
                            <span>退出登录</span>
                        </button>
                    </aside>

                    <!-- 右侧内容区 -->
                    <main
                        class="relative min-h-0 min-w-0 flex-1 overflow-y-auto p-5 sm:px-8 sm:py-7"
                    >
                        <button
                            class="absolute right-4 top-4 z-10 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-[var(--zx-color-text-muted)] transition-colors hover:bg-[var(--zx-color-surface-muted)] hover:text-[var(--zx-color-text)]"
                            type="button"
                            @click="emit('close')"
                        >
                            <X class="h-4 w-4" />
                        </button>

                        <!-- 通用 -->
                        <template v-if="activeSection === 'general'">
                            <div class="mb-5 pr-10">
                                <h2
                                    class="text-[19px] font-bold text-zx-text-strong"
                                >
                                    通用
                                </h2>
                                <p
                                    class="mt-1.5 text-[13px] text-zx-text-muted"
                                >
                                    基础行为偏好
                                </p>
                            </div>
                            <div class="flex flex-col gap-3">
                                <div
                                    class="flex items-center justify-between gap-5 rounded-2xl bg-[var(--zx-color-surface-muted)] px-5 py-4"
                                >
                                    <div class="min-w-0">
                                        <p
                                            class="text-sm font-semibold text-zx-text-strong"
                                        >
                                            动画效果
                                        </p>
                                        <p
                                            class="mt-1 text-xs leading-relaxed text-zx-text-muted"
                                        >
                                            关闭后禁用过渡与动画，适合低性能设备
                                        </p>
                                    </div>
                                    <ZxSwitch
                                        :model-value="globalStore.animationsEnabled"
                                        @change="globalStore.setAnimationsEnabled"
                                    />
                                </div>
                            </div>
                        </template>

                        <!-- 外观 -->
                        <template v-else-if="activeSection === 'appearance'">
                            <div class="mb-5 pr-10">
                                <h2
                                    class="text-[19px] font-bold text-zx-text-strong"
                                >
                                    外观
                                </h2>
                                <p
                                    class="mt-1.5 text-[13px] text-zx-text-muted"
                                >
                                    全局视觉偏好，调整后实时生效
                                </p>
                            </div>
                            <div class="flex flex-col gap-3">
                                <div
                                    class="flex items-center justify-between gap-5 rounded-2xl bg-[var(--zx-color-surface-muted)] px-5 py-4"
                                >
                                    <div class="min-w-0">
                                        <p
                                            class="text-sm font-semibold text-zx-text-strong"
                                        >
                                            卡片圆角
                                        </p>
                                        <p
                                            class="mt-1 text-xs leading-relaxed text-zx-text-muted"
                                        >
                                            全局大圆角（卡片 / 弹窗 / 面板），实时生效
                                        </p>
                                    </div>
                                    <div
                                        class="flex shrink-0 items-center gap-2.5"
                                    >
                                        <span
                                            class="h-9 w-9 border border-slate-200 bg-white shadow-sm"
                                            :style="{
                                                borderRadius: `${radiusValue}px`,
                                            }"
                                            title="预览"
                                        ></span>
                                        <input
                                            type="range"
                                            min="0"
                                            max="32"
                                            step="2"
                                            :value="radiusValue"
                                            class="w-28 cursor-pointer accent-[var(--zx-color-primary)]"
                                            @input="onRadiusInput"
                                        />
                                        <span
                                            class="w-10 text-right text-xs tabular-nums text-[var(--zx-color-text-muted)]"
                                        >
                                            {{ radiusValue }}px
                                        </span>
                                        <button
                                            v-if="radiusOverride !== null"
                                            class="cursor-pointer rounded-full border border-slate-200 px-2.5 py-1 text-xs text-[var(--zx-color-text-muted)] transition-colors hover:text-[var(--zx-color-text)]"
                                            type="button"
                                            @click="resetRadius"
                                        >
                                            跟随主题
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </template>

                        <!-- 实验性功能 -->
                        <template v-else-if="activeSection === 'experimental'">
                            <div class="mb-5 pr-10">
                                <h2
                                    class="text-[19px] font-bold text-zx-text-strong"
                                >
                                    实验性功能
                                </h2>
                                <p
                                    class="mt-1.5 text-[13px] text-zx-text-muted"
                                >
                                    正在开发中的特性，可能随版本迭代变更
                                </p>
                            </div>
                            <div class="flex flex-col gap-3">
                                <!-- 顶部提示条：对齐 DESIGN.md 标准色与卡片规范 -->
                                <div
                                    class="flex items-start gap-2.5 rounded-2xl border border-slate-200/80 bg-slate-50 p-4 text-xs"
                                >
                                    <AlertCircle
                                        class="mt-0.5 h-4 w-4 shrink-0 text-zx-text-muted"
                                    />
                                    <div class="min-w-0 flex-1">
                                        <p
                                            class="font-semibold text-zx-text-strong"
                                        >
                                            实验性功能说明
                                        </p>
                                        <p
                                            class="mt-1 leading-relaxed text-zx-text-muted"
                                        >
                                            此分类包含正在开发中的协议桥接、底层内核拦截及前沿交互特性。可能会随版本迭代变更，请根据实际需求开启。
                                        </p>
                                    </div>
                                </div>

                                <!-- 开关 1：AI 协议适配与劫持 -->
                                <div
                                    class="rounded-2xl bg-[var(--zx-color-surface-muted)] px-5 py-4 transition-colors"
                                >
                                    <div
                                        class="flex items-start justify-between gap-5"
                                    >
                                        <div class="min-w-0">
                                            <div
                                                class="flex flex-wrap items-center gap-2"
                                            >
                                                <p
                                                    class="text-sm font-semibold text-zx-text-strong"
                                                >
                                                    AI 协议适配与劫持
                                                </p>
                                                <ZxTag variant="warning">
                                                    实验性
                                                </ZxTag>
                                            </div>
                                            <p
                                                class="mt-1 text-xs leading-relaxed text-zx-text-muted"
                                            >
                                                接管底层
                                                AI
                                                协议调用，将
                                                chat、response、claude
                                                等非标协议流量透明转换桥接为兼容格式。
                                            </p>
                                        </div>
                                        <ZxSwitch
                                            :model-value="hijackEnabled"
                                            :disabled="
                                                hijackLoading || hijackToggling
                                            "
                                            @change="handleToggleHijack"
                                        />
                                    </div>

                                    <!-- 生效中面板 -->
                                    <div
                                        v-if="hijackEnabled"
                                        class="mt-3.5 rounded-xl border border-slate-200/80 bg-white p-3.5 text-xs"
                                    >
                                        <div
                                            class="flex flex-wrap items-center justify-between gap-2"
                                        >
                                            <div
                                                class="flex items-center gap-2"
                                            >
                                                <ZxTag variant="success">
                                                    运行中
                                                </ZxTag>
                                                <span
                                                    class="text-zx-text-muted"
                                                >
                                                    已拦截
                                                    <span
                                                        class="font-semibold text-zx-text-strong tabular-nums"
                                                        >{{
                                                            hijackInterceptedCount
                                                        }}</span
                                                    >
                                                    次请求
                                                </span>
                                            </div>
                                            <span
                                                class="font-mono text-zx-text-muted"
                                                >{{
                                                    supportedProtocols.join(
                                                        " · ",
                                                    )
                                                }}</span
                                            >
                                        </div>
                                        <div
                                            class="mt-3 flex items-center justify-end border-t border-slate-100 pt-2.5"
                                        >
                                            <ZxButton
                                                variant="outline"
                                                size="sm"
                                                @click="goToTelemetry"
                                            >
                                                <span>查看抓包遥测</span>
                                                <ArrowRight
                                                    class="ml-1 h-3.5 w-3.5"
                                                />
                                            </ZxButton>
                                        </div>
                                    </div>
                                </div>

                                <!-- 开关 2：大模型进阶控制面板 -->
                                <div
                                    class="flex items-center justify-between gap-5 rounded-2xl bg-[var(--zx-color-surface-muted)] px-5 py-4"
                                >
                                    <div class="min-w-0">
                                        <p
                                            class="text-sm font-semibold text-zx-text-strong"
                                        >
                                            大模型进阶控制面板
                                        </p>
                                        <p
                                            class="mt-1 text-xs leading-relaxed text-zx-text-muted"
                                        >
                                            在大模型配置中解锁「任务默认路由」「上下文压缩」与「智能体与引擎」进阶选项卡。
                                        </p>
                                    </div>
                                    <ZxSwitch
                                        :model-value="
                                            globalStore.experimentalFeaturesEnabled
                                        "
                                        @change="
                                            globalStore.setExperimentalFeaturesEnabled
                                        "
                                    />
                                </div>

                                <!-- 开关 3：协议遥测完整报文捕获 -->
                                <div
                                    class="flex items-center justify-between gap-5 rounded-2xl bg-[var(--zx-color-surface-muted)] px-5 py-4"
                                >
                                    <div class="min-w-0">
                                        <p
                                            class="text-sm font-semibold text-zx-text-strong"
                                        >
                                            协议遥测报文深度记录
                                        </p>
                                        <p
                                            class="mt-1 text-xs leading-relaxed text-zx-text-muted"
                                        >
                                            启用后将在遥测监控中记录完整请求入参与响应报文详情，便于接口协议对接排错。
                                        </p>
                                    </div>
                                    <ZxSwitch
                                        :model-value="
                                            globalStore.telemetryCaptureEnabled
                                        "
                                        @change="
                                            globalStore.setTelemetryCaptureEnabled
                                        "
                                    />
                                </div>

                                <!-- 开关 4：本地 Mock 假数据（仅 dev） -->
                                <div
                                    v-if="mockAvailable"
                                    class="flex items-center justify-between gap-5 rounded-2xl bg-[var(--zx-color-surface-muted)] px-5 py-4"
                                >
                                    <div class="min-w-0">
                                        <p
                                            class="text-sm font-semibold text-zx-text-strong"
                                        >
                                            本地 Mock 假数据
                                        </p>
                                        <p
                                            class="mt-1 text-xs leading-relaxed text-zx-text-muted"
                                        >
                                            开启后 API 与 WebSocket
                                            全部走前端本地假数据，无需启动真寻后端。仅开发环境可用，不进入生产包；切换后刷新页面生效。
                                        </p>
                                    </div>
                                    <ZxSwitch
                                        :model-value="mockModeEnabled"
                                        @change="handleToggleMock"
                                    />
                                </div>

                                <!-- 开关 5：长列表激进预加载模式 -->
                                <div
                                    class="flex items-center justify-between gap-5 rounded-2xl bg-[var(--zx-color-surface-muted)] px-5 py-4"
                                >
                                    <div class="min-w-0">
                                        <p
                                            class="text-sm font-semibold text-zx-text-strong"
                                        >
                                            长列表激进预加载
                                        </p>
                                        <p
                                            class="mt-1 text-xs leading-relaxed text-zx-text-muted"
                                        >
                                            在消息历史与好友/群列表虚拟滚动中增大离屏预加载范围，提升极速飞滑时的平滑感。
                                        </p>
                                    </div>
                                    <ZxSwitch
                                        :model-value="
                                            globalStore.turboScrollEnabled
                                        "
                                        @change="
                                            globalStore.setTurboScrollEnabled
                                        "
                                    />
                                </div>
                            </div>
                        </template>

                        <!-- 关于 -->
                        <template v-else-if="activeSection === 'about'">
                            <div class="mb-5 pr-10">
                                <h2
                                    class="text-[19px] font-bold text-zx-text-strong"
                                >
                                    关于
                                </h2>
                                <p
                                    class="mt-1.5 text-[13px] text-zx-text-muted"
                                >
                                    版本与项目信息
                                </p>
                            </div>
                            <div class="flex flex-col gap-3">
                                <!-- 品牌主卡片 -->
                                <div
                                    class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
                                >
                                    <div
                                        class="flex flex-wrap items-center gap-3"
                                    >
                                        <img
                                            :src="logo"
                                            alt="真寻 WebUI"
                                            class="pointer-events-none h-14 select-none object-contain"
                                            style="filter: var(--zx-sidebar-logo-filter)"
                                        />
                                        <span
                                            class="text-xs font-medium text-zx-text-muted"
                                        >
                                            v{{ version }}
                                        </span>
                                    </div>
                                    <p
                                        class="mt-2.5 text-xs leading-relaxed text-zx-text-muted"
                                    >
                                        绪山真寻 Bot 的 Web 管理后台，由 NegiChan
                                        开发与维护，MIT 开源。
                                    </p>

                                    <!-- 快速链接 -->
                                    <div class="mt-4 flex flex-wrap gap-2">
                                        <ZxButton
                                            variant="outline"
                                            size="sm"
                                            @click="
                                                openExternalUrl(
                                                    'https://github.com/negichan',
                                                )
                                            "
                                        >
                                            <span
                                                class="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-pink-100 bg-pink-50 text-[10px] font-bold text-pink-500"
                                                >N</span
                                            >
                                            <span>NegiChan</span>
                                        </ZxButton>
                                        <ZxButton
                                            variant="outline"
                                            size="sm"
                                            @click="
                                                openExternalUrl(
                                                    'https://github.com/negichan/zhenxun_new_webui',
                                                )
                                            "
                                        >
                                            <Github
                                                class="h-3.5 w-3.5 text-zx-text-muted"
                                            />
                                            <span>GitHub 仓库</span>
                                        </ZxButton>
                                        <ZxButton
                                            variant="outline"
                                            size="sm"
                                            @click="
                                                openExternalUrl(
                                                    'https://github.com/negichan/zhenxun_new_webui/issues',
                                                )
                                            "
                                        >
                                            <MessageCircle
                                                class="h-3.5 w-3.5 text-zx-text-muted"
                                            />
                                            <span>问题反馈</span>
                                        </ZxButton>
                                    </div>
                                </div>

                                <!-- 版本信息 -->
                                <div
                                    class="flex items-center justify-between gap-5 rounded-2xl bg-[var(--zx-color-surface-muted)] px-5 py-4"
                                >
                                    <div class="min-w-0">
                                        <p
                                            class="text-sm font-semibold text-zx-text-strong"
                                        >
                                            版本信息
                                        </p>
                                        <p
                                            class="mt-1 text-xs leading-relaxed text-zx-text-muted"
                                        >
                                            <span
                                                v-if="
                                                    webuiVersion?.has_update &&
                                                    webuiVersion.latest
                                                "
                                            >
                                                当前版本 v{{
                                                    webuiVersion.local ??
                                                        version
                                                }}，发现新版本
                                                v{{ webuiVersion.latest }}，将从
                                                GitHub Release
                                                拉取并热替换，完成后自动刷新
                                            </span>
                                            <span
                                                v-else-if="webuiVersion?.local"
                                            >
                                                当前版本 v{{
                                                    webuiVersion.local
                                                }}，已是最新版本
                                            </span>
                                            <span v-else>v{{ version }}</span>
                                        </p>
                                    </div>
                                    <div
                                        class="flex shrink-0 items-center gap-2"
                                    >
                                        <ZxButton
                                            variant="ghost"
                                            size="sm"
                                            :disabled="
                                                checkingUpdate || updatingWebui
                                            "
                                            @click="loadWebuiVersion"
                                        >
                                            <span
                                                v-if="checkingUpdate"
                                                class="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
                                            ></span>
                                            <span>{{
                                                checkingUpdate
                                                    ? "检查中"
                                                    : "检查更新"
                                            }}</span>
                                        </ZxButton>
                                        <ZxButton
                                            v-if="webuiVersion?.has_update"
                                            variant="primary"
                                            size="sm"
                                            :disabled="updatingWebui"
                                            @click="doUpdateWebui"
                                        >
                                            <span
                                                v-if="updatingWebui"
                                                class="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
                                            ></span>
                                            <span>{{
                                                updatingWebui
                                                    ? "更新中"
                                                    : `更新到 ${webuiVersion.latest}`
                                            }}</span>
                                        </ZxButton>
                                    </div>
                                </div>
                            </div>
                        </template>
                    </main>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>
