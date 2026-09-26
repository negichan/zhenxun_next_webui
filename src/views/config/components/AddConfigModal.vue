<script setup lang="ts">
import { ref, watch } from "vue";
import { Plus } from "lucide-vue-next";
import ZxButton from "@/components/zxcomponent/ZxButton.vue";
import ZxModal from "@/components/zxcomponent/ZxModal.vue";
import { ZXNotification } from "@/services/ui";

const props = defineProps<{
    visible: boolean;
    existingKeys?: string[];
}>();

const emit = defineEmits<{
    (e: "update:visible", val: boolean): void;
    (
        e: "confirm",
        data: { key: string; value: string; comment: string },
    ): void;
}>();

const keyInput = ref("");
const valueInput = ref("");
const commentInput = ref("");

const open = ref(false);

watch(
    () => props.visible,
    (val) => {
        open.value = val;
        if (val) {
            keyInput.value = "";
            valueInput.value = "";
            commentInput.value = "";
        }
    },
);

watch(open, (val) => {
    if (!val && props.visible) emit("update:visible", false);
});

const applyPreset = (type: "string" | "boolean" | "array" | "json") => {
    switch (type) {
        case "string":
            valueInput.value = '""';
            break;
        case "boolean":
            valueInput.value = "True";
            break;
        case "array":
            valueInput.value = "[]";
            break;
        case "json":
            valueInput.value = "{}";
            break;
    }
};

const handleConfirm = () => {
    const rawKey = keyInput.value.trim().toUpperCase();
    if (!rawKey) {
        ZXNotification({
            title: "键名不能为空",
            message: "请输入合法的配置键名 (例如 HOST, PORT, NICKNAME)",
            type: "warning",
        });
        return;
    }

    if (!/^[A-Za-z0-9_]+$/.test(rawKey)) {
        ZXNotification({
            title: "键名格式不合法",
            message: "键名只允许包含英文字母、数字和下划线",
            type: "error",
        });
        return;
    }

    if (props.existingKeys?.includes(rawKey)) {
        ZXNotification({
            title: "配置已存在",
            message: `配置键 "${rawKey}" 已在 .env.dev 中存在，请勿重复添加`,
            type: "warning",
        });
        return;
    }

    let val = valueInput.value.trim();
    if (!val) {
        val = '""';
    }

    emit("confirm", {
        key: rawKey,
        value: val,
        comment: commentInput.value.trim(),
    });

    open.value = false;
};
</script>

<template>
    <ZxModal
        v-model="open"
        title="新增环境变量配置"

        :icon="Plus"
        size="md"
    >
        <div class="space-y-4 py-1">
            <!-- 键名 -->
            <div>
                <label
                    class="mb-1 block text-xs font-semibold text-zx-text-strong"
                >
                    配置键名 (Key)
                    <span class="text-zx-danger">*</span>
                </label>
                <ZXInput
                    v-model="keyInput"
                    rounded="xl"
                    placeholder="例如: BOT_RUN_MODE, SYSTEM_PROXY"
                    class="font-mono text-xs"
                    @keydown.enter.prevent="handleConfirm"
                />
                <p class="mt-1 text-[11px] text-zx-text-subtle">
                    建议全大写英文字母与下划线，保存时将自动规范化
                </p>
            </div>

            <!-- 注释说明 -->
            <div>
                <label
                    class="mb-1 block text-xs font-semibold text-zx-text-strong"
                >
                    配置说明 / 注释（可选）
                </label>
                <ZXInput
                    v-model="commentInput"
                    rounded="xl"
                    placeholder="说明此配置的用途或示例"
                />
            </div>

            <!-- 配置值 -->
            <div>
                <div class="mb-1 flex flex-wrap items-center justify-between gap-2">
                    <label class="text-xs font-semibold text-zx-text-strong">
                        配置初始值 (Value)
                    </label>
                    <!-- 快速填充：中性未选态胶囊 -->
                    <div class="flex flex-wrap items-center gap-1">
                        <span class="mr-1 text-[11px] text-zx-text-muted">
                            快速填充
                        </span>
                        <button
                            type="button"
                            class="btn-touch rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-zx-text-muted transition-colors hover:bg-gray-200 hover:text-zx-text"
                            @click="applyPreset('boolean')"
                        >
                            布尔
                        </button>
                        <button
                            type="button"
                            class="btn-touch rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-zx-text-muted transition-colors hover:bg-gray-200 hover:text-zx-text"
                            @click="applyPreset('string')"
                        >
                            文本
                        </button>
                        <button
                            type="button"
                            class="btn-touch rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-zx-text-muted transition-colors hover:bg-gray-200 hover:text-zx-text"
                            @click="applyPreset('array')"
                        >
                            列表
                        </button>
                        <button
                            type="button"
                            class="btn-touch rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-zx-text-muted transition-colors hover:bg-gray-200 hover:text-zx-text"
                            @click="applyPreset('json')"
                        >
                            JSON
                        </button>
                    </div>
                </div>
                <ZXInput
                    v-model="valueInput"
                    type="textarea"
                    :rows="3"
                    rounded="xl"
                    placeholder="例如: 8080，或带引号的文本，或 True"
                    input-class="font-mono text-xs"
                />
            </div>
        </div>

        <template #footer>
            <ZxButton variant="ghost" @click="open = false">取消</ZxButton>
            <ZxButton @click="handleConfirm">
                <Plus class="mr-1 h-3.5 w-3.5" />
                确认添加
            </ZxButton>
        </template>
    </ZxModal>
</template>
