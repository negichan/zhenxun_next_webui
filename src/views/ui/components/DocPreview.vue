<script setup lang="ts">
import { ref } from "vue";
import { Check, Code2, Copy } from "lucide-vue-next";
import { ZXNotification } from "@/services/ui";

const props = withDefaults(
    defineProps<{
        id?: string;
        title?: string;
        description?: string;
        code?: string;
        align?: "center" | "start" | "stretch";
        defaultExpanded?: boolean;
    }>(),
    {
        align: "center",
        defaultExpanded: false,
    },
);

const isExpanded = ref(props.defaultExpanded);
const copied = ref(false);

const handleCopy = async () => {
    if (!props.code) return;
    try {
        await navigator.clipboard.writeText(props.code);
        copied.value = true;
        setTimeout(() => {
            copied.value = false;
        }, 1800);
    } catch {
        ZXNotification({ message: "复制失败", type: "error" });
    }
};
</script>

<template>
    <div :id="id" class="scroll-mt-6 space-y-2">
        <!-- 章节标题与简要说明 -->
        <div v-if="title || description" class="group">
            <h2
                v-if="title"
                class="text-sm font-semibold text-slate-800 flex items-center gap-1.5"
            >
                <span>{{ title }}</span>
                <a
                    v-if="id"
                    :href="`#${id}`"
                    class="opacity-0 group-hover:opacity-100 text-zx-primary text-xs font-normal transition-opacity cursor-pointer select-none"
                    >#</a
                >
            </h2>
            <p
                v-if="description"
                class="mt-0.5 text-xs text-slate-400 leading-normal"
            >
                {{ description }}
            </p>
        </div>

        <!-- 演示盒子：对齐 VitePress 规范（上部画板 + 底部工具栏 + 折叠代码面板） -->
        <div
            class="rounded-lg border border-slate-200/90 bg-white overflow-hidden shadow-2xs"
        >
            <!-- 1. 上半部：组件视口画布 -->
            <div
                class="flex min-h-[130px] w-full p-5 bg-slate-50/30"
                :class="{
                    'items-center justify-center': align === 'center',
                    'items-start justify-start': align === 'start',
                    'items-stretch justify-stretch': align === 'stretch',
                }"
            >
                <slot />
            </div>

            <!-- 2. 中间操作工具栏 (VitePress 核心：默认折叠，提供代码展开与复制代码) -->
            <div
                v-if="code"
                class="flex h-7 items-center justify-end gap-1 border-t border-slate-200/80 bg-slate-50/60 px-2 text-slate-500"
            >
                <button
                    type="button"
                    class="btn-touch flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-slate-500 hover:bg-slate-200/60 hover:text-slate-800 cursor-pointer transition-colors"
                    :title="copied ? '已复制' : '复制代码'"
                    @click="handleCopy"
                >
                    <Check v-if="copied" class="h-3 w-3 text-emerald-500" />
                    <Copy v-else class="h-3 w-3" />
                    <span>{{ copied ? "已复制" : "复制" }}</span>
                </button>
                <button
                    type="button"
                    class="btn-touch flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] transition-colors cursor-pointer"
                    :class="
                        isExpanded
                            ? 'bg-slate-200/70 text-slate-800 font-medium'
                            : 'text-slate-500 hover:bg-slate-200/60 hover:text-slate-800'
                    "
                    @click="isExpanded = !isExpanded"
                >
                    <Code2 class="h-3 w-3" />
                    <span>{{ isExpanded ? "收起代码" : "查看代码" }}</span>
                </button>
            </div>

            <!-- 3. 下半部：折叠代码面板 (默认折叠收起) -->
            <div
                v-if="code && isExpanded"
                class="border-t border-slate-800 bg-slate-950 p-3 text-slate-200 font-mono text-[11px] leading-relaxed overflow-x-auto"
            >
                <pre class="whitespace-pre"><code>{{ code }}</code></pre>
            </div>
        </div>
    </div>
</template>
