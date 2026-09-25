<script setup lang="ts">
import { computed } from "vue";

/**
 * 统一开关组件（替代 Element Plus el-switch）：按钮实现 + role="switch"，
 * 选中态 bg-zx-primary，transition-colors duration-200 平滑过渡。
 *
 * 用法：
 *   <ZxSwitch v-model="enabled" />
 *   <ZxSwitch v-model="flag" size="md" disabled />
 */
const modelValue = defineModel<boolean>({ default: false });

const props = withDefaults(
    defineProps<{
        /** 禁用态 */
        disabled?: boolean;
        /** 尺寸：sm (h-5 w-9) | md (h-6 w-11) */
        size?: "sm" | "md";
    }>(),
    { disabled: false, size: "sm" },
);

const emit = defineEmits<{
    (e: "change", value: boolean): void;
}>();

const toggle = () => {
    if (props.disabled) return;
    modelValue.value = !modelValue.value;
    emit("change", modelValue.value);
};

const sizeClass = computed(() =>
    props.size === "md"
        ? {
              root: "h-6 w-11",
              thumb: "left-0.5 top-0.5 h-5 w-5",
              on: "translate-x-5",
          }
        : {
              root: "h-5 w-9",
              thumb: "left-0.5 top-0.5 h-4 w-4",
              on: "translate-x-4",
          },
);
</script>

<template>
    <button
        type="button"
        role="switch"
        :aria-checked="modelValue"
        :disabled="disabled"
        class="relative inline-flex shrink-0 cursor-pointer items-center disabled:cursor-not-allowed disabled:opacity-50"
        :class="sizeClass.root"
        @click="toggle"
    >
        <span
            class="absolute inset-0 rounded-full transition-colors duration-200"
            :class="modelValue ? 'bg-zx-primary' : 'bg-slate-200'"
        ></span>
        <span
            class="absolute rounded-full bg-white shadow transition-transform duration-200"
            :class="[sizeClass.thumb, modelValue ? sizeClass.on : '']"
        ></span>
    </button>
</template>
