<script setup lang="ts">
import { ref } from "vue";
import DocPreview from "./DocPreview.vue";
import ZxPagination from "@/components/zxcomponent/ZxPagination.vue";

// 1. 基础分页 (居中展示，shadcn Pagination 经典形态)
const basicPage = ref(2);

// 2. 带摘要与两端对齐
const tablePage = ref(1);

// 3. 紧凑模式
const compactPage = ref(5);

// 4. 带每页条数选择器与跳页
const fullPage = ref(3);
const fullPageSize = ref(20);

const basicCode = `<!-- 1. 基础分页（shadcn 经典居中形态） -->
<ZxPagination
    v-model="basicPage"
    :total="100"
    :page-size="10"
    align="center"
    :show-total="false"
/>`;

const tableCode = `<!-- 2. 表格两端对齐分页（左侧条数摘要，右侧翻页控制） -->
<ZxPagination
    v-model="tablePage"
    :total="248"
    :page-size="20"
/>`;

const compactCode = `<!-- 3. 紧凑小型化分页（compact 适合侧栏与工作台） -->
<ZxPagination
    v-model="compactPage"
    :total="90"
    :page-size="10"
    compact
    :show-total="false"
/>`;

const fullCode = `<!-- 4. 全功能分页（首尾跳转 + 每页条数切换器 + 快速跳页） -->
<ZxPagination
    v-model="fullPage"
    v-model:page-size="fullPageSize"
    :total="480"
    show-edges
    show-size-changer
    show-quick-jumper
/>`;
</script>

<template>
    <div class="space-y-6">
        <!-- 1. 基础分页 -->
        <DocPreview
            id="basic-pagination"
            title="基础分页（Basic Pagination）"
            description="对齐 shadcn UI Pagination 设计语言。拥有上一页/下一页按钮、自适应页码序列与省略号，激活页码采用高饱和实色底规范高亮。"
            :code="basicCode"
            align="center"
        >
            <div class="w-full max-w-xl">
                <ZxPagination
                    v-model="basicPage"
                    :total="100"
                    :page-size="10"
                    align="center"
                    :show-total="false"
                />
            </div>
        </DocPreview>

        <!-- 2. 带摘要两端对齐 -->
        <DocPreview
            id="table-pagination"
            title="表格与列表分页（With Summary）"
            description="默认两端对齐（align='between'）：左侧展示条数摘要，右侧提供翻页控制区，自动计算边界与禁用态。"
            :code="tableCode"
            align="stretch"
        >
            <div class="w-full">
                <ZxPagination
                    v-model="tablePage"
                    :total="248"
                    :page-size="20"
                />
            </div>
        </DocPreview>

        <!-- 3. 紧凑模式 -->
        <DocPreview
            id="compact-pagination"
            title="紧凑形态（Compact Pagination）"
            description="开启 compact 缩减尺寸（h-7）并隐藏按钮文字，专用于狭窄面板、侧边栏、代码编辑器底部状态栏等空间紧张场景。"
            :code="compactCode"
            align="center"
        >
            <div class="w-full max-w-md">
                <ZxPagination
                    v-model="compactPage"
                    :total="90"
                    :page-size="10"
                    compact
                    :show-total="false"
                />
            </div>
        </DocPreview>

        <!-- 4. 全功能分页 -->
        <DocPreview
            id="full-pagination"
            title="全功能扩展（Size Changer & Quick Jumper）"
            description="支持首尾跳页（show-edges）、每页条数切换（show-size-changer）以及回车快速跳页（show-quick-jumper）。"
            :code="fullCode"
            align="stretch"
        >
            <div class="w-full">
                <ZxPagination
                    v-model="fullPage"
                    v-model:page-size="fullPageSize"
                    :total="480"
                    show-edges
                    show-size-changer
                    show-quick-jumper
                />
            </div>
        </DocPreview>
    </div>
</template>
