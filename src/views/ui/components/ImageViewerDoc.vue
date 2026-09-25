<script setup lang="ts">
import { ref } from "vue";
import ZxImageViewer from "@/components/zxcomponent/ZxImageViewer.vue";
import { openImageViewer } from "@/directives/imageViewer";
import DocPreview from "./DocPreview.vue";

const viewer = ref<InstanceType<typeof ZxImageViewer> | null>(null);

const pics = [
    "https://picsum.photos/seed/zx1/800/600",
    "https://picsum.photos/seed/zx2/900/700",
    "https://picsum.photos/seed/zx3/700/900",
];

const basicCode = `<!-- 指令式：点击元素打开预览 -->
<div v-image-viewer="pics[0]">…</div>

<!-- 程序式：openImageViewer(urls, index) -->
<button @click="openImageViewer(pics, 0)">预览</button>

<!-- 或挂组件手动 open -->
<ZxImageViewer ref="viewer" />`;
</script>

<template>
    <div class="space-y-10">
        <DocPreview
            id="image-viewer"
            title="图片查看器（ZxImageViewer）"
            description="半透明遮罩 + 居中大图。支持多图翻页、滚轮缩放、拖拽平移、旋转过渡；Esc / 点遮罩关闭。按钮配色跟随主题变量。可指令式 v-image-viewer、openImageViewer() 程序式，或 ref.open() 手动调用。"
            :code="basicCode"
        >
            <div class="mx-auto flex w-full max-w-md flex-col items-center gap-4">
                <div class="flex gap-3">
                    <button
                        v-for="(url, i) in pics"
                        :key="url"
                        type="button"
                        class="h-20 w-20 overflow-hidden rounded-xl border border-slate-200 transition-colors duration-200 hover:border-zx-primary"
                        @click="openImageViewer(pics, i)"
                    >
                        <img :src="url" class="h-full w-full object-cover" alt="" />
                    </button>
                </div>
                <p class="text-xs text-zx-text-subtle">点击缩略图打开查看器，可缩放 / 旋转 / 翻页</p>
            </div>
        </DocPreview>

        <ZxImageViewer ref="viewer" />
    </div>
</template>
