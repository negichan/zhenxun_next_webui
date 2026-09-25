<script setup lang="ts">
import {
    AlertCircle,
    ArrowDown,
    ArrowLeft,
    Check,
    ChevronRight,
    CircleCheck,
    Copy,
    CornerUpRight,
    Download,
    FileText,
    FolderDown,
    Link2,
    MapPin,
    MessageSquare,
    MessagesSquare,
    Mic,
    Music,
    PanelRight,
    Video,
    X,
} from "lucide-vue-next";
import { storeToRefs } from "pinia";
import { onClickOutside } from "@vueuse/core";
import { useChatStore } from "@/store/chat.ts";
import { computed, nextTick, onMounted, reactive, ref, watch } from "vue";
import { ZXNotification } from "@/services/ui";
import {
    sendMessage as sendWsMessage,
    sendForwardMessage,
    sendSegmentsMessage,
} from "@/utils/api-next/websocket-chat";
import { manageApi } from "@/utils/api-next";
import type { GroupMember } from "@/types/manage.types";
import { useBotStore } from "@/store/bot.ts";
import ChatHistoryModal from "@/views/chat/ChatHistoryModal.vue";
import ForwardViewer from "@/views/chat/ForwardViewer.vue";
import ContactPickerModal, {
    type ForwardTarget,
    type ForwardMode,
} from "@/views/chat/ContactPickerModal.vue";
import {
    ZXContextMenu,
    menuSep,
    type ZXContextMenuItem,
} from "@/components/zxcomponent/ContextMenu";
import ZxEmptyState from "@/components/zxcomponent/ZxEmptyState.vue";
import FaceImg from "@/views/chat/FaceImg.vue";
import ChatComposer, { type OutgoingPart } from "@/views/chat/ChatComposer.vue";
import type {
    ChatMessage,
    ChatMessagePart,
    ForwardNode,
    StickerKind,
} from "@/types";

const props = defineProps<{
    /** 右侧详情面板是否展开（用于按钮高亮） */
    detailOpen?: boolean;
}>();

const emit = defineEmits<{
    "toggle-detail": [];
}>();

const chatStore = useChatStore();
const botStore = useBotStore();

const { selectedContact, friends, groups, selectedId, messages } =
    storeToRefs(chatStore);
const { appendMessage, appendCurrentMessage, removeCurrentMessage, createMessageId } =
    chatStore;

// 消息容器 ref
const messagesContainer = ref<HTMLElement | null>(null);

// 图片消息加载态（替代 el-image 的 placeholder/error 插槽）：
// undefined = 加载中，loaded / error 见名
const imageState = reactive<Record<string, "loaded" | "error">>({});

// ==================== Telegram 式消息窗口 ====================
// 大会话只渲染底部窗口内的气泡，往上翻按需扩窗并锚定滚动位置，
// 避免上千条消息全量渲染；贴近底部时新消息才自动滚底
const RENDER_STEP = 80;
const renderCount = ref(60);

const visibleMessages = computed(() =>
    messages.value.slice(
        Math.max(0, messages.value.length - renderCount.value),
    ),
);

const hiddenCount = computed(
    () => messages.value.length - visibleMessages.value.length,
);

const isNearBottom = () => {
    const el = messagesContainer.value;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 150;
};

const loadOlderMessages = async () => {
    const el = messagesContainer.value;
    const prevHeight = el?.scrollHeight ?? 0;
    const prevTop = el?.scrollTop ?? 0;
    renderCount.value += RENDER_STEP;
    await nextTick();
    // 锚定：扩窗后保持视口内的内容不动
    if (el) el.scrollTop = prevTop + (el.scrollHeight - prevHeight);
};

const showScrollBottom = ref(false);

// 历史记录弹窗
const historyOpen = ref(false);

// 合并转发查看器
const forwardOpen = ref(false);
const forwardId = ref("");
const forwardBotId = ref<string | undefined>(undefined);
// 本地合成的合并转发：按合成 id 缓存节点，点开直接渲染（后端无真实 forward id）
const localForwards = new Map<string, ForwardNode[]>();
const forwardLocalNodes = ref<ForwardNode[] | null>(null);
const openForward = (id: string) => {
    if (!id) return;
    forwardId.value = id;
    forwardBotId.value = getCurrentBot()?.self_id ?? undefined;
    forwardLocalNodes.value = localForwards.get(id) ?? null;
    forwardOpen.value = true;
};

// ==================== 消息多选 / 右键操作（复制·下载·另存为·转发） ====================
const notify = (
    title: string,
    message: string,
    type: "success" | "error" | "warning" | "info",
) => ZXNotification({ title, message, type, position: "top-right" });

// 多选态
const selectMode = ref(false);
const selectedIds = ref<Set<number>>(new Set());
const selectedCount = computed(() => selectedIds.value.size);

const isSelected = (id: number) => selectedIds.value.has(id);
const toggleSelect = (id: number) => {
    const s = selectedIds.value;
    if (s.has(id)) s.delete(id);
    else s.add(id);
};
const enterSelectMode = (id?: number) => {
    selectMode.value = true;
    if (id != null) selectedIds.value.add(id);
};
const exitSelectMode = () => {
    selectMode.value = false;
    selectedIds.value.clear();
};

// 转发目标选择器
const pickerOpen = ref(false);
const pendingForwardIds = ref<number[]>([]);
const startForward = (ids: number[]) => {
    if (!ids.length) return;
    pendingForwardIds.value = ids;
    pickerOpen.value = true;
};
const forwardSelected = () => {
    startForward([...selectedIds.value]);
};

// 提取消息里的文本与图片资源
const textOfMessage = (m: ChatMessage): string => {
    if (m.parts && m.parts.length) {
        return m.parts
            .filter((p) => p.type === "text")
            .map((p) => p.content)
            .join("")
            .trim();
    }
    return m.message_type === "text" ? m.message.trim() : "";
};
const imageUrlsOf = (m: ChatMessage): string[] => {
    if (m.parts && m.parts.length) {
        return m.parts.filter((p) => p.type === "image").map((p) => p.content);
    }
    return m.message_type === "image" ? [m.message] : [];
};

// 复制文本：优先剪贴板 API（需安全上下文），http 环境降级 execCommand
const copyTextSafe = async (text: string): Promise<boolean> => {
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch {
        /* 降级 */
    }
    try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.cssText =
            "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        ta.remove();
        return ok;
    } catch {
        return false;
    }
};

const doCopyText = async (text: string) => {
    const ok = await copyTextSafe(text);
    notify(
        ok ? "已复制" : "复制失败",
        ok ? (text.length > 20 ? `${text.slice(0, 20)}…` : text) : "剪贴板不可用",
        ok ? "success" : "error",
    );
};

// 图片 url → PNG blob（经 canvas 转换，跨域缺 CORS 会失败）
const urlToPngBlob = async (url: string): Promise<Blob> => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.referrerPolicy = "no-referrer";
    await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("图片加载失败"));
        img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width || 1;
    canvas.height = img.naturalHeight || img.height || 1;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("无法创建画布");
    ctx.drawImage(img, 0, 0);
    return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error("导出失败"))),
            "image/png",
        );
    });
};

const doCopyImage = async (url: string) => {
    try {
        if (
            typeof ClipboardItem === "undefined" ||
            !navigator.clipboard ||
            !("write" in navigator.clipboard)
        ) {
            throw new Error("不支持");
        }
        const png = await urlToPngBlob(url);
        await navigator.clipboard.write([
            new ClipboardItem({ "image/png": png }),
        ]);
        notify("已复制", "图片已复制到剪贴板", "success");
    } catch {
        notify("无法复制图片", "当前环境不支持，请改用「下载」", "warning");
    }
};

const imageFilename = (url: string, idx: number): string => {
    let ext = "png";
    const dm = url.match(/^data:image\/(\w+)/);
    if (dm) ext = dm[1] === "jpeg" ? "jpg" : dm[1].toLowerCase();
    else {
        const em = url
            .split("?")[0]
            .match(/\.(png|jpe?g|gif|webp|apng|bmp)$/i);
        if (em) {
            const e = em[1].toLowerCase();
            ext = e === "jpeg" ? "jpg" : e === "apng" ? "png" : e;
        }
    }
    return `image-${Date.now()}${idx ? `-${idx}` : ""}.${ext}`;
};

const downloadImage = async (url: string, filename: string) => {
    try {
        const blob = await (await fetch(url)).blob();
        const objUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(objUrl), 1000);
    } catch {
        // CORS 拉不到 blob：退化为直接用原始 url 触发下载/新窗口
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.target = "_blank";
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
    }
};

const doDownloadImages = async (urls: string[]) => {
    for (let i = 0; i < urls.length; i++) {
        await downloadImage(urls[i], imageFilename(urls[i], i));
    }
};

const saveImageAs = async (url: string, filename: string) => {
    const picker = (window as any).showSaveFilePicker;
    if (typeof picker === "function") {
        try {
            const blob = await (await fetch(url)).blob();
            const handle = await picker({ suggestedName: filename });
            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
            return;
        } catch (err: any) {
            if (err?.name === "AbortError") return; // 用户取消
        }
    }
    // http/非安全上下文或取消后降级为直接下载
    await downloadImage(url, filename);
};

const doSaveAsImages = async (urls: string[]) => {
    for (let i = 0; i < urls.length; i++) {
        await saveImageAs(urls[i], imageFilename(urls[i], i));
    }
};

// 右键菜单：按消息类型给出可用操作
const openMessageMenu = (e: MouseEvent, m: ChatMessage) => {
    const items: ZXContextMenuItem[] = [];
    const text = textOfMessage(m);
    const imgs = imageUrlsOf(m);
    if (text) {
        items.push({ label: "复制", icon: Copy, action: () => doCopyText(text) });
    }
    if (imgs.length) {
        items.push({
            label: "复制图片",
            icon: Copy,
            action: () => doCopyImage(imgs[0]),
        });
        items.push({
            label: imgs.length > 1 ? `下载全部图片（${imgs.length}）` : "下载",
            icon: Download,
            action: () => doDownloadImages(imgs),
        });
        if (imgs.length === 1) {
            items.push({
                label: "另存为",
                icon: FolderDown,
                action: () => doSaveAsImages(imgs),
            });
        }
    }
    items.push(menuSep());
    items.push({
        label: "转发",
        icon: CornerUpRight,
        action: () => startForward([m.id]),
    });
    items.push({
        label: "多选",
        icon: CircleCheck,
        action: () => enterSelectMode(m.id),
    });
    ZXContextMenu.show({ x: e.clientX, y: e.clientY, items });
};

// 资源 url → base64 payload（data/base64 直接抽取，远程 fetch 后转码）
const toBase64Payload = async (url: string): Promise<string | null> => {
    try {
        if (!url) return null;
        if (url.startsWith("base64://")) return url.slice("base64://".length);
        if (url.startsWith("data:")) {
            const comma = url.indexOf(",");
            return comma >= 0 ? url.slice(comma + 1) : null;
        }
        const blob = await (await fetch(url)).blob();
        return await new Promise<string>((resolve, reject) => {
            const fr = new FileReader();
            fr.onload = () => {
                const r = String(fr.result);
                const comma = r.indexOf(",");
                resolve(comma >= 0 ? r.slice(comma + 1) : "");
            };
            fr.onerror = () => reject(new Error("读取失败"));
            fr.readAsDataURL(blob);
        });
    } catch {
        return null;
    }
};

// 取一条消息的原始段（单类型消息合成单段）
const messageSegments = (m: ChatMessage): ChatMessagePart[] =>
    m.parts && m.parts.length > 1
        ? m.parts
        : [{ type: m.message_type, content: m.message }];

const isNumericId = (s: string) => /^\d{4,}$/.test((s || "").trim());

// 段 → 可直接发送的 {type, content}，尽量还原成对应 OneBot 段：
// 图片/语音转 base64；视频按 url；json/xml 原样；at 用真实 qq；forward 用 node id；其余降级文本
const toSendSegments = async (
    m: ChatMessage,
): Promise<{ type: string; content: string }[]> => {
    const out: { type: string; content: string }[] = [];
    for (const p of messageSegments(m)) {
        if (p.type === "text") {
            const t = p.content.trim();
            if (t) out.push({ type: "text", content: t });
        } else if (p.type === "face") {
            if (p.content.trim())
                out.push({ type: "face", content: p.content.trim() });
        } else if (p.type === "image" || p.type === "record") {
            const b64 = await toBase64Payload(p.content);
            if (b64) out.push({ type: p.type, content: `base64://${b64}` });
        } else if (p.type === "video") {
            const u = (p.content || "").trim();
            if (u && !u.startsWith("[")) out.push({ type: "video", content: u });
            else out.push({ type: "text", content: u || "[视频]" });
        } else if (p.type === "json" || p.type === "xml") {
            const raw = (p.content || "").trim();
            if (raw && !raw.startsWith("["))
                out.push({ type: p.type, content: raw });
            else out.push({ type: "text", content: raw || "[卡片]" });
        } else if (p.type === "at") {
            const qq =
                (p.qq || "").trim() ||
                (isNumericId(p.content) ? p.content.trim() : "");
            if (qq) out.push({ type: "at", content: qq });
            else if (p.content?.trim())
                out.push({ type: "text", content: p.content.trim() });
        } else if (p.type === "forward") {
            const id = (p.content || "").trim();
            if (isNumericId(id)) out.push({ type: "node", content: id });
            else out.push({ type: "text", content: id || "[合并转发]" });
        } else {
            const t = p.content?.trim();
            if (t) out.push({ type: "text", content: t });
        }
    }
    return out;
};

// 转发后写入目标会话的本地回显（后端不回广播已发消息，需前端自行落库/上屏）
const buildEcho = (
    m: ChatMessage,
    botId: string,
    avatar: string,
    target: ForwardTarget,
): ChatMessage => ({
    id: createMessageId(),
    user_id: botId,
    user_name: "小真寻",
    avatar,
    message: m.message,
    message_type: m.message_type,
    timestamp: new Date().toISOString(),
    is_self: true,
    sticker: m.sticker,
    group_id: target.type === "group" ? target.id : undefined,
    parts: m.parts,
});

const doForward = async (target: ForwardTarget, mode: ForwardMode) => {
    pickerOpen.value = false;
    const wasSelect = selectMode.value;
    const bot = getCurrentBot();
    if (!bot?.self_id) {
        notify("转发失败", "没有找到可用的 Bot", "error");
        return;
    }
    const ids = pendingForwardIds.value;
    const msgs = messages.value.filter((m) => ids.includes(m.id));
    if (wasSelect) exitSelectMode();
    pendingForwardIds.value = [];
    if (!msgs.length) return;

    const gid = target.type === "group" ? target.id : null;
    const uid = target.type === "friend" ? target.id : null;
    const botId = bot.self_id;
    const botAvatar =
        bot.ava_url || `https://q1.qlogo.cn/g?b=qq&nk=${bot.self_id}&s=160`;
    const botArg = { self_id: botId, name: String(bot.nickname ?? "") };

    try {
        if (mode === "merged") {
            const sendNodes: {
                name: string;
                uin: string;
                segments: { type: string; content: string }[];
            }[] = [];
            const viewNodes: ForwardNode[] = [];
            for (const m of msgs) {
                const segs = await toSendSegments(m);
                if (!segs.length) continue;
                sendNodes.push({
                    name: m.user_name || "小真寻",
                    uin: m.user_id,
                    segments: segs,
                });
                viewNodes.push({
                    user_id: m.user_id,
                    nickname: m.user_name || "未知",
                    time: Math.floor(
                        new Date(m.timestamp).getTime() / 1000,
                    ),
                    // 本地查看用原始可展示内容（图片保留 data/远程 url）
                    segments: messageSegments(m).map((p) => ({
                        type: p.type,
                        content: p.content,
                    })),
                });
            }
            if (!sendNodes.length) {
                notify("转发失败", "没有可转发的内容", "error");
                return;
            }
            await sendForwardMessage(botArg, gid, uid, sendNodes);
            const fid = `local-${Date.now()}`;
            localForwards.set(fid, viewNodes);
            await appendMessage(target.type, target.id, {
                id: createMessageId(),
                user_id: botId,
                user_name: "小真寻",
                avatar: botAvatar,
                message: fid,
                message_type: "forward",
                timestamp: new Date().toISOString(),
                is_self: true,
                group_id: gid || undefined,
            });
            notify(
                "已转发",
                `已合并转发 ${sendNodes.length} 条给 ${target.name}`,
                "success",
            );
        } else {
            let ok = 0;
            for (const m of msgs) {
                try {
                    const segs = await toSendSegments(m);
                    if (!segs.length) continue;
                    await sendSegmentsMessage(botArg, gid, uid, segs);
                    await appendMessage(
                        target.type,
                        target.id,
                        buildEcho(m, botId, botAvatar, target),
                    );
                    ok++;
                } catch (err) {
                    console.error("转发失败:", err);
                }
            }
            if (ok > 0) {
                notify("已转发", `已逐条转发 ${ok} 条给 ${target.name}`, "success");
            } else {
                notify("转发失败", "没有消息发送成功", "error");
            }
        }
    } catch (err: any) {
        console.error("转发失败:", err);
        notify("转发失败", String(err?.message || err), "error");
    }
};

const onMessagesScroll = () => {
    showScrollBottom.value = !isNearBottom();
};


// 获取当前选中联系人的详细信息
const currentContactInfo = computed(() => {
    if (!selectedContact.value || !selectedId.value) {
        return null;
    }
    if (selectedContact.value === "friend") {
        const friend = friends.value.find(
            (f) => f.user_id === selectedId.value,
        );
        if (friend) {
            return {
                name: friend.nickname || friend.remark || "未知好友",
                id: friend.user_id,
                avatar: friend.ava_url,
            };
        }
    } else if (selectedContact.value === "group") {
        const group = groups.value.find((g) => g.group_id === selectedId.value);
        if (group) {
            return {
                name: group.group_name,
                id: group.group_id,
                avatar: group.ava_url,
            };
        }
    }
    return null;
});


// ==================== 发送（内容由 ChatComposer 组装） ====================
const onComposerSend = async (parts: OutgoingPart[]) => {
    if (!selectedContact.value || !selectedId.value) {
        ZXNotification({
            title: "呜呼～",
            message: "请先选择一个聊天对象哦 (っ °Д °;) っ",
            type: "error",
            position: "top-right",
        });
        return;
    }

    const bot = getCurrentBot();
    if (!bot || !bot.self_id) {
        ZXNotification({
            title: "呜呼～",
            message: "没有找到可用的 Bot (っ °Д °;) っ",
            type: "error",
            position: "top-right",
        });
        return;
    }

    // 纯文本单段走原始文本；其余（图片/语音/face/at，含单段）统一走 zxmsg:// JSON
    // 发给后端的段只保留 {type, content}，sticker 仅用于本地回显与渲染
    const single = parts.length === 1 ? parts[0] : null;
    const wireMessage =
        single && single.type === "text"
            ? single.content.trim()
            : `zxmsg://${JSON.stringify(
                  parts.map(({ type, content }) => ({ type, content })),
              )}`;

    // 本地回显：媒体段换成 data URL 直接可显示；face/at 段原样保留
    const echoParts: ChatMessagePart[] = parts.map((part) => {
        if (part.type === "text") {
            return { type: "text", content: part.content };
        }
        if (part.type === "face") {
            return { type: "face", content: part.content };
        }
        if (part.type === "at") {
            return {
                type: "at",
                content: `@${part.name || part.content}`,
            };
        }
        let payload = part.content;
        if (payload.startsWith("base64://voice/")) {
            payload = payload.slice("base64://voice/".length);
        } else if (payload.startsWith("base64://")) {
            payload = payload.slice("base64://".length);
        }
        const mime = part.type === "record" ? "audio/webm" : "image/png";
        return {
            type: part.type,
            content: payload ? `data:${mime};base64,${payload}` : part.content,
            sticker: part.sticker,
        };
    });
    const textSummary = parts
        .filter((part) => part.type === "text")
        .map((part) => part.content)
        .join("")
        .trim();

    const botAvatar =
        bot.ava_url || `https://q1.qlogo.cn/g?b=qq&nk=${bot.self_id}&s=160`;
    const newMessage: ChatMessage = {
        id: createMessageId(),
        user_id: bot.self_id,
        user_name: "小真寻",
        avatar: botAvatar,
        message:
            textSummary ||
            echoParts.find((part) => part.type !== "text")?.content ||
            "",
        message_type: parts[0].type,
        timestamp: new Date().toISOString(),
        is_self: true,
        sticker: parts.length === 1 ? parts[0].sticker : undefined,
        group_id:
            selectedContact.value === "group" ? selectedId.value : undefined,
        parts: parts.length > 1 ? echoParts : undefined,
    };
    await appendCurrentMessage(newMessage);

    try {
        await sendWsMessage(
            { self_id: bot.self_id, name: <string>bot.nickname },
            selectedContact.value === "group" ? selectedId.value : null,
            selectedContact.value === "friend" ? selectedId.value : null,
            wireMessage,
        );
    } catch (error: any) {
        console.error("发送消息失败:", error);
        await removeCurrentMessage(newMessage.id);
        ZXNotification({
            title: "发送失败",
            message: "消息发送失败了，可能已断开连接……(´；ω；`)",
            type: "error",
            sticker: "33",
            position: "top-right",
        });
        return;
    }

    scrollToBottom();
};

// 获取当前可用的 bot（使用全局选中的 Bot）
const getCurrentBot = () => {
    return botStore.selectedBot || null;
};



// 滚动到底部：瞬时定位，进入/切换会话直接钉在底部，不做平滑滚动
const scrollToBottom = () => {
    setTimeout(() => {
        messagesContainer.value?.scrollTo({
            top: messagesContainer.value.scrollHeight,
        });
    }, 0);
};

// JSON 字符串尽量格式化展示，失败原样返回
const formatStructured = (raw: string) => {
    try {
        return JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
        return raw;
    }
};

// 监听消息变化，贴近底部时自动滚底（翻历史时不打断阅读）
watch(
    () => messages.value.length,
    () => {
        if (isNearBottom()) scrollToBottom();
    },
);

// 切换会话/联系人：重置窗口并直接钉在底部
watch([selectedContact, selectedId], () => {
    renderCount.value = 60;
    groupMembers.value = [];
    membersLoadedGroupId.value = "";
    nextTick(() => scrollToBottom());
});

const stickerBoxClass = (k?: StickerKind) =>
    k === "emoji"
        ? "inline-flex items-center text-xs sm:text-sm"
        : k === "sticker"
          ? "inline-block"
          : "image-message max-w-[min(70%,20rem)]";
const stickerImgClass = (k?: StickerKind) =>
    k === "emoji"
        ? "h-[1.3em] w-[1.3em] object-contain align-middle"
        : k === "sticker"
          ? "max-h-[12em] max-w-full object-contain"
          : "max-w-full align-top";
const stickerPhClass = (k?: StickerKind) =>
    k === "emoji"
        ? "h-[1.3em] w-[1.3em]"
        : k === "sticker"
          ? "h-[8em] w-[8em]"
          : "h-32 w-48";

// 群成员（ChatComposer 的 @ 提及数据源）
const groupMembers = ref<GroupMember[]>([]);
const membersLoading = ref(false);
const membersLoadedGroupId = ref<string>("");
const loadGroupMembers = async () => {
    const gid = selectedId.value;
    if (selectedContact.value !== "group" || !gid) return;
    if (membersLoadedGroupId.value === gid) return;
    membersLoading.value = true;
    try {
        const bot = getCurrentBot();
        const res = await manageApi.getGroupMembers(gid, bot?.self_id ?? undefined);
        if (res?.success && res.data) {
            groupMembers.value = res.data;
            membersLoadedGroupId.value = gid;
        }
    } catch (e) {
        console.error("加载群成员失败:", e);
    } finally {
        membersLoading.value = false;
    }
};

onMounted(async () => {
    scrollToBottom();
});
</script>

<template>
    <div
        :class="[
            'relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm',
            selectedContact ? 'flex' : 'hidden sm:flex',
        ]"
    >
        <!-- 当前聊天信息 -->
        <div
            v-if="currentContactInfo"
            class="flex items-center gap-3 border-b border-gray-200 px-4 pl-6 py-3 pt-4"
        >
            <!-- 移动端返回按钮 -->
            <button
                @click="
                    selectedContact = null;
                    selectedId = '';
                "
                class="flex-shrink-0 rounded-2xl p-1.5 text-zx-text-muted transition-colors hover:bg-gray-100 sm:hidden"
            >
                <ArrowLeft class="h-5 w-5" />
            </button>
            <div
                class="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-zx-primary-soft text-xs font-bold text-zx-primary"
            >
                <img
                    v-if="currentContactInfo.avatar"
                    :src="currentContactInfo.avatar"
                    referrerpolicy="no-referrer"
                    class="h-full w-full object-cover"
                    @error="
                        (e) =>
                            ((e.target as HTMLImageElement).style.display =
                                'none')
                    "
                />
                <span v-if="!currentContactInfo.avatar">{{
                    currentContactInfo.name.charAt(0)
                }}</span>
            </div>
            <div class="flex min-w-0 flex-1 items-baseline gap-2">
                <p class="truncate font-bold text-zx-text">
                    {{ currentContactInfo.name }}
                </p>
                <p class="truncate text-xs text-zx-text-muted">
                    {{ currentContactInfo.id }}
                </p>
            </div>
            <!-- 右侧详情面板开关 -->
            <button
                :class="
                    props.detailOpen
                        ? 'bg-zx-primary-soft text-zx-primary'
                        : 'text-zx-text-subtle hover:bg-slate-100 hover:text-zx-text-muted'
                "
                class="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors"
                :title="props.detailOpen ? '收起详情' : '查看详情'"
                @click="emit('toggle-detail')"
            >
                <PanelRight class="h-4 w-4" />
            </button>
        </div>

        <!-- 消息列表 -->
        <div
            ref="messagesContainer"
            class="relative flex-1 space-y-3 overflow-y-auto p-3 sm:space-y-4 sm:p-4"
            @scroll.passive="onMessagesScroll"
        >
            <button
                v-if="hiddenCount > 0"
                class="mx-auto mb-2 block cursor-pointer rounded-full px-4 py-1.5 text-xs text-zx-text-muted transition-colors hover:bg-slate-100 hover:text-zx-primary"
                type="button"
                @click="loadOlderMessages"
            >
                查看更早的消息（还有 {{ hiddenCount }} 条）
            </button>
            <ZxEmptyState
                v-if="messages.length === 0"
                class="h-full"
                :icon="MessageSquare"
                size="md"
                text="暂无消息"
                sub-text="选择一个联系人开始聊天吧～"
            />

            <div
                v-for="message in visibleMessages"
                :key="message.id"
                class="group relative flex items-start gap-1.5 rounded-xl sm:gap-2"
                :class="[
                    selectMode && isSelected(message.id)
                        ? 'bg-zx-primary-soft/70'
                        : '',
                    selectMode ? 'cursor-pointer' : '',
                ]"
                @contextmenu.prevent.stop="openMessageMenu($event, message)"
                @click="selectMode ? toggleSelect(message.id) : undefined"
            >
                <!-- 多选勾选框：QQNT 式常驻左侧列 -->
                <button
                    v-if="selectMode"
                    type="button"
                    class="mt-3 flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center self-start rounded-md border transition-colors sm:mt-4"
                    :class="
                        isSelected(message.id)
                            ? 'border-zx-primary bg-zx-primary text-[color:var(--zx-color-on-primary)]'
                            : 'border-slate-300 bg-white'
                    "
                    @click.stop="toggleSelect(message.id)"
                >
                    <Check v-if="isSelected(message.id)" class="h-3.5 w-3.5" />
                </button>
                <!-- 头像 -->
                <div
                    v-if="!message.is_self"
                    class="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-zx-primary-soft text-xs font-bold text-zx-primary sm:h-10 sm:w-10 sm:text-sm"
                >
                    <img
                        v-if="message.avatar"
                        :src="message.avatar"
                        referrerpolicy="no-referrer"
                        class="h-full w-full object-cover"
                        @error="message.avatar = ''"
                    />
                    <span v-else>{{
                        (message.user_name || message.user_id).charAt(0)
                    }}</span>
                </div>

                <!-- 消息内容列：flex-1 占满行内剩余宽度，气泡的百分比
                     max-width 才有确定基准（宽度随内容收缩的包裹层会让
                     70% 这类百分比陷入循环解析，塌陷成最小内容宽） -->
                <div
                    class="relative flex min-w-0 flex-1 flex-col"
                    :class="message.is_self ? 'items-end' : 'items-start'"
                >
                    <p
                        class="mb-1 text-xs text-zx-text-muted"
                        v-if="!message.is_self && message.group_id"
                    >
                        {{ message.user_name || "未知用户" }}
                    </p>

                    <!-- 混合内容消息：文字与图片/语音按原始顺序混排 -->
                    <div
                        v-if="message.parts && message.parts.length > 1"
                        :class="
                            message.is_self
                                ? 'bg-zx-primary text-[color:var(--zx-color-on-primary)] rounded-br-xs'
                                : 'bg-gray-200 text-zx-text-strong rounded-bl-xs'
                        "
                        class="max-w-[min(70%,28rem)] overflow-hidden rounded-2xl"
                    >
                        <div class="px-3 py-2 text-xs sm:text-sm leading-relaxed">
                            <template
                                v-for="(part, partIndex) in message.parts"
                                :key="partIndex"
                            >
                                <img
                                    v-if="part.type === 'image'"
                                    v-image-viewer:chat
                                    :src="part.content"
                                    :class="
                                        part.sticker === 'emoji'
                                            ? 'inline-block h-[1.3em] w-[1.3em] object-contain align-middle'
                                            : part.sticker === 'sticker'
                                            ? 'inline-block max-h-[12em] max-w-full rounded-lg object-contain align-middle'
                                            : 'inline-block max-h-48 max-w-full rounded-lg object-contain align-middle'
                                    "
                                    referrerpolicy="no-referrer"
                                />
                                <audio
                                    v-else-if="part.type === 'record'"
                                    controls
                                    :src="part.content"
                                    class="inline-block h-8 max-w-56 align-middle"
                                ></audio>
                                <FaceImg
                                    v-else-if="part.type === 'face'"
                                    :id="part.content"
                                />
                                <span
                                    v-else-if="part.type === 'at'"
                                    class="mx-0.5 inline-block rounded bg-zx-primary-soft px-1 align-middle font-medium text-zx-primary"
                                >{{ part.content }}</span>
                                <span
                                    v-else
                                    class="whitespace-pre-wrap break-words align-middle"
                                >{{ part.content }}</span>
                            </template>
                        </div>
                    </div>

                    <!-- 默认表情：与文字同地位，走文字气泡里的行内小脸 -->
                    <div
                        v-else-if="
                            message.message_type === 'image' &&
                            message.sticker === 'emoji'
                        "
                        :class="
                            message.is_self
                                ? 'bg-zx-primary text-[color:var(--zx-color-on-primary)] rounded-br-xs'
                                : 'bg-gray-200 text-zx-text-strong rounded-bl-xs'
                        "
                        class="max-w-[min(70%,28rem)] overflow-hidden rounded-2xl text-xs sm:text-sm"
                        v-image-viewer:chat
                    >
                        <span class="inline-block px-3 py-2 leading-none">
                            <img
                                :src="message.message"
                                class="inline-block h-[1.3em] w-[1.3em] align-middle object-contain"
                                referrerpolicy="no-referrer"
                            />
                        </span>
                    </div>

                    <!-- 图片消息 -->
                    <div
                        v-else-if="message.message_type === 'image'"
                        :class="[
                            'overflow-hidden rounded-xl',
                            stickerBoxClass(message.sticker),
                        ]"
                        v-image-viewer:chat
                    >
                        <img
                            v-show="imageState[message.id] === 'loaded'"
                            :src="message.message"
                            :class="stickerImgClass(message.sticker)"
                            referrerpolicy="no-referrer"
                            @load="imageState[message.id] = 'loaded'"
                            @error="imageState[message.id] = 'error'"
                        />
                        <div
                            v-if="imageState[message.id] === 'error'"
                            :class="[
                                'flex items-center justify-center rounded-xl bg-gray-100',
                                stickerPhClass(message.sticker),
                            ]"
                        >
                            <div
                                v-if="message.sticker !== 'emoji'"
                                class="text-center text-zx-text-subtle"
                            >
                                <AlertCircle class="mx-auto mb-1 h-6 w-6 text-zx-warning" />
                                <span class="text-xs">图片加载失败</span>
                            </div>
                        </div>
                        <div
                            v-else-if="imageState[message.id] !== 'loaded'"
                            :class="[
                                'flex items-center justify-center rounded-xl bg-gray-100',
                                stickerPhClass(message.sticker),
                            ]"
                        >
                            <div
                                v-if="message.sticker !== 'emoji'"
                                class="text-xs text-zx-text-subtle"
                            >
                                加载中...
                            </div>
                        </div>
                    </div>

                    <!-- 语音消息 -->
                    <div
                        v-else-if="message.message_type === 'record'"
                        :class="message.is_self ? 'bg-zx-primary text-[color:var(--zx-color-on-primary)]' : 'bg-gray-200 text-zx-text-strong'"
                        class="max-w-[min(70%,28rem)] overflow-hidden rounded-2xl"
                    >
                        <div class="flex items-center gap-2 px-3 py-2 text-xs sm:text-sm">
                            <Mic class="h-4 w-4 shrink-0" />
                            <audio
                                v-if="message.message"
                                controls
                                :src="message.message"
                                class="h-8 max-w-56"
                            ></audio>
                            <span v-else>语音消息</span>
                        </div>
                    </div>

                    <!-- 视频消息 -->
                    <div
                        v-else-if="message.message_type === 'video'"
                        class="max-w-[min(70%,28rem)] overflow-hidden rounded-xl"
                    >
                        <video
                            v-if="message.message"
                            controls
                            :src="message.message"
                            class="max-h-72 max-w-full rounded-xl"
                        ></video>
                        <div
                            v-else
                            :class="message.is_self ? 'bg-zx-primary text-[color:var(--zx-color-on-primary)]' : 'bg-gray-200 text-zx-text-strong'"
                            class="flex items-center gap-2 rounded-2xl px-3 py-2 text-xs sm:text-sm"
                        >
                            <Video class="h-4 w-4 shrink-0" />
                            视频消息
                        </div>
                    </div>

                    <!-- JSON / XML 卡片数据 -->
                    <div
                        v-else-if="
                            message.message_type === 'json' ||
                            message.message_type === 'xml'
                        "
                        class="max-w-[min(70%,28rem)] overflow-hidden rounded-2xl"
                    >
                        <div class="flex items-center gap-2 px-3 pt-2 text-xs text-zx-text-muted">
                            <FileText class="h-3.5 w-3.5 shrink-0" />
                            {{ message.message_type === "json" ? "JSON 卡片" : "XML 卡片" }}
                        </div>
                        <pre
                            class="max-h-48 overflow-auto px-3 pb-2 pt-1 text-left font-mono text-[10px] leading-4 whitespace-pre-wrap text-zx-text-muted"
                        >{{
                            formatStructured(message.message)
                        }}</pre>
                    </div>

                    <!-- 合并转发卡片：点击打开聊天记录查看器 -->
                    <div
                        v-else-if="message.message_type === 'forward'"
                        class="max-w-[min(70%,28rem)] overflow-hidden rounded-2xl bg-gray-200 text-zx-text-strong"
                    >
                        <button
                            type="button"
                            class="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-black/5"
                            @click.stop="
                                selectMode
                                    ? toggleSelect(message.id)
                                    : openForward(message.message)
                            "
                        >
                            <MessagesSquare
                                class="h-8 w-8 shrink-0 rounded-lg bg-zx-primary-soft p-1.5 text-zx-primary"
                            />
                            <div class="min-w-0 flex-1">
                                <p class="text-xs sm:text-sm">聊天记录</p>
                                <p class="text-[10px] text-zx-text-muted">
                                    点击查看转发的消息
                                </p>
                            </div>
                            <ChevronRight class="h-4 w-4 shrink-0 text-zx-text-subtle" />
                        </button>
                    </div>

                    <!-- 链接 / 音乐 / 位置 卡片 -->
                    <div
                        v-else-if="
                            message.message_type === 'share' ||
                            message.message_type === 'music' ||
                            message.message_type === 'location'
                        "
                        class="max-w-[min(70%,28rem)] overflow-hidden rounded-2xl bg-gray-200 text-zx-text-strong"
                    >
                        <div class="flex items-start gap-2 px-3 py-2">
                            <Link2
                                v-if="message.message_type === 'share'"
                                class="mt-0.5 h-4 w-4 shrink-0 text-zx-text-muted"
                            />
                            <Music
                                v-else-if="message.message_type === 'music'"
                                class="mt-0.5 h-4 w-4 shrink-0 text-zx-text-muted"
                            />
                            <MapPin
                                v-else-if="message.message_type === 'location'"
                                class="mt-0.5 h-4 w-4 shrink-0 text-zx-text-muted"
                            />
                            <MessageSquare
                                v-else
                                class="mt-0.5 h-4 w-4 shrink-0 text-zx-text-muted"
                            />
                            <div class="min-w-0">
                                <p class="break-words text-xs sm:text-sm">
                                    {{
                                        message.message ||
                                        message.message_type.replace(/^\w/, (c) =>
                                            c.toUpperCase(),
                                        )
                                    }}
                                </p>
                            </div>
                        </div>
                    </div>

                    <!-- 表情消息（QQ 默认表情 face 段）：气泡内行内小脸 -->
                    <div
                        v-else-if="message.message_type === 'face'"
                        :class="
                            message.is_self
                                ? 'bg-zx-primary text-[color:var(--zx-color-on-primary)] rounded-br-xs'
                                : 'bg-gray-200 text-zx-text-strong rounded-bl-xs'
                        "
                        class="max-w-[min(70%,28rem)] overflow-hidden rounded-2xl text-xs sm:text-sm"
                    >
                        <span class="inline-block px-3 py-2 leading-none">
                            <FaceImg :id="message.message" />
                        </span>
                    </div>

                    <!-- 文本等其它消息 -->
                    <div
                        v-else
                        :class="[
                            message.is_self
                                ? 'bg-zx-primary text-[color:var(--zx-color-on-primary)] rounded-br-xs'
                                : 'bg-gray-200 text-zx-text-strong rounded-bl-xs',
                        ]"
                        class="max-w-[min(70%,28rem)] overflow-hidden rounded-2xl"
                    >
                        <p class="px-3 py-2 text-xs break-words sm:text-sm">
                            {{ message.message }}
                        </p>
                    </div>

                    <!-- 发送时间：hover 浮显，绝对定位不占布局 -->
                    <p
                        class="pointer-events-none absolute top-full z-10 mt-0.5 text-[10px] whitespace-nowrap text-zx-text-muted opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                        :class="
                            message.is_self ? 'right-0 text-right' : 'left-0 text-left'
                        "
                    >
                        {{ new Date(message.timestamp).toLocaleTimeString() }}
                    </p>
                </div>

                <!-- 自己的头像 -->
                <div
                    v-if="message.is_self"
                    class="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-zx-primary-soft text-xs font-bold text-zx-primary sm:h-10 sm:w-10 sm:text-sm"
                >
                    <img
                        v-if="message.avatar"
                        :src="message.avatar"
                        referrerpolicy="no-referrer"
                        class="h-full w-full object-cover"
                        @error="message.avatar = ''"
                    />
                    <span v-else>{{ "自" }}</span>
                </div>
            </div>
        </div>

        <!-- 回到底部：翻历史时出现 -->
        <button
            v-if="showScrollBottom"
            class="btn-touch absolute right-5 bottom-24 z-10 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white/95 text-zx-text-muted shadow-md backdrop-blur-sm transition-colors hover:text-zx-primary"
            type="button"
            title="回到底部"
            @click="scrollToBottom()"
        >
            <ArrowDown class="h-4 w-4" />
        </button>

        <!-- 多选底部操作条：仿 QQNT，覆盖输入区 -->
        <div
            v-if="selectMode"
            class="absolute inset-x-0 bottom-0 z-20 flex items-center gap-3 border-t border-slate-200 bg-white px-4 py-3"
        >
            <button
                type="button"
                class="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-zx-text-muted transition-colors hover:bg-slate-100 hover:text-zx-text"
                title="退出多选"
                @click="exitSelectMode"
            >
                <X class="h-4 w-4" />
            </button>
            <p class="min-w-0 flex-1 truncate text-sm text-zx-text">
                已选 <span class="font-semibold text-zx-primary">{{ selectedCount }}</span> 条
            </p>
            <ZxButton
                size="sm"
                :disabled="selectedCount === 0"
                @click="forwardSelected"
            >
                <CornerUpRight class="h-4 w-4" />
                转发
            </ZxButton>
        </div>

        <!-- 输入框区域：ChatComposer（工具栏图二布局，移动端工具栏在上） -->
        <ChatComposer
            v-if="selectedContact && !selectMode"
            class="mx-3 mb-3"
            :disabled="!selectedContact"
            :group-mode="selectedContact === 'group'"
            :group-members="groupMembers"
            :members-loading="membersLoading"
            show-history
            @send="onComposerSend"
            @open-history="historyOpen = true"
            @need-members="loadGroupMembers"
        />
        <!-- 历史记录弹窗 -->
        <ChatHistoryModal
            :visible="historyOpen"
            :contact-type="selectedContact"
            :contact-id="selectedId"
            :contact-name="currentContactInfo?.name ?? ''"
            @close="historyOpen = false"
        />

        <!-- 合并转发查看器 -->
        <ForwardViewer
            :visible="forwardOpen"
            :forward-id="forwardId"
            :bot-id="forwardBotId"
            :local-nodes="forwardLocalNodes"
            @close="forwardOpen = false"
        />

        <!-- 转发目标选择器 -->
        <ContactPickerModal
            :visible="pickerOpen"
            @close="pickerOpen = false"
            @pick="doForward"
        />

    </div>
</template>

<style scoped>



/* 图片按原始比例完整显示，只限制最大尺寸 */
.image-message img {
    width: auto;
    height: auto;
    max-width: 100%;
    max-height: 20rem;
}
</style>
