<script setup lang="ts">
import { ref } from "vue";
import ZxInputNumber from "@/components/zxcomponent/ZxInputNumber.vue";
import DocPreview from "./DocPreview.vue";

const cycles = ref(8);
const timeout = ref(180);
const temperature = ref(0.7);
const compact = ref(3);
</script>

<template>
    <div class="space-y-10">
        <DocPreview
            id="input-number-basic"
            title="基础步进（min / max）"
            description="[−] 输入 [+] 一体胶囊。边界钳制到 min/max，打字过程不回写，失焦或回车提交。"
            :code="`<ZxInputNumber v-model=&quot;cycles&quot; :min=&quot;1&quot; :max=&quot;64&quot; />`"
        >
            <div class="flex w-48 flex-col gap-1.5">
                <span class="text-xs font-medium text-zx-text-strong">
                    循环上限（md 默认）
                </span>
                <ZxInputNumber v-model="cycles" :min="1" :max="64" />
            </div>
        </DocPreview>

        <DocPreview
            id="input-number-size"
            title="尺寸档位（sm / md / lg）"
            description="高度随 size 变化，宽度默认 w-full，可用 class 覆盖。"
            :code="`<ZxInputNumber v-model=&quot;timeout&quot; :min=&quot;0&quot; size=&quot;sm&quot; />`"
        >
            <div class="flex w-48 flex-col gap-1.5">
                <span class="text-xs font-medium text-zx-text-strong">
                    超时秒数（sm）
                </span>
                <ZxInputNumber v-model="timeout" :min="0" size="sm" />
            </div>
        </DocPreview>

        <DocPreview
            id="input-number-float"
            title="小数步进（step / precision）"
            description="step 控制加减步长，precision 控制小数位数，适合温度、权重等浮点参数。"
            :code="`<ZxInputNumber v-model=&quot;temperature&quot; :step=&quot;0.1&quot; :precision=&quot;2&quot; size=&quot;sm&quot; />`"
        >
            <div class="flex w-48 flex-col gap-1.5">
                <span class="text-xs font-medium text-zx-text-strong">
                    采样温度（float）
                </span>
                <ZxInputNumber
                    v-model="temperature"
                    :step="0.1"
                    :precision="2"
                    size="sm"
                />
            </div>
        </DocPreview>

        <DocPreview
            id="input-number-width"
            title="自定义宽度"
            description="外层 class 可约束宽度，适合表单里紧凑的数字格。"
            :code="`<ZxInputNumber v-model=&quot;compact&quot; size=&quot;sm&quot; class=&quot;w-28&quot; />`"
        >
            <div class="flex w-32 flex-col gap-1.5">
                <span class="text-xs font-medium text-zx-text-strong">
                    自定义宽度
                </span>
                <ZxInputNumber v-model="compact" size="sm" class="w-28" />
            </div>
        </DocPreview>
    </div>
</template>
