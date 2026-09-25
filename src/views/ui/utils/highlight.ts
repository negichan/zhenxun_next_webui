/**
 * 轻量代码语法高亮工具（基于正则，零依赖）
 * 支持 TypeScript / JavaScript / Vue SFC 模板高亮
 */
export function highlightCode(code: string): string[] {
    if (!code) return [];
    const lines = code.trim().split("\n");

    return lines.map((line) => {
        let text = line
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        // 1. 单行注释或 HTML 注释
        const commentMatch = text.match(/(\/\/.*$|&lt;!--.*?--&gt;)/);
        let commentPart = "";
        if (commentMatch && commentMatch.index !== undefined) {
            commentPart = commentMatch[0];
            text = text.substring(0, commentMatch.index);
        }

        // 2. 提取字符串字面量（避免内部命中关键字）
        const strings: string[] = [];
        text = text.replace(/(".*?"|'.*?'|`.*?`)/g, (match) => {
            const token = `___STR_${strings.length}___`;
            strings.push(`<span class="text-emerald-300">${match}</span>`);
            return token;
        });

        // 3. 关键字 (Keywords)
        text = text.replace(
            /\b(import|export|from|const|let|var|function|return|default|true|false|as|type|interface|class|new|await|async|for|if|else|switch|case|break)\b/g,
            '<span class="text-rose-400 font-medium">$1</span>',
        );

        // 4. 大写开头的组件名 / 类名 (PascalCase)
        text = text.replace(
            /\b([A-Z][a-zA-Z0-9]+)\b/g,
            '<span class="text-cyan-300 font-medium">$1</span>',
        );

        // 5. 属性名 (props, e.g. variant=, size=, @click=, v-model=)
        text = text.replace(
            /\b([a-zA-Z0-9_:@.-]+)=/g,
            '<span class="text-sky-300">$1</span>=',
        );

        // 6. 还原字符串
        strings.forEach((str, i) => {
            text = text.replace(`___STR_${i}___`, str);
        });

        // 7. 还原注释
        if (commentPart) {
            text += `<span class="text-slate-500 italic">${commentPart}</span>`;
        }

        return text;
    });
}
