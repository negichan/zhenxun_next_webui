<script setup lang="ts">
import { ref } from "vue";
import DocPreview from "./DocPreview.vue";

const visible = ref(false);

const modalCode = `<ZxButton @click="visible = true">打开通用弹窗</ZxButton>

<ZxModal
    v-model="visible"
    title="通用弹窗示例"
    subtitle="由 ZxModal 统一驱动果冻动效与设计规范"
>
    <div class="space-y-3 py-2 text-sm text-slate-600">
        <p>这是一个使用 ZxModal 封装的标准弹窗。</p>
        <p>内置标准标题区、关闭按钮、内容区域和底部动作插槽，支持 Esc 键与遮罩关闭。</p>
    </div>
    <template #footer>
        <ZxButton variant="ghost" @click="visible = false">取消</ZxButton>
        <ZxButton @click="visible = false">确定</ZxButton>
    </template>
</ZxModal>`;
</script>

<template>
    <div class="space-y-10">
        <DocPreview
            id="modal"
            title="通用模态窗"
            description="内置 GSAP 果冻进出场动效、全屏半透遮罩、Esc/遮罩快速关闭与尺寸档位支持。"
            :code="modalCode"
        >
            <div class="flex items-center justify-center">
                <ZxButton @click="visible = true">打开通用弹窗</ZxButton>

                <ZxModal
                    v-model="visible"
                    title="通用弹窗示例"
                    subtitle="由 ZxModal 统一驱动果冻动效与设计规范"
                >
                    <div class="space-y-3 py-2 text-sm text-slate-600">
                        <p>这是一个使用 ZxModal 封装的标准弹窗。</p>
                        <p>
                            内置标准标题区、关闭按钮、内容区域和底部动作插槽，支持
                            Esc 键与遮罩快速关闭。
                        </p>
                    </div>
                    <template #footer>
                        <ZxButton variant="ghost" @click="visible = false">
                            取消
                        </ZxButton>
                        <ZxButton @click="visible = false">确定</ZxButton>
                    </template>
                </ZxModal>
            </div>
        </DocPreview>
    </div>
</template>
