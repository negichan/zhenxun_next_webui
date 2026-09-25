<script setup lang="ts">
import { computed, h, markRaw, ref } from "vue";
import { GroupIcon, LogOut, Pencil, Trash2, Users } from "lucide-vue-next";
import { useChatStore } from "@/store/chat.ts";
import { storeToRefs } from "pinia";
import { onMounted, watch } from "vue";
import { useBotStore } from "@/store/bot.ts";
import { ZXMessageBox, ZXNotification } from "@/services/ui";
import { manageApi } from "@/utils/api-next";
import ZXInput from "@/components/zxcomponent/ZXInput.vue";
import { openContextMenu } from "@/components/zxcomponent/ContextMenu";
import { useVirtualList } from "@/composables/useVirtualList";

const chatStore = useChatStore();

const botStore = useBotStore();

const {
    activeTab,
    selectedContact,
    friends,
    groups,
    selectedId,
    loadingContacts,
} = storeToRefs(chatStore);
const { selectContact, clearSelection, loadContacts } = chatStore;

const contactTabOptions = computed(() => [
    {
        label: "好友",
        value: "friend" as const,
        icon: markRaw(Users),
        badge: friends.value.length,
    },
    {
        label: "群聊",
        value: "group" as const,
        icon: markRaw(GroupIcon),
        badge: groups.value.length,
    },
]);

// 联系人列表虚拟滚动：卡片高 48（头像 32 + 上下内边距 16），行间留 8px gap
const ROW_H = 48;
const ROW_GAP = 8;
const ROW_STRIDE = ROW_H + ROW_GAP;
const friendList = useVirtualList(() => friends.value.length, ROW_STRIDE);
const groupList = useVirtualList(() => groups.value.length, ROW_STRIDE);

onMounted(async () => {
    // 获取并保存当前 bot 信息

    await loadContacts();

    // 注册消息回调
});

// 顶栏 bot 选择器（User.vue）切换后重载联系人：
// 旧 bot 的好友/群列表对当前 bot 无效，选中的联系人一并清掉
watch(
    () => botStore.selectedBotId,
    async (newBotId, oldBotId) => {
        if (!newBotId || newBotId === oldBotId) return;
        clearSelection();
        await loadContacts();
    },
);

// ==================== 右键菜单：重命名 / 删除 ====================

type ContactType = "friend" | "group";

const renameValue = ref("");
const renameTarget = ref<{ type: ContactType; id: string } | null>(null);

const openContactMenu = (
    e: MouseEvent,
    type: ContactType,
    item: any,
) => {
    // openContextMenu 会在有选中文本时自动附加"复制"项
    openContextMenu(e, [
            {
                label: type === "friend" ? "修改备注" : "修改群名",
                icon: Pencil,
                action: () => {
                    renameTarget.value = {
                        type,
                        id: String(
                            type === "friend" ? item.user_id : item.group_id,
                        ),
                    };
                    renameValue.value =
                        type === "friend"
                            ? item.remark || ""
                            : item.group_name || "";
                    openRenameDialog();
                },
            },
            {
                label: type === "friend" ? "删除好友" : "退出群聊",
                icon: type === "friend" ? Trash2 : LogOut,
                danger: true,
                action: () => openRemoveConfirm(type, item),
            },
    ]);
};

const openRenameDialog = () => {
    const type = renameTarget.value?.type;
    ZXMessageBox({
        title: type === "friend" ? "修改好友备注" : "修改群名",
        cancelButtonText: "取消",
        confirmButtonText: "确定修改",
        slots: {
            default: () =>
                h(ZXInput, {
                    modelValue: renameValue.value,
                    "onUpdate:modelValue": (v: any) =>
                        (renameValue.value = String(v)),
                    placeholder:
                        type === "friend" ? "输入新备注" : "输入新群名",
                    onKeydown: (e: KeyboardEvent) => {
                        if (e.key === "Enter") submitRename();
                    },
                }),
        },
        onConfirm: () => submitRename(),
    });
};

const submitRename = async () => {
    const botId = botStore.getSelectedBotId();
    const target = renameTarget.value;
    const name = renameValue.value.trim();
    if (!botId || !target) return;
    if (!name) {
        ZXNotification({
            title: "等等",
            message: target.type === "friend" ? "备注不能为空哦" : "群名不能为空哦",
            type: "warning",
        });
        return;
    }
    try {
        const res =
            target.type === "friend"
                ? await manageApi.setFriendRemark({
                      bot_id: botId,
                      user_id: target.id,
                      remark: name,
                  })
                : await manageApi.renameGroup({
                      bot_id: botId,
                      group_id: target.id,
                      group_name: name,
                  });
        if (res?.success && res.data) {
            ZXNotification({
                title: "改好啦",
                message: target.type === "friend" ? "备注已通过协议端同步" : "群名已通过协议端同步",
                type: "success",
            });
            await loadContacts();
        } else {
            ZXNotification({
                title: "没改成功",
                message: res?.message || "协议端可能不支持该操作哦",
                type: "error",
            });
        }
    } catch (err: any) {
        ZXNotification({
            title: "哎呀",
            message:
                err?.response?.data?.message || "操作失败，请稍后再试",
            type: "error",
        });
    }
};

// ==================== 删除确认弹窗 ====================

const removeTarget = ref<{
    type: ContactType;
    id: string;
    name: string;
    avaUrl: string;
} | null>(null);

const openRemoveConfirm = (type: ContactType, item: any) => {
    const isFriend = type === "friend";
    removeTarget.value = {
        type,
        id: String(isFriend ? item.user_id : item.group_id),
        name: isFriend
            ? item.remark || item.nickname || String(item.user_id)
            : item.group_name || String(item.group_id),
        avaUrl: item.ava_url || "",
    };
    ZXMessageBox({
        title: isFriend ? "删除好友" : "退出群聊",
        cancelButtonText: "取消",
        confirmButtonText: isFriend ? "删除" : "退出",
        confirmButtonHoverBg: "bg-red-500 hover:bg-red-600",
        slots: {
            default: () =>
                h(
                    "p",
                    {
                        class:
                            "flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-zx-text",
                    },
                    [
                        "确定要删除",
                        removeTarget.value?.avaUrl
                            ? h("img", {
                                  src: removeTarget.value.avaUrl,
                                  referrerpolicy: "no-referrer",
                                  class: "inline-block h-6 w-6 rounded-full object-cover",
                                  onError: (e: Event) =>
                                      (e.target as HTMLImageElement).style.visibility =
                                          "hidden",
                              })
                            : h(
                                  "span",
                                  {
                                      class:
                                          "inline-flex h-6 w-6 items-center justify-center rounded-full bg-zx-primary-soft text-[10px] font-bold text-zx-primary",
                                  },
                                  (removeTarget.value?.name || "?").charAt(0),
                              ),
                        h(
                            "span",
                            { class: "font-bold text-zx-text-strong" },
                            removeTarget.value?.name ?? "",
                        ),
                        h(
                            "span",
                            { class: "text-zx-text-subtle" },
                            `(${removeTarget.value?.id})`,
                        ),
                        "吗？",
                    ],
                ),
        },
        onConfirm: () => doRemove(),
    });
};

const doRemove = async () => {
    const target = removeTarget.value;
    if (!target) return;
    const isFriend = target.type === "friend";
    const botId = botStore.getSelectedBotId();
    if (!botId) return;
    try {
        const res = isFriend
            ? await manageApi.deleteFriend({
                  bot_id: botId,
                  user_id: target.id,
              })
            : await manageApi.leaveGroup({
                  bot_id: botId,
                  group_id: target.id,
              });
        if (res?.success && res.data) {
            // 删除的是当前选中的联系人时清空会话区
            if (
                selectedContact.value === target.type &&
                selectedId.value === target.id
            ) {
                selectedContact.value = null;
                selectedId.value = "";
            }
            ZXNotification({
                title: "已完成",
                message: isFriend ? "好友已删除" : "已退出群聊",
                type: "success",
            });
            await loadContacts();
        } else {
            ZXNotification({
                title: "没删掉",
                message: res?.message || "协议端可能不支持该操作哦",
                type: "error",
            });
        }
    } catch (err: any) {
        ZXNotification({
            title: "哎呀",
            message: err?.response?.data?.message || "操作失败，请稍后再试",
            type: "error",
        });
    }
};
</script>

<template>
    <div
        :class="[
            'flex h-full min-w-0 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white px-2 pt-4 shadow-sm transition-all duration-300',
            selectedContact ? 'hidden sm:flex' : 'flex',
            'w-full flex-shrink-0 sm:w-[calc(var(--spacing)*50)] md:w-64 lg:w-72',
        ]"
        @contextmenu.prevent
    >
        <!-- 标签页切换 -->
        <div class="px-2 pb-3">
            <ZxSegmented
                v-model="activeTab"
                :options="contactTabOptions"
                block
            />
        </div>

        <!-- 好友列表（虚拟滚动） -->
        <div
            v-show="activeTab === 'friend'"
            :ref="friendList.container"
            class="min-h-0 flex-1 overflow-y-auto p-2"
            @scroll.passive="friendList.onScroll"
        >
            <div
                v-show="friends.length > 0"
                class="relative"
                :style="{ height: `${friendList.totalHeight.value}px` }"
            >
                <div
                    v-for="friend in friends.slice(
                        friendList.startIndex.value,
                        friendList.endIndex.value,
                    )"
                    :key="friend.user_id"
                    :style="{
                        top: `${friends.indexOf(friend) * ROW_STRIDE}px`,
                        height: `${ROW_H}px`,
                    }"
                    @click="
                        selectContact(
                            'friend',
                            friend.user_id,
                            friend.remark || friend.nickname || '未知好友',
                        )
                    "
                    @contextmenu.prevent.stop="openContactMenu($event, 'friend', friend)"
                    :class="
                        selectedId === friend.user_id &&
                        selectedContact === 'friend'
                            ? 'bg-zx-primary-tint'
                            : 'hover:bg-gray-100'
                    "
                    class="absolute left-0 right-0 btn-touch flex cursor-pointer items-center gap-3 rounded-2xl p-2 transition-colors"
                >
                    <ZxAvatar
                        :src="friend.ava_url"
                        :name="friend.remark || friend.nickname || '友'"
                        size="sm"
                    />
                    <span class="min-w-0 flex-1 truncate text-sm text-zx-text"
                        >{{ friend.remark || friend.nickname || "未知好友" }}
                        <span class="text-xs text-zx-text-muted"
                            >({{ friend.user_id }})</span
                        >
                    </span>
                </div>
            </div>
            <div
                v-if="loadingContacts"
                class="py-2 text-center text-xs text-zx-text-subtle"
            >
                加载中...
            </div>
            <ZxEmptyState
                v-if="!loadingContacts && friends.length === 0"
                :text="botStore.selectedBot ? '暂无好友' : 'Bot 未接入，暂无好友'"
                size="sm"
            />
        </div>

        <!-- 群组列表（虚拟滚动） -->
        <div
            v-show="activeTab === 'group'"
            :ref="groupList.container"
            class="min-h-0 flex-1 overflow-y-auto p-2"
            @scroll.passive="groupList.onScroll"
        >
            <div
                v-show="groups.length > 0"
                class="relative"
                :style="{ height: `${groupList.totalHeight.value}px` }"
            >
                <div
                    v-for="group in groups.slice(
                        groupList.startIndex.value,
                        groupList.endIndex.value,
                    )"
                    :key="group.group_id"
                    :style="{
                        top: `${groups.indexOf(group) * ROW_STRIDE}px`,
                        height: `${ROW_H}px`,
                    }"
                    @click="selectContact('group', group.group_id, group.group_name)"
                    @contextmenu.prevent.stop="openContactMenu($event, 'group', group)"
                    :class="
                        selectedId === group.group_id && selectedContact === 'group'
                            ? 'bg-zx-primary-tint'
                            : 'hover:bg-gray-100'
                    "
                    class="absolute left-0 right-0 btn-touch flex cursor-pointer items-center gap-3 rounded-2xl p-2 transition-colors"
                >
                    <ZxAvatar
                        :src="group.ava_url"
                        :name="group.group_name"
                        size="sm"
                    />
                    <span class="min-w-0 flex-1 truncate text-sm text-zx-text"
                        >{{ group.group_name }}
                        <span class="text-xs text-zx-text-muted"
                            >({{ group.group_id }})</span
                        >
                    </span>
                </div>
            </div>
            <div
                v-if="loadingContacts"
                class="py-2 text-center text-xs text-zx-text-subtle"
            >
                加载中...
            </div>
            <ZxEmptyState
                v-if="!loadingContacts && groups.length === 0"
                :text="botStore.selectedBot ? '暂无群组' : 'Bot 未接入，暂无群组'"
                size="sm"
            />
        </div>

    </div>
</template>

<style scoped></style>
