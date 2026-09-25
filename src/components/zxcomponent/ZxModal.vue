<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from "vue";
import type { Component } from "vue";
import { X } from "lucide-vue-next";
import { modalJelly } from "@/composables/useGsapTransition";
import ZxButton from "./ZxButton.vue";

/**
 * 通用弹窗组件（ZxModal）
 * 封装 GSAP 果冻进出场动画、全屏遮罩、Esc 键监听、尺寸档位与头尾插槽规范。
 *
 * 用法：
 *   <ZxModal v-model="visible" title="编辑成员" :icon="User">
 *       <p>弹窗主体内容</p>
 *       <template #footer>
 *           <ZxButton variant="ghost" @click="visible = false">取消</ZxButton>
 *           <ZxButton @click="handleSave">保存</ZxButton>
 *       </template>
 *   </ZxModal>
 */
interface Props {
    /** 显隐状态绑定 */
    modelValue: boolean;
    /** 弹窗标题 */
    title?: string;
    /** 标题旁图标 */
    icon?: Component;
    /** 标题下方或旁边的副标题/描述 */
    subtitle?: string;
    /** 尺寸档位：sm (400px) | md (512px) | lg (672px) | xl (896px) | full (92vw) */
    size?: "sm" | "md" | "lg" | "xl" | "full";
    /** 自定义最大宽度类（覆盖 size 默认值） */
    width?: string;
    /** 是否显示右上角关闭按钮 */
    closable?: boolean;
    /** 点击遮罩层是否关闭 */
    closeOnClickOverlay?: boolean;
    /** 按 Esc 键是否关闭 */
    closeOnEsc?: boolean;
    /** 自定义弹窗主体额外样式类 */
    contentClass?: string;
    /** 主体滚动区样式（如 p-0，给自定义头尾布局用） */
    bodyClass?: string;
}

const props = withDefaults(defineProps<Props>(), {
    title: "",
    size: "md",
    width: "",
    closable: true,
    closeOnClickOverlay: true,
    closeOnEsc: true,
    contentClass: "",
    bodyClass: "",
});

const emit = defineEmits<{
    (e: "update:modelValue", val: boolean): void;
    (e: "close"): void;
    (e: "open"): void;
}>();

const handleClose = () => {
    emit("update:modelValue", false);
    emit("close");
};

const handleOverlayClick = (e: MouseEvent) => {
    if (props.closeOnClickOverlay && e.target === e.currentTarget) {
        handleClose();
    }
};

const handleKeydown = (e: KeyboardEvent) => {
    if (props.closeOnEsc && e.key === "Escape" && props.modelValue) {
        handleClose();
    }
};

watch(
    () => props.modelValue,
    (val) => {
        if (val) {
            emit("open");
        }
    },
);

onMounted(() => {
    window.addEventListener("keydown", handleKeydown);
});

onUnmounted(() => {
    window.removeEventListener("keydown", handleKeydown);
});

const maxWidthClass = computed(() => {
    if (props.width) return props.width;
    switch (props.size) {
        case "sm":
            return "max-w-sm";
        case "lg":
            return "max-w-2xl";
        case "xl":
            return "max-w-4xl";
        case "full":
            return "max-w-[92vw] h-[90vh]";
        case "md":
        default:
            return "max-w-lg";
    }
});
</script>

<template>
    <Teleport to="body">
        <Transition
            :css="false"
            @enter="modalJelly.onEnter"
            @leave="modalJelly.onLeave"
        >
            <div
                v-if="modelValue"
                class="glass-overlay fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
                @click="handleOverlayClick"
            >
                <div
                    class="modal-content relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
                    :class="[maxWidthClass, contentClass]"
                    @click.stop
                >
                    <!-- 头部插槽或默认标题栏 -->
                    <slot name="header" :close="handleClose">
                        <div
                            v-if="title || $slots.header || closable"
                            class="flex flex-shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6"
                        >
                            <div class="flex min-w-0 items-center gap-2.5">
                                <component
                                    :is="icon"
                                    v-if="icon"
                                    class="h-5 w-5 flex-shrink-0 text-zx-primary"
                                />
                                <div class="min-w-0">
                                    <h3
                                        class="truncate text-base font-semibold text-zx-text-strong sm:text-lg"
                                    >
                                        {{ title }}
                                    </h3>
                                    <p
                                        v-if="subtitle"
                                        class="mt-0.5 truncate text-xs text-zx-text-subtle"
                                    >
                                        {{ subtitle }}
                                    </p>
                                </div>
                            </div>
                            <ZxButton
                                v-if="closable"
                                variant="ghost"
                                circle
                                size="sm"
                                class="flex-shrink-0"
                                @click="handleClose"
                            >
                                <X class="h-4 w-4" />
                            </ZxButton>
                        </div>
                    </slot>

                    <!-- 主体内容区域（默认支持滚动） -->
                    <div
                        class="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6"
                        :class="bodyClass"
                    >
                        <slot :close="handleClose" />
                    </div>

                    <!-- 底部操作区域 -->
                    <div
                        v-if="$slots.footer"
                        class="flex flex-shrink-0 items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/50 px-5 py-3.5 sm:px-6"
                    >
                        <slot name="footer" :close="handleClose" />
                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>
