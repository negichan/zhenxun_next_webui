<script setup lang="ts">
import { Pencil, Trash2 } from "lucide-vue-next";
import { openContextMenu } from "@/components/zxcomponent/ContextMenu";
import { ZXNotification } from "@/services/ui";
import DocPreview from "./DocPreview.vue";

const contextMenuItems = [
    {
        label: "编辑项目",
        icon: Pencil,
        action: () => ZXNotification({ title: "编辑", type: "info" }),
    },
    {
        label: "移至回收站",
        icon: Trash2,
        action: () => ZXNotification({ title: "删除", type: "warning" }),
    },
];

const handleRightClick = (e: MouseEvent) => {
    openContextMenu(e, contextMenuItems);
};

const menuCode = `import { openContextMenu } from "@/components/zxcomponent/ContextMenu";

const handleContextMenu = (e: MouseEvent) => {
    openContextMenu(e, [
        { label: "编辑项目", icon: Pencil, action: () => {} },
        { label: "移至回收站", icon: Trash2, action: () => {} },
    ]);
};`;
</script>

<template>
    <div class="space-y-10">
        <DocPreview
            id="contextmenu"
            title="全局右键菜单"
            description="鼠标右键事件触发。全局接管，若选中区域存在文字则自动追加快捷复制项。"
            :code="menuCode"
        >
            <div
                class="flex h-32 w-full max-w-md cursor-context-menu items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 text-sm text-slate-400 select-none transition-colors hover:border-slate-400 hover:text-slate-600"
                @contextmenu="handleRightClick"
            >
                在此虚线区域内右键点击体验
            </div>
        </DocPreview>
    </div>
</template>
