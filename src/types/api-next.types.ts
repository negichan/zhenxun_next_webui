/**
 * WebUI Next API 统一类型定义
 * 与新后端 (web_ui_next) 的响应格式保持一致
 */

/**
 * 统一 API 响应格式
 */
export interface APIResponse<T = any> {
    success: boolean
    message: string
    code: number
    data: T | null
}

/**
 * 分页数据
 */
export interface PageData<T> {
    items: T[]
    total: number
    page: number
    page_size: number
    has_next: boolean
    has_prev: boolean
}

// ==================== 认证相关 ====================

export interface LoginRequest {
    username: string
    password: string
}

export interface LoginResponse {
    access_token: string
    token_type: string
    expires_in: number
}

// ==================== 系统相关 ====================

export interface SystemStatus {
    cpu: number
    memory: number
    disk: number
    check_time: string
}

export interface SystemHealth {
    status: 'healthy' | 'warning' | 'error'
    cpu_status: 'normal' | 'high' | 'critical'
    memory_status: 'normal' | 'high' | 'critical'
    disk_status: 'normal' | 'high' | 'critical'
    recommendations: string[]
}

export interface BotStatus {
    self_id: string | null;
    nickname: string | null;
    ava_url: string | null;
    is_running: boolean;
    uptime: number;
    uptime_formatted: string;
    group_count: number;
    friend_count: number;
    message_count: number;
    start_time: string;
}

export interface ConnectionLogInfo {
    id: number;
    bot_id: string;
    platform: string | null;
    /** 1: 连接, 0: 断开 */
    type: number;
    connect_time: string;
}

export interface BotInfo {
    // 基础信息
    self_id: string | null;
    nickname: string | null;
    ava_url: string | null;
    platform: string | null;

    // 统计
    friend_count: number;
    group_count: number;

    // 新字段（后端返回）
    received_messages: number;
    day_call: number;
    connect_date: string | null;
    total_call: number;
    messages_total: number;

    // 兼容旧 BotStatus
    is_running: boolean;
    uptime: number;
    uptime_formatted: string;
    start_time: string;

    // 兼容旧 message_count（和 received_messages 对应）
    message_count?: number;
}


export interface SystemInfo {
    version: string
    system: string
    arch: string
    cpu_brand: string
    cpu_cores: number
    cpu_freq_mhz: number
    memory_total: number
    disk_total?: number
    nickname: string
}

export interface NetworkStatus {
    baidu: boolean
    google: boolean
}

// ==================== 仪表盘相关 ====================

export interface DashboardOverview {
    bot_status: 'online' | 'offline'
    uptime: number
    uptime_formatted: string
    group_count: number
    friend_count: number
    message_count_today: number
    plugin_count: number
    enabled_plugin_count: number
}

export interface StatItem {
    label: string
    value: number
    trend?: 'up' | 'down' | 'stable'
    change?: number
}

export interface DashboardStats {
    message_stats: StatItem
    user_stats: StatItem
    group_stats: StatItem
    error_stats: StatItem
}

export interface QuickAction {
    name: string
    description: string
    icon: string
    action_type: string
}

export interface DashboardResult {
    overview: DashboardOverview
    stats: DashboardStats
    quick_actions: QuickAction[]
    system_health: string
}

// ==================== 插件相关 ====================

export interface PluginInfo {
    id: number
    module: string
    name: string
    description: string
    author: string
    version: string
    plugin_type: string
    is_enabled: boolean
    allow_switch: boolean
    allow_setting: boolean
    is_builtin: boolean
}

export interface PluginListRequest {
    search?: string
    status?: boolean
    plugin_type?: string
    page?: number
    page_size?: number
}

export interface PluginListResult {
    items: PluginInfo[]
    total: number
    page: number
    page_size: number
    has_next: boolean
    has_prev: boolean
}

export interface PluginToggleRequest {
    module: string
    enable: boolean
}

export interface PluginSettingsRequest {
    module: string
    level?: number
    limit_superuser?: boolean
}

export interface PluginMarks {
    pinned: string[]
    resident: string[]
}

export interface PluginConfigItem {
    module: string
    key: string
    value: string
    description?: string
}

export interface PluginConfigResult {
    module: string
    name: string
    configs: PluginConfigItem[]
}

// ==================== 文件相关 ====================

export interface FileItem {
    name: string
    is_file: boolean
    is_image: boolean
    size?: number
    size_formatted?: string
    mtime?: string
    mtime_formatted?: string
    path: string
    parent?: string
}

export interface FileListResult {
    files: FileItem[]
    current_path: string
    path_segments: string[]
    has_parent: boolean
}

export interface FileContent {
    path: string
    content: string
    encoding: string
}

export interface ArchiveEntry {
    name: string
    is_dir: boolean
    size?: number | null
    size_formatted?: string | null
}

export interface ArchivePreviewResult {
    path: string
    archive_type: string
    entries: ArchiveEntry[]
    total_count: number
    truncated: boolean
}

export interface ArchiveExtractResult {
    dest_path: string
    file_count: number
}

export interface FileSearchMatch {
    line_number: number
    /** 命中起始列（1 起，相对原始行，用于跳转） */
    column: number
    length: number
    /** 展示切片（超长行截窗） */
    line_text: string
    /** 切片在原始行中的 0 起偏移（计算高亮位置用） */
    context_offset: number
}

export interface FileSearchGroup {
    path: string
    name: string
    matches: FileSearchMatch[]
}

export interface FileSearchResult {
    results: FileSearchGroup[]
    total_matches: number
    scanned_files: number
    truncated: boolean
}

// ==================== 配置相关 ====================

export interface EnvFileContent {
    name: string
    content: string
}

export interface YamlConfigContent {
    file_path: string
    content: string
}

export interface ConfigSaveRequest {
    name: string
    content: string
}

export interface YamlConfigSaveRequest {
    file_path: string
    content: string
}

// ==================== 数据库相关 ====================

export interface TableColumn {
    name: string
    type: string
    nullable: boolean
    default?: string | null
    primary_key?: boolean
}

export interface TableRowData {
    id: number | string
    data: Record<string, any>
}

export interface TableDataResult {
    items: TableRowData[]
    total: number
    page: number
    page_size: number
    has_next: boolean
    has_prev: boolean
}

export interface SqlExecuteRequest {
    sql: string
}

export interface SqlExecuteResult {
    success: boolean
    message: string
    data?: Record<string, any>[] | null
    rows_affected?: number | null
}

export interface SqlLogItem {
    id: number
    sql: string
    is_success: boolean
    message: string
    created_at: string
}

export interface SqlLogListResult {
    items: SqlLogItem[]
    total: number
}

export interface RowUpdateRequest {
    data: Record<string, any>
}

export interface RowInsertRequest {
    data: Record<string, any>
}

export interface RowMutationResult {
    success: boolean
    message: string
    rows_affected: number
}

export interface SqlFileItem {
    name: string
    content: string
    updated_at: number
}

export interface SqlFileListResult {
    items: SqlFileItem[]
    total: number
}

// ==================== 日志相关 ====================

export interface LogEntry {
    seq?: number
    timestamp: string
    level: 'INFO' | 'WARNING' | 'ERROR' | 'DEBUG'
    message: string
    module?: string
}

// ==================== 聊天相关 ====================

export interface ChatMessage {
    object_id: string
    user_id: string
    group_id?: string
    message: ChatMessageItem[]
    name: string
    ava_url: string
    time?: string
}

export interface ChatMessageItem {
    /** 后端目前推 text/img/at，其余为 OneBot 段类型预留 */
    type:
        | 'text'
        | 'img'
        | 'image'
        | 'at'
        | 'face'
        | 'record'
        | 'voice'
        | 'video'
        | 'json'
        | 'xml'
        | 'forward'
        | 'share'
        | 'music'
        | 'location'
        | 'reply'
        | 'other'
    msg: string
    time: string
}

// ==================== 详细统计相关 ====================

export interface GroupStatistics {
    group_id: string
    group_name: string
    message_count: number
    plugin_call_count: number
    ava_url?: string
}

export interface FriendStatistics {
    user_id: string
    user_name: string
    message_count: number
    plugin_call_count: number
    ava_url?: string
}

export interface DetailedStatistics {
    groups: GroupStatistics[]
    friends: FriendStatistics[]
}

// ==================== Analytics 相关 ====================

/**
 * 时间粒度类型
 */
export type Granularity = 'hour' | 'day' | 'week' | 'month'

/**
 * 趋势数据点
 */
export interface TrendPoint {
    timestamp: string  // ISO 8601 格式
    message_count: number
    plugin_call_count: number
}

/**
 * 趋势数据响应
 */
export interface TrendData {
    data_points: TrendPoint[]
    total_message_count: number
    total_plugin_call_count: number
    granularity: Granularity
    start_time: string
    end_time: string
}

/**
 * 群组统计（带时间范围）
 */
export interface GroupStatisticsTimeRange {
    group_id: string
    group_name: string
    message_count: number
    plugin_call_count: number
    ava_url?: string
}

/**
 * 好友统计（带时间范围）
 */
export interface FriendStatisticsTimeRange {
    user_id: string
    user_name: string
    message_count: number
    plugin_call_count: number
    ava_url?: string
}

/**
 * 区间概览 KPI（相对所选时间范围，含上一等长周期对比）
 */
export interface AnalyticsOverview {
    message_count: number
    plugin_call_count: number
    avg_daily_messages: number
    peak_message_count: number
    peak_date: string
    active_group_count: number
    active_user_count: number
    prev_message_count: number
    prev_plugin_call_count: number
}

/**
 * 消息热力图：matrix[weekday][hour]，weekday 0=周一
 */
export interface MessageHeatmap {
    weekdays: string[]
    hours: number[]
    matrix: number[][]
    max_count: number
    total: number
}

/** 词云词条 */
export interface WordCloudItem {
    text: string
    value: number
}

/** 区间消息词云 */
export interface WordCloudData {
    words: WordCloudItem[]
    total: number
    sampled: number
    start_time: string
    end_time: string
}

/**
 * 详细统计数据（带时间范围）
 */
export interface DetailedStatisticsTimeRange {
    groups: GroupStatisticsTimeRange[]
    friends: FriendStatisticsTimeRange[]
    start_time: string
    end_time: string
}

/**
 * 好感度排名
 */
export interface FavorabilityRank {
    user_id: string
    user_name: string
    favorability: number
    ava_url: string
}

/**
 * 金币排名
 */
export interface GoldRank {
    user_id: string
    user_name: string
    gold: number
    ava_url: string
}
