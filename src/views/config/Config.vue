<script setup lang="ts">
import { computed, onActivated, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useGlobalStore } from "@/store/global";
import {
    Bot,
    Compass,
    FlaskConical,
    Plus,
    RefreshCw,
    Save,
    Server,
    Sparkles,
} from "lucide-vue-next";
import ZXInput from "@/components/zxcomponent/ZXInput.vue";
import ZxButton from "@/components/zxcomponent/ZxButton.vue";
import ZxEmptyState from "@/components/zxcomponent/ZxEmptyState.vue";
import { ZXMessageBox } from "@/services/ui";
import { useAiStore } from "@/store/ai";
import { storeToRefs } from "pinia";
import { aiApi } from "@/utils/api-next";
import type { ProviderItem } from "@/types/ai.types";

import ProviderCard from "./components/ProviderCard.vue";
import ProviderEditModal from "./components/ProviderEditModal.vue";
import DefaultRoutesTab from "./components/DefaultRoutesTab.vue";
import ContextSettingsTab from "./components/ContextSettingsTab.vue";
import EngineSettingsTab from "./components/EngineSettingsTab.vue";
import ExperimentalProtocolTab from "./components/ExperimentalProtocolTab.vue";
import EnvConfigView from "./components/EnvConfigView.vue";

const globalStore = useGlobalStore();
const route = useRoute();

// 主选项卡：大模型配置 (ai) 或 环境配置 (env)
const activeTab = computed(() => (route.query.tab === "env" ? "env" : "ai"));

// 大模型配置内部子选项卡
type AiTabType = "providers" | "routes" | "context" | "engine" | "protocols";
const currentAiTab = ref<AiTabType>("providers");

// 所有大模型配置子选项卡
const ALL_AI_TABS = [
    { id: "providers" as const, label: "服务提供商", icon: Server },
    { id: "routes" as const, label: "任务默认路由", icon: Compass },
    { id: "context" as const, label: "对话上下文压缩", icon: Sparkles },
    { id: "engine" as const, label: "智能体与引擎", icon: Bot },
    { id: "protocols" as const, label: "协议与劫持", icon: FlaskConical },
];

// 实验性功能未开启时仅展示“服务提供商”；在设置中开启实验性功能后解锁全部进阶选项卡
const aiTabs = computed(() => {
    if (globalStore.experimentalFeaturesEnabled) {
        return ALL_AI_TABS;
    }
    return ALL_AI_TABS.filter((tab) => tab.id === "providers");
});

// 若关闭实验性功能时停留在进阶子选项卡，自动回退至“服务提供商”
watch(
    () => globalStore.experimentalFeaturesEnabled,
    (enabled) => {
        if (!enabled && currentAiTab.value !== "providers") {
            currentAiTab.value = "providers";
        }
    },
);

watch(
    () => route.query.subtab,
    (subtab) => {
        if (subtab && typeof subtab === "string" && ALL_AI_TABS.some((t) => t.id === subtab)) {
            currentAiTab.value = subtab as AiTabType;
        }
    },
    { immediate: true },
);

// 弹窗状态
const editModalVisible = ref(false);
const editingProvider = ref<ProviderItem | null>(null);

// 搜索与过滤
const providerSearchQuery = ref("");

// 卡片就地测速状态缓存
const cardTestResults = ref<
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

// AI 配置全局 Store
const aiStore = useAiStore();
const { loading, saving, aiConfig, availableModels } = storeToRefs(aiStore);
const { fetchConfig, saveConfig } = aiStore;

// 过滤后的服务商列表
const filteredProviders = computed(() => {
    const q = providerSearchQuery.value.trim().toLowerCase();
    if (!q) return aiConfig.value.providers;
    return aiConfig.value.providers.filter(
        (p) =>
            p.name.toLowerCase().includes(q) ||
            p.api_type.toLowerCase().includes(q) ||
            p.models.some((m) => m.model_name.toLowerCase().includes(q))
    );
});

// 打开新建服务商弹窗
const openAddProviderModal = () => {
    editingProvider.value = null;
    editModalVisible.value = true;
};

// 打开配置服务商弹窗
const handleConfigureProvider = (provider: ProviderItem) => {
    editingProvider.value = JSON.parse(JSON.stringify(provider));
    editModalVisible.value = true;
};

// 保存提供商变更并直接持久化保存
const handleSaveProvider = async (provider: ProviderItem) => {
    const idx = aiConfig.value.providers.findIndex(
        (p) => p.name.toLowerCase() === provider.name.toLowerCase()
    );
    if (idx >= 0) {
        aiConfig.value.providers[idx] = provider;
    } else {
        aiConfig.value.providers.push(provider);
    }

    const success = await saveConfig();
    if (success) {
        editModalVisible.value = false;
    }
};

// 删除服务商并直接持久化保存
const handleDeleteProvider = (providerName: string) => {
    ZXMessageBox({
        title: "删除服务商",
        message: `确认删除服务提供商 [${providerName}] 吗？该提供商下的所有模型配置也将被移除。`,
        cancelButtonText: "取消",
        confirmButtonText: "确认删除",
        confirmButtonHoverBg: "bg-red-500",
        onConfirm: async () => {
            aiConfig.value.providers = aiConfig.value.providers.filter(
                (p) => p.name !== providerName
            );
            editModalVisible.value = false;
            await saveConfig();
        },
    });
};

// 卡片就地连通性与耗时测速
const handleTestProvider = async (provider: ProviderItem) => {
    if (!provider.models || provider.models.length === 0) {
        return;
    }
    const targetModel = provider.models[0].model_name;
    const fullModelName = `${provider.name}/${targetModel}`;
    cardTestResults.value[provider.name] = { loading: true };
    try {
        const res = await aiApi.testModel(fullModelName);
        if (res.data) {
            cardTestResults.value[provider.name] = {
                loading: false,
                success: res.data.success,
                latency_ms: res.data.latency_ms,
                message: res.data.message,
            };
        }
    } catch (e: any) {
        cardTestResults.value[provider.name] = {
            loading: false,
            success: false,
            message: e?.message || "网络请求异常",
        };
    }
};

// 复制/克隆渠道并直接持久化保存
const handleCloneProvider = async (provider: ProviderItem) => {
    let newName = `${provider.name}_copy`;
    let count = 1;
    while (aiConfig.value.providers.some((p) => p.name.toLowerCase() === newName.toLowerCase())) {
        count++;
        newName = `${provider.name}_copy${count}`;
    }
    const cloned: ProviderItem = JSON.parse(JSON.stringify(provider));
    cloned.name = newName;
    aiConfig.value.providers.push(cloned);
    await saveConfig();
};

onMounted(() => {
    void fetchConfig();
});

onActivated(() => {
    void fetchConfig();
});
</script>

<template>
    <!-- 环境配置页 (.env.dev) -->
    <EnvConfigView v-if="activeTab === 'env'" />

    <!-- 大模型配置页 -->
    <div
        v-else
        class="config-page-root flex h-full min-h-0 w-full flex-col gap-3 sm:gap-4 overflow-hidden select-none"
    >
        <!-- 顶部工具栏与子选项卡导航条 -->
        <div
            class="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 rounded-3xl border border-slate-200 bg-white p-2.5 sm:p-3 shadow-sm shrink-0"
        >
            <!-- 左侧：子选项卡导航（进阶功能开启时展示完整子选项卡） -->
            <div v-if="aiTabs.length > 1" class="flex items-center gap-1 overflow-x-auto p-0.5">
                <button
                    v-for="tab in aiTabs"
                    :key="tab.id"
                    type="button"
                    class="flex items-center gap-1.5 rounded-2xl px-3.5 py-1.5 text-xs font-medium transition-all shrink-0 cursor-pointer"
                    :class="
                        currentAiTab === tab.id
                            ? 'bg-zx-primary text-[color:var(--zx-color-on-primary)] shadow-xs font-bold'
                            : 'text-zx-text-muted hover:bg-slate-100 hover:text-zx-text'
                    "
                    @click="currentAiTab = tab.id"
                >
                    <component :is="tab.icon" class="h-3.5 w-3.5" />
                    <span>{{ tab.label }}</span>
                </button>
            </div>
            <div v-else class="flex items-center gap-2 pl-2">
                <Server class="h-4 w-4 text-zx-primary" />
                <span class="text-sm font-bold text-zx-text-strong">服务提供商</span>
            </div>

            <!-- 右侧：快捷动作与全局控制 -->
            <div class="flex flex-wrap items-center gap-2 pl-1">
                <!-- 针对服务提供商选项卡的专有操作 -->
                <template v-if="currentAiTab === 'providers'">
                    <!-- 搜索框 -->
                    <div class="w-36 sm:w-44">
                        <ZXInput
                            v-model="providerSearchQuery"
                            type="search"
                            size="sm"
                            placeholder="筛选服务商..."
                        />
                    </div>

                    <!-- 添加服务商按钮 -->
                    <ZxButton
                        variant="primary"
                        size="sm"
                        @click="openAddProviderModal"
                    >
                        <Plus class="h-3.5 w-3.5 mr-1" />
                        添加服务商
                    </ZxButton>

                    <div class="hidden sm:block h-4 w-px bg-slate-200 mx-0.5"></div>
                </template>

                <!-- 刷新配置 -->
                <ZxButton
                    variant="ghost"
                    size="sm"
                    circle
                    title="刷新配置"
                    :loading="loading"
                    @click="fetchConfig"
                >
                    <RefreshCw class="h-3.5 w-3.5" />
                </ZxButton>

                <!-- 保存配置（在路由、上下文、智能体等进阶子选项卡中保留） -->
                <ZxButton
                    v-if="currentAiTab !== 'providers'"
                    variant="primary"
                    size="sm"
                    :loading="saving"
                    @click="saveConfig"
                >
                    <Save class="h-3.5 w-3.5 mr-1" />
                    保存配置
                </ZxButton>
            </div>
        </div>

        <!-- 子页面 1：服务提供商卡片网格 -->
        <div
            v-if="currentAiTab === 'providers'"
            class="flex-1 min-h-0 overflow-y-auto px-1.5 pt-2 pb-6"
        >
            <div
                class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4"
            >
                <!-- 已配置的服务商卡片 -->
                <ProviderCard
                    v-for="provider in filteredProviders"
                    :key="provider.name"
                    :provider="provider"
                    :test-result="cardTestResults[provider.name]"
                    @configure="handleConfigureProvider"
                    @delete="handleDeleteProvider"
                    @test="handleTestProvider"
                    @clone="handleCloneProvider"
                />

                <!-- 空状态提示 -->
                <ZxEmptyState
                    v-if="filteredProviders.length === 0"
                    class="col-span-full"
                    size="md"
                    :text="
                        providerSearchQuery
                            ? '未找到匹配的服务提供商'
                            : '暂无已配置的服务提供商，请点击右上角「添加服务商」'
                    "
                />
            </div>
        </div>

        <!-- 子页面 2：任务默认路由 -->
        <div
            v-else-if="currentAiTab === 'routes'"
            class="flex-1 min-h-0 overflow-y-auto px-1.5 pt-2 pb-6"
        >
            <DefaultRoutesTab
                :default-models="aiConfig.default_models"
                :model-groups="aiConfig.model_groups"
                :available-models="availableModels"
            />
        </div>

        <!-- 子页面 3：上下文设置 -->
        <div
            v-else-if="currentAiTab === 'context'"
            class="flex-1 min-h-0 overflow-y-auto px-1.5 pt-2 pb-6"
        >
            <ContextSettingsTab
                :context-settings="aiConfig.context_settings"
                :available-models="availableModels"
            />
        </div>

        <!-- 子页面 4：智能体引擎与底层网络 -->
        <div
            v-else-if="currentAiTab === 'engine'"
            class="flex-1 min-h-0 overflow-y-auto px-1.5 pt-2 pb-6"
        >
            <EngineSettingsTab
                :agent-settings="aiConfig.agent_settings"
                :client-settings="aiConfig.client_settings"
                :debug-log="aiConfig.debug_log"
                :sandbox="aiConfig.sandbox"
                :provider-settings="aiConfig.provider_settings"
            />
        </div>

        <!-- 子页面 5：实验性协议适配与劫持 -->
        <div
            v-else-if="currentAiTab === 'protocols'"
            class="flex-1 min-h-0 overflow-y-auto px-1.5 pt-2 pb-6"
        >
            <ExperimentalProtocolTab />
        </div>

        <!-- 服务商配置弹窗 (点击卡片或“添加服务商”时弹出) -->
        <ProviderEditModal
            :visible="editModalVisible"
            :provider="editingProvider"
            :saving="saving"
            @close="editModalVisible = false"
            @save="handleSaveProvider"
            @delete="handleDeleteProvider"
        />
    </div>
</template>

<style>
/* 压住 Home 胶片带给页面根的 overflow-y:auto，滚动统一交给子选项卡内部面板 */
.config-page-root {
    overflow: hidden !important;
}
</style>
