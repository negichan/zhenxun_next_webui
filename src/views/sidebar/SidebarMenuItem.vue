<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { gsap } from "gsap";
import { ChevronRight } from "lucide-vue-next";
import { useGlobalStore } from "@/store/global.js";
import { prefetchRoute, router } from "@/router/index.js";
import { openExternalWindow, type MenuItem } from "@/config/menu";

const props = defineProps<{ item: MenuItem }>();

const globalStore = useGlobalStore();

// 模板引用
const iconRef = ref<HTMLElement | null>(null);
const arrowRef = ref<HTMLElement | null>(null);

// 动画实例（父级）
let breathAnimation: gsap.core.Animation | null = null;
let rightAnimation: gsap.core.Animation | null = null;

// 二级菜单
const hasChildren = computed(() => !!props.item.children?.length);
const expanded = ref(false);
const submenuRef = ref<HTMLElement | null>(null);
let expandTween: gsap.core.Tween | null = null;

const animateSubmenu = (isOpen: boolean, immediate = false) => {
    if (!submenuRef.value) return;

    if (expandTween) {
        expandTween.kill();
        expandTween = null;
    }

    if (immediate || !globalStore.animationsEnabled) {
        if (isOpen) {
            gsap.set(submenuRef.value, {
                height: "auto",
                opacity: 1,
                overflow: "visible",
            });
        } else {
            gsap.set(submenuRef.value, {
                height: 0,
                opacity: 0,
                overflow: "hidden",
            });
        }
        return;
    }

    if (isOpen) {
        expandTween = gsap.to(submenuRef.value, {
            height: "auto",
            opacity: 1,
            duration: 0.3,
            ease: "power2.out",
            onStart: () => {
                if (submenuRef.value) submenuRef.value.style.overflow = "visible";
            },
            onComplete: () => {
                if (submenuRef.value) submenuRef.value.style.overflow = "visible";
                expandTween = null;
            },
        });
    } else {
        expandTween = gsap.to(submenuRef.value, {
            height: 0,
            opacity: 0,
            duration: 0.3,
            ease: "power2.inOut",
            // 收起时不立即切 hidden，保持 visible，直到动画完全播放完毕后再切回 hidden
            onComplete: () => {
                if (submenuRef.value) submenuRef.value.style.overflow = "hidden";
                expandTween = null;
            },
        });
    }
};

watch(
    expanded,
    async (val) => {
        await nextTick();
        animateSubmenu(val);
    },
);

const isChildActive = computed(
    () =>
        props.item.children?.some(
            (child) => child.key === globalStore.activeMenuKey,
        ) ?? false,
);

// 父项仅在自身作为直接激活目标时处于激活态（选中子项后父项完全回归未选中状态）
const isActive = computed(
    () => globalStore.activeMenuKey === props.item.key,
);

const startAnim = () => {
    if (!iconRef.value) return;
    // 动画开关关闭：不播放呼吸/箭头动画
    if (!globalStore.animationsEnabled) return;
    if (globalStore.activeMenuKey) {
        stopAnim();
    }

    breathAnimation = gsap.fromTo(
        iconRef.value,
        { scale: 0.88 },
        {
            scale: 1.12,
            duration: 1.5,
            yoyo: true,
            repeat: -1,
            ease: "sine.inOut",
        },
    );

    if (!globalStore.navMini && !hasChildren.value && arrowRef.value) {
        rightAnimation = gsap.fromTo(
            arrowRef.value,
            { x: -5 },
            { x: 5, duration: 1, yoyo: true, repeat: -1, ease: "sine.inOut" },
        );
    }
};

const stopAnim = () => {
    if (breathAnimation) {
        breathAnimation.kill();
        breathAnimation = null;
        if (iconRef.value) {
            gsap.to(iconRef.value, {
                scale: 1,
                duration: 0.2,
                ease: "power2.out",
            });
        }
    }
    if (rightAnimation) {
        rightAnimation.kill();
        rightAnimation = null;
        if (arrowRef.value) gsap.to(arrowRef.value, { x: 0, duration: 0.2 });
    }
};

// 子项 DOM 引用与动画（完全同构父项动画体系）
const childIconRefs = new Map<string, HTMLElement>();
const childArrowRefs = new Map<string, HTMLElement>();
const childBreathAnims = new Map<string, gsap.core.Animation>();
const childArrowAnims = new Map<string, gsap.core.Animation>();

const setChildIconRef = (key: string, el: any) => {
    if (el) childIconRefs.set(key, el as HTMLElement);
    else childIconRefs.delete(key);
};

const setChildArrowRef = (key: string, el: any) => {
    if (el) childArrowRefs.set(key, el as HTMLElement);
    else childArrowRefs.delete(key);
};

const stopSingleChildAnim = (key: string) => {
    const breath = childBreathAnims.get(key);
    if (breath) {
        breath.kill();
        childBreathAnims.delete(key);
    }
    const arrow = childArrowAnims.get(key);
    if (arrow) {
        arrow.kill();
        childArrowAnims.delete(key);
    }
    const iconEl = childIconRefs.get(key);
    if (iconEl) {
        gsap.to(iconEl, {
            scale: 1,
            duration: 0.2,
            ease: "power2.out",
        });
    }
    const arrowEl = childArrowRefs.get(key);
    if (arrowEl) {
        gsap.to(arrowEl, { x: 0, duration: 0.2 });
    }
};

const startSingleChildAnim = (key: string, includeArrow = false) => {
    if (!globalStore.animationsEnabled) return;

    // 先停止已有的
    const existingBreath = childBreathAnims.get(key);
    if (existingBreath) existingBreath.kill();

    const iconEl = childIconRefs.get(key);
    if (iconEl) {
        const anim = gsap.fromTo(
            iconEl,
            { scale: 0.88 },
            {
                scale: 1.12,
                duration: 1.5,
                yoyo: true,
                repeat: -1,
                ease: "sine.inOut",
            },
        );
        childBreathAnims.set(key, anim);
    }

    if (includeArrow && !globalStore.navMini) {
        const existingArrow = childArrowAnims.get(key);
        if (existingArrow) existingArrow.kill();

        const arrowEl = childArrowRefs.get(key);
        if (arrowEl) {
            const anim = gsap.fromTo(
                arrowEl,
                { x: -4 },
                { x: 4, duration: 1, yoyo: true, repeat: -1, ease: "sine.inOut" },
            );
            childArrowAnims.set(key, anim);
        }
    }
};

const stopAllChildAnims = () => {
    childBreathAnims.forEach((anim) => anim.kill());
    childBreathAnims.clear();
    childArrowAnims.forEach((anim) => anim.kill());
    childArrowAnims.clear();
    childIconRefs.forEach((el) => {
        gsap.to(el, { scale: 1, duration: 0.2 });
    });
    childArrowRefs.forEach((el) => {
        gsap.to(el, { x: 0, duration: 0.2 });
    });
};

// 状态分发：统一处理父级与子级的动画
const updateAllAnimations = () => {
    if (!globalStore.animationsEnabled) {
        stopAnim();
        stopAllChildAnims();
        return;
    }

    if (isChildActive.value) {
        // 核心：选中子项后，父项样式与动画彻底回归未选中状态！
        stopAnim();
        // 停止其他未选中的子项动画
        childBreathAnims.forEach((anim, k) => {
            if (k !== globalStore.activeMenuKey) stopSingleChildAnim(k);
        });
        // 启动选中子项的专属呼吸与滑动箭头动画
        if (globalStore.activeMenuKey) {
            startSingleChildAnim(globalStore.activeMenuKey, true);
        }
    } else if (globalStore.activeMenuKey === props.item.key) {
        stopAllChildAnims();
        startAnim();
    } else {
        stopAnim();
        stopAllChildAnims();
    }
};

// 监听激活状态
watch(
    [
        () => globalStore.activeMenuKey,
        () => globalStore.animationsEnabled,
        () => globalStore.navMini,
        isChildActive,
    ],
    async () => {
        await nextTick();
        updateAllAnimations();
    },
    { immediate: true },
);

// 子项激活时自动展开父级
watch(
    isChildActive,
    (val) => {
        if (val) {
            expanded.value = true;
        }
    },
    { immediate: true },
);

onMounted(async () => {
    await nextTick();
    updateAllAnimations();
    if (hasChildren.value) {
        animateSubmenu(expanded.value, true);
    }
});

// 事件处理
const handleClick = () => {
    if (hasChildren.value) {
        expanded.value = !expanded.value;
        return;
    }
    if (props.item.external) {
        if (!props.item.path) return;
        if (props.item.externalWindow) {
            openExternalWindow(props.item.path, props.item.externalWindow);
        } else {
            window.open(props.item.path, "_blank", "noopener");
        }
        return;
    }
    globalStore.activeMenuKey = props.item.key;
    if (props.item.path) router.push(props.item.path);
};

const handleChildClick = (child: MenuItem) => {
    if (child.external) {
        if (!child.path) return;
        if (child.externalWindow) {
            openExternalWindow(child.path, child.externalWindow);
        } else {
            window.open(child.path, "_blank", "noopener");
        }
        return;
    }
    globalStore.activeMenuKey = child.key;
    if (child.path) router.push(child.path);
};

const handleMouseEnter = () => {
    // 顺手预取目标页的异步组件，消除点击后的 chunk 下载等待
    if (!hasChildren.value && !props.item.external && props.item.path) {
        prefetchRoute(props.item.path);
    }
    if (!isActive.value && !hasChildren.value) startAnim();
};
const handleMouseLeave = () => {
    if (!isActive.value && !hasChildren.value) stopAnim();
};

const handleChildMouseEnter = (child: MenuItem) => {
    // 悬停预加载路由，保证秒开；由纯 CSS 处理悬停浮凸与颜色，避免 JS 动画重排干扰文字
    if (!child.external && child.path) {
        prefetchRoute(child.path);
    }
};

const handleChildMouseLeave = (_child: MenuItem) => {
    // 鼠标移出纯 CSS 恢复，不打扰正在激活的动画
};

// 清理动画，防止内存泄漏
onUnmounted(() => {
    if (expandTween) {
        expandTween.kill();
        expandTween = null;
    }
    stopAnim();
    stopAllChildAnims();
});
</script>

<template>
    <div class="snap-start select-none">
        <!-- 父项菜单 -->
        <div
            v-tile-glow
            class="menus-item group flex cursor-pointer items-center rounded-full border will-change-transform [backface-visibility:hidden] [transform:translateZ(0)] transition-[transform,box-shadow,height,width,padding] duration-[400ms] ease-in-out"
            :class="{
                'h-12 w-12 justify-center p-0': globalStore.navMini,
                'h-14 w-full p-1': !globalStore.navMini,
                'scale-105 border-slate-300 shadow-sm':
                    isActive && !globalStore.navMini,
                'border-transparent': !isActive || globalStore.navMini,
                'hover:scale-105 hover:border-slate-300 hover:shadow-sm':
                    !isActive && !globalStore.navMini,
                'hover:scale-110': globalStore.navMini,
            }"
            @click="handleClick"
            @mouseenter="handleMouseEnter"
            @mouseleave="handleMouseLeave"
        >
            <div
                class="flex shrink-0 items-center justify-center"
                :class="globalStore.navMini ? 'h-12 w-12 p-0' : 'h-12 w-12'"
            >
                <div
                    ref="iconRef"
                    :class="[
                        isActive
                            ? 'bg-zx-nav-icon-hover text-[color:var(--zx-nav-icon-hover-text)] shadow-sm'
                            : 'bg-zx-nav-icon text-zx-text',
                        globalStore.navMini && isActive
                            ? 'border border-slate-300'
                            : 'border border-transparent',
                        globalStore.navMini ? 'h-12 w-12 p-0' : 'h-12 w-12',
                    ]"
                    class="icon flex items-center justify-center rounded-full will-change-transform [backface-visibility:hidden] [transform:translateZ(0)] transition-[background-color,color,border-color,box-shadow] duration-300 ease-in-out group-hover:bg-zx-nav-icon-hover group-hover:text-[color:var(--zx-nav-icon-hover-text)]"
                >
                    <component :is="item.icon" class="h-5 w-5" />
                </div>
            </div>

            <div
                class="right flex min-w-0 flex-1 items-center overflow-hidden will-change-transform [backface-visibility:hidden] [transform:translateZ(0)] transition-[max-width,opacity,padding] duration-[400ms] ease-in-out"
                :class="
                    globalStore.navMini
                        ? 'max-w-0 pl-0 opacity-0'
                        : 'max-w-48 pl-1.5 opacity-100 sm:pl-2'
                "
            >
                <span class="whitespace-nowrap leading-none select-none [transform:translateZ(0)]">
                    {{ item.name }}
                </span>

                <!-- 有二级菜单：展开/收起指示箭头 -->
                <div
                    v-if="hasChildren"
                    class="flex flex-1 justify-end pr-4"
                >
                    <ChevronRight
                        class="h-3 w-3 text-zx-text-subtle transition-transform duration-300 sm:h-4 sm:w-4"
                        :class="expanded ? 'rotate-90' : ''"
                    />
                </div>

                <!-- 无二级菜单：激活态的滑动箭头 -->
                <div
                    v-else
                    ref="arrowRef"
                    :class="[isActive ? 'flex' : 'hidden']"
                    class="arrow-right flex-1 justify-end pr-4"
                >
                    <ChevronRight class="h-3 w-3 text-zx-text-subtle sm:h-4 sm:w-4" />
                </div>
            </div>
        </div>

        <!-- 二级菜单 -->
        <div
            v-if="hasChildren"
            ref="submenuRef"
            class="overflow-hidden opacity-0"
            style="height: 0;"
        >
            <div
                class="flex flex-col gap-2 pt-2 pb-1"
                :class="
                    globalStore.navMini
                        ? 'items-center'
                        : 'pl-4 sm:pl-5 pr-1'
                "
            >
                    <div
                        v-for="child in item.children"
                        :key="child.key"
                        v-tile-glow
                        class="menus-item group/child flex cursor-pointer items-center rounded-full border will-change-transform [backface-visibility:hidden] [transform:translateZ(0)] transition-[transform,box-shadow,height,width,padding] duration-[400ms] ease-in-out"
                        :class="{
                            'h-11 w-11 justify-center p-0': globalStore.navMini,
                            'h-12 w-full p-1': !globalStore.navMini,
                            'scale-105 border-slate-300 shadow-sm':
                                child.key === globalStore.activeMenuKey &&
                                !globalStore.navMini,
                            'border-transparent':
                                child.key !== globalStore.activeMenuKey ||
                                globalStore.navMini,
                            'hover:scale-105 hover:border-slate-300 hover:shadow-sm':
                                child.key !== globalStore.activeMenuKey &&
                                !globalStore.navMini,
                            'hover:scale-110': globalStore.navMini,
                        }"
                        @click.stop="handleChildClick(child)"
                        @mouseenter="handleChildMouseEnter(child)"
                        @mouseleave="handleChildMouseLeave(child)"
                    >
                        <!-- 固定尺寸容器：隔离 icon 内部 GSAP 缩放对 flexbox 交叉轴对齐的动态干扰 -->
                        <div
                            class="flex shrink-0 items-center justify-center"
                            :class="globalStore.navMini ? 'h-11 w-11 p-0' : 'h-10 w-10'"
                        >
                            <div
                                :ref="(el) => setChildIconRef(child.key, el)"
                                :class="[
                                    child.key === globalStore.activeMenuKey
                                        ? 'bg-zx-nav-icon-hover text-[color:var(--zx-nav-icon-hover-text)] shadow-sm'
                                        : 'bg-zx-nav-icon text-zx-text',
                                    globalStore.navMini &&
                                    child.key === globalStore.activeMenuKey
                                        ? 'border border-slate-300'
                                        : 'border border-transparent',
                                    globalStore.navMini
                                        ? 'h-11 w-11 p-0'
                                        : 'h-10 w-10',
                                ]"
                                class="icon flex items-center justify-center rounded-full will-change-transform [backface-visibility:hidden] [transform:translateZ(0)] transition-[background-color,color,border-color,box-shadow] duration-300 ease-in-out group-hover/child:bg-zx-nav-icon-hover group-hover/child:text-[color:var(--zx-nav-icon-hover-text)]"
                            >
                                <component
                                    v-if="child.icon"
                                    :is="child.icon"
                                    class="h-[18px] w-[18px]"
                                />
                                <span
                                    v-else
                                    class="h-2 w-2 rounded-full bg-current"
                                ></span>
                            </div>
                        </div>

                        <div
                            class="right flex min-w-0 flex-1 items-center overflow-hidden will-change-transform [backface-visibility:hidden] [transform:translateZ(0)] transition-[max-width,opacity,padding] duration-[400ms] ease-in-out"
                            :class="
                                globalStore.navMini
                                    ? 'max-w-0 pl-0 opacity-0'
                                    : 'max-w-48 pl-1.5 opacity-100 sm:pl-2'
                            "
                        >
                            <span class="whitespace-nowrap leading-none select-none [transform:translateZ(0)]">
                                {{ child.name }}
                            </span>

                            <!-- 激活态滑动微箭头 -->
                            <div
                                :ref="(el) => setChildArrowRef(child.key, el)"
                                :class="[
                                    child.key === globalStore.activeMenuKey
                                        ? 'flex'
                                        : 'hidden',
                                ]"
                                class="arrow-right flex-1 justify-end pr-3.5"
                            >
                                <ChevronRight
                                    class="h-3 w-3 text-zx-text-subtle sm:h-3.5 sm:w-3.5"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
</template>
