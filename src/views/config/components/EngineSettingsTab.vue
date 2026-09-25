<script setup lang="ts">
import { Bot, Cpu, Network, ShieldCheck, Terminal } from "lucide-vue-next";
import ZxSwitch from "@/components/zxcomponent/ZxSwitch.vue";
import ZxInputNumber from "@/components/zxcomponent/ZxInputNumber.vue";
import type {
    AgentSettingsItem,
    ClientSettingsItem,
    DebugLogItem,
    ProviderSettingsGroupItem,
    SandboxSettingsItem,
} from "@/types/ai.types";

interface Props {
    agentSettings: AgentSettingsItem;
    clientSettings: ClientSettingsItem;
    debugLog: DebugLogItem;
    sandbox: SandboxSettingsItem;
    providerSettings: ProviderSettingsGroupItem;
}

defineProps<Props>();
</script>

<template>
    <div class="space-y-6">
        <!-- Agent 执行引擎参数 -->
        <div
            class="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-5"
        >
            <div class="flex items-center gap-2.5 border-b border-slate-100 pb-3.5">
                <Bot class="h-5 w-5 text-zx-primary" />
                <div>
                    <h3 class="text-base font-bold text-zx-text-strong">
                        Agent 推理与工具执行引擎 (Agent Engine)
                    </h3>
                    <p class="text-xs text-zx-text-muted mt-0.5">
                        控制智能体工具调用循环、反思重试与防死循环保护机制
                    </p>
                </div>
            </div>

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div class="flex flex-col gap-1.5 rounded-2xl border border-slate-100 bg-slate-50/50 p-3.5">
                    <span class="font-medium text-xs text-zx-text-strong">单次工具最大循环数</span>
                    <span class="text-[11px] text-zx-text-subtle">单轮任务内工具调用循环上限</span>
                    <ZxInputNumber
                        v-model="agentSettings.max_cycles"
                        size="sm"
                        class="mt-1"
                    />
                </div>

                <div class="flex flex-col gap-1.5 rounded-2xl border border-slate-100 bg-slate-50/50 p-3.5">
                    <span class="font-medium text-xs text-zx-text-strong">全局绝对循环上限</span>
                    <span class="text-[11px] text-zx-text-subtle">跨嵌套子智能体全流程总循环上限</span>
                    <ZxInputNumber
                        v-model="agentSettings.global_max_cycles"
                        size="sm"
                        class="mt-1"
                    />
                </div>

                <div class="flex flex-col gap-1.5 rounded-2xl border border-slate-100 bg-slate-50/50 p-3.5">
                    <span class="font-medium text-xs text-zx-text-strong">反思重试次数</span>
                    <span class="text-[11px] text-zx-text-subtle">工具返回异常或反思不达标时的最大重试</span>
                    <ZxInputNumber
                        v-model="agentSettings.reflexion_retries"
                        size="sm"
                        class="mt-1"
                    />
                </div>
            </div>

            <!-- 开关组 -->
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div class="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/50 p-3.5">
                    <div>
                        <span class="font-medium text-xs text-zx-text-strong block">并行工具调用</span>
                        <span class="text-[11px] text-zx-text-subtle">允许模型一次返回并并行执行多个工具</span>
                    </div>
                    <ZxSwitch v-model="agentSettings.enable_parallel_calls" />
                </div>

                <div class="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/50 p-3.5">
                    <div>
                        <span class="font-medium text-xs text-zx-text-strong block">达到上限兜底总结</span>
                        <span class="text-[11px] text-zx-text-subtle">达最大循环时自动总结当前成果而非报错</span>
                    </div>
                    <ZxSwitch v-model="agentSettings.enable_fallback_summary" />
                </div>

                <div class="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/50 p-3.5">
                    <div>
                        <span class="font-medium text-xs text-zx-text-strong block">人机协作 (HITL)</span>
                        <span class="text-[11px] text-zx-text-subtle">是否允许智能体主动挂起任务向用户求助</span>
                    </div>
                    <ZxSwitch v-model="agentSettings.enable_hitl" />
                </div>
            </div>
        </div>

        <!-- 客户端网络与连接设置 -->
        <div
            class="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-5"
        >
            <div class="flex items-center gap-2.5 border-b border-slate-100 pb-3.5">
                <Network class="h-5 w-5 text-zx-primary" />
                <div>
                    <h3 class="text-base font-bold text-zx-text-strong">
                        客户端网络与重试 (Client Network)
                    </h3>
                    <p class="text-xs text-zx-text-muted mt-0.5">
                        大模型 API 底层 HTTP 请求超时、失败重试与延迟配置
                    </p>
                </div>
            </div>

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div class="flex flex-col gap-1.5 rounded-2xl border border-slate-100 bg-slate-50/50 p-3.5">
                    <span class="font-medium text-xs text-zx-text-strong">请求超时时间 (秒)</span>
                    <ZxInputNumber
                        v-model="clientSettings.timeout"
                        size="sm"
                        class="mt-1"
                    />
                </div>

                <div class="flex flex-col gap-1.5 rounded-2xl border border-slate-100 bg-slate-50/50 p-3.5">
                    <span class="font-medium text-xs text-zx-text-strong">网络异常最大重试次数</span>
                    <ZxInputNumber
                        v-model="clientSettings.max_retries"
                        size="sm"
                        class="mt-1"
                    />
                </div>

                <div class="flex flex-col gap-1.5 rounded-2xl border border-slate-100 bg-slate-50/50 p-3.5">
                    <span class="font-medium text-xs text-zx-text-strong">重试基础延迟 (秒)</span>
                    <ZxInputNumber
                        v-model="clientSettings.retry_delay"
                        size="sm"
                        class="mt-1"
                    />
                </div>

                <div class="flex flex-col gap-1.5 rounded-2xl border border-slate-100 bg-slate-50/50 p-3.5">
                    <span class="font-medium text-xs text-zx-text-strong">结构化生成重试次数</span>
                    <ZxInputNumber
                        v-model="clientSettings.structured_retries"
                        size="sm"
                        class="mt-1"
                    />
                </div>
            </div>
        </div>

        <!-- 调试日志与沙箱环境 -->
        <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <!-- 调试日志控制 -->
            <div
                class="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-4"
            >
                <div class="flex items-center gap-2 border-b border-slate-100 pb-3">
                    <Terminal class="h-5 w-5 text-zx-primary" />
                    <div>
                        <h4 class="text-sm font-bold text-zx-text-strong">
                            调试日志细粒度开关
                        </h4>
                        <p class="text-xs text-zx-text-muted">
                            控制控制台与系统日志中输出的大模型协议详情
                        </p>
                    </div>
                </div>

                <div class="space-y-3">
                    <div class="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                        <span class="text-xs font-medium text-zx-text">显示工具定义 (JSON Schema)</span>
                        <ZxSwitch v-model="debugLog.show_tools" />
                    </div>

                    <div class="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                        <span class="text-xs font-medium text-zx-text">显示结构化输出 Schema</span>
                        <ZxSwitch v-model="debugLog.show_schema" />
                    </div>

                    <div class="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                        <span class="text-xs font-medium text-zx-text">显示安全过滤设置 (Safety)</span>
                        <ZxSwitch v-model="debugLog.show_safety" />
                    </div>
                </div>
            </div>

            <!-- 沙箱环境 -->
            <div
                class="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-4"
            >
                <div class="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div class="flex items-center gap-2">
                        <Cpu class="h-5 w-5 text-zx-primary" />
                        <div>
                            <h4 class="text-sm font-bold text-zx-text-strong">
                                代码执行沙箱 (Sandbox)
                            </h4>
                            <p class="text-xs text-zx-text-muted">
                                为 Agent 执行代码与命令提供独立 Docker 隔离环境
                            </p>
                        </div>
                    </div>
                    <ZxSwitch v-model="sandbox.enable_sandbox" />
                </div>

                <div
                    class="space-y-3"
                    :class="!sandbox.enable_sandbox ? 'opacity-50 pointer-events-none' : ''"
                >
                    <div class="grid grid-cols-2 gap-3">
                        <div class="space-y-1">
                            <span class="text-[11px] font-medium text-zx-text-muted">沙箱驱动类型</span>
                            <ZXInput
                                v-model="sandbox.sandbox_type"
                                placeholder=""
                                rounded="xl"
                                size="sm"
                            />
                        </div>
                        <div class="space-y-1">
                            <span class="text-[11px] font-medium text-zx-text-muted">Docker 镜像名称</span>
                            <ZXInput
                                v-model="sandbox.docker_image"
                                placeholder=""
                                rounded="xl"
                                size="sm"
                                input-class="font-mono"
                            />
                        </div>
                    </div>

                    <div class="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                        <span class="text-xs font-medium text-zx-text">VFS 路径防逃逸探针</span>
                        <ZxSwitch v-model="sandbox.enable_vfs_helper" />
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
