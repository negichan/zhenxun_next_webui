<script setup lang="ts">
import { computed } from "vue";
import { Loader2 } from "lucide-vue-next";

/**
 * 统一按钮组件（ZxButton）— shadcn 极简现代风格
 * 承载标准五变体（主按钮 / 次级 / 幽灵 / 描边 / 危险 / 图标圆钮）。
 *
 * 内置：
 * - btn-touch 触控反馈、cursor-pointer、type="button" 默认值；
 * - 统一禁用与 loading 加载中旋转状态；
 * - 深浅主题自适应：主色文字跟随 --zx-color-on-primary。
 *
 * 用法：
 *   <ZxButton @click="save">保存</ZxButton>                          主按钮
 *   <ZxButton variant="secondary">次级操作</ZxButton>                次级中性灰底
 *   <ZxButton variant="ghost">取消</ZxButton>                        幽灵次按钮
 *   <ZxButton variant="outline">导出</ZxButton>                      描边按钮
 *   <ZxButton variant="danger">删除</ZxButton>                       危险按钮
 *   <ZxButton variant="ghost" circle><X class="h-4 w-4" /></ZxButton> 图标圆钮
 *   <ZxButton size="sm" :loading="saving">提交</ZxButton>            加载态
 */
const props = withDefaults(
    defineProps<{
        /** 颜色变体 */
        variant?: "primary" | "secondary" | "ghost" | "outline" | "danger";
        /** 图标圆钮形态：纯图标居中展示 */
        circle?: boolean;
        /** 尺寸等级：xs (28px) | sm (32px) | md (36px) | lg (40px) */
        size?: "xs" | "sm" | "md" | "lg";
        /** 是否禁用 */
        disabled?: boolean;
        /** 加载态 */
        loading?: boolean;
        type?: "button" | "submit" | "reset";
    }>(),
    {
        variant: "primary",
        circle: false,
        size: "md",
        disabled: false,
        loading: false,
        type: "button",
    },
);

/** 各变体配色规范 */
const VARIANT_CLASSES: Record<NonNullable<typeof props.variant>, string> = {
    primary:
        "bg-zx-primary font-medium text-[color:var(--zx-color-on-primary)] hover:bg-zx-primary-hover shadow-2xs",
    secondary:
        "bg-slate-100 font-medium text-zx-text hover:bg-slate-200/80 hover:text-zx-text-strong",
    ghost: "text-zx-text-muted hover:bg-slate-100 hover:text-zx-text-strong",
    outline:
        "border border-slate-200 bg-white text-zx-text hover:border-slate-300 hover:bg-slate-50 shadow-2xs",
    danger: "text-red-500 hover:bg-zx-danger-soft hover:text-zx-danger",
};

const variantClasses = computed(() => {
    // 幽灵圆钮 = 透明底图标圆钮（hover 才出现灰底）
    if (props.variant === "ghost" && props.circle) {
        return "text-zx-text-subtle hover:bg-slate-100 hover:text-zx-text";
    }
    return VARIANT_CLASSES[props.variant];
});

const geometryClasses = computed(() => {
    if (props.circle) {
        switch (props.size) {
            case "xs":
                return "flex h-7 w-7 shrink-0 items-center justify-center";
            case "sm":
                return "flex h-8 w-8 shrink-0 items-center justify-center";
            case "lg":
                return "flex h-10 w-10 shrink-0 items-center justify-center";
            case "md":
            default:
                return "flex h-9 w-9 shrink-0 items-center justify-center";
        }
    }

    switch (props.size) {
        case "xs":
            return "h-7 px-2.5 text-xs";
        case "sm":
            return "h-8 px-3 text-xs";
        case "lg":
            return "h-10 px-5 text-sm font-semibold";
        case "md":
        default:
            return "h-9 px-4 text-xs sm:text-sm";
    }
});

const isDisabled = computed(() => props.disabled || props.loading);

const classes = computed(() => [
    "btn-touch cursor-pointer inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full transition-colors select-none",
    "disabled:cursor-not-allowed disabled:opacity-50 disabled:pointer-events-none",
    variantClasses.value,
    geometryClasses.value,
]);
</script>

<template>
    <button :type="type" :disabled="isDisabled" :class="classes">
        <Loader2
            v-if="loading"
            class="h-3.5 w-3.5 shrink-0 animate-spin"
            :class="circle ? '' : 'mr-0.5'"
        />
        <slot v-if="!loading || !circle" />
    </button>
</template>
