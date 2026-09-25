<script setup lang="ts">
/**
 * ChatComposer — 聊天输入区独立组件
 *
 * 富文本编辑器（文字/内联图片/表情/@）+ 语音附件 + 工具栏，
 * 布局对齐图二：输入在上、工具条嵌在容器底部；
 * 移动端工具条换到输入框上方（flex-col-reverse）。
 *
 * 单行全圆角、多行回落 rounded-2xl；删空后清掉 Chrome 残留行。
 */
import {
    computed,
    nextTick,
    onUnmounted,
    ref,
    watch,
    type Ref,
} from "vue";
import { onClickOutside } from "@vueuse/core";
import {
    Clock,
    Image as ImageIcon,
    Mic,
    Send,
    Smile,
    X,
} from "lucide-vue-next";
import ZxButton from "@/components/zxcomponent/ZxButton.vue";
import StickerPicker from "@/views/chat/StickerPicker.vue";
import ZxEmptyState from "@/components/zxcomponent/ZxEmptyState.vue";
import { ZXNotification } from "@/services/ui";
import { useCustomCaret } from "@/composables/useCustomCaret";
import { useVoiceRecorder } from "@/composables/useVoiceRecorder";
import { type StickerItem } from "@/utils/stickers";
import { qqntLocalFallback } from "@/utils/stickers-qqnt";
import { faceCdnUrl } from "@/utils/qq-face";
import type { StickerKind } from "@/types";

export interface OutgoingPart {
    type: "text" | "image" | "record" | "face" | "at";
    content: string;
    sticker?: StickerKind;
    /** at 段的显示名（仅本地回显用） */
    name?: string;
}

export interface GroupMemberLite {
    user_id: string | number;
    nickname?: string;
    remark?: string;
    ava_url?: string;
}

const props = withDefaults(
    defineProps<{
        /** 无选中联系人时禁用发送 */
        disabled?: boolean;
        /** 群聊：支持 @ 提及 */
        groupMode?: boolean;
        groupMembers?: GroupMemberLite[];
        membersLoading?: boolean;
        /** 工具栏右侧历史按钮 */
        showHistory?: boolean;
        placeholder?: string;
    }>(),
    {
        disabled: false,
        groupMode: false,
        groupMembers: () => [],
        membersLoading: false,
        showHistory: false,
        placeholder: "输入消息，按 Enter 发送",
    },
);

const emit = defineEmits<{
    send: [parts: OutgoingPart[]];
    "open-history": [];
    /** 输入 @ 时请求拉取群成员 */
    "need-members": [];
}>();

// ==================== 编辑器 ====================
const editorRef = ref<HTMLElement | null>(null);
/** 多行时全圆角会拉成胶囊，回落到卡片级圆角 */
const editorGrown = ref(false);
const imageBase64Map = new Map<string, string>();

useCustomCaret(editorRef);

const isBlankText = (s: string) =>
    !s.replace(/[\\s\\u200B\\u200C\\u200D\\uFEFF]/g, "").length;

const hasMeaningfulContent = (node: Node): boolean => {
    if (node.nodeType === Node.TEXT_NODE) {
        return !isBlankText(node.textContent ?? "");
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return false;
    const el = node as HTMLElement;
    if (el.tagName === "BR") return false;
    if (el.tagName === "IMG") return true;
    return Array.from(el.childNodes).some(hasMeaningfulContent);
};

/** 删空后清掉 Chrome 残留 <br>/空行块，并同步单行/多行圆角 */
const syncEditorState = () => {
    const el = editorRef.value;
    if (!el) return;
    if (el.childNodes.length && !Array.from(el.childNodes).some(hasMeaningfulContent)) {
        el.innerHTML = "";
        const sel = window.getSelection();
        if (sel && document.activeElement === el) {
            const range = document.createRange();
            range.setStart(el, 0);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
        }
    }
    editorGrown.value = el.scrollHeight > 40;
};

const clearEditor = () => {
    if (editorRef.value) editorRef.value.innerHTML = "";
    imageBase64Map.clear();
    editorGrown.value = false;
};

// ==================== 插入 ====================
const EDITOR_STICKER_STYLE: Record<StickerKind, string> = {
    emoji: "width:1.3em;height:1.3em;vertical-align:middle;object-fit:contain;",
    sticker:
        "max-height:6em;max-width:100%;width:auto;height:auto;object-fit:contain;",
};

const insertInlineImage = (dataUrl: string, kind?: StickerKind) => {
    const editor = editorRef.value;
    if (!editor) return;
    editor.focus();
    imageBase64Map.set(dataUrl, dataUrl.split(",")[1] ?? "");
    if (!kind) {
        let inserted = false;
        try {
            inserted = document.execCommand("insertImage", false, dataUrl);
        } catch {
            inserted = false;
        }
        if (!inserted) {
            const img = document.createElement("img");
            img.src = dataUrl;
            editor.appendChild(img);
        }
        syncEditorState();
        return;
    }
    const img = document.createElement("img");
    img.src = dataUrl;
    img.setAttribute("data-sticker", kind);
    img.style.cssText = EDITOR_STICKER_STYLE[kind];
    const sel = window.getSelection();
    if (sel && sel.rangeCount && editor.contains(sel.anchorNode)) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        range.insertNode(img);
        range.setStartAfter(img);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
    } else {
        editor.appendChild(img);
    }
    syncEditorState();
};

const insertFaceToken = (id: string) => {
    const editor = editorRef.value;
    if (!editor) return;
    editor.focus();
    const img = document.createElement("img");
    img.src = faceCdnUrl(id);
    img.setAttribute("data-face", id);
    img.style.cssText =
        "width:1.3em;height:1.3em;vertical-align:middle;object-fit:contain;";
    img.addEventListener("error", () => {
        img.src = `/zhenxun/api/v1/sticker/qq/${id}.png`;
    });
    const sel = window.getSelection();
    if (sel && sel.rangeCount && editor.contains(sel.anchorNode)) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        range.insertNode(img);
        range.setStartAfter(img);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
    } else {
        editor.appendChild(img);
    }
    syncEditorState();
};

const insertAtToken = (id: string, name: string) => {
    const editor = editorRef.value;
    if (!editor) return;
    editor.focus();
    const chip = document.createElement("span");
    chip.setAttribute("data-at", id);
    chip.setAttribute("data-at-name", name);
    chip.setAttribute("contenteditable", "false");
    chip.className =
        "mx-0.5 inline-block select-none rounded bg-zx-primary-soft px-1 font-medium text-zx-primary";
    chip.textContent = `@${name}`;
    const space = document.createTextNode(" ");
    const sel = window.getSelection();
    if (sel && sel.rangeCount && editor.contains(sel.anchorNode)) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        range.insertNode(space);
        range.insertNode(chip);
        range.setStartAfter(space);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
    } else {
        editor.appendChild(chip);
        editor.appendChild(space);
    }
    closeMention();
    syncEditorState();
};

const insertText = (text: string) => {
    const editor = editorRef.value;
    if (!editor) return;
    editor.focus();
    let inserted = false;
    try {
        inserted = document.execCommand("insertText", false, text);
    } catch {
        inserted = false;
    }
    if (!inserted) {
        editor.appendChild(document.createTextNode(text));
    }
    syncEditorState();
};

// ==================== 图片：选择 / 粘贴 / 拖拽 ====================
const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

const enqueueImages = async (files: File[]) => {
    for (const file of files) {
        if (!file.type.startsWith("image/")) continue;
        insertInlineImage(await fileToBase64(file));
    }
};

const imageInput = ref<HTMLInputElement | null>(null);
const triggerImageUpload = () => imageInput.value?.click();

const handleImageSelect = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    await enqueueImages(Array.from(input.files ?? []));
    input.value = "";
};

const handlePaste = async (event: ClipboardEvent) => {
    const clipboard = event.clipboardData;
    const files = Array.from(clipboard?.files ?? []).filter((file) =>
        file.type.startsWith("image/"),
    );
    if (files.length) {
        event.preventDefault();
        await enqueueImages(files);
        return;
    }
    const text = clipboard?.getData("text/plain");
    if (text) {
        event.preventDefault();
        document.execCommand("insertText", false, text);
    }
};

let dragDepth = 0;
const dragOver = ref(false);
const handleDragEnter = () => {
    dragDepth += 1;
    dragOver.value = true;
};
const handleDragLeave = () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) dragOver.value = false;
};
const handleDrop = async (event: DragEvent) => {
    dragDepth = 0;
    dragOver.value = false;
    event.preventDefault();
    await enqueueImages(
        Array.from(event.dataTransfer?.files ?? []).filter((file) =>
            file.type.startsWith("image/"),
        ),
    );
};

// ==================== 表情 ====================
const stickerOpen = ref(false);

const handleSelectSticker = async (
    sticker: StickerItem,
    kind: StickerKind = "sticker",
) => {
    if (sticker.type === "emoji") {
        insertText(sticker.name || sticker.path);
        return;
    }
    if (kind === "emoji" && sticker.faceId) {
        insertFaceToken(sticker.faceId);
        return;
    }
    const sources = [sticker.path];
    const fb = sticker.fallback || qqntLocalFallback(sticker.path);
    if (fb) sources.push(fb);
    for (let i = 0; i < sources.length; i++) {
        try {
            const res = await fetch(sources[i]);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const blob = await res.blob();
            const reader = new FileReader();
            reader.onloadend = () => {
                if (typeof reader.result === "string") {
                    insertInlineImage(reader.result, kind);
                }
            };
            reader.readAsDataURL(blob);
            return;
        } catch (e) {
            if (i === sources.length - 1) console.error("加载表情包失败:", e);
        }
    }
};

// ==================== @ 提及 ====================
const atOpen = ref(false);
const atRef = ref<HTMLElement | null>(null);
const atKeyword = ref("");
const mentionActive = ref(false);
const mentionIndex = ref(0);
const mentionPos = ref({ x: 0, y: 0 });
const mentionListRef = ref<HTMLElement | null>(null);

const displayName = (m: GroupMemberLite) =>
    m.remark || m.nickname || String(m.user_id);

const atList = computed(() => {
    const kw = atKeyword.value.trim().toLowerCase();
    return props.groupMembers
        .filter(
            (m) =>
                !kw ||
                displayName(m).toLowerCase().includes(kw) ||
                String(m.user_id).includes(kw),
        )
        .slice(0, 60);
});

onClickOutside(atRef, () => {
    atOpen.value = false;
});

watch(mentionIndex, () => {
    nextTick(() => {
        mentionListRef.value
            ?.querySelectorAll("button")[mentionIndex.value]
            ?.scrollIntoView({ block: "nearest" });
    });
});

const getTrailingMentionQuery = (): string | null => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    const range = sel.getRangeAt(0);
    if (!range.collapsed) return null;
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return null;
    const before = (node.textContent ?? "").slice(0, range.startOffset);
    const m = /@([^\s@]*)$/.exec(before);
    return m ? m[1] : null;
};

const updateMentionPos = () => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    if (rect && (rect.left || rect.top)) {
        mentionPos.value = { x: rect.left, y: rect.top };
    } else {
        const box = editorRef.value?.getBoundingClientRect();
        if (box) mentionPos.value = { x: box.left + 12, y: box.top };
    }
};

const mentionLeft = computed(() => {
    const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
    return Math.max(8, Math.min(mentionPos.value.x, vw - 248));
});

const deleteTrailingMention = () => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return;
    const offset = range.startOffset;
    const before = (node.textContent ?? "").slice(0, offset);
    const m = /@[^\s@]*$/.exec(before);
    if (!m) return;
    const del = document.createRange();
    del.setStart(node, offset - m[0].length);
    del.setEnd(node, offset);
    del.deleteContents();
    del.collapse(true);
    sel.removeAllRanges();
    sel.addRange(del);
};

const closeMention = () => {
    atOpen.value = false;
    mentionActive.value = false;
};

const stepMention = (delta: number) => {
    const len = atList.value.length;
    if (!len) return;
    mentionIndex.value = (mentionIndex.value + delta + len) % len;
};

const pickAt = (m: GroupMemberLite) => {
    if (mentionActive.value) deleteTrailingMention();
    insertAtToken(String(m.user_id), displayName(m));
    mentionActive.value = false;
};

const onEditorInput = async () => {
    syncEditorState();
    const q = getTrailingMentionQuery();
    if (q !== null && props.groupMode) {
        atKeyword.value = q;
        mentionActive.value = true;
        mentionIndex.value = 0;
        updateMentionPos();
        if (!atOpen.value) {
            atOpen.value = true;
            emit("need-members");
        }
    } else if (mentionActive.value) {
        closeMention();
    }
};

const onEditorKeydown = (e: KeyboardEvent) => {
    if (atOpen.value && atList.value.length > 0) {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            stepMention(1);
            return;
        }
        if (e.key === "ArrowUp") {
            e.preventDefault();
            stepMention(-1);
            return;
        }
        if (e.key === "Enter" && !e.isComposing) {
            e.preventDefault();
            pickAt(atList.value[mentionIndex.value]);
            return;
        }
        if (e.key === "Escape") {
            e.preventDefault();
            closeMention();
            return;
        }
    }
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        handleSend();
    }
};

// ==================== 语音 ====================
const voiceItems = ref<
    { id: number; dataUrl: string; base64: string; duration: number }[]
>([]);
let voiceSeq = 0;

const removeVoiceItem = (id: number) => {
    voiceItems.value = voiceItems.value.filter((item) => item.id !== id);
};

const {
    recording: voiceRecording,
    duration: voiceDuration,
    start: startRecording,
    stop: stopRecording,
} = useVoiceRecorder();

const toggleRecord = async () => {
    if (voiceRecording.value) {
        const result = await stopRecording();
        if (result?.base64) {
            voiceItems.value.push({
                id: ++voiceSeq,
                dataUrl: result.dataUrl,
                base64: result.base64,
                duration: result.duration,
            });
        } else if (!result) {
            ZXNotification({
                title: "录音失败",
                message: "这段语音没能录下来，再试一次吧",
                type: "error",
                position: "top-right",
            });
        }
        return;
    }
    const ok = await startRecording();
    if (!ok) {
        ZXNotification({
            title: "无法录音",
            message: "没有拿到麦克风权限",
            type: "error",
            position: "top-right",
        });
    }
};

// ==================== 抽取与发送 ====================
interface EditorPiece {
    type: "text" | "image" | "at";
    text?: string;
    dataUrl?: string;
    sticker?: StickerKind;
    face?: string;
    atId?: string;
    atName?: string;
}

const extractEditor = (): EditorPiece[] => {
    const pieces: EditorPiece[] = [];
    const walk = (node: Node) => {
        if (node.nodeType === Node.TEXT_NODE) {
            pieces.push({ type: "text", text: node.textContent ?? "" });
            return;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        const el = node as HTMLElement;
        const atId = el.getAttribute?.("data-at");
        if (atId != null) {
            pieces.push({
                type: "at",
                atId,
                atName: el.getAttribute("data-at-name") || atId,
            });
            return;
        }
        if (el.tagName === "IMG") {
            const face = el.getAttribute("data-face");
            if (face) {
                pieces.push({ type: "image", dataUrl: "", face });
                return;
            }
            const sticker = el.getAttribute("data-sticker");
            pieces.push({
                type: "image",
                dataUrl: el.getAttribute("src") ?? "",
                sticker:
                    sticker === "emoji" || sticker === "sticker"
                        ? sticker
                        : undefined,
            });
            return;
        }
        if (el.tagName === "BR") {
            pieces.push({ type: "text", text: "\n" });
            return;
        }
        if (el.tagName === "DIV" || el.tagName === "P") {
            pieces.push({ type: "text", text: "\n" });
        }
        Array.from(el.childNodes).forEach(walk);
    };
    Array.from(editorRef.value?.childNodes ?? []).forEach(walk);
    return pieces;
};

const buildOutgoingParts = (): OutgoingPart[] => {
    const parts: OutgoingPart[] = [];
    for (const piece of extractEditor()) {
        if (piece.type === "text") {
            const text = piece.text ?? "";
            if (!text) continue;
            const last = parts[parts.length - 1];
            if (last && last.type === "text") last.content += text;
            else parts.push({ type: "text", content: text });
        } else if (piece.type === "at" && piece.atId) {
            parts.push({ type: "at", content: piece.atId, name: piece.atName });
        } else if (piece.face) {
            parts.push({ type: "face", content: piece.face });
        } else if (piece.dataUrl) {
            parts.push({
                type: "image",
                content: `base64://${
                    imageBase64Map.get(piece.dataUrl) ??
                    piece.dataUrl.split(",")[1] ??
                    ""
                }`,
                sticker: piece.sticker,
            });
        }
    }
    for (const voice of voiceItems.value) {
        parts.push({ type: "record", content: `base64://voice/${voice.base64}` });
    }
    return parts;
};

let lastSendAt = 0;
const handleSend = () => {
    if (props.disabled) return;
    if (Date.now() - lastSendAt < 600) return;
    const parts = buildOutgoingParts();
    const hasContent = parts.some(
        (part) => part.type !== "text" || part.content.trim(),
    );
    if (!hasContent) {
        ZXNotification({
            title: "提示",
            message: "消息不能为空",
            type: "info",
            position: "top-right",
        });
        return;
    }
    lastSendAt = Date.now();
    emit("send", parts);
    clearEditor();
    voiceItems.value = [];
};

defineExpose({
    editorRef,
    focus: () => editorRef.value?.focus(),
    clear: clearEditor,
    insertInlineImage,
    insertFaceToken,
    insertAtToken,
});

onUnmounted(() => {
    stickerOpen.value = false;
});
</script>

<template>
    <div
        class="flex flex-col rounded-2xl border border-slate-200 bg-white px-2.5 py-2 shadow-2xs"
        @dragenter.prevent="handleDragEnter"
        @dragover.prevent
        @dragleave="handleDragLeave"
        @drop.prevent="handleDrop"
    >
        <!-- 语音附件 -->
        <div
            v-if="voiceItems.length || voiceRecording"
            class="mb-2 flex items-center gap-2 overflow-x-auto"
        >
            <div
                v-for="item in voiceItems"
                :key="item.id"
                class="flex shrink-0 items-center gap-2 rounded-xl bg-slate-100 px-2.5 py-1.5"
            >
                <Mic class="h-4 w-4 shrink-0 text-zx-primary" />
                <audio controls :src="item.dataUrl" class="h-8 max-w-44"></audio>
                <span class="shrink-0 text-xs text-zx-text-subtle">
                    {{ item.duration }}s
                </span>
                <button
                    type="button"
                    class="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full text-zx-text-subtle transition-colors hover:bg-zx-danger-soft hover:text-zx-danger"
                    title="移除"
                    @click="removeVoiceItem(item.id)"
                >
                    <X class="h-3 w-3" />
                </button>
            </div>
            <div
                v-if="voiceRecording"
                class="flex shrink-0 items-center gap-2 rounded-xl bg-zx-danger-soft px-3 py-1.5"
            >
                <span class="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500"></span>
                <span class="text-xs font-semibold text-red-500">
                    录音中 {{ voiceDuration }}s
                </span>
            </div>
        </div>

        <!-- 移动端工具栏在上，桌面端在下 -->
        <div class="flex flex-col-reverse gap-2 sm:flex-col">
            <!-- 富文本编辑区 -->
            <div class="relative">
                <div
                    ref="editorRef"
                    contenteditable="true"
                    :data-placeholder="placeholder"
                    class="rich-editor max-h-32 min-h-9 overflow-y-auto px-1.5 py-[7px] text-sm leading-5 text-zx-text whitespace-pre-wrap break-words focus:outline-none"
                    :class="editorGrown ? 'rounded-2xl' : 'rounded-full'"
                    @input="onEditorInput"
                    @keydown="onEditorKeydown"
                    @paste="handlePaste"
                ></div>

                <!-- 拖拽提示 -->
                <div
                    v-if="dragOver"
                    class="pointer-events-none absolute inset-0 z-10 rounded-2xl border-2 border-dashed border-zx-primary bg-white/80 py-4 text-center text-xs font-semibold text-zx-primary"
                >
                    松开把图片插入输入框
                </div>
            </div>

            <!-- 工具栏：左操作 / 右发送（图二布局） -->
            <div class="flex items-center gap-1.5">
                <div class="flex items-center gap-0.5">
                    <ZxButton
                        variant="ghost"
                        circle
                        size="sm"
                        title="插入图片"
                        @click="triggerImageUpload"
                    >
                        <ImageIcon class="h-4 w-4" />
                    </ZxButton>
                    <input
                        ref="imageInput"
                        type="file"
                        accept="image/*"
                        multiple
                        class="hidden"
                        @change="handleImageSelect"
                    />

                    <div class="relative">
                        <button
                            type="button"
                            :class="
                                stickerOpen
                                    ? 'bg-pink-100 text-pink-600'
                                    : 'text-zx-text-subtle hover:bg-slate-100 hover:text-zx-text-muted'
                            "
                            class="btn-touch flex h-8 w-8 flex-shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors"
                            title="表情与表情包"
                            @click="stickerOpen = !stickerOpen"
                        >
                            <Smile class="h-4 w-4" />
                        </button>
                        <StickerPicker
                            v-model="stickerOpen"
                            @select="handleSelectSticker"
                        />
                    </div>

                    <button
                        type="button"
                        :class="
                            voiceRecording
                                ? 'bg-red-500 text-white'
                                : 'text-zx-text-subtle hover:bg-slate-100 hover:text-zx-text-muted'
                        "
                        class="btn-touch flex h-8 w-8 flex-shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors"
                        :title="
                            voiceRecording
                                ? `停止录音（${voiceDuration}s）`
                                : '录制语音'
                        "
                        @click="toggleRecord"
                    >
                        <Mic :class="voiceRecording ? 'animate-pulse' : ''" class="h-4 w-4" />
                    </button>

                    <!-- 宿主自定义工具（如模拟端图片 URL） -->
                    <slot name="tools" />
                </div>

                <div class="ml-auto flex items-center gap-1.5">
                    <ZxButton
                        v-if="showHistory"
                        variant="ghost"
                        circle
                        size="sm"
                        title="历史记录"
                        @click="emit('open-history')"
                    >
                        <Clock class="h-4 w-4" />
                    </ZxButton>
                    <ZxButton
                        size="sm"
                        :disabled="disabled"
                        class="gap-1"
                        @click="handleSend"
                    >
                        <Send class="h-3.5 w-3.5" />
                        发送
                    </ZxButton>
                </div>
            </div>
        </div>

        <!-- @ 提及浮层 -->
        <Teleport to="body">
            <div
                v-if="atOpen && groupMode"
                ref="atRef"
                class="fixed z-[9999] w-60 select-none overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
                :style="{
                    left: mentionLeft + 'px',
                    top: mentionPos.y - 8 + 'px',
                    transform: 'translateY(-100%)',
                }"
                @contextmenu.prevent.stop
                @selectstart.prevent
            >
                <div
                    ref="mentionListRef"
                    class="flex max-h-60 flex-col gap-1 overflow-y-auto p-1.5"
                >
                    <div
                        v-if="membersLoading"
                        class="px-3 py-4 text-center text-xs text-zx-text-muted"
                    >
                        加载成员中…
                    </div>
                    <ZxEmptyState
                        v-else-if="atList.length === 0"
                        size="sm"
                        text="没有匹配的成员"
                    />
                    <button
                        v-for="(m, i) in atList"
                        :key="m.user_id"
                        type="button"
                        class="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2 py-1.5 text-left"
                        :class="
                            i === mentionIndex
                                ? 'bg-zx-primary-soft'
                                : 'hover:bg-zx-primary-soft/60'
                        "
                        @mousedown.prevent
                        @click="pickAt(m)"
                    >
                        <img
                            v-if="m.ava_url"
                            :src="m.ava_url"
                            class="h-7 w-7 shrink-0 rounded-full bg-slate-100 object-cover"
                            referrerpolicy="no-referrer"
                        />
                        <span
                            v-else
                            class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zx-primary-soft text-xs text-zx-primary"
                        >
                            {{ displayName(m).charAt(0) || "?" }}
                        </span>
                        <span class="min-w-0 flex-1 truncate text-sm text-zx-text">
                            {{ displayName(m) }}
                        </span>
                    </button>
                </div>
            </div>
        </Teleport>
    </div>
</template>

<style scoped>
.rich-editor :deep(img) {
    display: inline-block;
    max-height: 6rem;
    max-width: 12rem;
    margin: 0 2px;
    border-radius: 0.5rem;
    vertical-align: text-bottom;
}

.rich-editor {
    caret-color: transparent;
    white-space: pre-wrap;
    overflow-wrap: break-word;
    word-break: break-word;
    height: auto;
    min-height: 2.25rem;
}

.rich-editor:empty::before {
    content: attr(data-placeholder);
    color: var(--zx-color-text-subtle, #94a3b8);
    pointer-events: none;
}
</style>
