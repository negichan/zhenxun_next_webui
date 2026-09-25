<script setup lang="ts">
import { ref } from "vue";
import { Users } from "lucide-vue-next";
import DocPreview from "./DocPreview.vue";

const demoTab = ref("groups");
const demoGranularity = ref("day");
const demoAccent = ref("all");

const tabOptions = [
    { label: "群组", value: "groups", icon: Users, badge: 12 },
    { label: "好友", value: "friends", badge: 48 },
];

const timeOptions = [
    { label: "按小时", value: "hour" },
    { label: "按天", value: "day" },
    { label: "按月", value: "month" },
];

const accentOptions = [
    { label: "全部", value: "all" },
    { label: "已启用", value: "active" },
    { label: "已停用", value: "inactive" },
];
</script>

<template>
    <div class="space-y-10">
        <DocPreview
            id="seg-tab-badge"
            title="Tab 切换与计数徽标"
            description="options 支持 icon 与 badge，滑块指示器跟随选中项。"
            :code="`<ZxSegmented
    v-model=&quot;tab&quot;
    :options=&quot;[
        { label: '群组', value: 'groups', icon: Users, badge: 12 },
        { label: '好友', value: 'friends', badge: 48 }
    ]&quot;
/>`"
        >
            <div class="flex flex-col items-center gap-3">
                <ZxSegmented v-model="demoTab" :options="tabOptions" />
                <span class="text-xs text-slate-400">
                    当前选中项：{{ demoTab }}
                </span>
            </div>
        </DocPreview>

        <DocPreview
            id="seg-size-sm"
            title="尺寸 sm"
            description="工具条、岛屿控件常用紧凑档。"
            :code="`<ZxSegmented v-model=&quot;granularity&quot; :options=&quot;opts&quot; size=&quot;sm&quot; />`"
        >
            <ZxSegmented
                v-model="demoGranularity"
                :options="timeOptions"
                size="sm"
            />
        </DocPreview>

        <DocPreview
            id="seg-size-md"
            title="尺寸 md（默认）"
            description="表单、页面内主切换。"
            :code="`<ZxSegmented v-model=&quot;granularity&quot; :options=&quot;opts&quot; size=&quot;md&quot; />`"
        >
            <ZxSegmented
                v-model="demoGranularity"
                :options="timeOptions"
                size="md"
            />
        </DocPreview>

        <DocPreview
            id="seg-accent-filled"
            title="高亮风格 filled-primary"
            description="accent 支持 primary / neutral / filled-primary，filled-primary 为实色滑块。"
            :code="`<ZxSegmented v-model=&quot;status&quot; :options=&quot;opts&quot; accent=&quot;filled-primary&quot; />`"
        >
            <ZxSegmented
                v-model="demoAccent"
                :options="accentOptions"
                accent="filled-primary"
            />
        </DocPreview>
    </div>
</template>
