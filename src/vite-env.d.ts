/// <reference types="vite/client" />

// Mock 模式：dev 指向 flag-dev（运行时开关），build 指向 flag-off（恒 false，可摇树）
declare module 'virtual:mock-mode' {
    export const MOCK_MODE: boolean
    export function isMockEnabled(): boolean
    export function setMockEnabled(on: boolean): void
}

// Mock 适配器，由 vite.config.ts 的 alias 指向 src/mocks/server.ts / empty-adapter.ts
declare module 'virtual:mock-api' {
    import type { AxiosAdapter } from 'axios'
    export const mockAdapter: AxiosAdapter | undefined
}

// 白屏开关，由 vite.config.ts 的 alias 指向
// WhiteScreen/flag-on.ts / flag-off.ts
declare module 'virtual:white-screen' {
    export const WHITE_SCREEN_ENABLED: boolean
}

declare module '*.vue' {
    import type { DefineComponent } from 'vue'
    const component: DefineComponent<{}, {}, any>
    export default component
}
