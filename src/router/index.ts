import { ref } from "vue";
import {
    createRouter,
    createWebHistory,
    type NavigationGuardNext,
    type RouteLocationNormalized,
    type Router,
} from "vue-router";
import { ZXNotification } from "@/services/ui";
import { auth } from "@/utils/auth";
import { eventBus } from "@/events/eventBus.ts";
import { useThemeStore } from "@/store/theme";

const routes = [
    {
        path: "/login",
        name: "Login",
        component: () => import("@/pages/Login.vue"),
    },
    {
        path: "/bot",
        name: "Bot",
        // OneBot Bot 端（模拟端）：弹窗窗口加载主站同包的该路由，
        // 自带登录与后端指向，不走主站登录守卫
        component: () => import("@/views/onebot/OneBotShell.vue"),
    },
    // UI 组件与设计规范独立页面：仅在开发期注册，生产构建不打包
    ...(import.meta.env.DEV
        ? [
              {
                  path: "/ui",
                  name: "UI",
                  component: () => import("@/views/ui/UI.vue"),
              },
          ]
        : []),
    {
        path: "/",
        name: "Home",
        component: () => import("@/pages/Home.vue"),
        redirect: "/dashboard",
        children: [
            {
                path: "/dashboard",
                name: "首页",
                component: () => import("@/views/dashboard/Dashboard.vue"),
                meta: { menuKey: "dashboard" },
            },
            {
                path: "/analytics",
                name: "数据统计",
                component: () => import("@/views/analytics/Analytics.vue"),
                meta: { menuKey: "analytics" },
            },
            // 调试页已独立为 OneBot 调试客户端（/debug/，独立构建），
            // 菜单项跳转新窗口，不再挂主站路由
            {
                path: "/chat",
                name: "联系人",
                component: () => import("@/views/chat/Chat.vue"),
                meta: { menuKey: "chat" },
            },
            {
                path: "/plugin",
                name: "插件",
                component: () => import("@/views/plugin/Plugin.vue"),
                meta: { menuKey: "plugin" },
            },
            {
                path: "/store",
                name: "插件商店",
                redirect: {
                    path: "/plugin",
                    query: { tab: "market", subKey: "plugin-market" },
                },
            },
            {
                path: "/files",
                name: "系统管理",
                component: () => import("@/views/files/Files.vue"),
                meta: { menuKey: "files" },
            },
            // 旧数据库页已下线，能力并入文件编辑器；文件暂留 src/views/database
            // {
            //     path: "/database",
            //     name: "数据库",
            //     component: () => import("@/views/database/Database.vue"),
            //     meta: { menuKey: "database" },
            // },
            {
                path: "/logs",
                redirect: "/dashboard",
            },
            // 扩展测试页仅服务开发期：生产构建整段剔除，产物中不打包该页面与路由
            ...(import.meta.env.DEV
                ? [
                      {
                          path: "/ext/test",
                          name: "扩展测试",
                          component: () =>
                              import("@/views/extension/ExtensionTest.vue"),
                          meta: { menuKey: "ext-test" },
                      },
                  ]
                : []),
            {
                path: "/config",
                name: "配置",
                component: () => import("@/views/config/Config.vue"),
                meta: { menuKey: "config" },
            },
            {
                path: "/manage",
                name: "管理",
                redirect: "/chat",
                meta: { menuKey: "manage" },
            },
        ],
    },
    {
        path: "/:pathMatch(.*)",
        redirect: {
            name: "Home",
        },
    },
];

export const router: Router = createRouter({
    history: createWebHistory(import.meta.env.PROD ? "/next/" : "/"),
    routes,
});

// ==================== 导航加载状态 ====================
// 异步路由组件在导航确认前要等 chunk 下载完成，期间旧页面原样停留，
// 表现为"点了没反应"。这里暴露全局加载标记给布局层画进度条
export const routeLoading = ref(false);

router.beforeEach(() => {
    routeLoading.value = true;
});

router.afterEach(() => {
    routeLoading.value = false;
});

router.onError(() => {
    routeLoading.value = false;
});

/** 悬停预取：提前加载目标路由的异步组件，点击切换时秒开 */
export const prefetchRoute = (path: string) => {
    try {
        for (const record of router.resolve(path).matched) {
            const component: any = record.components?.default;
            if (typeof component === "function") {
                Promise.resolve(component()).catch(() => {
                    /* 预取失败静默忽略，点击时自然重试 */
                });
            }
        }
    } catch {
        /* 非法路径忽略 */
    }
};

router.beforeEach(
    (
        to: RouteLocationNormalized,
        from: RouteLocationNormalized,
        next: NavigationGuardNext,
    ) => {
        const isAuthenticated = auth.getAuthState();
        const themeStore = useThemeStore();

        // 已登录但会话 cookie 缺失/过期（如被单独清理）时补写，
        // 避免伺服层页面闸门把已登录用户挡在登录页外
        if (isAuthenticated) {
            auth.syncSessionCookie();
        }

        // 如果访问的是配置页，直接放行
        if (to.name === "Configure") {
            return next();
        }

        // 如果用户认证了但是又前往登录页，则阻止他
        // （红屏拦截态除外：红屏期间路由退回登录页是白屏组件主动为之；
        //   闸门弹回除外：已登录但会话 cookie 缺失时被伺服层 302 到
        //   /login?gate=1，这里静默送回原页面——补写 cookie 自愈，不弹通知）
        if (to.name === "Login" && isAuthenticated) {
            if (auth.hasWhiteGate()) {
                // 放行：白屏拦截态
            } else if (to.query.gate) {
                const raw =
                    typeof to.query.redirect === "string"
                        ? to.query.redirect
                        : "";
                const base = router.options.history.base ?? "";
                let target =
                    raw.startsWith("/") && !raw.startsWith("//")
                        ? raw
                        : "/dashboard";
                // 生产环境伺服路径带 /next 前缀，router 内部路径不含 base
                if (base && target.startsWith(base)) {
                    target = target.slice(base.length) || "/";
                }
                return next(target);
            } else {
                ZXNotification({
                    title: "哼唧",
                    message: "哥哥这就嫌弃人家了吗？(ノへ￣、))",
                    type: "error",
                    confetti: true,
                });

                // 显式跳回之前的路径：站内跳来的用 from；地址栏直入
                // /login 时 from 是空的，用本标签页最后的应用内路径兜底。
                // next(false) 在直入场景下 URL 会停在 /login 而页面留在
                // 原地，造成"路径是 login、人还在主页"的错位
                const fromPath =
                    from.fullPath && from.fullPath !== "/"
                        ? from.fullPath
                        : "";
                const lastPath = sessionStorage.getItem(LAST_PATH_KEY) ?? "";
                const fallback = [fromPath, lastPath].find(
                    (p) =>
                        p &&
                        p.startsWith("/") &&
                        !p.startsWith("/login") &&
                        !p.startsWith("//"),
                );
                return next(fallback || "/dashboard");
            }
        }

        // 登录页强制亮色主题
        if (to.name === "Login") {
            themeStore.forceApplyLight();
        } else if (from.name === "Login") {
            themeStore.restoreSavedTheme();
        }

        // 如果用户未认证且尝试访问非登录页面，则重定向到登录页
        // 未认证不允许进业务页面（/bot 是独立 Bot 端；/ui 是独立设计规范页，均豁免）
        if (
            to.name !== "Login" &&
            to.name !== "Bot" &&
            to.name !== "UI" &&
            !isAuthenticated
        ) {
            if (to.path === "/") {
                ZXNotification({
                    title: "欢迎光临~",
                    message: "请先登录哦 (｡･ω･｡)",
                    type: "success",
                    confetti: true,
                });
            } else {
                // 从其他页面跳转过来
                ZXNotification({
                    title: "哎呦喂",
                    message: "您可还没登录呢~（〃｀3′〃）",
                    type: "error",
                    confetti: true,
                });
            }
            auth.deleteAuthToken();

            return next("/login");
        } else {
            next();
        }
    },
);

eventBus.on("LOGIN:SUCCESS", () => {
    router.push({ name: "Home" });
});

// 记录本标签页最后停留的应用内路径：已登录访问 /login 被拦时
// "跳回之前的路径"——地址栏直入 /login 的场景下导航起点是空的，
// 路由不知道之前在哪，只能靠这里补
const LAST_PATH_KEY = "zxLastPath";

router.afterEach((to) => {
    if (to.name !== "Login") {
        sessionStorage.setItem(LAST_PATH_KEY, to.fullPath);
    }
});
