<script setup lang="ts">
import { ZXMessageBox, ZXNotification } from "@/services/ui";
import DocPreview from "./DocPreview.vue";

const handleConfirm = () => {
    ZXMessageBox({
        title: "保存偏好确认",
        message: "确定要应用当前修改的所有系统参数吗？",
        cancelButtonText: "取消",
        confirmButtonText: "确认保存",
        onConfirm: () => {
            ZXNotification({ message: "设置已更新", type: "success" });
        },
    });
};

const handleDanger = () => {
    ZXMessageBox({
        title: "删除插件确认",
        message: "确定要彻底删除该插件及其本地缓存数据吗？此操作不可逆！",
        cancelButtonText: "暂不删除",
        confirmButtonText: "确认删除",
        confirmButtonHoverBg: "bg-red-500 hover:bg-red-600",
        onConfirm: () => {
            ZXNotification({ message: "数据已删除", type: "warning" });
        },
    });
};
</script>

<template>
    <div class="space-y-10">
        <DocPreview
            id="messagebox-normal"
            title="常规确认"
            description="保存、应用设置等普通二次确认，默认主色按钮。"
            :code="`import { ZXMessageBox } from &quot;@/services/ui&quot;;

ZXMessageBox({
    title: &quot;保存偏好确认&quot;,
    message: &quot;确定要应用当前修改的所有系统参数吗？&quot;,
    onConfirm: () => {}
});`"
        >
            <ZxButton variant="primary" @click="handleConfirm">
                触发常规确认框
            </ZxButton>
        </DocPreview>

        <DocPreview
            id="messagebox-danger"
            title="危险操作确认"
            description="删除等不可逆操作，确认按钮 hover 变为危险红，强调二次确认。"
            :code="`ZXMessageBox({
    title: &quot;删除插件确认&quot;,
    message: &quot;此操作不可逆！&quot;,
    confirmButtonText: &quot;确认删除&quot;,
    confirmButtonHoverBg: &quot;bg-red-500 hover:bg-red-600&quot;,
    onConfirm: () => {}
});`"
        >
            <ZxButton variant="danger" @click="handleDanger">
                触发危险确认框
            </ZxButton>
        </DocPreview>
    </div>
</template>
