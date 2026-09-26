/**
 * Monaco 本地兜底产物：核心 + 常用语言高亮 + 基础编辑 worker。
 * 不含 TS/JSON/CSS/HTML 语言服务 worker——CDN 可用时由 CDN 按需提供，
 * 本地兜底保持轻量（TS 那个 worker 有 6.9MB）。
 *
 * 语言按需点名引入：原全量 monaco.contribution 会把 90+ 种语言 tokenizer
 * 全部打进产物。覆盖面以 useWorkbench.ts 的 LANG_BY_EXT / LANGUAGE_OPTIONS
 * 为准（编辑器状态栏可手动切换的语言必须可用），其余类型在 CDN 失败时
 * 退化为纯文本，可接受。
 */
import * as monaco from "monaco-editor/editor/editor.api";
import "monaco-editor/languages/definitions/bat/register.js";
import "monaco-editor/languages/definitions/cpp/register.js";
import "monaco-editor/languages/definitions/css/register.js";
import "monaco-editor/languages/definitions/dockerfile/register.js";
import "monaco-editor/languages/definitions/go/register.js";
import "monaco-editor/languages/definitions/html/register.js";
import "monaco-editor/languages/definitions/ini/register.js";
import "monaco-editor/languages/definitions/java/register.js";
import "monaco-editor/languages/definitions/javascript/register.js";
import "monaco-editor/languages/definitions/less/register.js";
import "monaco-editor/languages/definitions/markdown/register.js";
import "monaco-editor/languages/definitions/python/register.js";
import "monaco-editor/languages/definitions/rust/register.js";
import "monaco-editor/languages/definitions/scss/register.js";
import "monaco-editor/languages/definitions/shell/register.js";
import "monaco-editor/languages/definitions/sql/register.js";
import "monaco-editor/languages/definitions/typescript/register.js";
import "monaco-editor/languages/definitions/xml/register.js";
import "monaco-editor/languages/definitions/yaml/register.js";
import { default as EditorWorker } from "monaco-editor/editor/editor.worker?worker";

self.MonacoEnvironment = {
    getWorker: () => new EditorWorker(),
};

export default monaco;
