<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
    Check,
    Eye,
    EyeOff,
    Globe,
    Loader2,
    Play,
    Plus,
    Sparkles,
    Trash2,
    X,
} from "lucide-vue-next";
import ZxButton from "@/components/zxcomponent/ZxButton.vue";
import ZxModal from "@/components/zxcomponent/ZxModal.vue";
import ZxEmptyState from "@/components/zxcomponent/ZxEmptyState.vue";
import ZxSwitch from "@/components/zxcomponent/ZxSwitch.vue";
import ZxInputNumber from "@/components/zxcomponent/ZxInputNumber.vue";
import ProviderIcon from "./ProviderIcon.vue";
import { ZXNotification } from "@/services/ui";
import { aiApi } from "@/utils/api-next";
import type {
    ModelDetailItem,
    ModelsDevProviderItem,
    ProviderItem,
} from "@/types/ai.types";

interface Props {
    visible: boolean;
    provider?: ProviderItem | null;
    saving?: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
    (e: "close"): void;
    (e: "save", provider: ProviderItem): void;
    (e: "delete", providerName: string): void;
}>();

// 密码显示状态
const showKeyPlain = ref(false);

// models.dev 在线选择器状态
const modelsDevCatalog = ref<ModelsDevProviderItem[]>([]);
const loadingModelsDev = ref(false);
const showModelsDevPicker = ref(false);
const modelsDevSearch = ref("");

// 单模型测速状态
const modelTestState = ref<
    Record<
        string,
        {
            loading?: boolean;
            success?: boolean;
            latency_ms?: number | null;
            message?: string;
        }
    >
>({});

// 打开 models.dev 选择器（懒加载数据）
const openModelsDevPicker = async () => {
    showModelsDevPicker.value = true;
    modelsDevSearch.value = "";
    if (modelsDevCatalog.value.length === 0) {
        loadingModelsDev.value = true;
        try {
            const res = await aiApi.getModelsDevCatalog();
            if (res.data?.providers) {
                modelsDevCatalog.value = res.data.providers;
            }
        } catch (e: any) {
            ZXNotification({
                title: "获取在线服务商库失败",
                message: e?.message || "无法加载 models.dev 目录",
                type: "error",
                position: "top-right",
            });
        } finally {
            loadingModelsDev.value = false;
        }
    }
};

// 过滤后的 models.dev 服务商列表
const filteredModelsDevProviders = computed(() => {
    const q = modelsDevSearch.value.trim().toLowerCase();
    if (!q) return modelsDevCatalog.value.slice(0, 30);
    return modelsDevCatalog.value
        .filter(
            (p) =>
                p.name.toLowerCase().includes(q) ||
                p.id.toLowerCase().includes(q)
        )
        .slice(0, 50);
});

// 应用选中的 models.dev 服务商配置
const applyModelsDevProvider = (p: ModelsDevProviderItem) => {
    form.value.name = p.name || p.id;
    form.value.api_type = p.api_type || "openai";
    form.value.api_base = p.api_base || "";
    form.value.models = p.models.map((m) => ({
        model_name: m.id,
        temperature: 0.7,
        max_tokens: m.max_output_tokens,
        max_output_tokens: m.max_output_tokens,
        reasoning_effort: m.reasoning ? "medium" : null,
    }));
    showModelsDevPicker.value = false;
    ZXNotification({
        title: "服务商预设已载入",
        message: `已自动填入「${p.name || p.id}」协议、端点与 ${p.models.length} 个模型`,
        type: "success",
        position: "top-right",
    });
};

// 尝试在 models.dev 中匹配当前厂商（用于编辑模式下快速补齐新模型）
const matchedOnlineProvider = computed(() => {
    const name = form.value.name.trim().toLowerCase();
    if (!name) return null;
    return modelsDevCatalog.value.find(
        (p) => p.name.toLowerCase() === name || p.id.toLowerCase() === name
    );
});

// 从 models.dev 补齐新模型
const syncModelsFromOnline = async () => {
    if (modelsDevCatalog.value.length === 0) {
        try {
            const res = await aiApi.getModelsDevCatalog();
            if (res.data?.providers) {
                modelsDevCatalog.value = res.data.providers;
            }
        } catch {
            // 忽略
        }
    }
    if (!matchedOnlineProvider.value) {
        ZXNotification({
            title: "未找到在线匹配项",
            message: `未在 models.dev 库中匹配到名为「${form.value.name}」的服务商`,
            type: "error",
            position: "top-right",
        });
        return;
    }
    const p = matchedOnlineProvider.value;
    const existing = new Set(
        form.value.models.map((m) => m.model_name.toLowerCase())
    );
    let addedCount = 0;
    for (const m of p.models) {
        if (!existing.has(m.id.toLowerCase())) {
            form.value.models.push({
                model_name: m.id,
                temperature: 0.7,
                max_tokens: m.max_output_tokens,
                max_output_tokens: m.max_output_tokens,
                reasoning_effort: m.reasoning ? "medium" : null,
            });
            addedCount++;
        }
    }
    if (addedCount > 0) {
        ZXNotification({
            title: "同步成功",
            message: `已从 models.dev 追加 ${addedCount} 个最新官方模型`,
            type: "success",
            position: "top-right",
        });
    } else {
        ZXNotification({
            title: "已是最新",
            message: "当前模型列表已包含该厂商全部官方模型",
            type: "success",
            position: "top-right",
        });
    }
};

// 真寻官方原生常用预设模板
interface ProviderPreset {
    label: string;
    name: string;
    api_type: string;
    api_base: string;
    default_models: string[];
}

const PRESETS: ProviderPreset[] = [
    {
        label: "DeepSeek",
        name: "DeepSeek",
        api_type: "deepseek",
        api_base: "https://api.deepseek.com",
        default_models: ["deepseek-chat", "deepseek-reasoner"],
    },
    {
        label: "Google Gemini",
        name: "Gemini",
        api_type: "gemini",
        api_base: "https://generativelanguage.googleapis.com",
        default_models: [
            "gemini-2.5-flash",
            "gemini-2.5-pro",
            "gemini-2.5-flash-lite",
            "gemini-3.5-flash",
            "gemini-embedding-2",
        ],
    },
    {
        label: "硅基流动",
        name: "siliconflow",
        api_type: "openai",
        api_base: "https://api.siliconflow.cn",
        default_models: [
            "deepseek-ai/DeepSeek-V3",
            "deepseek-ai/DeepSeek-R1",
            "BAAI/bge-m3",
            "BAAI/bge-reranker-v2-m3",
        ],
    },
    {
        label: "火山方舟 (Doubao)",
        name: "Doubao",
        api_type: "doubao",
        api_base: "https://ark.cn-beijing.volces.com/api",
        default_models: [
            "doubao-seed-1-6-250615",
            "doubao-seed-1-6-flash-250615",
        ],
    },
    {
        label: "智谱 GLM",
        name: "GLM",
        api_type: "glm",
        api_base: "https://open.bigmodel.cn",
        default_models: ["glm-4-flash", "glm-4-plus", "glm-4.6v-flash"],
    },
    {
        label: "OpenRouter",
        name: "OpenRouter",
        api_type: "openrouter",
        api_base: "https://openrouter.ai/api",
        default_models: ["google/gemini-2.5-flash", "anthropic/claude-3.5-sonnet"],
    },
    {
        label: "MiniMax",
        name: "MiniMax",
        api_type: "minimax",
        api_base: "https://api.minimaxi.com",
        default_models: ["MiniMax-Text-01"],
    },
    {
        label: "自定义 OpenAI",
        name: "Custom",
        api_type: "openai",
        api_base: "https://api.openai.com/v1",
        default_models: ["gpt-4o", "gpt-4o-mini"],
    },
];

// 真寻底层原生支持的调用协议
const CORE_PROTOCOLS = [
    { value: "openai", label: "OpenAI 兼容" },
    { value: "gemini", label: "Gemini" },
    { value: "deepseek", label: "DeepSeek" },
    { value: "doubao", label: "火山方舟" },
    { value: "glm", label: "智谱 GLM" },
    { value: "openrouter", label: "OpenRouter" },
    { value: "minimax", label: "MiniMax" },
];

const form = ref<{
    name: string;
    api_type: string;
    api_base: string;
    api_key_str: string;
    timeout: number;
    temperature: number | null;
    max_output_tokens: number | null;
    models: ModelDetailItem[];
    enabled: boolean;
}>({
    name: "",
    api_type: "openai",
    api_base: "",
    api_key_str: "",
    timeout: 180,
    temperature: null,
    max_output_tokens: null,
    models: [],
    enabled: true,
});

const newModelInput = ref("");
const isEditMode = computed(() => !!props.provider);

watch(
    () => props.visible,
    (val) => {
        if (val) {
            showModelsDevPicker.value = false;
            modelTestState.value = {};
        }
    }
);

watch(
    () => props.provider,
    (val) => {
        if (val) {
            form.value = {
                name: val.name,
                api_type: val.api_type || "openai",
                api_base: val.api_base || "",
                api_key_str: Array.isArray(val.api_key)
                    ? val.api_key.join("\n")
                    : val.api_key || "",
                timeout: val.timeout ?? 180,
                temperature: val.temperature ?? null,
                max_output_tokens: val.max_output_tokens ?? null,
                models: JSON.parse(JSON.stringify(val.models || [])),
                enabled: val.enabled !== false,
            };
        } else {
            form.value = {
                name: "",
                api_type: "openai",
                api_base: "",
                api_key_str: "",
                timeout: 180,
                temperature: null,
                max_output_tokens: null,
                models: [],
                enabled: true,
            };
        }
    },
    { immediate: true }
);

const applyPreset = (preset: ProviderPreset) => {
    form.value.name = preset.name;
    form.value.api_type = preset.api_type;
    form.value.api_base = preset.api_base;
    form.value.models = preset.default_models.map((m) => ({
        model_name: m,
    }));
};

const addModel = () => {
    const raw = newModelInput.value.trim();
    if (!raw) return;
    const names = raw.split(/[\n,，\s]+/).filter(Boolean);
    for (const name of names) {
        if (!form.value.models.some((m) => m.model_name === name)) {
            form.value.models.push({ model_name: name });
        }
    }
    newModelInput.value = "";
};

const removeModel = (index: number) => {
    form.value.models.splice(index, 1);
};

// 单模型连通性测速
const handleTestModel = async (modelName: string) => {
    const fullModelName = `${form.value.name}/${modelName}`;
    modelTestState.value[modelName] = { loading: true };
    try {
        const res = await aiApi.testModel(fullModelName);
        if (res.data) {
            modelTestState.value[modelName] = {
                loading: false,
                success: res.data.success,
                latency_ms: res.data.latency_ms,
                message: res.data.message,
            };
            if (res.data.success) {
                ZXNotification({
                    title: "测通成功",
                    message: `${modelName} 响应耗时: ${res.data.latency_ms} ms`,
                    type: "success",
                    position: "top-right",
                });
            } else {
                ZXNotification({
                    title: "连通失败",
                    message: res.data.message,
                    type: "error",
                    position: "top-right",
                });
            }
        }
    } catch (e: any) {
        modelTestState.value[modelName] = {
            loading: false,
            success: false,
            message: e?.message || "测试请求出错",
        };
        ZXNotification({
            title: "测试报错",
            message: `${e?.message || e}`,
            type: "error",
            position: "top-right",
        });
    }
};

const handleDeleteCurrent = () => {
    if (!form.value.name || props.saving) return;
    emit("delete", form.value.name);
};

const handleSave = () => {
    if (!form.value.name.trim() || props.saving) return;

    // 解析 Key
    const rawKeys = form.value.api_key_str
        .split("\n")
        .map((k) => k.trim())
        .filter(Boolean);
    const apiKey = rawKeys.length <= 1 ? rawKeys[0] || "" : rawKeys;

    const provider: ProviderItem = {
        name: form.value.name.trim(),
        api_type: form.value.api_type.trim(),
        api_base: form.value.api_base.trim() || null,
        api_key: apiKey,
        timeout: Number(form.value.timeout) || 180,
        temperature: form.value.temperature ? Number(form.value.temperature) : null,
        max_output_tokens: form.value.max_output_tokens
            ? Number(form.value.max_output_tokens)
            : null,
        models: form.value.models,
        enabled: form.value.enabled,
        priority: props.provider?.priority ?? 1,
        weight: props.provider?.weight ?? 10,
    };

    emit("save", provider);
};
</script>

<template>
    <ZxModal
        :model-value="visible"
        size="lg"
        width="max-w-2xl"
        :closable="false"
        body-class="!p-0 !overflow-hidden"
        @update:model-value="val => { if (!val) emit('close'); }"
    >
        <div class="relative flex h-full min-h-0 flex-col">
                    <!-- models.dev 挑选服务商覆盖面板 (轻量层) -->
                    <Transition
                        enter-active-class="transition-all duration-200 ease-out"
                        enter-from-class="opacity-0 scale-95"
                        enter-to-class="opacity-100 scale-100"
                        leave-active-class="transition-all duration-150 ease-in"
                        leave-from-class="opacity-100 scale-100"
                        leave-to-class="opacity-0 scale-95"
                    >
                        <div
                            v-if="showModelsDevPicker"
                            class="absolute inset-0 z-30 flex flex-col bg-white rounded-3xl overflow-hidden"
                        >
                            <!-- 头部 -->
                            <div class="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-6 py-4 shrink-0">
                                <div class="flex items-center gap-2.5">
                                    <div class="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                                        <Globe class="h-4 w-4" />
                                    </div>
                                    <div>
                                        <h3 class="text-sm font-bold text-zx-text-strong">从 models.dev 选择服务商</h3>
                                        <p class="text-[11px] text-zx-text-muted">选择并自动填入官方接口地址、协议与模型列表</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-zx-text-subtle hover:bg-slate-100 hover:text-zx-text-muted transition"
                                    @click="showModelsDevPicker = false"
                                >
                                    <X class="h-4 w-4" />
                                </button>
                            </div>

                            <!-- 搜索栏 -->
                            <div class="p-3.5 border-b border-slate-100 bg-slate-50/40 shrink-0">
                                <ZXInput
                                    v-model="modelsDevSearch"
                                    type="search"
                                    rounded="xl"
                                    size="sm"
                                    placeholder="搜索服务商名称或标识 (如 Groq, Moonshot, Mistral, Together, Anthropic...)"
                                    autofocus
                                />
                            </div>

                            <!-- 服务商列表 -->
                            <div class="flex-1 overflow-y-auto p-3 space-y-1">
                                <!-- 加载中 -->
                                <div v-if="loadingModelsDev" class="flex flex-col items-center justify-center py-16 text-zx-text-muted gap-2">
                                    <Loader2 class="h-6 w-6 animate-spin text-zx-primary" />
                                    <span class="text-xs">正在拉取 models.dev 全球模型目录...</span>
                                </div>

                                <!-- 空状态 -->
                                <ZxEmptyState
                                    v-else-if="filteredModelsDevProviders.length === 0"
                                    size="sm"
                                    text="未找到匹配的服务商"
                                />

                                <!-- 列表项 -->
                                <div
                                    v-else
                                    v-for="p in filteredModelsDevProviders"
                                    :key="p.id"
                                    class="flex items-center justify-between p-3 rounded-2xl border border-transparent hover:border-slate-200 hover:bg-slate-50/80 transition cursor-pointer group"
                                    @click="applyModelsDevProvider(p)"
                                >
                                    <div class="flex items-center gap-3 min-w-0">
                                        <div class="flex h-9 w-9 items-center justify-center shrink-0 rounded-xl bg-slate-100 p-1 text-zx-text-muted">
                                            <ProviderIcon :name="p.name" :api-type="p.api_type" size-class="h-6 w-6" />
                                        </div>
                                        <div class="min-w-0">
                                            <div class="flex items-center gap-2">
                                                <span class="font-bold text-xs text-zx-text-strong group-hover:text-zx-primary transition-colors truncate">
                                                    {{ p.name }}
                                                </span>
                                                <span class="text-[10px] text-zx-text-subtle font-mono shrink-0">({{ p.id }})</span>
                                            </div>
                                            <div class="text-[11px] text-zx-text-muted font-mono truncate mt-0.5" :title="p.api_base || undefined">
                                                {{ p.api_base || '使用协议官方默认端点' }}
                                            </div>
                                        </div>
                                    </div>

                                    <div class="flex items-center gap-2 shrink-0">
                                        <span class="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-zx-text-muted font-mono">
                                            {{ p.api_type }}
                                        </span>
                                        <span class="text-[10px] px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 font-medium">
                                            {{ p.models_count }} 模型
                                        </span>
                                        <span class="text-xs text-zx-primary opacity-0 group-hover:opacity-100 transition-opacity font-medium ml-1">
                                            选择导入 &rarr;
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <!-- 底部栏 -->
                            <div class="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-6 py-3 shrink-0">
                                <span class="text-xs text-zx-text-muted">
                                    共 {{ modelsDevCatalog.length }} 家在线服务商可选
                                </span>
                                <ZxButton variant="ghost" size="sm" @click="showModelsDevPicker = false">
                                    返回编辑
                                </ZxButton>
                            </div>
                        </div>
                    </Transition>

                    <!-- 弹窗主标题 -->
                    <div
                        class="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4 shrink-0"
                    >
                        <div class="flex items-center gap-2.5">
                            <div
                                class="flex h-8 w-8 items-center justify-center shrink-0 text-zx-text-muted"
                            >
                                <ProviderIcon
                                    :name="form.name"
                                    :api-type="form.api_type"
                                    size-class="h-7 w-7"
                                />
                            </div>
                            <div>
                                <h3 class="text-base font-bold text-zx-text-strong">
                                    {{ isEditMode ? `配置服务商: ${form.name}` : "添加服务提供商" }}
                                </h3>
                                <p class="text-[11px] text-zx-text-subtle">
                                    配置服务商连接地址、协议、API 密钥与模型列表
                                </p>
                            </div>
                        </div>
                        <div class="flex items-center gap-3">
                            <!-- 渠道启用/禁用开关 -->
                            <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 border border-slate-200/80">
                                <span
                                    class="text-xs font-medium"
                                    :class="form.enabled ? 'text-emerald-600' : 'text-zx-text-subtle'"
                                >
                                    {{ form.enabled ? "已启用" : "已禁用" }}
                                </span>
                                <ZxSwitch v-model="form.enabled" title="切换渠道启用状态" />
                            </div>

                            <button
                                type="button"
                                class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-zx-text-subtle transition hover:bg-slate-100 hover:text-zx-text-muted"
                                @click="emit('close')"
                            >
                                <X class="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    <!-- 滚动表单内容区 -->
                    <div class="flex-1 overflow-y-auto px-6 py-5 space-y-5 text-sm">
                        <!-- 快速配置模板与 models.dev 选择入口 (仅新增时展示) -->
                        <div v-if="!isEditMode" class="space-y-2.5 pb-3 border-b border-slate-100">
                            <div class="flex items-center justify-between">
                                <label class="font-medium text-xs text-zx-text-strong">
                                    快速配置模板
                                </label>
                                <button
                                    type="button"
                                    class="cursor-pointer flex items-center gap-1 text-xs text-zx-primary hover:underline font-medium"
                                    @click="openModelsDevPicker"
                                >
                                    <Globe class="h-3.5 w-3.5" />
                                    <span>从 models.dev 选择服务商...</span>
                                </button>
                            </div>

                            <!-- 常用模板胶囊按钮 -->
                            <div class="flex flex-wrap gap-1.5">
                                <button
                                    v-for="preset in PRESETS"
                                    :key="preset.name"
                                    type="button"
                                    class="cursor-pointer flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-zx-text transition hover:border-zx-primary hover:bg-zx-primary-soft hover:text-zx-primary"
                                    @click="applyPreset(preset)"
                                >
                                    <ProviderIcon
                                        :name="preset.name"
                                        :api-type="preset.api_type"
                                        size-class="h-3.5 w-3.5"
                                    />
                                    <span>{{ preset.label }}</span>
                                </button>
                            </div>
                        </div>

                        <!-- 基础信息与协议 -->
                        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <!-- 服务商名称 -->
                            <div class="space-y-1.5">
                                <label class="font-medium text-xs text-zx-text-strong">
                                    提供商名称 <span class="text-red-500">*</span>
                                </label>
                                <ZXInput
                                    v-model="form.name"
                                    placeholder="例如 DeepSeek, Gemini"
                                    :disabled="isEditMode"
                                    rounded="xl"
                                    size="sm"
                                    input-class="font-medium"
                                />
                            </div>

                            <!-- 协议类型 -->
                            <div class="space-y-1.5">
                                <div class="flex items-center justify-between">
                                    <label class="font-medium text-xs text-zx-text-strong">
                                        协议类型 (API Type)
                                    </label>
                                    <span class="text-[11px] text-zx-text-subtle">点击快捷切换</span>
                                </div>
                                <ZXInput
                                    v-model="form.api_type"
                                    placeholder="openai, gemini, deepseek 等"
                                    rounded="xl"
                                    size="sm"
                                    input-class="font-mono"
                                />
                                <div class="flex flex-wrap items-center gap-1.5 pt-1">
                                    <button
                                        v-for="proto in CORE_PROTOCOLS"
                                        :key="proto.value"
                                        type="button"
                                        class="text-[10px] px-2 py-0.5 rounded-md border transition-all cursor-pointer select-none"
                                        :class="form.api_type === proto.value
                                            ? 'bg-zx-primary-soft text-zx-primary border-zx-primary/40 font-bold shadow-xs'
                                            : 'bg-white border-slate-200/80 text-zx-text-muted hover:bg-slate-50 hover:text-zx-text'"
                                        @click="form.api_type = proto.value"
                                    >
                                        {{ proto.label }}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- API Base URL -->
                        <div class="space-y-1.5">
                            <label class="font-medium text-xs text-zx-text-strong">
                                接口基础地址 (API Base URL)
                            </label>
                            <ZXInput
                                v-model="form.api_base"
                                placeholder="例如 https://api.deepseek.com (留空使用协议默认)"
                                rounded="xl"
                                size="sm"
                                input-class="font-mono"
                            />
                        </div>

                        <!-- API Key -->
                        <div class="space-y-1.5">
                            <div class="flex items-center justify-between">
                                <label class="font-medium text-xs text-zx-text-strong">
                                    API 密钥 (API Key) <span class="text-red-500">*</span>
                                </label>
                                <div class="flex items-center gap-2">
                                    <button
                                        type="button"
                                        class="text-xs text-zx-text-subtle hover:text-zx-text flex items-center gap-1 cursor-pointer"
                                        @click="showKeyPlain = !showKeyPlain"
                                    >
                                        <Eye v-if="!showKeyPlain" class="h-3.5 w-3.5" />
                                        <EyeOff v-else class="h-3.5 w-3.5" />
                                        {{ showKeyPlain ? "掩码" : "明文" }}
                                    </button>
                                    <span class="text-[11px] text-zx-text-subtle">
                                        支持每行一个进行轮询
                                    </span>
                                </div>
                            </div>
                            <ZXInput
                                v-model="form.api_key_str"
                                type="textarea"
                                :rows="2"
                                :placeholder="showKeyPlain ? 'sk-xxxxxxxxxxxxxxxxxxxxxxxx' : '••••••••••••••••••••••••'"
                                input-class="font-mono leading-relaxed"
                            />
                        </div>

                        <!-- 调用参数配置 (可选) -->
                        <div class="space-y-2 pt-1 border-t border-slate-100">
                            <label class="font-medium text-xs text-zx-text-strong">
                                调用参数设置 (可选)
                            </label>
                            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div class="space-y-1">
                                    <label class="font-medium text-[11px] text-zx-text-muted">
                                        超时时间 (秒)
                                    </label>
                                    <ZxInputNumber
                                        v-model="form.timeout"
                                        size="sm"
                                        placeholder="180"
                                    />
                                </div>
                                <div class="space-y-1">
                                    <label class="font-medium text-[11px] text-zx-text-muted">
                                        默认采样温度
                                    </label>
                                    <ZxInputNumber
                                        :model-value="form.temperature ?? 0"
                                        :step="0.1"
                                        :precision="2"
                                        size="sm"
                                        placeholder="默认 (如 0.7)"
                                        @update:model-value="(v: number) => (form.temperature = v)"
                                    />
                                </div>
                                <div class="space-y-1">
                                    <label class="font-medium text-[11px] text-zx-text-muted">
                                        最大输出 Token
                                    </label>
                                    <ZxInputNumber
                                        :model-value="form.max_output_tokens ?? 0"
                                        size="sm"
                                        placeholder="不限制"
                                        @update:model-value="(v: number) => (form.max_output_tokens = v)"
                                    />
                                </div>
                            </div>
                        </div>

                        <!-- 模型列表管理 -->
                        <div class="space-y-2 pt-2 border-t border-slate-100">
                            <div class="flex items-center justify-between">
                                <label class="font-medium text-xs text-zx-text-strong">
                                    模型列表 ({{ form.models.length }})
                                </label>
                                <button
                                    v-if="matchedOnlineProvider"
                                    type="button"
                                    class="text-xs text-zx-primary hover:underline cursor-pointer flex items-center gap-1 font-medium"
                                    @click="syncModelsFromOnline"
                                >
                                    <Sparkles class="h-3.5 w-3.5" />
                                    从 models.dev 补齐最新模型
                                </button>
                            </div>

                            <!-- 添加模型输入框 -->
                            <div class="flex gap-2">
                                <ZXInput
                                    v-model="newModelInput"
                                    placeholder="输入模型标识（支持逗号或空格批量添加）"
                                    rounded="xl"
                                    size="sm"
                                    input-class="font-mono"
                                    class="flex-1"
                                    @keydown.enter.prevent="addModel"
                                />
                                <ZxButton variant="primary" size="sm" @click="addModel">
                                    <Plus class="h-3.5 w-3.5 mr-1" /> 添加
                                </ZxButton>
                            </div>

                            <!-- 模型列表项（带单模型测速与移除） -->
                            <div
                                class="max-h-56 overflow-y-auto rounded-2xl border border-slate-100 bg-slate-50/50 p-2.5 space-y-1.5"
                            >
                                <div
                                    v-for="(model, idx) in form.models"
                                    :key="model.model_name"
                                    class="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-zx-text shadow-2xs"
                                >
                                    <div class="flex items-center gap-2 min-w-0">
                                        <span class="font-mono font-bold truncate">
                                            {{ model.model_name }}
                                        </span>
                                        <span
                                            v-if="model.max_output_tokens"
                                            class="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-zx-text-muted font-mono"
                                        >
                                            {{ model.max_output_tokens }}
                                        </span>
                                    </div>

                                    <div class="flex items-center gap-1.5 shrink-0">
                                        <!-- 测速耗时显示 -->
                                        <span
                                            v-if="modelTestState[model.model_name]?.latency_ms"
                                            class="text-[10px] font-mono text-emerald-600 font-bold"
                                        >
                                            {{ modelTestState[model.model_name].latency_ms }} ms
                                        </span>

                                        <!-- 测通按钮 -->
                                        <button
                                            type="button"
                                            class="p-1 rounded-lg text-zx-text-subtle hover:text-zx-primary hover:bg-slate-100 transition cursor-pointer"
                                            title="测试此模型连通性"
                                            :disabled="modelTestState[model.model_name]?.loading"
                                            @click="handleTestModel(model.model_name)"
                                        >
                                            <Loader2
                                                v-if="modelTestState[model.model_name]?.loading"
                                                class="h-3.5 w-3.5 animate-spin text-zx-primary"
                                            />
                                            <Play v-else class="h-3.5 w-3.5" />
                                        </button>

                                        <!-- 移除按钮 -->
                                        <button
                                            type="button"
                                            class="p-1 rounded-lg text-zx-text-subtle hover:text-zx-danger hover:bg-slate-100 transition cursor-pointer"
                                            title="移除模型"
                                            @click="removeModel(idx)"
                                        >
                                            <X class="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>

                                <div
                                    v-if="!form.models.length"
                                    class="w-full py-4 text-center text-xs text-zx-text-subtle"
                                >
                                    尚未添加模型，请输入模型名称添加或从上方模板载入
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 弹窗底部操作栏 -->
                    <div
                        class="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-6 py-4 shrink-0"
                    >
                        <div>
                            <ZxButton
                                v-if="isEditMode"
                                variant="danger"
                                size="sm"
                                @click="handleDeleteCurrent"
                            >
                                <Trash2 class="h-3.5 w-3.5 mr-1" />
                                删除服务商
                            </ZxButton>
                        </div>

                        <div class="flex items-center gap-2.5">
                            <ZxButton
                                variant="ghost"
                                size="sm"
                                :disabled="saving"
                                @click="emit('close')"
                            >
                                取消
                            </ZxButton>
                            <ZxButton
                                variant="primary"
                                size="sm"
                                :loading="saving"
                                :disabled="!form.name.trim() || saving"
                                @click="handleSave"
                            >
                                <Check class="h-3.5 w-3.5 mr-1" />
                                保存配置
                            </ZxButton>
                        </div>
                    </div>
        </div>
    </ZxModal>
</template>
