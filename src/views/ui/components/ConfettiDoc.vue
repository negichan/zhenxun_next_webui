<script setup lang="ts">
import { ZXConfetti } from "@/services/ui";
import DocPreview from "./DocPreview.vue";

const dirCases = [
    {
        id: "confetti-all",
        title: "全向 360°（all）",
        desc: "默认模式，自点击位置向四周炸开。",
        code: "ZXConfetti.all();",
        run: () => ZXConfetti.all(),
        variant: "primary" as const,
    },
    {
        id: "confetti-up",
        title: "向上喷射（up）",
        desc: "礼炮向上抛洒。",
        code: "ZXConfetti.up();",
        run: () => ZXConfetti.up(),
        variant: "outline" as const,
    },
    {
        id: "confetti-down",
        title: "向下倾泻（down）",
        desc: "彩屑雨自上而下。",
        code: "ZXConfetti.down();",
        run: () => ZXConfetti.down(),
        variant: "outline" as const,
    },
    {
        id: "confetti-left",
        title: "向左喷射（left）",
        desc: "向左侧喷射。",
        code: "ZXConfetti.left();",
        run: () => ZXConfetti.left(),
        variant: "outline" as const,
    },
    {
        id: "confetti-right",
        title: "向右喷射（right）",
        desc: "向右侧喷射。",
        code: "ZXConfetti.right();",
        run: () => ZXConfetti.right(),
        variant: "outline" as const,
    },
    {
        id: "confetti-cannons",
        title: "双侧对轰（cannons）",
        desc: "屏幕左右两侧礼炮对轰。",
        code: "ZXConfetti.cannons();",
        run: () => ZXConfetti.cannons(),
        variant: "ghost" as const,
    },
];

const presetCases = [
    {
        id: "confetti-success",
        title: "成功预设（success）",
        desc: "成功绿色五彩纸屑。",
        code: "ZXConfetti.success();",
        run: () => ZXConfetti.success(),
        variant: "primary" as const,
    },
    {
        id: "confetti-fireworks",
        title: "庆典烟花（fireworks）",
        desc: "全向烟花庆典特效。",
        code: "ZXConfetti.fireworks();",
        run: () => ZXConfetti.fireworks(),
        variant: "outline" as const,
    },
    {
        id: "confetti-error",
        title: "失败预设（error）",
        desc: "失败红色碎片。",
        code: "ZXConfetti.error();",
        run: () => ZXConfetti.error(),
        variant: "danger" as const,
    },
    {
        id: "confetti-clear",
        title: "清除画布（clear）",
        desc: "立即清除所有活动纸屑画布。",
        code: "ZXConfetti.clear();",
        run: () => ZXConfetti.clear(),
        variant: "ghost" as const,
    },
];
</script>

<template>
    <div class="space-y-10">
        <DocPreview
            v-for="c in dirCases"
            :id="c.id"
            :key="c.id"
            :title="c.title"
            :description="c.desc"
            :code="`import { ZXConfetti } from &quot;@/services/ui&quot;;\n\n${c.code}`"
        >
            <ZxButton :variant="c.variant" @click="c.run()">
                {{ c.code }}
            </ZxButton>
        </DocPreview>

        <DocPreview
            v-for="c in presetCases"
            :id="c.id"
            :key="c.id"
            :title="c.title"
            :description="c.desc"
            :code="`import { ZXConfetti } from &quot;@/services/ui&quot;;\n\n${c.code}`"
        >
            <ZxButton :variant="c.variant" @click="c.run()">
                {{ c.code }}
            </ZxButton>
        </DocPreview>
    </div>
</template>
