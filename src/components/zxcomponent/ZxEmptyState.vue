<script setup lang="ts">
import { computed, markRaw } from "vue";
import type { Component } from "vue";
import { Inbox } from "lucide-vue-next";
import { resolveStickerUrl } from "@/utils/stickers";

/**
 * 通用空状态组件（ZxEmptyState）
 * 统一全项目占位展示、图标尺寸、副标题文案与操作插槽
 *
 * 用法：
 *   <ZxEmptyState text="暂无数据表" />
 *   <ZxEmptyState sticker="05" text="未找到相关插件" sub-text="请尝试调整搜索关键词" size="sm" />
 *   <ZxEmptyState text="暂无数据">
 *       <ZxButton variant="primary" size="sm" @click="fetchData">重新加载</ZxButton>
 *   </ZxEmptyState>
 */
interface Props {
    /** 自定义 Lucide 图标组件，默认 Inbox */
    icon?: Component;
    /** 真寻表情包插图（支持编号如 '05' 或完整路径） */
    sticker?: string;
    /** 主标题文案 */
    text?: string;
    /** 副标题文案/排查提示 */
    subText?: string;
    /** 尺寸档位：sm (紧凑型/侧边/单卡) | md (标准型/列表) | lg (宽敞型/整页) */
    size?: "sm" | "md" | "lg";
    /** 图标的自定义颜色/样式类（默认 slate-300 / 深色 slate-600） */
    iconClass?: string;
}

const props = withDefaults(defineProps<Props>(), {
    icon: () => markRaw(Inbox),
    sticker: "",
    text: "暂无数据",
    subText: "",
    size: "md",
    iconClass: "",
});

const stickerUrl = computed(() => (props.sticker ? resolveStickerUrl(props.sticker) : ""));
</script>

<template>
    <div
        class="flex flex-col items-center justify-center text-center select-none"
        :class="[
            size === 'sm' && 'py-6 px-3 gap-2',
            size === 'md' && 'py-12 px-4 gap-3',
            size === 'lg' && 'py-16 px-6 gap-4',
        ]"
    >
        <!-- 图标/插图区域 -->
        <slot name="icon">
            <template v-if="stickerUrl">
                <img
                    :src="stickerUrl"
                    :alt="text"
                    draggable="false"
                    class="object-contain drop-shadow-sm select-none pointer-events-none transition-transform duration-300 hover:scale-105"
                    :class="[
                        size === 'sm' && 'h-16 w-16',
                        size === 'md' && 'h-24 w-24',
                        size === 'lg' && 'h-32 w-32',
                    ]"
                />
            </template>
            <div
                v-else
                class="flex items-center justify-center rounded-2xl bg-slate-50 transition-colors"
                :class="[
                    size === 'sm' && 'h-10 w-10',
                    size === 'md' && 'h-14 w-14',
                    size === 'lg' && 'h-20 w-20',
                ]"
            >
                <component
                    :is="icon"
                    class="transition-colors"
                    :class="[
                        size === 'sm' && 'h-5 w-5',
                        size === 'md' && 'h-7 w-7',
                        size === 'lg' && 'h-10 w-10',
                        iconClass || 'text-zx-text-subtle',
                    ]"
                />
            </div>
        </slot>

        <!-- 文字排版区域 -->
        <div class="flex flex-col items-center gap-1 max-w-sm">
            <p
                class="font-medium text-zx-text-muted transition-colors"
                :class="[
                    size === 'sm' && 'text-xs',
                    size === 'md' && 'text-sm',
                    size === 'lg' && 'text-base',
                ]"
            >
                {{ text }}
            </p>
            <p
                v-if="subText"
                class="text-zx-text-subtle transition-colors"
                :class="[
                    size === 'sm' && 'text-[11px]',
                    size === 'md' && 'text-xs',
                    size === 'lg' && 'text-sm',
                ]"
            >
                {{ subText }}
            </p>
        </div>

        <!-- 默认插槽：操作按钮/动作区 -->
        <div v-if="$slots.default" class="mt-1 flex items-center justify-center gap-2">
            <slot />
        </div>
    </div>
</template>
