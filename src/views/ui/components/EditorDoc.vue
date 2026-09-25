<script setup lang="ts">
import { ref } from "vue";
import ZXTextEditor from "@/components/ZXTextEditor";
import DocPreview from "./DocPreview.vue";

const codeContent = ref(`{
  "name": "zhenxun_bot",
  "version": "0.2.0",
  "features": ["stacked-toast", "shadcn-doc"]
}`);

const editorCode = `<ZXTextEditor
    v-model="codeContent"
    language="json"
    :hide-toolbar="true"
/>`;
</script>

<template>
    <div class="space-y-10">
        <DocPreview
            id="editor"
            title="轻量配置与代码编辑器"
            description="基于 textarea 的轻量代码输入与行号显示，支持语言高亮、只读模式与工具栏显隐。"
            :code="editorCode"
            align="stretch"
        >
            <div class="w-full">
                <ZXTextEditor
                    v-model="codeContent"
                    language="json"
                    :hide-toolbar="true"
                />
            </div>
        </DocPreview>
    </div>
</template>
