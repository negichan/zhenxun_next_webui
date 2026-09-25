// 爆炸方向类型
export type ZXConfettiDirection = 'all' | 'up' | 'down' | 'left' | 'right'

// 定义类型：函数 + 静态方法
export type ZXConfettiFn = ((options?: ZXConfettiOptions) => void) & {
    atMouse: (options?: ZXConfettiOptions) => void
    atElement: (el: HTMLElement, options?: ZXConfettiOptions) => void
    clear: () => void
    success: (options?: ZXConfettiOptions) => void
    error: (options?: ZXConfettiOptions) => void
    fireworks: () => void
    cannons: (options?: ZXConfettiOptions) => void
    // 方向快捷方法
    all: (options?: ZXConfettiOptions) => void
    up: (options?: ZXConfettiOptions) => void
    down: (options?: ZXConfettiOptions) => void
    left: (options?: ZXConfettiOptions) => void
    right: (options?: ZXConfettiOptions) => void
}

// 🎉 Confetti 参数类型
export interface ZXConfettiOptions {
    x?: number
    y?: number
    total?: number
    colors?: string[]
    emojiList?: string[]
    useEmoji?: boolean
    direction?: ZXConfettiDirection
    angle?: number
    spread?: number
    startVelocity?: number
    gravity?: number
    decay?: number
    ticks?: number
    scalar?: number
    zIndex?: number
    [key: string]: any // 允许扩展
}

// Confetti.vue 暴露的 API 类型
export interface ZXConfettiExposed {
    launch: (x: number, y: number, options?: ZXConfettiOptions) => void
    clear: () => void
}