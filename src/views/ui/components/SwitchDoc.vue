<script setup lang="ts">
import { ref } from "vue";
import ZxSwitch from "@/components/zxcomponent/ZxSwitch.vue";
import DocPreview from "./DocPreview.vue";

const enabled = ref(true);
const mdEnabled = ref(false);
</script>

<template>
    <div class="space-y-10">
        <DocPreview
            id="switch-sm"
            title="默认尺寸（sm）"
            description="选中态 bg-zx-primary，transition-colors duration-200。支持 v-model。"
            :code="`<ZxSwitch v-model=&quot;enabled&quot; />`"
        >
            <div class="flex items-center gap-3">
                <ZxSwitch v-model="enabled" />
                <span class="text-sm font-medium text-slate-600">sm（默认）</span>
            </div>
        </DocPreview>

        <DocPreview
            id="switch-md"
            title="大尺寸（md）"
            description="适合设置页、卡片主开关等更醒目的场景。"
            :code="`<ZxSwitch v-model=&quot;mdEnabled&quot; size=&quot;md&quot; />`"
        >
            <div class="flex items-center gap-3">
                <ZxSwitch v-model="mdEnabled" size="md" />
                <span class="text-sm font-medium text-slate-600">md</span>
            </div>
        </DocPreview>

        <DocPreview
            id="switch-disabled"
            title="禁用态"
            description="disabled 时不可点击，视觉降权。"
            :code="`<ZxSwitch :model-value=&quot;true&quot; disabled />`"
        >
            <div class="flex items-center gap-3">
                <ZxSwitch :model-value="true" disabled />
                <span class="text-sm font-medium text-slate-600">disabled</span>
            </div>
        </DocPreview>
    </div>
</template>
