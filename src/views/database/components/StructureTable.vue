<script setup lang="ts">
import type { TableColumn } from "@/types/api-next.types";

defineProps<{
    columns: TableColumn[];
}>();
</script>

<template>
    <div class="h-full overflow-auto">
        <table class="min-w-full border-collapse">
            <thead class="sticky top-0 z-10 bg-gray-50">
                <tr>
                    <th
                        class="border-b border-gray-200 px-4 py-3 text-left text-xs font-medium tracking-wider whitespace-nowrap text-zx-text-muted uppercase"
                    >
                        列名
                    </th>
                    <th
                        class="border-b border-gray-200 px-4 py-3 text-left text-xs font-medium tracking-wider whitespace-nowrap text-zx-text-muted uppercase"
                    >
                        类型
                    </th>
                    <th
                        class="border-b border-gray-200 px-4 py-3 text-left text-xs font-medium tracking-wider whitespace-nowrap text-zx-text-muted uppercase"
                    >
                        可空
                    </th>
                    <th
                        class="border-b border-gray-200 px-4 py-3 text-left text-xs font-medium tracking-wider whitespace-nowrap text-zx-text-muted uppercase"
                    >
                        默认值
                    </th>
                    <th
                        class="border-b border-gray-200 px-4 py-3 text-left text-xs font-medium tracking-wider whitespace-nowrap text-zx-text-muted uppercase"
                    >
                        主键
                    </th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 bg-white">
                <tr
                    v-for="col in columns"
                    :key="col.name"
                    class="hover:bg-gray-50"
                >
                    <td class="px-4 py-3 text-sm font-medium text-zx-text">
                        {{ col.name }}
                    </td>
                    <td class="px-4 py-3 font-mono text-sm text-zx-text-muted">
                        {{ col.type || "-" }}
                    </td>
                    <td class="px-4 py-3 text-sm">
                        <span :class="col.nullable ? 'text-green-600' : 'text-zx-text-subtle'">
                            {{ col.nullable ? "是" : "否" }}
                        </span>
                    </td>
                    <td class="px-4 py-3 font-mono text-sm text-zx-text-muted">
                        {{ col.default ?? "NULL" }}
                    </td>
                    <td class="px-4 py-3 text-sm">
                        <ZxTag v-if="col.primary_key" variant="warning">主键</ZxTag>
                        <span v-else class="text-zx-text-subtle">—</span>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
</template>
