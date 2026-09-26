<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import type { Component } from "vue";
import {
    Boxes,
    Check,
    ChevronDown,
    Eye,
    Globe,
    GripVertical,
    HelpCircle,
    Library,
    Loader2,
    Lock,
    Pencil,
    Plug,
    Plus,
    RefreshCw,
    Search,
    Server,
    SlidersHorizontal,
    Sparkles,
    Trash2,
    X,
} from "lucide-vue-next";
import { modalJelly } from "@/composables/useGsapTransition";
import ZxButton from "@/components/zxcomponent/ZxButton.vue";
import ZxEmptyState from "@/components/zxcomponent/ZxEmptyState.vue";
import ZxInputNumber from "@/components/zxcomponent/ZxInputNumber.vue";
import ZxModal from "@/components/zxcomponent/ZxModal.vue";
import ZxSwitch from "@/components/zxcomponent/ZxSwitch.vue";
import ZxTag from "@/components/zxcomponent/ZxTag.vue";
import ZXInput from "@/components/zxcomponent/ZXInput.vue";
import {
    ZXSelect,
    type ZXSelectOption,
} from "@/components/zxcomponent/ZXSelect";
import ProviderIcon from "./ProviderIcon.vue";
import { ZXNotification } from "@/services/ui";
import { aiApi } from "@/utils/api-next";
import { MOCK_MODE, isMockEnabled } from "virtual:mock-mode";
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

// ---------------------------------------------------------------------------
// 侧栏分区
// ---------------------------------------------------------------------------

interface Section {
    id: string;
    label: string;
    desc: string;
    icon: Component;
}

const sections: Section[] = [
    {
        id: "basics",
        label: "基础信息",
        desc: "配置服务商连接、认证密钥与可调用模型",
        icon: Server,
    },
    {
        id: "params",
        label: "调用参数",
        desc: "设置超时、采样温度与输出长度上限",
        icon: SlidersHorizontal,
    },
];

const activeSection = ref<string>("basics");
const activeMeta = computed(
    () => sections.find((s) => s.id === activeSection.value) ?? sections[0]
);

const goSection = (id: string) => {
    activeSection.value = id;
};

// ---------------------------------------------------------------------------
// 表单
// ---------------------------------------------------------------------------

const form = ref<{
    name: string;
    icon: string;
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
    icon: "",
    api_type: "openai",
    api_base: "",
    api_key_str: "",
    timeout: 180,
    temperature: null,
    max_output_tokens: null,
    models: [],
    enabled: true,
});

// 重命名 / 换图标弹窗
const showNameDialog = ref(false);
const nameDraft = ref("");
const iconDraft = ref("");

const PROVIDER_ICON_KEYS = [
    "deepseek",
    "openai",
    "claude",
    "gemini",
    "siliconflow",
    "doubao",
    "zhipu",
    "qwen",
    "wenxin",
    "moonshot",
    "minimax",
    "mistral",
    "groq",
    "openrouter",
    "ollama",
    "together",
    "perplexity",
    "azure",
    "baichuan",
    "stepfun",
    "yi",
    "grok",
    "nvidia",
    "bedrock",
    "github",
    "cloudflare",
    "replicate",
    "fireworks",
    "novita",
    "deepinfra",
    "upstage",
    "huggingface",
    "meta",
    "sub2api",
    "newapi",
    "oneapi",
    "ai302",
    "aihubmix",
    "cometapi",
    "llmapi",
    "openwebui",
    "lobehub",
    "relay",
];

const openNameDialog = () => {
    nameDraft.value = form.value.name;
    iconDraft.value = form.value.icon || "";
    showNameDialog.value = true;
};

const confirmNameDialog = () => {
    form.value.name = nameDraft.value.trim();
    form.value.icon = iconDraft.value;
    showNameDialog.value = false;
};

const isEditMode = computed(() => !!props.provider);

// ---------------------------------------------------------------------------
// models.dev 目录
// ---------------------------------------------------------------------------

const modelsDevCatalog = ref<ModelsDevProviderItem[]>([]);
const loadingModelsDev = ref(false);
const modelsDevSearch = ref("");
const refreshingModelsDev = ref(false);
const showProviderPicker = ref(false);

const ensureModelsDevCatalog = async (force = false) => {
    if (!force && modelsDevCatalog.value.length > 0) return true;
    loadingModelsDev.value = true;
    try {
        // 仅 mock 模式直连 models.dev 补全量数据；正式环境只走后端接口
        if (MOCK_MODE && isMockEnabled()) {
            try {
                const remote = await fetchModelsDevRemote();
                if (remote.length) {
                    modelsDevCatalog.value = remote;
                    return true;
                }
            } catch {
                /* 直连失败则回退接口 */
            }
        }
        const res = force
            ? await aiApi.refreshModelsDevCatalog()
            : await aiApi.getModelsDevCatalog(
                  modelsDevSearch.value.trim() || undefined
              );
        const payload: any = (res as any)?.data ?? res;
        const list: ModelsDevProviderItem[] = Array.isArray(payload)
            ? payload
            : payload?.providers || [];
        modelsDevCatalog.value = list;
        return true;
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
    return false;
};

/** 直连 https://models.dev/api.json 并转成前端目录结构 */
async function fetchModelsDevRemote(): Promise<ModelsDevProviderItem[]> {
    const res = await fetch("https://models.dev/api.json", {
        cache: "no-cache",
    });
    if (!res.ok) throw new Error(`models.dev HTTP ${res.status}`);
    const raw: Record<string, any> = await res.json();
    return Object.values(raw || {}).map((p: any) => {
        const models = Object.entries(p?.models || {}).map(
            ([id, m]: [string, any]) => ({
                id,
                name: m?.name || id,
                description: m?.description || null,
                context_limit: m?.limit?.context ?? null,
                max_output_tokens: m?.limit?.output ?? null,
                reasoning: !!m?.reasoning,
                tool_call: !!m?.tool_call,
                temperature: m?.temperature !== false,
                release_date: m?.release_date || null,
            })
        );
        return {
            id: String(p?.id || ""),
            name: String(p?.name || p?.id || ""),
            api_base: null as string | null,
            api_type: normalizeApiType(String(p?.api || p?.npm || "openai")),
            npm: p?.npm || null,
            doc: p?.doc || null,
            env: p?.env || [],
            models_count: models.length,
            models,
        };
    });
}

const refreshModelsDev = async () => {
    refreshingModelsDev.value = true;
    try {
        const ok = await ensureModelsDevCatalog(true);
        if (ok) {
            ZXNotification({
                title: "models.dev 已更新",
                message: "在线模型库缓存已刷新",
                type: "success",
                position: "top-right",
            });
        }
    } finally {
        refreshingModelsDev.value = false;
    }
};

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
    showProviderPicker.value = false;
    goSection("basics");
    ZXNotification({
        title: "服务商预设已载入",
        message: `已自动填入「${p.name || p.id}」协议、端点与 ${p.models.length} 个模型`,
        type: "success",
        position: "top-right",
    });
};

const matchedOnlineProvider = computed(() => {
    const name = form.value.name.trim().toLowerCase();
    if (!name) return null;
    return modelsDevCatalog.value.find(
        (p) => p.name.toLowerCase() === name || p.id.toLowerCase() === name
    );
});

const syncModelsFromOnline = async () => {
    await ensureModelsDevCatalog();
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

// ---------------------------------------------------------------------------
// 厂商预设
// ---------------------------------------------------------------------------

interface ProviderPreset {
    label: string;
    name: string;
    api_type: string;
    api_base: string;
}

const PRESETS: ProviderPreset[] = [
    {
        label: "自定义",
        name: "Custom",
        api_type: "openai",
        api_base: "",
    },
    {
        label: "DeepSeek",
        name: "DeepSeek",
        api_type: "openai",
        api_base: "https://api.deepseek.com",
    },
    {
        label: "Google Gemini",
        name: "Gemini",
        api_type: "openai",
        api_base: "https://generativelanguage.googleapis.com",
    },
    {
        label: "硅基流动",
        name: "siliconflow",
        api_type: "openai",
        api_base: "https://api.siliconflow.cn",
    },
    {
        label: "火山方舟 (Doubao)",
        name: "Doubao",
        api_type: "openai",
        api_base: "https://ark.cn-beijing.volces.com/api",
    },
    {
        label: "智谱 GLM",
        name: "GLM",
        api_type: "openai",
        api_base: "https://open.bigmodel.cn",
    },
    {
        label: "OpenRouter",
        name: "OpenRouter",
        api_type: "openai",
        api_base: "https://openrouter.ai/api",
    },
    {
        label: "MiniMax",
        name: "MiniMax",
        api_type: "openai",
        api_base: "https://api.minimaxi.com",
    },
];

/** API 格式：仅 Claude / OpenAI 原生，其余一律按 OpenAI 兼容 */
const API_FORMATS = [
    { value: "claude", label: "Anthropic Messages", suffix: "/v1/messages" },
    { value: "openai", label: "OpenAI 兼容", suffix: "/chat/completions" },
    { value: "openai_responses", label: "Responses", suffix: "/responses" },
] as const;

/** 归一化：非 Claude / OpenAI Responses 一律视为 OpenAI 兼容 */
const normalizeApiType = (raw?: string | null): string => {
    const t = (raw || "").toLowerCase().trim();
    if (t === "claude" || t === "anthropic" || t === "anthropic_messages") {
        return "claude";
    }
    if (
        t === "openai_responses" ||
        t === "openai-responses" ||
        t === "responses" ||
        t === "response"
    ) {
        return "openai_responses";
    }
    return "openai";
};

const apiFormatOptions = computed<ZXSelectOption[]>(() =>
    API_FORMATS.map((f) => ({
        label: `${f.suffix} (${f.label})`,
        value: f.value,
    }))
);

const apiFormatDisplay = computed(() => {
    const found = API_FORMATS.find(
        (f) => f.value === normalizeApiType(form.value.api_type)
    );
    return found ? `${found.suffix} (${found.label})` : "";
});

const applyPreset = (preset: ProviderPreset) => {
    form.value.name = preset.name;
    form.value.api_type = preset.api_type;
    form.value.api_base = preset.api_base;
    showProviderPicker.value = false;
    goSection("basics");
    ZXNotification({
        title: "模板已应用",
        message: `已载入「${preset.label}」连接配置`,
        type: "success",
        position: "top-right",
    });
};

const openProviderPicker = async () => {
    showProviderPicker.value = true;
    modelsDevSearch.value = "";
    modelsDevCatalog.value = [];
    await ensureModelsDevCatalog();
};

// ---------------------------------------------------------------------------
// 模型管理 / 测速
// ---------------------------------------------------------------------------

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

// 添加模型弹窗
const showAddModel = ref(false);
const showAdvanced = ref(false);
const addModelForm = ref<{
    smart_config: boolean;
    model_name: string;
    context_limit: string | number;
    max_output_tokens: string | number;
    temperature: number | null;
    reasoning_effort: string | null;
    input_types: string[];
    capabilities: string[];
    reasoning_levels: string[];
    reasoning_param_map: string;
}>({
    smart_config: true,
    model_name: "",
    context_limit: "",
    max_output_tokens: "",
    temperature: null,
    reasoning_effort: null,
    input_types: ["text"],
    capabilities: [],
    reasoning_levels: [],
    reasoning_param_map: "",
});

const INPUT_TYPE_OPTIONS = [
    { key: "text", label: "文本", locked: true },
    { key: "image", label: "图片" },
    { key: "video", label: "视频" },
    { key: "pdf", label: "PDF" },
] as const;

const CAPABILITY_OPTIONS = [
    { key: "structured_output", label: "结构化输出" },
    { key: "native_search", label: "原生联网搜索" },
    { key: "system_message", label: "对话中系统消息" },
] as const;

const capabilityLabel = (key: string) => {
    return (
        CAPABILITY_OPTIONS.find((c) => c.key === key)?.label || key
    );
};

const REASONING_LEVEL_OPTIONS = ["low", "medium", "high"] as const;

const reasoningEffortOptions: ZXSelectOption[] = [
    { label: "不限", value: "" },
    { label: "低", value: "low" },
    { label: "中", value: "medium" },
    { label: "高", value: "high" },
];

const toggleInputType = (key: string, locked?: boolean) => {
    if (locked) return;
    const set = new Set(addModelForm.value.input_types);
    if (set.has(key)) set.delete(key);
    else set.add(key);
    addModelForm.value.input_types = [...set];
};

const toggleCapability = (key: string) => {
    const set = new Set(addModelForm.value.capabilities);
    if (set.has(key)) set.delete(key);
    else set.add(key);
    addModelForm.value.capabilities = [...set];
};

const addReasoningLevel = () => {
    const next = REASONING_LEVEL_OPTIONS.find(
        (l) => !addModelForm.value.reasoning_levels.includes(l)
    );
    if (next) addModelForm.value.reasoning_levels.push(next);
};

const removeReasoningLevel = (index: number) => {
    addModelForm.value.reasoning_levels.splice(index, 1);
};

const reasoningLevelInput = ref("");

const commitReasoningLevel = () => {
    const raw = reasoningLevelInput.value.trim().toLowerCase();
    if (!raw) return;
    if (!addModelForm.value.reasoning_levels.includes(raw)) {
        addModelForm.value.reasoning_levels.push(raw);
    }
    reasoningLevelInput.value = "";
};

const openAddModel = () => {
    editingModelIndex.value = -1;
    resetAddModelForm();
    showAddModel.value = true;
};

// models.dev 模型搜索浮层
const showModelSearch = ref(false);
const modelSearchQuery = ref("");

const flatModelsDev = computed(() => {
    const list: {
        provider: string;
        provider_id: string;
        id: string;
        name: string;
        context_limit?: number | null;
        max_output_tokens?: number | null;
        reasoning?: boolean;
    }[] = [];
    for (const p of modelsDevCatalog.value) {
        for (const m of p.models) {
            list.push({
                provider: p.name,
                provider_id: p.id,
                id: m.id,
                name: m.name,
                context_limit: m.context_limit,
                max_output_tokens: m.max_output_tokens,
                reasoning: m.reasoning,
            });
        }
    }
    return list;
});

const filteredModelsDevModels = computed(() => {
    const q = modelSearchQuery.value.trim().toLowerCase();
    if (!q) return flatModelsDev.value.slice(0, 30);
    return flatModelsDev.value
        .filter(
            (m) =>
                m.id.toLowerCase().includes(q) ||
                m.name.toLowerCase().includes(q) ||
                m.provider.toLowerCase().includes(q)
        )
        .slice(0, 50);
});

const openModelSearch = async () => {
    showModelSearch.value = true;
    modelSearchQuery.value = "";
    // 每次打开都请求 models.dev 目录接口
    modelsDevCatalog.value = [];
    await ensureModelsDevCatalog();
};

const applyModelFromDev = (m: {
    id: string;
    context_limit?: number | null;
    max_output_tokens?: number | null;
    reasoning?: boolean;
}) => {
    addModelForm.value.model_name = m.id;
    addModelForm.value.context_limit = m.context_limit ?? "";
    addModelForm.value.max_output_tokens = m.max_output_tokens ?? "";
    addModelForm.value.reasoning_effort = m.reasoning ? "medium" : null;
    showModelSearch.value = false;
};

/** 智能填：按模型 ID 从 models.dev 目录补全参数 */
const smartFillFromModelsDev = async () => {
    const id = addModelForm.value.model_name.trim().toLowerCase();
    if (!id) return;
    await ensureModelsDevCatalog();
    const hit = flatModelsDev.value.find((m) => m.id.toLowerCase() === id);
    if (!hit) return;
    // 只补空字段，不覆盖用户已填
    if (
        addModelForm.value.context_limit === "" ||
        addModelForm.value.context_limit == null
    ) {
        addModelForm.value.context_limit = hit.context_limit ?? "";
    }
    if (
        addModelForm.value.max_output_tokens === "" ||
        addModelForm.value.max_output_tokens == null
    ) {
        addModelForm.value.max_output_tokens = hit.max_output_tokens ?? "";
    }
    if (!addModelForm.value.reasoning_effort && hit.reasoning) {
        addModelForm.value.reasoning_effort = "medium";
    }
};

const editingModelIndex = ref(-1);

const openEditModel = (index: number) => {
    const model = form.value.models[index];
    if (!model) return;
    editingModelIndex.value = index;
    addModelForm.value = {
        smart_config: model.smart_config ?? true,
        model_name: model.model_name,
        context_limit: model.context_limit ?? "",
        max_output_tokens: model.max_output_tokens ?? "",
        temperature: model.temperature ?? null,
        reasoning_effort: model.reasoning_effort ?? null,
        input_types: model.input_types?.length
            ? [...model.input_types]
            : ["text"],
        capabilities: [...(model.capabilities || [])],
        reasoning_levels: [...(model.reasoning_levels || [])],
        reasoning_param_map: model.reasoning_param_map || "",
    };
    showAddModel.value = true;
};

const resetAddModelForm = () => {
    editingModelIndex.value = -1;
    addModelForm.value = {
        smart_config: true,
        model_name: "",
        context_limit: "",
        max_output_tokens: "",
        temperature: null,
        reasoning_effort: null,
        input_types: ["text"],
        capabilities: [],
        reasoning_levels: [],
        reasoning_param_map: "",
    };
};

const handleAddModel = () => {
    const name = addModelForm.value.model_name.trim();
    if (!name) return;
    const editing = editingModelIndex.value >= 0;
    const duplicated = form.value.models.some(
        (m, i) => m.model_name === name && (!editing || i !== editingModelIndex.value)
    );
    if (duplicated) {
        ZXNotification({
            title: "模型已存在",
            message: `列表中已有「${name}」`,
            type: "warning",
            position: "top-right",
        });
        return;
    }
    const next: ModelDetailItem = {
        model_name: name,
        smart_config: addModelForm.value.smart_config,
        context_limit: addModelForm.value.context_limit
            ? Number(addModelForm.value.context_limit) || null
            : null,
        max_output_tokens: addModelForm.value.max_output_tokens
            ? Number(addModelForm.value.max_output_tokens) || null
            : null,
        temperature: addModelForm.value.temperature
            ? Number(addModelForm.value.temperature)
            : null,
        reasoning_effort: addModelForm.value.reasoning_effort || null,
        input_types: addModelForm.value.input_types,
        capabilities: addModelForm.value.capabilities,
        reasoning_levels: addModelForm.value.reasoning_levels,
        reasoning_param_map: addModelForm.value.reasoning_param_map || null,
    };
    if (editing) {
        form.value.models.splice(editingModelIndex.value, 1, next);
    } else {
        form.value.models.push(next);
    }
    showAddModel.value = false;
    editingModelIndex.value = -1;
};

const removeModel = (index: number) => {
    form.value.models.splice(index, 1);
};

// 模型拖拽排序（拖动中实时换位；dragenter + 节流，避免 dragover 连触发导致抽搐）
const dragModelIndex = ref<number | null>(null);
const isDraggingModel = ref(false);
let lastModelSwapAt = 0;

const onModelDragStart = (index: number, e: DragEvent) => {
    dragModelIndex.value = index;
    isDraggingModel.value = true;
    lastModelSwapAt = 0;
    if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(index));
    }
};

const trySwapModel = (index: number) => {
    const from = dragModelIndex.value;
    if (from === null || from === index) return;
    const now = Date.now();
    if (now - lastModelSwapAt < 120) return;
    lastModelSwapAt = now;
    const list = form.value.models;
    const [item] = list.splice(from, 1);
    if (!item) return;
    list.splice(index, 0, item);
    dragModelIndex.value = index;
};

const onModelDragEnter = (index: number, e: DragEvent) => {
    if (dragModelIndex.value === null) return;
    e.preventDefault();
    trySwapModel(index);
};

const onModelDragOver = (e: DragEvent) => {
    if (dragModelIndex.value === null) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
};

const onModelDrop = (e: DragEvent) => {
    e.preventDefault();
    dragModelIndex.value = null;
    isDraggingModel.value = false;
};

const onModelDragEnd = () => {
    dragModelIndex.value = null;
    isDraggingModel.value = false;
};

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

// ---------------------------------------------------------------------------
// 生命周期 / 保存
// ---------------------------------------------------------------------------

watch(
    () => props.visible,
    (val) => {
        if (val) {
            modelTestState.value = {};
            modelsDevSearch.value = "";
            activeSection.value = "basics";
            showNameDialog.value = false;
        }
    }
);

watch(
    () => props.provider,
    (val) => {
        if (val) {
            form.value = {
                name: val.name,
                icon: (val as any).icon || "",
                api_type: normalizeApiType(val.api_type),
                api_base: val.api_base || "",
                api_key_str: Array.isArray(val.api_key)
                    ? val.api_key[0] || ""
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
                icon: "",
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

const handleDeleteCurrent = () => {
    if (!form.value.name || props.saving) return;
    emit("delete", form.value.name);
};

const handleSave = () => {
    if (!form.value.name.trim() || props.saving) return;

    const apiKey = form.value.api_key_str.trim();

    const provider: ProviderItem = {
        name: form.value.name.trim(),
        icon: form.value.icon || undefined,
        api_type: form.value.api_type.trim(),
        api_base: form.value.api_base.trim() || null,
        api_key: apiKey,
        timeout: Number(form.value.timeout) || 180,
        temperature: form.value.temperature ? Number(form.value.temperature) : null,
        max_output_tokens: form.value.max_output_tokens
            ? Number(form.value.max_output_tokens)
            : null,
        models: form.value.models.filter((m) => m.enabled !== false),
        enabled: form.value.enabled,
        priority: props.provider?.priority ?? 1,
        weight: props.provider?.weight ?? 10,
    } as ProviderItem;

    emit("save", provider);
};

const handleOverlayClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) emit("close");
};

const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && props.visible) emit("close");
};

watch(
    () => props.visible,
    (val) => {
        if (val) {
            window.addEventListener("keydown", handleKeydown);
        } else {
            window.removeEventListener("keydown", handleKeydown);
        }
    }
);
</script>

<style scoped>
/* 不要在这里写 transform，会覆盖 TransitionGroup FLIP 的位移 */
.model-row-item {
    transition:
        opacity 0.18s ease,
        background-color 0.18s ease;
}

.model-row-move {
    transition: transform 0.25s cubic-bezier(0.22, 1, 0.36, 1);
}

.model-row-enter-active {
    transition:
        opacity 0.18s ease,
        transform 0.18s ease;
}

.model-row-leave-active {
    transition:
        opacity 0.15s ease,
        transform 0.15s ease;
    position: absolute;
    width: 100%;
}

.model-row-enter-from {
    opacity: 0;
}

.model-row-leave-to {
    opacity: 0;
}
</style>

<template>
    <Teleport to="body">
        <Transition
            :css="false"
            @enter="modalJelly.onEnter"
            @leave="modalJelly.onLeave"
        >
            <div
                v-if="visible"
                class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
                @click="handleOverlayClick"
            >
                <div class="glass-overlay absolute inset-0"></div>

                <div
                    class="modal-content relative z-1 flex h-[min(700px,88vh)] w-[min(960px,94vw)] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl sm:flex-row"
                    @click.stop
                >
                    <!-- 左侧：标题 + 分组导航 + 删除（窄屏横排） -->
                    <aside
                        class="flex w-full shrink-0 flex-col p-3 sm:w-56 sm:p-3.5"
                    >
                        <div class="hidden sm:block">
                            <p
                                class="select-none px-2.5 text-xl font-bold text-zx-text-strong"
                            >
                                {{ isEditMode ? "配置服务商" : "添加服务商" }}
                            </p>
                            <div
                                class="mt-3 flex items-center gap-2 rounded-2xl bg-[var(--zx-color-surface-muted)] px-2.5 py-2"
                            >
                                <ProviderIcon
                                    :name="form.name"
                                    :api-type="form.api_type"
                                    :icon-key="form.icon"
                                    size-class="h-8 w-8 shrink-0"
                                />
                                <p
                                    class="min-w-0 flex-1 truncate text-sm font-semibold text-zx-text-strong"
                                >
                                    {{ form.name || "未命名服务商" }}
                                </p>
                                <ZxButton
                                    variant="ghost"
                                    circle
                                    size="sm"
                                    title="重命名 / 更换图标"
                                    @click="openNameDialog"
                                >
                                    <Pencil class="h-3.5 w-3.5" />
                                </ZxButton>
                            </div>
                        </div>

                        <p
                            class="px-2.5 pb-2 text-sm font-bold text-zx-text-strong sm:hidden"
                        >
                            {{ isEditMode ? "配置服务商" : "添加服务商" }}
                        </p>

                        <div
                            class="mb-1 flex items-center gap-2 rounded-2xl bg-[var(--zx-color-surface-muted)] px-2.5 py-2 sm:hidden"
                        >
                            <ProviderIcon
                                :name="form.name"
                                :api-type="form.api_type"
                                :icon-key="form.icon"
                                size-class="h-8 w-8 shrink-0"
                            />
                            <p
                                class="min-w-0 flex-1 truncate text-sm font-semibold text-zx-text-strong"
                            >
                                {{ form.name || "未命名服务商" }}
                            </p>
                            <ZxButton
                                variant="ghost"
                                circle
                                size="sm"
                                title="重命名 / 更换图标"
                                @click="openNameDialog"
                            >
                                <Pencil class="h-3.5 w-3.5" />
                            </ZxButton>
                        </div>

                        <nav
                            class="flex flex-1 gap-1 overflow-x-auto sm:mt-4 sm:flex-col sm:overflow-y-auto"
                        >
                            <button
                                v-for="section in sections"
                                :key="section.id"
                                type="button"
                                class="flex shrink-0 cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition-colors"
                                :class="
                                    activeSection === section.id
                                        ? 'bg-zx-primary-tint font-semibold text-zx-primary'
                                        : 'font-medium text-[var(--zx-color-text-muted)] hover:bg-[var(--zx-color-surface-muted)] hover:text-[var(--zx-color-text)]'
                                "
                                @click="goSection(section.id)"
                            >
                                <component
                                    :is="section.icon"
                                    class="h-[17px] w-[17px] shrink-0"
                                />
                                <span>{{ section.label }}</span>
                            </button>
                        </nav>

                        <button
                            v-if="isEditMode"
                            type="button"
                            class="mt-2 flex shrink-0 cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium text-[var(--zx-color-text-muted)] transition-colors hover:bg-zx-danger-soft hover:text-zx-danger sm:mt-3"
                            :disabled="saving"
                            @click="handleDeleteCurrent"
                        >
                            <Trash2 class="h-[17px] w-[17px] shrink-0" />
                            <span>删除服务商</span>
                        </button>
                    </aside>

                    <!-- 右侧：分页内容 + 底栏 -->
                    <div class="flex min-h-0 min-w-0 flex-1 flex-col">
                        <main
                            class="relative min-h-0 flex-1 overflow-y-auto p-5 select-text sm:py-8 sm:pl-10 sm:pr-12"
                        >
                            <button
                                type="button"
                                class="absolute right-4 top-4 z-10 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-[var(--zx-color-text-muted)] transition-colors hover:bg-[var(--zx-color-surface-muted)] hover:text-[var(--zx-color-text)]"
                                @click="emit('close')"
                            >
                                <X class="h-4 w-4" />
                            </button>

                            <!-- 页头 -->
                            <div class="mb-6 pr-10">
                                <h2
                                    class="text-[19px] font-bold text-zx-text-strong"
                                >
                                    {{ activeMeta.label }}
                                </h2>
                            </div>

                            <!-- 基础信息 -->
                            <template v-if="activeSection === 'basics'">
                                <div class="flex flex-col gap-5">
                                    <div
                                        class="flex flex-col gap-1.5"
                                    >
                                        <p
                                            class="text-sm font-semibold text-zx-text-strong"
                                        >
                                            接口基础地址
                                        </p>
                                        <ZXInput
                                            v-model="form.api_base"
                                            rounded="xl"
                                            input-class="font-mono"
                                            placeholder="https://api.deepseek.com"
                                            autocomplete="off"
                                            name="zx-api-base"
                                            id="zx-api-base"
                                        >
                                            <template #suffix>
                                                <button
                                                    type="button"
                                                    class="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-zx-text-subtle transition-colors hover:bg-slate-100 hover:text-zx-text"
                                                    title="选择服务商预设"
                                                    @click="openProviderPicker"
                                                >
                                                    <Library class="h-3.5 w-3.5" />
                                                </button>
                                            </template>
                                        </ZXInput>
                                    </div>

                                    <div
                                        class="flex flex-col gap-1.5"
                                    >
                                        <p
                                            class="text-sm font-semibold text-zx-text-strong"
                                        >
                                            API 格式
                                        </p>
                                        <ZXSelect
                                            v-model="form.api_type"
                                            class="w-full"
                                            :options="apiFormatOptions"
                                            placeholder="选择 API 格式"
                                            trigger-class="flex h-9 w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-zx-text transition-colors hover:border-zx-primary"
                                        >
                                            <template #trigger>
                                                <span
                                                    class="min-w-0 flex-1 truncate text-left"
                                                >
                                                    {{ apiFormatDisplay }}
                                                </span>
                                                <ChevronDown
                                                    class="h-4 w-4 shrink-0 text-zx-text-muted"
                                                />
                                            </template>
                                        </ZXSelect>
                                    </div>

                                    <div
                                        class="flex flex-col gap-1.5"
                                    >
                                        <p
                                            class="text-sm font-semibold text-zx-text-strong"
                                        >
                                            API 密钥
                                            <span class="text-zx-danger">*</span>
                                        </p>
                                        <ZXInput
                                            v-model="form.api_key_str"
                                            type="password"
                                            rounded="xl"
                                            input-class="font-mono"
                                            placeholder="sk-..."
                                            autocomplete="new-password"
                                            name="zx-api-secret"
                                            id="zx-api-secret"
                                        />
                                    </div>

                                    <div
                                        class="flex flex-col gap-1.5"
                                    >
                                        <div
                                            class="flex flex-wrap items-center justify-between gap-2"
                                        >
                                            <p
                                                class="text-sm font-semibold text-zx-text-strong"
                                            >
                                                模型列表
                                            </p>
                                            <div class="flex items-center gap-2">
                                                <ZxButton
                                                    v-if="matchedOnlineProvider"
                                                    variant="outline"
                                                    size="sm"
                                                    @click="syncModelsFromOnline"
                                                >
                                                    <Sparkles
                                                        class="mr-1 h-3.5 w-3.5"
                                                    />
                                                    补齐最新模型
                                                </ZxButton>
                                                <ZxButton
                                                    variant="outline"
                                                    size="xs"
                                                    title="从 models.dev 更新在线模型库"
                                                    :loading="refreshingModelsDev"
                                                    @click="refreshModelsDev"
                                                >
                                                    <RefreshCw class="mr-0.5 h-3 w-3" />
                                                    更新模型库
                                                </ZxButton>
                                                <ZxButton
                                                    variant="primary"
                                                    size="xs"
                                                    @click="openAddModel"
                                                >
                                                    <Plus class="mr-0.5 h-3 w-3" />
                                                    添加
                                                </ZxButton>
                                            </div>
                                        </div>

                                        <div
                                            class="max-h-48 overflow-y-auto overflow-x-hidden rounded-2xl border border-slate-200"
                                        >
                                            <div
                                                v-if="!form.models.length"
                                                class="px-4"
                                            >
                                                <ZxEmptyState
                                                    size="sm"
                                                    text="尚未添加模型"
                                                    sub-text="点击右上角「添加」配置模型"
                                                />
                                            </div>

                                            <div
                                                v-else
                                                class="divide-y divide-slate-100"
                                                :class="
                                                    isDraggingModel
                                                        ? 'is-dragging'
                                                        : ''
                                                "
                                            >
                                                <TransitionGroup name="model-row">
                                                    <div
                                                        v-for="(model, idx) in form.models"
                                                        :key="model.model_name"
                                                        class="model-row-item flex items-center gap-2 px-3 py-2"
                                                        :class="
                                                            dragModelIndex === idx
                                                                ? 'opacity-40'
                                                                : ''
                                                        "
                                                        draggable="true"
                                                        @dragstart="
                                                            onModelDragStart(idx, $event)
                                                        "
                                                        @dragenter="onModelDragEnter(idx, $event)"
                                                        @dragover="onModelDragOver"
                                                        @drop="onModelDrop"
                                                        @dragend="onModelDragEnd"
                                                    >
                                                    <span
                                                        class="flex h-7 w-5 shrink-0 cursor-grab items-center justify-center text-zx-text-subtle active:cursor-grabbing"
                                                        title="拖动调整顺序"
                                                    >
                                                        <GripVertical class="h-3.5 w-3.5" />
                                                    </span>
                                                    <div class="min-w-0 flex-1">
                                                        <p
                                                            class="truncate font-mono text-sm font-semibold text-zx-text-strong"
                                                        >
                                                            {{
                                                                model.model_name
                                                            }}
                                                        </p>
                                                    </div>

                                                    <div
                                                        class="flex shrink-0 items-center gap-1.5"
                                                    >
                                                        <ZxTag
                                                            v-if="
                                                                modelTestState[
                                                                    model
                                                                        .model_name
                                                                ]?.loading ===
                                                                false
                                                            "
                                                            :variant="
                                                                modelTestState[
                                                                    model
                                                                        .model_name
                                                                ]?.success
                                                                    ? 'success'
                                                                    : 'danger'
                                                            "
                                                        >
                                                            {{
                                                                modelTestState[
                                                                    model
                                                                        .model_name
                                                                ]?.success
                                                                    ? modelTestState[
                                                                          model
                                                                              .model_name
                                                                      ]
                                                                          ?.latency_ms !=
                                                                      null
                                                                        ? `${modelTestState[model.model_name].latency_ms}ms`
                                                                        : "OK"
                                                                    : `${modelTestState[model.model_name]?.message || "ERR"} 失败`
                                                            }}
                                                        </ZxTag>
                                                        <ZxButton
                                                            variant="ghost"
                                                            circle
                                                            size="sm"
                                                            title="测试此模型连通性"
                                                            :disabled="
                                                                modelTestState[
                                                                    model
                                                                        .model_name
                                                                ]?.loading
                                                            "
                                                            @click="
                                                                handleTestModel(
                                                                    model.model_name
                                                                )
                                                            "
                                                        >
                                                            <Loader2
                                                                v-if="
                                                                    modelTestState[
                                                                        model
                                                                            .model_name
                                                                    ]?.loading
                                                                "
                                                                class="h-3.5 w-3.5 animate-spin text-zx-primary"
                                                            />
                                                            <Plug
                                                                v-else
                                                                class="h-3.5 w-3.5"
                                                            />
                                                        </ZxButton>
                                                        <ZxButton
                                                            variant="ghost"
                                                            circle
                                                            size="sm"
                                                            title="配置模型"
                                                            @click="
                                                                openEditModel(idx)
                                                            "
                                                        >
                                                            <Pencil class="h-3.5 w-3.5" />
                                                        </ZxButton>
                                                        <ZxButton
                                                            variant="ghost"
                                                            circle
                                                            size="sm"
                                                            title="移除模型"
                                                            @click="
                                                                removeModel(idx)
                                                            "
                                                        >
                                                            <X
                                                                class="h-3.5 w-3.5"
                                                            />
                                                        </ZxButton>
                                                        <ZxSwitch
                                                            :model-value="
                                                                model.enabled !==
                                                                false
                                                            "
                                                            title="关闭后不写入配置"
                                                            @update:model-value="
                                                                (v: boolean) =>
                                                                    (model.enabled =
                                                                        v)
                                                            "
                                                        />
                                                    </div>
                                                    </div>
                                                </TransitionGroup>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </template>

                            <!-- 调用参数 -->
                            <template v-else-if="activeSection === 'params'">
                                <div class="flex flex-col gap-5">
                                    <div
                                        class="flex flex-col gap-1.5"
                                    >
                                        <p
                                            class="text-sm font-semibold text-zx-text-strong"
                                        >
                                            超时时间（秒）
                                        </p>
                                        <div class="max-w-xs">
                                            <ZXInput
                                                :model-value="
                                                    form.timeout == null
                                                        ? ''
                                                        : String(form.timeout)
                                                "
                                                rounded="xl"
                                                input-class="font-mono"
                                                placeholder="180"
                                                @update:model-value="
                                                    (v: string | number) =>
                                                        (form.timeout =
                                                            Number(v) || 0)
                                                "
                                            />
                                        </div>
                                    </div>

                                    <div
                                        class="flex flex-col gap-1.5"
                                    >
                                        <p
                                            class="text-sm font-semibold text-zx-text-strong"
                                        >
                                            默认采样温度
                                        </p>
                                        <div class="max-w-xs">
                                            <ZXInput
                                                :model-value="
                                                    form.temperature == null
                                                        ? ''
                                                        : String(form.temperature)
                                                "
                                                rounded="xl"
                                                input-class="font-mono"
                                                placeholder="例如 0.7"
                                                @update:model-value="
                                                    (v: string | number) =>
                                                        (form.temperature =
                                                            v === '' ||
                                                            v == null
                                                                ? null
                                                                : Number(v))
                                                "
                                            />
                                        </div>
                                    </div>

                                    <div
                                        class="flex flex-col gap-1.5"
                                    >
                                        <p
                                            class="text-sm font-semibold text-zx-text-strong"
                                        >
                                            最大输出 Token
                                        </p>
                                        <div class="max-w-xs">
                                            <ZXInput
                                                :model-value="
                                                    form.max_output_tokens == null
                                                        ? ''
                                                        : String(
                                                              form.max_output_tokens
                                                          )
                                                "
                                                rounded="xl"
                                                input-class="font-mono"
                                                placeholder="不限制"
                                                @update:model-value="
                                                    (v: string | number) =>
                                                        (form.max_output_tokens =
                                                            v === '' ||
                                                            v == null
                                                                ? null
                                                                : Number(v))
                                                "
                                            />
                                        </div>
                                    </div>
                                </div>
                            </template>
                        </main>

                        <!-- 底部操作栏 -->
                        <div
                            class="flex shrink-0 items-center justify-end gap-2.5 border-t border-slate-100 bg-slate-50/50 px-5 py-3.5 sm:px-8"
                        >
                            <ZxButton
                                variant="ghost"
                                size="md"
                                :disabled="saving"
                                @click="emit('close')"
                            >
                                取消
                            </ZxButton>
                            <ZxButton
                                variant="primary"
                                size="md"
                                :loading="saving"
                                :disabled="!form.name.trim() || saving"
                                @click="handleSave"
                            >
                                <Check class="mr-1 h-3.5 w-3.5" />
                                保存配置
                            </ZxButton>
                        </div>
                    </div>
                </div>
            </div>
        </Transition>

        <!-- 添加模型 -->
        <ZxModal
            v-model="showAddModel"
            :title="editingModelIndex >= 0 ? '配置模型' : '添加模型'"
            size="md"
            width="max-w-xl"
            :closable="true"
            body-class="!p-0"
        >
            <div class="relative flex flex-col gap-3 px-5 py-4">
                <!-- 模型 ID + 搜索 -->
                <div class="flex flex-col gap-1">
                    <p class="text-xs text-zx-text-strong">模型 ID</p>
                    <ZXInput
                        v-model="addModelForm.model_name"
                        rounded="xl"
                        size="sm"
                        placeholder="输入或搜索模型 ID"
                        input-class="font-mono"
                        @blur="smartFillFromModelsDev"
                    >
                        <template #suffix>
                            <button
                                type="button"
                                class="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-zx-text-subtle transition-colors hover:bg-slate-100 hover:text-zx-text"
                                title="从 models.dev 搜索模型"
                                @click="openModelSearch"
                            >
                                <Search class="h-3.5 w-3.5" />
                            </button>
                        </template>
                    </ZXInput>
                </div>

                <!-- 上下文窗口 / 最大输出 Token -->
                <div class="grid grid-cols-2 gap-3">
                    <div class="flex flex-col gap-1">
                        <ZXInput
                            v-model="addModelForm.context_limit"
                            rounded="xl"
                            size="sm"
                            input-class="font-mono"
                            placeholder="上下文窗口，如 128000"
                        />
                    </div>

                    <div class="flex flex-col gap-1">
                        <p class="text-xs text-zx-text-strong">最大输出 Token</p>
                        <ZXInput
                            v-model="addModelForm.max_output_tokens"
                            rounded="xl"
                            size="sm"
                            input-class="font-mono"
                            placeholder="输出上限，如 8192"
                        />
                    </div>
                </div>

                <!-- 推理等级 -->
                <div class="flex flex-col gap-1">
                    <p class="text-xs text-zx-text-strong">推理等级</p>
                    <div
                        class="flex min-h-9 flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 transition-colors focus-within:border-zx-primary hover:border-zx-primary"
                    >
                        <span
                            v-for="(level, idx) in addModelForm.reasoning_levels"
                            :key="`${level}-${idx}`"
                            class="flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs text-zx-text"
                        >
                            {{ level }}
                            <button
                                type="button"
                                class="cursor-pointer text-zx-text-subtle hover:text-zx-danger"
                                @click="removeReasoningLevel(idx)"
                            >
                                <X class="h-3 w-3" />
                            </button>
                        </span>
                        <input
                            v-model="reasoningLevelInput"
                            class="min-w-[8rem] flex-1 bg-transparent text-sm text-zx-text outline-none placeholder:text-zx-text-subtle"
                            placeholder="输入档位后按 Enter，如 low、high、max"
                            @keydown.enter.prevent="commitReasoningLevel"
                            @keydown.backspace="
                                !reasoningLevelInput &&
                                    addModelForm.reasoning_levels.length &&
                                    removeReasoningLevel(
                                        addModelForm.reasoning_levels.length - 1
                                    )
                            "
                        />
                    </div>
                </div>
            </div>

            <template #footer>
                <div class="flex w-full items-center justify-between gap-3">
                    <button
                        type="button"
                        class="cursor-pointer text-xs text-zx-text-muted underline underline-offset-4 hover:text-zx-text"
                        @click="resetAddModelForm"
                    >
                        重置表单
                    </button>
                    <div class="flex items-center gap-2">
                        <ZxButton variant="ghost" size="sm" @click="showAddModel = false">
                            取消
                        </ZxButton>
                        <ZxButton
                            size="sm"
                            :disabled="!addModelForm.model_name.trim()"
                            @click="handleAddModel"
                        >
                            保存
                        </ZxButton>
                    </div>
                </div>
            </template>
        </ZxModal>

        <!-- 服务商预设 / models.dev 选择 -->
        <ZxModal
            v-model="showProviderPicker"
            title="服务商预设"
            size="lg"
            width="max-w-2xl"
            :closable="true"
        >
            <div class="flex flex-col gap-4">
                <!-- 常用预设：自定义优先 -->
                <div class="flex flex-col gap-2">
                    <p class="text-sm font-semibold text-zx-text-strong">
                        常用预设
                    </p>
                    <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <button
                            v-for="preset in PRESETS"
                            :key="preset.name"
                            type="button"
                            class="btn-touch flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-left transition-colors hover:border-zx-primary hover:bg-zx-primary-soft"
                            @click="applyPreset(preset)"
                        >
                            <ProviderIcon
                                :name="preset.name"
                                :api-type="preset.api_type"
                                size-class="h-7 w-7"
                            />
                            <div class="min-w-0 flex-1">
                                <p
                                    class="truncate text-sm font-semibold text-zx-text-strong"
                                >
                                    {{ preset.label }}
                                </p>
                                <p
                                    class="truncate font-mono text-[11px] text-zx-text-subtle"
                                >
                                    {{ preset.api_base || "自定义端点" }}
                                </p>
                            </div>
                        </button>
                    </div>
                </div>

                <!-- models.dev -->
                <div class="flex flex-col gap-2">
                    <div
                        class="flex flex-wrap items-center justify-between gap-2"
                    >
                        <p class="text-sm font-semibold text-zx-text-strong">
                            从 models.dev 选择
                        </p>
                        <ZxButton
                            variant="outline"
                            size="sm"
                            :loading="refreshingModelsDev || loadingModelsDev"
                            @click="refreshModelsDev"
                        >
                            <RefreshCw class="mr-1 h-3.5 w-3.5" />
                            更新目录
                        </ZxButton>
                    </div>

                    <ZXInput
                        v-model="modelsDevSearch"
                        type="search"
                        placeholder="搜索服务商..."
                    />

                    <div
                        v-if="loadingModelsDev"
                        class="flex items-center justify-center gap-2 py-8 text-zx-text-muted"
                    >
                        <Loader2 class="h-4 w-4 animate-spin text-zx-primary" />
                        <span class="text-xs">正在加载 models.dev...</span>
                    </div>

                    <ZxEmptyState
                        v-else-if="!filteredModelsDevProviders.length"
                        size="sm"
                        :icon="Globe"
                        text="未找到服务商"
                        sub-text="可点击「更新目录」拉取最新列表"
                    />

                    <div
                        v-else
                        class="max-h-72 overflow-y-auto rounded-2xl border border-slate-200"
                    >
                        <button
                            v-for="p in filteredModelsDevProviders"
                            :key="p.id"
                            type="button"
                            class="flex w-full cursor-pointer items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-[var(--zx-color-surface-muted)]"
                            @click="applyModelsDevProvider(p)"
                        >
                            <ProviderIcon
                                :name="p.name"
                                :api-type="p.api_type"
                                size-class="h-7 w-7"
                            />
                            <div class="min-w-0 flex-1">
                                <p
                                    class="truncate text-sm font-semibold text-zx-text-strong"
                                >
                                    {{ p.name }}
                                </p>
                                <p
                                    class="truncate font-mono text-[11px] text-zx-text-muted"
                                >
                                    {{ p.api_base || "官方默认端点" }}
                                </p>
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        </ZxModal>

        <!-- 模型搜索弹窗 -->
        <ZxModal
            v-model="showModelSearch"
            title="搜索模型"
            size="md"
            width="max-w-lg"
            :closable="true"
        >
            <ZXInput
                v-model="modelSearchQuery"
                type="search"
                rounded="xl"
                size="sm"
                placeholder="搜索 models.dev 模型..."
                autofocus
            />

            <div
                v-if="loadingModelsDev"
                class="flex items-center justify-center gap-2 py-8 text-zx-text-muted"
            >
                <Loader2 class="h-4 w-4 animate-spin text-zx-primary" />
                <span class="text-xs">加载中...</span>
            </div>

            <div v-else-if="!filteredModelsDevModels.length" class="py-6">
                <ZxEmptyState size="sm" text="未找到匹配模型" />
            </div>

            <div
                v-else
                class="mt-3 max-h-72 overflow-y-auto rounded-2xl border border-slate-200"
            >
                <button
                    v-for="m in filteredModelsDevModels"
                    :key="`${m.provider_id}/${m.id}`"
                    type="button"
                    class="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--zx-color-surface-muted)]"
                    @click="applyModelFromDev(m)"
                >
                    <div class="min-w-0 flex-1">
                        <p
                            class="truncate font-mono text-xs font-semibold text-zx-text-strong"
                        >
                            {{ m.id }}
                        </p>
                        <p class="truncate text-[11px] text-zx-text-subtle">
                            {{ m.provider }}
                            <span v-if="m.context_limit">
                                · {{ m.context_limit }}
                            </span>
                        </p>
                    </div>
                    <Check
                        v-if="addModelForm.model_name === m.id"
                        class="h-3.5 w-3.5 shrink-0 text-zx-primary"
                    />
                </button>
            </div>
        </ZxModal>

        <!-- 重命名 / 更换图标 -->
        <ZxModal
            v-model="showNameDialog"
            title="重命名服务商"
            size="md"
            width="max-w-lg"
            :closable="true"
        >
            <div class="flex flex-col gap-4">
                <div class="flex flex-col gap-1">
                    <p class="text-xs text-zx-text-strong">名称</p>
                    <ZXInput
                        v-model="nameDraft"
                        rounded="xl"
                        size="sm"
                        placeholder="服务商名称"
                        @keydown.enter.prevent="confirmNameDialog"
                    />
                </div>

                <div class="flex flex-col gap-2">
                    <p class="text-xs text-zx-text-strong">图标</p>
                    <div
                        class="grid max-h-64 grid-cols-6 gap-2 overflow-y-auto rounded-2xl border border-slate-200 p-2"
                    >
                        <button
                            v-for="key in PROVIDER_ICON_KEYS"
                            :key="key"
                            type="button"
                            class="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border transition-colors"
                            :class="
                                iconDraft === key
                                    ? 'border-zx-primary bg-zx-primary-soft'
                                    : 'border-slate-200 hover:border-zx-primary'
                            "
                            :title="key"
                            @click="iconDraft = key"
                        >
                            <ProviderIcon
                                :icon-key="key"
                                :name="key"
                                size-class="h-7 w-7"
                            />
                        </button>
                    </div>
                    <button
                        type="button"
                        class="self-start text-xs text-zx-text-muted underline underline-offset-4 hover:text-zx-text"
                        @click="iconDraft = ''"
                    >
                        跟随名称自动匹配
                    </button>
                </div>
            </div>

            <template #footer>
                <ZxButton variant="ghost" size="sm" @click="showNameDialog = false">
                    取消
                </ZxButton>
                <ZxButton size="sm" @click="confirmNameDialog">
                    <Check class="mr-1 h-3.5 w-3.5" />
                    确定
                </ZxButton>
            </template>
        </ZxModal>
    </Teleport>
</template>
