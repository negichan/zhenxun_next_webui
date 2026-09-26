<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";
import {
    Plus,
    RefreshCw,
    Save,
    SlidersHorizontal,
} from "lucide-vue-next";
import ZXInput from "@/components/zxcomponent/ZXInput.vue";
import ZxButton from "@/components/zxcomponent/ZxButton.vue";
import ZxEmptyState from "@/components/zxcomponent/ZxEmptyState.vue";
import ZXTextEditor from "@/components/ZXTextEditor";
import { ZXMessageBox, ZXNotification } from "@/services/ui";
import { configApi } from "@/utils/api-next";
import {
    isBotTokenOrCredential,
    parseEnvContent,
    serializeEnvEntries,
    type EnvEntry,
} from "../utils/envParser";
import EnvConfigRow from "./EnvConfigRow.vue";
import AddConfigModal from "./AddConfigModal.vue";

// 数据状态
const loading = ref(false);
const saving = ref(false);
const originalRawContent = ref("");
const rawContent = ref("");
const entries = ref<EnvEntry[]>([]);

// 搜索筛选
const searchQuery = ref("");

// 弹窗状态
const addModalVisible = ref(false);

// 循环防抖锁：防止左侧表格与右侧编辑器双向同步死循环
let isSyncingFromEditor = false;
let isSyncingFromTable = false;

// 加载 .env.dev 文件
const loadEnvFile = async () => {
    loading.value = true;
    try {
        const res = await configApi.getEnvFile(".env.dev");
        if (res?.success && res.data) {
            const content = res.data.content || "";
            originalRawContent.value = content;
            rawContent.value = content;
            entries.value = parseEnvContent(content);
        } else {
            ZXNotification({
                title: "读取失败",
                message: res?.message || "未能读取到 .env.dev 配置文件",
                type: "error",
            });
        }
    } catch (error: any) {
        ZXNotification({
            title: "读取异常",
            message: error?.message || "网络异常，未能加载环境变量文件",
            type: "error",
        });
    } finally {
        loading.value = false;
    }
};

// 检查是否有未保存的更改
const isDirty = computed(() => {
    return rawContent.value.trim() !== originalRawContent.value.trim();
});

// 左侧表格更新 -> 驱动右侧 Monaco 编辑器内容
const syncTableToEditor = () => {
    if (isSyncingFromEditor) return;
    isSyncingFromTable = true;
    rawContent.value = serializeEnvEntries(entries.value);
    nextTick(() => {
        isSyncingFromTable = false;
    });
};

// 右侧 Monaco 编辑器输入 -> 驱动左侧表格解析
const handleEditorChange = (newVal: string) => {
    rawContent.value = newVal;
    if (isSyncingFromTable) return;
    isSyncingFromEditor = true;
    try {
        entries.value = parseEnvContent(newVal);
    } catch {
        // 允许用户临时输入半结构化文本，解析错误暂忽略
    }
    nextTick(() => {
        isSyncingFromEditor = false;
    });
};

// 保存配置
const handleSave = async () => {
    saving.value = true;
    try {
        const contentToSave = rawContent.value;

        const res = await configApi.saveEnvFile({
            name: ".env.dev",
            content: contentToSave,
        });

        if (res?.success) {
            originalRawContent.value = contentToSave;
            entries.value = parseEnvContent(contentToSave);

            ZXNotification({
                title: "保存成功",
                message: ".env.dev 配置文件已更新。部分配置需重启 Bot 进程生效。",
                type: "success",
            });
        } else {
            ZXNotification({
                title: "保存失败",
                message: res?.message || "未能保存 .env.dev 文件",
                type: "error",
            });
        }
    } catch (error: any) {
        ZXNotification({
            title: "保存异常",
            message: error?.message || "网络异常，保存失败",
            type: "error",
        });
    } finally {
        saving.value = false;
    }
};

// 刷新配置（带未保存防丢确认）
const handleRefresh = async () => {
    if (isDirty.value) {
        const ok = await ZXMessageBox({
            title: "放弃未保存修改？",
            message: "当前有未保存的配置更改，刷新将重新从后端拉取文件并覆盖本地修改。",
            type: "warning",
            confirmButtonText: "确认刷新",
            cancelButtonText: "取消",
        });
        if (!ok) return;
    }
    await loadEnvFile();
};

// 添加新配置项
const handleAddConfig = (newEntry: {
    key: string;
    value: string;
    comment: string;
}) => {
    const entry: EnvEntry = {
        id: `${newEntry.key}_${Date.now()}`,
        key: newEntry.key,
        value: newEntry.value,
        comment: newEntry.comment,
        type: "string",
        isSecret: isBotTokenOrCredential({
            id: "",
            key: newEntry.key,
            value: newEntry.value,
            comment: "",
            type: "string",
            isSecret: false,
            isMultiLine: false,
        }),
        isMultiLine: newEntry.value.includes("\n"),
    };
    entries.value.unshift(entry);
    syncTableToEditor();
    ZXNotification({
        title: "配置已添加",
        message: `已新增配置「${newEntry.key}」，记得保存写入磁盘`,
        type: "success",
    });
};

// 删除配置项
const handleDeleteEntry = (id: string) => {
    entries.value = entries.value.filter((e) => e.id !== id);
    syncTableToEditor();
};

// 更新配置项值
const handleUpdateValue = (id: string, newVal: string) => {
    const target = entries.value.find((e) => e.id === id);
    if (target) {
        target.value = newVal;
        syncTableToEditor();
    }
};

// 更新配置项说明注释
const handleUpdateComment = (id: string, newComment: string) => {
    const target = entries.value.find((e) => e.id === id);
    if (target) {
        target.comment = newComment;
        syncTableToEditor();
    }
};

// 过滤后的列表
const filteredEntries = computed(() => {
    const q = searchQuery.value.trim().toLowerCase();
    if (!q) return entries.value;
    return entries.value.filter(
        (e) =>
            e.key.toLowerCase().includes(q) ||
            e.value.toLowerCase().includes(q) ||
            e.comment.toLowerCase().includes(q),
    );
});

// 已存在的键集合（供查重）
const existingKeys = computed(() => entries.value.map((e) => e.key));

onMounted(() => {
    loadEnvFile();
});
</script>

<template>
    <div
        class="config-page-root flex h-full min-h-0 w-full flex-col gap-3 sm:gap-4 overflow-hidden select-none"
    >
        <!-- 最上面的头：环境配置图标 + 环境配置标题 + 搜索/操作栏 -->
        <div
            class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-3xl border border-slate-200 bg-white p-2.5 sm:p-3 shadow-sm shrink-0"
        >
            <!-- 左侧：图标 + 标题（对齐大模型配置风格） -->
            <div class="flex items-center gap-2 pl-2 min-w-0">
                <SlidersHorizontal class="h-4 w-4 text-zx-primary shrink-0" />
                <span class="text-sm font-bold text-zx-text-strong tracking-tight shrink-0">
                    环境配置
                </span>
            </div>

            <!-- 右侧：搜索 + 添加配置 + 刷新 -->
            <div class="flex flex-wrap items-center gap-2 pl-1">
                <!-- 搜索框 -->
                <div class="w-44">
                    <ZXInput
                        v-model="searchQuery"
                        type="search"
                        size="sm"
                        placeholder="搜索配置项..."
                    />
                </div>

                <!-- 添加配置按钮 -->
                <ZxButton
                    variant="primary"
                    size="sm"
                    @click="addModalVisible = true"
                >
                    <Plus class="h-3.5 w-3.5 mr-1" />
                    添加配置
                </ZxButton>

                <!-- 刷新按钮 -->
                <ZxButton
                    variant="ghost"
                    size="sm"
                    circle
                    title="重新读取配置文件"
                    :loading="loading"
                    @click="handleRefresh"
                >
                    <RefreshCw class="h-3.5 w-3.5" />
                </ZxButton>
            </div>
        </div>

        <!-- 主内容区：左侧独立配置卡片列表 + 右侧 Monaco 源码编辑器 -->
        <div class="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-12 gap-3 sm:gap-4 overflow-y-auto xl:overflow-hidden">
            
            <!-- ==================== 左侧：独立配置卡片列表（无外层包装框） ==================== -->
            <div
                class="xl:col-span-7 flex flex-col h-full min-h-0 overflow-y-auto pr-1"
            >
                <!-- 独立卡片网格列表 -->
                <div
                    v-if="filteredEntries.length > 0"
                    class="grid grid-cols-1 2xl:grid-cols-2 gap-4 pb-4 content-start"
                >
                    <EnvConfigRow
                        v-for="entry in filteredEntries"
                        :key="entry.id"
                        :entry="entry"
                        @update:value="handleUpdateValue(entry.id, $event)"
                        @delete="handleDeleteEntry"
                    />
                </div>

                <!-- 空状态 -->
                <div
                    v-else
                    class="flex flex-1 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white"
                >
                    <ZxEmptyState
                        size="md"
                        :text="
                            searchQuery
                                ? '未找到匹配的配置项'
                                : '暂无配置项，点击右上角「添加配置」新建'
                        "
                    />
                </div>
            </div>

            <!-- ==================== 右侧：内置 Monaco 源码编辑器 ==================== -->
            <div
                class="xl:col-span-5 relative flex flex-col h-full min-h-[420px] rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden"
            >
                <!-- 内置 Monaco 编辑器（无头部状态栏，无工具栏，紧凑字号） -->
                <div class="flex-1 min-h-0 w-full overflow-hidden">
                    <ZXTextEditor
                        :model-value="rawContent"
                        language="shell"
                        path=".env.dev"
                        :hide-toolbar="true"
                        :hide-statusbar="true"
                        :font-size="12"
                        @update:model-value="handleEditorChange"
                        @save="handleSave"
                    />
                </div>

                <!-- 悬浮保存按钮 -->
                <div class="absolute bottom-4 right-4 z-20">
                    <ZxButton
                        variant="primary"
                        size="sm"
                        :loading="saving"
                        class="shadow-md hover:shadow-lg transition-all"
                        title="保存配置到 .env.dev"
                        @click="handleSave"
                    >
                        <Save class="h-3.5 w-3.5 mr-1" />
                        保存
                    </ZxButton>
                </div>
            </div>

        </div>

        <!-- 新增配置弹窗 -->
        <AddConfigModal
            v-model:visible="addModalVisible"
            :existing-keys="existingKeys"
            @confirm="handleAddConfig"
        />
    </div>
</template>

<style>
/* 页面根溢出由内部网格与列表处理 */
.config-page-root {
    overflow: hidden !important;
}
</style>
