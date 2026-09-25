<script setup lang="ts">
import { ZXNotification } from "@/services/ui";
import DocPreview from "./DocPreview.vue";

const triggerCompact = (type: "success" | "error" | "warning" | "info") => {
    const messages = {
        success: "个人偏好与配置已成功保存 ♪(´▽｀)",
        error: "网络连接超时，请检查后端运行状态",
        warning: "检测到未保存的配置项变动",
        info: "小真寻正在后台同步数据库索引...",
    };
    ZXNotification({
        message: messages[type],
        type,
    });
};

const triggerPosition = (
    pos:
        | "top-left"
        | "top-center"
        | "top-right"
        | "bottom-left"
        | "bottom-center"
        | "bottom-right",
) => {
    ZXNotification({
        title: `位置形态：${pos}`,
        message: `这是一条来自 ${pos} 方位的通知消息`,
        position: pos,
        type: "info",
    });
};

const triggerBatchStack = (
    pos: "top-right" | "top-center" | "bottom-center",
) => {
    const items = [
        { title: "插件更新", msg: "插件市场发现 3 个新版本", type: "info" },
        { title: "系统告警", msg: "内存占用偏高，请注意资源开销", type: "warning" },
        { title: "连接异常", msg: "OneBot 适配器重连失败，正在重试", type: "error" },
        { title: "同步完成", msg: "所有配置项与本地缓存已成功对齐", type: "success" },
    ] as const;

    items.forEach((item, index) => {
        setTimeout(() => {
            ZXNotification({
                title: item.title,
                message: item.msg,
                type: item.type,
                position: pos,
                duration: 6000,
            });
        }, index * 120);
    });
};

const compactCode = `// 无标题轻量单行模式
ZXNotification({
    message: "个人偏好与配置已成功保存 ♪(´▽｀)",
    type: "success",
});`;

const titleCode = `// 标准双行带标题卡片
ZXNotification({
    title: "保存成功",
    message: "操作已完成，配置将于下次重启时生效",
    type: "success",
});`;

const positionCode = `// 屏幕方位：top-left | top-center | top-right | bottom-left | bottom-center | bottom-right
ZXNotification({
    title: "屏幕定位",
    message: "通知将在指定方位弹出并自适应堆叠",
    position: "top-center",
});`;

const stackCode = `// 3D 物理叠层依次展开，实色背景无重影
for (let i = 0; i < 4; i++) {
    ZXNotification({
        title: "批量通知",
        message: "通知 " + (i + 1),
        position: "top-right",
    });
}`;
</script>

<template>
    <div class="space-y-6">
        <!-- 无标题通知 -->
        <DocPreview
            id="compact"
            title="无标题通知"
            description="不传 title 时自动进入轻量单行居中模式。"
            :code="compactCode"
        >
            <div class="flex flex-wrap items-center justify-center gap-2">
                <ZxButton
                    size="sm"
                    variant="primary"
                    @click="triggerCompact('success')"
                >
                    成功
                </ZxButton>
                <ZxButton
                    size="sm"
                    variant="danger"
                    @click="triggerCompact('error')"
                >
                    错误
                </ZxButton>
                <ZxButton
                    size="sm"
                    variant="outline"
                    @click="triggerCompact('warning')"
                >
                    警告
                </ZxButton>
                <ZxButton
                    size="sm"
                    variant="ghost"
                    @click="triggerCompact('info')"
                >
                    提示
                </ZxButton>
            </div>
        </DocPreview>

        <!-- 标准带标题通知 -->
        <DocPreview
            id="standard"
            title="标准带标题通知"
            description="双行结构化卡片排版。"
            :code="titleCode"
        >
            <div class="flex flex-wrap items-center justify-center gap-2">
                <ZxButton
                    size="sm"
                    variant="primary"
                    @click="
                        ZXNotification({
                            title: '成功啦~',
                            message: '操作已完成 ♪(´▽｀)',
                            type: 'success',
                        })
                    "
                >
                    Success
                </ZxButton>
                <ZxButton
                    size="sm"
                    variant="danger"
                    @click="
                        ZXNotification({
                            title: '连接中断',
                            message: '网络请求超时，请检查服务',
                            type: 'error',
                        })
                    "
                >
                    Error
                </ZxButton>
                <ZxButton
                    size="sm"
                    variant="outline"
                    @click="
                        ZXNotification({
                            title: '注意',
                            message: '存在未保存的本地改动',
                            type: 'warning',
                        })
                    "
                >
                    Warning
                </ZxButton>
                <ZxButton
                    size="sm"
                    variant="ghost"
                    @click="
                        ZXNotification({
                            title: '小提示',
                            message: '这是一条普通的系统通知',
                            type: 'info',
                        })
                    "
                >
                    Info
                </ZxButton>
            </div>
        </DocPreview>

        <!-- 6 大方位形态 -->
        <DocPreview
            id="positions"
            title="屏幕方位形态"
            description="支持 6 种屏幕方位定位。"
            :code="positionCode"
        >
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 max-w-md w-full">
                <ZxButton
                    variant="outline"
                    size="sm"
                    @click="triggerPosition('top-left')"
                >
                    ↖ 左上
                </ZxButton>
                <ZxButton
                    variant="outline"
                    size="sm"
                    @click="triggerPosition('top-center')"
                >
                    ↑ 中上
                </ZxButton>
                <ZxButton
                    variant="outline"
                    size="sm"
                    @click="triggerPosition('top-right')"
                >
                    ↗ 右上
                </ZxButton>
                <ZxButton
                    variant="outline"
                    size="sm"
                    @click="triggerPosition('bottom-left')"
                >
                    ↙ 左下
                </ZxButton>
                <ZxButton
                    variant="outline"
                    size="sm"
                    @click="triggerPosition('bottom-center')"
                >
                    ↓ 中下
                </ZxButton>
                <ZxButton
                    variant="outline"
                    size="sm"
                    @click="triggerPosition('bottom-right')"
                >
                    ↘ 右下
                </ZxButton>
            </div>
        </DocPreview>

        <!-- 3D 物理叠层与平滑展开 -->
        <DocPreview
            id="stack"
            title="3D 物理叠层展开"
            description="连续派发多条自动叠层，鼠标悬停平滑展开。"
            :code="stackCode"
        >
            <div class="flex flex-wrap items-center justify-center gap-2">
                <ZxButton
                    size="sm"
                    variant="primary"
                    @click="triggerBatchStack('top-right')"
                >
                    右上角 4 层堆叠
                </ZxButton>
                <ZxButton
                    size="sm"
                    variant="primary"
                    @click="triggerBatchStack('top-center')"
                >
                    中上 4 层轻量堆叠
                </ZxButton>
                <ZxButton
                    size="sm"
                    variant="outline"
                    @click="triggerBatchStack('bottom-center')"
                >
                    中下 4 层底部堆叠
                </ZxButton>
            </div>
        </DocPreview>

        <!-- 特色形态 (头像 / 表情包 / 彩带) -->
        <DocPreview
            id="special"
            title="特色形态"
            description="支持头像直连、表情包与彩带粒子特效。"
            :code="`ZXNotification({ title: 'Mio', avatar: '...', type: 'success' });\nZXNotification({ title: '断开', sticker: '33', type: 'error' });`"
        >
            <div class="flex flex-wrap items-center justify-center gap-2">
                <ZxButton
                    size="sm"
                    variant="outline"
                    @click="
                        ZXNotification({
                            title: 'Mio',
                            subtitle: '2682007174',
                            avatar:
                                'https://q1.qlogo.cn/g?b=qq&nk=3625646420&s=640',
                            message: '上线了',
                            type: 'success',
                        })
                    "
                >
                    头像模式
                </ZxButton>
                <ZxButton
                    size="sm"
                    variant="outline"
                    @click="
                        ZXNotification({
                            title: '连接断开',
                            message: '小真寻陷入了宇宙思考',
                            type: 'error',
                            sticker: '33',
                        })
                    "
                >
                    表情包
                </ZxButton>
                <ZxButton
                    size="sm"
                    variant="primary"
                    @click="
                        ZXNotification({
                            title: '成功啦~',
                            message: '附带彩带粒子特效',
                            type: 'success',
                            confetti: true,
                        })
                    "
                >
                    彩带特效
                </ZxButton>
            </div>
        </DocPreview>
    </div>
</template>
