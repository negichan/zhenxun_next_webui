<script setup lang="ts">
import { Settings, Trash2, ArrowRight } from "lucide-vue-next";
import DocPreview from "./DocPreview.vue";
</script>

<template>
    <div class="space-y-10">
        <DocPreview
            id="btn-primary"
            title="主按钮（primary）"
            description="品牌主色实底 + 对比字，用于主操作。"
            :code="`<ZxButton variant=&quot;primary&quot;>主按钮</ZxButton>`"
        >
            <ZxButton variant="primary">主按钮</ZxButton>
        </DocPreview>

        <DocPreview
            id="btn-ghost"
            title="次按钮（ghost）"
            description="无底色幽灵按钮，适合次要、取消类操作。"
            :code="`<ZxButton variant=&quot;ghost&quot;>次按钮</ZxButton>`"
        >
            <ZxButton variant="ghost">次按钮</ZxButton>
        </DocPreview>

        <DocPreview
            id="btn-outline"
            title="描边按钮（outline）"
            description="细描边胶囊，轻量操作、工具条按钮常用。"
            :code="`<ZxButton variant=&quot;outline&quot;>描边按钮</ZxButton>`"
        >
            <ZxButton variant="outline">描边按钮</ZxButton>
        </DocPreview>

        <DocPreview
            id="btn-danger"
            title="危险按钮（danger）"
            description="删除、强中断等危险语义。"
            :code="`<ZxButton variant=&quot;danger&quot;>危险按钮</ZxButton>`"
        >
            <ZxButton variant="danger">危险按钮</ZxButton>
        </DocPreview>

        <DocPreview
            id="btn-circle"
            title="圆形图标按钮（circle）"
            description="circle 渲染正圆，内嵌 lucide 图标，适合工具栏。"
            :code="`<ZxButton variant=&quot;ghost&quot; circle>
    <Settings class=&quot;h-4 w-4&quot; />
</ZxButton>`"
        >
            <div class="flex items-center gap-2">
                <ZxButton variant="ghost" circle>
                    <Settings class="h-4 w-4" />
                </ZxButton>
                <ZxButton variant="outline" circle size="sm">
                    <Trash2 class="h-3.5 w-3.5 text-red-500" />
                </ZxButton>
            </div>
        </DocPreview>

        <DocPreview
            id="btn-icon-text"
            title="图标 + 文字"
            description="默认插槽嵌入图标与文案，图标可居左/居右。"
            :code="`<ZxButton>
    下一步
    <ArrowRight class=&quot;ml-1 h-3.5 w-3.5&quot; />
</ZxButton>`"
        >
            <ZxButton>
                下一步
                <ArrowRight class="ml-1.5 h-3.5 w-3.5" />
            </ZxButton>
        </DocPreview>

        <DocPreview
            id="btn-size-sm"
            title="小尺寸（sm）"
            description="工具条、紧凑表单用。"
            :code="`<ZxButton size=&quot;sm&quot;>小尺寸按钮</ZxButton>`"
        >
            <ZxButton size="sm">小尺寸按钮</ZxButton>
        </DocPreview>

        <DocPreview
            id="btn-disabled"
            title="禁用态"
            description="disabled 不可点击并降权。"
            :code="`<ZxButton disabled>禁用态主按钮</ZxButton>
<ZxButton variant=&quot;outline&quot; disabled>禁用描边</ZxButton>`"
        >
            <div class="flex flex-wrap items-center gap-2">
                <ZxButton disabled>禁用主按钮</ZxButton>
                <ZxButton variant="outline" disabled>禁用描边</ZxButton>
            </div>
        </DocPreview>
    </div>
</template>
