<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Minus, Plus } from "lucide-vue-next";

/**
 * 数字步进器（替代 Element Plus el-input-number）：[−] 输入框 [+]，
 * 边界内钳制、step 步进、precision 保留小数；打字过程不回写，
 * 失焦 / 回车时提交，非法内容回退到当前值。
 * 悬浮与聚焦 1px 主题色边框（hover / focus-within），transition-colors duration-200 平滑过渡。
 *
 * 用法：
 *   <ZxInputNumber v-model="gold" :min="0" :max="999999" :step="100" />
 *   <ZxInputNumber v-model="n" size="sm" class="w-full" />
 */
const modelValue = defineModel<number>({ default: 0 });

const props = withDefaults(
    defineProps<{
        /** 最小值 */
        min?: number;
        /** 最大值 */
        max?: number;
        /** 步进幅度（也用于 +/− 按钮） */
        step?: number;
        /** 保留小数位（0 = 整数） */
        precision?: number;
        disabled?: boolean;
        placeholder?: string;
        /** 尺寸：sm (32px) | md (36px) | lg (40px)，宽度默认 w-full，可用 class 覆盖 */
        size?: "sm" | "md" | "lg";
    }>(),
    {
        min: -Infinity,
        max: Infinity,
        step: 1,
        precision: 0,
        disabled: false,
        placeholder: "",
        size: "md",
    },
);

const emit = defineEmits<{
    (e: "change", value: number): void;
}>();

/** 输入框草稿：打字期间自由编辑，提交时才钳制回写 */
const draft = ref(String(modelValue.value ?? ""));
watch(
    () => modelValue.value,
    (val) => {
        draft.value = Number.isFinite(val) ? String(val) : "";
    },
);

const clamp = (val: number) => {
    const factor = 10 ** props.precision;
    const rounded = Math.round(val * factor) / factor;
    return Math.min(props.max, Math.max(props.min, rounded));
};

const commit = (raw: string) => {
    const num = Number(raw.trim());
    const fallback = Number.isFinite(modelValue.value)
        ? modelValue.value
        : Number.isFinite(props.min)
          ? props.min
          : 0;
    const next = clamp(Number.isFinite(num) && raw.trim() !== "" ? num : fallback);
    if (next !== modelValue.value) {
        modelValue.value = next;
        emit("change", next);
    } else {
        draft.value = String(next);
    }
};

const stepBy = (delta: number) => {
    if (props.disabled) return;
    const base = Number.isFinite(modelValue.value)
        ? modelValue.value
        : Number.isFinite(props.min)
          ? props.min
          : 0;
    const next = clamp(base + delta);
    if (next !== modelValue.value) {
        modelValue.value = next;
        emit("change", next);
    } else {
        draft.value = String(next);
    }
};

const atMin = computed(
    () => Number.isFinite(modelValue.value) && modelValue.value <= props.min,
);
const atMax = computed(
    () => Number.isFinite(modelValue.value) && modelValue.value >= props.max,
);

const sizeClass = computed(() => {
    switch (props.size) {
        case "sm":
            return { root: "h-8", btn: "w-7", icon: "h-3 w-3" };
        case "lg":
            return { root: "h-10", btn: "w-9", icon: "h-4 w-4" };
        case "md":
        default:
            return { root: "h-9", btn: "w-8", icon: "h-3.5 w-3.5" };
    }
});

const btnClasses =
    "flex h-full shrink-0 cursor-pointer items-center justify-center text-zx-text-subtle transition-colors duration-200 hover:bg-slate-200/60 hover:text-zx-text disabled:cursor-not-allowed disabled:opacity-30";
</script>

<template>
    <div
        v-tile-glow
        class="group flex w-full items-center overflow-hidden rounded-full border border-slate-200 bg-white transition-colors duration-200 hover:border-zx-primary focus-within:border-zx-primary"
        :class="[sizeClass.root, disabled ? 'cursor-not-allowed bg-slate-100 opacity-60' : '']"
    >
        <button
            type="button"
            :disabled="disabled || atMin"
            :class="[btnClasses, sizeClass.btn]"
            aria-label="减少"
            @click="stepBy(-step)"
        >
            <Minus :class="sizeClass.icon" />
        </button>
        <input
            v-model="draft"
            type="text"
            inputmode="decimal"
            class="h-full min-w-0 flex-1 border-x border-slate-200 bg-transparent text-center text-xs font-mono text-zx-text outline-none transition-colors duration-200 group-hover:border-zx-primary/30 group-focus-within:border-zx-primary/40 focus:outline-none focus:ring-0"
            :disabled="disabled"
            :placeholder="placeholder"
            @blur="commit(draft)"
            @keydown.enter="($event.target as HTMLInputElement).blur()"
        />
        <button
            type="button"
            :disabled="disabled || atMax"
            :class="[btnClasses, sizeClass.btn]"
            aria-label="增加"
            @click="stepBy(step)"
        >
            <Plus :class="sizeClass.icon" />
        </button>
    </div>
</template>
