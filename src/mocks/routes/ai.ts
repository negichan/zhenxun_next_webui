/**
 * AI / 大模型配置 mock
 */
import type { MockRoute } from '../types'

const emptyAiConfig = () => ({
    providers: [],
    default_models: {
        chat: null,
        embedding: null,
        tts: null,
        image: null,
        rerank: null,
    },
    model_groups: {},
    context_settings: {
        llm_summary: {
            enable: false,
            trigger_threshold: 8,
            max_history_turns: 30,
            summarization_model: null,
            summarization_prompt: '请将以下对话压缩为简洁摘要',
            keep_recent_turns: 3,
        },
        vision_window_size: 3,
        tool_pruning: {
            enable: false,
            trigger_threshold: 20,
            max_history_turns: 30,
            keep_recent_turns: 5,
        },
    },
    agent_settings: {
        max_cycles: 10,
        global_max_cycles: 30,
        enable_parallel_calls: true,
        reflexion_retries: 1,
        enable_fallback_summary: true,
        enable_hitl: false,
        mcp_cleanup_timeout: 5,
    },
    client_settings: {
        timeout: 60,
        max_retries: 2,
        retry_delay: 1,
        structured_retries: 1,
    },
    debug_log: {
        show_tools: false,
        show_schema: false,
        show_safety: false,
    },
    sandbox: {
        enable_sandbox: false,
        sandbox_type: 'docker',
        docker_image: '',
        cleanup_timeout: 30,
        enable_vfs_helper: true,
    },
    provider_settings: {
        gemini: {
            safety_threshold: 'BLOCK_NONE',
            allow_mixed_tools: true,
        },
    },
})

export const aiRoutes: MockRoute[] = [
    {
        method: 'get',
        url: '/ai/config',
        response: () => emptyAiConfig(),
    },
    {
        method: 'post',
        url: '/ai/config',
        response: () => true,
    },
    {
        method: 'post',
        url: '/ai/test',
        response: () => ({
            success: true,
            message: '模型响应正常（mock）',
            latency_ms: 120,
        }),
    },
    {
        method: 'get',
        url: '/ai/models',
        response: () => [],
    },
    {
        method: 'get',
        url: '/ai/models-dev/catalog',
        response: () => ({ providers: [], models: [] }),
    },
    {
        method: 'post',
        url: '/ai/models-dev/refresh',
        response: () => ({ providers: [], models: [] }),
    },
    {
        method: 'post',
        url: '/ai/models-dev/import',
        response: () => true,
    },
    {
        method: 'get',
        url: '/ai/experimental/protocol-hijack',
        response: () => ({
            enabled: false,
            supported_protocols: ['chat', 'response', 'claude'],
            intercepted_count: 0,
        }),
    },
    {
        method: 'post',
        url: '/ai/experimental/protocol-hijack',
        response: () => true,
    },
    {
        method: 'get',
        url: '/ai/experimental/telemetry',
        response: () => [],
    },
    {
        method: 'delete',
        url: '/ai/experimental/telemetry',
        response: () => true,
    },
]
