<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Bot } from "lucide-vue-next";

interface Props {
    name?: string;
    apiType?: string;
    sizeClass?: string;
    /** 显式指定图标 key（public/icons/providers/<key>.svg），优先于名称映射 */
    iconKey?: string;
}

const props = withDefaults(defineProps<Props>(), {
    name: "",
    apiType: "",
    sizeClass: "h-5 w-5",
    iconKey: "",
});

const imgLoadError = ref(false);

watch(
    () => props.iconKey,
    () => {
        imgLoadError.value = false;
    }
);

// 映射厂商别名到 public/icons/providers/ 中的 SVG 文件名
const resolvedIconKey = computed<string | null>(() => {
    if (props.iconKey) return props.iconKey;
    const n = (props.name || "").toLowerCase().trim();
    const t = (props.apiType || "").toLowerCase().trim();

    // 优先按名称匹配
    if (n.includes("deepseek")) return "deepseek";
    if (n.includes("gemini") || n.includes("google")) return "gemini";
    if (n.includes("openai") || n.includes("chatgpt") || n.includes("gpt")) return "openai";
    if (n.includes("claude") || n.includes("anthropic")) return "claude";
    if (n.includes("silicon") || n.includes("硅基")) return "siliconflow";
    if (n.includes("doubao") || n.includes("ark") || n.includes("volc") || n.includes("豆包") || n.includes("火山")) return "doubao";
    if (n.includes("zhipu") || n.includes("glm") || n.includes("chatglm") || n.includes("智谱")) return "zhipu";
    if (n.includes("qwen") || n.includes("alibaba") || n.includes("ali") || n.includes("通义")) return "qwen";
    if (n.includes("wenxin") || n.includes("baidu") || n.includes("文心") || n.includes("千帆")) return "wenxin";
    if (n.includes("moonshot") || n.includes("kimi") || n.includes("月之暗面")) return "moonshot";
    if (n.includes("minimax")) return "minimax";
    if (n.includes("mistral")) return "mistral";
    if (n.includes("groq")) return "groq";
    if (n.includes("openrouter")) return "openrouter";
    if (n.includes("ollama")) return "ollama";
    if (n.includes("together")) return "together";
    if (n.includes("perplexity")) return "perplexity";
    if (n.includes("azure")) return "azure";
    if (n.includes("baichuan") || n.includes("百川")) return "baichuan";
    if (n.includes("stepfun") || n.includes("阶跃")) return "stepfun";
    if (n.includes("yi") || n.includes("zeroone") || n.includes("零一")) return "yi";
    if (n.includes("grok") || n.includes("xai")) return "grok";
    if (n.includes("nvidia")) return "nvidia";
    if (n.includes("bedrock") || n.includes("aws")) return "bedrock";
    if (n.includes("github")) return "github";
    if (n.includes("cloudflare")) return "cloudflare";
    if (n.includes("replicate")) return "replicate";
    if (n.includes("fireworks")) return "fireworks";
    if (n.includes("novita")) return "novita";
    if (n.includes("deepinfra")) return "deepinfra";
    if (n.includes("upstage")) return "upstage";
    if (n.includes("huggingface") || n.includes("hf")) return "huggingface";
    if (n.includes("meta") || n.includes("llama")) return "meta";

    // 中转站与聚合服务
    if (n.includes("sub2api") || n.includes("sub-2-api") || n.includes("subtoapi")) return "sub2api";
    if (n.includes("newapi") || n.includes("new-api") || n.includes("new_api")) return "newapi";
    if (n.includes("oneapi") || n.includes("one-api") || n.includes("one_api")) return "oneapi";
    if (n.includes("302") || n.includes("ai302")) return "ai302";
    if (n.includes("aihubmix")) return "aihubmix";
    if (n.includes("cometapi") || n.includes("comet")) return "cometapi";
    if (n.includes("llmapi")) return "llmapi";
    if (n.includes("openwebui")) return "openwebui";
    if (n.includes("lobehub")) return "lobehub";
    if (n.includes("中转") || n.includes("转发") || n.includes("relay") || n.includes("聚合") || n.includes("代理")) return "relay";

    // 尝试按 apiType 回退
    if (t.includes("gemini")) return "gemini";
    if (t.includes("claude") || t.includes("anthropic")) return "claude";
    if (t.includes("doubao")) return "doubao";
    if (t.includes("glm")) return "zhipu";
    if (t.includes("openrouter")) return "openrouter";
    if (t.includes("openai") || t.includes("response")) return "openai";

    return null;
});

const iconSrc = computed(() => {
    if (!resolvedIconKey.value || imgLoadError.value) return null;
    return `${import.meta.env.BASE_URL}icons/providers/${resolvedIconKey.value}.svg`;
});

const onImgError = () => {
    imgLoadError.value = true;
};
</script>

<template>
    <div class="inline-flex items-center justify-center shrink-0 select-none">
        <img
            v-if="iconSrc && !imgLoadError"
            :src="iconSrc"
            :alt="name || 'provider icon'"
            :class="[sizeClass, 'object-contain']"
            draggable="false"
            loading="lazy"
            decoding="async"
            @error="onImgError"
        />
        <Bot
            v-else
            :class="[sizeClass, 'opacity-75']"
        />
    </div>
</template>
