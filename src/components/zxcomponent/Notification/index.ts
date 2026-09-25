import { createVNode, render, ComponentInternalInstance } from 'vue'
import { ZXNotificationFn, ZXNotificationOptions } from './types'


// 🔧 默认设置
const defaultOptions: Required<ZXNotificationOptions> = {
    title: '',
    duration: 3000,
    position: 'top-right',
    type: 'info',
    customClass: '',
    confetti: false,
    message: '',
    avatar: '',
    subtitle: '',
    sticker: '',
    maxVisible: 4,
    dedupe: true,
}

let vm: ComponentInternalInstance | null = null
let loadingPromise: Promise<ComponentInternalInstance | null> | null = null

/** 同文案去重窗口：覆盖重试间隔，避免轮询/失败回调连刷 */
const DEDUP_WINDOW_MS = 8000
const recentNotifyAt = new Map<string, number>()

function notifyKey(type: string, title: string, message: string) {
    const norm = (s: string) => s.trim().replace(/\s+/g, ' ')
    return `${type}|${norm(title)}|${norm(message)}`
}

function shouldEmit(key: string, force: boolean) {
    if (force) return true
    const now = Date.now()
    const last = recentNotifyAt.get(key)
    if (last && now - last < DEDUP_WINDOW_MS) return false
    recentNotifyAt.set(key, now)
    if (recentNotifyAt.size > 300) {
        for (const [k, t] of recentNotifyAt) {
            if (now - t > DEDUP_WINDOW_MS) recentNotifyAt.delete(k)
        }
    }
    return true
}

function ensureMounted(): Promise<ComponentInternalInstance | null> {
    if (vm) return Promise.resolve(vm)
    if (loadingPromise) return loadingPromise

    loadingPromise = import('./Notification.vue').then(({ default: CenterNotification }) => {
        return new Promise<ComponentInternalInstance | null>((resolve) => {
            const container = document.createElement('div')
            document.body.appendChild(container)

            const vnode = createVNode(CenterNotification)
            render(vnode, container)

            const checkReady = () => {
                const instance = vnode.component
                if (instance && instance.exposed && (instance.exposed as any).addNotification) {
                    vm = instance
                    resolve(vm)
                } else {
                    requestAnimationFrame(checkReady) // 等待下个 tick
                }
            }

            checkReady()
        })
    })

    return loadingPromise
}



// 主函数实现
const ZXNotification = ((options: ZXNotificationOptions | string) => {
        const finalOptions: ZXNotificationOptions =
            typeof options === 'string'
                ? { ...defaultOptions, message: options }
                : { ...defaultOptions, ...options }

        // 同 type+title+message 在短时间内只弹一次，避免轮询/重试连刷
        const key = notifyKey(
            finalOptions.type || 'info',
            finalOptions.title || '',
            finalOptions.message || '',
        )
        if (!shouldEmit(key, finalOptions.dedupe === false)) return

        ensureMounted().then((comp) => {
            ;(comp?.exposed as any)?.addNotification(finalOptions)
        })
    }) as ZXNotificationFn

// 快捷函数
;(['success', 'error', 'info', 'warning'] as const).forEach((type) => {
    ZXNotification[type] = (opts: ZXNotificationOptions | string) => {
        const config = typeof opts === 'string' ? { message: opts } : opts
        ZXNotification({ ...defaultOptions, ...config, type:type })
    }
})


// 🌐 设置默认值
ZXNotification.setDefaultOptions = (opts: Partial<ZXNotificationOptions>) => {
    Object.assign(defaultOptions, opts)
    if (typeof opts.maxVisible === 'number') {
        ZXNotification.setMaxVisible(opts.maxVisible)
    }
}

// 🔢 设置最大同时显示数量
ZXNotification.setMaxVisible = (count: number) => {
    defaultOptions.maxVisible = count
    ensureMounted().then((comp) => {
        ;(comp?.exposed as any)?.setMaxVisible?.(count)
    })
}

// ✅ 重置默认值
ZXNotification.resetDefaultOptions = () => {
    Object.assign(defaultOptions, {
        title: '',
        duration: 3000,
        position: 'top-right',
        type: 'info',
        customClass: '',
        confetti: false,
        message: '',
        avatar: '',
        subtitle: '',
        sticker: '',
        maxVisible: 4,
        dedupe: true,
    })
    ensureMounted().then((comp) => {
        ;(comp?.exposed as any)?.setMaxVisible?.(4)
    })
}

export default ZXNotification
