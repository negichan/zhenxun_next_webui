<script setup lang="ts">
import { modalJelly } from "@/composables/useGsapTransition";
import { computed, nextTick, onMounted, onUnmounted, ref, watch, watchEffect } from "vue";
import {
    ArrowDown,
    ArrowLeft,
    Bot,
    Check,
    ImageIcon,
    ImageOff,
    Link2,
    LogIn,
    MapPin,
    MessageSquare,
    Mic,
    Pencil,
    Plus,
    Search,
    Send,
    Settings,
    Trash2,
    UserRound,
    UserRoundPlus,
    UserRoundX,
    UsersRound,
    LogOut,
    X,
} from "lucide-vue-next";
import { onClickOutside } from "@vueuse/core";
import ZXInput from "@/components/zxcomponent/ZXInput.vue";
import ZXNotification from "@/components/zxcomponent/Notification";
import { openContextMenu } from "@/components/zxcomponent/ContextMenu";
import { api, getWsBaseUrl, getWsTokenQuery } from "./api";
import defaultAva from "@/assets/img/avatar.webp";
import { OneBotV11Simulator } from "@/utils/onebot/client";
import {
    buildFriendRequestEvent,
    buildGroupDecreaseEvent,
    buildGroupIncreaseEvent,
    buildGroupMessageEvent,
    buildPrivateMessageEvent,
} from "@/utils/onebot/events";
import {
    cqToSegments,
    looksLikeBase64,
} from "@/utils/onebot/message";
import type { MessageSegment } from "@/utils/onebot/types";
import { simState, type SimFriend, type SimMember } from "@/utils/onebot/state";
import ChatComposer, { type OutgoingPart } from "@/views/chat/ChatComposer.vue";
import {
    cacheBubble,
    clearCachedBubbles,
    getCachedBubbles,
} from "@/utils/onebot-chat-db";

// ==================== 设置持久化 ====================

const STORAGE_PREFIX = "onebot.ob.";

const loadSetting = (key: string, fallback: string) =>
    localStorage.getItem(STORAGE_PREFIX + key) ?? fallback;

// 桥接地址：跟随 WebUI 的连接推导；WebUI JWT 走 query 参数做握手鉴权
const bridgeWsUrl = () =>
    getWsBaseUrl().replace(/\/zhenxun\/ws\/v1.*$/, "") +
    `/zhenxun/ws/v1/onebot?${getWsTokenQuery()}`;

// 连接配置（token / 心跳 / 开关）
const accessToken = ref(loadSetting("token", ""));
const heartbeatInterval = ref(loadSetting("heartbeat", "30"));
const autoReconnect = ref(loadSetting("autoReconnect", "1") === "1");
const autoConnect = ref(loadSetting("autoConnect", "1") === "1");
const reconnectInterval = ref(loadSetting("reconnectInterval", "3"));
const showError = ref(loadSetting("showError", "0") === "1");

watch([accessToken, heartbeatInterval, reconnectInterval], () => {
    localStorage.setItem(STORAGE_PREFIX + "token", accessToken.value);
    localStorage.setItem(STORAGE_PREFIX + "heartbeat", heartbeatInterval.value);
    localStorage.setItem(
        STORAGE_PREFIX + "reconnectInterval",
        reconnectInterval.value,
    );
});

watch([autoReconnect, autoConnect, showError], () => {
    localStorage.setItem(
        STORAGE_PREFIX + "autoReconnect",
        autoReconnect.value ? "1" : "0",
    );
    localStorage.setItem(
        STORAGE_PREFIX + "autoConnect",
        autoConnect.value ? "1" : "0",
    );
    localStorage.setItem(STORAGE_PREFIX + "showError", showError.value ? "1" : "0");
});

// ==================== 角色（用户 / 机器人共用一个身份池） ====================

interface SimUser {
    user_id: number;
    nickname: string;
    /** 自定义头像（dataURL），缺省按 QQ 号取真实头像 */
    avatar?: string;
}

// 不预置默认账户：身份由用户在"身份管理"里自行创建
const users = ref<SimUser[]>([]);

// 恢复持久化的身份列表
try {
    const raw = localStorage.getItem(STORAGE_PREFIX + "users");
    if (raw) {
        const parsed = JSON.parse(raw) as SimUser[];
        if (Array.isArray(parsed) && parsed.length > 0) {
            users.value = parsed;
        }
    }
} catch {
    /* 解析失败用默认列表 */
}

const persistUsersLocal = () =>
    localStorage.setItem(
        STORAGE_PREFIX + "users",
        JSON.stringify(users.value),
    );

// 统一状态快照。不含身份选择：my_user_id/bot_id 只有新模拟端初次同步，
// 上传本机值会覆盖云端、导致其他新端拿到错的"谁是用户/谁是 bot"
const buildStatePayload = () => ({
    groups: simState.groups,
    members: simState.members,
    friends: simState.friends,
    users: users.value,
});

// 身份变更：写 localStorage（即时）+ 同步到后端（跨浏览器恢复）
const persistUsers = () => {
    persistUsersLocal();
    if (!stateLoaded) return;
    api.post("/onebot/state", buildStatePayload()).catch(() => {
        /* 保存失败下次变更再试 */
    });
};

// ==================== 群聊持久化（存后端） ====================

let stateLoaded = false;

// 从后端拉取持久化的群聊与成员、身份
const loadSimState = async () => {
    try {
        const res = await api.get<{ groups: any[]; members: Record<string, SimMember[]>; friends: SimFriend[]; users?: SimUser[]; my_user_id?: string; bot_id?: string }>(
            "/onebot/state",
        );
        const data = res.data;
        if (data) {
            if (Array.isArray(data.groups) && data.groups.length) {
                simState.groups.splice(0, simState.groups.length, ...data.groups);
            }
            if (data.members && typeof data.members === "object") {
                Object.assign(simState.members, data.members);
            }
            if (Array.isArray(data.friends) && data.friends.length) {
                simState.friends.splice(0, simState.friends.length, ...data.friends);
            }
            // 身份做合并而不是覆盖：后端有的保留，本地多出来的（可能是
            // 其他浏览器还没同步的）也保留，任何一端都不会丢角色
            if (Array.isArray(data.users) && data.users.length) {
                const merged = [...data.users];
                for (const u of users.value) {
                    if (
                        !merged.some(
                            (m) => String(m.user_id) === String(u.user_id),
                        )
                    ) {
                        merged.push(u);
                    }
                }
                users.value = merged;
                persistUsersLocal();
            }
            // 身份选择（我是谁 / bot 是谁）：本地有值就用本地，绝不覆盖；
            // 只有本地为空（新端 / 清过存储）才采纳云端最近一次的设置
            if (data.my_user_id && !myUserId.value) {
                myUserId.value = String(data.my_user_id);
            }
            if (data.bot_id && !botId.value) {
                botId.value = String(data.bot_id);
            }
        }
        stateLoaded = true;
        // 自愈：只要本机有身份就回推后端（换浏览器、补老数据都靠这一步）
        if (users.value.length) {
            persistUsers();
        }
    } catch {
        /* 拉取失败保持空列表，后续保存会覆盖 */
    }
};

loadSimState();

const persistGroups = () => {
    if (!stateLoaded) return;
    api.post("/onebot/state", buildStatePayload()).catch(() => {
        /* 保存失败下次变更再试 */
    });
};

// ==================== 多端状态实时同步 ====================
// 后端在任何一端保存状态后都会把最新状态推给所有接入的模拟端，
// 收到后直接应用——群/成员/好友的改动在所有端即时可见

// 应用远端推送期间暂停本地变更的自动回传，
// 防止"应用 → watcher 触发 → POST → 后端广播"回环风暴
let applyingRemote = false;

const applyRemoteState = (state?: Record<string, any>) => {
    if (!state) return;
    applyingRemote = true;
    try {
        if (Array.isArray(state.groups)) {
            simState.groups.splice(0, simState.groups.length, ...state.groups);
        }
        if (state.members && typeof state.members === "object") {
            for (const key of Object.keys(simState.members)) {
                delete simState.members[Number(key)];
            }
            Object.assign(simState.members, state.members);
        }
        if (Array.isArray(state.friends)) {
            simState.friends.splice(
                0,
                simState.friends.length,
                ...state.friends,
            );
        }
        // 身份列表以云端为准（替换）：另一端删除的身份也要同步消失
        if (Array.isArray(state.users) && state.users.length) {
            users.value = state.users;
            persistUsersLocal();
        }
    } finally {
        // watcher 是异步 flush 的，等本轮响应式更新走完再恢复回传
        nextTick(() => {
            applyingRemote = false;
        });
    }
};

// 深度监听模拟世界状态：动作回调里的变更（好友申请通过、改群名、
// 退群等不经 UI 的路径）也会自动持久化
watch(
    () => [simState.groups, simState.members, simState.friends],
    () => {
        if (applyingRemote) return;
        persistGroups();
    },
    { deep: true },
);

// 当前扮演的用户 / 模拟的机器人，都从身份池里选
const myUserId = ref(loadSetting("myUserId", ""));
const botId = ref(loadSetting("botId", ""));

/** 会话 key 必须带 bot 身份：同一群下换 bot 视角不串消息 */
const conversationKeyFor = (
    type: "group" | "bot",
    id?: string | number | null,
) => {
    const bid = botId.value || "anon";
    return type === "group" ? `${bid}:group:${id ?? ""}` : `${bid}:bot`;
};

// 身份选择：打开时本地已有值就用本地，绝不被云端覆盖；本地每次改动都
// 推送云端，保证云端始终是最近一次的设置——本地为空的新端打开时拿到
// 的也是最新值，而不是停留在某次初期的旧选择
watch([myUserId, botId], () => {
    localStorage.setItem(STORAGE_PREFIX + "myUserId", myUserId.value);
    localStorage.setItem(STORAGE_PREFIX + "botId", botId.value);
    persistStateMeta();
});

// 换 bot 身份后清空当前会话，避免串到上一视角的气泡
watch(botId, () => {
    selectedContact.value = null;
    conversations.value = {};
});

// 身份选择变更时使用：全量状态 + my_user_id/bot_id
const persistStateMeta = () => {
    if (!stateLoaded) return;
    api.post("/onebot/state", {
        ...buildStatePayload(),
        my_user_id: myUserId.value,
        bot_id: botId.value,
    }).catch(() => {
        /* 保存失败下次变更再试 */
    });
};

const currentUser = computed(() =>
    users.value.find(u => String(u.user_id) === myUserId.value),
);

const currentBot = computed(
    () => users.value.find(u => String(u.user_id) === botId.value),
);

const myNickname = computed(() => currentUser.value?.nickname ?? "模拟用户");

/** 是否已创建并选择扮演身份（没有时引导用户先创建） */
const hasIdentity = computed(() => !!currentUser.value);
const botNickname = computed(
    () => currentBot.value?.nickname ?? "小真寻",
);

// 机器人头像：优先用后端回填的真实头像，否则按 QQ 号走 qlogo 头像
const botAvatarUrl = ref<string | null>(null);
const botAvatar = computed(() => botAvatarUrl.value ?? resolveAvatar(botId.value));

// 机器人身份同步到 simState.bot（get_login_info 等应答使用）
watchEffect(() => {
    simState.bot.user_id = Number(botId.value) || 10086;
    simState.bot.nickname = botNickname.value;
})

// ==================== 模拟客户端（前端驱动，后端只做请求头桥接） ====================

const connected = ref(false);
let simulator: OneBotV11Simulator | null = null;

interface LogEntry {
    id: number;
    time: string;
    title: string;
    detail?: string;
}

const logs = ref<LogEntry[]>([]);
const logSeq = ref(0);
const logContainer = ref<HTMLElement | null>(null);

/** base64 图片体不写入日志，避免刷屏 */
const LOG_MAX_LEN = 500;

const sanitizeLogText = (text: string) => {
    if (text.length > LOG_MAX_LEN || /base64/i.test(text)) {
        return text.slice(0, LOG_MAX_LEN) + "…(已截断)";
    }
    return text;
};

const pushLog = (title: string, detail?: string) => {
    logs.value.push({
        id: ++logSeq.value,
        time: new Date().toLocaleTimeString("zh-CN", { hour12: false }),
        title,
        detail: detail === undefined ? undefined : sanitizeLogText(detail),
    });
    if (logs.value.length > 200) {
        logs.value.splice(0, logs.value.length - 200);
    }
};

watch(
    () => logs.value.length,
    async () => {
        if (!settingsOpen.value) return;
        await nextTick();
        if (logContainer.value) {
            logContainer.value.scrollTop = logContainer.value.scrollHeight;
        }
    },
);

// 多端共享：同一 bot 号的连接由后端桥接统一维护，任何窗口/浏览器
// 都可以直接连接，bot 下行动作由桥接广播给每一端
const connect = async () => {
    if (!botId.value.trim()) {
        ZXNotification({
            title: "等等",
            message: "机器人的 QQ 号要填哦",
            type: "warning",
        });
        return;
    }
    simulator?.disconnect();
    simulator = new OneBotV11Simulator(
        {
            url: bridgeWsUrl(),
            selfId: botId.value,
            access_token: accessToken.value || undefined,
            heartbeatInterval: Number(heartbeatInterval.value) || 30,
            autoReconnect: autoReconnect.value,
            reconnectInterval: Number(reconnectInterval.value) || 3,
            getUserAvatar: id =>
                users.value.find(u => String(u.user_id) === id)?.avatar ||
                undefined,
        },
        {
            onStateChange: open => {
                connected.value = open;
            },
            onAction: request => {
                const detail = JSON.stringify(request.params ?? {});
                pushLog(request.action, detail === "{}" ? undefined : detail);
                // 模拟端发出的好友申请被审批通过：好友列表已更新
                if (
                    request.action === "set_friend_add_request" &&
                    request.params?.approve !== false &&
                    String(request.params?.flag ?? "").startsWith(
                        "onebot_friend_req:",
                    )
                ) {
                    ZXNotification({
                        title: "好友申请已通过",
                        message: "新的朋友已加入好友列表",
                        type: "success",
                    });
                }
            },
            onBotMessage: info => {
                const key =
                    info.messageType === "group"
                        ? conversationKeyFor("group", info.groupId)
                        : conversationKeyFor("bot");
                appendBubble(key, {
                    from: "bot",
                    parts: toBubbleParts(info.message, info.text),
                });
            },
            onLog: message => pushLog(message),
            onBotInfo: bots => {
                const info = bots.find(b => b.user_id === botId.value);
                if (info?.nickname) {
                    simState.bot.nickname = info.nickname;
                }
                if (info?.ava_url) {
                    botAvatarUrl.value = info.ava_url;
                }
            },
            onPeerMessage: event => {
                // 其他模拟端发的消息（多端统一状态）：显示为对方气泡
                const senderId = String(event?.user_id ?? "");
                if (!senderId) return;
                const key =
                    (event as any).message_type === "group"
                        ? conversationKeyFor(
                              "group",
                              (event as any).group_id,
                          )
                        : conversationKeyFor("bot");
                const sender = users.value.find(
                    u => String(u.user_id) === senderId,
                );
                appendBubble(key, {
                    from: "peer",
                    senderId,
                    senderName:
                        sender?.nickname ||
                        (event as any).sender?.nickname ||
                        senderId,
                    parts: toBubbleParts(
                        (event as any).message,
                        (event as any).raw_message ?? "",
                    ),
                });
            },
            onStateUpdate: state => applyRemoteState(state),
            onError: message => {
                if (showError.value) {
                    ZXNotification({
                        title: "连接错误",
                        message,
                        type: "error",
                    });
                }
            },
        },
    );
    simulator.connect();
};

const disconnect = () => {
    simulator?.disconnect();
    simulator = null;
    connected.value = false;
    pushLog("已断开连接");
};

onUnmounted(() => {
    simulator?.disconnect();
    simulator = null;
});

// 打开即连接：从主站弹窗打开后无需手动点连接
onMounted(() => {
    if (autoConnect.value && botId.value.trim()) {
        connect();
    }
    // 没有任何身份时自动打开身份管理，引导用户自行创建
    if (users.value.length === 0) {
        identityOpen.value = true;
    }
});

// ==================== 弹窗 ====================

const settingsOpen = ref(false);
const identityOpen = ref(false);
const settingsTab = ref<"connect" | "groups" | "friends">("connect");

// 设置分区元数据（标题+描述）
const settingsSections = [
    {
        key: "connect" as const,
        title: "连接",
        description: "配置模拟客户端的 OneBot 连接",
    },
    {
        key: "groups" as const,
        title: "群聊管理",
        description: "管理模拟群聊与群成员",
    },
    {
        key: "friends" as const,
        title: "好友管理",
        description: "管理机器人的好友与备注",
    },
];

const currentSettingsSection = computed(
    () =>
        settingsSections.find(s => s.key === settingsTab.value) ??
        settingsSections[0],
);

// ==================== 模拟联系人 ====================
// 用户视角：机器人是唯一的好友（置顶固定），群聊按需添加

type ContactType = "bot" | "group";

interface OneBotContact {
    type: ContactType;
    id: string;
    name: string;
}

const selectedContact = ref<OneBotContact | null>(null);
const contactSearch = ref("");

const contactList = computed<OneBotContact[]>(() => {
    const list: OneBotContact[] = [
        // 未设置机器人身份时不显示私聊联系人
        ...(botId.value
            ? [
                  {
                      type: "bot" as const,
                      id: botId.value,
                      name: botNickname.value,
                  },
              ]
            : []),
        ...simState.groups.map(g => ({
            type: "group" as const,
            id: String(g.group_id),
            name: g.group_name,
        })),
    ];
    const keyword = contactSearch.value.trim();
    if (!keyword) return list;
    return list.filter(
        c => c.id.includes(keyword) || c.name.includes(keyword),
    );
});

// ==================== 创建群聊弹窗 ====================

const createGroupOpen = ref(false);
const newGroupId = ref("");
const newGroupName = ref("");
const creatorJoin = ref(true);
const botJoinGroup = ref(true);

const createGroup = () => {
    if (!newGroupId.value.trim()) return;
    const groupId = Number(newGroupId.value);
    if (simState.groups.some(g => g.group_id === groupId)) {
        ZXNotification({
            title: "已存在",
            message: `群 ${groupId} 已经有了哦`,
            type: "warning",
        });
        return;
    }
    const members: SimMember[] = [];
    if (creatorJoin.value && currentUser.value) {
        members.push({
            user_id: currentUser.value.user_id,
            nickname: currentUser.value.nickname,
            card: "",
            role: "owner",
        });
    }
    if (botJoinGroup.value) {
        members.push({
            user_id: simState.bot.user_id,
            nickname: simState.bot.nickname,
            card: "",
            role: "member",
        });
    }
    simState.groups.push({
        group_id: groupId,
        group_name: newGroupName.value.trim() || `群${groupId}`,
        member_count: members.length,
        max_member_count: 200,
    });
    simState.members[groupId] = members;
    persistGroups();
    newGroupId.value = "";
    newGroupName.value = "";
    createGroupOpen.value = false;
};

// ==================== 群聊管理（设置里的 tab） ====================

const managedGroupId = ref<string | null>(null);

const managedGroup = computed(() =>
    simState.groups.find(g => String(g.group_id) === managedGroupId.value),
);

const managedMembers = computed<SimMember[]>(() =>
    managedGroupId.value
        ? (simState.members[Number(managedGroupId.value)] ?? [])
        : [],
);

const addMemberUserId = ref("");
const addMemberRole = ref<"owner" | "admin" | "member">("member");

const roleLabel: Record<SimMember["role"], string> = {
    owner: "群主",
    admin: "管理员",
    member: "成员",
};

const addMemberToGroup = () => {
    const group = managedGroup.value;
    const user = users.value.find(
        u => String(u.user_id) === addMemberUserId.value,
    );
    if (!group || !user) return;
    const members = (simState.members[group.group_id] ??= []);
    if (members.some(m => m.user_id === user.user_id)) {
        ZXNotification({
            title: "已在群里",
            message: `${user.nickname} 已经是这个群的成员了`,
            type: "warning",
        });
        return;
    }
    members.push({
        user_id: user.user_id,
        nickname: user.nickname,
        card: "",
        role: addMemberRole.value,
    });
    group.member_count = members.length;
    persistGroups();
    addMemberUserId.value = "";
};

const removeMemberFromGroup = (member: SimMember) => {
    const group = managedGroup.value;
    if (!group) return;
    const members = simState.members[group.group_id] ?? [];
    const idx = members.findIndex(m => m.user_id === member.user_id);
    if (idx !== -1) members.splice(idx, 1);
    group.member_count = members.length;
    persistGroups();
};

const dissolveGroup = () => {
    const group = managedGroup.value;
    if (!group) return;
    const idx = simState.groups.indexOf(group);
    simState.groups.splice(idx, 1);
    delete simState.members[group.group_id];
    persistGroups();
    clearCachedBubbles(conversationKeyFor("group", group.group_id));
    delete conversations.value[conversationKeyFor("group", group.group_id)];
    managedGroupId.value = null;
    if (selectedContact.value?.id === String(group.group_id)) {
        selectedContact.value = null;
    }
};

const removeContact = (contact: OneBotContact) => {
    if (contact.type === "bot") return;
    const idx = simState.groups.findIndex(
        g => String(g.group_id) === contact.id,
    );
    if (idx !== -1) {
        simState.groups.splice(idx, 1);
        delete simState.members[Number(contact.id)];
        persistGroups();
    }
    clearCachedBubbles(conversationKeyFor("group", contact.id));
    delete conversations.value[conversationKeyFor("group", contact.id)];
    if (selectedContact.value?.id === contact.id) {
        selectedContact.value = null;
    }
};

// 联系人右键菜单：机器人 → 添加/删除好友；群聊 → 删除联系人。
// 与聊天头部的好友图标共享同一套状态和处理函数
const openContactMenu = (e: MouseEvent, contact: OneBotContact) => {
    const items: {
        label: string;
        icon: typeof Bot;
        danger?: boolean;
        action: () => void;
    }[] = [];
    if (contact.type === "bot") {
        if (!isBotFriend.value) {
            items.push({
                label: "添加好友",
                icon: UserRoundPlus,
                action: sendFriendRequest,
            });
        } else {
            items.push({
                label: "删除好友",
                icon: UserRoundX,
                danger: true,
                action: deleteBotFriend,
            });
        }
    } else {
        items.push({
            label: "删除群聊",
            icon: Trash2,
            danger: true,
            action: () => removeContact(contact),
        });
    }
    openContextMenu(e, items);
};

const selectContact = (contact: OneBotContact) => {
    selectedContact.value = contact;
    const key =
        contact.type === "bot" ? "bot" : `group:${contact.id}`;
    restoreConversation(key);
    scrollToBottom();
};

// ==================== 会话 ====================

interface Bubble {
    id: number;
    from: "user" | "bot" | "peer";
    /** peer 消息（其他模拟端发的）的发送者身份，用于头像和昵称 */
    senderId?: string;
    senderName?: string;
    /** 气泡内容段（消息段或占位），渲染按 kind 区分 */
    parts: BubblePart[];
    time: string;
    /** 毫秒时间戳，用于消息间隔分组 */
    ts: number;
}

interface BubblePart {
    kind:
        | "text"
        | "image"
        | "at"
        | "face"
        | "voice"
        | "video"
        | "dice"
        | "rps"
        | "poke"
        | "shake"
        | "location"
        | "share"
        | "music"
        | "json"
        | "xml"
        | "reply"
        | "forward"
        | "node"
        | "contact"
        | "tts"
        | "markdown"
        | "other";
    text?: string;
    /** 图片/语音/视频地址 */
    src?: string;
    /** 分享/音乐等卡片的外链 */
    url?: string;
    /** 卡片标题 */
    title?: string;
    /** 卡片副标题 */
    subtitle?: string;
    /** 图片加载失败标记 */
    broken?: boolean;
}

/** 尽量把 JSON 字符串格式化，失败则原样返回并截断 */
const prettyStructured = (raw: string, max = 2000) => {
    let text = raw;
    try {
        text = JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
        /* 不是 JSON 就原样展示 */
    }
    return text.length > max ? text.slice(0, max) + "…" : text;
};

/** 把消息段数组拆成气泡渲染段（覆盖 OneBot v11 标准段类型） */
const toBubbleParts = (
    message: import('@/utils/onebot/types').MessageContent,
    fallbackText: string,
): BubblePart[] => {
    if (typeof message === "string" || !Array.isArray(message)) {
        return [{ kind: "text", text: fallbackText || String(message ?? "") || "(空消息)" }];
    }
    const parts: BubblePart[] = [];
    for (const seg of message) {
        const data = seg.data ?? {};
        switch (seg.type) {
            case "text":
                parts.push({ kind: "text", text: String(data.text ?? "") });
                break;
            case "tts":
                parts.push({ kind: "tts", text: String(data.text ?? "") });
                break;
            case "markdown":
                parts.push({
                    kind: "markdown",
                    text:
                        typeof data.data === "string"
                            ? data.data
                            : String(data.data ?? ""),
                });
                break;
            case "at":
                parts.push({
                    kind: "at",
                    text: data.qq === "all" ? "@全体成员" : `@${data.qq}`,
                });
                break;
            case "image": {
                const src = String(data.url || data.file || "");
                if (src) parts.push({ kind: "image", src });
                else parts.push({ kind: "other", text: "[图片]" });
                break;
            }
            case "record":
                parts.push({
                    kind: "voice",
                    src: String(data.url || data.file || "") || undefined,
                });
                break;
            case "video":
                parts.push({
                    kind: "video",
                    src: String(data.url || data.file || "") || undefined,
                });
                break;
            case "face":
                parts.push({ kind: "face", text: `表情 ${data.id ?? ""}`.trim() });
                break;
            case "dice":
                parts.push({ kind: "dice", text: data.magic ? `骰子 ${data.magic}` : "骰子" });
                break;
            case "rps":
                parts.push({ kind: "rps", text: data.magic ? `猜拳 ${data.magic}` : "猜拳" });
                break;
            case "poke":
                parts.push({ kind: "poke", text: "戳一戳" });
                break;
            case "shake":
                parts.push({ kind: "shake", text: "窗口抖动" });
                break;
            case "location":
                parts.push({
                    kind: "location",
                    title: String(data.title || "位置"),
                    subtitle: String(data.content || `${data.lat ?? ""},${data.lon ?? ""}`),
                });
                break;
            case "share":
                parts.push({
                    kind: "share",
                    title: String(data.title || "链接分享"),
                    subtitle: String(data.content || ""),
                    url: String(data.url || ""),
                });
                break;
            case "music":
                parts.push({
                    kind: "music",
                    title: String(data.title || data.id || "音乐分享"),
                    subtitle: String(data.content || data.type || ""),
                    url: String(data.url || ""),
                });
                break;
            case "contact":
                parts.push({
                    kind: "contact",
                    title: data.type === "group" ? "推荐群" : "推荐好友",
                    subtitle: String(data.id ?? ""),
                });
                break;
            case "json":
                parts.push({ kind: "json", text: prettyStructured(String(data.data ?? "")) });
                break;
            case "xml":
                parts.push({ kind: "xml", text: prettyStructured(String(data.data ?? "")) });
                break;
            case "reply":
                parts.push({ kind: "reply", text: `回复消息 ${data.id ?? ""}`.trim() });
                break;
            case "forward":
                parts.push({ kind: "forward", text: "合并转发消息" });
                break;
            case "node":
                parts.push({
                    kind: "node",
                    title: String(data.nickname || "转发节点"),
                    subtitle: String(
                        typeof data.content === "string" ? data.content : "",
                    ),
                });
                break;
            default:
                parts.push({
                    kind: "other",
                    text: `[${seg.type}]`,
                });
        }
    }
    return parts.length ? parts : [{ kind: "text", text: fallbackText || "(空消息)" }];
};

/**
 * 图片段地址解析：
 * - base64:// 或无 scheme 的 base64 负载 -> data: URL 直接渲染
 * - 其余（http/https）原样使用
 */
const resolveImageSrc = (src: string) => {
    if (src.startsWith("base64://")) {
        return `data:image/png;base64,${src.slice(9)}`;
    }
    if (looksLikeBase64(src)) {
        return `data:image/png;base64,${src}`;
    }
    return src;
};

const resolveAudioSrc = (src: string) => {
    if (!src) return "";
    if (src.startsWith("base64://voice/")) {
        return `data:audio/webm;base64,${src.slice("base64://voice/".length)}`;
    }
    if (src.startsWith("base64://")) {
        return `data:audio/webm;base64,${src.slice(9)}`;
    }
    return src;
};

const scrollToBottom = () => {
    setTimeout(() => {
        messagesContainer.value?.scrollTo({
            top: messagesContainer.value.scrollHeight,
        });
    }, 0);
};

/** 纯图片消息：不带气泡渲染，样式与联系人页一致 */
const isImageOnly = (parts: BubblePart[]) =>
    parts.length === 1 && parts[0].kind === "image";

const conversations = ref<Record<string, Bubble[]>>({});
let bubbleSeq = 0;

const conversationKey = computed(() => {
    const contact = selectedContact.value;
    if (!contact) return "";
    return contact.type === "bot"
        ? conversationKeyFor("bot")
        : conversationKeyFor("group", contact.id);
});

const currentMessages = computed(
    () => conversations.value[conversationKey.value] ?? [],
);

// ==================== Telegram 式消息窗口 ====================
// 只渲染底部窗口内的气泡，往上翻按需扩窗并锚定滚动位置
const RENDER_STEP = 100;
const renderCount = ref(120);

const windowedMessages = computed(() =>
    currentMessages.value.slice(
        Math.max(0, currentMessages.value.length - renderCount.value),
    ),
);

const hiddenMessageCount = computed(
    () => currentMessages.value.length - windowedMessages.value.length,
);

const isNearChatBottom = () => {
    const el = messagesContainer.value;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 150;
};

const loadOlderBubbles = async () => {
    const el = messagesContainer.value;
    const prevHeight = el?.scrollHeight ?? 0;
    const prevTop = el?.scrollTop ?? 0;
    renderCount.value += RENDER_STEP;
    await nextTick();
    // 锚定：扩窗后保持视口内的内容不动
    if (el) el.scrollTop = prevTop + (el.scrollHeight - prevHeight);
};

const showChatScrollBottom = ref(false);

const onChatScroll = () => {
    showChatScrollBottom.value = !isNearChatBottom();
};

// 消息间隔超过 5 分钟时插入时间分隔线
type DisplayItem =
    | { kind: "sep"; key: string; label: string }
    | { kind: "msg"; key: string; message: Bubble };

const SEPARATOR_GAP = 5 * 60 * 1000;

const displayMessages = computed<DisplayItem[]>(() => {
    const result: DisplayItem[] = [];
    let prevTs: number | null = null;
    for (const message of windowedMessages.value) {
        if (prevTs === null || message.ts - prevTs > SEPARATOR_GAP) {
            result.push({
                kind: "sep",
                key: `sep-${message.id}`,
                label: formatSeparatorLabel(message.ts),
            });
        }
        result.push({ kind: "msg", key: `msg-${message.id}`, message });
        prevTs = message.ts;
    }
    return result;
});

const formatSeparatorLabel = (ts: number) => {
    const date = new Date(ts);
    const now = new Date();
    const hm = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
    const sameDay = date.toDateString() === now.toDateString();
    const yesterday = new Date(now.getTime() - 86400000);
    if (sameDay) return hm;
    if (date.toDateString() === yesterday.toDateString()) {
        return `昨天 ${hm}`;
    }
    return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${hm}`;
};

const appendBubble = (key: string, bubble: Omit<Bubble, "id" | "time" | "ts">) => {
    if (!conversations.value[key]) {
        conversations.value[key] = [];
    }
    const full: Bubble = {
        ...bubble,
        id: ++bubbleSeq,
        time: new Date().toLocaleTimeString("zh-CN", { hour12: false }),
        ts: Date.now(),
    };
    conversations.value[key].push(full);
    // base64 图片源存进 IndexedDB（bot 回复图片通常为几十~几百 KB 的 data URL），
    // 超过 20MB 的极端图片才降级为占位文本
    cacheBubble({
        conversationKey: key,
        from: full.from,
        senderId: full.senderId,
        senderName: full.senderName,
        parts: full.parts.map((p) =>
            p.kind === "image" && (p.src ?? "").length > 20_000_000
                ? { kind: "other", text: "[图片]" }
                : p,
        ),
        time: full.time,
        ts: full.ts,
    });
    const list = conversations.value[key];
    if (list.length > 100) list.splice(0, list.length - 100);
    if (key === conversationKey.value && isNearChatBottom()) {
        scrollToBottom();
    }
};

// 从 IndexedDB 恢复某个会话的历史气泡，并合并后端桥接层落库的记录
// （跨设备/跨浏览器可见）。两路来源按时间排序，同一发送者 + 相同首段
// 内容 + 3 秒内视为同一条去重
const restoreConversation = async (key: string) => {
    if (!key || conversations.value[key]?.length) return;
    const cached = await getCachedBubbles(key);
    if (!cached.length) return;
    // 防止恢复期间有新消息进来导致顺序错乱
    const existing = conversations.value[key] ?? [];
    const restored: Bubble[] = cached.map(c => ({
        id: ++bubbleSeq,
        from: c.from,
        senderId: c.senderId,
        senderName: c.senderName,
        parts: c.parts as Bubble["parts"],
        time: c.time,
        ts: c.ts,
    }));
    conversations.value[key] = [...restored, ...existing].sort(
        (a, b) => a.ts - b.ts,
    );
    if (key === conversationKey.value) {
        scrollToBottom();
    }

    // 后端历史：拉回来与本地合并
    if (!botId.value) return;
    try {
        const res = await api.get<
            {
                id: number;
                sender: string;
                sender_id: string;
                sender_name: string;
                message: { type: string; msg: string }[];
                time: string;
                ts: number;
            }[]
        >("/onebot/chat-history", {
            self_id: botId.value,
            conversation: key,
            limit: 200,
        });
        const remoteRows = res?.data;
        if (!Array.isArray(remoteRows) || !remoteRows.length) return;
        const remote: Bubble[] = remoteRows.map(r => ({
            id: ++bubbleSeq,
            from:
                r.sender === "bot"
                    ? "bot"
                    : String(r.sender_id) === String(myUserId.value)
                      ? "user"
                      : "peer",
            senderId: r.sender_id || undefined,
            senderName: r.sender_name || undefined,
            parts: (r.message || []).map(m =>
                m.type === "img"
                    ? { kind: "image", src: resolveImageSrc(m.msg) }
                    : {
                          kind: m.type === "text" ? "text" : "other",
                          text: m.msg,
                      },
            ) as BubblePart[],
            time: r.time || "",
            ts: Number(r.ts) || 0,
        }));
        const list = [...(conversations.value[key] ?? []), ...remote].sort(
            (a, b) => a.ts - b.ts,
        );
        const deduped: Bubble[] = [];
        for (const b of list) {
            const prev = deduped[deduped.length - 1];
            const sameText =
                (prev?.parts[0]?.text ?? "") === (b.parts[0]?.text ?? "") &&
                (prev?.parts[0]?.src ?? "") === (b.parts[0]?.src ?? "");
            if (
                prev &&
                prev.from === b.from &&
                prev.senderId === b.senderId &&
                sameText &&
                Math.abs(prev.ts - b.ts) < 3000
            ) {
                continue;
            }
            deduped.push(b);
        }
        conversations.value[key] = deduped;
        if (key === conversationKey.value && isNearChatBottom()) {
            scrollToBottom();
        }
    } catch {
        // 后端不可达时仅用本地缓存
    }
};

// ==================== 头像（真实 QQ 头像，失败回退默认） ====================

const userAvatarUrl = (id: string | number) =>
    `https://q1.qlogo.cn/g?b=qq&nk=${id}&s=160`;

// 自定义头像优先（空串视为未设置），否则按 QQ 号取真实头像
const resolveAvatar = (id: string | number) =>
    users.value.find(u => String(u.user_id) === String(id))?.avatar ||
    userAvatarUrl(id);

const groupAvatarUrl = (id: string | number) =>
    `https://p.qlogo.cn/gh/${id}/${id}/100/`;

const onAvatarError = (e: Event) => {
    (e.target as HTMLImageElement).src = defaultAva;
};

// ==================== 发送 ====================

const messagesContainer = ref<HTMLElement | null>(null);

// 图片消息（输入 URL 发送 image 消息段）
const imageOpen = ref(false);
const imageUrl = ref("");

// ==================== ChatComposer 数据源与发送 ====================
const currentGroupId = computed(() => {
    const c = selectedContact.value;
    return c?.type === "group" ? Number(c.id) : NaN;
});

const composerMembers = computed(() => {
    const gid = currentGroupId.value;
    if (Number.isNaN(gid)) return [];
    return (simState.members[gid] ?? []).map((m) => ({
        user_id: String(m.user_id),
        nickname: m.nickname,
        remark: m.card,
    }));
});

const parseMessage = (raw: string): MessageSegment[] => {
    const trimmed = raw.trim();

    // JSON 段数组：[{"type":"text","data":{"text":"..."}}]
    if (trimmed.startsWith("[")) {
        try {
            const parsed = JSON.parse(trimmed);
            if (
                Array.isArray(parsed) &&
                parsed.every(
                    (item) =>
                        item && typeof item.type === "string" && "data" in (item ?? {}),
                )
            ) {
                return parsed as MessageSegment[];
            }
        } catch {
            /* 不是 JSON，继续往下 */
        }
    }

    // CQ 码：[CQ:image,file=https://...][CQ:at,qq=12345]
    if (trimmed.includes("[CQ:")) {
        return cqToSegments(trimmed);
    }

    const segments: MessageSegment[] = [];
    const pattern = /@(\d+|all)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(raw)) !== null) {
        if (match.index > lastIndex) {
            segments.push({
                type: "text",
                data: { text: raw.slice(lastIndex, match.index) },
            });
        }
        segments.push({ type: "at", data: { qq: match[1] } });
        lastIndex = match.index + match[0].length;
    }
    if (lastIndex < raw.length) {
        segments.push({
            type: "text",
            data: { text: raw.slice(lastIndex) },
        });
    }
    return segments;
};

/** 发送消息段到当前会话，displayText 用于气泡展示 */
const sendSegments = (messageSegments: import('@/utils/onebot/types').MessageContent, displayText: string) => {
    if (!selectedContact.value) {
        ZXNotification({
            title: "呜呼～",
            message: "请先选择一个聊天对象哦 (っ °Д °;) っ",
            type: "warning",
        });
        return false;
    }

    if (!connected.value) {
        ZXNotification({
            title: "还没连上",
            message: "先点右上角连接真寻 (｡•ˇ‸ˇ•｡)",
            type: "warning",
        });
        return false;
    }

    const contact = selectedContact.value;
    const sim = simulator;
    if (!sim) return false;

    // 机器人私聊：以"我的身份"给机器人发私聊；群聊：以"我的身份"在群里发言
    const sent =
        contact.type === "group"
            ? sim.sendEvent(
                  buildGroupMessageEvent({
                      selfId: botId.value,
                      groupId: contact.id,
                      userId: myUserId.value,
                      nickname: myNickname.value,
                      message: messageSegments,
                  }),
              )
            : sim.sendEvent(
                  buildPrivateMessageEvent({
                      selfId: botId.value,
                      userId: myUserId.value,
                      nickname: myNickname.value,
                      message: messageSegments,
                  }),
              );

    if (!sent) {
        ZXNotification({
            title: "发送失败",
            message: "连接已经断开了",
            type: "error",
            sticker: "33",
        });
        return false;
    }

    appendBubble(conversationKey.value, {
        from: "user",
        parts: toBubbleParts(messageSegments, displayText),
    });
    scrollToBottom();
    return true;
};

// 移动端软键盘/触摸可能把同一次发送重复触发（连着两条一样的消息），
// 600ms 内的重入直接忽略；正常手动连发的间隔远大于这个值
let lastSendAt = 0;

const onComposerSend = (parts: import("@/views/chat/ChatComposer.vue").OutgoingPart[]) => {
    if (!hasIdentity.value) {
        ZXNotification({
            title: "等等",
            message: "还没有身份哦，先在左下角创建一个",
            type: "warning",
        });
        identityOpen.value = true;
        return;
    }
    const segments: import("@/utils/onebot/types").MessageSegment[] = [];
    const texts: string[] = [];
    for (const part of parts) {
        if (part.type === "text") {
            if (part.content.trim()) texts.push(part.content);
            continue;
        }
        if (part.type === "record") {
            segments.push({ type: "record", data: { file: part.content } });
            continue;
        }
        if (part.type === "image") {
            segments.push({ type: "image", data: { file: part.content } });
            continue;
        }
        if (part.type === "at") {
            segments.push({ type: "at", data: { qq: part.content } });
            continue;
        }
        if (part.type === "face") {
            segments.push({ type: "face", data: { id: part.content } });
        }
    }
    const text = texts.join("").trim();
    if (text) segments.push(...parseMessage(text));
    if (!segments.length) return;
    sendSegments(segments, text || "[附件]");
};

const sendImage = () => {
    const url = imageUrl.value.trim();
    if (!url) return;
    if (sendSegments([{ type: "image", data: { file: url } }], `[图片] ${url}`)) {
        imageUrl.value = "";
        imageOpen.value = false;
    }
};

// ==================== 添加机器人为好友 ====================
// 以当前身份向真寻发送好友申请事件（request.friend），
// 真寻同意后协议端会收到 set_friend_add_request 动作，模拟器据此更新好友列表

// 当前身份是否已是机器人的好友（好友关系对称：机器人好友列表里有我）
const isBotFriend = computed(() =>
    simState.friends.some(f => f.user_id === Number(myUserId.value)),
);

const sendFriendRequest = () => {
    const user = currentUser.value;
    if (!user) return;
    if (!simulator?.connected) {
        ZXNotification({
            title: "还没连上",
            message: "先连接真寻再发送好友申请哦 (｡•ˇ‸ˇ•｡)",
            type: "warning",
        });
        return;
    }
    const flag = `onebot_friend_req:${user.user_id}|${user.nickname}`;
    const sent = simulator.sendEvent(
        buildFriendRequestEvent({
            selfId: botId.value,
            userId: String(user.user_id),
            nickname: user.nickname,
            comment: `我是 ${user.nickname}，请求添加好友`,
            flag,
        }),
    );
    if (sent) {
        pushLog("已发送好友申请");
        ZXNotification({
            title: "申请已发送",
            message: "等真寻在请求处理里同意吧",
            type: "success",
        });
    } else {
        ZXNotification({
            title: "发送失败",
            message: "连接已经断开了",
            type: "error",
            sticker: "33",
        });
    }
};

// 删除好友：把当前身份从机器人好友列表移除，
// get_friend_list 应答即时生效，联系人页拉取即见
const deleteBotFriend = () => {
    simState.friends = simState.friends.filter(
        f => f.user_id !== Number(myUserId.value),
    );
    pushLog("已删除与机器人的好友关系");
    ZXNotification({
        title: "已删除好友",
        message: "机器人的好友列表已更新",
        type: "success",
    });
};

// 当前身份是否在所选群聊的成员列表里
const isGroupMember = computed(() => {
    const contact = selectedContact.value;
    if (!contact || contact.type !== "group") return false;
    const members = simState.members[Number(contact.id)] ?? [];
    return members.some(m => m.user_id === Number(myUserId.value));
});

// 加入群聊：把自己加进群成员，并推送 group_increase 让真寻更新群成员缓存
const joinGroup = () => {
    const contact = selectedContact.value;
    if (!contact || contact.type !== "group") return;
    const groupId = Number(contact.id);
    const members = simState.members[groupId] ?? [];
    if (members.some(m => m.user_id === Number(myUserId.value))) return;
    members.push({
        user_id: Number(myUserId.value),
        nickname: myNickname.value,
        card: "",
        role: "member",
    });
    simState.members[groupId] = members;
    const group = simState.groups.find(g => g.group_id === groupId);
    if (group) group.member_count = members.length;
    persistGroups();
    const sent = simulator?.connected
        ? simulator.sendEvent(
              buildGroupIncreaseEvent({
                  selfId: botId.value,
                  groupId: contact.id,
                  userId: String(myUserId.value),
              }),
          )
        : false;
    pushLog(sent ? "已加入群聊并推送 group_increase" : "已加入群聊（未连接，仅本地加入）");
    ZXNotification({
        title: "已加入群聊",
        message: sent ? "真寻会收到群成员增加通知" : "未连接，仅更新了本地群成员",
        type: sent ? "success" : "warning",
    });
};

// 退出群聊：把自己移出群成员，并按 OneBot 标准推送
// group_decrease(leave)，真寻会更新群成员缓存
const leaveGroup = () => {
    const contact = selectedContact.value;
    if (!contact || contact.type !== "group") return;
    const groupId = Number(contact.id);
    const members = simState.members[groupId] ?? [];
    const idx = members.findIndex(m => m.user_id === Number(myUserId.value));
    if (idx !== -1) {
        members.splice(idx, 1);
        const group = simState.groups.find(g => g.group_id === groupId);
        if (group) group.member_count = members.length;
        persistGroups();
    }
    const sent = simulator?.connected
        ? simulator.sendEvent(
              buildGroupDecreaseEvent({
                  selfId: botId.value,
                  groupId: contact.id,
                  userId: String(myUserId.value),
                  subType: "leave",
              }),
          )
        : false;
    pushLog(sent ? "已退群并推送 group_decrease" : "已退群（未连接，仅本地移除）");
    ZXNotification({
        title: "已退出群聊",
        message: sent ? "真寻会收到群成员减少通知" : "未连接，仅更新了本地群成员",
        type: sent ? "success" : "warning",
    });
};

// ==================== 好友管理（设置里的 tab） ====================
// 直接操作 simState.friends：改备注 / 删除会即时反映到
// get_friend_list 应答，WebUI 联系人页拉取即可见

// 直接添加好友
const newFriendId = ref("");
const newFriendName = ref("");
const newFriendRemark = ref("");

const addFriend = () => {
    const id = Number(newFriendId.value);
    if (!id) {
        ZXNotification({
            title: "等等",
            message: "QQ 号得是数字哦",
            type: "warning",
        });
        return;
    }
    if (simState.friends.some(f => f.user_id === id)) {
        ZXNotification({
            title: "已存在",
            message: `好友 ${id} 已经有了哦`,
            type: "warning",
        });
        return;
    }
    simState.friends.push({
        user_id: id,
        nickname: newFriendName.value.trim() || `用户${id}`,
        remark: newFriendRemark.value.trim(),
    });
    newFriendId.value = "";
    newFriendName.value = "";
    newFriendRemark.value = "";
};

// 行内编辑备注
const managedFriendId = ref<string | null>(null);
const friendRemarkDraft = ref("");

const startEditFriendRemark = (friend: SimFriend) => {
    managedFriendId.value = String(friend.user_id);
    friendRemarkDraft.value = friend.remark || "";
};

const saveFriendRemark = () => {
    const friend = simState.friends.find(
        f => String(f.user_id) === managedFriendId.value,
    );
    if (friend) {
        friend.remark = friendRemarkDraft.value.trim();
    }
    managedFriendId.value = null;
};

const removeFriendDirect = (friend: SimFriend) => {
    simState.friends = simState.friends.filter(
        f => f.user_id !== friend.user_id,
    );
};

const contactSubtitle = computed(() => {
    const contact = selectedContact.value;
    if (!contact) return "";
    return contact.type === "bot"
        ? `私聊 · 以 ${myNickname.value}(${myUserId.value}) 身份`
        : `群 ${contact.id} · 以 ${myNickname.value}(${myUserId.value}) 身份发言`;
});

// ==================== 身份管理弹窗逻辑 ====================

const roleFilter = ref("");

const filteredUsers = computed(() => {
    const keyword = roleFilter.value.trim();
    if (!keyword) return users.value;
    return users.value.filter(
        u =>
            String(u.user_id).includes(keyword) ||
            u.nickname.includes(keyword),
    );
});

const swapUserBot = () => {
    const temp = myUserId.value;
    myUserId.value = botId.value;
    botId.value = temp;
};

const assignUser = (type: "user" | "bot", userId: string) => {
    if (type === "user") {
        if (userId === botId.value) {
            swapUserBot();
            return;
        }
        myUserId.value = userId;
    } else {
        if (userId === myUserId.value) {
            swapUserBot();
            return;
        }
        botId.value = userId;
    }
};

// 新建 / 编辑身份弹窗
const formOpen = ref(false);
const formMode = ref<"create" | "edit">("create");
const editingUserId = ref<string | null>(null);
const formAvatar = ref("");
const formUserId = ref("");
const formNickname = ref("");
const avatarInputRef = ref<HTMLInputElement | null>(null);

// 头像预览防抖：账号输入停顿 500ms 才请求 QQ 头像，避免每个按键都发一次请求
const debouncedAvatarUserId = ref("");
let avatarDebounceTimer: number | undefined;

watch(
    () => formUserId.value,
    id => {
        window.clearTimeout(avatarDebounceTimer);
        if (!id) {
            debouncedAvatarUserId.value = "";
            return;
        }
        avatarDebounceTimer = window.setTimeout(() => {
            debouncedAvatarUserId.value = id;
        }, 500);
    },
    { immediate: true },
);

const formAvatarPreview = computed(
    () =>
        formAvatar.value ||
        (debouncedAvatarUserId.value
            ? userAvatarUrl(debouncedAvatarUserId.value)
            : defaultAva),
);

const openCreateUser = () => {
    formMode.value = "create";
    editingUserId.value = null;
    formAvatar.value = "";
    formUserId.value = "";
    formNickname.value = "";
    formOpen.value = true;
};

const openEditUser = (user: SimUser) => {
    formMode.value = "edit";
    editingUserId.value = String(user.user_id);
    formAvatar.value = user.avatar ?? "";
    formUserId.value = String(user.user_id);
    // 编辑预填立即显示头像，不走防抖
    debouncedAvatarUserId.value = String(user.user_id);
    formNickname.value = user.nickname;
    formOpen.value = true;
};

const pickAvatar = () => avatarInputRef.value?.click();

// 读取图片并居中裁剪压缩成 128×128 的 dataURL，避免撑爆 localStorage
const readImageAsAvatar = (file: File) =>
    new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                canvas.width = canvas.height = 128;
                const ctx = canvas.getContext("2d");
                if (!ctx) {
                    reject(new Error("canvas 不可用"));
                    return;
                }
                const size = Math.min(img.width, img.height);
                ctx.drawImage(
                    img,
                    (img.width - size) / 2,
                    (img.height - size) / 2,
                    size,
                    size,
                    0,
                    0,
                    128,
                    128,
                );
                resolve(canvas.toDataURL("image/jpeg", 0.85));
            };
            img.onerror = () => reject(new Error("图片解析失败"));
            img.src = String(reader.result);
        };
        reader.onerror = () => reject(new Error("文件读取失败"));
        reader.readAsDataURL(file);
    });

const onAvatarPicked = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    try {
        formAvatar.value = await readImageAsAvatar(file);
    } catch {
        ZXNotification({
            title: "失败了",
            message: "图片读取失败，换一张试试",
            type: "warning",
        });
    }
};

const saveUserForm = () => {
    const id = Number(formUserId.value.trim());
    if (!id) {
        ZXNotification({
            title: "等等",
            message: "QQ 号得是数字哦",
            type: "warning",
        });
        return;
    }
    const nickname = formNickname.value.trim() || `用户${id}`;
    const avatar = formAvatar.value;

    if (
        users.value.some(
            u => u.user_id === id && String(u.user_id) !== editingUserId.value,
        )
    ) {
        ZXNotification({
            title: "已存在",
            message: `身份 ${id} 已经有了哦`,
            type: "warning",
        });
        return;
    }

    if (formMode.value === "create") {
        users.value.push(
            avatar
                ? { user_id: id, nickname, avatar }
                : { user_id: id, nickname },
        );
    } else {
        const target = users.value.find(
            u => String(u.user_id) === editingUserId.value,
        );
        if (!target) {
            formOpen.value = false;
            return;
        }
        const oldUserId = String(target.user_id);
        target.user_id = id;
        target.nickname = nickname;
        if (avatar) target.avatar = avatar;
        else delete target.avatar;
        // 同步角色指向
        if (myUserId.value === oldUserId) myUserId.value = String(id);
        if (botId.value === oldUserId) botId.value = String(id);
    }
    persistUsers();
    formOpen.value = false;
};

const removeRole = (user: SimUser) => {
    const id = String(user.user_id);
    if (id === myUserId.value || id === botId.value) {
        ZXNotification({
            title: "等等",
            message: "不能删除当前使用的用户或机器人身份",
            type: "warning",
        });
        return;
    }
    const idx = users.value.findIndex(u => String(u.user_id) === id);
    if (idx !== -1) users.value.splice(idx, 1);
    persistUsers();
};
</script>

<template>
    <!-- 整页接管右键：选中文本时提供复制，其余情况不弹原生菜单 -->
    <div
        class="flex h-full w-full flex-col space-y-3 p-3 sm:flex-row sm:space-x-3 sm:space-y-0 sm:p-4 lg:space-x-4"
        @contextmenu="openContextMenu"
    >
        <!-- 联系人 + 左下角身份/设置 -->
        <div
            :class="[
                'min-h-0 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white px-2 pt-4 shadow-sm',
                selectedContact ? 'hidden sm:flex' : 'flex',
                'w-full flex-shrink-0 sm:w-64 lg:w-72',
            ]"
        >
            <!-- 搜索 + 添加群聊 -->
            <div class="mb-2 flex gap-2 px-2">
                <div class="flex min-w-0 flex-1 items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3.5 transition-all focus-within:border-zx-primary focus-within:bg-white h-9.5">
                    <Search class="h-4 w-4 shrink-0 text-zx-text-subtle" />
                    <input
                        v-model="contactSearch"
                        placeholder="搜索"
                        class="min-w-0 flex-1 bg-transparent text-sm text-zx-text placeholder:text-zx-text-subtle focus:outline-none"
                    />
                    <button
                        v-if="contactSearch"
                        class="cursor-pointer text-zx-text-subtle transition-colors hover:text-zx-text-muted"
                        title="清空"
                        type="button"
                        @click="contactSearch = ''"
                    >
                        <X class="h-3.5 w-3.5" />
                    </button>
                </div>
                <button
                    class="flex h-9.5 w-9.5 shrink-0 cursor-pointer items-center justify-center rounded-full border border-slate-200 text-zx-text-subtle transition-colors hover:border-zx-primary hover:text-zx-primary"
                    title="创建群聊"
                    type="button"
                    @click="createGroupOpen = true"
                >
                    <Plus class="h-4 w-4" />
                </button>
            </div>

            <!-- 列表 -->
            <div class="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-2">
                <div
                    v-if="contactList.length === 0"
                    class="py-8 text-center text-xs text-zx-text-subtle"
                >
                    没有匹配的联系人
                </div>
                <button
                    v-for="contact in contactList"
                    :key="contact.type + contact.id"
                    :class="
                        selectedContact?.type === contact.type &&
                        selectedContact?.id === contact.id
                            ? 'bg-zx-primary-soft'
                            : 'hover:bg-slate-100'
                    "
                    class="group flex w-full cursor-pointer items-center gap-2.5 rounded-2xl p-2 text-left transition-colors"
                    type="button"
                    @click="selectContact(contact)"
                    @contextmenu="openContactMenu($event, contact)"
                >
                    <div
                        :class="
                            contact.type === 'bot'
                                ? 'ring-2 ring-violet-100'
                                : ''
                        "
                        class="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-zx-primary-soft"
                    >
                        <img
                            :src="contact.type === 'bot' ? botAvatar : groupAvatarUrl(contact.id)"
                            @error="onAvatarError"
                            :class="
                                contact.type === 'bot'
                                    ? 'h-full w-full object-cover'
                                    : 'h-full w-full object-cover'
                            "
                        />
                    </div>
                    <div class="min-w-0 flex-1">
                        <p class="flex items-center gap-1.5 truncate text-sm font-medium text-zx-text">
                            <span class="truncate">{{ contact.name }}</span>
                            <span
                                v-if="contact.type === 'bot'"
                                class="shrink-0 text-violet-400"
                                title="机器人"
                            >
                                <Bot class="size-3.5" />
                            </span>
                            <span
                                v-else
                                class="shrink-0 text-sky-500"
                                title="群聊"
                            >
                                <UsersRound class="size-3.5" />
                            </span>
                        </p>
                        <p class="truncate text-xs text-zx-text-subtle">
                            {{ contact.id }}
                        </p>
                    </div>
                </button>
            </div>

            <!-- 左下角：身份切换 + 设置 -->
            <div class="shrink-0 border-t border-slate-100 p-2">
                <div class="flex items-center gap-1.5">
                    <button
                        class="group flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-2xl p-1.5 transition-colors hover:bg-slate-100"
                        title="身份管理"
                        type="button"
                        @click="identityOpen = true"
                    >
                        <div class="relative shrink-0">
                            <div
                                class="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full ring-2 ring-rose-100"
                            >
                                <img
                                    :src="resolveAvatar(myUserId)"
                                    @error="onAvatarError"
                                    class="h-full w-full object-cover"
                                />
                            </div>
                            <span
                                :class="
                                    connected
                                        ? 'bg-zx-success'
                                        : 'bg-zx-danger'
                                "
                                class="absolute -right-0.5 bottom-0 size-3 rounded-full border-2 border-white"
                            ></span>
                        </div>
                        <div class="min-w-0 flex-1 text-left">
                            <p class="truncate text-sm font-medium text-zx-text">
                                {{ hasIdentity ? myNickname : "未创建身份" }}
                            </p>
                            <p class="truncate text-xs text-zx-text-subtle">
                                {{ hasIdentity ? myUserId : "点击创建身份" }}
                            </p>
                        </div>
                        <Pencil
                            class="h-4 w-4 shrink-0 text-zx-text-subtle transition-colors group-hover:text-zx-text-muted"
                        />
                    </button>
                    <button
                        class="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-zx-text-subtle transition-colors hover:bg-slate-100 hover:text-zx-text-muted"
                        title="连接设置"
                        type="button"
                        @click="settingsOpen = true"
                    >
                        <Settings class="h-4.5 w-4.5" />
                    </button>
                </div>
            </div>
        </div>

        <!-- 聊天区域 -->
        <div
            :class="[
                'relative min-w-0 flex-1 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm',
                selectedContact ? 'flex' : 'hidden sm:flex',
            ]"
        >
            <!-- 工具栏：未选择联系人时不渲染，避免兜底显示机器人信息 -->
            <div
                v-if="selectedContact"
                class="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3"
            >
                <div class="flex min-w-0 flex-1 items-center gap-2">
                    <button
                        class="flex-shrink-0 rounded-2xl p-1.5 text-zx-text-muted transition-colors hover:bg-gray-100 sm:hidden"
                        type="button"
                        @click="selectedContact = null"
                    >
                        <ArrowLeft class="h-5 w-5" />
                    </button>
                    <div
                        :class="
                            !selectedContact || selectedContact.type === 'bot'
                                ? 'ring-2 ring-violet-100'
                                : ''
                        "
                        class="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-zx-primary-soft"
                    >
                        <img
                            v-if="!selectedContact || selectedContact.type === 'bot'"
                            :src="botAvatar"
                            @error="onAvatarError"
                            class="h-full w-full object-cover"
                        />
                        <img
                            v-else
                            :src="groupAvatarUrl(selectedContact.id)"
                            @error="onAvatarError"
                            class="h-full w-full object-cover"
                        />
                    </div>
                    <div class="min-w-0 flex-1">
                        <p class="truncate text-sm font-bold text-zx-text">
                            {{
                                selectedContact
                                    ? selectedContact.name
                                    : `${botNickname}(${botId})`
                            }}
                        </p>
                        <p
                            class="truncate text-xs text-zx-text-muted"
                            :title="selectedContact ? '' : '由后端驱动连接'"
                        >
                            {{
                                selectedContact
                                    ? contactSubtitle
                                    : "由后端驱动连接"
                            }}
                        </p>
                    </div>
                    <!-- 好友关系 / 群成员操作：纯图标按钮 -->
                    <button
                        v-if="selectedContact?.type === 'bot' && !isBotFriend"
                        class="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-zx-primary transition-colors hover:bg-zx-primary-soft"
                        title="添加好友"
                        type="button"
                        @click="sendFriendRequest"
                    >
                        <UserRoundPlus class="size-4.5" />
                    </button>
                    <button
                        v-else-if="selectedContact?.type === 'bot' && isBotFriend"
                        class="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-zx-text-subtle transition-colors hover:bg-zx-danger-soft hover:text-zx-danger"
                        title="删除好友"
                        type="button"
                        @click="deleteBotFriend"
                    >
                        <UserRoundX class="size-4.5" />
                    </button>
                    <button
                        v-else-if="selectedContact?.type === 'group' && isGroupMember"
                        class="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-zx-text-subtle transition-colors hover:bg-zx-danger-soft hover:text-zx-danger"
                        title="退出群聊"
                        type="button"
                        @click="leaveGroup"
                    >
                        <LogOut class="size-4.5" />
                    </button>
                    <button
                        v-else-if="selectedContact?.type === 'group'"
                        class="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-zx-primary transition-colors hover:bg-zx-primary-soft"
                        title="加入群聊"
                        type="button"
                        @click="joinGroup"
                    >
                        <LogIn class="size-4.5" />
                    </button>
                </div>
            </div>

            <!-- 消息列表 -->
            <div
                ref="messagesContainer"
                class="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 sm:space-y-4 sm:p-4"
                @scroll.passive="onChatScroll"
            >
                <button
                    v-if="hiddenMessageCount > 0"
                    class="mx-auto mb-2 block cursor-pointer rounded-full px-4 py-1.5 text-xs text-zx-text-muted transition-colors hover:bg-slate-100 hover:text-zx-primary"
                    type="button"
                    @click="loadOlderBubbles"
                >
                    查看更早的消息（还有 {{ hiddenMessageCount }} 条）
                </button>
                <div
                    v-if="!selectedContact || currentMessages.length === 0"
                    class="flex h-full items-center justify-center text-zx-text-subtle"
                >
                    <div class="px-4 text-center">
                        <MessageSquare
                            class="mx-auto mb-4 h-12 w-12 opacity-50 sm:h-16 sm:w-16"
                        />
                        <p class="text-sm sm:text-base">
                            {{
                                selectedContact
                                    ? "开始和真寻对话吧"
                                    : "选择一个联系人开始聊天"
                            }}
                        </p>
                    </div>
                </div>

                <template v-for="item in displayMessages" :key="item.key">
                    <!-- 时间分隔线 -->
                    <div
                        v-if="item.kind === 'sep'"
                        class="flex items-center gap-3 py-1 text-[10px] text-zx-text-subtle"
                    >
                        <span class="h-px flex-1 bg-slate-200/70"></span>
                        {{ item.label }}
                        <span class="h-px flex-1 bg-slate-200/70"></span>
                    </div>

                    <!-- 消息 -->
                    <div
                        v-else
                        class="flex items-start space-x-2 sm:space-x-3"
                    >
                        <!-- 机器人头像 -->
                        <div
                            v-if="item.message.from === 'bot'"
                            class="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full ring-2 ring-violet-100"
                        >
                            <img
                                :src="botAvatar"
                                @error="onAvatarError"
                                class="h-full w-full object-cover"
                            />
                        </div>
                        <!-- 其他模拟端发消息的身份头像 -->
                        <div
                            v-else-if="item.message.from === 'peer'"
                            class="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full"
                        >
                            <img
                                :src="resolveAvatar(item.message.senderId ?? '')"
                                @error="onAvatarError"
                                class="h-full w-full object-cover"
                            />
                        </div>

                        <!-- 消息内容列：flex-1 占满行内剩余宽度，气泡的百分比
                             max-width 才有确定基准（宽度随内容收缩的包裹层会让
                             70% 这类百分比陷入循环解析，塌陷成最小内容宽） -->
                        <div
                            class="flex min-w-0 flex-1 flex-col"
                            :class="
                                item.message.from === 'user'
                                    ? 'items-end'
                                    : 'items-start'
                            "
                        >
                            <p
                                v-if="
                                    item.message.from === 'bot' &&
                                    selectedContact?.type === 'group'
                                "
                                class="mb-1 text-xs text-zx-text-muted"
                            >
                                {{ botNickname }}
                            </p>
                            <p
                                v-else-if="item.message.from === 'peer'"
                                class="mb-1 text-xs text-zx-text-muted"
                            >
                                {{ item.message.senderName }}
                            </p>
                            <p
                                v-else-if="selectedContact?.type === 'group'"
                                class="mb-1 text-xs text-zx-text-muted"
                            >
                                {{ myNickname }}
                            </p>
                            <!-- 图片消息：不带气泡，样式与联系人页一致 -->
                            <div
                                v-if="isImageOnly(item.message.parts)"
                                class="max-w-[min(70%,20rem)] overflow-hidden rounded-xl"
                            >
                                <img
                                    v-if="!item.message.parts[0].broken"
                                    v-image-viewer:onebot-chat
                                    :src="resolveImageSrc(item.message.parts[0].src ?? '')"
                                    class="block max-h-64 w-auto max-w-full align-top"
                                    @error="item.message.parts[0].broken = true"
                                />
                                <div
                                    v-else
                                    class="flex h-32 w-48 items-center justify-center rounded-xl bg-gray-100 text-xs text-zx-text-subtle"
                                >
                                    图片加载失败
                                </div>
                            </div>

                            <!-- 文本等其它消息 -->
                            <div
                                v-else
                                :class="
                                    item.message.from === 'user'
                                        ? 'rounded-2xl rounded-br-xs bg-zx-primary text-[color:var(--zx-color-on-primary)]'
                                        : 'rounded-2xl rounded-bl-xs bg-gray-200 text-zx-text-strong'
                                "
                                class="max-w-[min(70%,28rem)] overflow-hidden"
                            >
                                <div
                                    class="flex flex-wrap items-center gap-x-1 gap-y-1 break-words px-3 py-2 text-xs sm:text-sm"
                                >
                                    <template
                                        v-for="(part, pIdx) in item.message.parts"
                                        :key="pIdx"
                                    >
                                        <!-- 图片 -->
                                        <span
                                            v-if="part.kind === 'image'"
                                            class="inline-flex"
                                        >
                                            <span
                                                v-if="part.broken"
                                                class="flex h-24 w-32 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 bg-slate-100 text-zx-text-subtle"
                                            >
                                                <ImageOff class="h-6 w-6" />
                                                <span class="text-[10px]">图片加载失败</span>
                                            </span>
                                            <img
                                                v-else
                                                v-image-viewer:onebot-chat
                                                :src="resolveImageSrc(part.src ?? '')"
                                                class="max-h-48 max-w-full rounded-lg object-contain"
                                                @error="part.broken = true"
                                            />
                                        </span>
                                        <!-- @ -->
                                        <span
                                            v-else-if="part.kind === 'at'"
                                            class="font-semibold"
                                        >{{ part.text }}</span>
                                        <!-- 文本 / tts / markdown -->
                                        <span
                                            v-else-if="
                                                part.kind === 'text' ||
                                                part.kind === 'tts' ||
                                                part.kind === 'markdown'
                                            "
                                            class="whitespace-pre-wrap"
                                        >{{ part.text }}</span>
                                        <!-- 语音 -->
                                        <span
                                            v-else-if="part.kind === 'voice'"
                                            class="inline-flex items-center gap-1 rounded-lg bg-black/10 px-2 py-1"
                                        >
                                            <Mic class="h-3.5 w-3.5 shrink-0" />
                                            <audio
                                                v-if="part.src"
                                                controls
                                                :src="resolveAudioSrc(part.src)"
                                                class="h-8 max-w-52"
                                            ></audio>
                                            <span v-else class="text-[10px]">语音消息</span>
                                        </span>
                                        <!-- 视频 -->
                                        <video
                                            v-else-if="part.kind === 'video' && part.src"
                                            controls
                                            :src="resolveImageSrc(part.src)"
                                            class="max-h-52 max-w-full rounded-lg"
                                        ></video>
                                        <span
                                            v-else-if="part.kind === 'video'"
                                            class="inline-flex items-center gap-1 rounded-md bg-black/10 px-1.5 py-0.5 text-[10px]"
                                        >
                                            [视频]
                                        </span>
                                        <!-- JSON / XML 卡片数据 -->
                                        <pre
                                            v-else-if="part.kind === 'json' || part.kind === 'xml'"
                                            class="max-h-48 max-w-full overflow-auto rounded-lg bg-slate-800/90 px-2 py-1.5 text-left font-mono text-[10px] leading-4 whitespace-pre-wrap text-emerald-100"
                                        >{{ part.text }}</pre>
                                        <!-- 链接/音乐分享卡片 -->
                                        <a
                                            v-else-if="
                                                part.kind === 'share' || part.kind === 'music'
                                            "
                                            :href="part.url || undefined"
                                            target="_blank"
                                            rel="noopener"
                                            class="flex max-w-full min-w-40 flex-col rounded-xl bg-white/85 px-3 py-2 text-left shadow-sm"
                                        >
                                            <span class="truncate text-xs font-semibold text-zx-text">
                                                {{ part.title }}
                                            </span>
                                            <span
                                                v-if="part.subtitle"
                                                class="truncate text-[10px] text-zx-text-subtle"
                                            >
                                                {{ part.subtitle }}
                                            </span>
                                            <span
                                                v-if="part.url"
                                                class="truncate text-[10px] text-sky-500"
                                            >
                                                {{ part.url }}
                                            </span>
                                        </a>
                                        <!-- 位置/名片/转发节点卡片 -->
                                        <span
                                            v-else-if="
                                                part.kind === 'location' ||
                                                part.kind === 'contact' ||
                                                part.kind === 'node'
                                            "
                                            class="flex max-w-full min-w-40 flex-col rounded-xl bg-white/85 px-3 py-2 text-left shadow-sm"
                                        >
                                            <span
                                                class="flex items-center gap-1 truncate text-xs font-semibold text-zx-text"
                                            >
                                                <MapPin
                                                    v-if="part.kind === 'location'"
                                                    class="h-3.5 w-3.5 shrink-0"
                                                />
                                                {{ part.title }}
                                            </span>
                                            <span
                                                v-if="part.subtitle"
                                                class="truncate text-[10px] text-zx-text-subtle"
                                            >
                                                {{ part.subtitle }}
                                            </span>
                                        </span>
                                        <!-- 表情/骰子/猜拳/戳一戳/抖动/回复/转发 等小占位 -->
                                        <span
                                            v-else
                                            class="inline-flex items-center gap-1 rounded-md bg-black/10 px-1.5 py-0.5 text-[10px]"
                                        >{{ part.text }}</span>
                                    </template>
                                </div>
                            </div>
                            <p
                                :class="
                                    item.message.from === 'user'
                                        ? 'text-right'
                                        : 'text-left'
                                "
                                class="mt-1 text-[10px] text-zx-text-subtle"
                            >
                                {{ item.message.time }}
                            </p>
                        </div>

                        <!-- 我的头像 -->
                        <div
                            v-if="item.message.from === 'user'"
                            class="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full ring-2 ring-rose-100"
                        >
                            <img
                                :src="resolveAvatar(myUserId)"
                                @error="onAvatarError"
                                class="h-full w-full object-cover"
                            />
                        </div>
                    </div>
                </template>
            </div>


        <!-- 回到底部：翻历史时出现 -->
        <button
            v-if="showChatScrollBottom"
            class="btn-touch absolute right-5 bottom-32 z-10 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white/95 text-zx-text-muted shadow-md backdrop-blur-sm transition-colors hover:text-zx-primary"
            type="button"
            title="回到底部"
            @click="scrollToBottom()"
        >
            <ArrowDown class="size-4" />
        </button>

            <!-- 输入框 -->
            <ChatComposer
                v-if="selectedContact"
                class="mx-3 mb-3"
                :group-mode="Boolean(currentGroupId) && !Number.isNaN(currentGroupId)"
                :group-members="composerMembers"
                placeholder="输入消息，Enter 发送；@QQ号 / CQ 码 / JSON 段数组"
                @send="onComposerSend"
            >
                <template #tools>
                    <button
                        :class="
                            imageOpen
                                ? 'bg-zx-primary-soft text-zx-primary'
                                : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                        "
                        class="btn-touch flex h-8 w-8 flex-shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors"
                        title="用图片 URL 发送"
                        type="button"
                        @click="imageOpen = !imageOpen"
                    >
                        <Link2 class="h-4 w-4" />
                    </button>
                </template>
            </ChatComposer>

            <!-- 图片 URL 输入行（模拟 http 图片用） -->
            <div
                v-if="selectedContact && imageOpen"
                class="mx-3 mb-2 flex items-center gap-1.5 rounded-2xl border border-zx-primary-soft bg-zx-primary-tint/50 px-3 py-1.5"
            >
                <Link2 class="h-4 w-4 shrink-0 text-zx-primary" />
                <input
                    v-model="imageUrl"
                    placeholder="输入图片 URL，回车发送 image 消息段"
                    class="min-w-0 flex-1 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
                    @keydown.enter.prevent="sendImage"
                />
                <button
                    :disabled="!imageUrl.trim()"
                    class="shrink-0 cursor-pointer rounded-full bg-zx-primary px-3 py-1 text-xs font-bold text-[color:var(--zx-color-on-primary)] transition-colors hover:bg-zx-primary-hover disabled:pointer-events-none disabled:opacity-40"
                    type="button"
                    @click="sendImage"
                >
                    发送
                </button>
                <button
                    class="shrink-0 cursor-pointer text-slate-400 transition-colors hover:text-slate-600"
                    title="取消"
                    type="button"
                    @click="imageOpen = false; imageUrl = ''"
                >
                    <X class="h-3.5 w-3.5" />
                </button>
            </div>
        </div>

        <!-- 身份管理弹窗 -->
        <Teleport to="body">
            <Transition :css="false" @enter="modalJelly.onEnter" @leave="modalJelly.onLeave">
                <div
                    v-if="identityOpen"
                    class="fixed inset-0 z-50 flex items-center justify-center"
                >
                    <div
                        class="glass-overlay absolute h-full w-full"
                        @click="identityOpen = false"
                    ></div>
                    <div
                        class="modal-content relative z-1 w-140 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl max-sm:mx-4"
                    >
                        <!-- 标题 -->
                        <div class="mb-5 flex items-start justify-between gap-2">
                            <div>
                                <p class="text-base font-bold text-zx-text-strong">
                                    身份管理
                                </p>
                                <p class="mt-0.5 text-sm text-zx-text-subtle">
                                    管理用户与机器人身份
                                </p>
                            </div>
                            <button
                                class="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-zx-text-subtle transition-colors hover:bg-slate-100 hover:text-zx-text-muted"
                                title="关闭"
                                type="button"
                                @click="identityOpen = false"
                            >
                                <X class="h-4 w-4" />
                            </button>
                        </div>

                        <!-- 搜索 + 新建身份 -->
                        <div class="mb-3 flex items-center gap-2">
                            <div
                                class="flex min-w-0 flex-1 items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1.5 transition-all focus-within:border-zx-primary focus-within:bg-white"
                            >
                                <Search
                                    class="h-4 w-4 shrink-0 text-zx-text-subtle"
                                />
                                <input
                                    v-model="roleFilter"
                                    placeholder="搜索身份"
                                    class="min-w-0 flex-1 bg-transparent text-sm text-zx-text placeholder:text-zx-text-subtle focus:outline-none"
                                />
                            </div>
                            <button
                                class="flex size-8.5 shrink-0 cursor-pointer items-center justify-center rounded-full border border-slate-200 text-zx-text-subtle transition-colors hover:border-zx-primary hover:text-zx-primary"
                                title="新建身份"
                                type="button"
                                @click="openCreateUser"
                            >
                                <Plus class="h-4 w-4" />
                            </button>
                        </div>

                        <!-- 身份卡片墙：所有身份以卡片展示，角色在卡片上设置 -->
                        <div
                            class="grid max-h-80 grid-cols-2 gap-2.5 overflow-y-auto p-0.5"
                        >
                            <div
                                v-if="filteredUsers.length === 0"
                                class="col-span-2 py-10 text-center text-xs text-zx-text-subtle"
                            >
                                还没有身份，点右上角「+」新建
                            </div>

                            <!-- 身份卡 -->
                            <div
                                v-for="user in filteredUsers"
                                :key="user.user_id"
                                :class="{
                                    'border-rose-200':
                                        String(user.user_id) === myUserId,
                                    'border-violet-200':
                                        String(user.user_id) === botId,
                                }"
                                class="group relative flex items-center gap-3 rounded-2xl border border-slate-200 p-3 transition-colors"
                            >
                                <img
                                    :src="resolveAvatar(user.user_id)"
                                    @error="onAvatarError"
                                    class="size-10 shrink-0 rounded-full object-cover"
                                />
                                <div class="min-w-0 flex-1">
                                    <p
                                        class="flex items-center gap-1.5"
                                        :title="`${user.nickname} (${user.user_id})`"
                                    >
                                        <span
                                            class="truncate text-sm font-medium text-zx-text"
                                        >
                                            {{ user.nickname }}
                                        </span>
                                        <span
                                            v-if="
                                                String(user.user_id) === myUserId
                                            "
                                            class="shrink-0 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] leading-none text-rose-500"
                                        >
                                            用户
                                        </span>
                                        <span
                                            v-else-if="
                                                String(user.user_id) === botId
                                            "
                                            class="shrink-0 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] leading-none text-violet-500"
                                        >
                                            机器人
                                        </span>
                                    </p>
                                    <p class="mt-0.5 truncate text-xs text-zx-text-subtle">
                                        {{ user.user_id }}
                                    </p>
                                </div>
                                <!-- 悬停显示操作：覆盖在卡片右侧，不占布局空间 -->
                                <div
                                    class="absolute inset-y-2 right-2 flex items-center gap-0.5 rounded-xl bg-gradient-to-l from-white via-white/95 to-transparent pl-8 opacity-0 transition-opacity group-hover:opacity-100"
                                >
                                    <button
                                        v-if="String(user.user_id) !== myUserId"
                                        class="flex size-7 cursor-pointer items-center justify-center rounded-lg text-zx-text-subtle transition-colors hover:bg-rose-100 hover:text-rose-500"
                                        title="设为用户"
                                        type="button"
                                        @click="assignUser('user', String(user.user_id))"
                                    >
                                        <UserRound class="size-3.5" />
                                    </button>
                                    <button
                                        v-if="String(user.user_id) !== botId"
                                        class="flex size-7 cursor-pointer items-center justify-center rounded-lg text-zx-text-subtle transition-colors hover:bg-violet-100 hover:text-violet-500"
                                        title="设为机器人"
                                        type="button"
                                        @click="assignUser('bot', String(user.user_id))"
                                    >
                                        <Bot class="size-3.5" />
                                    </button>
                                    <button
                                        class="flex size-7 cursor-pointer items-center justify-center rounded-lg text-zx-text-subtle transition-colors hover:bg-slate-100 hover:text-zx-text-muted"
                                        title="编辑"
                                        type="button"
                                        @click="openEditUser(user)"
                                    >
                                        <Pencil class="size-3.5" />
                                    </button>
                                    <!-- 当前使用中的身份不可删除 -->
                                    <button
                                        v-if="
                                            String(user.user_id) !== myUserId &&
                                            String(user.user_id) !== botId
                                        "
                                        class="flex size-7 cursor-pointer items-center justify-center rounded-lg text-zx-text-subtle transition-colors hover:bg-zx-danger-soft hover:text-zx-danger"
                                        title="删除"
                                        type="button"
                                        @click="removeRole(user)"
                                    >
                                        <Trash2 class="size-3.5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </Transition>
        </Teleport>

        <!-- 新建 / 编辑身份弹窗 -->
        <Teleport to="body">
            <Transition :css="false" @enter="modalJelly.onEnter" @leave="modalJelly.onLeave">
                <div
                    v-if="formOpen"
                    class="fixed inset-0 z-[60] flex items-center justify-center"
                >
                    <div
                        class="glass-overlay absolute h-full w-full"
                        @click="formOpen = false"
                    ></div>
                    <div
                        class="modal-content relative z-1 w-90 rounded-3xl border border-slate-200 bg-white px-8 py-7 shadow-xl max-sm:mx-4"
                    >
                        <button
                            class="absolute right-4 top-4 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-zx-text-subtle transition-colors hover:bg-slate-100 hover:text-zx-text-muted"
                            title="关闭"
                            type="button"
                            @click="formOpen = false"
                        >
                            <X class="h-4 w-4" />
                        </button>

                        <!-- QQ 登录式：居中头像，随账号实时预览 -->
                        <div class="flex flex-col items-center">
                            <p class="text-base font-bold text-zx-text-strong">
                                {{
                                    formMode === "create"
                                        ? "新建身份"
                                        : "编辑身份"
                                }}
                            </p>
                            <button
                                class="group relative mt-4 size-20 cursor-pointer overflow-hidden rounded-full ring-4 ring-slate-100"
                                title="更换头像"
                                type="button"
                                @click="pickAvatar"
                            >
                                <img
                                    :src="formAvatarPreview"
                                    @error="onAvatarError"
                                    class="h-full w-full object-cover"
                                />
                                <span
                                    class="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100"
                                >
                                    <Pencil class="size-4" />
                                </span>
                            </button>
                            <button
                                v-if="formAvatar"
                                class="mt-1.5 cursor-pointer text-xs font-medium text-zx-primary hover:underline"
                                type="button"
                                @click="formAvatar = ''"
                            >
                                恢复默认头像
                            </button>
                            <p v-else class="mt-1.5 text-xs text-zx-text-subtle">
                                默认按账号使用 QQ 头像
                            </p>
                        </div>
                        <input
                            ref="avatarInputRef"
                            accept="image/*"
                            class="hidden"
                            type="file"
                            @change="onAvatarPicked"
                        />

                        <!-- 账号 / 名称 -->
                        <div class="mt-5 space-y-3">
                            <div
                                class="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 transition-all focus-within:border-zx-primary focus-within:bg-white"
                            >
                                <input
                                    v-model="formUserId"
                                    placeholder="账号"
                                    class="min-w-0 flex-1 bg-transparent text-sm text-zx-text placeholder:text-zx-text-subtle focus:outline-none"
                                />
                            </div>
                            <div
                                class="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 transition-all focus-within:border-zx-primary focus-within:bg-white"
                            >
                                <input
                                    v-model="formNickname"
                                    placeholder="名称"
                                    class="min-w-0 flex-1 bg-transparent text-sm text-zx-text placeholder:text-zx-text-subtle focus:outline-none"
                                />
                            </div>
                        </div>

                        <ZxButton
                            class="mt-5 h-10 w-full"
                            @click="saveUserForm"
                        >
                            保存
                        </ZxButton>
                        <button
                            class="mt-2 flex h-10 w-full cursor-pointer items-center justify-center rounded-full text-sm font-medium text-zx-text-muted transition-colors hover:bg-slate-100"
                            type="button"
                            @click="formOpen = false"
                        >
                            取消
                        </button>
                    </div>
                </div>
            </Transition>
        </Teleport>

        <!-- 设置弹窗（连接 / 群聊管理） -->
        <Teleport to="body">
            <Transition :css="false" @enter="modalJelly.onEnter" @leave="modalJelly.onLeave">
                <div
                    v-if="settingsOpen"
                    class="fixed inset-0 z-50 flex items-center justify-center"
                >
                    <div
                        class="glass-overlay absolute h-full w-full"
                        @click="settingsOpen = false"
                    ></div>
                    <div
                        class="modal-content relative z-1 flex max-h-[85vh] w-160 flex-row overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl max-sm:mx-4"
                    >
                        <!-- 左侧目录 -->
                        <aside
                            class="flex w-38 shrink-0 flex-col border-r border-slate-100 p-4"
                        >
                            <p class="mb-4 px-3 text-lg font-bold text-zx-text-strong">
                                设置
                            </p>
                            <nav class="space-y-1">
                                <button
                                    v-for="section in settingsSections"
                                    :key="section.key"
                                    :class="
                                        settingsTab === section.key
                                            ? 'bg-slate-100 text-zx-text-strong'
                                            : 'text-zx-text-muted hover:bg-slate-50 hover:text-zx-text'
                                    "
                                    class="flex h-9 w-full cursor-pointer items-center justify-start rounded-xl px-3 text-sm font-medium transition-colors"
                                    type="button"
                                    @click="settingsTab = section.key"
                                >
                                    {{ section.title }}
                                </button>
                            </nav>
                            <button
                                class="mt-auto cursor-pointer rounded-xl px-3 py-2 text-xs font-semibold text-zx-text-subtle transition-colors hover:bg-slate-50 hover:text-zx-text-muted"
                                type="button"
                                @click="settingsOpen = false"
                            >
                                关闭设置
                            </button>
                        </aside>

                        <!-- 右侧内容区（标题+描述+分隔线+滚动表单） -->
                        <div class="flex min-w-0 flex-1 flex-col">
                            <header
                                class="flex items-start justify-between gap-2 px-5 pt-5 pb-3"
                            >
                                <div class="min-w-0">
                                    <p class="text-lg font-medium text-zx-text-strong">
                                        {{ currentSettingsSection.title }}
                                    </p>
                                    <p class="text-sm text-zx-text-subtle">
                                        {{ currentSettingsSection.description }}
                                    </p>
                                </div>
                            </header>
                            <div class="mx-5 border-t border-slate-100"></div>

                        <!-- 群聊管理 Tab -->
                        <div
                            v-if="settingsTab === 'groups'"
                            class="min-h-0 flex-1 space-y-4 overflow-y-auto p-6"
                        >
                            <!-- 群列表 -->
                            <div class="space-y-1.5">
                                <label class="text-sm font-medium text-zx-text">
                                    选择群聊
                                </label>
                                <div class="space-y-1">
                                    <div
                                        v-if="simState.groups.length === 0"
                                        class="rounded-xl bg-slate-50 py-4 text-center text-xs text-zx-text-subtle"
                                    >
                                        还没有群聊，点联系人列表搜索旁的 + 创建
                                    </div>
                                    <button
                                        v-for="group in simState.groups"
                                        :key="group.group_id"
                                        :class="
                                            String(group.group_id) === managedGroupId
                                                ? 'bg-zx-primary-soft text-zx-primary'
                                                : 'text-zx-text-muted hover:bg-slate-100'
                                        "
                                        class="flex w-full cursor-pointer items-center justify-between rounded-2xl px-3 py-2 text-sm transition-colors"
                                        type="button"
                                        @click="
                                            managedGroupId = String(group.group_id)
                                        "
                                    >
                                        <span class="min-w-0 truncate font-medium">
                                            {{ group.group_name }}
                                        </span>
                                        <span class="shrink-0 text-xs text-zx-text-subtle">
                                            {{ group.group_id }} ·
                                            {{ group.member_count }} 人
                                        </span>
                                    </button>
                                </div>
                            </div>

                            <!-- 成员管理 -->
                            <template v-if="managedGroupId">
                                <div class="space-y-2 border-t border-slate-100 pt-4">
                                    <div class="flex items-center justify-between">
                                        <label class="text-sm font-medium text-zx-text">
                                            群成员
                                        </label>
                                        <button
                                            class="cursor-pointer rounded-full border border-red-200 px-3 py-1 text-xs font-semibold text-red-400 transition-colors hover:border-red-300 hover:text-zx-danger"
                                            type="button"
                                            @click="dissolveGroup"
                                        >
                                            解散该群
                                        </button>
                                    </div>
                                    <div class="space-y-1">
                                        <div
                                            v-for="member in managedMembers"
                                            :key="member.user_id"
                                            class="group flex items-center gap-2.5 rounded-2xl bg-slate-50 px-2 py-1.5"
                                        >
                                            <div
                                                class="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full"
                                                :class="
                                                    String(member.user_id) === botId
                                                        ? 'ring-2 ring-violet-100'
                                                        : String(member.user_id) === myUserId
                                                          ? 'ring-2 ring-rose-100'
                                                          : ''
                                                "
                                            >
                                                <img
                                                    :src="
                                                        String(member.user_id) === botId
                                                            ? botAvatar
                                                            : resolveAvatar(member.user_id)
                                                    "
                                                    :class="
                                                        String(member.user_id) === botId
                                                            ? 'h-full w-full object-cover'
                                                            : 'h-full w-full object-cover'
                                                    "
                                                    @error="onAvatarError"
                                                />
                                            </div>
                                            <div class="min-w-0 flex-1">
                                                <p class="truncate text-sm font-medium text-zx-text">
                                                    {{ member.card || member.nickname }}
                                                </p>
                                                <p class="truncate text-xs text-zx-text-subtle">
                                                    {{ member.user_id }}
                                                </p>
                                            </div>
                                            <span
                                                :class="
                                                    member.role === 'owner'
                                                        ? 'bg-red-500 text-white'
                                                        : member.role === 'admin'
                                                          ? 'bg-blue-500 text-white'
                                                          : 'bg-gray-200 text-zx-text-muted'
                                                "
                                                class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold"
                                            >
                                                {{ roleLabel[member.role] }}
                                            </span>
                                            <span
                                                v-if="
                                                    String(member.user_id) !== botId &&
                                                    String(member.user_id) !== myUserId
                                                "
                                                class="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-zx-text-subtle opacity-0 transition-all hover:bg-zx-danger-soft hover:text-zx-danger group-hover:opacity-100"
                                                title="移出群聊"
                                                @click="removeMemberFromGroup(member)"
                                            >
                                                <Trash2 class="size-3.5" />
                                            </span>
                                        </div>
                                        <div
                                            v-if="managedMembers.length === 0"
                                            class="rounded-xl bg-slate-50 py-3 text-center text-xs text-zx-text-subtle"
                                        >
                                            这个群还没有成员
                                        </div>
                                    </div>

                                    <!-- 添加成员 -->
                                    <div class="flex items-center gap-1.5">
                                        <div class="min-w-0 flex-1">
                                            <select
                                                v-model="addMemberUserId"
                                                class="h-9 w-full cursor-pointer rounded-md border border-slate-300 bg-white px-2 text-sm text-zx-text focus:border-slate-400 focus:shadow focus:outline-none"
                                            >
                                                <option value="" disabled>
                                                    选择身份
                                                </option>
                                                <option
                                                    v-for="user in users"
                                                    :key="user.user_id"
                                                    :value="String(user.user_id)"
                                                >
                                                    {{ user.nickname }}（{{ user.user_id }}）
                                                </option>
                                            </select>
                                        </div>
                                        <div class="shrink-0">
                                            <select
                                                v-model="addMemberRole"
                                                class="h-9 w-26 cursor-pointer rounded-md border border-slate-300 bg-white px-2 text-sm text-zx-text focus:border-slate-400 focus:shadow focus:outline-none"
                                            >
                                                <option value="owner">群主</option>
                                                <option value="admin">管理员</option>
                                                <option value="member">成员</option>
                                            </select>
                                        </div>
                                        <button
                                            :disabled="!addMemberUserId"
                                            class="flex h-9 w-18 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-xl bg-slate-800 text-xs font-bold text-white transition-colors hover:bg-slate-700 disabled:pointer-events-none disabled:opacity-40"
                                            type="button"
                                            @click="addMemberToGroup"
                                        >
                                            <Plus class="h-3.5 w-3.5" />
                                            加入
                                        </button>
                                    </div>
                                    <p class="text-xs text-zx-text-subtle">
                                        从身份池里选人入群（含机器人身份）；当前用户和机器人移不出群
                                    </p>
                                </div>
                            </template>
                        </div>

                        <!-- 好友管理 Tab -->
                        <div
                            v-else-if="settingsTab === 'friends'"
                            class="min-h-0 flex-1 space-y-4 overflow-y-auto p-6"
                        >
                            <!-- 直接添加好友 -->
                            <div class="space-y-2">
                                <label class="text-sm font-medium text-zx-text">
                                    添加好友
                                </label>
                                <div class="flex items-center gap-1.5">
                                    <div class="min-w-0 flex-1">
                                        <ZXInput
                                            v-model="newFriendId"
                                            placeholder="QQ 号"
                                        />
                                    </div>
                                    <div class="min-w-0 flex-1">
                                        <ZXInput
                                            v-model="newFriendName"
                                            placeholder="昵称"
                                        />
                                    </div>
                                    <div class="min-w-0 flex-1">
                                        <ZXInput
                                            v-model="newFriendRemark"
                                            placeholder="备注"
                                        />
                                    </div>
                                    <button
                                        class="flex h-9 w-18 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-xl bg-slate-800 text-xs font-bold text-white transition-colors hover:bg-slate-700"
                                        type="button"
                                        @click="addFriend"
                                    >
                                        <Plus class="h-3.5 w-3.5" />
                                        添加
                                    </button>
                                </div>
                                <p class="text-xs text-zx-text-subtle">
                                    直接加入机器人好友列表；也可以在聊天界面走"添加好友"申请流程
                                </p>
                            </div>

                            <!-- 好友列表 -->
                            <div class="space-y-2 border-t border-slate-100 pt-4">
                                <label class="text-sm font-medium text-zx-text">
                                    好友列表（{{ simState.friends.length }}）
                                </label>
                                <div
                                    v-if="simState.friends.length === 0"
                                    class="rounded-xl bg-slate-50 py-4 text-center text-xs text-zx-text-subtle"
                                >
                                    还没有好友，走申请流程或在上面直接添加
                                </div>
                                <div
                                    v-for="friend in simState.friends"
                                    :key="friend.user_id"
                                    class="group flex items-center gap-2.5 rounded-2xl bg-slate-50 px-2 py-1.5"
                                >
                                    <div
                                        class="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full"
                                    >
                                        <img
                                            :src="resolveAvatar(friend.user_id)"
                                            @error="onAvatarError"
                                            class="h-full w-full object-cover"
                                        />
                                    </div>
                                    <div class="min-w-0 flex-1">
                                        <p
                                            class="truncate text-sm font-medium text-zx-text"
                                        >
                                            {{
                                                friend.remark || friend.nickname
                                            }}
                                        </p>
                                        <p class="truncate text-xs text-zx-text-subtle">
                                            {{ friend.user_id }} ·
                                            {{ friend.nickname }}
                                        </p>
                                    </div>

                                    <template
                                        v-if="
                                            managedFriendId ===
                                            String(friend.user_id)
                                        "
                                    >
                                        <div class="w-36 shrink-0">
                                            <ZXInput
                                                v-model="friendRemarkDraft"
                                                placeholder="输入备注"
                                                @keydown.enter.prevent="
                                                    saveFriendRemark
                                                "
                                            />
                                        </div>
                                        <button
                                            class="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-zx-primary text-[color:var(--zx-color-on-primary)] transition-colors hover:bg-zx-primary-hover"
                                            title="保存备注"
                                            type="button"
                                            @click="saveFriendRemark"
                                        >
                                            <Check class="size-4" />
                                        </button>
                                        <button
                                            class="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-zx-text-subtle transition-colors hover:bg-slate-100"
                                            title="取消"
                                            type="button"
                                            @click="managedFriendId = null"
                                        >
                                            <X class="size-4" />
                                        </button>
                                    </template>
                                    <template v-else>
                                        <button
                                            class="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-zx-text-subtle opacity-0 transition-all hover:bg-slate-100 hover:text-zx-text-muted group-hover:opacity-100"
                                            title="修改备注"
                                            type="button"
                                            @click="
                                                startEditFriendRemark(friend)
                                            "
                                        >
                                            <Pencil class="size-4" />
                                        </button>
                                        <button
                                            class="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-zx-text-subtle opacity-0 transition-all hover:bg-zx-danger-soft hover:text-zx-danger group-hover:opacity-100"
                                            title="删除好友"
                                            type="button"
                                            @click="removeFriendDirect(friend)"
                                        >
                                            <Trash2 class="size-4" />
                                        </button>
                                    </template>
                                </div>
                            </div>
                        </div>

                        <!-- 连接 Tab -->
                        <form
                            v-else
                            class="min-h-0 flex-1 space-y-5 overflow-y-auto p-6"
                            @submit.prevent
                        >
                            <!-- 数据协议 -->
                            <div class="space-y-1.5">
                                <label class="text-sm font-medium text-zx-text">
                                    数据协议
                                </label>
                                <select
                                    disabled
                                    class="h-9 w-full max-w-80 cursor-not-allowed rounded-md border border-slate-300 bg-slate-50 px-2 text-sm text-zx-text-muted"
                                >
                                    <option>OneBot v11 标准</option>
                                </select>
                                <p class="text-xs text-zx-text-subtle">
                                    机器人使用的聊天平台数据协议
                                </p>
                            </div>

                            <!-- 通信方式 -->
                            <div class="space-y-1.5">
                                <label class="text-sm font-medium text-zx-text">
                                    通信方式
                                </label>
                                <select
                                    disabled
                                    class="h-9 w-full max-w-80 cursor-not-allowed rounded-md border border-slate-300 bg-slate-50 px-2 text-sm text-zx-text-muted"
                                >
                                    <option>反向 WebSocket 客户端</option>
                                    <option disabled>WebSocket 服务器</option>
                                    <option disabled>HTTP</option>
                                </select>
                                <p class="text-xs text-zx-text-subtle">
                                    浏览器只能作为客户端连接 nonebot 的反向 WS 端点
                                </p>
                            </div>

                            <!-- 连接地址（由后端推导，页面无需配置） -->
                            <div class="space-y-1.5">
                                <label class="text-sm font-medium text-zx-text">
                                    连接地址
                                </label>
                                <div
                                    class="h-9 w-full cursor-not-allowed rounded-md border border-slate-300 bg-slate-50 px-2 font-mono text-sm text-zx-text-muted flex items-center"
                                >
                                    /zhenxun/ws/v1/onebot
                                </div>
                                <p class="text-xs text-zx-text-subtle">
                                    由 WebUI 后端在进程内连 OneBot，无需在前端配置地址
                                </p>
                            </div>

                            <!-- 访问令牌 -->
                            <div class="space-y-1.5">
                                <label class="text-sm font-medium text-zx-text">
                                    访问令牌
                                </label>
                                <div class="max-w-100">
                                    <ZXInput
                                        v-model="accessToken"
                                        placeholder="留空则不鉴权"
                                    />
                                </div>
                                <p class="text-xs text-zx-text-subtle">
                                    机器人通信中鉴权使用的访问令牌，通过 URL 参数传递
                                </p>
                            </div>

                            <!-- 启动时自动连接 -->
                            <div
                                class="flex max-w-120 flex-row items-center justify-between rounded-lg"
                            >
                                <div class="space-y-0.5">
                                    <label class="text-sm font-medium text-zx-text">
                                        启动时自动连接
                                    </label>
                                    <p class="text-xs text-zx-text-subtle">
                                        打开模拟端后自动连接真寻
                                    </p>
                                </div>
                                <button
                                    role="switch"
                                    :aria-checked="autoConnect"
                                    :class="
                                        autoConnect
                                            ? 'bg-zx-primary'
                                            : 'bg-slate-200'
                                    "
                                    class="relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors"
                                    type="button"
                                    @click="autoConnect = !autoConnect"
                                >
                                    <span
                                        :class="
                                            autoConnect
                                                ? 'translate-x-5.5'
                                                : 'translate-x-0.5'
                                        "
                                        class="mt-0.5 block h-5 w-5 rounded-full bg-white shadow transition-transform"
                                    ></span>
                                </button>
                            </div>

                            <!-- 自动重连 -->
                            <div
                                class="flex max-w-120 flex-row items-center justify-between rounded-lg"
                            >
                                <div class="space-y-0.5">
                                    <label class="text-sm font-medium text-zx-text">
                                        自动重连
                                    </label>
                                    <p class="text-xs text-zx-text-subtle">
                                        是否在连接断开后自动进行重连
                                    </p>
                                </div>
                                <button
                                    role="switch"
                                    :aria-checked="autoReconnect"
                                    :class="
                                        autoReconnect
                                            ? 'bg-zx-primary'
                                            : 'bg-slate-200'
                                    "
                                    class="relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors"
                                    type="button"
                                    @click="autoReconnect = !autoReconnect"
                                >
                                    <span
                                        :class="
                                            autoReconnect
                                                ? 'translate-x-5.5'
                                                : 'translate-x-0.5'
                                        "
                                        class="mt-0.5 block h-5 w-5 rounded-full bg-white shadow transition-transform"
                                    ></span>
                                </button>
                            </div>

                            <!-- 重连间隔 -->
                            <div v-if="autoReconnect" class="space-y-1.5">
                                <label class="text-sm font-medium text-zx-text">
                                    重连间隔
                                </label>
                                <div class="max-w-100">
                                    <ZXInput
                                        v-model="reconnectInterval"
                                        placeholder="3"
                                    />
                                </div>
                                <p class="text-xs text-zx-text-subtle">
                                    断线重连间隔，单位秒，为 0 则不重连
                                </p>
                            </div>

                            <!-- 心跳间隔 -->
                            <div class="space-y-1.5">
                                <label class="text-sm font-medium text-zx-text">
                                    心跳间隔
                                </label>
                                <div class="max-w-100">
                                    <ZXInput
                                        v-model="heartbeatInterval"
                                        placeholder="30"
                                    />
                                </div>
                                <p class="text-xs text-zx-text-subtle">
                                    心跳间隔，单位秒，为 0 则不发送心跳
                                </p>
                            </div>

                            <!-- 显示连接错误 -->
                            <div
                                class="flex max-w-120 flex-row items-center justify-between rounded-lg"
                            >
                                <div class="space-y-0.5">
                                    <label class="text-sm font-medium text-zx-text">
                                        显示连接错误
                                    </label>
                                    <p class="text-xs text-zx-text-subtle">
                                        连接出错时弹出提示通知
                                    </p>
                                </div>
                                <button
                                    role="switch"
                                    :aria-checked="showError"
                                    :class="
                                        showError ? 'bg-zx-primary' : 'bg-slate-200'
                                    "
                                    class="relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors"
                                    type="button"
                                    @click="showError = !showError"
                                >
                                    <span
                                        :class="
                                            showError
                                                ? 'translate-x-5.5'
                                                : 'translate-x-0.5'
                                        "
                                        class="mt-0.5 block h-5 w-5 rounded-full bg-white shadow transition-transform"
                                    ></span>
                                </button>
                            </div>
                            <!-- 连接操作 -->
                            <div class="flex items-center gap-2 pt-1">
                                <button
                                    :class="
                                        connected
                                            ? 'bg-red-400 hover:bg-zx-danger-soft0'
                                            : 'bg-slate-800 hover:bg-slate-700'
                                    "
                                    class="w-24 cursor-pointer rounded-2xl border border-transparent py-2 text-center text-sm font-bold text-white shadow-sm transition-all hover:shadow-md"
                                    type="button"
                                    @click="connected ? disconnect() : connect()"
                                >
                                    {{ connected ? "断开" : "连接" }}
                                </button>
                                <span
                                    :class="
                                        connected
                                            ? 'border-transparent bg-emerald-100 text-emerald-700'
                                            : 'border-slate-200 bg-white text-zx-text-subtle'
                                    "
                                    class="rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                                >
                                    {{ connected ? "已连接" : "未连接" }}
                                </span>
                            </div>

                            <!-- 事件日志 -->
                            <div class="space-y-1.5 border-t border-slate-100 pt-4">
                                <div class="flex items-center justify-between">
                                    <label class="text-sm font-medium text-zx-text">
                                        事件日志
                                    </label>
                                    <button
                                        class="cursor-pointer rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-zx-text-subtle transition-colors hover:border-slate-300 hover:text-zx-text-muted"
                                        type="button"
                                        @click="logs = []"
                                    >
                                        清空
                                    </button>
                                </div>
                                <div
                                    ref="logContainer"
                                    class="max-h-44 space-y-0.5 overflow-y-auto rounded-2xl bg-slate-50 p-2 font-mono text-xs"
                                >
                                    <div
                                        v-if="logs.length === 0"
                                        class="py-4 text-center text-zx-text-subtle"
                                    >
                                        连接后这里显示框架下发的动作请求
                                    </div>
                                    <div
                                        v-for="entry in logs"
                                        :key="entry.id"
                                        class="flex items-start gap-2 rounded px-1 py-0.5 hover:bg-slate-100"
                                    >
                                        <span class="text-[10px] text-zx-text-subtle tabular-nums">
                                            {{ entry.time }}
                                        </span>
                                        <div class="min-w-0 flex-1">
                                            <span class="font-semibold text-amber-600">
                                                {{ entry.title }}
                                            </span>
                                            <span
                                                v-if="entry.detail"
                                                class="ml-2 break-all text-zx-text-subtle"
                                            >
                                                {{ entry.detail }}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </form>
                        </div>
                    </div>
                </div>
            </Transition>
        </Teleport>

        <!-- 创建群聊弹窗（带头像预览） -->
        <Teleport to="body">
            <Transition :css="false" @enter="modalJelly.onEnter" @leave="modalJelly.onLeave">
                <div
                    v-if="createGroupOpen"
                    class="fixed inset-0 z-50 flex items-center justify-center"
                >
                    <div
                        class="glass-overlay absolute h-full w-full"
                        @click="createGroupOpen = false"
                    ></div>
                    <div
                        class="modal-content relative z-1 w-100 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl max-sm:mx-4"
                    >
                        <div class="mb-4">
                            <p class="text-base font-bold text-zx-text-strong">
                                创建群聊
                            </p>
                            <p class="text-sm text-zx-text-subtle">
                                添加一个模拟群组到联系人列表
                            </p>
                        </div>

                        <form class="space-y-4" @submit.prevent="createGroup">
                            <div class="space-y-1.5">
                                <label class="text-sm font-medium text-zx-text">
                                    群号
                                </label>
                                <ZXInput
                                    v-model="newGroupId"
                                    placeholder="70000"
                                />
                            </div>
                            <div class="space-y-1.5">
                                <label class="text-sm font-medium text-zx-text">
                                    群名称
                                </label>
                                <ZXInput
                                    v-model="newGroupName"
                                    placeholder="模拟群"
                                />
                            </div>

                            <!-- 我加入 -->
                            <div
                                class="flex flex-row items-center justify-between rounded-lg"
                            >
                                <div class="space-y-0.5">
                                    <label class="text-sm font-medium text-zx-text">
                                        我加入群组
                                    </label>
                                    <p class="text-xs text-zx-text-subtle">
                                        以群主身份加入（{{ myNickname }}）
                                    </p>
                                </div>
                                <button
                                    role="switch"
                                    :aria-checked="creatorJoin"
                                    :class="
                                        creatorJoin
                                            ? 'bg-zx-primary'
                                            : 'bg-slate-200'
                                    "
                                    class="relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors"
                                    type="button"
                                    @click="creatorJoin = !creatorJoin"
                                >
                                    <span
                                        :class="
                                            creatorJoin
                                                ? 'translate-x-5.5'
                                                : 'translate-x-0.5'
                                        "
                                        class="mt-0.5 block h-5 w-5 rounded-full bg-white shadow transition-transform"
                                    ></span>
                                </button>
                            </div>

                            <!-- 机器人加入 -->
                            <div
                                class="flex flex-row items-center justify-between rounded-lg"
                            >
                                <div class="space-y-0.5">
                                    <label class="text-sm font-medium text-zx-text">
                                        机器人加入
                                    </label>
                                    <p class="text-xs text-zx-text-subtle">
                                        {{ botNickname }} 以成员身份加入
                                    </p>
                                </div>
                                <button
                                    role="switch"
                                    :aria-checked="botJoinGroup"
                                    :class="
                                        botJoinGroup
                                            ? 'bg-zx-primary'
                                            : 'bg-slate-200'
                                    "
                                    class="relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors"
                                    type="button"
                                    @click="botJoinGroup = !botJoinGroup"
                                >
                                    <span
                                        :class="
                                            botJoinGroup
                                                ? 'translate-x-5.5'
                                                : 'translate-x-0.5'
                                        "
                                        class="mt-0.5 block h-5 w-5 rounded-full bg-white shadow transition-transform"
                                    ></span>
                                </button>
                            </div>

                            <button
                                class="h-9 w-full cursor-pointer rounded-2xl border border-transparent bg-slate-800 text-sm font-bold text-white shadow-sm transition-all hover:bg-slate-700"
                                type="submit"
                            >
                                创建群组
                            </button>
                        </form>
                    </div>
                </div>
            </Transition>
        </Teleport>

        <!-- @ 提及成员浮层：贴光标、随主题、↑↓/Enter 选择 -->
    </div>
</template>

<style scoped>
/* 富文本输入框：内联图片与占位提示（运行时插入的节点拿不到 scoped 属性，需 :deep） */
</style>
