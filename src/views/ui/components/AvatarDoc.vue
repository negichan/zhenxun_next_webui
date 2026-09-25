<script setup lang="ts">
import DocPreview from "./DocPreview.vue";
</script>

<template>
    <div class="space-y-10">
        <DocPreview
            id="avatar-sizes"
            title="尺寸档位（size）"
            description="xs 20 / sm 28 / md 36 / lg 48 / xl 64，共 5 档。缺省自动首字兜底。"
            :code="`<ZxAvatar :name=&quot;'真寻'&quot; size=&quot;xs&quot; />
<ZxAvatar :name=&quot;'真寻'&quot; size=&quot;sm&quot; />
<ZxAvatar :name=&quot;'真寻'&quot; size=&quot;md&quot; />
<ZxAvatar :name=&quot;'真寻'&quot; size=&quot;lg&quot; />
<ZxAvatar :name=&quot;'真寻'&quot; size=&quot;xl&quot; />`"
        >
            <div class="flex flex-wrap items-center justify-center gap-4">
                <ZxAvatar :name="'真寻'" size="xs" />
                <ZxAvatar :name="'真寻'" size="sm" />
                <ZxAvatar :name="'真寻'" size="md" />
                <ZxAvatar :name="'真寻'" size="lg" />
                <ZxAvatar :name="'真寻'" size="xl" />
            </div>
        </DocPreview>

        <DocPreview
            id="avatar-qq"
            title="QQ 号直连头像"
            description="传入 qq 自动拉取高清头像，失败时回落首字/缺省图。"
            :code="`<ZxAvatar :qq=&quot;10001&quot; size=&quot;md&quot; />`"
        >
            <ZxAvatar :qq="10001" size="md" />
        </DocPreview>

        <DocPreview
            id="avatar-shape-circle"
            title="圆形（shape=circle）"
            description="默认圆形，适合联系人、用户头。"
            :code="`<ZxAvatar :name=&quot;'真寻'&quot; size=&quot;md&quot; />`"
        >
            <ZxAvatar :name="'真寻'" size="md" />
        </DocPreview>

        <DocPreview
            id="avatar-shape-square"
            title="平滑方角（shape=square）"
            description="squircle 风格圆角矩形，适合群头像、资源封面位。"
            :code="`<ZxAvatar :qq=&quot;10001&quot; shape=&quot;square&quot; size=&quot;md&quot; />
<ZxAvatar :name=&quot;'Mio'&quot; shape=&quot;square&quot; size=&quot;md&quot; />`"
        >
            <div class="flex items-center gap-4">
                <ZxAvatar :qq="10001" shape="square" size="md" />
                <ZxAvatar :name="'Mio'" shape="square" size="md" />
            </div>
        </DocPreview>
    </div>
</template>
