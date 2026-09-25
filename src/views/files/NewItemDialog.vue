<script setup lang="ts">
import { computed, ref } from "vue";
import { modalJelly } from "@/composables/useGsapTransition";
import { OVERLAY_ID, useZxOverlay } from "@/composables/useOverlayStack";

const props = defineProps<{
    modelValue: boolean;
    itemType: "file" | "folder";
    itemName: string;
}>();

const emit = defineEmits<{
    "update:modelValue": [value: boolean];
    "update:itemType": [value: "file" | "folder"];
    "update:itemName": [value: string];
    confirm: [];
}>();

const rootRef = ref<HTMLElement | null>(null);
const openState = computed({
    get: () => props.modelValue,
    set: (v: boolean) => emit("update:modelValue", v),
});
useZxOverlay({
    id: OVERLAY_ID.newItemDialog,
    open: openState,
    el: () => rootRef.value,
});
</script>

<template>
    <Transition :css="false" @enter="modalJelly.onEnter" @leave="modalJelly.onLeave">
        <div
            v-if="modelValue"
            ref="rootRef"
            class="glass-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
        >
            <div
                class="modal-content w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl sm:p-6"
                @click.stop
            >
                <h3 class="mb-4 text-lg font-semibold text-zx-text-strong">
                    新建{{ itemType === "file" ? "文件" : "文件夹" }}
                </h3>

                <div class="mb-4 flex space-x-4">
                    <button
                        :class="
                            itemType === 'file'
                                ? 'bg-zx-primary-tint text-zx-primary'
                                : 'bg-gray-100 text-zx-text-muted'
                        "
                        class="flex-1 cursor-pointer rounded-2xl px-4 py-2 text-sm font-medium transition-colors"
                        @click="emit('update:itemType', 'file')"
                    >
                        文件
                    </button>
                    <button
                        :class="
                            itemType === 'folder'
                                ? 'bg-zx-primary-tint text-zx-primary'
                                : 'bg-gray-100 text-zx-text-muted'
                        "
                        class="flex-1 cursor-pointer rounded-2xl px-4 py-2 text-sm font-medium transition-colors"
                        @click="emit('update:itemType', 'folder')"
                    >
                        文件夹
                    </button>
                </div>

                <ZXInput
                    :model-value="itemName"
                    class="mb-4"
                    rounded="2xl"
                    size="lg"
                    placeholder="请输入名称"
                    @update:model-value="(v: string | number) => emit('update:itemName', String(v))"
                    @keyup.enter="emit('confirm')"
                />

                <div class="flex space-x-3">
                    <button
                        class="flex-1 cursor-pointer rounded-2xl bg-gray-100 px-4 py-2 text-sm font-medium text-zx-text transition-colors hover:bg-gray-200"
                        @click="emit('update:modelValue', false)"
                    >
                        取消
                    </button>
                    <button
                        class="flex-1 cursor-pointer rounded-2xl bg-zx-primary px-4 py-2 text-sm font-medium text-[color:var(--zx-color-on-primary)] transition-colors hover:bg-zx-primary-hover"
                        @click="emit('confirm')"
                    >
                        确定
                    </button>
                </div>
            </div>
        </div>
    </Transition>
</template>
