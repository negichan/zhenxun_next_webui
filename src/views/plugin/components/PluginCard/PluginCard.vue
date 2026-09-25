<script setup lang="ts">
import { computed, ref } from "vue";
import { Settings, Download, ExternalLink, RotateCw } from "lucide-vue-next";
import { pluginApi } from "@/utils/api-next";
import type { PluginInfo } from "@/types/api-next.types";
import { ZXNotification } from "@/services/ui";

/**
 * 插件卡片（统一组件）：本地插件与插件市场共用，样式以本地插件卡为准。
 * - type="local"：底部为开关 + 配置按钮，业务逻辑（防抖开关）在组件内；
 * - type="market"：底部为安装/更新按钮 + 主页链接；
 * 元信息标签行统一走 metaTags（ZxTag 的语义档/品牌色实底）。
 */
const props = withDefaults(
    defineProps<{
        /** 卡片类型 */
        type?: "local" | "market";
        /** 布局：网格卡片 / 列表单行 */
        layout?: "grid" | "list";
        /** 插件名 */
        name: string;
        /** 模块标识（悬浮提示显示） */
        module?: string;
        /** 描述 */
        description?: string;
        /** 置顶（本地：主题色描边 + 置顶徽标） */
        pinned?: boolean;
        /** 元信息标签行（版本/来源/品牌标签） */
        metaTags?: {
            text: string;
            variant?: "neutral"
                | "primary"
                | "success"
                | "warning"
                | "danger"
                | "info"
                | "purple"
                | "cyan";
            /** 品牌色实底（优先于 variant） */
            color?: string;
        }[];
        /** 作者 */
        author?: string;
        // ---- 本地插件 ----
        /** 开关状态 */
        enabled?: boolean;
        /** 是否允许开关操作（false 时开关置灰，点击提示） */
        allowSwitch?: boolean;
        /** 是否有配置项（决定配置按钮显隐） */
        allowSetting?: boolean;
        // ---- 市场插件 ----
        isInstalled?: boolean;
        hasUpdate?: boolean;
        /** 主页链接（有才显示跳转圆钮） */
        homepage?: string;
    }>(),
    {
        type: "local",
        layout: "grid",
        module: "",
        description: "",
        pinned: false,
        metaTags: () => [],
        author: "",
        enabled: false,
        allowSwitch: true,
        allowSetting: false,
        isInstalled: false,
        hasUpdate: false,
        homepage: "",
    },
);

const emit = defineEmits<{
    /** 本地：请求切换启用状态（防抖后的最终状态） */
    (e: "toggle", newStatus: boolean): void;
    /** 本地：打开配置 */
    (e: "config"): void;
    /** 市场：安装 */
    (e: "install"): void;
    /** 市场：更新 */
    (e: "update"): void;
}>();

const processing = ref(false);

// 根元素样式：列表行为单行紧凑；卡片模式为本地卡规格
const rootClasses = computed(() => {
    const base = [
        props.pinned ? "border-zx-primary!" : "",
        props.type === "market" ? "market-card" : "",
    ];
    if (props.layout === "list") {
        return [
            "group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm transition-all select-none hover:shadow-md",
            ...base,
        ];
    }
    return [
        "group overflow-hidden rounded-3xl bg-white px-2 pt-2 shadow-sm border border-slate-200 transition-all duration-300 select-none hover:-translate-y-1 hover:shadow-xl",
        ...base,
    ];
});

// 本地：开关是否可用 - allow_switch 才是不允许操作
const switchDisabled = computed(() => !props.allowSwitch);
let toggleTimer: ReturnType<typeof setTimeout> | null = null;

// 切换插件状态
const handleToggleStatus = (newStatus: boolean) => {
    if (!props.allowSwitch) {
        ZXNotification({
            title: "提示",
            message: `插件 "${props.name}" 不允许开关操作 (｡•́︿•̀｡)`,
            type: "info",
            position: "top-right",
        });
        return;
    }

    // UI立即更新
    emit("toggle", newStatus);

    // 清掉上一次待发送请求
    if (toggleTimer) {
        clearTimeout(toggleTimer);
    }

    toggleTimer = setTimeout(() => {
        processing.value = true;

        pluginApi
            .togglePluginStatus(props.module, newStatus)
            .then((res) => {
                if (res?.success) {
                    ZXNotification({
                        title: "成功啦~",
                        message: `插件 "${props.name}" 已${newStatus ? "启用" : "禁用"} ♪(´▽｀)`,
                        type: "success",
                        position: "top-right",
                        confetti: true,
                    });
                } else {
                    emit("toggle", !newStatus);

                    ZXNotification({
                        title: "哎呀~",
                        message:
                            res.message || "操作失败了，请再试一次 (´；ω；`)",
                        type: "error",
                        position: "top-right",
                    });
                }
            })
            .catch(() => {
                emit("toggle", !newStatus);

                ZXNotification({
                    title: "哎呀~",
                    message: "操作失败了，请再试一次 (´；ω；`)",
                    type: "error",
                    position: "top-right",
                });
            })
            .finally(() => {
                processing.value = false;
            });
    }, 400); // 防抖时间
};

// 打开配置
const handleOpenConfig = (event: Event) => {
    event.stopPropagation();
    emit("config");
};
</script>

<template>
    <div :class="rootClasses">
        <!-- 列表模式：单行紧凑布局 -->
        <template v-if="layout === 'list'">
            <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                    <h3
                        class="truncate text-sm font-bold text-zx-text-strong"
                        :title="module ? `${name}（${module}）` : name"
                    >
                        {{ name }}
                    </h3>
                    <ZxTag v-if="pinned" variant="primary">置顶</ZxTag>
                    <ZxTag v-if="isInstalled && hasUpdate" variant="warning">
                        New
                    </ZxTag>
                    <ZxTag
                        v-for="(tag, i) in metaTags"
                        :key="i"
                        :variant="tag.variant"
                        :color="tag.color"
                    >
                        {{ tag.text }}
                    </ZxTag>
                </div>
                <p class="mt-0.5 truncate text-xs text-zx-text-muted">
                    {{ description || "暂无描述" }}
                    <template v-if="author"> · by {{ author }}</template>
                </p>
            </div>

            <div class="flex flex-shrink-0 items-center gap-2">
                <!-- 本地：开关 + 配置 -->
                <template v-if="type === 'local'">
                    <ZxSwitch
                        :model-value="enabled"
                        size="md"
                        :disabled="processing || switchDisabled"
                        title="启用/停用插件"
                        @change="handleToggleStatus"
                    />
                    <button
                        v-if="allowSetting"
                        @click.stop="handleOpenConfig"
                        class="btn-touch flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-zx-text-muted transition-colors hover:bg-gray-100"
                        title="插件配置"
                        type="button"
                    >
                        <Settings class="h-4 w-4" />
                    </button>
                </template>

                <!-- 市场：安装/更新 + 主页 -->
                <template v-else>
                    <button
                        @click="isInstalled ? emit('update') : emit('install')"
                        :disabled="processing"
                        class="btn-touch flex cursor-pointer items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
                        :class="
                            isInstalled && !hasUpdate
                                ? 'bg-gray-100 text-zx-text-muted hover:bg-gray-200'
                                : 'bg-zx-primary text-[color:var(--zx-color-on-primary)] hover:bg-zx-primary-hover'
                        "
                    >
                        {{ isInstalled ? (hasUpdate ? "有更新" : "更新") : "安装" }}
                    </button>
                    <a
                        v-if="homepage"
                        :href="homepage"
                        target="_blank"
                        class="btn-touch flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-zx-text-muted transition-colors hover:bg-gray-200 hover:text-zx-text"
                    >
                        <ExternalLink class="h-4 w-4" />
                    </a>
                </template>
            </div>
        </template>

        <!-- 卡片模式 -->
        <template v-else>
        <div
            class="flex flex-col gap-2 p-4"
            :class="type === 'local' ? 'pb-1' : ''"
        >
            <!-- 头部：插件名（+ 置顶标 / 新版本标） -->
            <div class="flex items-center justify-between gap-2">
                <h3
                    class="min-w-0 flex-1 truncate text-base font-bold text-zx-text-strong sm:text-lg"
                    :title="module ? `${name}（${module}）` : name"
                >
                    {{ name }}
                </h3>

                <div class="flex flex-shrink-0 items-center gap-1.5">
                    <ZxTag v-if="pinned" variant="primary">置顶</ZxTag>
                    <ZxTag v-if="isInstalled && hasUpdate" variant="warning">
                        New
                    </ZxTag>
                </div>
            </div>

            <!-- 描述 -->
            <div class="my-2 h-10">
                <p
                    class="line-clamp-2 text-sm leading-relaxed break-words text-zx-text-muted"
                >
                    {{ description || "暂无描述" }}
                </p>
            </div>

            <!-- 版本/来源标签 -->
            <div
                v-if="metaTags.length"
                class="flex flex-wrap items-center gap-2"
            >
                <ZxTag
                    v-for="(tag, i) in metaTags"
                    :key="i"
                    :variant="tag.variant"
                    :color="tag.color"
                >
                    {{ tag.text }}
                </ZxTag>
            </div>

            <!-- 作者信息 -->
            <div class="text-xs text-zx-text-muted">
                by
                <span class="font-medium">{{ author || "未知" }}</span>
            </div>
        </div>

        <!-- 底部操作栏 -->
        <div
            class="flex items-center gap-3 px-4"
            :class="type === 'local' ? 'pb-1' : 'pb-3.5'"
        >
            <!-- 本地：开关 + 配置 -->
            <template v-if="type === 'local'">
                <div class="flex flex-shrink-0 items-center gap-2 select-none">
                    <ZxSwitch
                        :model-value="enabled"
                        size="md"
                        :disabled="processing || switchDisabled"
                        @change="handleToggleStatus"
                    />
                    <span
                        class="text-[11px] leading-none font-medium whitespace-nowrap"
                        :class="switchDisabled ? 'text-zx-text-subtle' : 'text-zx-text-muted'"
                    >
                        {{ enabled ? "开" : "关" }}
                    </span>
                </div>

                <div class="flex-1" />

                <!-- 配置按钮：没有配置项的插件直接隐藏 -->
                <button
                    v-if="allowSetting"
                    @click.stop="handleOpenConfig"
                    class="flex-shrink-0 cursor-pointer rounded-full p-2 transition-colors text-zx-text-muted hover:bg-gray-100"
                    title="插件配置"
                    type="button"
                >
                    <Settings class="h-5 w-5" />
                </button>
            </template>

            <!-- 市场：安装/更新 + 主页 -->
            <template v-else>
                <button
                    @click="isInstalled ? emit('update') : emit('install')"
                    :disabled="processing"
                    class="btn-touch flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50"
                    :class="
                        isInstalled && !hasUpdate
                            ? 'bg-gray-100 text-zx-text-muted hover:bg-gray-200'
                            : 'bg-zx-primary text-[color:var(--zx-color-on-primary)] hover:bg-zx-primary-hover'
                    "
                >
                    <RotateCw v-if="isInstalled" class="h-4 w-4" />
                    <Download v-else class="h-4 w-4" />
                    <span>{{ isInstalled ? (hasUpdate ? "有更新" : "更新") : "安装" }}</span>
                </button>

                <a
                    v-if="homepage"
                    :href="homepage"
                    target="_blank"
                    class="btn-touch flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-zx-text-muted transition-colors hover:bg-gray-200 hover:text-zx-text"
                >
                    <ExternalLink class="h-4 w-4" />
                </a>
            </template>
        </div>
        </template>
    </div>
</template>
