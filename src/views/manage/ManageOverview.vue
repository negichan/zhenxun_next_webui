<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { Line } from "vue-chartjs";
import {
    CategoryScale,
    Chart as ChartJS,
    type ChartOptions,
    Filler,
    Legend,
    LinearScale,
    LineElement,
    PointElement,
    Title,
    Tooltip,
} from "chart.js";
import {
    Blocks,
    ChevronDown,
    ChevronLeft,
    Group,
    MessageSquare,
    TrendingUp,
    Users,
    X,
    Zap,
} from "lucide-vue-next";

import { ZXSelect } from "@/components/zxcomponent/ZXSelect";
import ZxEmptyState from "@/components/zxcomponent/ZxEmptyState.vue";
import { ZXMessageBox, ZXNotification } from "@/services/ui";
import { manageApi } from "@/utils/api-next";
import type {
    Friend,
    FriendDetail,
    FriendTrend,
    Group as GroupType,
    GroupDetailNew,
    GroupPlugin,
    MemberDetail,
} from "@/types/manage.types";
import { storeToRefs } from "pinia";
import { useBotStore } from "@/store/bot.ts";
import {
    createLineOptions,
    createLineDatasetStyle,
    themeChartTextColor,
} from "@/utils/chart-theme";

const props = withDefaults(
    defineProps<{
        embedded?: boolean;
        targetType?: "group" | "friend" | null;
        targetId?: string | null;
    }>(),
    {
        embedded: false,
        targetType: null,
        targetId: null,
    },
);

// 嵌入聊天详情面板时，由父组件关闭面板
const emit = defineEmits<{ close: [] }>();

// 注册 ChartJS 组件
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler,
);

const botStore = useBotStore();
const { selectedBotId } = storeToRefs(botStore);

const isInitLoaded = ref(false);
// 选项卡类型
type TabType = "groups" | "friends";

const loading = ref(false);
const activeTab = ref<TabType>("groups");
const searchQuery = ref("");
const groups = ref<GroupType[]>([]);
const friends = ref<Friend[]>([]);
const sendMessageDialogOpen = ref(false);
const currentFriend = ref<Friend | null>(null);
const messageContent = ref("");

// 移动端侧边栏显示状态
const showSidebar = ref(true);

// 选中项
const selectedGroupId = ref<string | null>(null);
const selectedUserId = ref<string | null>(null);

// 详情数据
const groupDetail = ref<GroupDetailNew | null>(null);
const memberDetail = ref<MemberDetail | null>(null);
const groupMembers = ref<
    Array<{
        user_id: string;
        nickname: string;
        remark: string;
        ava_url: string;
        role: string;
        gold?: number;
        favorability?: number;
        is_banned?: boolean;
    }>
>([]);
const groupPlugins = ref<GroupPlugin[]>([]);

// 好友详情数据
const friendDetail = ref<FriendDetail | null>(null);
const friendTrend = ref<FriendTrend | null>(null);
const friendDetailLoading = ref(false);
const friendTrendLoading = ref(false);

// 详情面板 loading
const detailLoading = ref(false);
const pluginsLoading = ref(false);

// 成员编辑对话框
const memberEditDialogOpen = ref(false);
const currentMember = ref<(typeof groupMembers.value)[number] | null>(null);
const editGold = ref(0);
const editFavorability = ref(0);
const editIsBanned = ref(false);

// 好友编辑对话框
const friendEditDialogOpen = ref(false);
const friendEditField = ref<"gold" | "favorability">("gold");
const friendEditValue = ref(0);
const friendEditSaving = ref(false);

// 插件列表筛选
const showPassivePlugins = ref(true); // true=被动插件，false=普通插件

// 分页相关 - 群成员列表
const memberCurrentPage = ref(1);
const memberPageSize = ref(15);

// 计算分页后的成员列表
const paginatedMembers = computed(() => {
    const start = (memberCurrentPage.value - 1) * memberPageSize.value;
    const end = start + memberPageSize.value;
    return groupMembers.value.slice(start, end);
});

// 总页数
const memberTotalPages = computed(() =>
    Math.ceil(groupMembers.value.length / memberPageSize.value),
);

// 切换页码
const changeMemberPage = (page: number) => {
    if (page < 1 || page > memberTotalPages.value) return;
    memberCurrentPage.value = page;
};

// 加载数据
const loadData = async (retried = false) => {
    loading.value = true;

    try {
        // 列表按当前选中的 bot 过滤，切换 bot 后同步变化
        const botId = selectedBotId.value ?? undefined;

        // 👉 第一次：两个都加载
        if (!isInitLoaded.value) {
            const [groupRes, friendRes] = await Promise.all([
                manageApi.getGroupList(botId),
                manageApi.getFriendList(botId),
            ]);

            // groups
            if (groupRes?.success && groupRes?.data) {
                groups.value = groupRes.data;
            } else {
                ZXNotification({
                    title: "呜呼~",
                    message: "群组列表加载失败了 (っ °Д °;) っ",
                    type: "error",
                    position: "top-right",
                });
            }

            // friends
            if (friendRes?.success && friendRes?.data) {
                friends.value = friendRes.data;
            } else {
                ZXNotification({
                    title: "呜呼~",
                    message: "好友列表加载失败了 (っ °Д °;) っ",
                    type: "error",
                    position: "top-right",
                });
            }

            isInitLoaded.value = true;
            await syncSelectedTarget(retried);
            return;
        }

        // 👉 后续：只加载当前 tab
        if (activeTab.value === "groups") {
            const res = await manageApi.getGroupList(botId);
            if (res.success && res.data) {
                groups.value = res.data;
            }
        } else {
            const res = await manageApi.getFriendList(botId);
            if (res.success && res.data) {
                friends.value = res.data;
            }
        }
        await syncSelectedTarget(retried);
    } catch (error) {
        console.error("加载数据失败:", error);

        ZXNotification({
            title: "呜呼~",
            message: "数据加载失败了 (っ °Д °;) っ",
            type: "error",
            position: "top-right",
        });
    } finally {
        loading.value = false;
    }
};

const syncSelectedTarget = async (retried = false) => {
    if (!props.embedded || !props.targetType || !props.targetId) return;

    if (props.targetType === "group") {
        activeTab.value = "groups";
        let group = groups.value.find(
            (item) => item.group_id === props.targetId,
        );

        // 列表可能是选中的 bot 变化前加载的旧数据，拉一次新的再找
        if (!group && !retried) {
            await loadData(true);
            group = groups.value.find(
                (item) => item.group_id === props.targetId,
            );
        }

        if (group && selectedGroupId.value !== group.group_id) {
            await selectGroup(group);
        }

        return;
    }

    activeTab.value = "friends";
    let friend = friends.value.find(
        (item) => item.user_id === props.targetId,
    );
    if (!friend && !retried) {
        await loadData(true);
        friend = friends.value.find(
            (item) => item.user_id === props.targetId,
        );
    }
    if (friend && selectedUserId.value !== friend.user_id) {
        await selectFriend(friend);
    }
};

// 标签页选项（ZxSegmented：图标 + 计数徽标）
const manageTabOptions = computed(() => [
    { value: "groups" as TabType, icon: Group, label: "群组", badge: groupStats.value.total },
    { value: "friends" as TabType, icon: Users, label: "好友", badge: friendStats.value.total },
]);

// 切换选项卡时加载对应数据
const switchTab = (tab: TabType) => {
    activeTab.value = tab;
    searchQuery.value = "";
    selectedGroupId.value = null;
    selectedUserId.value = null;
    groupDetail.value = null;
    memberDetail.value = null;
    groupMembers.value = [];
    groupPlugins.value = [];
    friendDetail.value = null;
    friendTrend.value = null;
    loadData();
};

// 标签页切换回调直接用 switchTab（模板里 onClick 调用）

// 选中群组
const selectGroup = async (group: GroupType) => {
    selectedGroupId.value = group.group_id;
    selectedUserId.value = null;
    detailLoading.value = true;
    groupDetail.value = null; // 重置
    groupPlugins.value = []; // 重置插件列表
    memberCurrentPage.value = 1; // 重置分页
    // 移动端选中后隐藏侧边栏
    if (!props.embedded && window.innerWidth < 640) {
        showSidebar.value = false;
    }
    try {
        const res = await manageApi.getGroupDetail(group.group_id);
        // console.log("群组详情 API 响应:", res);
        if (res.success && res.data) {
            groupDetail.value = res.data;
            // console.log("群组详情:", groupDetail.value);
        } else {
            // console.error("获取群组详情失败:", res.message);
        }
        // 加载群成员列表
        const membersRes = await manageApi.getGroupMembers(group.group_id);
        if (membersRes.success && membersRes.data) {
            groupMembers.value = membersRes.data;
        }
        // 加载群插件列表
        await loadGroupPlugins(group.group_id);
    } catch (error) {
        console.error("加载群组详情失败:", error);
    } finally {
        detailLoading.value = false;
    }
};

// 加载群插件列表
const loadGroupPlugins = async (groupId: string) => {
    pluginsLoading.value = true;
    try {
        const res = await manageApi.getGroupPlugins(groupId);
        if (res.success && res.data) {
            groupPlugins.value = res.data;
        }
    } catch (error) {
        console.error("加载群插件列表失败:", error);
    } finally {
        pluginsLoading.value = false;
    }
};

// 切换插件开关
const togglePlugin = async (plugin: GroupPlugin) => {
    if (!selectedGroupId.value) return;
    try {
        const res = await manageApi.toggleGroupPlugin({
            group_id: selectedGroupId.value,
            module: plugin.module,
            action: plugin.is_blocked ? "unblock" : "block",
            is_task: plugin.is_task,
        });
        if (res.success && res.data) {
            // plugin.is_blocked = !plugin.is_blocked;
            ZXNotification({
                title: "成功啦~",
                message: "插件设置更新成功 ♪(´▽｀)",
                type: "success",
                position: "top-right",
            });
        }
    } catch (error) {
        console.error("切换插件开关失败:", error);
        ZXNotification({
            title: "对不起",
            message: "设置更新失败了 (´；ω；`)",
            type: "error",
            position: "top-right",
        });
    }
};

// 打开成员编辑对话框
const openMemberEdit = async (member: (typeof groupMembers.value)[number]) => {
    currentMember.value = member;
    // 使用已有的数据，如果没有则默认为 0
    editGold.value = member.gold ?? 0;
    editFavorability.value = member.favorability ?? 0;
    editIsBanned.value = member.is_banned ?? false;
    memberEditDialogOpen.value = true;

    // 如果还没有加载成员详情，加载一下
    if (
        selectedGroupId.value &&
        (member.gold === undefined ||
            member.favorability === undefined ||
            member.is_banned === undefined)
    ) {
        try {
            const res = await manageApi.getMemberDetail(
                member.user_id,
                selectedGroupId.value,
            );
            if (res.success && res.data) {
                editGold.value = res.data.gold;
                editFavorability.value = res.data.favorability;
                editIsBanned.value = res.data.is_banned;
                // 更新本地数据
                member.gold = res.data.gold;
                member.favorability = res.data.favorability;
                member.is_banned = res.data.is_banned;
            }
        } catch (error) {
            console.error("加载成员详情失败:", error);
        }
    }
};

// 保存成员编辑
const saveMemberEdit = async () => {
    if (!currentMember.value || !selectedGroupId.value) return;

    try {
        const res = await manageApi.updateMember({
            user_id: currentMember.value.user_id,
            group_id: selectedGroupId.value,
            gold: editGold.value,
            favorability: editFavorability.value,
            is_banned: editIsBanned.value,
        });

        if (res.success) {
            // 更新本地数据
            currentMember.value.gold = editGold.value;
            currentMember.value.favorability = editFavorability.value;
            currentMember.value.is_banned = editIsBanned.value;

            ZXNotification({
                title: "成功啦~",
                message: "成员信息更新成功 ♪(´▽｀)",
                type: "success",
                position: "top-right",
            });
            memberEditDialogOpen.value = false;
            currentMember.value = null;
        }
    } catch (error) {
        console.error("更新成员信息失败:", error);
        ZXNotification({
            title: "对不起",
            message: "更新失败了 (´；ω；`)",
            type: "error",
            position: "top-right",
        });
    }
};

// 切换成员封禁状态
const toggleMemberBan = async (member: (typeof groupMembers.value)[number]) => {
    if (!selectedGroupId.value) return;

    const newBanStatus = !(member.is_banned ?? false);
    try {
        const res = await manageApi.updateMember({
            user_id: member.user_id,
            group_id: selectedGroupId.value,
            is_banned: newBanStatus,
        });

        if (res.success) {
            member.is_banned = newBanStatus;
            ZXNotification({
                title: "成功啦~",
                message: newBanStatus ? "已封禁该成员" : "已解封该成员",
                type: "success",
                position: "top-right",
            });
        }
    } catch (error) {
        console.error("切换封禁状态失败:", error);
        ZXNotification({
            title: "对不起",
            message: "操作失败了 (´；ω；`)",
            type: "error",
            position: "top-right",
        });
    }
};

// 选中好友
const selectFriend = async (friend: Friend) => {
    selectedUserId.value = friend.user_id;
    selectedGroupId.value = null;
    // 移动端选中后隐藏侧边栏
    if (!props.embedded && window.innerWidth < 640) {
        showSidebar.value = false;
    }
    // 设置基础信息
    memberDetail.value = {
        user_id: friend.user_id,
        nickname: friend.nickname,
        remark: friend.remark || "",
        ava_url: friend.ava_url,
        gold: 0,
        favorability: 0,
        is_banned: false,
    };

    // 加载好友详情
    friendDetailLoading.value = true;
    friendTrendLoading.value = true;
    friendDetail.value = null;
    friendTrend.value = null;

    try {
        // 并行加载详情和趋势
        const [detailRes, trendRes] = await Promise.all([
            manageApi.getFriendDetail(
                friend.user_id,
                selectedBotId.value as string,
            ),
            manageApi.getFriendTrend(friend.user_id, 7),
        ]);

        if (detailRes.success && detailRes.data) {
            friendDetail.value = detailRes.data;
            // 更新 memberDetail
            memberDetail.value = {
                user_id: detailRes.data.user_id,
                nickname: detailRes.data.nickname,
                remark: "",
                ava_url: detailRes.data.ava_url,
                gold: detailRes.data.gold,
                favorability: detailRes.data.favorability,
                is_banned: false,
            };
        }

        if (trendRes.success && trendRes.data) {
            friendTrend.value = trendRes.data;
        }
    } catch (error) {
        console.error("加载好友详情失败:", error);
    } finally {
        friendDetailLoading.value = false;
        friendTrendLoading.value = false;
    }
};

// 刷新好友详情
const refreshFriendDetail = async () => {
    if (!selectedUserId.value) return;
    try {
        const res = await manageApi.getFriendDetail(
            selectedUserId.value,
            <string>botStore.selectedBotId,
        );
        if (res.success && res.data) {
            friendDetail.value = res.data;
            if (memberDetail.value) {
                memberDetail.value.gold = res.data.gold;
                memberDetail.value.favorability = res.data.favorability;
            }
        }
    } catch (error) {
        console.error("刷新好友详情失败:", error);
    }
};

// 打开好友编辑对话框
const openFriendEdit = (field: "gold" | "favorability") => {
    if (!friendDetail.value) return;
    friendEditField.value = field;
    friendEditValue.value =
        field === "gold"
            ? friendDetail.value.gold
            : friendDetail.value.favorability;
    friendEditDialogOpen.value = true;
};

// 保存好友编辑
const saveFriendEdit = async () => {
    if (!selectedUserId.value || !friendDetail.value) return;

    friendEditSaving.value = true;
    try {
        const res = await manageApi.updateFriend({
            user_id: selectedUserId.value,
            [friendEditField.value]: friendEditValue.value,
        });

        if (res.success) {
            // 更新本地数据
            if (friendEditField.value === "gold") {
                friendDetail.value.gold = friendEditValue.value;
                if (memberDetail.value)
                    memberDetail.value.gold = friendEditValue.value;
            } else {
                friendDetail.value.favorability = friendEditValue.value;
                if (memberDetail.value)
                    memberDetail.value.favorability = friendEditValue.value;
            }

            ZXNotification({
                title: "成功啦~",
                message: "好友数据更新成功 ♪(´▽｀)",
                type: "success",
                position: "top-right",
            });
            friendEditDialogOpen.value = false;
        } else {
            ZXNotification({
                title: "呜呼~",
                message: res.message || "更新失败",
                type: "error",
                position: "top-right",
            });
        }
    } catch (error) {
        console.error("更新好友数据失败:", error);
        ZXNotification({
            title: "对不起",
            message: "更新失败了 (´；ω；`)",
            type: "error",
            position: "top-right",
        });
    } finally {
        friendEditSaving.value = false;
    }
};

// 过滤数据
const filteredGroups = computed(() => {
    if (!searchQuery.value) return groups.value;
    const query = searchQuery.value.toLowerCase();
    return groups.value.filter(
        (g) =>
            g.group_name.toLowerCase().includes(query) ||
            g.group_id.toLowerCase().includes(query),
    );
});

const filteredFriends = computed(() => {
    if (!searchQuery.value) return friends.value;
    const query = searchQuery.value.toLowerCase();
    return friends.value.filter(
        (f) =>
            f.nickname.toLowerCase().includes(query) ||
            f.user_id.toLowerCase().includes(query),
    );
});

// 过滤插件列表
const filteredPlugins = computed(() => {
    if (showPassivePlugins.value) {
        return groupPlugins.value.filter((p) => p.is_task);
    } else {
        return groupPlugins.value.filter((p) => !p.is_task);
    }
});

// 统计数据
const groupStats = computed(() => {
    const total = groups.value.length;
    const active = groups.value.filter((g) => g.status).length;
    const totalMembers = groups.value.reduce(
        (sum, g) => sum + (g.member_count || 0),
        0,
    );
    return {
        total,
        active,
        inactive: total - active,
        totalMembers,
    };
});

const friendStats = computed(() => ({
    total: friends.value.length,
}));

// 好友趋势图表数据
const friendTrendChartData = computed(() => {
    if (!friendTrend.value || friendTrend.value.data.length === 0) {
        return null;
    }

    return {
        labels: friendTrend.value.data.map((p) => p.date),
        datasets: [
            {
                label: "聊天次数",
                ...createLineDatasetStyle("blue"),
                data: friendTrend.value.data.map((p) => p.chat_count),
                yAxisID: "y",
            },
            {
                label: "调用次数",
                ...createLineDatasetStyle("pink"),
                data: friendTrend.value.data.map((p) => p.call_count),
                yAxisID: "y1",
            },
        ],
    };
});

// 图表配置
const friendTrendChartOptions: ChartOptions<"line"> = createLineOptions({
    scales: {
        x: {
            grid: { display: false },
        },
        y: {
            type: "linear",
            display: true,
            position: "left",
            title: { display: true, text: "聊天", color: themeChartTextColor },
            beginAtZero: true,
        },
        y1: {
            type: "linear",
            display: true,
            position: "right",
            title: { display: true, text: "调用", color: themeChartTextColor },
            grid: { drawOnChartArea: false },
            beginAtZero: true,
        },
    },
});

// 群组操作
const toggleGroupStatus = async (group: GroupType) => {
    try {
        const res = await manageApi.updateGroup({
            group_id: group.group_id,
            status: !group.status,
        });
        if (res.success) {
            group.status = !group.status;
            groupDetail.value!.status = !groupDetail.value!.status;
            ZXNotification({
                title: "成功啦~",
                message: "群组状态更新成功 ♪(´▽｀)",
                type: "success",
                position: "top-right",
            });
        }
    } catch (error) {
        console.error("切换群组状态失败:", error);
        ZXNotification({
            title: "对不起",
            message: "群组状态更新失败了 (´；ω；`)",
            type: "error",
            position: "top-right",
        });
    }
};

// 好友操作
const sendMessage = (friend: Friend) => {
    currentFriend.value = friend;
    messageContent.value = "";
    sendMessageDialogOpen.value = true;
};

const confirmSendMessage = async () => {
    if (!currentFriend.value || !messageContent.value.trim()) return;

    try {
        const res = await manageApi.sendMessage(
            "",
            messageContent.value.trim(),
            currentFriend.value.user_id,
            undefined,
        );
        if (res.success) {
            ZXNotification({
                title: "成功啦~",
                message: "消息发送成功 ♪(´▽｀)",
                type: "success",
                position: "top-right",
            });
            sendMessageDialogOpen.value = false;
            currentFriend.value = null;
        }
    } catch (error) {
        console.error("发送消息失败:", error);
        ZXNotification({
            title: "呜呼~",
            message: "消息发送失败了 (´；ω；`)",
            type: "error",
            position: "top-right",
        });
    }
};

const deleteFriend = async (friend: Friend) => {
    try {
        await ZXMessageBox({
            title: "移除好友确认",
            message: `确定要移除好友"${friend.nickname}"吗？此操作不可恢复。`,
            cancelButtonText: "取消",
            confirmButtonText: "确定",
            type: "warning",
            onConfirm: async () => {
                const res = await manageApi.deleteFriend({
                    bot_id: "",
                    user_id: friend.user_id,
                });
                if (res.success) {
                    friends.value = friends.value.filter(
                        (f) => f.user_id !== friend.user_id,
                    );
                    ZXNotification({
                        title: "成功~",
                        message: "已移除好友",
                        type: "success",
                        position: "top-right",
                    });
                }
            },
        });
    } catch {
        return;
    }
};

// 群权限（群等级）逻辑
const levels = [-1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// 群权限下拉选项（样式参考插件设置·权限设置的群权限下拉）
const groupLevelOptions = levels.map(l => ({
    label: `等级 ${l}`,
    value: String(l),
}));

const selectedLevel = computed(() => groupDetail.value!.level);

const chooseLevel = async (level: number, group: GroupType) => {
    try {
        const res = await manageApi.updateGroup({
            group_id: group.group_id,
            level: level,
        });
        if (res.success) {
            group.status = !group.status;
            groupDetail.value!.level = level;
            ZXNotification({
                title: "成功啦~",
                message: "群等级更新成功 ♪(´▽｀)",
                type: "success",
                position: "top-right",
            });
        }
    } catch (error) {
        console.error("群等级更新失败:", error);
        ZXNotification({
            title: "对不起",
            message: "群等级更新失败了 (´；ω；`)",
            type: "error",
            position: "top-right",
        });
    }
};

watch(
    () => [props.targetType, props.targetId] as const,
    async () => {
        await nextTick();
        await syncSelectedTarget();
    },
);

// 顶栏切换 bot 后，好友/群列表按新 bot 重新加载
watch(
    () => selectedBotId.value,
    (newBotId, oldBotId) => {
        if (newBotId && newBotId !== oldBotId) loadData();
    },
);

onMounted(async () => {
    await loadData();
});
</script>

<template>
    <div
        :class="[
            'flex h-full w-full min-w-0 flex-col',
            embedded ? 'manage-embedded' : '',
        ]"
    >
        <!-- 左右双栏布局 -->
        <div
            :class="[
                'relative flex min-h-0 flex-1',
                embedded ? 'gap-0' : 'gap-4',
            ]"
        >
            <!-- 左侧边栏 - 移动端可隐藏，响应式宽度 -->
            <div
                v-if="!embedded"
                :class="[
                    'flex w-full min-w-0 flex-shrink-0 flex-col overflow-hidden rounded-3xl border-1 border-slate-200 bg-white p-4 pt-4 shadow-sm transition-all duration-300 sm:w-56 md:w-64 lg:w-72',
                    // 移动端：固定定位，覆盖在右侧内容上
                    showSidebar
                        ? 'absolute inset-0 z-20 sm:relative sm:inset-auto sm:z-auto'
                        : 'hidden sm:flex',
                ]"
            >
                <!-- 标签页切换 -->
                <div class="px-2 py-2 sm:px-3">
                    <ZxSegmented
                        block
                        :model-value="activeTab"
                        :options="manageTabOptions"
                        @change="switchTab"
                    />
                </div>

                <!-- 搜索栏 -->
                <div class="border-b border-gray-100 p-1.5 sm:p-2">
                    <ZXInput
                        v-model="searchQuery"
                        type="search"
                        :placeholder="
                            activeTab === 'groups'
                                ? '搜索群组...'
                                : '搜索好友...'
                        "
                    />
                </div>

                <!-- 列表内容 -->
                <div
                    class="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-1.5 sm:space-y-1 sm:p-2"
                >
                    <div
                        v-if="loading"
                        class="flex items-center justify-center py-8"
                    >
                        <div class="text-center text-zx-text-subtle">
                            <div
                                class="mx-auto mb-2 h-6 w-6 animate-pulse rounded-full border-2 border-zx-primary border-t-transparent sm:h-8 sm:w-8"
                            />
                            <p class="text-xs sm:text-sm">加载中...</p>
                        </div>
                    </div>

                    <ZxEmptyState
                        v-else-if="
                            (activeTab === 'groups' &&
                                filteredGroups.length === 0) ||
                            (activeTab === 'friends' &&
                                filteredFriends.length === 0)
                        "
                        :icon="activeTab === 'groups' ? Group : Users"
                        size="sm"
                        text="暂无数据"
                    />

                    <!-- 群组列表 -->
                    <template v-else-if="activeTab === 'groups'">
                        <div
                            v-for="group in filteredGroups"
                            :key="group.group_id"
                            @click="selectGroup(group)"
                            :class="[
                                'btn-touch flex cursor-pointer items-center gap-2 rounded-2xl p-1.5 transition-colors sm:gap-3 sm:p-2',
                                selectedGroupId === group.group_id
                                    ? 'bg-slate-100'
                                    : 'hover:bg-gray-50',
                            ]"
                        >
                            <ZxAvatar
                                :src="group.ava_url"
                                :name="group.group_name || '群'"
                                size="sm"
                                shape="square"
                                class="flex-shrink-0 sm:!h-10 sm:!w-10"
                            />
                            <div class="min-w-0 flex-1">
                                <div
                                    class="truncate text-xs text-zx-text sm:text-sm"
                                >
                                    {{ group.group_name }}
                                </div>
                                <div
                                    class="truncate text-[10px] text-zx-text-subtle sm:text-xs"
                                >
                                    {{ group.group_id }}
                                </div>
                            </div>
                        </div>
                    </template>

                    <!-- 好友列表 -->
                    <template v-else>
                        <div
                            v-for="friend in filteredFriends"
                            :key="friend.user_id"
                            @click="selectFriend(friend)"
                            :class="[
                                'btn-touch flex cursor-pointer items-center gap-2 rounded-2xl p-1.5 transition-colors sm:gap-3 sm:p-2',
                                selectedUserId === friend.user_id
                                    ? 'bg-slate-100'
                                    : 'hover:bg-gray-50',
                            ]"
                        >
                            <ZxAvatar
                                :src="friend.ava_url"
                                :name="friend.nickname || '友'"
                                size="sm"
                                class="flex-shrink-0 max-sm:!h-7 max-sm:!w-7"
                            />
                            <span
                                class="min-w-0 flex-1 truncate text-xs text-zx-text sm:text-sm"
                                >{{ friend.nickname }}</span
                            >
                        </div>
                    </template>
                </div>
            </div>

            <!-- 右侧详情区域 -->
            <div
                :class="[
                    'flex min-w-0 flex-1 flex-col overflow-hidden rounded-3xl border-1 border-slate-200 bg-white shadow-sm',
                    embedded ? 'rounded-3xl border-0 shadow-none' : '',
                ]"
            >
                <div
                    v-if="embedded && !targetId"
                    class="relative flex h-full items-center justify-center p-6 text-center text-zx-text-subtle"
                >
                    <button
                        title="返回"
                        class="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-zx-text-muted transition-colors hover:bg-slate-200 hover:text-zx-text"
                        @click="emit('close')"
                    >
                        <X class="h-4 w-4" />
                    </button>
                    <div>
                        <Group class="mx-auto mb-4 h-14 w-14 opacity-20" />
                        <p class="text-sm text-zx-text-muted">
                            请选择聊天对象查看管理信息
                        </p>
                    </div>
                </div>

                <!-- 群组详情 -->
                <template v-else-if="activeTab === 'groups'">
                    <div
                        v-if="!selectedGroupId"
                        class="flex h-full items-center justify-center"
                    >
                        <div class="text-center text-zx-text-subtle">
                            <Group class="mx-auto mb-4 h-16 w-16 opacity-20" />
                            <p class="text-zx-text-muted">请选择一个群组查看详情</p>
                        </div>
                    </div>

                    <div
                        v-else-if="detailLoading"
                        class="flex h-full items-center justify-center"
                    >
                        <div class="text-center text-zx-text-subtle">
                            <div
                                class="mx-auto mb-4 h-10 w-10 animate-pulse rounded-full border-3 border-zx-primary border-t-transparent"
                            />
                            <p>加载中...</p>
                        </div>
                    </div>

                    <div
                        v-else-if="groupDetail"
                        class="flex h-full flex-col overflow-hidden"
                    >
                        <!-- 详情头部 -->
                        <div class="border-b border-gray-100 p-4 pb-3 sm:p-6 sm:pb-4">
                            <div class="flex flex-wrap items-center gap-2 sm:gap-4">
                                <!-- 移动端返回按钮 -->
                                <button
                                    v-if="!embedded"
                                    @click="showSidebar = true"
                                    class="flex-shrink-0 rounded-2xl p-2 transition-colors hover:bg-white/50 sm:hidden"
                                >
                                    <ChevronLeft
                                        class="h-5 w-5 text-zx-text-muted"
                                    />
                                </button>
                                <ZxAvatar
                                    :src="groupDetail.ava_url"
                                    :name="groupDetail.group_name"
                                    size="lg"
                                    class="flex-shrink-0 shadow-md sm:!h-18 sm:!w-18"
                                />
                                <div class="min-w-0 flex-1">
                                    <h2
                                        class="truncate text-base font-bold text-zx-text-strong sm:text-xl"
                                    >
                                        {{ groupDetail.group_name }}
                                    </h2>
                                    <p
                                        class="mt-0.5 truncate text-xs text-zx-text-muted sm:mt-1 sm:text-sm"
                                    >
                                        {{ groupDetail.group_id }}
                                    </p>
                                    <div
                                        class="mt-1.5 flex flex-wrap items-center gap-2 sm:mt-2"
                                    >
                                        <span
                                            :class="[
                                                'whitespace-nowrap rounded-full px-2.5 py-1 text-xs sm:px-3 sm:text-sm',
                                                groupDetail.status
                                                    ? 'bg-zx-primary-soft text-zx-primary'
                                                    : 'bg-gray-100 text-zx-text-muted',
                                            ]"
                                        >
                                            {{
                                                groupDetail.status
                                                    ? "已启用"
                                                    : "已禁用"
                                            }}
                                        </span>
                                        <span
                                            v-if="groupDetail.is_super"
                                            class="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-zx-text-muted sm:py-1 sm:text-xs"
                                        >
                                            超级群
                                        </span>
                                    </div>
                                </div>
                                <div
                                    class="flex flex-shrink-0 gap-1.5 sm:gap-2"
                                >
                                    <button
                                        v-if="embedded"
                                        title="返回"
                                        class="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-zx-text-muted transition-colors hover:bg-slate-200 hover:text-zx-text"
                                        @click="emit('close')"
                                    >
                                        <X class="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- 详情内容 -->
                        <div class="flex-1 overflow-y-auto p-2 sm:p-4">
                            <!-- 统计卡片 -->
                            <!--                            <div-->
                            <!--                                class="mb-3 grid grid-cols-2 gap-2 sm:mb-4 sm:gap-3"-->
                            <!--                            >-->
                            <!--                                <div-->
                            <!--                                    class="rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 p-2 text-center sm:p-3"-->
                            <!--                                >-->
                            <!--                                    <div-->
                            <!--                                        class="text-lg font-bold text-blue-600 sm:text-xl"-->
                            <!--                                    >-->
                            <!--                                        {{ groupMembers.length }}-->
                            <!--                                    </div>-->
                            <!--                                    <div-->
                            <!--                                        class="mt-0.5 text-[10px] text-zx-text-muted sm:mt-1 sm:text-xs"-->
                            <!--                                    >-->
                            <!--                                        总人数-->
                            <!--                                    </div>-->
                            <!--                                </div>-->
                            <!--                                <div-->
                            <!--                                    class="rounded-2xl bg-gradient-to-br from-purple-50 to-purple-100 p-2 text-center sm:p-3"-->
                            <!--                                >-->
                            <!--                                    <div-->
                            <!--                                        class="text-lg font-bold text-purple-600 sm:text-xl"-->
                            <!--                                    >-->
                            <!--                                        {{ groupDetail.level }}-->
                            <!--                                    </div>-->
                            <!--                                    <div-->
                            <!--                                        class="mt-0.5 text-[10px] text-zx-text-muted sm:mt-1 sm:text-xs"-->
                            <!--                                    >-->
                            <!--                                        群等级-->
                            <!--                                    </div>-->
                            <!--                                </div>-->
                            <!--                            </div>-->

                            <div class="mb-3 sm:mb-4">
                                <div
                                    class="mb-2 flex flex-wrap items-center justify-between gap-2"
                                >
                                    <h3
                                        class="flex items-center gap-1 text-xs font-semibold text-zx-text sm:gap-2 sm:text-sm"
                                    >
                                        群聊设置
                                    </h3>
                                </div>
                                <div
                                    class="grid grid-cols-1 gap-2 select-none sm:grid-cols-2 sm:gap-3"
                                >
                                    <!-- 群权限（填写样式参考插件设置·权限设置的群权限） -->
                                    <div
                                        class="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 sm:gap-3"
                                    >
                                        <div class="min-w-0 flex-1">
                                            <p
                                                class="text-xs font-bold text-zx-text sm:text-sm"
                                            >
                                                群权限
                                            </p>
                                        </div>
                                        <ZXSelect
                                            :model-value="String(selectedLevel)"
                                            :options="groupLevelOptions"
                                            trigger-class="flex h-8 shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 text-xs text-zx-text transition-colors hover:text-zx-primary sm:h-9 sm:gap-1.5 sm:px-3.5 sm:text-sm"
                                            @update:model-value="
                                                chooseLevel(
                                                    Number($event),
                                                    groups.find(
                                                        (g) =>
                                                            g.group_id ===
                                                            selectedGroupId,
                                                    )!,
                                                )
                                            "
                                        >
                                            <template
                                                #trigger="{ label, open }"
                                            >
                                                <span class="font-semibold">{{
                                                    label
                                                }}</span>
                                                <ChevronDown
                                                    class="h-3 w-3 shrink-0 text-zx-text-subtle transition-transform"
                                                    :class="
                                                        open
                                                            ? 'rotate-180'
                                                            : ''
                                                    "
                                                />
                                            </template>
                                        </ZXSelect>
                                    </div>

                                    <!-- 群开关：真寻在本群的总开关 -->
                                    <div
                                        class="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 sm:gap-3"
                                    >
                                        <div class="min-w-0 flex-1">
                                            <p
                                                class="text-xs font-bold text-zx-text sm:text-sm"
                                            >
                                                群开关
                                            </p>
                                        </div>
                                        <ZxSwitch
                                            :model-value="groupDetail.status"
                                            size="md"
                                            @change="
                                                toggleGroupStatus(
                                                    groups.find(
                                                        (g) =>
                                                            g.group_id ===
                                                            selectedGroupId,
                                                    )!,
                                                )
                                            "
                                        />
                                    </div>
                                </div>
                            </div>

                            <!-- 插件列表 -->
                            <div class="mb-3 sm:mb-4">
                                <div
                                    class="mb-2 flex flex-wrap items-center justify-between gap-2"
                                >
                                    <h3
                                        class="flex items-center gap-1 text-xs font-semibold text-zx-text sm:gap-2 sm:text-sm"
                                    >
                                        <Blocks class="h-3 w-3 sm:h-4 sm:w-4" />
                                        插件列表
                                    </h3>
                                    <div
                                        class="flex items-center gap-1 sm:gap-2"
                                    >
                                        <div
                                            class="flex rounded-2xl bg-gray-100 p-0.5 sm:p-1"
                                        >
                                            <button
                                                @click="
                                                    showPassivePlugins = true
                                                "
                                                :class="[
                                                    'cursor-pointer rounded-2xl px-2 py-0.5 text-[10px] font-medium transition-all sm:px-3 sm:py-1 sm:text-xs',
                                                    showPassivePlugins
                                                        ? 'bg-white text-zx-primary shadow-sm'
                                                        : 'text-zx-text-muted hover:text-zx-text',
                                                ]"
                                            >
                                                被动 ({{
                                                    groupPlugins.filter(
                                                        (p) => p.is_task,
                                                    ).length
                                                }})
                                            </button>
                                            <button
                                                @click="
                                                    showPassivePlugins = false
                                                "
                                                :class="[
                                                    'cursor-pointer rounded-2xl px-2 py-0.5 text-[10px] font-medium transition-all sm:px-3 sm:py-1 sm:text-xs',
                                                    !showPassivePlugins
                                                        ? 'bg-white text-zx-primary shadow-sm'
                                                        : 'text-zx-text-muted hover:text-zx-text',
                                                ]"
                                            >
                                                普通 ({{
                                                    groupPlugins.filter(
                                                        (p) => !p.is_task,
                                                    ).length
                                                }})
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div
                                    v-if="pluginsLoading"
                                    class="max-h-64 overflow-y-auto rounded-2xl bg-gray-50 p-2 sm:p-3"
                                >
                                    <div
                                        class="flex items-center justify-center py-8"
                                    >
                                        <div class="text-sm text-zx-text-subtle">
                                            加载中...
                                        </div>
                                    </div>
                                </div>
                                <div
                                    v-else-if="filteredPlugins.length === 0"
                                    class="max-h-64 overflow-y-auto rounded-2xl bg-gray-50 p-2 sm:p-3"
                                >
                                    <ZxEmptyState
                                        :icon="Blocks"
                                        size="sm"
                                        text="暂无插件数据"
                                    />
                                </div>
                                <div
                                    v-else
                                    class="max-h-64 overflow-y-auto rounded-2xl bg-gray-50 p-2 sm:p-3"
                                >
                                    <div
                                        :class="
                                            embedded
                                                ? 'grid grid-cols-2 gap-2'
                                                : 'grid grid-cols-2 gap-1.5 min-[950px]:grid-cols-3 min-[1150px]:grid-cols-4 sm:gap-2'
                                        "
                                    >
                                        <div
                                            v-for="plugin in filteredPlugins"
                                            :key="plugin.module"
                                            class="flex flex-col justify-center rounded-2xl border border-slate-200 bg-white p-1.5 transition-all sm:p-2"
                                        >
                                            <div
                                                class="flex min-w-0 items-center gap-1 sm:gap-2"
                                            >
                                                <Blocks
                                                    :class="[
                                                        'h-3 w-3 flex-shrink-0 sm:h-4 sm:w-4',
                                                        plugin.is_task
                                                            ? 'text-zx-primary'
                                                            : 'text-zx-primary',
                                                    ]"
                                                />
                                                <div class="min-w-0 flex-1">
                                                    <div
                                                        class="truncate text-[10px] font-medium text-zx-text-strong sm:text-sm"
                                                    >
                                                        {{ plugin.plugin_name }}
                                                    </div>
                                                </div>
                                            </div>
                                            <div
                                                class="mt-1 flex items-center justify-end"
                                            >
                                                <ZxSwitch
                                                    :model-value="
                                                        !plugin.is_blocked
                                                    "
                                                    @update:model-value="
                                                        (val: boolean) => {
                                                            plugin.is_blocked =
                                                                !val;
                                                            togglePlugin(
                                                                plugin,
                                                            );
                                                        }
                                                    "
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- 成员列表 -->
                            <div class="overflow-x-auto">
                                <h3
                                    class="mb-2 flex items-center gap-1 text-xs font-semibold text-zx-text sm:gap-2 sm:text-sm"
                                >
                                    <Users class="h-3 w-3 sm:h-4 sm:w-4" />
                                    群成员列表 ({{ groupMembers.length }})
                                </h3>
                                <div
                                    class="overflow-hidden rounded-2xl bg-gray-50"
                                    :class="!embedded && 'min-w-[800px]'"
                                >
                                    <table class="w-full">
                                        <thead class="bg-gray-100">
                                            <tr>
                                                <th
                                                    class="px-4 py-3 text-left text-xs font-medium tracking-wider text-zx-text-muted uppercase"
                                                >
                                                    成员
                                                </th>
                                                <th
                                                    class="px-2 py-3 text-left text-xs font-medium tracking-wider text-zx-text-muted uppercase sm:px-4"
                                                >
                                                    角色
                                                </th>
                                                <th
                                                    v-if="!embedded"
                                                    class="px-4 py-3 text-left text-xs font-medium tracking-wider text-zx-text-muted uppercase"
                                                >
                                                    金币
                                                </th>
                                                <th
                                                    v-if="!embedded"
                                                    class="px-4 py-3 text-left text-xs font-medium tracking-wider text-zx-text-muted uppercase"
                                                >
                                                    好感度
                                                </th>
                                                <th
                                                    v-if="!embedded"
                                                    class="px-4 py-3 text-left text-xs font-medium tracking-wider text-zx-text-muted uppercase"
                                                >
                                                    状态
                                                </th>
                                                <th
                                                    v-if="!embedded"
                                                    class="px-4 py-3 text-right text-xs font-medium tracking-wider text-zx-text-muted uppercase"
                                                >
                                                    操作
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody
                                            class="divide-y divide-gray-100 bg-white"
                                        >
                                            <tr
                                                v-for="member in paginatedMembers"
                                                :key="member.user_id"
                                                class="transition-colors hover:bg-gray-50"
                                                :class="embedded && 'cursor-pointer'"
                                                @click="
                                                    embedded &&
                                                        openMemberEdit(member)
                                                "
                                            >
                                                <td class="px-4 py-3">
                                                    <div
                                                        class="flex items-center gap-3"
                                                    >
                                                        <ZxAvatar
                                                            :src="member.ava_url"
                                                            :name="
                                                                member.remark ||
                                                                member.nickname
                                                            "
                                                            size="md"
                                                        />
                                                        <div>
                                                            <div
                                                                class="text-sm font-medium text-zx-text-strong"
                                                            >
                                                                {{
                                                                    member.remark ||
                                                                    member.nickname
                                                                }}
                                                            </div>
                                                            <div
                                                                class="text-xs text-zx-text-subtle"
                                                            >
                                                                {{
                                                                    member.user_id
                                                                }}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td class="px-4 py-3">
                                                    <span
                                                        :class="[
                                                            'rounded-full px-4 py-1 text-xs',
                                                            member.role ===
                                                            'owner'
                                                                ? 'bg-red-500 text-white'
                                                                : member.role ===
                                                                    'administrator'
                                                                  ? 'bg-blue-500 text-white'
                                                                  : 'bg-gray-200 text-zx-text-muted',
                                                        ]"
                                                    >
                                                        {{
                                                            member.role ===
                                                            "owner"
                                                                ? "群主"
                                                                : member.role ===
                                                                    "administrator"
                                                                  ? "管理员"
                                                                  : "成员"
                                                        }}
                                                    </span>
                                                </td>
                                                <td
                                                    v-if="!embedded"
                                                    class="px-4 py-3"
                                                >
                                                    <div
                                                        class="flex items-center gap-1 text-sm text-zx-text-muted"
                                                    >
                                                        <span>{{
                                                            member.gold ?? 0
                                                        }}</span>
                                                    </div>
                                                </td>
                                                <td
                                                    v-if="!embedded"
                                                    class="px-4 py-3"
                                                >
                                                    <div
                                                        class="flex items-center gap-1 text-sm text-zx-text-muted"
                                                    >
                                                        <span>{{
                                                            member.favorability ??
                                                            0
                                                        }}</span>
                                                    </div>
                                                </td>
                                                <td
                                                    v-if="!embedded"
                                                    class="px-4 py-3"
                                                >
                                                    <span
                                                        v-if="member.is_banned"
                                                        class="rounded-full bg-red-100 px-4 py-1 text-xs text-red-600"
                                                    >
                                                        已封禁
                                                    </span>
                                                    <span
                                                        v-else
                                                        class="rounded-full bg-green-100 px-4 py-1 text-xs text-green-600"
                                                    >
                                                        正常
                                                    </span>
                                                </td>
                                                <td
                                                    v-if="!embedded"
                                                    class="px-4 py-3 text-right"
                                                >
                                                    <div
                                                        class="flex items-center justify-end gap-2"
                                                    >
                                                        <!--                                                        大饼状态-->
                                                        <!--                                                        <button-->
                                                        <!--                                                            @click="-->
                                                        <!--                                                                toggleMemberBan(-->
                                                        <!--                                                                    member,-->
                                                        <!--                                                                )-->
                                                        <!--                                                            "-->
                                                        <!--                                                            :class="[-->
                                                        <!--                                                                'cursor-pointer rounded-2xl px-4 py-1 text-xs',-->
                                                        <!--                                                                member.is_banned-->
                                                        <!--                                                                    ? 'bg-green-50 text-green-600 hover:bg-green-100'-->
                                                        <!--                                                                    : 'bg-red-50 text-red-600 hover:bg-zx-danger-soft',-->
                                                        <!--                                                            ]"-->
                                                        <!--                                                        >-->
                                                        <!--                                                            {{-->
                                                        <!--                                                                member.is_banned-->
                                                        <!--                                                                    ? "解封"-->
                                                        <!--                                                                    : "封禁"-->
                                                        <!--                                                            }}-->
                                                        <!--                                                        </button>-->
                                                        <button
                                                            @click="
                                                                openMemberEdit(
                                                                    member,
                                                                )
                                                            "
                                                            class="cursor-pointer rounded-2xl bg-slate-100 px-4 py-1 text-xs text-zx-text-muted hover:bg-slate-200"
                                                        >
                                                            编辑
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                                <!-- 分页控件 -->
                                <ZxPagination
                                    v-if="memberTotalPages > 1"
                                    class="mt-3 px-2"
                                    :page="memberCurrentPage"
                                    :total-pages="memberTotalPages"
                                    :summary-text="`第 ${memberCurrentPage} 页，共 ${memberTotalPages} 页，总计 ${groupMembers.length} 人`"
                                    @update:model-value="changeMemberPage"
                                />
                            </div>
                        </div>
                    </div>

                    <div v-else class="flex h-full items-center justify-center">
                        <ZxEmptyState
                            :icon="Group"
                            size="md"
                            text="暂无详情数据"
                            :sub-text="`selectedGroupId: ${selectedGroupId}`"
                        />
                    </div>
                </template>

                <!-- 好友详情 -->
                <template v-else>
                    <div
                        v-if="!selectedUserId"
                        class="flex h-full items-center justify-center"
                    >
                        <div class="text-center text-zx-text-subtle">
                            <Users class="mx-auto mb-4 h-16 w-16 opacity-20" />
                            <p class="text-zx-text-muted">请选择一个好友查看详情</p>
                        </div>
                    </div>

                    <div v-else-if="memberDetail" class="flex h-full flex-col">
                        <!-- 详情头部 -->
                        <div class="border-b border-gray-100 p-6">
                            <div class="flex items-center gap-2 sm:gap-4">
                                <!-- 移动端返回按钮 -->
                                <button
                                    v-if="!embedded"
                                    @click="showSidebar = true"
                                    class="flex-shrink-0 rounded-2xl p-2 transition-colors hover:bg-white/50 sm:hidden"
                                >
                                    <ChevronLeft
                                        class="h-5 w-5 text-zx-text-muted"
                                    />
                                </button>
                                <ZxAvatar
                                    :src="
                                        'ava_url' in memberDetail
                                            ? memberDetail.ava_url
                                            : ''
                                    "
                                    :name="
                                        'nickname' in memberDetail
                                            ? memberDetail.nickname
                                            : ''
                                    "
                                    size="lg"
                                    class="flex-shrink-0 shadow-md sm:!h-16 sm:!w-16"
                                />
                                <div class="min-w-0 flex-1">
                                    <h2
                                        class="truncate text-base font-bold text-zx-text-strong sm:text-xl"
                                    >
                                        {{
                                            "nickname" in memberDetail
                                                ? memberDetail.nickname
                                                : ""
                                        }}
                                    </h2>
                                    <p
                                        class="mt-0.5 text-xs text-zx-text-muted sm:mt-1 sm:text-sm"
                                    >
                                        {{
                                            "user_id" in memberDetail
                                                ? memberDetail.user_id
                                                : ""
                                        }}
                                    </p>
                                </div>
                                <div
                                    class="flex flex-shrink-0 gap-1.5 sm:gap-2"
                                >
                                    <button
                                        v-if="embedded"
                                        title="返回"
                                        class="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-zx-text-muted transition-colors hover:bg-slate-200 hover:text-zx-text"
                                        @click="emit('close')"
                                    >
                                        <X class="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- 好友详情内容 -->
                        <div class="flex-1 space-y-4 overflow-y-auto p-4">
                            <!-- 加载状态 -->
                            <div
                                v-if="friendDetailLoading"
                                class="flex items-center justify-center py-12"
                            >
                                <div
                                    class="h-8 w-8 animate-spin rounded-full border-b-2 border-zx-primary"
                                ></div>
                            </div>

                            <!-- 详情内容 -->
                            <template v-else-if="friendDetail">
                                <!-- 金币和好感度卡片 -->
                                <!--                                <div class="grid grid-cols-2 gap-3">-->
                                <!--                                    &lt;!&ndash; 金币 &ndash;&gt;-->
                                <!--                                    <div-->
                                <!--                                        class="rounded-2xl border-1 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-4"-->
                                <!--                                    >-->
                                <!--                                        <div-->
                                <!--                                            class="mb-2 flex items-center gap-2"-->
                                <!--                                        >-->
                                <!--                                            <Coins-->
                                <!--                                                class="h-4 w-4 text-amber-600"-->
                                <!--                                            />-->
                                <!--                                            <span-->
                                <!--                                                class="text-sm font-medium text-zx-text-muted"-->
                                <!--                                                >金币</span-->
                                <!--                                            >-->
                                <!--                                        </div>-->
                                <!--                                        <div-->
                                <!--                                            class="flex items-center justify-between"-->
                                <!--                                        >-->
                                <!--                                            <span-->
                                <!--                                                class="text-2xl font-bold text-amber-600"-->
                                <!--                                            >-->
                                <!--                                                {{-->
                                <!--                                                    friendDetail.gold.toLocaleString()-->
                                <!--                                                }}-->
                                <!--                                            </span>-->
                                <!--                                            <button-->
                                <!--                                                @click="openFriendEdit('gold')"-->
                                <!--                                                class="rounded-lg p-1.5 transition-colors hover:bg-amber-100"-->
                                <!--                                            >-->
                                <!--                                                <Pencil-->
                                <!--                                                    class="h-3.5 w-3.5 text-amber-600"-->
                                <!--                                                />-->
                                <!--                                            </button>-->
                                <!--                                        </div>-->
                                <!--                                    </div>-->

                                <!--                                    &lt;!&ndash; 好感度 &ndash;&gt;-->
                                <!--                                    <div-->
                                <!--                                        class="rounded-2xl border-1 border-pink-200 bg-gradient-to-br from-pink-50 to-rose-50 p-4"-->
                                <!--                                    >-->
                                <!--                                        <div-->
                                <!--                                            class="mb-2 flex items-center gap-2"-->
                                <!--                                        >-->
                                <!--                                            <Heart-->
                                <!--                                                class="h-4 w-4 text-pink-600"-->
                                <!--                                            />-->
                                <!--                                            <span-->
                                <!--                                                class="text-sm font-medium text-zx-text-muted"-->
                                <!--                                                >好感度</span-->
                                <!--                                            >-->
                                <!--                                        </div>-->
                                <!--                                        <div-->
                                <!--                                            class="flex items-center justify-between"-->
                                <!--                                        >-->
                                <!--                                            <span-->
                                <!--                                                class="text-2xl font-bold text-pink-600"-->
                                <!--                                            >-->
                                <!--                                                {{-->
                                <!--                                                    friendDetail.favorability.toFixed(-->
                                <!--                                                        1,-->
                                <!--                                                    )-->
                                <!--                                                }}-->
                                <!--                                            </span>-->
                                <!--                                            <button-->
                                <!--                                                @click="-->
                                <!--                                                    openFriendEdit(-->
                                <!--                                                        'favorability',-->
                                <!--                                                    )-->
                                <!--                                                "-->
                                <!--                                                class="rounded-lg p-1.5 transition-colors hover:bg-pink-100"-->
                                <!--                                            >-->
                                <!--                                                <Pencil-->
                                <!--                                                    class="h-3.5 w-3.5 text-pink-600"-->
                                <!--                                                />-->
                                <!--                                            </button>-->
                                <!--                                        </div>-->
                                <!--                                    </div>-->
                                <!--                                </div>-->

                                <!-- 互动趋势 -->
                                <div
                                    class="rounded-2xl border-1 border-slate-200 bg-white p-4"
                                >
                                    <div
                                        class="mb-3 flex items-center justify-between"
                                    >
                                        <div class="flex items-center gap-2">
                                            <TrendingUp
                                                class="h-4 w-4 text-zx-primary"
                                            />
                                            <span
                                                class="text-sm font-semibold text-zx-text"
                                                >近7天互动趋势</span
                                            >
                                        </div>
                                        <div
                                            v-if="friendTrend"
                                            class="flex items-center gap-3 text-xs text-zx-text-muted"
                                        >
                                            <span
                                                class="flex items-center gap-1"
                                            >
                                                <MessageSquare
                                                    class="h-3 w-3"
                                                />
                                                {{ friendTrend.total_chat }}
                                            </span>
                                            <span
                                                class="flex items-center gap-1"
                                            >
                                                <Zap class="h-3 w-3" />
                                                {{ friendTrend.total_call }}
                                            </span>
                                        </div>
                                    </div>

                                    <!-- 趋势加载 -->
                                    <div
                                        v-if="friendTrendLoading"
                                        class="flex h-40 items-center justify-center"
                                    >
                                        <div
                                            class="h-6 w-6 animate-spin rounded-full border-b-2 border-zx-primary"
                                        ></div>
                                    </div>

                                    <!-- 折线图 -->
                                    <div
                                        v-else-if="
                                            friendTrendChartData &&
                                            friendTrendChartData.datasets[0]
                                                .data.length > 0
                                        "
                                        class="h-40"
                                    >
                                        <Line
                                            :data="friendTrendChartData"
                                            :options="friendTrendChartOptions"
                                        />
                                    </div>

                                    <div
                                        v-else
                                        class="flex h-40 items-center justify-center text-zx-text-subtle"
                                    >
                                        <span class="text-sm">暂无数据</span>
                                    </div>
                                </div>
                                <div
                                    class="flex h-96 items-center justify-center"
                                >
                                    <div class="text-center text-zx-text-subtle">
                                        <Users
                                            class="mx-auto mb-4 h-16 w-16 opacity-20"
                                        />
                                        <p class="text-zx-text-muted">施工中</p>
                                    </div>
                                </div>
                            </template>

                            <!-- 无数据 -->
                            <ZxEmptyState
                                v-else
                                :icon="Users"
                                size="md"
                                text="暂无好友数据"
                            />
                        </div>
                    </div>
                </template>
            </div>
        </div>

        <!-- 发送消息对话框 -->
        <Teleport to="body">
            <Transition
                name="modal-jelly"
                :duration="{ enter: 500, leave: 250 }"
            >
                <div
                    v-if="sendMessageDialogOpen"
                    class="fixed inset-0 z-50 flex items-center justify-center p-4"
                >
                    <div
                        class="glass-overlay fixed inset-0"
                        @click="sendMessageDialogOpen = false"
                    ></div>
                    <div
                        class="modal-content relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
                    >
                        <div
                            class="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4"
                        >
                            <h3 class="text-lg font-semibold text-zx-text-strong">
                                发送消息
                            </h3>
                            <button
                                @click="sendMessageDialogOpen = false"
                                class="rounded-2xl p-1 transition-colors hover:bg-white/50"
                            >
                                <svg
                                    class="h-5 w-5 text-zx-text-muted"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M6 18L18 6M6 6l12 12"
                                    />
                                </svg>
                            </button>
                        </div>
                        <div class="flex-1 overflow-y-auto p-6">
                            <div v-if="currentFriend" class="send-message-form">
                                <div class="message-target">
                                    <ZxAvatar
                                        :src="currentFriend.ava_url"
                                        :name="currentFriend.nickname"
                                        size="md"
                                        class="message-target-avatar"
                                    />
                                    <div class="message-target-info">
                                        <span class="message-target-name">{{
                                            currentFriend.nickname
                                        }}</span>
                                        <span class="message-target-id">{{
                                            currentFriend.user_id
                                        }}</span>
                                    </div>
                                </div>
                                <ZXInput
                                    v-model="messageContent"
                                    type="textarea"
                                    :rows="6"
                                    placeholder="输入消息内容..."
                                />
                                <div class="dialog-actions">
                                    <ZxButton
                                        variant="ghost"
                                        @click="sendMessageDialogOpen = false"
                                        >取消</ZxButton
                                    >
                                    <ZxButton @click="confirmSendMessage"
                                        >发送</ZxButton
                                    >
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </Transition>

            <!-- 成员编辑对话框 -->
            <Transition
                name="modal-jelly"
                :duration="{ enter: 500, leave: 250 }"
            >
                <div
                    v-if="memberEditDialogOpen"
                    class="fixed inset-0 z-50 flex items-center justify-center p-4"
                >
                    <div
                        class="glass-overlay fixed inset-0"
                        @click="memberEditDialogOpen = false"
                    ></div>
                    <div
                        class="modal-content relative flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
                    >
                        <div
                            class="flex items-center justify-between border-b border-slate-200 px-6 py-6 pb-4"
                        >
                            <h3 class="text-lg font-semibold text-zx-text-strong">
                                编辑成员信息
                            </h3>
                            <button
                                @click="memberEditDialogOpen = false"
                                class="rounded-2xl p-1 transition-colors hover:bg-white/50"
                            >
                                <svg
                                    class="h-5 w-5 text-zx-text-muted"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M6 18L18 6M6 6l12 12"
                                    />
                                </svg>
                            </button>
                        </div>
                        <div class="flex-1 overflow-y-auto p-6">
                            <div v-if="currentMember" class="edit-member-form">
                                <!-- 成员信息 -->
                                <div
                                    class="mb-6 flex items-center gap-3 rounded-2xl bg-slate-50 p-3"
                                >
                                    <ZxAvatar
                                        :src="currentMember.ava_url"
                                        :name="
                                            currentMember.remark ||
                                            currentMember.nickname
                                        "
                                        size="lg"
                                    />
                                    <div class="flex-1">
                                        <div class="font-medium text-zx-text-strong">
                                            {{
                                                currentMember.remark ||
                                                currentMember.nickname
                                            }}
                                        </div>
                                        <div class="text-xs text-zx-text-muted">
                                            {{ currentMember.user_id }}
                                        </div>
                                    </div>
                                </div>

                                <!-- 金币输入 -->
                                <div class="mb-4">
                                    <label
                                        class="mb-2 block text-sm font-medium text-zx-text"
                                        >金币数量</label
                                    >
                                    <ZxInputNumber
                                        v-model="editGold"
                                        :min="0"
                                        :max="999999"
                                        :step="100"
                                        class="w-full"
                                    />
                                </div>

                                <!-- 好感度输入 -->
                                <div class="mb-4">
                                    <label
                                        class="mb-2 block text-sm font-medium text-zx-text"
                                        >好感度</label
                                    >
                                    <ZxInputNumber
                                        v-model="editFavorability"
                                        :min="0"
                                        :max="99999"
                                        :step="10"
                                        class="w-full"
                                    />
                                </div>

                                <!-- 封禁开关 -->
                                <!--                                <div class="mb-4">-->
                                <!--                                    <label-->
                                <!--                                        class="flex cursor-pointer items-center justify-between rounded-2xl bg-red-50 p-3"-->
                                <!--                                    >-->
                                <!--                                        <div class="flex items-center gap-2">-->
                                <!--                                            <span-->
                                <!--                                                class="text-sm font-medium text-zx-text"-->
                                <!--                                                >封禁状态</span-->
                                <!--                                            >-->
                                <!--                                        </div>-->
                                <!--                                        <ZxSwitch-->
                                <!--                                            v-model="editIsBanned"-->
                                <!--                                            size="large"-->
                                <!--                                            :active-text="-->
                                <!--                                                editIsBanned ? '已封禁' : '正常'-->
                                <!--                                            "-->
                                <!--                                        />-->
                                <!--                                    </label>-->
                                <!--                                </div>-->
                            </div>
                        </div>
                        <div
                            class="border-t border-gray-100 bg-gray-50 px-6 py-4"
                        >
                            <div class="flex justify-end gap-2">
                                <ZxButton
                                    variant="ghost"
                                    @click="memberEditDialogOpen = false"
                                    >取消</ZxButton
                                >
                                <ZxButton @click="saveMemberEdit"
                                    >保存</ZxButton
                                >
                            </div>
                        </div>
                    </div>
                </div>
            </Transition>

            <!-- 好友编辑对话框 -->
            <Transition
                name="modal-jelly"
                :duration="{ enter: 500, leave: 250 }"
            >
                <div
                    v-if="friendEditDialogOpen"
                    class="fixed inset-0 z-50 flex items-center justify-center p-4"
                >
                    <div
                        class="glass-overlay fixed inset-0"
                        @click="friendEditDialogOpen = false"
                    ></div>
                    <div
                        class="modal-content relative flex max-h-[85vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
                    >
                        <div
                            class="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4"
                        >
                            <h3 class="text-lg font-semibold text-zx-text-strong">
                                编辑{{
                                    friendEditField === "gold"
                                        ? "金币"
                                        : "好感度"
                                }}
                            </h3>
                            <button
                                @click="friendEditDialogOpen = false"
                                class="rounded-2xl p-1 transition-colors hover:bg-white/50"
                            >
                                <svg
                                    class="h-5 w-5 text-zx-text-muted"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M6 18L18 6M6 6l12 12"
                                    />
                                </svg>
                            </button>
                        </div>
                        <div class="flex-1 overflow-y-auto p-6">
                            <div class="mb-4">
                                <label
                                    class="mb-2 block text-sm font-medium text-zx-text"
                                >
                                    {{
                                        friendEditField === "gold"
                                            ? "金币数量"
                                            : "好感度"
                                    }}
                                </label>
                                <ZxInputNumber
                                    v-model="friendEditValue"
                                    :min="0"
                                    :max="
                                        friendEditField === 'gold'
                                            ? 999999
                                            : 9999
                                    "
                                    :step="friendEditField === 'gold' ? 100 : 1"
                                    :precision="
                                        friendEditField === 'favorability'
                                            ? 1
                                            : 0
                                    "
                                    class="w-full"
                                />
                            </div>
                            <div class="flex justify-end gap-2">
                                <ZxButton
                                    variant="ghost"
                                    @click="friendEditDialogOpen = false"
                                    >取消</ZxButton
                                >
                                <ZxButton
                                    :disabled="friendEditSaving"
                                    @click="saveFriendEdit"
                                >
                                    <span
                                        v-if="friendEditSaving"
                                        class="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent text-[color:var(--zx-color-on-primary)]"
                                    ></span>
                                    保存
                                </ZxButton>
                            </div>
                        </div>
                    </div>
                </div>
            </Transition>
        </Teleport>
    </div>
</template>

<style scoped>
.message-target {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: linear-gradient(
        135deg,
        var(--zx-color-primary-tint) 0%,
        var(--zx-color-primary-soft) 100%
    );
    border-radius: 12px;
    margin-bottom: 16px;
}

.message-target-avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    box-shadow: 0 2px 8px color-mix(in srgb, var(--zx-color-primary) 22%, transparent);
}

.message-target-name {
    font-weight: 600;
    color: #1f2937;
    font-size: 14px;
}

.message-target-id {
    font-size: 12px;
    color: #6b7280;
    font-family: monospace;
}

.dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 16px;
}
</style>
