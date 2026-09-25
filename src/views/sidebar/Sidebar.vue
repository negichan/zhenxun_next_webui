<script setup lang="ts">
import { watch } from "vue";
import { useRoute } from "vue-router";
import { useGlobalStore } from "@/store/global.js";
import { mainMenus } from "@/config/menu";

// 引入刚刚提取的组件 (根据你的实际路径调整)
import SidebarLogo from "./SidebarLogo.vue";
import SidebarMenuItem from "./SidebarMenuItem.vue";

const route = useRoute();
const globalStore = useGlobalStore();

// 监听路由变化，同步 Pinia 中的 activeMenuKey（优先取 query.subKey 定位子菜单）
watch(
    () => [route.path, route.meta.menuKey, route.query.subKey, route.query.tab] as const,
    ([path, newKey, subKey, tab]) => {
        if (subKey && typeof subKey === "string") {
            globalStore.setActiveMenuKey(subKey);
        } else if (path === "/plugin") {
            globalStore.setActiveMenuKey(
                tab === "market" ? "plugin-market" : "plugin-local",
            );
        } else if (path === "/config") {
            globalStore.setActiveMenuKey(
                tab === "env" ? "config-env" : "config-ai",
            );
        } else if (newKey) {
            globalStore.setActiveMenuKey(newKey as string);
        }
    },
    { immediate: true },
);
</script>

<template>
    <div class="flex h-full w-full flex-col items-center select-none">
        <div
            v-tile-glow="120"
            class="top relative flex w-full min-h-0 flex-1 flex-col items-center overflow-hidden border border-slate-200 bg-white py-3 shadow-sm transition-[padding,border-radius] duration-[400ms] ease-in-out sm:rounded-3xl sm:py-8"
        >
            <SidebarLogo />

            <div
                class="menus gutter relative w-full min-h-0 flex-1 snap-y snap-mandatory scroll-py-4 space-y-4 scroll-smooth text-sm transition-[padding] duration-[400ms] ease-in-out"
                :class="
                    globalStore.navMini
                        ? 'no-scrollbar px-2 py-4'
                        : 'p-4'
                "
            >
                <SidebarMenuItem
                    v-for="item in mainMenus"
                    :key="item.key"
                    :item="item"
                />
            </div>

        </div>
    </div>
</template>

<style scoped>
.no-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
}
.no-scrollbar::-webkit-scrollbar {
    display: none;
}

/* 触控始终可滚；真鼠标桌面悬停才出滚动条。
   不能只靠 hover:overflow-y-auto——触控设备没有 hover。 */
.menus {
    overflow-y: auto;
    overscroll-behavior: contain;
    touch-action: pan-y;
    -webkit-overflow-scrolling: touch;
}

@media (hover: hover) and (pointer: fine) {
    .menus {
        overflow-y: hidden;
    }

    .menus:hover {
        overflow-y: auto;
    }
}
</style>
