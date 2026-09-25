<script setup lang="ts">
defineProps<{
    columns: string[];
    rows: Record<string, any>[];
}>();

const formatCell = (value: unknown): string => {
    if (value === null || value === undefined) return "NULL";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
};
</script>

<template>
    <div class="h-full overflow-auto">
        <!-- w-max + min-w-full：内容多宽表就多宽，不足时至少撑满 -->
        <table class="w-max min-w-full border-collapse">
            <thead class="sticky top-0 z-10 bg-gray-50">
                <tr>
                    <th
                        v-for="col in columns"
                        :key="col"
                        class="border-b border-gray-200 px-4 py-3 text-left text-xs font-medium tracking-wider whitespace-nowrap text-zx-text-muted uppercase"
                    >
                        <span :title="col">{{ col }}</span>
                    </th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 bg-white">
                <tr
                    v-for="(row, index) in rows"
                    :key="index"
                    class="hover:bg-gray-50"
                >
                    <td
                        v-for="col in columns"
                        :key="col"
                        class="px-4 py-3 text-sm whitespace-pre-wrap break-all text-zx-text align-top"
                    >
                        <span
                            :title="formatCell(row[col])"
                            :class="
                                row[col] === null || row[col] === undefined
                                    ? 'text-zx-text-subtle italic'
                                    : ''
                            "
                        >
                            {{ formatCell(row[col]) }}
                        </span>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
</template>
