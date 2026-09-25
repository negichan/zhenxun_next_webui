<script setup lang="ts">
import DocPreview from "./DocPreview.vue";

const tagCases = [
    { variant: "primary", name: "品牌主色", sample: "primary" },
    { variant: "success", name: "已启用", sample: "success" },
    { variant: "warning", name: "待处理", sample: "warning" },
    { variant: "danger", name: "异常中断", sample: "danger" },
    { variant: "info", name: "版本提示", sample: "info" },
    { variant: "neutral", name: "已停用", sample: "neutral" },
    { variant: "purple", name: "内置插件", sample: "purple" },
    { variant: "cyan", name: "数据源", sample: "cyan" },
] as const;
</script>

<template>
    <div class="space-y-10">
        <DocPreview
            v-for="c in tagCases"
            :id="`tag-${c.variant}`"
            :key="c.variant"
            :title="`语义徽标 · ${c.variant}`"
            :description="c.name"
            :code="`<ZxTag variant=&quot;${c.variant}&quot;>${c.sample}</ZxTag>`"
        >
            <ZxTag :variant="c.variant">{{ c.sample }}</ZxTag>
        </DocPreview>

        <DocPreview
            id="tag-custom"
            title="自定义品牌色"
            description="传入十六进制 color，自动解析明度并适配文字对比色。"
            :code="`<ZxTag color=&quot;#0ea5e9&quot;>自定义天空蓝</ZxTag>
<ZxTag color=&quot;#f97316&quot;>自定义亮橙色</ZxTag>`"
        >
            <div class="flex flex-wrap items-center justify-center gap-2">
                <ZxTag color="#0ea5e9">自定义天空蓝</ZxTag>
                <ZxTag color="#f97316">自定义亮橙色</ZxTag>
                <ZxTag color="#10b981">自定义祖母绿</ZxTag>
            </div>
        </DocPreview>
    </div>
</template>
