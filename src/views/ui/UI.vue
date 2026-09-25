<script setup lang="ts">
import {
    computed,
    nextTick,
    onMounted,
    onUnmounted,
    ref,
    watch,
} from "vue";
import { useRoute, useRouter } from "vue-router";
import {
    ArrowLeft,
    ArrowRight,
    ChevronDown,
    ChevronRight,
    Search,
} from "lucide-vue-next";

// 组件模块独立拆分引用
import ColorTokensDoc from "./components/ColorTokensDoc.vue";
import TagDoc from "./components/TagDoc.vue";
import ButtonDoc from "./components/ButtonDoc.vue";
import AvatarDoc from "./components/AvatarDoc.vue";
import SegmentedDoc from "./components/SegmentedDoc.vue";
import InputDoc from "./components/InputDoc.vue";
import InputNumberDoc from "./components/InputNumberDoc.vue";
import SelectDoc from "./components/SelectDoc.vue";
import DropdownMenuDoc from "./components/DropdownMenuDoc.vue";
import DatePickerDoc from "./components/DatePickerDoc.vue";
import SwitchDoc from "./components/SwitchDoc.vue";
import EditorDoc from "./components/EditorDoc.vue";
import NotificationDoc from "./components/NotificationDoc.vue";
import ConfettiDoc from "./components/ConfettiDoc.vue";
import MessageBoxDoc from "./components/MessageBoxDoc.vue";
import ModalDoc from "./components/ModalDoc.vue";
import ContextMenuDoc from "./components/ContextMenuDoc.vue";
import EmptyStateDoc from "./components/EmptyStateDoc.vue";
import PaginationDoc from "./components/PaginationDoc.vue";
import ImageViewerDoc from "./components/ImageViewerDoc.vue";

const route = useRoute();
const router = useRouter();

interface DocItem {
    id: string;
    label: string;
    componentName: string;
    en: string;
    desc: string;
}

interface DocGroup {
    title: string;
    items: DocItem[];
}

const navGroups: DocGroup[] = [
    {
        title: "基础规范 Foundation",
        items: [
            {
                id: "token-color",
                label: "色彩规范",
                componentName: "Tokens",
                en: "Color Tokens",
                desc: "全局 8 大语义色标准规范与暗色反转定义。",
            },
            {
                id: "zx-tag",
                label: "徽标组件",
                componentName: "ZxTag",
                en: "Tag & Badge",
                desc: "高饱和实底搭配纯白高对比字规范徽标。",
            },
        ],
    },
    {
        title: "通用组件 General",
        items: [
            {
                id: "button",
                label: "按钮组件",
                componentName: "ZxButton",
                en: "Button",
                desc: "全站统一胶囊按钮，内置微压反馈与禁用态。",
            },
            {
                id: "avatar",
                label: "头像组件",
                componentName: "ZxAvatar",
                en: "Avatar",
                desc: "统一头像加载、QQ 号直连与缺省图标兜底。",
            },
            {
                id: "segmented",
                label: "分段器组件",
                componentName: "ZxSegmented",
                en: "Segmented Control",
                desc: "统一 Tab 切换与时间粒度/周期筛选。",
            },
        ],
    },
    {
        title: "表单组件 Form",
        items: [
            {
                id: "input",
                label: "输入框组件",
                componentName: "ZXInput",
                en: "Input & Search",
                desc: "文本输入组件与全站通用圆角搜索胶囊。",
            },
            {
                id: "input-number",
                label: "数字步进器",
                componentName: "ZxInputNumber",
                en: "Input Number",
                desc: "带加减步进的数字输入框，边界钳制与精度控制。",
            },
            {
                id: "select",
                label: "下拉选择组件",
                componentName: "ZXSelect",
                en: "Select",
                desc: "现代化下拉选择器，item-aligned 值对齐与纯粹实色高亮。",
            },
            {
                id: "datepicker",
                label: "日期选择组件",
                componentName: "MiniDatePicker",
                en: "Date Picker",
                desc: "轻量微型日历与全功能日期时间选择面板，支持滚轮联动与时区。",
            },
            {
                id: "switch",
                label: "开关组件",
                componentName: "Switch",
                en: "Switch",
                desc: "原生 checkbox 打造的高性能轻量开关。",
            },
            {
                id: "editor",
                label: "代码编辑器组件",
                componentName: "ZXTextEditor",
                en: "Text Editor",
                desc: "轻量代码与配置编辑器，支持多种语言高亮提示。",
            },
        ],
    },
    {
        title: "反馈组件 Feedback",
        items: [
            {
                id: "notification",
                label: "通知组件",
                componentName: "ZXNotification",
                en: "Notification",
                desc: "全局统一通知交互系统，支持无标题轻量通知与 3D 堆叠。",
            },
            {
                id: "confetti",
                label: "彩带特效组件",
                componentName: "ZXConfetti",
                en: "Confetti",
                desc: "自挂载特效组件，爆开彩色纸屑粒子动效。",
            },
            {
                id: "messagebox",
                label: "确认框组件",
                componentName: "ZXMessageBox",
                en: "Message Box",
                desc: "函数式确认弹窗，支持危险操作二次确认。",
            },
            {
                id: "modal",
                label: "模态窗组件",
                componentName: "ZxModal",
                en: "Modal Dialog",
                desc: "统一全站弹窗规范，内置平滑进出场动效与遮罩。",
            },
            {
                id: "contextmenu",
                label: "右键菜单组件",
                componentName: "ContextMenu",
                en: "Context Menu",
                desc: "全局接管右键菜单，划词选中自动附加复制项。",
            },
        ],
    },
    {
        title: "导航与菜单 Navigation",
        items: [
            {
                id: "dropdown-menu",
                label: "下拉菜单组件",
                componentName: "ZXDropdownMenu",
                en: "Dropdown Menu",
                desc: "桌面应用菜单栏与动作指令独立菜单，支持多级级联、快捷键与状态勾选。",
            },
            {
                id: "pagination",
                label: "分页器组件",
                componentName: "ZxPagination",
                en: "Pagination",
                desc: "统一表格与列表翻页器，统一条目汇总文案。",
            },
        ],
    },
    {
        title: "展示组件 Display",
        items: [
            {
                id: "empty-state",
                label: "空状态组件",
                componentName: "ZxEmptyState",
                en: "Empty State",
                desc: "统一全站缺省占位、图标规格与引导插槽。",
            },
            {
                id: "image-viewer",
                label: "图片查看器",
                componentName: "ZxImageViewer",
                en: "Image Viewer",
                desc: "多图预览、缩放旋转拖拽，支持指令与程序式打开。",
            },
        ],
    },
];

const docComponentMap: Record<string, any> = {
    "token-color": ColorTokensDoc,
    "zx-tag": TagDoc,
    button: ButtonDoc,
    avatar: AvatarDoc,
    segmented: SegmentedDoc,
    input: InputDoc,
    "input-number": InputNumberDoc,
    select: SelectDoc,
    "dropdown-menu": DropdownMenuDoc,
    datepicker: DatePickerDoc,
    switch: SwitchDoc,
    editor: EditorDoc,
    notification: NotificationDoc,
    confetti: ConfettiDoc,
    messagebox: MessageBoxDoc,
    modal: ModalDoc,
    contextmenu: ContextMenuDoc,
    "empty-state": EmptyStateDoc,
    pagination: PaginationDoc,
    "image-viewer": ImageViewerDoc,
};

const flatItems = computed(() => navGroups.flatMap((g) => g.items));

// 当前激活的组件 ID
const activeId = ref(
    typeof route.query.comp === "string" &&
        flatItems.value.some((i) => i.id === route.query.comp)
        ? (route.query.comp as string)
        : "token-color",
);

watch(
    () => route.query.comp,
    (newComp) => {
        if (
            newComp &&
            typeof newComp === "string" &&
            flatItems.value.some((i) => i.id === newComp)
        ) {
            activeId.value = newComp;
        }
    },
);

const currentItem = computed(() => {
    return (
        flatItems.value.find((i) => i.id === activeId.value) ||
        flatItems.value[0]
    );
});

const currentDocComponent = computed(() => {
    return docComponentMap[activeId.value] || ColorTokensDoc;
});

const currentIndex = computed(() => {
    return flatItems.value.findIndex((i) => i.id === activeId.value);
});

const prevItem = computed(() => {
    const idx = currentIndex.value;
    return idx > 0 ? flatItems.value[idx - 1] : null;
});

const nextItem = computed(() => {
    const idx = currentIndex.value;
    return idx >= 0 && idx < flatItems.value.length - 1
        ? flatItems.value[idx + 1]
        : null;
});

const mainScrollRef = ref<HTMLElement | null>(null);

const switchComponent = (id: string) => {
    activeId.value = id;
    router.replace({ query: { ...route.query, comp: id } });
    mainScrollRef.value?.scrollTo({ top: 0, behavior: "smooth" });
};

// 侧边栏折叠状态
const collapsedGroups = ref<Record<string, boolean>>({});
const toggleGroup = (title: string) => {
    collapsedGroups.value[title] = !collapsedGroups.value[title];
};

// 快捷搜索过滤逻辑
const searchQuery = ref("");
const searchInputRef = ref<HTMLInputElement | null>(null);

const filteredNavGroups = computed(() => {
    const q = searchQuery.value.trim().toLowerCase();
    if (!q) return navGroups;
    return navGroups
        .map((g) => ({
            ...g,
            items: g.items.filter(
                (i) =>
                    i.label.toLowerCase().includes(q) ||
                    i.componentName.toLowerCase().includes(q) ||
                    i.en.toLowerCase().includes(q),
            ),
        }))
        .filter((g) => g.items.length > 0);
});

// 动态提取页面内 H2 标题作为 shadcn 风格的 CONTENTS 目录
const dynamicTocList = ref<{ id: string; title: string }[]>([]);
const activeHeading = ref<string>("");
let scrollObserver: IntersectionObserver | null = null;

const setupScrollSpy = () => {
    if (scrollObserver) {
        scrollObserver.disconnect();
    }
    const headings = document.querySelectorAll("main h2");
    if (!headings.length || !mainScrollRef.value) return;

    scrollObserver = new IntersectionObserver(
        (entries) => {
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    const id =
                        entry.target.closest("[id]")?.id || entry.target.id;
                    if (id) {
                        activeHeading.value = id;
                        break;
                    }
                }
            }
        },
        {
            root: mainScrollRef.value,
            rootMargin: "0px 0px -70% 0px",
            threshold: 0.1,
        },
    );

    headings.forEach((h) => scrollObserver?.observe(h));
};

const updateToc = () => {
    nextTick(() => {
        const headings = Array.from(
            document.querySelectorAll("main h2"),
        ) as HTMLElement[];
        dynamicTocList.value = headings
            .map((h, i) => {
                const text = h.innerText.replace(/#$/, "").trim();
                let id = h.closest("[id]")?.id || h.id;
                if (!id) {
                    id = `section-${i}`;
                    h.id = id;
                }
                return { id, title: text };
            })
            .filter((item) => !!item.title);

        if (dynamicTocList.value.length > 0) {
            activeHeading.value = dynamicTocList.value[0].id;
        }
        setupScrollSpy();
    });
};

const scrollToSection = (id: string) => {
    activeHeading.value = id;
    const el = document.getElementById(id);
    if (el && mainScrollRef.value) {
        const mainRect = mainScrollRef.value.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const targetScrollTop =
            mainScrollRef.value.scrollTop + (elRect.top - mainRect.top) - 16;
        mainScrollRef.value.scrollTo({
            top: targetScrollTop,
            behavior: "smooth",
        });
    }
};

const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.value?.focus();
    }
};

watch(activeId, () => {
    updateToc();
});

onMounted(() => {
    window.addEventListener("keydown", handleKeyDown);
    updateToc();
});

onUnmounted(() => {
    window.removeEventListener("keydown", handleKeyDown);
    if (scrollObserver) {
        scrollObserver.disconnect();
    }
});
</script>

<template>
    <div class="h-screen w-screen overflow-hidden flex bg-white text-slate-800">
        <!-- 左侧边栏 (无背景、无边框、无真寻UI标题，自身固定独立) -->
        <aside
            class="w-56 shrink-0 h-screen overflow-y-auto py-6 px-4 select-none flex flex-col"
        >
            <!-- 搜索框 (对齐极简无边框设计) -->
            <div class="relative mb-4">
                <Search
                    class="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 pointer-events-none"
                />
                <input
                    ref="searchInputRef"
                    v-model="searchQuery"
                    type="text"
                    placeholder="Search components..."
                    class="w-full h-7 pl-7 pr-7 rounded-md border border-slate-200/80 bg-slate-50/50 text-xs text-slate-800 placeholder:text-zx-text-subtle focus:outline-none focus:border-slate-400 focus:bg-white transition-all shadow-2xs"
                />
                <kbd
                    class="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] font-mono text-slate-400 bg-slate-100 px-1 py-0.2 rounded border border-slate-200/80"
                >
                    ⌘K
                </kbd>
            </div>

            <!-- 折叠分组列表 (带英文命名如 反馈组件 Feedback) -->
            <div class="flex-1 overflow-y-auto space-y-3 pr-0.5">
                <div
                    v-for="group in filteredNavGroups"
                    :key="group.title"
                >
                    <!-- 折叠标题行 -->
                    <div
                        class="flex items-center justify-between px-1.5 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-600 transition-colors select-none"
                        @click="toggleGroup(group.title)"
                    >
                        <span>{{ group.title }}</span>
                        <ChevronDown
                            class="h-3 w-3 transition-transform duration-200 text-slate-400"
                            :class="{ '-rotate-90 text-slate-300': collapsedGroups[group.title] }"
                        />
                    </div>
                    <!-- 分组子项 -->
                    <div
                        v-show="!collapsedGroups[group.title]"
                        class="space-y-0.5 mt-0.5"
                    >
                        <button
                            v-for="item in group.items"
                            :key="item.id"
                            type="button"
                            class="btn-touch group flex w-full cursor-pointer items-center justify-between rounded-md px-2 py-1 text-left text-xs transition-colors"
                            :class="
                                activeId === item.id
                                    ? 'bg-zx-primary-soft text-zx-primary font-semibold'
                                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                            "
                            @click="switchComponent(item.id)"
                        >
                            <div class="flex items-center gap-1.5 truncate">
                                <span>{{ item.label }}</span>
                                <span
                                    v-if="item.componentName !== 'Tokens'"
                                    class="font-mono text-[10px]"
                                    :class="activeId === item.id ? 'text-zx-primary' : 'text-slate-400 group-hover:text-slate-600'"
                                >
                                    {{ item.componentName }}
                                </span>
                            </div>
                            <ChevronRight
                                class="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                :class="{
                                    'opacity-100 text-zx-primary':
                                        activeId === item.id,
                                }"
                            />
                        </button>
                    </div>
                </div>
            </div>
        </aside>

        <!-- 中间核心区 (唯独中间滚动，全屏固定上下边界) -->
        <main
            ref="mainScrollRef"
            class="flex-1 h-screen overflow-y-auto py-8 px-10 min-w-0"
        >
            <div class="max-w-2xl mx-auto space-y-6 pb-16">
                <!-- 页面标题与极简说明 -->
                <div class="pb-3 border-b border-slate-200/80">
                    <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                        {{ currentItem.label }} {{ currentItem.en }}
                    </h1>
                    <p v-if="currentItem.desc" class="text-xs text-slate-400 mt-1 max-w-xl leading-normal">
                        {{ currentItem.desc }}
                    </p>
                </div>

                <!-- 组件文档内容区 -->
                <component :is="currentDocComponent" />

                <!-- 底部上一节 / 下一节 (对齐极简卡片) -->
                <div class="mt-10 flex items-center justify-between border-t border-slate-200/80 pt-4">
                    <button
                        v-if="prevItem"
                        type="button"
                        class="btn-touch group flex flex-col items-start rounded-lg border border-slate-200/90 bg-white p-2.5 text-left transition-all hover:border-slate-400 cursor-pointer shadow-2xs"
                        @click="switchComponent(prevItem.id)"
                    >
                        <span class="flex items-center text-[10px] text-slate-400 group-hover:text-slate-600">
                            <ArrowLeft class="mr-1 h-2.5 w-2.5 transition-transform group-hover:-translate-x-0.5" />
                            上一节
                        </span>
                        <span class="mt-0.5 text-xs font-semibold text-slate-800">
                            {{ prevItem.label }}
                        </span>
                    </button>
                    <div v-else></div>

                    <button
                        v-if="nextItem"
                        type="button"
                        class="btn-touch group flex flex-col items-end rounded-lg border border-slate-200/90 bg-white p-2.5 text-right transition-all hover:border-slate-400 cursor-pointer shadow-2xs"
                        @click="switchComponent(nextItem.id)"
                    >
                        <span class="flex items-center text-[10px] text-slate-400 group-hover:text-slate-600">
                            下一节
                            <ArrowRight class="ml-1 h-2.5 w-2.5 transition-transform group-hover:translate-x-0.5" />
                        </span>
                        <span class="mt-0.5 text-xs font-semibold text-slate-800">
                            {{ nextItem.label }}
                        </span>
                    </button>
                </div>
            </div>
        </main>

        <!-- 右侧区域 (固定在右边不滚动，对齐 shadcn 极简风格，CONTENTS 目录) -->
        <aside
            class="w-48 shrink-0 h-screen overflow-y-auto py-8 pl-4 pr-6 select-none"
        >
            <div class="space-y-3">
                <p class="font-semibold text-slate-900 text-xs tracking-wider">
                    CONTENTS
                </p>
                <div
                    v-if="dynamicTocList.length"
                    class="space-y-2 text-xs"
                >
                    <div
                        v-for="t in dynamicTocList"
                        :key="t.id"
                        class="cursor-pointer leading-snug transition-colors truncate"
                        :class="
                            activeHeading === t.id
                                ? 'text-zx-primary font-semibold'
                                : 'text-slate-500 hover:text-slate-900'
                        "
                        :title="t.title"
                        @click="scrollToSection(t.id)"
                    >
                        {{ t.title }}
                    </div>
                </div>
            </div>
        </aside>
    </div>
</template>
