// 生产构建时 virtual:mock-mode 指向本文件：
// MOCK_MODE 为编译期常量 false，所有 if (MOCK_MODE && ...) 分支会被摇树移除，
// src/mocks 不会进入产物；isMockEnabled 恒 false，设置页也不会出现 Mock 开关
export const MOCK_MODE = false as const;

export function isMockEnabled(): boolean {
    return false;
}

export function setMockEnabled(_on: boolean): void {
    // no-op
}
