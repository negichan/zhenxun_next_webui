<script setup lang="ts">
import { computed, ref } from "vue";
import { Check, Copy, Trash2 } from "lucide-vue-next";
import ZxSwitch from "@/components/zxcomponent/ZxSwitch.vue";
import ZxTag from "@/components/zxcomponent/ZxTag.vue";
import { ZXMessageBox, ZXNotification } from "@/services/ui";
import type { EnvEntry } from "../utils/envParser";
import { isExpandableEnvValue } from "../utils/envParser";

const props = defineProps<{
    entry: EnvEntry;
}>();

const emit = defineEmits<{
    (e: "update:value", val: string): void;
    (e: "delete", id: string): void;
}>();

// 复制状态提示
const copied = ref(false);
const copyValue = async () => {
    try {
        await navigator.clipboard.writeText(props.entry.value);
        copied.value = true;
        setTimeout(() => {
            copied.value = false;
        }, 1500);
    } catch {
        ZXNotification({
            title: "复制失败",
            message: "未能复制到剪贴板",
            type: "error",
        });
    }
};

// 布尔值快捷切换
const isBooleanValue = computed(() => {
    const v = props.entry.value.trim();
    return v === "True" || v === "False" || v === "true" || v === "false";
});

const isBooleanTrue = computed(() => {
    const v = props.entry.value.trim();
    return v === "True" || v === "true";
});

const toggleBoolean = (checked: boolean) => {
    emit("update:value", checked ? "True" : "False");
};

// 输入框直接更新值
const handleValueInput = (e: Event) => {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement;
    emit("update:value", target.value);
};

// 删除配置项二次确认
const handleDelete = async () => {
    const ok = await ZXMessageBox({
        title: "确认删除配置？",
        message: `确定要从 .env.dev 中删除配置项「${props.entry.key}」吗？保存后生效。`,
        type: "error",
        confirmButtonText: "确认删除",
        cancelButtonText: "取消",
    });
    if (ok) {
        emit("delete", props.entry.id);
    }
};
</script>

<template>
    <div
        v-tile-glow
        class="group relative flex flex-col justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs transition-colors hover:border-slate-300"
        :class="entry.isMultiLine ? '2xl:col-span-2' : ''"
    >
        <!-- 卡片头部：键名 + 敏感标 + 操作按钮 -->
        <div class="flex items-center justify-between gap-2 min-w-0">
            <div class="flex items-center gap-2 min-w-0">
                <span
                    class="font-mono text-xs sm:text-sm font-bold text-zx-text-strong tracking-tight truncate select-text"
                    :title="entry.comment ? `${entry.key}: ${entry.comment}` : entry.key"
                >
                    {{ entry.key }}
                </span>
                <ZxTag
                    v-if="entry.isSecret"
                    variant="warning"
                    class="h-5 px-2 text-[10px]"
                >
                    密钥
                </ZxTag>
            </div>

            <!-- 快捷按钮组 -->
            <div class="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                <button
                    type="button"
                    class="btn-touch p-1.5 text-zx-text-subtle hover:text-zx-primary hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    :title="copied ? '已复制' : '复制配置值'"
                    @click="copyValue"
                >
                    <Check v-if="copied" class="h-3.5 w-3.5 text-zx-success" />
                    <Copy v-else class="h-3.5 w-3.5" />
                </button>
                <button
                    type="button"
                    class="btn-touch p-1.5 text-zx-text-subtle hover:text-zx-danger hover:bg-zx-danger-soft rounded-lg transition-colors cursor-pointer"
                    title="删除配置项"
                    @click="handleDelete"
                >
                    <Trash2 class="h-3.5 w-3.5" />
                </button>
            </div>
        </div>

        <!-- 值输入控件区域 -->
        <div>
            <!-- 布尔类型：开关 + 右侧原始值 -->
            <div
                v-if="isBooleanValue"
                class="flex items-center gap-2.5 px-1 py-1"
            >
                <ZxSwitch
                    :model-value="isBooleanTrue"
                    @update:model-value="toggleBoolean"
                />
                <span
                    class="ml-auto font-mono text-[11px] tabular-nums text-zx-text-subtle"
                >
                    {{ entry.value }}
                </span>
            </div>

            <!-- 结构化值（JSON/列表/名单键）：点进即展开长文本 -->
            <ZXInput
                v-else-if="isExpandableEnvValue(entry)"
                :model-value="entry.value"
                expandable
                :expand-threshold="0"
                rounded="xl"
                placeholder="请输入配置值..."
                class="font-mono text-xs"
                @update:model-value="emit('update:value', String($event))"
            />

            <!-- 密钥敏感项：默认遮罩输入框 + 眼睛切换 -->
            <ZXInput
                v-else-if="entry.isSecret && !entry.isMultiLine"
                type="password"
                :model-value="entry.value"
                rounded="xl"
                placeholder="请输入配置值..."
                class="font-mono text-xs tracking-wide"
                @update:model-value="emit('update:value', String($event))"
            />

            <!-- 复杂多行 / JSON / 列表 -->
            <ZXInput
                v-else-if="entry.isMultiLine"
                type="textarea"
                :rows="2"
                :model-value="entry.value"
                rounded="xl"
                placeholder="请输入配置值..."
                input-class="font-mono text-xs leading-relaxed"
                @update:model-value="emit('update:value', String($event))"
            />

            <!-- 普通单行文本 / 数值 -->
            <ZXInput
                v-else
                :model-value="entry.value"
                rounded="xl"
                placeholder="请输入配置值..."
                class="font-mono text-xs"
                @update:model-value="emit('update:value', String($event))"
            />
        </div>
    </div>
</template>
