<script setup lang="ts">
import { ref } from "vue";
import MiniDatePicker from "@/components/zxcomponent/MiniDatePicker.vue";
import MiniDateTimePicker from "@/components/zxcomponent/MiniDateTimePicker.vue";
import DocPreview from "./DocPreview.vue";

// 1. 日历形态状态
const calendarDate = ref("2026-09-24");
const miniDate = ref("");

// 2. 时间形态状态
const timeVal = ref("21:00:00");

// 3. 具体毫秒时区形态状态
const fullDateTimeVal = ref("2026-09-24T21:08:00.000000+08:00");
const iconDateTimeVal = ref("2026-09-24T21:08:00.000000+08:00");

const calendarCode = `<!-- 1. 日历形态 (纯日期)：专注年月日选择 -->
<MiniDateTimePicker v-model="date" type="date" placeholder="选择日期" />

<!-- 亦可使用超轻量微型日历 -->
<MiniDatePicker v-model="miniDate" placeholder="选择日期" />`;

const timeCode = `<!-- 2. 时间形态 (纯时间)：专注时分秒滚轮联动选择与微调 -->
<MiniDateTimePicker v-model="time" type="time" placeholder="选择时间" />`;

const dateTimeCode = `<!-- 3. 高精度日期时间形态 (日历 + 时分秒 + 毫秒/微秒 + 地图时区) -->
<MiniDateTimePicker
    v-model="dateTime"
    type="datetime"
    value-format="postgres"
    placeholder="选择高精度日期时间"
/>

<!-- 支持表格操作列或快捷操作的图标形态 (variant="icon") -->
<MiniDateTimePicker
    v-model="dateTime"
    type="datetime"
    variant="icon"
/>`;
</script>

<template>
    <div class="space-y-6">
        <!-- 形态一：日历形态 -->
        <DocPreview
            id="form-calendar"
            title="形态一：日历（Calendar / 纯日期）"
            description="仅日期选择面板。专注年月日维度，支持快捷年/月面板直选、平滑切月、今天与快速清除。"
            :code="calendarCode"
            align="start"
        >
            <div class="flex flex-wrap items-center gap-6">
                <div class="flex items-center gap-3">
                    <div class="w-52">
                        <MiniDateTimePicker
                            v-model="calendarDate"
                            type="date"
                            placeholder="请选择日期"
                        />
                    </div>
                    <span class="text-xs text-slate-400">已选：<code class="text-slate-600 font-mono">{{ calendarDate }}</code></span>
                </div>

                <div class="flex items-center gap-3">
                    <div class="w-48">
                        <MiniDatePicker
                            v-model="miniDate"
                            placeholder="微型日历 (MiniDatePicker)"
                        />
                    </div>
                    <span class="text-xs text-slate-400">微型值：<code class="text-slate-600 font-mono">{{ miniDate || "（空）" }}</code></span>
                </div>
            </div>
        </DocPreview>

        <!-- 形态二：时间形态 -->
        <DocPreview
            id="form-time"
            title="形态二：时间（Time / 纯时间）"
            description="纯时分秒时间面板。平滑时间滚轮阻尼步进、手势拖拽、点击输入直改与一键设置当前时间。"
            :code="timeCode"
            align="start"
        >
            <div class="flex flex-wrap items-center gap-4">
                <div class="w-40">
                    <MiniDateTimePicker
                        v-model="timeVal"
                        type="time"
                        placeholder="请选择时间"
                    />
                </div>
                <span class="text-xs text-slate-400">当前时间：<code class="text-slate-600 font-mono font-medium">{{ timeVal }}</code></span>
            </div>
        </DocPreview>

        <!-- 形态三：具体毫秒时区形态 -->
        <DocPreview
            id="form-datetime"
            title="形态三：高精度日期时间（毫秒·时区·全功能）"
            description="三列完整形态：左列日历、中列时分秒滚轮、右列微秒输入与世界地图交互式时区选择器（TimezoneMapPicker）。"
            :code="dateTimeCode"
            align="start"
        >
            <div class="flex flex-wrap items-center gap-6">
                <div class="flex items-center gap-3">
                    <div class="w-80">
                        <MiniDateTimePicker
                            v-model="fullDateTimeVal"
                            type="datetime"
                            placeholder="请选择高精度日期时间"
                        />
                    </div>
                </div>

                <div class="flex items-center gap-3">
                    <div class="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-white px-3 py-1.5 shadow-2xs">
                        <span class="text-xs text-slate-600">图标模式：</span>
                        <MiniDateTimePicker
                            v-model="iconDateTimeVal"
                            type="datetime"
                            variant="icon"
                        />
                    </div>
                </div>

                <div class="w-full text-xs text-slate-400">
                    完整时间戳：<code class="text-slate-600 font-mono text-[11px] select-all">{{ fullDateTimeVal }}</code>
                </div>
            </div>
        </DocPreview>
    </div>
</template>

