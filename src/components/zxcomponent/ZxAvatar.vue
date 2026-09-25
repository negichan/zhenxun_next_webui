<script setup lang="ts">
import { computed, markRaw, ref, watch } from "vue";
import type { Component } from "vue";
import { User } from "lucide-vue-next";

/**
 * 通用头像组件（ZxAvatar）
 * 统一全站 QQ 头像生成、防盗链策略（referrerpolicy）、图片加载失败优雅兜底与首字展示。
 *
 * 用法：
 *   <ZxAvatar :src="friend.ava_url" :name="friend.nickname" size="sm" />
 *   <ZxAvatar :qq="item.user_id" size="md" />
 *   <ZxAvatar :name="group.group_name" shape="square" size="sm" />
 */
interface Props {
    /** 头像图片 URL */
    src?: string;
    /** QQ 号（传入时自动拼接官方高清头像链接） */
    qq?: string | number;
    /** 备用名称（图片不存在或加载失败时提取首字显示） */
    name?: string;
    /** 尺寸档位：xs (24px) | sm (32px) | md (40px) | lg (48px) | xl (64px) */
    size?: "xs" | "sm" | "md" | "lg" | "xl";
    /** 形状：circle (圆形) | square (平滑圆角矩形) */
    shape?: "circle" | "square";
    /** 自定义缺省图标（未设置 name 且未加载图片时显示） */
    icon?: Component;
    /** alt 描述 */
    alt?: string;
}

const props = withDefaults(defineProps<Props>(), {
    src: "",
    qq: "",
    name: "",
    size: "md",
    shape: "circle",
    alt: "avatar",
});

const isError = ref(false);

// qlogo s=640 单张可达数百 KB；组件最大档 xl 只有 64px，2x 屏 128px，
// lg/xl 取 160 档、其余取 100 档已足够清晰
const qqAvatarUrl = computed(() => {
    if (!props.qq) return "";
    const s = props.size === "lg" || props.size === "xl" ? 160 : 100;
    return `https://q1.qlogo.cn/g?b=qq&nk=${props.qq}&s=${s}`;
});

const effectiveSrc = computed(() => {
    if (props.src) return props.src;
    if (props.qq) return qqAvatarUrl.value;
    return "";
});

watch(
    () => [props.src, props.qq],
    () => {
        isError.value = false;
    },
);

const handleError = () => {
    isError.value = true;
};

const initialChar = computed(() => {
    if (!props.name) return "";
    return props.name.trim().slice(0, 1).toUpperCase();
});

const sizeClasses = computed(() => {
    switch (props.size) {
        case "xs":
            return "h-6 w-6 text-[10px]";
        case "sm":
            return "h-8 w-8 text-xs";
        case "lg":
            return "h-12 w-12 text-base";
        case "xl":
            return "h-16 w-16 text-xl";
        case "md":
        default:
            return "h-10 w-10 text-sm";
    }
});

const shapeClasses = computed(() => {
    return props.shape === "circle" ? "rounded-full" : "rounded-2xl";
});
</script>

<template>
    <div
        class="relative inline-flex flex-shrink-0 items-center justify-center select-none overflow-hidden transition-all duration-200"
        :class="[sizeClasses, shapeClasses]"
    >
        <!-- 图片正常展示 -->
        <img
            v-if="effectiveSrc && !isError"
            :src="effectiveSrc"
            :alt="alt"
            referrerpolicy="no-referrer"
            class="h-full w-full object-cover"
            @error="handleError"
        />

        <!-- 名字首字兜底 -->
        <div
            v-else-if="initialChar"
            class="flex h-full w-full items-center justify-center bg-zx-primary-soft font-bold text-zx-primary transition-colors"
        >
            {{ initialChar }}
        </div>

        <!-- 图标缺省兜底 -->
        <div
            v-else
            class="flex h-full w-full items-center justify-center bg-slate-100 text-zx-text-subtle transition-colors"
        >
            <component :is="icon ? markRaw(icon) : markRaw(User)" class="h-1/2 w-1/2" />
        </div>
    </div>
</template>
