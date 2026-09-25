<script setup lang="ts">
import { Inbox, RotateCcw, Search } from "lucide-vue-next";
import DocPreview from "./DocPreview.vue";
</script>

<template>
    <div class="space-y-10">
        <DocPreview
            id="empty-sm"
            title="紧凑占位（sm）"
            description="侧栏、小卡片内的缺省位，图标 + 单行文案。"
            :code="`<ZxEmptyState :icon=&quot;Inbox&quot; text=&quot;暂无数据表&quot; size=&quot;sm&quot; />`"
        >
            <div
                class="flex min-h-[140px] w-full max-w-sm flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs"
            >
                <ZxEmptyState :icon="Inbox" text="暂无数据表" size="sm" />
            </div>
        </DocPreview>

        <DocPreview
            id="empty-md"
            title="标准占位（md）"
            description="列表、明细区空态，可带副文案引导。"
            :code="`<ZxEmptyState :icon=&quot;Search&quot; text=&quot;未找到相关插件&quot; sub-text=&quot;请尝试调整搜索关键词&quot; size=&quot;md&quot; />`"
        >
            <div
                class="flex min-h-[140px] w-full max-w-md flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs"
            >
                <ZxEmptyState
                    :icon="Search"
                    text="未找到相关插件"
                    sub-text="请尝试调整关键词"
                    size="md"
                />
            </div>
        </DocPreview>

        <DocPreview
            id="empty-action"
            title="带操作插槽"
            description="默认插槽放重试、去设置等动作按钮，形成可恢复空态。"
            :code="`<ZxEmptyState text=&quot;加载已断开&quot; sub-text=&quot;请检查网络服务&quot; size=&quot;sm&quot;>
    <ZxButton variant=&quot;outline&quot; size=&quot;sm&quot;>
        <RotateCcw class=&quot;h-3.5 w-3.5 mr-1&quot; />重试
    </ZxButton>
</ZxEmptyState>`"
        >
            <div
                class="flex min-h-[140px] w-full max-w-sm flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs"
            >
                <ZxEmptyState
                    text="加载已断开"
                    sub-text="请检查后端运行状态"
                    size="sm"
                >
                    <ZxButton variant="outline" size="sm">
                        <RotateCcw class="mr-1 h-3.5 w-3.5" />
                        重试
                    </ZxButton>
                </ZxEmptyState>
            </div>
        </DocPreview>
    </div>
</template>
