/**
 * WebUI Next API 统一客户端
 * 使用新的后端接口 (/zhenxun/api/v1)
 */

import axios from 'axios'
import { ZXNotification } from '@/services/ui'
import { auth } from '../auth'
import { navigateTo } from '@/utils/navigation'
import type { APIResponse } from '@/types/api-next.types'

const API_V1_BASE = '/zhenxun/api/v1'

/** 拦截层通知截流：同文案在窗口期内只弹一次 */
const NOTIFY_DEDUP_MS = 8000
const notifySeenAt = new Map<string, number>()

function shouldNotifyOnce(title: string, message: string, type: string) {
    const key = `${type}|${title}|${message.trim().replace(/\s+/g, ' ')}`
    const now = Date.now()
    const last = notifySeenAt.get(key)
    if (last && now - last < NOTIFY_DEDUP_MS) return false
    notifySeenAt.set(key, now)
    if (notifySeenAt.size > 100) {
        for (const [k, t] of notifySeenAt) {
            if (now - t > NOTIFY_DEDUP_MS) notifySeenAt.delete(k)
        }
    }
    return true
}

export const getPort = () => localStorage.getItem('port') || window.location.port || '8080'

export const setPort = (port: string) => localStorage.setItem('port', port)

export const getBaseUrl = () => {
    const port = getPort()
    const host = localStorage.getItem('url') || `${window.location.protocol}//${window.location.hostname}`
    return host.startsWith('http://') || host.startsWith('https://')
        ? `${host}:${port}`
        : `${window.location.protocol}//${host}:${port}`
}

export const setBaseApiUrl = (url: string) => localStorage.setItem('url', url)

export const apiClient = axios.create({
    baseURL: getBaseUrl() + API_V1_BASE,
    timeout: 100000,
})

export const updateApiBaseUrl = () => {
    apiClient.defaults.baseURL = getBaseUrl() + API_V1_BASE
}

// ==================== Mock 模式接入 ====================
// dev：virtual:mock-api 指向真实 mock server，由设置 → 实验性功能的运行时开关决定是否接管；
// 生产构建：空实现 mockAdapter 为 undefined，src/mocks 不会进入产物
import { mockAdapter } from 'virtual:mock-api'
import { MOCK_MODE, isMockEnabled } from 'virtual:mock-mode'

if (MOCK_MODE && mockAdapter && isMockEnabled()) {
    apiClient.defaults.adapter = mockAdapter
}
// =========================================================

apiClient.interceptors.request.use(config => {
    const token = auth.getAuthToken()
    if (token) {
        config.headers['Authorization'] = token
    }
    return config
})

apiClient.interceptors.response.use(
    response => {
        // 二进制响应（文件下载）原样返回完整 response，调用方自取 blob 和响应头
        if (response.config.responseType === 'blob') {
            return response
        }
        // 后端不可用时请求可能落到前端自身的 index.html（返回 HTML），
        // 统一按失败处理，避免把 HTML 字符串当业务数据传给调用方
        const contentType = String(response.headers?.['content-type'] ?? '')
        if (!contentType.includes('application/json')) {
            console.warn(`API 返回非 JSON 响应，已按失败处理: ${response.status} ${response.config?.url}`)
            return Promise.reject(new Error(`Unexpected non-JSON response: ${response.config?.url}`))
        }
        return response.data
    },
    async error => {
        if (error.config?.skipInterceptor) {
            return Promise.reject(error)
        }

        // Mock 未实现路由：只留控制台，不弹通知（否则轮询会连刷）
        if ((error as any)?.isMockError) {
            return Promise.reject(error)
        }

        // 拦截层截流：同文案在窗口期内只弹一次（双保险，覆盖高频失败）
        const showNotification = (
            title: string,
            message: string,
            type: 'success' | 'error' | 'warning' | 'info',
            sticker?: string
        ) => {
            if (!shouldNotifyOnce(title, message, type)) return
            ZXNotification({ title, message, type, sticker, position: 'top-right' as const, dedupe: false })
        }

        if (error.code === 'ECONNABORTED') {
            showNotification("请求超时", "小真寻等得都要升华了……(இ௰இ)", 'error', '33')
        } else if (!error.response || error.code === 'ERR_NETWORK') {
            showNotification("连接断开", "连不上后端服务器了……小真寻陷入了沉思", 'error', '33')
        } else if (error.response?.status === 401) {
            showNotification("状态失效", "验证状态失效啦~返回登录 (っ °Д °;) っ", 'warning')
            auth.logout()
            await navigateTo({ name: 'Login' })
        } else if (error.response?.status === 400) {
            const errorMsg = error.response?.data?.message || error.response?.data?.info || '请求失败'
            showNotification("请求错误", errorMsg, 'error')
        } else if (error.response?.status >= 400 && error.response?.status < 500) {
            showNotification("对不起", "服务器被小真寻吃掉惹 (っ °Д °;) っ", 'error')
        } else if (error.response?.status >= 500) {
            showNotification("哎呀", "服务器好像被小真寻玩坏惹 (*/ω＼*)", 'error', '03')
        }

        return Promise.reject(error)
    }
)

export const api = {
    get<T>(url: string, params?: Record<string, any>, options?: Record<string, any>): Promise<APIResponse<T>> {
        return apiClient.get(url, { params, ...options })
    },

    post<T>(url: string, data?: any, options?: Record<string, any>): Promise<APIResponse<T>> {
        return apiClient.post(url, data, options)
    },

    put<T>(url: string, data?: any, options?: Record<string, any>): Promise<APIResponse<T>> {
        return apiClient.put(url, data, options)
    },

    patch<T>(url: string, data?: any, options?: Record<string, any>): Promise<APIResponse<T>> {
        return apiClient.patch(url, data, options)
    },

    delete<T>(url: string, params?: Record<string, any>, options?: Record<string, any>): Promise<APIResponse<T>> {
        return apiClient.delete(url, { params, ...options })
    },
}

export const getWsBaseUrl = () => {
    const port = getPort()
    let host = localStorage.getItem('url') || `${window.location.hostname}`
    host = host.replace(/^https?:\/\//, '')
    const protocol = localStorage.getItem('url')?.startsWith('https://') || window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${host}:${port}/zhenxun/ws/v1`
}

/**
 * WebSocket 握手鉴权参数：浏览器原生 WS 带不了 Authorization 头，
 * 后端从 query 参数读取 token 校验（未登录时返回空串，后端拒绝握手）
 */
export const getWsTokenQuery = () => {
    const token = auth.getAuthToken()?.replace(/^Bearer\s+/i, '') ?? ''
    return token ? `token=${encodeURIComponent(token)}` : ''
}

export default api
