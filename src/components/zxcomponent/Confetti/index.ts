import confetti from 'canvas-confetti'
import type { ZXConfettiOptions, ZXConfettiFn, ZXConfettiDirection } from './types'
import { animationsEnabled } from '@/store/global'

// 记录最近鼠标坐标，使用 passive 监听器提升滚动与输入性能
let mouseX = typeof window !== 'undefined' ? window.innerWidth / 2 : 0
let mouseY = typeof window !== 'undefined' ? window.innerHeight / 2 : 0

if (typeof window !== 'undefined') {
    window.addEventListener(
        'mousemove',
        (e) => {
            mouseX = e.clientX
            mouseY = e.clientY
        },
        { passive: true }
    )
}

// 缓存已转换的 emoji shape，避免每帧重复创建与解析字体
const shapeCache = new Map<string, confetti.Shape>()

function getEmojiShape(text: string): confetti.Shape | undefined {
    if (typeof confetti.shapeFromText !== 'function') return undefined
    try {
        let shape = shapeCache.get(text)
        if (!shape) {
            shape = confetti.shapeFromText({ text, scalar: 2 })
            shapeCache.set(text, shape)
        }
        return shape
    } catch {
        return undefined
    }
}

interface DirectionPreset {
    angle: number
    spread: number
    startVelocity: number
    gravity: number
    decay: number
    ticks?: number
    total?: number
}

// 各方向预设参数配置
const DIRECTION_PRESETS: Record<ZXConfettiDirection, DirectionPreset> = {
    // 默认：全向 360° 炸开（紧凑清爽微爆，约 18 颗粒子）
    all: {
        angle: 0,
        spread: 360,
        startVelocity: 18,
        gravity: 0.8,
        decay: 0.88,
        ticks: 140,
        total: 18,
    },
    // 向上喷射（经典礼炮）
    up: {
        angle: 90,
        spread: 75,
        startVelocity: 40,
        gravity: 1,
        decay: 0.9,
        ticks: 180,
        total: 25,
    },
    // 向下倾泻（彩屑雨）
    down: {
        angle: 270,
        spread: 75,
        startVelocity: 20,
        gravity: 1.2,
        decay: 0.95,
        ticks: 160,
        total: 20,
    },
    // 向左喷射
    left: {
        angle: 180,
        spread: 60,
        startVelocity: 28,
        gravity: 0.8,
        decay: 0.9,
        ticks: 160,
        total: 20,
    },
    // 向右喷射
    right: {
        angle: 0,
        spread: 60,
        startVelocity: 28,
        gravity: 0.8,
        decay: 0.9,
        ticks: 160,
        total: 20,
    },
}

/**
 * 核心发射方法：基于工业级 canvas-confetti 引擎驱动
 * 硬件级 Canvas 加速、零 DOM 节点残留、120FPS 丝滑不掉帧
 */
function baseConfetti(options: ZXConfettiOptions = {}): void {
    if (!animationsEnabled()) return

    const winW = window.innerWidth || document.documentElement.clientWidth || 1
    const winH = window.innerHeight || document.documentElement.clientHeight || 1

    const x = options.x ?? mouseX
    const y = options.y ?? mouseY
    const useEmoji = options.useEmoji ?? false
    const emojiList = options.emojiList ?? ['🎉', '✨', '💥', '🎊']
    const colors = options.colors ?? ['#f87171', '#60a5fa', '#34d399', '#fbbf24', '#a78bfa', '#f472b6']

    const direction: ZXConfettiDirection = options.direction ?? 'all'
    const preset = DIRECTION_PRESETS[direction] || DIRECTION_PRESETS.all

    const total = options.total ?? preset.total ?? 18
    const angle = options.angle ?? preset.angle
    const spread = options.spread ?? preset.spread
    const startVelocity = options.startVelocity ?? preset.startVelocity
    const gravity = options.gravity ?? preset.gravity
    const decay = options.decay ?? preset.decay
    const ticks = options.ticks ?? preset.ticks ?? 160

    const origin = {
        x: Math.min(Math.max(x / winW, 0), 1),
        y: Math.min(Math.max(y / winH, 0), 1),
    }

    let shapes: confetti.Shape[] = ['square', 'circle']
    if (useEmoji && emojiList.length) {
        const emojiShapes = emojiList.map(getEmojiShape).filter(Boolean) as confetti.Shape[]
        if (emojiShapes.length > 0) {
            shapes = emojiShapes
        }
    }

    confetti({
        particleCount: Math.min(Math.max(total, 1), 200),
        angle,
        spread,
        startVelocity,
        gravity,
        decay,
        ticks,
        origin,
        colors,
        shapes,
        scalar: options.scalar ?? (useEmoji ? 1.5 : 1),
        zIndex: options.zIndex ?? 99999,
        disableForReducedMotion: true,
    })
}

const ZXConfetti = ((options?: ZXConfettiOptions) => {
    baseConfetti(options ?? {})
}) as ZXConfettiFn

ZXConfetti.atMouse = function (options: ZXConfettiOptions = {}) {
    ZXConfetti({ x: mouseX, y: mouseY, ...options })
}

ZXConfetti.atElement = function (el: HTMLElement, options: ZXConfettiOptions = {}) {
    const rect = el.getBoundingClientRect()
    const x = rect.width > 0 ? rect.left + rect.width / 2 : window.innerWidth / 2
    const y = rect.height > 0 ? rect.top + rect.height / 2 : 80
    ZXConfetti({ x, y, ...options })
}

ZXConfetti.clear = function () {
    confetti.reset()
}

// 常用方向快捷调用方法（默认以当前鼠标位置为中心）
ZXConfetti.all = (options?: ZXConfettiOptions) => ZXConfetti.atMouse({ direction: 'all', ...options })
ZXConfetti.up = (options?: ZXConfettiOptions) => ZXConfetti.atMouse({ direction: 'up', ...options })
ZXConfetti.down = (options?: ZXConfettiOptions) => ZXConfetti.atMouse({ direction: 'down', ...options })
ZXConfetti.left = (options?: ZXConfettiOptions) => ZXConfetti.atMouse({ direction: 'left', ...options })
ZXConfetti.right = (options?: ZXConfettiOptions) => ZXConfetti.atMouse({ direction: 'right', ...options })

// 风格预设（精致克制粒子量）
ZXConfetti.success = (options?: ZXConfettiOptions) =>
    ZXConfetti.atMouse({
        total: 20,
        colors: ['#34d399', '#10b981', '#6ee7b7'],
        emojiList: ['✅', '🎉', '👍'],
        useEmoji: true,
        direction: 'all',
        ...options,
    })

ZXConfetti.error = (options?: ZXConfettiOptions) =>
    ZXConfetti.atMouse({
        total: 20,
        colors: ['#f87171', '#ef4444', '#dc2626'],
        emojiList: ['❌', '💥', '😵'],
        useEmoji: true,
        direction: 'all',
        ...options,
    })

// 双侧全屏礼炮（从左右下角对轰）
ZXConfetti.cannons = (options?: ZXConfettiOptions) => {
    if (!animationsEnabled()) return
    const colors = options?.colors ?? ['#60a5fa', '#fbbf24', '#a78bfa', '#34d399', '#f87171', '#38bdf8']
    const count = options?.total ?? 28

    // 左下角向右上
    confetti({
        particleCount: count,
        angle: 60,
        spread: 55,
        startVelocity: 55,
        origin: { x: 0, y: 0.88 },
        colors,
        zIndex: options?.zIndex ?? 99999,
        disableForReducedMotion: true,
    })
    // 右下角向左上
    confetti({
        particleCount: count,
        angle: 120,
        spread: 55,
        startVelocity: 55,
        origin: { x: 1, y: 0.88 },
        colors,
        zIndex: options?.zIndex ?? 99999,
        disableForReducedMotion: true,
    })
}

// 庆典全向烟花
ZXConfetti.fireworks = () => {
    if (!animationsEnabled()) return
    const winW = window.innerWidth || 1
    const winH = window.innerHeight || 1
    const origin = {
        x: Math.min(Math.max(mouseX / winW, 0), 1),
        y: Math.min(Math.max(mouseY / winH, 0), 1),
    }

    const emojiShapes = ['🎆', '✨', '🎇', '💫'].map(getEmojiShape).filter(Boolean) as confetti.Shape[]

    // 双重爆发全向烟花效果 (360度紧凑微绽放)
    confetti({
        particleCount: 22,
        spread: 360,
        startVelocity: 22,
        gravity: 0.75,
        decay: 0.89,
        origin,
        shapes: emojiShapes.length ? emojiShapes : ['circle'],
        scalar: 1.5,
        ticks: 150,
        zIndex: 99999,
        disableForReducedMotion: true,
    })
    confetti({
        particleCount: 20,
        spread: 360,
        startVelocity: 17,
        gravity: 0.75,
        decay: 0.89,
        origin,
        colors: ['#60a5fa', '#fbbf24', '#a78bfa', '#34d399', '#f87171', '#38bdf8'],
        shapes: ['square', 'circle'],
        ticks: 150,
        zIndex: 99999,
        disableForReducedMotion: true,
    })
}

export { ZXConfetti }
