import { defineConfig } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin, ViteDevServer } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import AutoImport from "unplugin-auto-import/vite";
import Components from "unplugin-vue-components/vite";
// import minipic from "vite-plugin-minipic";
import compression from "vite-plugin-compression2";

// https://vite.dev/config/
// ==================== Mock 模式 ====================
// 仅 dev 暴露、不参与生产打包：
// - serve：virtual:mock-* 指向运行时开关 + 真实 mock server，设置 → 实验性功能中切换
// - build：恒指向空实现，src/mocks 不会进入产物
// ===========================================================

// ==================== 白屏开关 ====================
// 登录/启动时的白幕与"未检测到协议端"红屏开关（dev 与 build 都生效）：
// 开启后无协议端接入会被红屏直接拦下，不再进入主站
const WHITE_SCREEN = true;
// ===========================================================

// ==================== 开发期页面导航闸门 ====================
// 与生产部署在后端 dist 的伺服层闸门（zhenxun-plugin/config.py 的
// webui_next_page_gate）行为保持一致：页面导航（Accept 含 text/html）
// 除 /login 外必须携带 zx_auth 会话 cookie（登录后由前端写入），
// 否则 302 到 /login。dev 在本机跑，只查 cookie 存在性不验 JWT 签名
// （签名校验由后端 API/WS 鉴权负责，这里只求行为与部署后一致可测试）
function devPageGate(): Plugin {
    return {
        name: "dev-page-gate",
        apply: "serve",
        configureServer(server: ViteDevServer) {
            server.middlewares.use(
                (req: IncomingMessage, res: ServerResponse, next: () => void) => {
                    const accept = String(req.headers?.accept ?? "");
                    const path =
                        (req.url ?? "/").split("?")[0].replace(/\/+$/, "") ||
                        "/";
                    const exempt = ["/login", "/bot", "/ui"];
                    if (accept.includes("text/html") && !exempt.includes(path)) {
                        const cookies = Object.fromEntries(
                            String(req.headers?.cookie ?? "")
                                .split(";")
                                .filter(Boolean)
                                .map((pair) => {
                                    const idx = pair.indexOf("=");
                                    return [
                                        pair.slice(0, idx).trim(),
                                        decodeURIComponent(
                                            pair.slice(idx + 1),
                                        ),
                                    ];
                                }),
                        );
                        if (!cookies["zx_auth"]) {
                            // gate=1/redirect 与后端闸门语义一致：
                            // 已登录但 cookie 缺失的老会话由前端守卫
                            // 静默送回原页面
                            res.statusCode = 302;
                            res.setHeader(
                                "Location",
                                `/login?gate=1&redirect=${encodeURIComponent(path)}`,
                            );
                            res.end();
                            return;
                        }
                    }
                    next();
                },
            );
        },
    };
}
// ===========================================================

export default defineConfig(({ command }) =>({
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
            components: fileURLToPath(
                new URL("./src/components", import.meta.url),
            ),
            // Mock 注入载体：
            // dev  → flag-dev（运行时 localStorage 开关）+ server（真实 mock 适配器）
            // build → flag-off + empty-adapter，src/mocks 不进产物
            ...(command === "serve"
                ? {
                      "virtual:mock-mode": fileURLToPath(
                          new URL("./src/mocks/flag-dev.ts", import.meta.url),
                      ),
                      "virtual:mock-api": fileURLToPath(
                          new URL("./src/mocks/server.ts", import.meta.url),
                      ),
                  }
                : {
                      "virtual:mock-mode": fileURLToPath(
                          new URL("./src/mocks/flag-off.ts", import.meta.url),
                      ),
                      "virtual:mock-api": fileURLToPath(
                          new URL(
                              "./src/mocks/empty-adapter.ts",
                              import.meta.url,
                          ),
                      ),
                  }),
            // 白屏开关注入载体：WhiteScreen 服务与登录流程 import
            // { WHITE_SCREEN_ENABLED } from "virtual:white-screen" 拿到编译期常量
            ...(WHITE_SCREEN
                ? {
                      "virtual:white-screen": fileURLToPath(
                          new URL(
                              "./src/components/zxcomponent/WhiteScreen/flag-on.ts",
                              import.meta.url,
                          ),
                      ),
                  }
                : {
                      "virtual:white-screen": fileURLToPath(
                          new URL(
                              "./src/components/zxcomponent/WhiteScreen/flag-off.ts",
                              import.meta.url,
                          ),
                      ),
                  }),
        },
    },
    plugins: [
        devPageGate(),
        vue(),
        tailwindcss(),
        AutoImport({
            imports: ["vue", "vue-router", "pinia"],
            dts: true,
        }),
        Components(),
        // minipic(), // 图片压缩插件
        compression({
            threshold: 2000, // 只有大于 2kb 的文件才压缩
            deleteOriginalAssets: false, // 不删除原文件
            skipIfLargerOrEqual: true, // 如果压缩后 >= 原文件，则不压缩
        }),

        // vueDevTools(), // 开发时 Vue DevTools 支持
        // 编辑器已替换为轻量 textarea 实现，避免 worker 进入构建
    ],
    base: command === "build" ? "/next/" : "/",
    build: {
        // 压缩走 Rolldown 内置 Oxc Minifier（build.minify 默认 'oxc'），
        // 细粒度选项写在 rolldownOptions.output.minify，用户配置会覆盖内部默认值
        rolldownOptions: {
            output: {
                minify: {
                    compress: {
                        dropConsole: true, // 移除 console.*
                        dropDebugger: true, // 移除 debugger;
                    },
                    mangle: true,
                    codegen: true,
                },
                // 原 manualChunks 的分组语义原样迁移（Rolldown 已不支持 manualChunks）。
                // @vue/* 必须独立分组：否则会被 Rolldown 并进依赖它的 vendor_charts
                // （Chart.js），导致所有页面 preload 时都背着图表库
                codeSplitting: {
                    groups: [
                        {
                            name: "vendor_vue_core",
                            test: /node_modules[\\/]@vue[\\/]/,
                        },
                        {
                            name: "vendor_charts",
                            test: /node_modules[\\/](chart\.js|vue-chartjs)/,
                        },
                        {
                            name: "vendor_vue",
                            test: /node_modules[\\/](vue[\\/]|vue-router|pinia)/,
                        },
                        {
                            name: "vendor_animation",
                            test: /node_modules[\\/]gsap/,
                        },
                        {
                            name: "vendor_icons",
                            test: /node_modules[\\/]lucide-vue-next/,
                        },
                        {
                            name: "vendor_utils",
                            test: /node_modules[\\/](axios|js-yaml)/,
                        },
                    ],
                },
            },
        },
    },
    server: {
        host: "::", // 监听所有 IPv4 和 IPv6 地址（等同于 0.0.0.0）
        // Windows Hyper-V/WSNAT 保留了 TCP 5121-5220（含 Vite 默认 5173），
        // 监听会 EACCES；固定到范围外端口，避免反复撞保留段
        port: 3000,
        strictPort: true,
        proxy: {
            // 开发期把 API / WS 反代到本机 8080 后端
            "/zhenxun": {
                target: "http://127.0.0.1:8080",
                changeOrigin: true,
                ws: true,
            },
        },
    },
}));
