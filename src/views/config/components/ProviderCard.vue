<script setup lang="ts">
import { computed, ref } from "vue";
import {
    Activity,
    Check,
    Copy,
    Loader2,
    Settings,
    Trash2,
} from "lucide-vue-next";
import ZxButton from "@/components/zxcomponent/ZxButton.vue";
import ZxTag from "@/components/zxcomponent/ZxTag.vue";
import ProviderIcon from "./ProviderIcon.vue";
import type { ProviderItem } from "@/types/ai.types";

interface Props {
    provider: ProviderItem;
    testResult?: {
        loading?: boolean;
        success?: boolean;
        latency_ms?: number | null;
        message?: string;
    };
}

const props = defineProps<Props>();
const emit = defineEmits<{
    (e: "configure", provider: ProviderItem): void;
    (e: "delete", providerName: string): void;
    (e: "test", provider: ProviderItem): void;
    (e: "clone", provider: ProviderItem): void;
}>();

interface LatencyBadgeState {
    text: string;
    variant?: "success" | "warning" | "danger" | "info" | "neutral";
    color?: string;
    tooltip: string;
}

// 测速耗时实色徽标计算（仅在测速完成后展示）
const latencyBadge = computed<LatencyBadgeState | null>(() => {
    if (!props.testResult || props.testResult.loading) return null;

    if (props.testResult.latency_ms !== undefined && props.testResult.latency_ms !== null) {
        if (!props.testResult.success) {
            return {
                text: "失败",
                variant: "danger",
                tooltip: props.testResult.message || "请求失败",
            };
        }
        const ms = props.testResult.latency_ms;
        if (ms < 1000) {
            return {
                text: `${ms} ms`,
                variant: "success",
                tooltip: `极速响应: ${ms} ms`,
            };
        }
        if (ms < 2500) {
            return {
                text: `${ms} ms`,
                variant: "warning",
                tooltip: `正常响应: ${ms} ms`,
            };
        }
        return {
            text: `${ms} ms`,
            color: "#f97316",
            tooltip: `较慢响应: ${ms} ms`,
        };
    }

    if (props.testResult.success === false) {
        return {
            text: "连接失败",
            variant: "danger",
            tooltip: props.testResult.message || "网络异常或端点不可达",
        };
    }

    if (props.testResult.success === true) {
        return {
            text: "成功",
            variant: "success",
            tooltip: "服务连通正常",
        };
    }

    return null;
});

// 复制端点状态
const copied = ref(false);

const copyEndpoint = async () => {
    if (!props.provider.api_base) return;
    try {
        await navigator.clipboard.writeText(props.provider.api_base);
        copied.value = true;
        setTimeout(() => {
            copied.value = false;
        }, 1500);
    } catch {
        // 静默降级
    }
};
</script>

<template>
    <div
        class="group relative flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-4 sm:p-5 pb-2 sm:pb-2.5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md cursor-pointer"
        @click="emit('configure', provider)"
    >
        <!-- 顶部：品牌图标 + 渠道名与端点 + 右上角配置按钮 (主题色) -->
        <div class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-3 min-w-0 flex-1">
                <!-- 品牌图标 (纯净无背景与边框) -->
                <div
                    class="flex h-11 w-11 shrink-0 items-center justify-center transition-transform duration-200 group-hover:scale-105 text-zx-text-muted"
                >
                    <ProviderIcon
                        :name="provider.name"
                        :api-type="provider.api_type"
                        size-class="h-9 w-9"
                    />
                </div>

                <!-- 渠道名称与 API 地址 -->
                <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-1.5">
                        <h4
                            class="text-sm sm:text-base font-bold text-zx-text-strong truncate"
                            :title="provider.name"
                        >
                            {{ provider.name }}
                        </h4>
                    </div>
                    <div class="flex items-center gap-1 mt-0.5 text-xs font-mono text-zx-text-muted min-w-0">
                        <span
                            v-if="provider.api_base"
                            class="truncate text-zx-text-subtle hover:text-zx-text transition-colors"
                            :title="provider.api_base"
                        >
                            {{ provider.api_base.replace(/^https?:\/\//, "") }}
                        </span>
                        <span v-else class="text-zx-text-subtle italic text-[11px]">
                            官方默认端点
                        </span>
                        <!-- 复制端点按钮 -->
                        <button
                            v-if="provider.api_base"
                            type="button"
                            class="shrink-0 p-0.5 text-zx-text-subtle hover:text-zx-primary rounded transition-colors cursor-pointer"
                            :title="copied ? '已复制到剪贴板' : '复制端点 URL'"
                            @click.stop="copyEndpoint"
                        >
                            <Check v-if="copied" class="h-3.5 w-3.5 text-emerald-500" />
                            <Copy v-else class="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>
            </div>

            <!-- 右上角：配置按钮 (仿复制按钮：灰底高亮 + 主题色图标，无旋转) -->
            <ZxButton
                variant="ghost"
                size="sm"
                circle
                title="配置此提供商"
                class="shrink-0 opacity-70 hover:opacity-100 hover:text-zx-primary"
                @click="emit('configure', provider)"
            >
                <Settings class="h-4 w-4" />
            </ZxButton>
        </div>

        <!-- 底部快捷操作栏 (无分割线，留白分区) -->
        <div class="mt-4 flex items-center justify-between gap-2 min-h-[32px]">
            <!-- 左侧：测试按钮 (圆钮) + 测试完成后的耗时文本 -->
            <div class="flex items-center gap-2 min-w-0">
                <!-- 测试连通性 (幽灵圆钮规格) -->
                <ZxButton
                    variant="ghost"
                    size="sm"
                    circle
                    :disabled="testResult?.loading"
                    title="测试此渠道连通性"
                    class="opacity-70 hover:opacity-100 hover:text-zx-primary"
                    @click.stop="emit('test', provider)"
                >
                    <Loader2
                        v-if="testResult?.loading"
                        class="h-3.5 w-3.5 animate-spin text-zx-primary"
                    />
                    <Activity v-else class="h-3.5 w-3.5" />
                </ZxButton>

                <!-- 测速耗时结果 (实色底 + 对比字，无点) -->
                <Transition
                    enter-active-class="transition-all duration-300 ease-out"
                    enter-from-class="opacity-0 -translate-x-1.5"
                    enter-to-class="opacity-100 translate-x-0"
                    leave-active-class="transition-all duration-200 ease-in"
                    leave-from-class="opacity-100 translate-x-0"
                    leave-to-class="opacity-0 -translate-x-1.5"
                >
                    <ZxTag
                        v-if="latencyBadge"
                        :variant="latencyBadge.variant"
                        :color="latencyBadge.color"
                        :title="latencyBadge.tooltip"
                        class="select-none"
                    >
                        {{ latencyBadge.text }}
                    </ZxTag>
                </Transition>
            </div>

            <!-- 右侧动作组：克隆、删除 -->
            <div class="flex items-center gap-1.5 shrink-0">
                <!-- 快速克隆渠道 -->
                <ZxButton
                    variant="ghost"
                    size="sm"
                    circle
                    title="复制此渠道为副本"
                    class="opacity-70 hover:opacity-100 hover:text-zx-primary"
                    @click.stop="emit('clone', provider)"
                >
                    <Copy class="h-3.5 w-3.5" />
                </ZxButton>

                <!-- 删除渠道 (hover 时红显) -->
                <ZxButton
                    variant="ghost"
                    size="sm"
                    circle
                    title="删除渠道"
                    class="opacity-70 hover:opacity-100 hover:text-zx-danger"
                    @click.stop="emit('delete', provider.name)"
                >
                    <Trash2 class="h-3.5 w-3.5" />
                </ZxButton>
            </div>
        </div>
    </div>
</template>
