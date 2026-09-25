/**
 * 菜单配置
 * 集中管理侧边栏菜单项配置
 */

import { reactive } from "vue";
import type { Component } from "vue";
import {
    Activity,
    Blocks,
    Bot,
    ChartBar,
    Cpu,
    FileCode,
    FlaskConical,
    HardDrive,
    LayoutPanelLeft,
    MessageSquareMore,
    Package,
    PieChart,
    Settings,
    Sparkles,
    BrainCircuit,
    SlidersHorizontal,
    Terminal,
} from "lucide-vue-next";

export interface MenuItem {
    /** 菜单名称 */
    name: string;
    /** 菜单唯一标识（用于路由匹配） */
    key: string;
    /** 菜单图标 */
    icon?: Component;
    /** 路由路径 */
    path?: string;
    /** 外部链接：点击时新窗口打开而不走路由（如 OneBot 模拟端） */
    external?: boolean;
    /** 以命名 popup 独立窗口打开（无标签栏，应用窗口感），值为窗口名 */
    externalWindow?: string;
    /** 子菜单 */
    children?: MenuItem[];
    /** 是否隐藏 */
    hidden?: boolean;
}

/** OneBot Bot 端（模拟端）路由地址（主站 /bot 路由，弹窗窗口加载，改代码无需单独构建） */
export const BOT_CLIENT_URL = `${window.location.origin}${import.meta.env.BASE_URL}bot`;

/**
 * 以独立应用窗口（popup，无标签栏/地址栏）打开外部页面，
 * 使用命名窗口，重复点击会复用并聚焦同一个窗口。
 * 尺寸跟随主站窗口的比例（90%），并相对主站窗口居中
 */
export const openExternalWindow = (url: string, windowName: string) => {
    const width = Math.max(480, Math.round(window.innerWidth * 0.9));
    const height = Math.max(600, Math.round(window.innerHeight * 0.9));
    const left = Math.max(0, window.screenX + (window.innerWidth - width) / 2);
    const top = Math.max(0, window.screenY + (window.innerHeight - height) / 2);
    window.open(
        url,
        windowName,
        `noopener,popup=yes,width=${width},height=${height},left=${left},top=${top}`,
    );
};

/**
 * 打开 Bot 端（模拟端）；已打开过则直接聚焦原窗口（不会重载页面、连接不断）。
 * 返回 false 表示窗口被浏览器弹窗拦截。
 *
 * 注意必须只做一次 window.open：老实现的"空白探针→关闭→再开"一次点击连开
 * 两个窗口，容易被 Chrome 的弹窗拦截规则吃掉第二个。这里改为持有窗口引用
 * （因此不能带 noopener），活着就聚焦，否则新开
 */
let botClientWindow: Window | null = null;

export const openBotClient = (): boolean => {
    if (botClientWindow && !botClientWindow.closed) {
        botClientWindow.focus();
        return true;
    }
    botClientWindow = null;

    const width = Math.max(480, Math.round(window.innerWidth * 0.9));
    const height = Math.max(600, Math.round(window.innerHeight * 0.9));
    const left = Math.max(0, window.screenX + (window.innerWidth - width) / 2);
    const top = Math.max(0, window.screenY + (window.innerHeight - height) / 2);
    botClientWindow = window.open(
        BOT_CLIENT_URL,
        "zhenxun-bot-client",
        `popup=yes,width=${width},height=${height},left=${left},top=${top}`,
    );
    return botClientWindow != null;
};

/**
 * 主菜单配置
 *
 * 使用 reactive 包裹，便于运行时动态注册菜单（如插件注册二级菜单）
 */
export const mainMenus = reactive<MenuItem[]>([
    {
        name: "首页",
        key: "dashboard",
        icon: LayoutPanelLeft,
        path: "/dashboard",
    },
    {
        name: "联系人",
        key: "chat",
        icon: MessageSquareMore,
        path: "/chat",
    },
    {
        name: "插件",
        key: "plugin",
        icon: Blocks,
        children: [
            {
                name: "本地插件",
                key: "plugin-local",
                icon: Blocks,
                path: "/plugin?tab=local&subKey=plugin-local",
            },
            {
                name: "插件市场",
                key: "plugin-market",
                icon: Package,
                path: "/plugin?tab=market&subKey=plugin-market",
            },
        ],
    },
    {
        name: "系统管理",
        key: "files",
        icon: HardDrive,
        path: "/files",
    },
    {
        name: "配置",
        key: "config",
        icon: Settings,
        children: [
            {
                name: "大模型配置",
                key: "config-ai",
                icon: BrainCircuit,
                path: "/config?tab=ai&subKey=config-ai",
            },
            {
                name: "环境配置",
                key: "config-env",
                icon: SlidersHorizontal,
                path: "/config?tab=env&subKey=config-env",
            },
        ],
    },
    {
        name: "统计",
        key: "stats",
        icon: ChartBar,
        children: [
            {
                name: "数据统计",
                key: "analytics",
                icon: PieChart,
                path: "/analytics?subKey=analytics",
            },
        ],
    },
    // 扩展菜单仅在开发环境展示，生产打包时完全剔除
    ...(import.meta.env.DEV
        ? [
              {
                  name: "扩展",
                  key: "extensions",
                  icon: FlaskConical,
                  children: [
                      {
                          name: "扩展实验室",
                          key: "ext-test",
                          icon: Sparkles,
                          path: "/ext/test?subKey=ext-test",
                      },
                      {
                          name: "脚本工作台",
                          key: "ext-scripts",
                          icon: Terminal,
                          path: "/ext/test?subKey=ext-scripts",
                      },
                      {
                          name: "模型测试场",
                          key: "ext-model",
                          icon: Bot,
                          path: "/ext/test?subKey=ext-model",
                      },
                      {
                          name: "算力与芯片",
                          key: "ext-compute",
                          icon: Cpu,
                          path: "/ext/test?subKey=ext-compute",
                      },
                      {
                          name: "网络与探针",
                          key: "ext-network",
                          icon: Activity,
                          path: "/ext/test?subKey=ext-network",
                      },
                      {
                          name: "自定义工具",
                          key: "ext-custom",
                          path: "/ext/test?subKey=ext-custom",
                      },
                  ],
              },
          ]
        : []),
]);

/**
 * 获取菜单项通过 key（含二级菜单）
 */
export function getMenuByKey(key: string): MenuItem | undefined {
    for (const menu of mainMenus) {
        if (menu.key === key) return menu;
        const child = menu.children?.find((item) => item.key === key);
        if (child) return child;
    }
    return undefined;
}

/** 所有菜单 key 按侧边栏视觉顺序（父项在前、子项随后）映射为序号 */
export function getMenuOrderMap(): Record<string, number> {
    const orderMap: Record<string, number> = {};
    let index = 0;
    for (const menu of mainMenus) {
        orderMap[menu.key] = index++;
        for (const child of menu.children ?? []) {
            orderMap[child.key] = index++;
        }
    }
    return orderMap;
}

/**
 * 运行时注册菜单项（供插件注册二级菜单使用）
 *
 * @param item 要注册的菜单项
 * @param parentKey 传入时挂载为该一级菜单的二级菜单，否则作为一级菜单追加
 * @returns 是否注册成功（key 重复或找不到父级时失败）
 */
export function registerMenuItem(item: MenuItem, parentKey?: string): boolean {
    if (getMenuByKey(item.key)) return false;

    if (!parentKey) {
        mainMenus.push(item);
        return true;
    }

    const parent = mainMenus.find((menu) => menu.key === parentKey);
    if (!parent) return false;

    (parent.children ??= []).push(item);
    return true;
}
