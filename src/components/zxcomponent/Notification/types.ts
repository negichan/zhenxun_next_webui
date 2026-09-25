// 🔧 定义函数类型（带静态方法）
export type ZXNotificationFn = {
    (options: ZXNotificationOptions | string): void
    success: (options: ZXNotificationOptions | string) => void
    error: (options: ZXNotificationOptions | string) => void
    info: (options: ZXNotificationOptions | string) => void
    warning: (options: ZXNotificationOptions | string) => void
    setDefaultOptions: (opts: Partial<ZXNotificationOptions>) => void
    resetDefaultOptions: () => void
    setMaxVisible: (count: number) => void
}

// 🔧 通知配置类型
export interface ZXNotificationOptions {
    title?: string
    message?: string
    duration?: number
    position?: 'top-center' | 'top-left' | 'top-right' | 'bottom-center' | 'bottom-left' | 'bottom-right'
    type?: 'success' | 'error' | 'info' | 'warning' | string
    customClass?: string
    confetti?: boolean
    /** 头像模式：左侧显示头像（如 bot 上下线通知），消息行按 type 附带上/下线图标 */
    avatar?: string
    /** 头像模式：标题下方的副标题（如 bot 的 self_id） */
    subtitle?: string
    /** 表情包模式：左侧展示真寻表情包（支持编号如 "33" 或完整路径/文件名） */
    sticker?: string
    /** 最多同时显示的通知数量，默认 4 */
    maxVisible?: number
    /**
     * 同 type+title+message 在 4s 内只弹一次（默认开启）。
     * 传 false 可强制每次都弹。
     */
    dedupe?: boolean
    [key: string]: any // 扩展字段
}