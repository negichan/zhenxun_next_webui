<script setup lang="ts">
import { computed, nextTick, onActivated, onDeactivated, onMounted, onUnmounted, ref, watch } from "vue";
import { onBeforeRouteLeave, useRoute, useRouter } from "vue-router";
import {
    Anchor,
    Blocks,
    Download,
    ChevronLeft,
    ChevronRight,
    List,
    LayoutGrid,
    Package,
    Pin,
    RotateCw,
    PinOff,
    Search,
    SlidersHorizontal,
    X,
} from "lucide-vue-next";
import { storeToRefs } from "pinia";
import type { PluginInfo } from "@/types/api-next.types";
import type { NbStorePlugin, StorePlugin } from "@/types/store.types";
import PluginCard from "@/views/plugin/components/PluginCard/PluginCard.vue";
import PluginConfigModal from "@/views/plugin/components/PluginConfigModal/PluginConfigModal.vue";
import { ZXMessageBox, ZXNotification } from "@/services/ui";
import { ZXSelect } from "@/components/zxcomponent/ZXSelect";
import ZxEmptyState from "@/components/zxcomponent/ZxEmptyState.vue";
import type { ZXSelectOption } from "@/components/zxcomponent/ZXSelect";
import ZXInput from "@/components/zxcomponent/ZXInput.vue";
import ZxSegmented from "@/components/zxcomponent/ZxSegmented.vue";
import { usePluginStore } from "@/store/plugin.ts";
import { useStoreStore } from "@/store/store.ts";
import { useGlobalStore } from "@/store/global.ts";
import { storeApi } from "@/utils/api-next";
import { ZXContextMenu } from "@/components/zxcomponent/ContextMenu";
import { CornerFrame } from "@/components/zxcomponent/CornerFrame";
import { gsap } from "gsap";

const pluginStore = usePluginStore();
const storeStore = useStoreStore();
const globalStore = useGlobalStore();
const route = useRoute();
const router = useRouter();

const { loadPlugins } = pluginStore;
const {
    plugins,
    loading,
    searchKeyword,
    statusFilter,
    showBuiltin,
    showThird,
    pinnedModules,
    residentModules,
} = storeToRefs(pluginStore);
const { togglePinned, toggleResident } = pluginStore;
const { loading: storeLoading, storeData } = storeToRefs(storeStore);
const { loadStoreData } = storeStore;

// 移动 / 平板：筛选默认收起，点「筛选」展开；桌面默认展开
const filtersExpanded = ref(true);
onMounted(() => {
    if (!globalStore.isDesktopMode) filtersExpanded.value = false;
});

const activeView = ref<"local" | "market">(
    route.query.tab === "market" ? "market" : "local",
);

// 防抖定时器
let searchTimeout: ReturnType<typeof setTimeout> | null = null;

// 监听搜索变化，防抖加载（状态/类型筛选与标记都在前端过滤，不触发请求）
watch(searchKeyword, () => {
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(loadPlugins, 300);
});

// 过滤后的插件列表：状态/类型按开关过滤，
// 但置顶与常驻的插件始终保留（标记即常显），置顶按先后排最前
const filteredLocalPlugins = computed(() => {
    const isMarked = (module: string) =>
        pinnedModules.value.includes(module) ||
        residentModules.value.includes(module);
    const list = plugins.value.filter((p) => {
        if (isMarked(p.module)) return true;
        if (statusFilter.value === "active" && !p.is_enabled) return false;
        if (statusFilter.value === "inactive" && p.is_enabled) return false;
        return p.is_builtin ? showBuiltin.value : showThird.value;
    });
    const pinIndex = (module: string) => {
        const i = pinnedModules.value.indexOf(module);
        return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    };
    return [...list].sort((a, b) => pinIndex(a.module) - pinIndex(b.module));
});

// 右键卡片：置顶 / 常驻
const openPluginMenu = (e: MouseEvent, plugin: PluginInfo) => {
    const pinned = pinnedModules.value.includes(plugin.module);
    const resident = residentModules.value.includes(plugin.module);
    ZXContextMenu.show({
        x: e.clientX,
        y: e.clientY,
        items: [
            {
                label: pinned ? "取消置顶" : "置顶插件",
                icon: pinned ? PinOff : Pin,
                action: () => togglePinned(plugin.module),
            },
            {
                label: resident ? "取消常驻" : "常驻插件",
                icon: Anchor,
                action: () => toggleResident(plugin.module),
            },
        ],
    });
};

// 右键市场卡：安装 / 更新
const openStoreMenu = (e: MouseEvent, plugin: StorePlugin) => {
    ZXContextMenu.show({
        x: e.clientX,
        y: e.clientY,
        items: [
            plugin.is_installed
                ? {
                      label: "更新插件",
                      icon: RotateCw,
                      action: () => handleUpdate(plugin),
                  }
                : {
                      label: "安装插件",
                      icon: Download,
                      action: () => handleInstall(plugin),
                  },
        ],
    });
};

const storeSearchKeyword = ref("");
const storeFilterType = ref<"all" | "installed" | "not-installed">("all");

// 插件市场源，下拉只显示当前源
const storeSource = ref<"zhenxun" | "nonebot">("zhenxun");
const storeSourceOptions: ZXSelectOption[] = [
    { label: "真寻源", value: "zhenxun" },
    { label: "NoneBot源", value: "nonebot" },
];

// ==================== NoneBot 源 ====================
const nbPlugins = ref<NbStorePlugin[]>([]);
const nbLoading = ref(false);

const loadNbStore = async () => {
    nbLoading.value = true;
    try {
        const res = await storeApi.getNbStoreList();
        if (res?.success && res?.data) {
            nbPlugins.value = res.data;
        }
    } catch {
        ZXNotification({
            title: "呜呼~",
            message: "NoneBot 插件列表加载失败了 (´；ω；`)",
            type: "error",
            position: "top-right",
        });
    } finally {
        nbLoading.value = false;
    }
};

const handleStoreSourceChange = (value: string) => {
    storeSource.value = value as "zhenxun" | "nonebot";
    marketPage.value = 1;
    if (value === "nonebot" && !nbPlugins.value.length) {
        loadNbStore();
    }
};

// NB 源搜索 + 安装状态过滤
const filteredNbPlugins = computed(() => {
    let result = nbPlugins.value;
    if (storeSearchKeyword.value) {
        const keyword = storeSearchKeyword.value.toLowerCase();
        result = result.filter(
            (p) =>
                p.name.toLowerCase().includes(keyword) ||
                p.module_name.toLowerCase().includes(keyword) ||
                p.desc?.toLowerCase().includes(keyword) ||
                p.author?.toLowerCase().includes(keyword),
        );
    }
    if (storeFilterType.value === "installed") {
        result = result.filter((p) => p.installed);
    } else if (storeFilterType.value === "not-installed") {
        result = result.filter((p) => !p.installed);
    }
    return result;
});

const filteredStorePlugins = computed(() => {
    if (!storeData.value) return [];

    let result = storeData.value.plugin_list;

    if (storeSearchKeyword.value) {
        const keyword = storeSearchKeyword.value.toLowerCase();
        result = result.filter(
            (plugin: StorePlugin) =>
                plugin.name.toLowerCase().includes(keyword) ||
                plugin.module.toLowerCase().includes(keyword) ||
                plugin.description?.toLowerCase().includes(keyword) ||
                plugin.author?.toLowerCase().includes(keyword),
        );
    }

    if (storeFilterType.value === "installed") {
        result = result.filter((plugin: StorePlugin) => plugin.is_installed);
    } else if (storeFilterType.value === "not-installed") {
        result = result.filter((plugin: StorePlugin) => !plugin.is_installed);
    }

    return result;
});

// NB 标签品牌色：标签名 -> 背景色（对比文字由 ZxTag 处理）
const nbTagColors = computed<Record<string, string> | undefined>(() => {
    if (storeSource.value !== "nonebot") return undefined;
    const map: Record<string, string> = {};
    for (const p of nbPlugins.value) {
        for (const t of p.tags) {
            if (t.label && t.color) map[t.label] = t.color;
        }
    }
    return map;
});

// 市场视图统一卡片数据（NoneBot 源映射为统一卡片的字段）
const marketCards = computed<StorePlugin[]>(() => {
    if (storeSource.value === "nonebot") {
        return filteredNbPlugins.value.map((p) => ({
            id: 0,
            module: p.module_name,
            name: p.name,
            description: p.desc,
            author: p.author,
            version:
                p.has_update && p.local_version
                    ? `${p.version}（当前 v${p.local_version}）`
                    : p.version,

            plugin_type: p.is_official ? "官方" : "",
            is_installed: p.installed,
            has_update: p.has_update,
            homepage: p.homepage || "",
            tags: p.tags.map((t) => t.label),
        }));
    }
    return filteredStorePlugins.value;
});

// ==================== 卡片元信息标签（本地/市场统一结构） ====================
type CardMetaTag = {
    text: string;
    variant?: "neutral"
        | "primary"
        | "success"
        | "warning"
        | "danger"
        | "info"
        | "purple"
        | "cyan";
    color?: string;
};

const typeBgOf = (type: string) =>
    type === "NORMAL" || type === "官方"
        ? "#16a34a"
        : type === "ADMIN"
          ? "#ef4444"
          : "#71717a";

const localMetaTags = (plugin: PluginInfo): CardMetaTag[] => {
    const tags: CardMetaTag[] = [
        { text: `v${plugin.version || "1.0.0"}`, variant: "info" },
        {
            text: plugin.is_builtin ? "内置" : "三方",
            variant: plugin.is_builtin ? "purple" : "warning",
        },
    ];
    if (residentModules.value.includes(plugin.module)) {
        tags.push({ text: "常驻", variant: "warning" });
    }
    return tags;
};

const marketMetaTags = (plugin: StorePlugin): CardMetaTag[] => {
    const tags: CardMetaTag[] = [
        { text: `v${plugin.version || "1.0.0"}`, variant: "info" },
    ];
    if (plugin.plugin_type) {
        tags.push({ text: plugin.plugin_type, color: typeBgOf(plugin.plugin_type) });
    }
    for (const t of (plugin.tags || []).slice(0, 2)) {
        tags.push({ text: t, color: nbTagColors.value?.[t] });
    }
    return tags;
};

// ==================== 市场分页（真寻源 / NoneBot 源共用） ====================
const MARKET_PAGE_SIZE = 20;
const marketPage = ref(1);
const marketPageTotal = computed(() =>
    Math.max(1, Math.ceil(marketCards.value.length / MARKET_PAGE_SIZE)),
);
const pagedMarketCards = computed(() =>
    marketCards.value.slice(
        (marketPage.value - 1) * MARKET_PAGE_SIZE,
        marketPage.value * MARKET_PAGE_SIZE,
    ),
);


const setMarketPage = (page: number) => {
    if (
        page < 1 ||
        page > marketPageTotal.value ||
        page === marketPage.value
    ) {
        return;
    }
    marketPage.value = page;
    contentRef.value?.scrollTo({ top: 0 });
    nextTick(animateCardsIn);
};

// 搜索 / 安装状态过滤变化时回到第一页
watch([storeSearchKeyword, storeFilterType], () => {
    marketPage.value = 1;
});

// ==================== 本地插件分页 ====================
const LOCAL_PAGE_SIZE = 20;
const localPage = ref(1);
const localPageTotal = computed(() =>
    Math.max(
        1,
        Math.ceil(filteredLocalPlugins.value.length / LOCAL_PAGE_SIZE),
    ),
);
const pagedLocalPlugins = computed(() =>
    filteredLocalPlugins.value.slice(
        (localPage.value - 1) * LOCAL_PAGE_SIZE,
        localPage.value * LOCAL_PAGE_SIZE,
    ),
);


const setLocalPage = (page: number) => {
    if (
        page < 1 ||
        page > localPageTotal.value ||
        page === localPage.value
    ) {
        return;
    }
    localPage.value = page;
    contentRef.value?.scrollTo({ top: 0 });
    nextTick(animateCardsIn);
};

// 搜索 / 状态 / 类型筛选变化时回到第一页；列表缩短时收拢当前页
watch([searchKeyword, statusFilter, showBuiltin, showThird], () => {
    localPage.value = 1;
});
watch(localPageTotal, (total) => {
    if (localPage.value > total) localPage.value = total;
});

// 当前视图的分页状态桥接：底部分页条按视图取对应数据源
const currentPage = computed(() =>
    activeView.value === "market" ? marketPage.value : localPage.value,
);
const currentPageTotal = computed(() =>
    activeView.value === "market"
        ? marketPageTotal.value
        : localPageTotal.value,
);

const setCurrentPage = (page: number) => {
    if (activeView.value === "market") {
        setMarketPage(page);
    } else {
        setLocalPage(page);
    }
};

// 统计信息
const pluginStats = computed(() => {
    const total = plugins.value.length;
    const active = plugins.value.filter((p) => p.is_enabled).length;
    const builtin = plugins.value.filter((p) => p.is_builtin).length;
    return {
        total,
        active,
        inactive: total - active,
        builtin,
        third: total - builtin,
    };
});

const storeStats = computed(() => {
    if (!storeData.value) return { total: 0, installed: 0, available: 0 };
    const total = storeData.value.plugin_list.length;
    const installed = storeData.value.plugin_list.filter(
        (p: StorePlugin) => p.is_installed,
    ).length;
    return { total, installed, available: total - installed };
});

const currentCount = computed(() =>
    activeView.value === "local"
        ? filteredLocalPlugins.value.length
        : marketCards.value.length,
);

const currentLoading = computed(() => {
    if (activeView.value === "local") return loading.value;
    return storeSource.value === "nonebot"
        ? nbLoading.value
        : storeLoading.value;
});

// 过渡：内容区淡入淡出、卡片入场、筛选行展开
const contentRef = ref<HTMLElement | null>(null);
const headerRef = ref<HTMLElement | null>(null);

// 游离四角取景框：市场卡片悬浮时瞬移跟随
const frameRef = ref<InstanceType<typeof CornerFrame> | null>(null);
let framedCard: HTMLElement | null = null;
let frameDwellTimer: ReturnType<typeof setTimeout> | null = null;
let frameHideTimer: ReturnType<typeof setTimeout> | null = null;

const clearFrameTimers = () => {
    if (frameDwellTimer) {
        clearTimeout(frameDwellTimer);
        frameDwellTimer = null;
    }
    if (frameHideTimer) {
        clearTimeout(frameHideTimer);
        frameHideTimer = null;
    }
};

const onMarketOver = (e: MouseEvent) => {
    const card = (e.target as HTMLElement | null)?.closest?.(
        ".market-card",
    ) as HTMLElement | null;
    // 回到同一张卡：取消未决的隐藏即可
    if (card && card === framedCard) {
        if (frameHideTimer) {
            clearTimeout(frameHideTimer);
            frameHideTimer = null;
        }
        return;
    }
    clearFrameTimers();
    if (!card) {
        // 卡片间隙 / 空白：延迟隐藏，快速跨间隙不会闪烁
        if (framedCard && frameHideTimer === null) {
            frameHideTimer = setTimeout(() => {
                frameHideTimer = null;
                framedCard = null;
                frameRef.value?.hide();
            }, 100);
        }
        return;
    }
    // 新卡片：极短的移入判定
    const target = card;
    frameDwellTimer = setTimeout(() => {
        frameDwellTimer = null;
        framedCard = target;
        frameRef.value?.moveTo(target);
    }, 20);
};

const onMarketLeave = () => {
    clearFrameTimers();
    framedCard = null;
    frameRef.value?.hide();
};

/** 视图胶片是否在滑动：期间禁止卡片 y 入场，否则 x+y 会叠成斜线 */
let viewTransitioning = false;
let pendingCardAnim = false;
let skipViewAnimation = false;

const activeViewEl = () => {
    const el = contentRef.value;
    if (!el) return null;
    return (
        (Array.from(el.querySelectorAll("[data-view]")).find(
            (n) => (n as HTMLElement).dataset.leaving !== "1",
        ) as HTMLElement | undefined) ?? null
    );
};

const animateCardsIn = () => {
    // 胶片滑动中卡片随视图一起走，禁止再叠 y 入场（x+y 会看起来斜着飞）
    if (viewTransitioning) {
        pendingCardAnim = true;
        return;
    }
    const viewEl = activeViewEl();
    if (!viewEl) return;
    const cards = Array.from(viewEl.children);
    if (!cards.length) return;
    // 卡片自带 transition-all，先禁用避免和 GSAP 补间打架，结束后还原
    gsap.fromTo(
        cards,
        { opacity: 0, y: 14, transition: "none" },
        {
            opacity: 1,
            y: 0,
            duration: 0.32,
            stagger: 0.035,
            ease: "power2.out",
            clearProps: "all",
        },
    );
};

/** 网格↔列表切换：轻量入场，比加载入场更短 */
const animateLayoutSwitch = () => {
    if (viewTransitioning) {
        pendingCardAnim = true;
        return;
    }
    const viewEl = activeViewEl();
    if (!viewEl) return;
    const cards = Array.from(viewEl.children);
    if (!cards.length) return;
    gsap.killTweensOf(cards);
    gsap.fromTo(
        cards,
        { opacity: 0, y: 10, transition: "none" },
        {
            opacity: 1,
            y: 0,
            duration: 0.26,
            stagger: 0.022,
            ease: "power2.out",
            clearProps: "all",
            overwrite: true,
        },
    );
};

watch(currentLoading, (isLoading) => {
    if (!isLoading) nextTick(animateCardsIn);
});

watch(filtersExpanded, async (expanded) => {
    if (!expanded) return;
    await nextTick();
    const rows = headerRef.value?.querySelectorAll(".filter-row");
    if (!rows?.length) return;
    // 桌面：过滤与搜索同行靠右，从右侧滑入；窄屏：独立行，自上轻落
    const from = globalStore.isDesktopMode
        ? { opacity: 0, x: 10 }
        : { opacity: 0, y: -6 };
    gsap.fromTo(rows, from, {
        opacity: 1,
        x: 0,
        y: 0,
        duration: 0.25,
        ease: "power2.out",
        clearProps: "all",
    });
});

// ==================== gsap 驱动的胶片式视图切换（横向版，同侧边栏切页） ====================
// 只动 xPercent，显式钉死 y/yPercent，避免残留竖向位移叠成斜线
const onViewEnter = (el: Element, done: () => void) => {
    if (skipViewAnimation) {
        gsap.killTweensOf(el);
        const htmlEl = el as HTMLElement;
        htmlEl.style.position = "";
        htmlEl.style.pointerEvents = "";
        delete htmlEl.dataset.leaving;
        gsap.set(el, { clearProps: "transform" });
        viewTransitioning = false;
        done();
        return;
    }
    viewTransitioning = true;
    gsap.killTweensOf(el);
    const htmlEl = el as HTMLElement;
    htmlEl.style.position = "";
    htmlEl.style.pointerEvents = "";
    delete htmlEl.dataset.leaving;
    gsap.fromTo(
        el,
        {
            xPercent: activeView.value === "market" ? 100 : -100,
            y: 0,
            yPercent: 0,
        },
        {
            xPercent: 0,
            y: 0,
            yPercent: 0,
            duration: 0.55,
            ease: "power4.out",
            onComplete: () => {
                gsap.set(el, { clearProps: "transform" });
                viewTransitioning = false;
                done();
                if (pendingCardAnim) {
                    pendingCardAnim = false;
                    nextTick(animateCardsIn);
                }
            },
            // 被下一次切换打断时也要释放，否则 Transition 会一直等 done
            onInterrupt: () => {
                viewTransitioning = false;
                done();
            },
        },
    );
};

const onViewLeave = (el: Element, done: () => void) => {
    if (skipViewAnimation) {
        gsap.killTweensOf(el);
        const htmlEl = el as HTMLElement;
        htmlEl.style.position = "";
        htmlEl.style.pointerEvents = "";
        delete htmlEl.dataset.leaving;
        gsap.set(el, { clearProps: "transform" });
        viewTransitioning = false;
        done();
        return;
    }
    viewTransitioning = true;
    gsap.killTweensOf(el);
    // 退场视图绝对定位脱离文档流，与新视图同屏叠放成胶片带
    const htmlEl = el as HTMLElement;
    htmlEl.style.position = "absolute";
    htmlEl.style.top = "0";
    htmlEl.style.left = "0";
    htmlEl.style.width = "100%";
    htmlEl.style.pointerEvents = "none";
    htmlEl.dataset.leaving = "1";
    gsap.to(el, {
        xPercent: activeView.value === "market" ? -100 : 100,
        y: 0,
        yPercent: 0,
        duration: 0.55,
        ease: "power4.out",
        onComplete: done,
        onInterrupt: () => done(),
    });
};

// 视图密度：网格（卡片）/列表（单行紧凑），本地与市场共用，localStorage 持久化
const VIEW_MODE_KEY = "pluginViewMode";
const viewMode = ref<"grid" | "list">(
    localStorage.getItem(VIEW_MODE_KEY) === "list" ? "list" : "grid",
);

const viewModeOptions = [
    { value: "grid" as const, label: "网格", icon: LayoutGrid },
    { value: "list" as const, label: "列表", icon: List },
];

const onViewModeChange = (val: "grid" | "list") => {
    viewMode.value = val;
    localStorage.setItem(VIEW_MODE_KEY, val);
};

/** 移动端强制列表布局（不改用户的持久化偏好，回到桌面/平板自动还原） */
const effectiveViewMode = computed(() =>
    globalStore.isMobileMode ? "list" : viewMode.value,
);

// 布局切换：先压暗旧布局，待新布局落地后再轻量入场
watch(effectiveViewMode, async (val, oldVal) => {
    if (val === oldVal) return;
    const viewEl = activeViewEl();
    if (viewEl?.children.length) {
        gsap.set(Array.from(viewEl.children), { opacity: 0 });
    }
    await nextTick();
    animateLayoutSwitch();
});

const switchView = (view: "local" | "market") => {
    if (activeView.value === view) return;
    activeView.value = view;
    // 新视图从顶部开始，同时保证退场视图在可视区内滑出
    contentRef.value?.scrollTo({ top: 0 });
    clearFrameTimers();
    frameRef.value?.hide();
};

// 路由守卫：精准区分【页内切换】与【跨页导航】
// 1. 从外部页面（如首页/联系人）切入 /plugin：立即静默落位到目标视图，严禁触发内部横向动效，确保只播放全局纵向滑入
// 2. 已经在 /plugin 内部，在「本地插件」与「插件市场」之间切换：正常播放横向胶片滑动动效
const removeRouteGuard = router.beforeEach((to, from) => {
    if (to.path === "/plugin") {
        const targetView = to.query.tab === "market" ? "market" : "local";
        if (from.path === "/plugin") {
            // 页内子项切换：允许播放横向滑动
            skipViewAnimation = false;
            if (activeView.value !== targetView) {
                switchView(targetView);
            }
        } else {
            // 跨页面进入：静默就位，不播放横向动效
            skipViewAnimation = true;
            activeView.value = targetView;
        }
    } else if (from.path === "/plugin") {
        // 离开插件页：禁止任何内部横向动画
        skipViewAnimation = true;
    }
});

watch(activeView, (view) => {
    if (route.path !== "/plugin") return;
    const targetSubKey = view === "market" ? "plugin-market" : "plugin-local";
    if (route.query.tab !== view || route.query.subKey !== targetSubKey) {
        router.replace({
            path: "/plugin",
            query: {
                tab: view,
                subKey: targetSubKey,
            },
        });
    }

    if (view === "market" && storeSource.value === "nonebot") {
        if (!nbPlugins.value.length) loadNbStore();
    } else if (view === "market" && !storeData.value) {
        loadStoreData();
    }
});

// 从其他页面切换进入 /plugin 页面时：若目标 tab 与当前 activeView 不一致，静默就位而不播放横向动效
onActivated(() => {
    if (route.path !== "/plugin") return;
    const targetView = route.query.tab === "market" ? "market" : "local";
    if (activeView.value !== targetView) {
        skipViewAnimation = true;
        activeView.value = targetView;
    }
    nextTick(() => {
        skipViewAnimation = false;
    });
});

onBeforeRouteLeave(() => {
    clearFrameTimers();
    frameRef.value?.hide();
    viewTransitioning = false;
    skipViewAnimation = true;
    if (contentRef.value) {
        const views = contentRef.value.querySelectorAll("[data-view]");
        views.forEach((v) => {
            gsap.killTweensOf(v);
            gsap.set(v, { clearProps: "transform" });
            delete (v as HTMLElement).dataset.leaving;
        });
    }
});

onUnmounted(() => {
    removeRouteGuard();
});

// 处理插件状态变化
const handleStatusChange = (module: string, newStatus: boolean) => {
    const plugin = plugins.value.find((p) => p.module === module);
    if (plugin) {
        plugin.is_enabled = newStatus;
    }
};

// 配置弹窗
const configModalVisible = ref(false);
const currentPluginModule = ref("");
const currentPluginName = ref("");

// 打开配置弹窗
const handleOpenConfig = (plugin: PluginInfo) => {
    if (!plugin.allow_setting) {
        ZXNotification({
            title: "提示",
            message: `插件 "${plugin.name}" 没有配置项 (｡•́︿•̀｡)`,
            type: "info",
            position: "top-right",
        });
        return;
    }
    currentPluginModule.value = plugin.module;
    currentPluginName.value = plugin.name;
    configModalVisible.value = true;
};

// 安装插件
const handleInstall = async (plugin: StorePlugin) => {
    ZXMessageBox({
        title: "安装插件",
        message: `确定要安装 "${plugin.name}" 插件吗？`,
        cancelButtonText: "取消",
        confirmButtonText: "安装",
        onConfirm: async () => {
            try {
                if (storeSource.value === "nonebot") {
                    const res = await storeApi.installNbPlugin(plugin.module);
                    if (res?.success) {
                        ZXNotification({
                            title: "安装成功~",
                            message:
                                res.message ||
                                `"${plugin.name}" 已经安装成功啦！重启Bot生效`,
                            type: "success",
                            position: "top-right",
                            confetti: true,
                        });
                        loadNbStore();
                    } else {
                        ZXNotification({
                            title: "安装失败",
                            message:
                                res?.message ||
                                "插件安装失败了，请再试一次 (´；ω；`)",
                            type: "error",
                            position: "top-right",
                        });
                    }
                    return;
                }
                const res = await storeApi.installPlugin(plugin.id);
                if (res?.success) {
                    plugin.is_installed = true;
                    if (
                        storeData.value &&
                        !storeData.value.install_module.includes(plugin.module)
                    ) {
                        storeData.value.install_module.push(plugin.module);
                    }
                    ZXNotification({
                        title: "安装成功~",
                        message: `"${plugin.name}" 已经安装成功啦！重启Bot生效`,
                        type: "success",
                        position: "top-right",
                        confetti: true,
                    });
                }
            } catch (error) {
                ZXNotification({
                    title: "安装失败",
                    message: "插件安装失败了，请再试一次 (´；ω；`)",
                    type: "error",
                    position: "top-right",
                });
            }
        },
    });
};

// 更新插件
const handleUpdate = async (plugin: StorePlugin) => {
    try {
        if (storeSource.value === "nonebot") {
            const res = await storeApi.updateNbPlugin(plugin.module);
            if (res?.success) {
                ZXNotification({
                    title: "更新成功~",
                    message:
                        res.message || `"${plugin.name}" 已经更新到最新版本啦！`,
                    type: "success",
                    position: "top-right",
                    confetti: true,
                });
                loadNbStore();
            } else {
                ZXNotification({
                    title: "更新失败",
                    message:
                        res?.message || "插件更新失败了 (´；ω；`)",
                    type: "error",
                    position: "top-right",
                });
            }
            return;
        }
        const res = await storeApi.updatePlugin(plugin.id);
        if (res?.success) {
            ZXNotification({
                title: "更新成功~",
                message: `"${plugin.name}" 已经更新到最新版本啦！`,
                type: "success",
                position: "top-right",
                confetti: true,
            });
        }
    } catch (error) {
        ZXNotification({
            title: "更新失败",
            message: "插件更新失败了 (´；ω；`)",
            type: "error",
            position: "top-right",
        });
    }
};

// 配置更新后
const handleConfigUpdated = () => {
    // 重新加载插件列表
    loadPlugins();
};

onMounted(() => {
    loadPlugins();
    if (activeView.value === "market") {
        loadStoreData();
    }
});

// KeepAlive 切走时掐掉未完成的视图补间，避免残留 x/y 叠进下一次页面滑动
onDeactivated(() => {
    viewTransitioning = false;
    pendingCardAnim = false;
    const el = contentRef.value;
    if (el) {
        gsap.killTweensOf(el);
        el.querySelectorAll("[data-view]").forEach((node) => {
            gsap.killTweensOf(node);
            const htmlNode = node as HTMLElement;
            delete htmlNode.dataset.leaving;
            htmlNode.style.position = "";
            htmlNode.style.top = "";
            htmlNode.style.left = "";
            htmlNode.style.width = "";
            htmlNode.style.pointerEvents = "";
        });
        gsap.set(el.querySelectorAll("[data-view]"), {
            clearProps: "transform",
        });
    }
});
</script>

<template>
    <div class="flex h-full w-full flex-col space-y-3 sm:space-y-4">
        <!-- 搜索和过滤 - 响应式布局（移动/平板：视图切换、刷新、统计、过滤全部集成在这张卡里） -->
        <div
            ref="headerRef"
            class="flex flex-col items-stretch gap-3 rounded-3xl border-1 border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-3 sm:p-4"
        >
            <!-- 手机端刷新按钮（桌面/平板由 Island 呈现；样式对齐动作圆钮） -->
            <button
                v-if="globalStore.isMobileMode"
                class="btn-touch flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm transition-all hover:scale-105 hover:bg-gray-50 disabled:opacity-50"
                title="刷新列表"
                type="button"
                :disabled="currentLoading"
                @click="
                    activeView === 'local'
                        ? loadPlugins()
                        : storeSource === 'nonebot'
                          ? loadNbStore()
                          : loadStoreData()
                "
            >
                <RotateCw
                    class="h-4 w-4 text-zx-text-muted"
                    :class="{ 'animate-spin': currentLoading }"
                />
            </button>

            <!-- 统计文字条：手机全量；平板市场视图补充（Island 统计是本地插件数，且 xl 才全量） -->
            <div
                v-if="globalStore.isMobileMode || (globalStore.isTableMode && activeView === 'market')"
                class="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-xs text-zx-text-muted"
            >
                <template v-if="activeView === 'local'">
                    <span class="whitespace-nowrap"
                        >总数
                        <span
                            v-odometer="pluginStats.total"
                            class="font-black text-blue-500"
                        ></span
                    ></span>
                    <span class="whitespace-nowrap"
                        >已启用
                        <span
                            v-odometer="pluginStats.active"
                            class="font-black text-green-500"
                        ></span
                    ></span>
                    <span class="whitespace-nowrap"
                        >已禁用
                        <span
                            v-odometer="pluginStats.inactive"
                            class="font-black text-zx-text-muted"
                        ></span
                    ></span>
                    <span class="whitespace-nowrap"
                        >内置
                        <span
                            v-odometer="pluginStats.builtin"
                            class="font-black text-purple-500"
                        ></span
                    ></span>
                </template>
                <template v-else>
                    <span class="whitespace-nowrap"
                        >总数
                        <span
                            v-odometer="storeStats.total"
                            class="font-black text-blue-500"
                        ></span
                    ></span>
                    <span class="whitespace-nowrap"
                        >已安装
                        <span
                            v-odometer="storeStats.installed"
                            class="font-black text-green-500"
                        ></span
                    ></span>
                    <span class="whitespace-nowrap"
                        >可安装
                        <span
                            v-odometer="storeStats.available"
                            class="font-black text-purple-500"
                        ></span
                    ></span>
                </template>
            </div>

            <!-- 搜索框 + 筛选开关（桌面：限宽，与过滤同行；窄屏：占满并换行） -->
            <div class="flex min-w-[200px] flex-1 items-center gap-2 sm:max-lg:basis-full lg:max-w-md">
                <!-- 市场源切换（菜单下拉胶囊；NoneBot 源暂未实现） -->
                <ZXSelect
                    v-if="activeView === 'market'"
                    :model-value="storeSource"
                    :options="storeSourceOptions"
                    mode="dropdown"
                    @update:model-value="handleStoreSourceChange"
                />
                <ZXInput
                    v-if="activeView === 'local'"
                    v-model="searchKeyword"
                    type="search"
                    placeholder="搜索插件名称..."
                    class="min-w-0 flex-1"
                >
                    <template #suffix>
                        <button
                            class="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors lg:hidden"
                            :class="
                                filtersExpanded
                                    ? 'text-zx-primary'
                                    : 'text-zx-text-subtle hover:text-zx-primary'
                            "
                            title="筛选"
                            type="button"
                            @click="filtersExpanded = !filtersExpanded"
                        >
                            <SlidersHorizontal class="h-4 w-4" />
                        </button>
                    </template>
                </ZXInput>
                <ZXInput
                    v-else
                    v-model="storeSearchKeyword"
                    type="search"
                    placeholder="搜索插件名称、模块、描述或作者..."
                    class="min-w-0 flex-1"
                >
                    <template #suffix>
                        <button
                            class="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors lg:hidden"
                            :class="
                                filtersExpanded
                                    ? 'text-zx-primary'
                                    : 'text-zx-text-subtle hover:text-zx-primary'
                            "
                            title="筛选"
                            type="button"
                            @click="filtersExpanded = !filtersExpanded"
                        >
                            <SlidersHorizontal class="h-4 w-4" />
                        </button>
                    </template>
                </ZXInput>
            </div>

            <!-- 状态 / 类型过滤（移动/平板默认收起，点「筛选」展开；桌面常显，视图切换跟在过滤右侧） -->
            <div
                v-if="activeView === 'local'"
                :class="!filtersExpanded ? 'hidden lg:flex' : ''"
                class="filter-row flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2 lg:ml-auto lg:w-auto lg:justify-start lg:gap-x-6"
            >
                <div class="flex items-center gap-1">
                    <span class="flex-shrink-0 text-sm text-zx-text-muted">状态:</span>
                    <button
                        @click="statusFilter = 'all'"
                        :class="
                            statusFilter === 'all'
                                ? 'bg-zx-primary text-[color:var(--zx-color-on-primary)] shadow-2xs'
                                : 'bg-gray-100 text-zx-text-muted hover:bg-gray-200'
                        "
                        class="btn-touch cursor-pointer rounded-2xl px-3 py-1.5 text-xs font-medium transition-colors"
                    >
                        全部
                    </button>
                    <button
                        @click="statusFilter = 'active'"
                        :class="
                            statusFilter === 'active'
                                ? 'bg-[#22c55e] text-white shadow-2xs'
                                : 'bg-gray-100 text-zx-text-muted hover:bg-gray-200'
                        "
                        class="btn-touch cursor-pointer rounded-2xl px-3 py-1.5 text-xs font-medium transition-colors"
                    >
                        启用
                    </button>
                    <button
                        @click="statusFilter = 'inactive'"
                        :class="
                            statusFilter === 'inactive'
                                ? 'bg-[#9ca3af] text-white shadow-2xs'
                                : 'bg-gray-100 text-zx-text-muted hover:bg-gray-200'
                        "
                        class="btn-touch cursor-pointer rounded-2xl px-3 py-1.5 text-xs font-medium transition-colors"
                    >
                        禁用
                    </button>
                </div>

                <div class="flex items-center gap-1">
                    <span class="flex-shrink-0 text-sm text-zx-text-muted">类型:</span>
                    <button
                        @click="showBuiltin = !showBuiltin"
                        :class="
                            showBuiltin
                                ? 'bg-[#8b5cf6] text-white shadow-2xs'
                                : 'bg-gray-100 text-zx-text-muted hover:bg-gray-200'
                        "
                        class="btn-touch cursor-pointer rounded-2xl px-3 py-1.5 text-xs font-medium transition-colors"
                    >
                        内置
                    </button>
                    <button
                        @click="showThird = !showThird"
                        :class="
                            showThird
                                ? 'bg-[#f59e0b] text-white shadow-2xs'
                                : 'bg-gray-100 text-zx-text-muted hover:bg-gray-200'
                        "
                        class="btn-touch cursor-pointer rounded-2xl px-3 py-1.5 text-xs font-medium transition-colors"
                    >
                        三方
                    </button>
                </div>
            </div>

            <div
                v-else
                :class="!filtersExpanded ? 'hidden lg:flex' : ''"
                class="filter-row flex w-full flex-wrap items-center gap-x-4 gap-y-2 lg:ml-auto lg:w-auto lg:gap-x-3"
            >
                <span class="flex-shrink-0 text-sm text-zx-text-muted">状态:</span>
                <button
                    @click="storeFilterType = 'all'"
                    :class="
                        storeFilterType === 'all'
                            ? 'bg-zx-primary text-[color:var(--zx-color-on-primary)] shadow-2xs'
                            : 'bg-gray-100 text-zx-text-muted hover:bg-gray-200'
                    "
                    class="btn-touch cursor-pointer rounded-2xl px-3 py-1.5 text-xs font-medium transition-colors"
                >
                    全部
                </button>
                <button
                    @click="storeFilterType = 'installed'"
                    :class="
                        storeFilterType === 'installed'
                            ? 'bg-[#22c55e] text-white shadow-2xs'
                            : 'bg-gray-100 text-zx-text-muted hover:bg-gray-200'
                    "
                    class="btn-touch cursor-pointer rounded-2xl px-3 py-1.5 text-xs font-medium transition-colors"
                >
                    已安装
                </button>
                <button
                    @click="storeFilterType = 'not-installed'"
                    :class="
                        storeFilterType === 'not-installed'
                            ? 'bg-[#9ca3af] text-white shadow-2xs'
                            : 'bg-gray-100 text-zx-text-muted hover:bg-gray-200'
                    "
                    class="btn-touch cursor-pointer rounded-2xl px-3 py-1.5 text-xs font-medium transition-colors"
                >
                    未安装
                </button>
            </div>

            <!-- 视图切换：本地/市场共用同一实例，保证两侧完全一致 -->
            <ZxSegmented
                v-if="!globalStore.isMobileMode"
                :model-value="viewMode"
                :options="viewModeOptions"
                size="md"
                class="shrink-0"
                @update:model-value="onViewModeChange"
            />

        </div>

        <!-- 插件网格 -->
        <div
            ref="contentRef"
            class="relative flex-1 overflow-x-hidden overflow-y-auto px-1 pt-1"
            @mouseover="onMarketOver"
            @mouseleave="onMarketLeave"
        >
            <div
                v-if="currentLoading"
                class="flex h-full items-center justify-center"
            >
                <div class="text-center text-zx-text-subtle">
                    <component
                        :is="activeView === 'local' ? Blocks : Package"
                        class="mx-auto mb-4 h-12 w-12 animate-pulse"
                    />
                    <p>加载中...</p>
                </div>
            </div>

            <ZxEmptyState
                v-else-if="
                    activeView === 'local'
                        ? filteredLocalPlugins.length === 0
                        : marketCards.length === 0
                "
                class="h-full"
                :icon="activeView === 'local' ? Blocks : Package"
                size="md"
                text="没有找到插件"
                sub-text="尝试调整搜索或过滤条件"
            />

            <Transition
                v-else
                :css="false"
                @enter="onViewEnter"
                @leave="onViewLeave"
            >
                <!-- 网格视图 -->
                <div
                    v-if="activeView === 'local'"
                    key="local"
                    data-view="local"
                    :class="
                        effectiveViewMode === 'grid'
                            ? 'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5'
                            : 'flex flex-col gap-2'
                    "
                >
                    <PluginCard
                        v-for="plugin in pagedLocalPlugins"
                        :key="plugin.module"
                        :layout="effectiveViewMode"
                        type="local"
                        :name="plugin.name"
                        :module="plugin.module"
                        :description="plugin.description"
                        :pinned="pinnedModules.includes(plugin.module)"
                        :meta-tags="localMetaTags(plugin)"
                        :author="plugin.author"
                        :enabled="plugin.is_enabled"
                        :allow-switch="plugin.allow_switch"
                        :allow-setting="plugin.allow_setting"
                        @contextmenu.prevent="openPluginMenu($event, plugin)"
                        @toggle="newStatus => handleStatusChange(plugin.module, newStatus)"
                        @config="handleOpenConfig(plugin)"
                    />
                </div>

                <!-- 插件市场（与管理相同的网格） -->
                <div
                    v-else
                    key="market"
                    data-view="market"
                    :class="
                        effectiveViewMode === 'grid'
                            ? 'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5'
                            : 'flex flex-col gap-2'
                    "
                >
                    <PluginCard
                        v-for="plugin in pagedMarketCards"
                        :key="plugin.module"
                        :layout="effectiveViewMode"
                        type="market"
                        class="market-card"
                        :name="plugin.name"
                        :module="plugin.module"
                        :description="plugin.description"
                        :meta-tags="marketMetaTags(plugin)"
                        :author="plugin.author"
                        :is-installed="plugin.is_installed"
                        :has-update="plugin.has_update"
                        :homepage="plugin.homepage"
                        @contextmenu.prevent="openStoreMenu($event, plugin)"
                        @install="handleInstall(plugin)"
                        @update="handleUpdate(plugin)"
                    />
                </div>
            </Transition>

            <!-- 游离四角取景框：瞬移到悬停的市场卡片 -->
            <CornerFrame ref="frameRef" />

            <!-- 分页（本地插件与市场共用，页码取当前视图的分页状态） -->
            <div
                v-if="!currentLoading && currentCount > 0 && currentPageTotal > 1"
                class="flex justify-center pb-1 pt-4"
            >
                <ZxPagination
                    :page="currentPage"
                    :total-pages="currentPageTotal"
                    :show-total="false"
                    align="center"
                    @change="setCurrentPage"
                />
            </div>
        </div>

        <!-- 配置弹窗 -->
        <PluginConfigModal
            v-model:visible="configModalVisible"
            :module="currentPluginModule"
            :plugin-name="currentPluginName"
            @updated="handleConfigUpdated"
        />
    </div>
</template>

<style scoped>
/* 果冻动画样式已在 custom.css 中统一定义 */
</style>
