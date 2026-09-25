<script setup lang="ts">
import { modalJelly } from "@/composables/useGsapTransition";
import { computed, ref, watch } from "vue";
import { Pin, PinOff, Search, SlidersHorizontal, X } from "lucide-vue-next";
import { useChatStore } from "@/store/chat.ts";
import { useBotStore } from "@/store/bot.ts";
import { getCachedMessages } from "@/utils/chat-message-db";
import { useDynamicVirtualList } from "@/composables/useDynamicVirtualList";
import MiniDatePicker from "@/components/zxcomponent/MiniDatePicker.vue";
import ZXInput from "@/components/zxcomponent/ZXInput.vue";
import type { ChatMessage } from "@/types";

const props = defineProps<{
    visible: boolean;
    contactType: "friend" | "group" | null;
    contactId: string;
    contactName: string;
}>();

const emit = defineEmits<{ close: [] }>();

const chatStore = useChatStore();
const botStore = useBotStore();

// ==================== 数据加载：内存 + IndexedDB 合并 ====================
const allMessages = ref<ChatMessage[]>([]);

watch(
    () => props.visible,
    async (visible) => {
        if (!visible) return;
        const botId = botStore.getSelectedBotId() || "anon";
        const key = `${botId}:${props.contactType}:${props.contactId}`;
        const inStore =
            (chatStore.messagesByConversation[key] as
                | ChatMessage[]
                | undefined) ?? [];
        let cached: ChatMessage[] = [];
        try {
            cached = (await getCachedMessages(key, 1000)) as ChatMessage[];
        } catch {
            cached = [];
        }
        const map = new Map<number, ChatMessage>();
        for (const m of [...inStore, ...cached]) map.set(m.id, m);
        allMessages.value = [...map.values()].sort(
            (a, b) =>
                new Date(a.timestamp).getTime() -
                new Date(b.timestamp).getTime(),
        );
        // 重置筛选
        searchKeyword.value = "";
        filterDate.value = "";
        filterMember.value = "";
        activeTab.value = "all";
    },
);

// ==================== 搜索与筛选 ====================
const searchKeyword = ref("");
const activeTab = ref("all");
const filterDate = ref("");
const filterMember = ref("");
const filterOpen = ref(false);

const tabs = [
    { key: "all", label: "全部" },
    { key: "media", label: "图片/视频" },
    { key: "face", label: "表情" },
    { key: "file", label: "文件" },
    { key: "link", label: "链接" },
];

const messageTypes = (m: ChatMessage) =>
    new Set<string>([
        m.message_type,
        ...(m.parts?.map((p) => p.type) ?? []),
    ]);

const matchTab = (m: ChatMessage, tab: string) => {
    if (tab === "all") return true;
    const types = messageTypes(m);
    if (tab === "media") return types.has("image") || types.has("video");
    if (tab === "face") return types.has("face");
    if (tab === "file")
        return types.has("file") || types.has("record");
    if (tab === "link")
        return ["json", "xml", "share", "music"].some((t) => types.has(t));
    return true;
};

// 发送人（群友）：从消息里提取去重（置顶的排最前）
const PIN_KEY = computed(
    () => `chat-history-pinned:${props.contactType}:${props.contactId}`,
);
const pinnedMembers = ref<string[]>([]);

const loadPinned = () => {
    try {
        pinnedMembers.value = JSON.parse(
            localStorage.getItem(PIN_KEY.value) || "[]",
        );
    } catch {
        pinnedMembers.value = [];
    }
};

const togglePin = (userId: string) => {
    const next = pinnedMembers.value.includes(userId)
        ? pinnedMembers.value.filter((id) => id !== userId)
        : [userId, ...pinnedMembers.value];
    pinnedMembers.value = next;
    try {
        localStorage.setItem(PIN_KEY.value, JSON.stringify(next));
    } catch {
        // 忽略存储失败
    }
};

const members = computed(() => {
    const map = new Map<string, { id: string; name: string }>();
    for (const m of allMessages.value) {
        if (m.is_self || !m.user_id) continue;
        if (!map.has(m.user_id)) {
            map.set(m.user_id, { id: m.user_id, name: m.user_name || m.user_id });
        }
    }
    return [...map.values()].sort((a, b) => {
        const pa = pinnedMembers.value.includes(a.id) ? 0 : 1;
        const pb = pinnedMembers.value.includes(b.id) ? 0 : 1;
        return pa - pb || a.name.localeCompare(b.name);
    });
});

// 发送人筛选下拉选项："" 表示全部（替代原 el-select 的 clearable 语义）
const memberFilterOptions = computed(() => [
    { label: "全部发送人", value: "" },
    ...members.value.map((member) => ({
        label: member.name,
        value: member.id,
    })),
]);

const hasMedia = (m: ChatMessage) =>
    m.message_type === "image" ||
    m.message_type === "video" ||
    (m.parts?.some((p) => p.type === "image" || p.type === "video") ?? false);

const previewOf = (m: ChatMessage) => {
    if (m.parts?.length) {
        return m.parts
            .map((p) =>
                p.type === "image"
                    ? "[图片]"
                    : p.type === "video"
                      ? "[视频]"
                      : p.type === "text"
                        ? p.content
                        : `[${p.type}]`,
            )
            .join(" ");
    }
    if (m.message_type === "image") return "[图片]";
    if (m.message_type === "video") return "[视频]";
    return m.message;
};

const filteredMessages = computed(() =>
    allMessages.value.filter((m) => {
        if (!matchTab(m, activeTab.value)) return false;
        if (filterDate.value && !m.timestamp.startsWith(filterDate.value))
            return false;
        if (filterMember.value && m.user_id !== filterMember.value)
            return false;
        const keyword = searchKeyword.value.trim().toLowerCase();
        if (
            keyword &&
            !previewOf(m).toLowerCase().includes(keyword) &&
            !(m.user_name || "").toLowerCase().includes(keyword)
        )
            return false;
        return true;
    }),
);

// ==================== 展示项：日期分组头 + 消息行（动态行高） ====================
interface HistoryItem {
    kind: "date" | "msg";
    key: string;
    label?: string;
    message?: ChatMessage;
}

const displayItems = computed<HistoryItem[]>(() => {
    const items: HistoryItem[] = [];
    let lastDate = "";
    for (const m of filteredMessages.value) {
        const date = m.timestamp.slice(0, 10);
        if (date && date !== lastDate) {
            items.push({
                kind: "date",
                key: `d-${date}`,
                label: date.replace(/-/g, "/"),
            });
            lastDate = date;
        }
        items.push({ kind: "msg", key: `m-${m.id}`, message: m });
    }
    return items;
});

const estimateHeight = (item: HistoryItem) => {
    if (item.kind === "date") return 36;
    if (hasMedia(item.message!)) return 300;
    return 110;
};

const dynamicList = useDynamicVirtualList(
    () => displayItems.value,
    (item) => item.key,
    estimateHeight,
);

// ==================== 消息行内容块 ====================
interface ContentBlock {
    kind: string;
    text?: string;
    src?: string;
}

const contentBlocks = (m: ChatMessage): ContentBlock[] => {
    if (m.parts?.length) {
        return m.parts.map((p) => ({
            kind: p.type,
            text: p.type === "text" ? p.content : undefined,
            src: p.type === "image" ? p.content : undefined,
        }));
    }
    if (m.message_type === "image")
        return [{ kind: "image", src: m.message }];
    if (m.message_type === "text") return [{ kind: "text", text: m.message }];
    return [{ kind: m.message_type, text: m.message }];
};

// 详细时间：2026-08-31 02:54:05
const formatTime = (timestamp: string) => {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return timestamp;
    const p = (n: number) => String(n).padStart(2, "0");
    return (
        `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
        `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
    );
};

/** 行头部发送者名称：自己的消息显示"我"，好友会话显示对方，群聊显示群友 */
const senderNameOf = (m: ChatMessage) => {
    if (m.is_self) return "我";
    if (m.user_name || m.user_id) return m.user_name || m.user_id;
    return props.contactName || "未知";
};

watch(
    () => [props.contactType, props.contactId],
    () => loadPinned(),
    { immediate: true },
);
</script>

<template>
    <Teleport to="body">
        <Transition :css="false" @enter="modalJelly.onEnter" @leave="modalJelly.onLeave">
            <div
                v-if="visible"
                class="fixed inset-0 z-50 flex items-center justify-center"
            >
                <div
                    class="glass-overlay absolute h-full w-full"
                    @click.self="emit('close')"
                ></div>
                <div
                    class="modal-content relative z-1 flex h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl max-sm:mx-4"
                >
                    <!-- 搜索框 -->
                    <div class="shrink-0 px-5 pt-5 pb-3">
                        <ZXInput
                            v-model="searchKeyword"
                            type="search"
                            placeholder="搜索"
                        />
                    </div>

                    <!-- tab 行 + 筛选按钮 -->
                    <div
                        class="flex shrink-0 items-center gap-1 border-b border-slate-100 px-5 pb-3"
                    >
                        <button
                            v-for="tab in tabs"
                            :key="tab.key"
                            class="relative cursor-pointer px-3 py-1.5 text-sm transition-colors"
                            :class="
                                activeTab === tab.key
                                    ? 'font-semibold text-zx-primary'
                                    : 'text-zx-text-muted hover:text-zx-text'
                            "
                            type="button"
                            @click="activeTab = tab.key"
                        >
                            {{ tab.label }}
                            <span
                                v-if="activeTab === tab.key"
                                class="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-zx-primary"
                            ></span>
                        </button>

                        <button
                            class="btn-touch ml-auto flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm transition-colors"
                            :class="
                                filterOpen || filterDate || filterMember
                                    ? 'bg-zx-primary-soft text-zx-primary'
                                    : 'bg-slate-100 text-zx-text-muted hover:bg-slate-200 hover:text-zx-text'
                            "
                            type="button"
                            @click="filterOpen = !filterOpen"
                        >
                            筛选
                            <SlidersHorizontal class="h-3.5 w-3.5" />
                        </button>
                    </div>

                    <div class="flex min-h-0 flex-1">
                        <!-- 消息列表（动态行高虚拟滚动） -->
                        <div class="flex min-w-0 flex-1 flex-col">
                            <div
                                v-if="displayItems.length > 0"
                                :ref="dynamicList.container"
                                class="min-h-0 flex-1 overflow-y-auto px-5"
                                @scroll.passive="dynamicList.onScroll"
                            >
                                <div
                                    class="relative"
                                    :style="{
                                        height: `${dynamicList.totalHeight.value}px`,
                                    }"
                                >
                                    <div
                                        v-for="item in displayItems.slice(
                                            dynamicList.startIndex.value,
                                            dynamicList.endIndex.value,
                                        )"
                                        :key="item.key"
                                        :ref="
                                            (el) =>
                                                dynamicList.measureItem(
                                                    el,
                                                    item,
                                                )
                                        "
                                        class="absolute left-0 right-0"
                                        :style="{
                                            top: `${dynamicList.offsetAt(displayItems.indexOf(item))}px`,
                                        }"
                                    >
                                        <!-- 日期分组头 -->
                                        <div
                                            v-if="item.kind === 'date'"
                                            class="flex h-9 items-center text-xs font-semibold text-zx-text-subtle"
                                        >
                                            {{ item.label }}
                                        </div>

                                        <!-- 消息行 -->
                                        <div
                                            v-else
                                            class="flex gap-3 border-b border-slate-100 py-3 pr-2"
                                        >
                                            <ZxAvatar
                                                :src="item.message?.avatar"
                                                :name="
                                                    item.message?.user_name ||
                                                    item.message?.user_id ||
                                                    '?'
                                                "
                                                size="md"
                                                class="shrink-0"
                                            />

                                            <div class="min-w-0 flex-1">
                                                <!-- 发送者（浅色小字，避免与内容混淆） -->
                                                <p
                                                    class="pb-1 text-xs font-semibold leading-4 text-zx-text-subtle"
                                                >
                                                    {{
                                                        senderNameOf(
                                                            item.message!,
                                                        )
                                                    }}
                                                </p>

                                                <!-- 内容块 -->
                                                <div
                                                    class="space-y-1.5 text-sm leading-5 text-zx-text"
                                                >
                                                    <template
                                                        v-for="(
                                                            block, bi
                                                        ) in contentBlocks(
                                                            item.message!,
                                                        )"
                                                        :key="bi"
                                                    >
                                                        <p
                                                            v-if="
                                                                block.kind ===
                                                                'text'
                                                            "
                                                            class="whitespace-pre-wrap break-words"
                                                        >
                                                            {{ block.text }}
                                                        </p>
                                                        <img
                                                            v-else-if="
                                                                block.kind ===
                                                                    'image' &&
                                                                block.src
                                                            "
                                                            v-image-viewer:chat-history
                                                            :src="block.src"
                                                            referrerpolicy="no-referrer"
                                                            class="max-h-60 max-w-60 rounded-lg border border-slate-100 object-cover"
                                                            loading="lazy"
                                                            @error="
                                                                (e) =>
                                                                    ((e.target as HTMLImageElement).style.display =
                                                                        'none')
                                                            "
                                                        />
                                                        <p
                                                            v-else-if="
                                                                block.kind ===
                                                                'video'
                                                            "
                                                            class="text-zx-text-subtle"
                                                        >
                                                            [视频]
                                                        </p>
                                                        <p
                                                            v-else
                                                            class="text-zx-text-subtle"
                                                        >
                                                            [{{ block.kind }}]
                                                        </p>
                                                    </template>

                                                    <!-- 详细时间：放消息下方 -->
                                                    <p
                                                        class="pt-0.5 text-[11px] text-zx-text-subtle"
                                                    >
                                                        {{
                                                            formatTime(
                                                                item.message
                                                                    ?.timestamp ??
                                                                    "",
                                                            )
                                                        }}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <p
                                v-else
                                class="flex flex-1 items-center justify-center text-xs text-[var(--zx-color-text-subtle)]"
                            >
                                没有符合条件的历史消息
                            </p>
                        </div>

                        <!-- 筛选条件面板 -->
                        <div
                            v-if="filterOpen"
                            class="flex w-60 shrink-0 flex-col border-l border-slate-100 px-5 pt-4"
                        >
                            <div
                                class="flex items-center justify-between pb-3"
                            >
                                <p class="text-sm font-bold text-zx-text">
                                    筛选条件
                                </p>
                                <button
                                    class="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-zx-text-subtle transition-colors hover:bg-slate-100 hover:text-zx-text-muted"
                                    type="button"
                                    @click="filterOpen = false"
                                >
                                    <X class="h-3.5 w-3.5" />
                                </button>
                            </div>

                            <p
                                class="pb-1.5 text-xs font-medium text-zx-text-muted"
                            >
                                发送日期
                            </p>
                            <MiniDatePicker v-model="filterDate" />

                            <template v-if="contactType === 'group'">
                                <p
                                    class="pb-1.5 pt-4 text-xs font-medium text-zx-text-muted"
                                >
                                    发送人
                                </p>
                                <div class="flex items-center gap-1.5">
                                    <ZXSelect
                                        v-model="filterMember"
                                        :options="memberFilterOptions"
                                        placeholder="选择发送人"
                                        trigger-class="min-w-0 flex-1 justify-between gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-zx-text-muted transition-colors hover:border-slate-300 focus-within:bg-white"
                                    >
                                        <template
                                            #option="{
                                                option,
                                            }: {
                                                option: {
                                                    label: string;
                                                    value: string;
                                                };
                                            }"
                                        >
                                            <span
                                                class="flex items-center gap-1.5"
                                            >
                                                <Pin
                                                    v-if="
                                                        pinnedMembers.includes(
                                                            option.value,
                                                        )
                                                    "
                                                    class="h-3 w-3 shrink-0 text-zx-primary"
                                                />
                                                <span class="truncate">{{
                                                    option.label
                                                }}</span>
                                            </span>
                                        </template>
                                    </ZXSelect>
                                    <button
                                        v-if="filterMember"
                                        class="btn-touch flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-zx-text-subtle transition-colors hover:bg-slate-100"
                                        :class="
                                            pinnedMembers.includes(filterMember)
                                                ? 'text-zx-primary'
                                                : ''
                                        "
                                        type="button"
                                        :title="
                                            pinnedMembers.includes(filterMember)
                                                ? '取消置顶该发送人'
                                                : '置顶该发送人'
                                        "
                                        @click="togglePin(filterMember)"
                                    >
                                        <PinOff
                                            v-if="
                                                pinnedMembers.includes(
                                                    filterMember,
                                                )
                                            "
                                            class="h-4 w-4"
                                        />
                                        <Pin v-else class="h-4 w-4" />
                                    </button>
                                </div>
                                <p
                                    class="pt-2 text-[11px] leading-relaxed text-zx-text-subtle"
                                >
                                    选中发送人后点图钉可置顶，置顶的会排在下拉列表最前面
                                </p>
                            </template>
                        </div>
                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>
