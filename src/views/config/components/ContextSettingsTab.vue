<script setup lang="ts">
import { Brain, FileCode, Sliders, Sparkles } from "lucide-vue-next";
import ZxSwitch from "@/components/zxcomponent/ZxSwitch.vue";
import ZxInputNumber from "@/components/zxcomponent/ZxInputNumber.vue";
import type { ContextSettingsItem } from "@/types/ai.types";

interface Props {
    contextSettings: ContextSettingsItem;
    availableModels: string[];
}

defineProps<Props>();
</script>

<template>
    <div class="space-y-6">
        <!-- 自然语言上下文压缩总结 -->
        <div
            class="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-5"
        >
            <div class="flex items-center justify-between border-b border-slate-100 pb-3.5">
                <div class="flex items-center gap-2.5">
                    <Brain class="h-5 w-5 text-zx-primary" />
                    <div>
                        <h3 class="text-base font-bold text-zx-text-strong">
                            大模型对话总结与上下文压缩 (LLM Summary)
                        </h3>
                        <p class="text-xs text-zx-text-muted mt-0.5">
                            当对话历史超过设定阈值时，自动调用轻量大模型将早期对话凝练成结构化摘要
                        </p>
                    </div>
                </div>

                <div class="flex items-center gap-2">
                    <span class="text-xs font-medium text-zx-text">
                        {{ contextSettings.llm_summary.enable ? "已启用" : "已关闭" }}
                    </span>
                    <ZxSwitch v-model="contextSettings.llm_summary.enable" />
                </div>
            </div>

            <div
                class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
                :class="!contextSettings.llm_summary.enable ? 'opacity-50 pointer-events-none' : ''"
            >
                <div class="flex flex-col gap-1.5 rounded-2xl border border-slate-100 bg-slate-50/50 p-3.5">
                    <span class="font-medium text-xs text-zx-text-strong">
                        触发 Token 阈值
                    </span>
                    <span class="text-[11px] text-zx-text-subtle">
                        &le; 1.0 为窗口比例，&gt; 1.0 为绝对 Token 数
                    </span>
                    <ZxInputNumber
                        v-model="contextSettings.llm_summary.trigger_threshold"
                        :step="0.05"
                        :precision="2"
                        size="sm"
                        class="mt-1"
                    />
                </div>

                <div class="flex flex-col gap-1.5 rounded-2xl border border-slate-100 bg-slate-50/50 p-3.5">
                    <span class="font-medium text-xs text-zx-text-strong">
                        最大历史轮数
                    </span>
                    <span class="text-[11px] text-zx-text-subtle">
                        超过该轮数触发压缩，设为 0 表示不限
                    </span>
                    <ZxInputNumber
                        v-model="contextSettings.llm_summary.max_history_turns"
                        size="sm"
                        class="mt-1"
                    />
                </div>

                <div class="flex flex-col gap-1.5 rounded-2xl border border-slate-100 bg-slate-50/50 p-3.5">
                    <span class="font-medium text-xs text-zx-text-strong">
                        保留最近对话轮数
                    </span>
                    <span class="text-[11px] text-zx-text-subtle">
                        在总结之外原样完整保留的最近轮数
                    </span>
                    <ZxInputNumber
                        v-model="contextSettings.llm_summary.keep_recent_turns"
                        size="sm"
                        class="mt-1"
                    />
                </div>

                <div class="flex flex-col gap-1.5 rounded-2xl border border-slate-100 bg-slate-50/50 p-3.5">
                    <span class="font-medium text-xs text-zx-text-strong">
                        指定总结模型
                    </span>
                    <span class="text-[11px] text-zx-text-subtle">
                        推荐选用高性价比且速度快的小模型
                    </span>
                    <ZXInput
                        v-model="contextSettings.llm_summary.summarization_model"
                        list="summary-models-list"
                        placeholder="留空则使用全局默认"
                        rounded="xl"
                        size="sm"
                        input-class="font-mono"
                        class="mt-1"
                    />
                    <datalist id="summary-models-list">
                        <option
                            v-for="m in availableModels"
                            :key="m"
                            :value="m"
                        />
                    </datalist>
                </div>
            </div>

            <!-- 总结提示词 -->
            <div
                class="flex flex-col gap-1.5"
                :class="!contextSettings.llm_summary.enable ? 'opacity-50 pointer-events-none' : ''"
            >
                <label class="font-medium text-xs text-zx-text-strong">
                    指导总结的系统提示词 (Prompt)
                </label>
                <ZXInput
                    v-model="contextSettings.llm_summary.summarization_prompt"
                    type="textarea"
                    :rows="3"
                />
            </div>
        </div>

        <!-- 多模态窗口与工具修剪策略 -->
        <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <!-- 多模态滑动窗口 -->
            <div
                class="flex flex-col justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm"
            >
                <div class="space-y-1">
                    <div class="flex items-center gap-2">
                        <Sparkles class="h-4 w-4 text-zx-primary" />
                        <h4 class="text-sm font-bold text-zx-text-strong">
                            多模态真实数据滑动窗口
                        </h4>
                    </div>
                    <p class="text-xs text-zx-text-muted">
                        仅在上下文中保留最近 N 轮包含图片/多模态真实 Payload 的消息，较早消息将自动替换为文字占位符以大幅节省 Token 消耗与网络带宽。
                    </p>
                </div>

                <div class="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/50 p-3.5">
                    <span class="text-xs font-medium text-zx-text-strong">
                        保留窗口轮数 (0 为无限制)
                    </span>
                    <ZxInputNumber
                        v-model="contextSettings.vision_window_size"
                        size="sm"
                        class="w-28"
                    />
                </div>
            </div>

            <!-- 工具输出修剪策略 -->
            <div
                class="flex flex-col justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm"
            >
                <div class="flex items-center justify-between">
                    <div class="space-y-1">
                        <div class="flex items-center gap-2">
                            <FileCode class="h-4 w-4 text-zx-primary" />
                            <h4 class="text-sm font-bold text-zx-text-strong">
                                工具过载结果自动修剪 (Tool Pruning)
                            </h4>
                        </div>
                        <p class="text-xs text-zx-text-muted">
                            对于执行搜索、网页抓取等返回超大文本的中间工具结果，在完成反思后自动进行精简。
                        </p>
                    </div>
                    <ZxSwitch v-model="contextSettings.tool_pruning.enable" />
                </div>

                <div
                    class="grid grid-cols-3 gap-2.5"
                    :class="!contextSettings.tool_pruning.enable ? 'opacity-50 pointer-events-none' : ''"
                >
                    <div class="flex flex-col gap-1 rounded-2xl border border-slate-100 bg-slate-50/50 p-2.5">
                        <span class="text-[11px] font-medium text-zx-text-strong">触发阈值</span>
                        <ZxInputNumber
                            v-model="contextSettings.tool_pruning.trigger_threshold"
                            :step="0.05"
                            :precision="2"
                            size="sm"
                        />
                    </div>
                    <div class="flex flex-col gap-1 rounded-2xl border border-slate-100 bg-slate-50/50 p-2.5">
                        <span class="text-[11px] font-medium text-zx-text-strong">最大工具轮数</span>
                        <ZxInputNumber
                            v-model="contextSettings.tool_pruning.max_history_turns"
                            size="sm"
                        />
                    </div>
                    <div class="flex flex-col gap-1 rounded-2xl border border-slate-100 bg-slate-50/50 p-2.5">
                        <span class="text-[11px] font-medium text-zx-text-strong">保留最新轮数</span>
                        <ZxInputNumber
                            v-model="contextSettings.tool_pruning.keep_recent_turns"
                            size="sm"
                        />
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
