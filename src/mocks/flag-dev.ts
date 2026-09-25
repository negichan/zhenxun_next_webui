// Dev 环境 virtual:mock-mode 指向本文件：
// MOCK_MODE 恒为 true（mock 代码进入 dev 包），是否真正接管请求由 isMockEnabled()
// 运行时读 localStorage 决定，设置 → 实验性功能中可切换（切换后刷新生效）
const KEY = "zx_mock_mode";

export const MOCK_MODE = true as const;

export function isMockEnabled(): boolean {
    try {
        return localStorage.getItem(KEY) === "1";
    } catch {
        return false;
    }
}

export function setMockEnabled(on: boolean): void {
    try {
        localStorage.setItem(KEY, on ? "1" : "0");
    } catch {
        // ignore
    }
}
