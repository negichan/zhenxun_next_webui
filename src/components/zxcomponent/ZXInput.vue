<script setup lang="ts">
import {
    computed,
    nextTick,
    onBeforeUnmount,
    ref,
    useAttrs,
} from "vue";
import { CircleX, Eye, EyeOff, Search } from "lucide-vue-next";

/**
 * ZXInput — 现代化全站统一输入框（支持文本、密码、搜索、多行文本等多形态）
 *
 * 核心特性：
 * - 纯白底色（bg-white）自适应浅深色模式，无淡灰底色干扰；
 * - 统一边框规范 border-slate-200，悬浮与聚焦 1px 主题色边框 hover:border-zx-primary focus-within:border-zx-primary，transition-colors duration-200 平滑过渡，无浮夸阴影；
 * - 原生集成 type="search" 搜索模式：内置 Search 图标、默认开启一键清空、支持回车 @search 事件；
 * - 原生集成 type="textarea" 多行文本模式：自动采用 rounded-2xl 卡片级圆角，支持 rows 与一键清空/字数限制；
 * - 默认单行 rounded-xl 表单圆角；type="search" 默认 full 胶囊（可显式覆盖）；支持 full / 2xl / xl / lg；
 * - 原生密码类型自动集成 Eye / EyeOff 明文密文切换开关；
 * - 支持磁贴发光 (v-tile-glow)；
 * - 完美透传根级 class/style 与输入框原生 attrs。
 */
defineOptions({
    inheritAttrs: false,
});

const modelValue = defineModel<string | number>({ default: "" });
const attrs = useAttrs();

const props = withDefaults(
    defineProps<{
        /** 占位文案 */
        placeholder?: string;
        /** 原生输入框类型：text | password | number | email | search | textarea 等 */
        type?: string;
        /** 多行文本行数 (type="textarea" 时生效) */
        rows?: number | string;
        /** 最大输入长度 */
        maxlength?: number | string;
        /** 是否显示字数限制 */
        showWordLimit?: boolean;
        /** 尺寸：sm (32px) | md (36px) | lg (40px) */
        size?: "sm" | "md" | "lg";
        /** 圆角形态：不传时表单默认 2xl，type="search" 默认 full；显式传入优先 */
        rounded?: "full" | "2xl" | "xl" | "lg";
        /** 禁用状态 */
        disabled?: boolean;
        /** 只读状态 */
        readonly?: boolean;
        /** 是否支持一键清空（type="search" 时默认开启） */
        clearable?: boolean;
        /** 校验或提示文本 */
        message?: string | number;
        /** 提示消息语义类型 */
        messageType?: "error" | "warning" | "info" | "success";
        /** 密码类型是否显示内置显隐开关 */
        showPasswordToggle?: boolean;
        /** 额外输入框 input / textarea 样式类名 */
        inputClass?: string;
        /**
         * 长文本展开编辑（可选，默认关闭）
         * 开启后：值长度达到 expandThreshold 时出现展开钮，点开浮层大文本编辑
         */
        expandable?: boolean;
        /** 触发展开的字数阈值，默认 48 */
        expandThreshold?: number;
        /** 兼容旧版 prop */
        icon?: boolean;
        position?: string;
    }>(),
    {
        placeholder: "请输入...",
        type: "text",
        rows: 3,
        size: "md",
        rounded: undefined as "full" | "2xl" | "xl" | "lg" | undefined,
        disabled: false,
        readonly: false,
        clearable: undefined as any,
        message: "",
        messageType: "error",
        showPasswordToggle: true,
        showWordLimit: false,
        expandable: false,
        expandThreshold: 48,
        icon: false,
        position: "end",
    },
);

const emit = defineEmits<{
    (e: "change", val: string | number): void;
    (e: "search", val: string | number): void;
    (e: "clear"): void;
    (e: "blur", ev: FocusEvent): void;
    (e: "focus", ev: FocusEvent): void;
}>();

const inputRef = ref<HTMLInputElement | null>(null);
const textareaRef = ref<HTMLTextAreaElement | null>(null);

// 是否为多行文本模式
const isTextarea = computed(() => props.type === "textarea");

// 是否为搜索模式
const isSearch = computed(() => props.type === "search");

// 是否支持清空（显式传入优先，搜索框默认开启）
const computedClearable = computed(() => {
    if (props.clearable !== undefined) return props.clearable;
    return isSearch.value;
});

// 分离透传的 class/style（挂载到最外层容器）与其他原生 attrs（透传到 input/textarea）
const rootAttrs = computed(() => {
    const { class: className, style } = attrs;
    return { class: className, style };
});

const inputAttrs = computed(() => {
    const { class: _c, style: _s, ...rest } = attrs;
    return rest;
});

// 密码显隐状态
const passwordVisible = ref(false);
const computedType = computed(() => {
    if (props.type === "password") {
        return passwordVisible.value ? "text" : "password";
    }
    return props.type;
});

// ==================== 长文本展开编辑（expandable 可选开启） ====================
const rootWrapRef = ref<HTMLElement | null>(null);
const controlBoxRef = ref<HTMLElement | null>(null);
const expandOpen = ref(false);
const expandDraft = ref("");
const expandTextareaRef = ref<HTMLTextAreaElement | null>(null);
const expandPos = ref({ top: 0, left: 0, width: 360 });
/** 与原单行输入文字对齐的排版属性 */
const expandFont = ref({
    fontSize: "14px",
    lineHeight: "20px",
    fontFamily: "",
    fontWeight: "",
    letterSpacing: "",
});

/** expandable 开启后聚焦即叠层；expand-threshold>0 时仅在内容够长时触发 */
const shouldAutoExpand = computed(() => {
    if (!props.expandable || isTextarea.value || props.disabled || props.readonly) {
        return false;
    }
    const threshold = props.expandThreshold ?? 48;
    if (threshold <= 0) return true;
    return String(modelValue.value ?? "").length >= threshold;
});

/** 展开层内边距：横向跟 size；上边距让首行与单行输入文字同高 */
const expandPad = ref("10px 14px");

const openExpand = async () => {
    if (expandOpen.value) return;
    expandDraft.value = String(modelValue.value ?? "");
    // 按外层输入容器叠放，覆盖整块控件；内边距与 size 档一致
    const el = controlBoxRef.value ?? inputRef.value ?? rootWrapRef.value;
    if (el) {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        expandPos.value = {
            top: r.top,
            left: r.left,
            width: r.width,
        };
        expandFont.value = {
            fontSize: cs.fontSize,
            lineHeight: cs.lineHeight || cs.fontSize,
            fontFamily: cs.fontFamily,
            fontWeight: cs.fontWeight,
            letterSpacing: cs.letterSpacing,
        };
        // 首行与单行态同垂直居中：padTop = (控件高 - 行高) / 2
        const lineH = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) || 20;
        const padTop = Math.max(0, (r.height - lineH) / 2);
        const padX = props.size === "sm" ? 12 : props.size === "lg" ? 16 : 14;
        expandPad.value = `${Math.round(padTop)}px ${padX}px ${Math.round(padTop)}px ${padX}px`;
    }
    expandOpen.value = true;
    await nextTick();
    expandTextareaRef.value?.focus();
};

const saveExpand = () => {
    if (expandDraft.value !== String(modelValue.value ?? "")) {
        modelValue.value = expandDraft.value;
        emit("change", expandDraft.value);
    }
    expandOpen.value = false;
};

const onExpandKeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
        e.stopPropagation();
        // Esc：不保存直接关
        expandDraft.value = String(modelValue.value ?? "");
        expandOpen.value = false;
    }
};

const onExpandBlur = () => {
    // 失焦自动保存
    saveExpand();
};

onBeforeUnmount(() => {
    expandOpen.value = false;
});

// 尺寸样式
const sizeClass = computed(() => {
    if (isTextarea.value) {
        switch (props.size) {
            case "sm":
                return "p-2.5 text-xs";
            case "lg":
                return "p-4 text-sm";
            case "md":
            default:
                return "p-3 text-xs sm:text-sm";
        }
    }
    switch (props.size) {
        case "sm":
            return "h-8 px-3 text-xs";
        case "lg":
            return "h-10 px-4 text-sm";
        case "md":
        default:
            return "h-9 px-3.5 text-xs sm:text-sm";
    }
});

// 搜索图标尺寸
const searchIconClass = computed(() => {
    switch (props.size) {
        case "sm":
            return "h-3.5 w-3.5";
        case "lg":
            return "h-4.5 w-4.5";
        case "md":
        default:
            return "h-4 w-4";
    }
});

// 圆角样式：表单默认 xl（短控件用 2xl 会贴半高呈全圆），搜索框默认 full，显式 rounded 优先
const roundedClass = computed(() => {
    let r = props.rounded ?? (props.type === "search" ? "full" : "xl");
    // 小尺寸控件上 2xl/全圆会与半高重合，自动降档
    if (props.size === "sm" && (r === "2xl" || r === "full") && props.type !== "search") {
        r = "xl";
    }
    // 多行文本框使用卡片级圆角，全圆胶囊形态只适用于单行搜索
    if (isTextarea.value && r === "full") {
        return "rounded-2xl";
    }
    switch (r) {
        case "lg":
            return "rounded-lg";
        case "xl":
            return "rounded-xl";
        case "2xl":
            return "rounded-2xl";
        case "full":
        default:
            return "rounded-full";
    }
});

// 消息颜色样式
const messageClass = computed(() => {
    switch (props.messageType) {
        case "success":
            return "text-zx-success";
        case "warning":
            return "text-zx-warning";
        case "info":
            return "text-zx-info";
        case "error":
        default:
            return "text-zx-danger";
    }
});

const onInput = (e: Event) => {
    const val = (e.target as HTMLInputElement | HTMLTextAreaElement).value;
    modelValue.value = val;
};

const onChange = (e: Event) => {
    const val = (e.target as HTMLInputElement | HTMLTextAreaElement).value;
    emit("change", val);
};

const onKeydown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !isTextarea.value) {
        emit("search", modelValue.value);
    }
};

const onBlur = (ev: FocusEvent) => {
    emit("blur", ev);
};

const onFocus = (ev: FocusEvent) => {
    emit("focus", ev);
    if (shouldAutoExpand.value) {
        void openExpand();
    }
};

const handleClear = () => {
    if (props.disabled || props.readonly) return;
    modelValue.value = "";
    emit("clear");
    if (isTextarea.value) {
        textareaRef.value?.focus();
    } else {
        inputRef.value?.focus();
    }
};

const targetRef = computed(() => (isTextarea.value ? textareaRef.value : inputRef.value));

defineExpose({
    focus: () => targetRef.value?.focus(),
    blur: () => targetRef.value?.blur(),
    inputRef,
    textareaRef,
});
</script>

<template>
    <div
        ref="rootWrapRef"
        class="relative inline-flex w-full flex-col gap-1"
        :class="rootAttrs.class"
        :style="rootAttrs.style"
    >
        <!-- 核心输入容器：纯白底色 + 磁贴发光 + 主题色悬浮/聚焦边框 -->
        <div
            ref="controlBoxRef"
            v-tile-glow
            class="group relative flex w-full border border-slate-200 bg-white shadow-2xs transition-colors duration-200 hover:border-zx-primary focus-within:border-zx-primary"
            :class="[
                roundedClass,
                sizeClass,
                'select-text',
                disabled ? 'cursor-not-allowed bg-slate-100 opacity-60' : '',
                message && messageType === 'error' ? 'border-red-400! focus-within:border-red-400!' : '',
                isTextarea ? 'flex-col items-stretch' : 'items-center',
            ]"
        >
            <!-- 1. 多行文本模式 (Textarea) -->
            <template v-if="isTextarea">
                <textarea
                    ref="textareaRef"
                    :value="modelValue"
                    :rows="rows"
                    :placeholder="placeholder"
                    :disabled="disabled"
                    :readonly="readonly"
                    :maxlength="maxlength"
                    class="w-full min-w-0 bg-transparent font-normal text-zx-text outline-none placeholder:text-zx-text-subtle focus:outline-none focus:ring-0 disabled:cursor-not-allowed resize-y leading-relaxed"
                    :class="inputClass"
                    v-bind="inputAttrs"
                    @input="onInput"
                    @change="onChange"
                    @blur="onBlur"
                    @focus="onFocus"
                ></textarea>

                <!-- 多行底部工具栏（清空按钮 / 字数统计） -->
                <div
                    v-if="(computedClearable && modelValue && !disabled && !readonly) || (showWordLimit && maxlength)"
                    class="mt-1 flex items-center justify-end gap-2 text-zx-text-subtle"
                >
                    <button
                        v-if="computedClearable && modelValue && !disabled && !readonly"
                        type="button"
                        class="btn-touch flex shrink-0 cursor-pointer items-center justify-center text-zx-text-subtle transition-colors duration-200 hover:text-zx-text-muted focus:outline-none"
                        title="清空内容"
                        @click.stop="handleClear"
                    >
                        <CircleX class="h-3.5 w-3.5" />
                    </button>
                    <span v-if="showWordLimit && maxlength" class="text-[10px] tabular-nums">
                        {{ String(modelValue ?? '').length }} / {{ maxlength }}
                    </span>
                </div>
            </template>

            <!-- 2. 单行文本 / 密码 / 搜索模式 (Input) -->
            <template v-else>
                <!-- 前缀插槽 / 搜索模式内置图标 -->
                <div
                    v-if="$slots.prefix || isSearch"
                    class="mr-2 flex shrink-0 items-center text-zx-text-subtle transition-colors duration-200 group-hover:text-zx-primary group-focus-within:text-zx-primary"
                >
                    <slot name="prefix">
                        <Search :class="searchIconClass" class="pointer-events-none" />
                    </slot>
                </div>

                <!-- 原生输入框 -->
                <input
                    ref="inputRef"
                    :type="computedType"
                    :value="modelValue"
                    :placeholder="placeholder"
                    :disabled="disabled"
                    :readonly="readonly"
                    :maxlength="maxlength"
                    class="w-full min-w-0 bg-transparent font-normal text-zx-text outline-none placeholder:text-zx-text-subtle focus:outline-none focus:ring-0 disabled:cursor-not-allowed"
                    :class="inputClass"
                    v-bind="inputAttrs"
                    @input="onInput"
                    @change="onChange"
                    @keydown="onKeydown"
                    @blur="onBlur"
                    @focus="onFocus"
                />

                <!-- 一键清除按钮 -->
                <button
                    v-if="computedClearable && modelValue && !disabled && !readonly"
                    type="button"
                    class="btn-touch ml-1 flex shrink-0 cursor-pointer items-center justify-center text-zx-text-subtle transition-colors duration-200 hover:text-zx-text-muted focus:outline-none"
                    title="清空内容"
                    @click.stop="handleClear"
                >
                    <CircleX class="h-3.5 w-3.5" />
                </button>

                <!-- 密码显隐开关按钮 -->
                <button
                    v-if="type === 'password' && showPasswordToggle && !disabled"
                    type="button"
                    class="btn-touch ml-1.5 flex shrink-0 cursor-pointer items-center justify-center text-zx-text-subtle transition-colors duration-200 hover:text-zx-text-muted focus:outline-none"
                    :title="passwordVisible ? '隐藏密码' : '显示明文密码'"
                    @click.stop="passwordVisible = !passwordVisible"
                >
                    <EyeOff v-if="passwordVisible" class="h-3.5 w-3.5" />
                    <Eye v-else class="h-3.5 w-3.5" />
                </button>

                <!-- 后缀插槽 -->
                <div
                    v-if="$slots.suffix"
                    class="ml-2 flex shrink-0 items-center text-zx-text-subtle transition-colors duration-200 group-hover:text-zx-primary group-focus-within:text-zx-primary"
                >
                    <slot name="suffix" />
                </div>
            </template>
        </div>

        <!-- 校验 / 提示文本 -->
        <p
            v-if="message"
            class="px-2 text-[11px] font-medium transition-opacity duration-200"
            :class="messageClass"
        >
            {{ message }}
        </p>

        <!-- 长文本编辑：覆盖输入控件，带内边距的大文本层 -->
        <Teleport to="body">
            <textarea
                v-if="expandOpen"
                ref="expandTextareaRef"
                v-model="expandDraft"
                class="fixed z-[10050] resize-none rounded-2xl bg-white text-zx-text outline-none"
                :style="{
                    top: `${expandPos.top}px`,
                    left: `${expandPos.left}px`,
                    width: `${expandPos.width}px`,
                    height: '220px',
                    padding: expandPad,
                    fontSize: expandFont.fontSize,
                    lineHeight: expandFont.lineHeight,
                    fontFamily: expandFont.fontFamily,
                    fontWeight: expandFont.fontWeight,
                    letterSpacing: expandFont.letterSpacing,
                    boxShadow:
                        '0 0 0 1px rgb(226 232 240), 0 18px 28px -8px rgb(15 23 42 / 0.18)',
                }"
                :placeholder="placeholder"
                :maxlength="maxlength"
                @keydown="onExpandKeydown"
                @blur="onExpandBlur"
                @pointerdown.stop
            ></textarea>
        </Teleport>
    </div>
</template>