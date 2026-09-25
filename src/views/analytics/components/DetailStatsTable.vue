<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ArrowDown, ArrowUp, ArrowUpDown, Download } from "lucide-vue-next";
import { ZXNotification } from "@/services/ui";
import ZxButton from "@/components/zxcomponent/ZxButton.vue";
import ZxPagination from "@/components/zxcomponent/ZxPagination.vue";
import type {
    FriendStatistics,
    GroupStatistics,
} from "@/types/api-next.types";

const props = defineProps<{
    groups: GroupStatistics[];
    friends: FriendStatistics[];
    loading?: boolean;
}>();

type TabKey = "groups" | "friends";
type SortKey = "message_count" | "plugin_call_count";

const activeTab = ref<TabKey>("groups");
const tabOptions = computed(() => [
    { label: "群组", value: "groups" as const, badge: props.groups.length },
    { label: "好友", value: "friends" as const, badge: props.friends.length },
]);
const searchQuery = ref("");
const sortKey = ref<SortKey>("message_count");
const sortDesc = ref(true);
const currentPage = ref(1);
const pageSize = 10;

watch([activeTab, searchQuery, sortKey], () => {
    currentPage.value = 1;
});

const sortRows = <T extends { message_count: number; plugin_call_count: number }>(
    list: T[],
) =>
    [...list].sort((a, b) => {
        const delta = b[sortKey.value] - a[sortKey.value];
        return sortDesc.value ? delta : -delta;
    });

const filteredGroups = computed(() => {
    const q = searchQuery.value.trim().toLowerCase();
    const sorted = sortRows(props.groups);
    if (!q) return sorted;
    return sorted.filter(
        (g) =>
            g.group_name.toLowerCase().includes(q) || g.group_id.includes(q),
    );
});

const filteredFriends = computed(() => {
    const q = searchQuery.value.trim().toLowerCase();
    const sorted = sortRows(props.friends);
    if (!q) return sorted;
    return sorted.filter(
        (f) => f.user_name.toLowerCase().includes(q) || f.user_id.includes(q),
    );
});

const rows = computed(() =>
    activeTab.value === "groups" ? filteredGroups.value : filteredFriends.value,
);

const totalMessages = computed(() =>
    rows.value.reduce((sum, r) => sum + r.message_count, 0),
);

const totalCalls = computed(() =>
    rows.value.reduce((sum, r) => sum + r.plugin_call_count, 0),
);

const totalPages = computed(() =>
    Math.max(1, Math.ceil(rows.value.length / pageSize)),
);

const paginatedRows = computed(() => {
    const start = (currentPage.value - 1) * pageSize;
    return rows.value.slice(start, start + pageSize);
});

const rangeText = computed(() => {
    if (rows.value.length === 0) return "暂无数据";
    const start = (currentPage.value - 1) * pageSize + 1;
    const end = Math.min(currentPage.value * pageSize, rows.value.length);
    return `${start}–${end} / ${rows.value.length}`;
});

const rowName = (row: GroupStatistics | FriendStatistics) =>
    activeTab.value === "groups"
        ? (row as GroupStatistics).group_name
        : (row as FriendStatistics).user_name;

const rowId = (row: GroupStatistics | FriendStatistics) =>
    activeTab.value === "groups"
        ? (row as GroupStatistics).group_id
        : (row as FriendStatistics).user_id;

const messageShare = (count: number) => {
    if (totalMessages.value === 0) return 0;
    return (count / totalMessages.value) * 100;
};

const goPage = (page: number) => {
    currentPage.value = Math.min(Math.max(1, page), totalPages.value);
};

const toggleSort = (key: SortKey) => {
    if (sortKey.value === key) {
        sortDesc.value = !sortDesc.value;
    } else {
        sortKey.value = key;
        sortDesc.value = true;
    }
};

const sortIcon = (key: SortKey) => {
    if (sortKey.value !== key) return ArrowUpDown;
    return sortDesc.value ? ArrowDown : ArrowUp;
};

const exportCsv = () => {
    if (rows.value.length === 0) {
        ZXNotification({
            title: "导出失败",
            message: "当前没有可导出的数据 (っ °Д °;) っ",
            type: "error",
            position: "top-right",
        });
        return;
    }

    const isGroup = activeTab.value === "groups";
    const header = [
        "排名",
        isGroup ? "群组名称" : "用户名称",
        "ID",
        "消息数",
        "插件调用",
        "消息占比%",
    ];
    const body = rows.value.map((row, index) => {
        const name = rowName(row);
        const id = rowId(row);
        return [
            String(index + 1),
            `"${name.replace(/"/g, '""')}"`,
            id,
            String(row.message_count),
            String(row.plugin_call_count),
            messageShare(row.message_count).toFixed(1),
        ].join(",");
    });

    const csv = ["﻿" + header.join(","), ...body].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics-${activeTab.value}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    ZXNotification({
        title: "已导出",
        message: `analytics-${activeTab.value}.csv`,
        type: "info",
        position: "top-right",
    });
};
</script>

<template>
    <section
        class="shrink-0 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
    >
        <!-- 标题 + 操作（对齐 Warehouse Storage） -->
        <header
            class="flex flex-col gap-3 px-4 pt-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:pt-5"
        >
            <div class="flex flex-wrap items-center gap-3">
                <h3 class="text-sm font-semibold text-zx-text-strong sm:text-base">
                    明细统计
                </h3>
                <ZxSegmented
                    v-model="activeTab"
                    :options="tabOptions"
                    size="sm"
                />
            </div>

            <div class="flex items-center gap-2">
                <div class="w-full sm:w-52">
                    <ZXInput
                        v-model="searchQuery"
                        type="search"
                        :placeholder="
                            activeTab === 'groups'
                                ? '搜索群名 / 群号'
                                : '搜索昵称 / QQ'
                        "
                        size="sm"
                    />
                </div>
                <ZxButton
                    variant="outline"
                    size="sm"
                    :disabled="loading"
                    @click="exportCsv"
                >
                    <Download class="mr-1 h-3.5 w-3.5" />
                    导出
                </ZxButton>
            </div>
        </header>

        <!-- 表格 -->
        <div class="mt-3 overflow-x-auto">
            <table class="w-full min-w-[680px] text-sm">
                <thead>
                    <tr class="border-b border-slate-100">
                        <th
                            class="w-12 px-4 py-2.5 text-left text-[11px] font-medium text-zx-text-subtle sm:px-5"
                        >
                            #
                        </th>
                        <th
                            class="px-2 py-2.5 text-left text-[11px] font-medium text-zx-text-subtle"
                        >
                            {{ activeTab === "groups" ? "群组" : "用户" }}
                        </th>
                        <th
                            class="w-28 px-2 py-2.5 text-right text-[11px] font-medium text-zx-text-subtle"
                        >
                            <button
                                type="button"
                                class="inline-flex items-center gap-1 transition-colors"
                                :class="
                                    sortKey === 'message_count'
                                        ? 'text-zx-text-strong'
                                        : 'hover:text-zx-text'
                                "
                                @click="toggleSort('message_count')"
                            >
                                消息
                                <component
                                    :is="sortIcon('message_count')"
                                    class="h-3 w-3"
                                />
                            </button>
                        </th>
                        <th
                            class="w-24 px-2 py-2.5 text-right text-[11px] font-medium text-zx-text-subtle"
                        >
                            <button
                                type="button"
                                class="inline-flex items-center gap-1 transition-colors"
                                :class="
                                    sortKey === 'plugin_call_count'
                                        ? 'text-zx-text-strong'
                                        : 'hover:text-zx-text'
                                "
                                @click="toggleSort('plugin_call_count')"
                            >
                                调用
                                <component
                                    :is="sortIcon('plugin_call_count')"
                                    class="h-3 w-3"
                                />
                            </button>
                        </th>
                        <th
                            class="w-44 px-4 py-2.5 text-left text-[11px] font-medium text-zx-text-subtle sm:px-5"
                        >
                            消息占比
                        </th>
                        <th
                            class="w-16 px-2 py-2.5 text-right text-[11px] font-medium text-zx-text-subtle sm:pr-5"
                        >
                            比例
                        </th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-if="loading">
                        <td colspan="6" class="px-4 py-16 sm:px-5">
                            <div class="flex items-center justify-center">
                                <div
                                    class="h-7 w-7 animate-spin rounded-full border-2 border-zx-primary border-b-transparent"
                                ></div>
                            </div>
                        </td>
                    </tr>
                    <tr v-else-if="rows.length === 0">
                        <td colspan="6" class="px-4 py-16 sm:px-5">
                            <ZxEmptyState
                                :text="
                                    searchQuery
                                        ? '没有匹配的记录'
                                        : '该时间范围内暂无明细'
                                "
                                :sub-text="
                                    searchQuery
                                        ? '换个关键字，或切换上方群组 / 好友'
                                        : '可尝试放宽时间范围后再看'
                                "
                                size="sm"
                            />
                        </td>
                    </tr>
                    <template v-else>
                        <tr
                            v-for="(row, index) in paginatedRows"
                            :key="rowId(row)"
                            class="border-b border-slate-50 transition-colors last:border-0 hover:bg-slate-50/60"
                        >
                            <td
                                class="px-4 py-3 text-xs tabular-nums text-zx-text-subtle sm:px-5"
                            >
                                {{ index + 1 + (currentPage - 1) * pageSize }}
                            </td>
                            <td class="px-2 py-3">
                                <div class="flex min-w-0 items-center gap-2.5">
                                    <ZxAvatar
                                        :src="row.ava_url"
                                        :name="rowName(row)"
                                        size="sm"
                                        class="flex-shrink-0"
                                    />
                                    <div class="min-w-0">
                                        <div
                                            class="truncate text-sm font-medium text-zx-text-strong"
                                            :title="rowName(row)"
                                        >
                                            {{ rowName(row) }}
                                        </div>
                                        <div
                                            class="truncate text-[11px] tabular-nums text-zx-text-subtle"
                                        >
                                            {{ rowId(row) }}
                                        </div>
                                    </div>
                                </div>
                            </td>
                            <td
                                class="px-2 py-3 text-right font-medium tabular-nums text-zx-text-strong"
                            >
                                {{ row.message_count.toLocaleString() }}
                            </td>
                            <td
                                class="px-2 py-3 text-right tabular-nums text-zx-text"
                            >
                                {{ row.plugin_call_count.toLocaleString() }}
                            </td>
                            <!-- Storage Used：进度条 -->
                            <td class="px-4 py-3 sm:px-5">
                                <div
                                    class="h-2 w-full max-w-[140px] overflow-hidden rounded-full bg-slate-100"
                                >
                                    <div
                                        class="h-full rounded-full bg-zx-primary transition-all duration-500"
                                        :style="{
                                            width: `${Math.max(messageShare(row.message_count), 3)}%`,
                                        }"
                                    ></div>
                                </div>
                            </td>
                            <td
                                class="px-2 py-3 text-right text-xs tabular-nums text-zx-text-muted sm:pr-5"
                            >
                                {{ messageShare(row.message_count).toFixed(1) }}%
                            </td>
                        </tr>
                    </template>
                </tbody>
            </table>
        </div>

        <!-- 页脚 -->
        <footer
            class="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5"
        >
            <div
                class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zx-text-muted"
            >
                <span>
                    合计消息
                    <strong class="font-semibold tabular-nums text-zx-text-strong">
                        {{ totalMessages.toLocaleString() }}
                    </strong>
                </span>
                <span class="text-zx-text-subtle">·</span>
                <span>
                    合计调用
                    <strong class="font-semibold tabular-nums text-zx-text-strong">
                        {{ totalCalls.toLocaleString() }}
                    </strong>
                </span>
                <span class="text-zx-text-subtle">·</span>
                <span class="tabular-nums">{{ rangeText }}</span>
            </div>

            <ZxPagination
                v-if="totalPages > 1"
                :page="currentPage"
                :page-size="pageSize"
                :total="rows.length"
                compact
                align="end"
                :show-total="false"
                @change="goPage"
            />
        </footer>
    </section>
</template>
