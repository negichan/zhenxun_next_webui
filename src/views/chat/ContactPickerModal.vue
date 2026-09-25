<script setup lang="ts">
import { computed, ref } from "vue";
import { X, Users, UserRound } from "lucide-vue-next";
import { storeToRefs } from "pinia";
import { useChatStore } from "@/store/chat.ts";
import { modalJelly } from "@/composables/useGsapTransition";
import ZxAvatar from "@/components/zxcomponent/ZxAvatar.vue";
import ZXInput from "@/components/zxcomponent/ZXInput.vue";
import ZxEmptyState from "@/components/zxcomponent/ZxEmptyState.vue";

export interface ForwardTarget {
    type: "friend" | "group";
    id: string;
    name: string;
}

export type ForwardMode = "individual" | "merged";

const props = defineProps<{ visible: boolean }>();
const emit = defineEmits<{
    close: [];
    pick: [target: ForwardTarget, mode: ForwardMode];
}>();

const { friends, groups } = storeToRefs(useChatStore());
const keyword = ref("");
const mode = ref<ForwardMode>("individual");

interface Row {
    type: "friend" | "group";
    id: string;
    name: string;
    avatar: string;
}

const rows = computed<Row[]>(() => {
    const kw = keyword.value.trim().toLowerCase();
    const all: Row[] = [
        ...groups.value.map((g) => ({
            type: "group" as const,
            id: String(g.group_id),
            name: g.group_name || String(g.group_id),
            avatar: g.ava_url || "",
        })),
        ...friends.value.map((f) => ({
            type: "friend" as const,
            id: String(f.user_id),
            name: f.remark || f.nickname || String(f.user_id),
            avatar: f.ava_url || "",
        })),
    ];
    if (!kw) return all;
    return all.filter(
        (r) => r.name.toLowerCase().includes(kw) || r.id.includes(kw),
    );
});

const onPick = (r: Row) => {
    emit("pick", { type: r.type, id: r.id, name: r.name }, mode.value);
};
</script>

<template>
    <Teleport to="body">
        <Transition :css="false" @enter="modalJelly.onEnter" @leave="modalJelly.onLeave">
            <div
                v-if="visible"
                class="fixed inset-0 z-50 flex items-center justify-center"
            >
                <div class="glass-overlay absolute h-full w-full"></div>
                <div
                    class="modal-content relative z-1 flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl max-sm:mx-4"
                >
                    <div class="flex items-center gap-2.5 px-5 py-4">
                        <Users class="h-5 w-5 shrink-0 text-[var(--zx-color-text-muted)]" />
                        <p class="min-w-0 flex-1 truncate text-lg font-bold text-[var(--zx-color-text)]">
                            转发给
                        </p>
                        <button
                            type="button"
                            class="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-[var(--zx-color-text-muted)] transition-colors hover:bg-[var(--zx-color-surface-muted)] hover:text-[var(--zx-color-text)]"
                            @click="emit('close')"
                        >
                            <X class="h-4 w-4" />
                        </button>
                    </div>

                    <div class="px-4 pb-2">
                        <ZXInput
                            v-model="keyword"
                            type="search"
                            placeholder="搜索联系人 / 群"
                        />
                    </div>

                    <div class="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
                        <ZxEmptyState
                            v-if="rows.length === 0"
                            size="sm"
                            text="没有匹配的联系人"
                        />
                        <button
                            v-for="r in rows"
                            :key="r.type + r.id"
                            type="button"
                            class="flex w-full cursor-pointer items-center gap-3 rounded-2xl px-3 py-2 text-left transition-colors hover:bg-[var(--zx-color-surface-muted)]"
                            @click="onPick(r)"
                        >
                            <ZxAvatar :src="r.avatar" :name="r.name" size="sm" />
                            <span class="min-w-0 flex-1">
                                <span class="block truncate text-sm text-[var(--zx-color-text)]">{{
                                    r.name
                                }}</span>
                                <span class="block truncate text-xs text-[var(--zx-color-text-subtle)]">{{
                                    r.id
                                }}</span>
                            </span>
                            <UserRound
                                v-if="r.type === 'friend'"
                                class="h-4 w-4 shrink-0 text-[var(--zx-color-text-subtle)]"
                            />
                            <Users
                                v-else
                                class="h-4 w-4 shrink-0 text-[var(--zx-color-text-subtle)]"
                            />
                        </button>
                    </div>

                    <!-- 转发方式：逐条 / 合并（仿 QQNT 底部切换） -->
                    <div class="flex items-center gap-2 border-t border-slate-200 px-4 py-3">
                        <span class="shrink-0 text-xs text-[var(--zx-color-text-muted)]">方式</span>
                        <div class="flex flex-1 gap-1 rounded-full bg-[var(--zx-color-surface-muted)] p-1">
                            <button
                                type="button"
                                class="flex-1 cursor-pointer rounded-full py-1.5 text-xs font-medium transition-colors"
                                :class="mode === 'individual'
                                    ? 'bg-zx-primary text-[color:var(--zx-color-on-primary)]'
                                    : 'text-[var(--zx-color-text-muted)] hover:text-[var(--zx-color-text)]'"
                                @click="mode = 'individual'"
                            >
                                逐条转发
                            </button>
                            <button
                                type="button"
                                class="flex-1 cursor-pointer rounded-full py-1.5 text-xs font-medium transition-colors"
                                :class="mode === 'merged'
                                    ? 'bg-zx-primary text-[color:var(--zx-color-on-primary)]'
                                    : 'text-[var(--zx-color-text-muted)] hover:text-[var(--zx-color-text)]'"
                                @click="mode = 'merged'"
                            >
                                合并转发
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>
