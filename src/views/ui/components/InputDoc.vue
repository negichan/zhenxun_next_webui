<script setup lang="ts">
import { ref } from "vue";
import ZXInput from "@/components/zxcomponent/ZXInput.vue";
import DocPreview from "./DocPreview.vue";

const text = ref("");
const search = ref("");
const multiline = ref("");
const longText = ref(
    "这是一段较长的配置说明：当内容超过阈值时，输入框右侧出现展开图标，点开可在浮层里用大文本编辑，适合备注、JSON 片段或长文案。保存后写回 v-model。",
);
</script>

<template>
    <div class="space-y-10">
        <DocPreview
            id="input-text"
            title="标准文本输入"
            description="单行胶囊输入框。纯白底、悬浮/聚焦 1px 主题色边框，支持 v-model、placeholder、message 校验提示。"
            :code="`<ZXInput v-model=&quot;text&quot; placeholder=&quot;请输入配置项名称...&quot; />`"
        >
            <div class="w-64">
                <ZXInput v-model="text" placeholder="ZXInput 标准文本输入..." />
            </div>
        </DocPreview>

        <DocPreview
            id="input-search"
            title="搜索输入（type=search）"
            description="自动内置放大镜与一键清空，回车触发 search 事件，适合工具栏搜索。"
            :code="`<ZXInput v-model=&quot;search&quot; type=&quot;search&quot; placeholder=&quot;在商店中搜索插件...&quot; />`"
        >
            <div class="w-72">
                <ZXInput
                    v-model="search"
                    type="search"
                    placeholder="ZXInput 搜索胶囊..."
                />
            </div>
        </DocPreview>

        <DocPreview
            id="input-textarea"
            title="多行文本（type=textarea）"
            description="卡片级大圆角 rounded-2xl，可调 rows，可选字数统计与清空。"
            :code="`<ZXInput v-model=&quot;multiline&quot; type=&quot;textarea&quot; :rows=&quot;3&quot; placeholder=&quot;多行配置或描述...&quot; />`"
        >
            <div class="w-full max-w-md">
                <ZXInput
                    v-model="multiline"
                    type="textarea"
                    :rows="3"
                    placeholder="ZXInput 多行文本输入框..."
                />
            </div>
        </DocPreview>

        <DocPreview
            id="input-expandable"
            title="长文本展开编辑（expandable）"
            description="可选能力，默认关闭。值长度达到 expand-threshold（默认 48）时出现展开钮，点开浮层用大文本编辑，保存写回 v-model。"
            :code="`<ZXInput v-model=&quot;longText&quot; expandable :expand-threshold=&quot;48&quot; />`"
        >
            <div class="w-full max-w-xl">
                <ZXInput
                    v-model="longText"
                    expandable
                    :expand-threshold="48"
                    placeholder="输入一段较长的文案..."
                />
            </div>
        </DocPreview>
    </div>
</template>
