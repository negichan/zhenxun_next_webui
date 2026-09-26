/**
 * AI / LLM 模块前端数据类型定义
 */

export interface ModelDetailItem {
    model_name: string;
    /** 是否写入配置；false 时保存时忽略该模型 */
    enabled?: boolean;
    temperature?: number | null;
    max_tokens?: number | null;
    max_output_tokens?: number | null;
    reasoning_effort?: string | null;
    /** 上下文窗口 */
    context_limit?: number | null;
    /** 智能配置 */
    smart_config?: boolean;
    /** 输入类型：text / image / video / pdf */
    input_types?: string[];
    /** 模型能力 */
    capabilities?: string[];
    /** 推理等级（从低到高） */
    reasoning_levels?: string[];
    /** 推理参数映射 */
    reasoning_param_map?: string | null;
}

export interface ProviderItem {
    name: string;
    /** 自定义图标 key（public/icons/providers/<key>.svg），可选 */
    icon?: string;
    api_key: string | string[];
    api_base?: string | null;
    api_type: string;
    temperature?: number | null;
    max_output_tokens?: number | null;
    timeout?: number;
    models: ModelDetailItem[];
    enabled?: boolean;
    priority?: number;
    weight?: number;
}

export interface DefaultModelsItem {
    chat?: string | null;
    embedding?: string | null;
    tts?: string | null;
    image?: string | null;
    rerank?: string | null;
}

export interface LLMSummaryItem {
    enable: boolean;
    trigger_threshold: number;
    max_history_turns: number;
    summarization_model?: string | null;
    summarization_prompt: string;
    keep_recent_turns: number;
}

export interface ToolPruningItem {
    enable: boolean;
    trigger_threshold: number;
    max_history_turns: number;
    keep_recent_turns: number;
}

export interface ContextSettingsItem {
    llm_summary: LLMSummaryItem;
    vision_window_size: number;
    tool_pruning: ToolPruningItem;
}

export interface AgentSettingsItem {
    max_cycles: number;
    global_max_cycles: number;
    enable_parallel_calls: boolean;
    reflexion_retries: number;
    enable_fallback_summary: boolean;
    enable_hitl: boolean;
    mcp_cleanup_timeout: number;
}

export interface ClientSettingsItem {
    timeout: number;
    max_retries: number;
    retry_delay: number;
    structured_retries: number;
}

export interface DebugLogItem {
    show_tools: boolean;
    show_schema: boolean;
    show_safety: boolean;
}

export interface SandboxSettingsItem {
    enable_sandbox: boolean;
    sandbox_type: string;
    docker_image: string;
    cleanup_timeout: number;
    enable_vfs_helper: boolean;
}

export interface GeminiProviderItem {
    safety_threshold: string;
    allow_mixed_tools: boolean;
}

export interface ProviderSettingsGroupItem {
    gemini: GeminiProviderItem;
}

export interface AiConfigData {
    providers: ProviderItem[];
    default_models: DefaultModelsItem;
    model_groups: Record<string, string[]>;
    context_settings: ContextSettingsItem;
    agent_settings: AgentSettingsItem;
    client_settings: ClientSettingsItem;
    debug_log: DebugLogItem;
    sandbox: SandboxSettingsItem;
    provider_settings: ProviderSettingsGroupItem;
}

export interface ModelTestRequest {
    model: string;
}

export interface ModelTestResponse {
    success: boolean;
    message: string;
    latency_ms?: number | null;
}

export interface AvailableModelItem {
    id: string;
    provider: string;
    model_name: string;
    is_available: boolean;
}

export interface ModelsDevModelItem {
    id: string;
    name: string;
    description?: string | null;
    context_limit?: number | null;
    max_output_tokens?: number | null;
    reasoning?: boolean;
    tool_call?: boolean;
    temperature?: boolean;
    release_date?: string | null;
}

export interface ModelsDevProviderItem {
    id: string;
    name: string;
    api_base?: string | null;
    api_type: string;
    npm?: string | null;
    doc?: string | null;
    env?: string[];
    models_count: number;
    models: ModelsDevModelItem[];
}

export interface ModelsDevCatalogResponse {
    total_providers: number;
    total_models: number;
    cached_at?: string | null;
    providers: ModelsDevProviderItem[];
}

export interface ImportModelsDevRequest {
    provider_id: string;
    provider_name?: string | null;
    api_key?: string;
    api_base?: string | null;
    api_type?: string | null;
    selected_model_names?: string[];
}

export interface TelemetryItem {
    id: string;
    timestamp: number;
    api_type: string;
    provider_name: string;
    model_name: string;
    endpoint?: string | null;
    prompt_preview?: string | null;
    response_preview?: string | null;
    latency_ms?: number | null;
    input_tokens?: number | null;
    output_tokens?: number | null;
    status: "success" | "error" | "pending";
    error_message?: string | null;
}

export interface ProtocolHijackStatusResponse {
    enabled: boolean;
    supported_protocols: string[];
    intercepted_count: number;
}

export interface UpdateProtocolHijackRequest {
    enabled: boolean;
}

