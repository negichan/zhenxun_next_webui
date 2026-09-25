<script setup lang="ts">
import { ref } from "vue";
import {
    Compass,
    Layers,
    MessageSquare,
    FileText,
    Mic,
    Image as ImageIcon,
    SlidersHorizontal,
    Plus,
    Trash2,
    X,
} from "lucide-vue-next";
import ZxButton from "@/components/zxcomponent/ZxButton.vue";
import ZxEmptyState from "@/components/zxcomponent/ZxEmptyState.vue";
import ZxTag from "@/components/zxcomponent/ZxTag.vue";
import type { DefaultModelsItem } from "@/types/ai.types";

interface Props {
    defaultModels: DefaultModelsItem;
    modelGroups: Record<string, string[]>;
    availableModels: string[];
}

const props = defineProps<Props>();
const emit = defineEmits<{
    (e: "update:defaultModels", val: DefaultModelsItem): void;
    (e: "update:modelGroups", val: Record<string, string[]>): void;
}>();

const newGroupName = ref("");
const showAddGroup = ref(false);

const newGroupModelInputs = ref<Record<string, string>>({});

// 任务类型配置列表
const TASKS = [
    {
        key: "chat" as const,
        label: "对话任务 (Chat)",
        icon: MessageSquare,
        desc: "大模型普通日常对话、智能体反思与通用推理默认选用的模型",
        placeholder: "例如 Gemini/gemini-3.5-flash 或 cheap_models",
    },
    {
        key: "embedding" as const,
        label: "向量嵌入 (Embedding)",
        icon: FileText,
        desc: "知识库检索、多模态语义搜索向量化使用的默认模型",
        placeholder: "例如 Gemini/gemini-embedding-2 或 siliconflow/BAAI/bge-m3",
    },
    {
        key: "tts" as const,
        label: "文本转语音 (TTS)",
        icon: Mic,
        desc: "大模型语音合成与拟真语音输出默认模型",
        placeholder: "例如 Gemini/gemini-3.1-flash-tts-preview 或 MiMo/mimo-v2.5-tts",
    },
    {
        key: "image" as const,
        label: "图像生成 (Image)",
        icon: ImageIcon,
        desc: "文生图、图像编辑等多模态视觉生成任务默认模型",
        placeholder: "例如 Gemini/gemini-2.5-flash-image",
    },
    {
        key: "rerank" as const,
        label: "语义重排 (Rerank)",
        icon: SlidersHorizontal,
        desc: "RAG 检索增强后文档召回二次重排序专用模型",
        placeholder: "例如 siliconflow/BAAI/bge-reranker-v2-m3",
    },
];

const handleCreateGroup = () => {
    const name = newGroupName.value.trim();
    if (!name) return;
    if (props.modelGroups[name]) return;
    props.modelGroups[name] = [];
    newGroupName.value = "";
    showAddGroup.value = false;
};

const handleDeleteGroup = (groupName: string) => {
    delete props.modelGroups[groupName];
};

const handleAddModelToGroup = (groupName: string) => {
    const model = (newGroupModelInputs.value[groupName] || "").trim();
    if (!model) return;
    if (!props.modelGroups[groupName].includes(model)) {
        props.modelGroups[groupName].push(model);
    }
    newGroupModelInputs.value[groupName] = "";
};

const handleRemoveModelFromGroup = (groupName: string, idx: number) => {
    props.modelGroups[groupName].splice(idx, 1);
};
</script>

<template>
    <div class="space-y-6">
        <!-- 任务分类默认模型路由卡片 -->
        <div
            class="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-5"
        >
            <div class="flex items-center gap-2.5 border-b border-slate-100 pb-3.5">
                <Compass class="h-5 w-5 text-zx-primary" />
                <div>
                    <h3 class="text-base font-bold text-zx-text-strong">
                        任务默认模型路由 (Default Models)
                    </h3>
                    <p class="text-xs text-zx-text-muted mt-0.5">
                        按任务场景指定默认调用的大模型（支持填写 单个模型 或 虚拟路由组名）
                    </p>
                </div>
            </div>

            <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div
                    v-for="task in TASKS"
                    :key="task.key"
                    class="flex flex-col gap-2 rounded-2xl border border-slate-100 bg-slate-50/50 p-4 transition hover:border-slate-300 hover:bg-white"
                >
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                            <component :is="task.icon" class="h-4 w-4 text-zx-primary" />
                            <span class="font-semibold text-xs text-zx-text-strong">
                                {{ task.label }}
                            </span>
                        </div>
                    </div>

                    <p class="text-[11px] text-zx-text-subtle">
                        {{ task.desc }}
                    </p>

                    <!-- 模型输入框 + 快捷选单 datalist -->
                    <div class="mt-1">
                        <ZXInput
                            v-model="defaultModels[task.key]"
                            :list="`models-list-${task.key}`"
                            :placeholder="task.placeholder"
                            rounded="xl"
                            size="sm"
                            input-class="font-mono"
                        />
                        <datalist :id="`models-list-${task.key}`">
                            <option
                                v-for="m in availableModels"
                                :key="m"
                                :value="m"
                            />
                            <option
                                v-for="gName in Object.keys(modelGroups)"
                                :key="gName"
                                :value="gName"
                            />
                        </datalist>
                    </div>
                </div>
            </div>
        </div>

        <!-- 虚拟模型路由组卡片 -->
        <div
            class="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-5"
        >
            <div class="flex items-center justify-between border-b border-slate-100 pb-3.5">
                <div class="flex items-center gap-2.5">
                    <Layers class="h-5 w-5 text-zx-primary" />
                    <div>
                        <h3 class="text-base font-bold text-zx-text-strong">
                            虚拟模型路由组 (Virtual Router Groups)
                        </h3>
                        <p class="text-xs text-zx-text-muted mt-0.5">
                            为大模型调用配置备选故障转移或轮询列表，当某个模型不可用时自动顺位重试
                        </p>
                    </div>
                </div>

                <ZxButton
                    variant="ghost"
                    size="sm"
                    @click="showAddGroup = !showAddGroup"
                >
                    <Plus class="h-4 w-4 mr-1" />
                    新建路由组
                </ZxButton>
            </div>

            <!-- 新建路由组抽屉/条目 -->
            <div
                v-if="showAddGroup"
                class="flex items-center gap-2 rounded-2xl border border-dashed border-zx-primary/40 bg-zx-primary-soft/20 p-3"
            >
                <ZXInput
                    v-model="newGroupName"
                    placeholder="输入路由组标识 (如 cheap_models, fast_models)"
                    rounded="xl"
                    size="sm"
                    class="flex-1"
                    @keydown.enter.prevent="handleCreateGroup"
                />
                <ZxButton variant="primary" size="sm" @click="handleCreateGroup">
                    创建
                </ZxButton>
                <ZxButton variant="ghost" size="sm" @click="showAddGroup = false">
                    取消
                </ZxButton>
            </div>

            <!-- 路由组列表 -->
            <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div
                    v-for="(models, groupName) in modelGroups"
                    :key="groupName"
                    class="flex flex-col justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/50 p-4"
                >
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                            <span class="font-bold text-xs font-mono text-zx-text-strong">
                                {{ groupName }}
                            </span>
                            <ZxTag variant="info">
                                {{ models.length }} 个模型
                            </ZxTag>
                        </div>
                        <ZxButton
                            variant="danger"
                            size="sm"
                            circle
                            title="删除该路由组"
                            @click="handleDeleteGroup(groupName)"
                        >
                            <Trash2 class="h-3.5 w-3.5" />
                        </ZxButton>
                    </div>

                    <!-- 模型顺序列表 -->
                    <div class="flex flex-wrap gap-1.5 min-h-[38px] p-2 bg-white rounded-xl border border-slate-100">
                        <div
                            v-for="(m, idx) in models"
                            :key="m"
                            class="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-zx-text font-mono"
                        >
                            <span class="text-[10px] text-zx-text-subtle font-sans">#{{ idx + 1 }}</span>
                            <span>{{ m }}</span>
                            <button
                                type="button"
                                class="cursor-pointer text-zx-text-subtle hover:text-zx-danger ml-1"
                                @click="handleRemoveModelFromGroup(groupName, idx)"
                            >
                                <X class="h-3 w-3" />
                            </button>
                        </div>
                        <ZxEmptyState
                            v-if="!models.length"
                            class="w-full"
                            size="sm"
                            text="暂无模型，请在下方添加"
                        />
                    </div>

                    <!-- 添加模型到组 -->
                    <div class="flex items-center gap-2 pt-1 border-t border-slate-100">
                        <ZXInput
                            v-model="newGroupModelInputs[groupName]"
                            :list="`available-list-${groupName}`"
                            placeholder="选择或输入 Provider/ModelName"
                            rounded="xl"
                            size="sm"
                            input-class="font-mono"
                            class="flex-1"
                            @keydown.enter.prevent="handleAddModelToGroup(groupName)"
                        />
                        <datalist :id="`available-list-${groupName}`">
                            <option
                                v-for="avail in availableModels"
                                :key="avail"
                                :value="avail"
                            />
                        </datalist>
                        <ZxButton
                            variant="ghost"
                            size="sm"
                            @click="handleAddModelToGroup(groupName)"
                        >
                            <Plus class="h-3.5 w-3.5 mr-0.5" /> 加入组
                        </ZxButton>
                    </div>
                </div>

                <div
                    v-if="!Object.keys(modelGroups).length"
                    class="col-span-full rounded-2xl border border-dashed border-slate-200 py-8 text-center text-xs text-zx-text-subtle"
                >
                    尚未配置虚拟模型路由组，可点击右上角新建路由组
                </div>
            </div>
        </div>
    </div>
</template>
