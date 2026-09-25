<script setup lang="ts">
import DocPreview from "./DocPreview.vue";

const roles = [
    {
        variant: "primary",
        name: "primary",
        hex: "var(--zx-color-primary)",
        desc: "品牌强调、全部选项、通用激活/选中态",
    },
    {
        variant: "success",
        name: "success",
        hex: "#22c55e",
        desc: "启用、已安装、已完成、在线、成功状态",
    },
    {
        variant: "warning",
        name: "warning",
        hex: "#f59e0b",
        desc: "注意、待处理、三方插件、常驻状态",
    },
    {
        variant: "danger",
        name: "danger",
        hex: "#ef4444",
        desc: "错误、失败、删除、下线、危险操作",
    },
    {
        variant: "info",
        name: "info",
        hex: "#3b82f6",
        desc: "提示、版本号、链接、一般信息",
    },
    {
        variant: "neutral",
        name: "neutral",
        hex: "#9ca3af",
        desc: "禁用、未安装、占位、无状态",
    },
    {
        variant: "purple",
        name: "purple",
        hex: "#8b5cf6",
        desc: "内置插件、置顶推荐、特殊业务分类",
    },
    {
        variant: "cyan",
        name: "cyan",
        hex: "#06b6d4",
        desc: "字典、数据类、扩展标识",
    },
] as const;

const colorTokenCode = `/* 全局语义色类名速查 (DESIGN.md 唯一基准) */
/* 品牌强调 */
bg-zx-primary text-[color:var(--zx-color-on-primary)]

/* 状态色（高饱和实色底 + 纯白对比字） */
bg-[#22c55e] text-white   /* 成功 / 启用 / 已安装 */
bg-[#f59e0b] text-white   /* 警告 / 注意 / 三方 */
bg-[#ef4444] text-white   /* 危险 / 失败 / 删除 */
bg-[#3b82f6] text-white   /* 提示 / 信息 / 链接 */
bg-[#9ca3af] text-white   /* 禁用 / 未安装 / 占位 */
bg-[#8b5cf6] text-white   /* 内置 / 紫色特殊类 */
bg-[#06b6d4] text-white   /* 数据 / 青色扩展类 */`;
</script>

<template>
    <div class="space-y-6">
        <!-- 概览与实色对照 -->
        <DocPreview
            id="semantic"
            title="标准语义色表"
            description="全局统一的 8 大标准语义色，高饱和实色底 + 纯白对比字。"
            :code="colorTokenCode"
            align="stretch"
        >
            <div class="grid grid-cols-2 gap-2.5 sm:grid-cols-4 w-full">
                <div
                    v-for="role in roles"
                    :key="role.variant"
                    class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs"
                >
                    <div
                        class="h-10 w-full"
                        :class="
                            role.variant === 'primary' ? 'bg-zx-primary' : ''
                        "
                        :style="
                            role.variant === 'primary'
                                ? undefined
                                : { background: role.hex }
                        "
                    ></div>
                    <div class="p-2.5">
                        <div class="flex items-center justify-between">
                            <span
                                class="font-mono text-xs font-semibold text-slate-800"
                            >
                                {{ role.name }}
                            </span>
                            <span class="font-mono text-[10px] text-slate-400">
                                {{ role.hex }}
                            </span>
                        </div>
                        <p
                            class="mt-0.5 text-[10px] text-slate-400 leading-tight"
                        >
                            {{ role.desc }}
                        </p>
                    </div>
                </div>
            </div>
        </DocPreview>

        <!-- 文本层级规范 -->
        <DocPreview
            id="text-tokens"
            title="文本语义 Token 规范"
            description="strong / text / muted / subtle 四级文字对比度，对应标题、正文、辅助与占位。"
            :code="`text-zx-text-strong  /* 强调 / 标题 */
text-zx-text        /* 常规正文 */
text-zx-text-muted  /* 次级说明 */
text-zx-text-subtle /* 占位 / 备注 */`"
        >
            <div class="w-full space-y-2.5">
                <div class="flex items-center justify-between text-xs">
                    <span class="font-medium text-zx-text-strong">
                        text-zx-text-strong（强调文字 / 标题）
                    </span>
                    <span class="font-mono text-[11px] text-slate-400">
                        高对比标题
                    </span>
                </div>
                <div class="flex items-center justify-between text-xs">
                    <span class="text-zx-text">
                        text-zx-text（常规正文文字）
                    </span>
                    <span class="font-mono text-[11px] text-slate-400">
                        主要阅读
                    </span>
                </div>
                <div class="flex items-center justify-between text-xs">
                    <span class="text-zx-text-muted">
                        text-zx-text-muted（次级文字 / 图标）
                    </span>
                    <span class="font-mono text-[11px] text-slate-400">
                        辅助说明
                    </span>
                </div>
                <div class="flex items-center justify-between text-xs">
                    <span class="text-zx-text-subtle">
                        text-zx-text-subtle（弱化文字 / 占位符）
                    </span>
                    <span class="font-mono text-[11px] text-slate-400">
                        占位/备注
                    </span>
                </div>
            </div>
        </DocPreview>
    </div>
</template>
