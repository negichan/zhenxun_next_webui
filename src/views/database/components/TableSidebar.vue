<script setup lang="ts">
import { Search, Table } from "lucide-vue-next";
import { computed, ref } from "vue";

const props = defineProps<{
    tables: string[];
    selected?: string;
}>();

const emit = defineEmits<{
    select: [table: string];
}>();

const keyword = ref("");

const filtered = computed(() => {
    const q = keyword.value.trim().toLowerCase();
    if (!q) return props.tables;
    return props.tables.filter((t) => t.toLowerCase().includes(q));
});
</script>

<template>
    <aside
        class="flex min-h-0 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
    >
        <div
            class="flex flex-shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3"
        >
            <div class="flex items-center gap-2 text-sm font-semibold text-zx-text">
                <Table class="h-4 w-4 text-zx-primary" />
                <span>数据表</span>
            </div>
            <span
                class="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-zx-text-muted"
            >
                {{ tables.length }}
            </span>
        </div>

        <div v-if="tables.length > 6" class="border-b border-gray-100 p-2">
            <ZXInput
                v-model="keyword"
                type="search"
                placeholder="搜索表名..."
                size="sm"
            />
        </div>

        <div
            class="min-h-0 flex-1 overflow-x-auto p-2 lg:overflow-x-hidden lg:overflow-y-auto"
        >
            <div class="flex min-w-max flex-col gap-0.5 lg:min-w-0">
                <button
                    v-for="table in filtered"
                    :key="table"
                    type="button"
                    @click="emit('select', table)"
                    :class="
                        selected === table
                            ? 'bg-zx-primary-tint font-medium text-zx-primary'
                            : 'text-zx-text-muted hover:bg-slate-50 hover:text-zx-text-strong'
                    "
                    class="group relative flex max-w-56 flex-shrink-0 cursor-pointer items-center gap-2 rounded-xl py-2 pr-3 pl-3.5 text-left text-sm transition-colors lg:max-w-none lg:flex-shrink"
                >
                    <!-- 选中左侧色条 -->
                    <span
                        class="absolute top-1/2 left-0 h-4 w-[3px] -translate-y-1/2 rounded-full bg-zx-primary transition-opacity"
                        :class="selected === table ? 'opacity-100' : 'opacity-0'"
                    />
                    <Table
                        class="h-3.5 w-3.5 flex-shrink-0 transition-colors"
                        :class="
                            selected === table
                                ? 'text-zx-primary'
                                : 'text-zx-text-subtle group-hover:text-zx-text-muted'
                        "
                    />
                    <span class="truncate">{{ table }}</span>
                </button>
            </div>
            <ZxEmptyState
                v-if="tables.length === 0"
                :icon="Table"
                text="暂无数据表"
                size="sm"
            />
            <ZxEmptyState
                v-else-if="filtered.length === 0"
                :icon="Search"
                text="未找到匹配的表"
                sub-text="请尝试更换搜索关键字"
                size="sm"
            />
        </div>
    </aside>
</template>
