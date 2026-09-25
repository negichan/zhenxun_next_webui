/**
 * .env.dev 环境变量解析与序列化工具
 */

export type EnvItemType = "boolean" | "number" | "json" | "array" | "string" | "raw";

export interface EnvEntry {
    id: string;
    key: string;
    value: string;
    comment: string; // 关联的上方注释（说明文档）
    type: EnvItemType;
    isSecret: boolean; // 是否包含敏感词（Token, Secret, Password 等）
    isMultiLine: boolean;
}

/** 检测是否为敏感字段 */
export function detectIsSecret(key: string): boolean {
    const upper = key.toUpperCase();
    return (
        upper.includes("TOKEN") ||
        upper.includes("SECRET") ||
        upper.includes("PASSWORD") ||
        upper.includes("PASSWD") ||
        upper.includes("ACCESS_KEY") ||
        upper.includes("API_KEY") ||
        upper.includes("PRIVATE_KEY")
    );
}

/** 智能判断是否属于机器人凭据与令牌（右排） */
export function isBotTokenOrCredential(entry: EnvEntry): boolean {
    if (entry.isSecret) return true;
    const k = entry.key.toUpperCase();
    if (
        k.includes("TOKEN") ||
        k.includes("SECRET") ||
        k.includes("KEY") ||
        k.includes("PASS") ||
        k.includes("PWD") ||
        k.includes("AUTH") ||
        k.includes("BOTS") ||
        k.includes("BOT_ID") ||
        k === "QBOT_ID_DATA"
    ) {
        return true;
    }
    const val = entry.value.toLowerCase();
    if (
        val.includes('"token"') ||
        val.includes("'token'") ||
        val.includes('"secret"') ||
        val.includes("'secret'")
    ) {
        return true;
    }
    return false;
}


/** 智能推导值类型 */
export function detectValueType(value: string): EnvItemType {
    const trimmed = value.trim();
    if (
        trimmed === "True" ||
        trimmed === "False" ||
        trimmed === "true" ||
        trimmed === "false"
    ) {
        return "boolean";
    }

    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
        return "number";
    }

    // 去除外层单/双引号后判断是否为 JSON 或 Array
    let unquoted = trimmed;
    if (
        (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
        (trimmed.startsWith('"') && trimmed.endsWith('"'))
    ) {
        unquoted = trimmed.slice(1, -1).trim();
    }

    if (unquoted.startsWith("[") && unquoted.endsWith("]")) {
        return "array";
    }

    if (unquoted.startsWith("{") && unquoted.endsWith("}")) {
        return "json";
    }

    if (trimmed.startsWith('"') || trimmed.startsWith("'")) {
        return "string";
    }

    return "raw";
}

/** 明确需要长文本展开编辑的配置键（结构化名单 / 机器人数据块） */
const LONG_STRUCT_KEYS = new Set([
    "SUPERUSERS",
    "SUPERUSER",
    "QBOT_ID_DATA",
    "KAIHEILA_BOTS",
]);

/**
 * 是否适合长文本展开编辑（ZXInput expandable）
 * 命中名单键，或值为 JSON 对象 / 列表格式（允许未闭合、换行、外层引号）
 */
export function isExpandableEnvValue(entry: EnvEntry): boolean {
    const key = entry.key.trim().toUpperCase();
    if (LONG_STRUCT_KEYS.has(key)) return true;
    if (entry.type === "array" || entry.type === "json") return true;

    let v = entry.value.trim();
    // 剥外层单/双引号（可跨多行）
    if (v.length >= 2) {
        const q = v[0];
        if ((q === "'" || q === '"') && v.endsWith(q)) {
            v = v.slice(1, -1).trim();
        }
    }
    // 去掉首尾空白后只要以 { 或 [ 开头就当结构化（不要求闭合）
    return v.startsWith("{") || v.startsWith("[");
}

/**
 * 解析 .env 原始字符串为结构化 EnvEntry 列表
 */
export function parseEnvContent(rawText: string): EnvEntry[] {
    const lines = rawText.replace(/\r\n/g, "\n").split("\n");
    const entries: EnvEntry[] = [];
    let pendingComments: string[] = [];

    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        const trimmedLine = line.trim();

        // 空行：若有连续累积的注释，清空或保留
        if (!trimmedLine) {
            // 如果积累了注释但遇到空行，且紧接着不是键，重置 pendingComments
            pendingComments = [];
            i++;
            continue;
        }

        // 注释行
        if (trimmedLine.startsWith("#")) {
            // 提取注释内容（去掉开头的 # 和首尾空格）
            const commentText = trimmedLine.replace(/^#+\s?/, "").trim();
            if (commentText) {
                pendingComments.push(commentText);
            }
            i++;
            continue;
        }

        // 匹配 KEY = VALUE 或 KEY=VALUE
        const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/);
        if (match) {
            const key = match[1];
            let valuePart = match[2];

            // 检查是否为跨行多行值（未闭合单双引号）
            let isMultiLine = false;
            const firstChar = valuePart.trim()[0];

            if (firstChar === "'" || firstChar === '"') {
                const quote = firstChar;
                const restOfValue = valuePart.trim().slice(1);
                // 如果当前行以同类型引号结尾（且不是被转义的引号），则是单行
                const isClosedOnSameLine =
                    restOfValue.endsWith(quote) && !restOfValue.endsWith("\\" + quote);

                if (!isClosedOnSameLine) {
                    isMultiLine = true;
                    // 向下读取直到找到结束引号
                    const multilineBuffer: string[] = [valuePart];
                    i++;
                    while (i < lines.length) {
                        const nextLine = lines[i];
                        multilineBuffer.push(nextLine);
                        if (nextLine.trim().endsWith(quote)) {
                            break;
                        }
                        i++;
                    }
                    valuePart = multilineBuffer.join("\n");
                }
            } else if (firstChar === "{" || firstChar === "[") {
                // 可能是未加引号的多行 JSON/Array
                const openBracket = firstChar;
                const closeBracket = openBracket === "{" ? "}" : "]";
                if (!valuePart.trim().endsWith(closeBracket)) {
                    isMultiLine = true;
                    const multilineBuffer: string[] = [valuePart];
                    i++;
                    while (i < lines.length) {
                        const nextLine = lines[i];
                        multilineBuffer.push(nextLine);
                        if (nextLine.trim().endsWith(closeBracket)) {
                            break;
                        }
                        i++;
                    }
                    valuePart = multilineBuffer.join("\n");
                }
            }

            const cleanValue = valuePart.trim();
            const comment = pendingComments.join("\n");
            pendingComments = [];

            entries.push({
                id: `${key}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                key,
                value: cleanValue,
                comment,
                type: detectValueType(cleanValue),
                isSecret: detectIsSecret(key),
                isMultiLine: isMultiLine || cleanValue.includes("\n"),
            });
        } else {
            // 其他未识别行
            pendingComments = [];
        }

        i++;
    }

    return entries;
}

/**
 * 序列化 EnvEntry 列表为 .env 文件格式
 */
export function serializeEnvEntries(entries: EnvEntry[]): string {
    const chunks: string[] = [];

    for (const entry of entries) {
        const itemLines: string[] = [];

        // 写入注释
        if (entry.comment && entry.comment.trim()) {
            const commentLines = entry.comment.split("\n");
            for (const c of commentLines) {
                const trimmedC = c.trim();
                if (trimmedC.startsWith("#")) {
                    itemLines.push(trimmedC);
                } else {
                    itemLines.push(`# ${trimmedC}`);
                }
            }
        }

        // 规范化值
        let val = entry.value.trim();
        // 如果值为空且有引号包裹，保留原样
        if (!val) {
            val = '""';
        }

        itemLines.push(`${entry.key} = ${val}`);
        chunks.push(itemLines.join("\n"));
    }

    return chunks.join("\n\n") + "\n";
}
