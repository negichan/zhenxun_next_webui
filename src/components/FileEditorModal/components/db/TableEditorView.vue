<script setup lang="ts">
/**
 * Table Editor
 * - 主键图标：跟随主题色；仅 primary_key 列显示
 * - 顶栏：SQL 执行（替换原 Filter）/ Sort / Insert
 * - 表头：名称 + 类型(小写) gap-2；点击列菜单（对齐 Supabase）
 * - 网格列间 1px 分割线
 */
import { computed, nextTick, onMounted, reactive, ref, watch } from "vue";
import {
    CheckCircle2,
    ChevronDown,
    Copy,
    CornerLeftUp,
    CornerRightDown,
    Download,
    Filter,
    KeyRound,
    Pencil,
    Plus,
    RefreshCw,
    RotateCcw,
    Settings,
    SquareTerminal,
    Trash2,
    X,
} from "lucide-vue-next";
import { databaseApi } from "@/utils/api-next";
import { ZXNotification } from "@/services/ui";
import { ZXContextMenu, menuSep } from "@/components/zxcomponent/ContextMenu";
import type { ZXContextMenuItem } from "@/components/zxcomponent/ContextMenu";
import { useDatabaseStore } from "@/store/database";
import DbCellEditor from "./DbCellEditor.vue";
import MiniDateTimePicker from "@/components/zxcomponent/MiniDateTimePicker.vue";
import { createDoubleTap } from "../../pointerDrag";
import { scrollElementInContainer } from "@/composables/scrollInView";
import { Clock } from "lucide-vue-next";
import {
    OVERLAY_ID,
    useOverlayStack,
} from "@/composables/useOverlayStack";
import type { TableColumn, TableRowData } from "@/types/api-next.types";

const props = defineProps<{
    tableName: string;
    /** 侧栏双击列后要定位的列名 */
    focusColumn?: string;
}>();

const emit = defineEmits<{ openSqlConsole: [] }>();

const dbStore = useDatabaseStore();

const columns = ref<TableColumn[]>([]);
const rows = ref<TableRowData[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(50);
const pageSizeOptions = [50, 100, 200, 500];
const loading = ref(false);
const error = ref("");

/** SQL 执行（顶栏）：非空则用查询结果填充网格 */
const sqlText = ref("");
const sqlRunning = ref(false);

const sortCol = ref("");
const sortDir = ref<"asc" | "desc">("asc");
const showSortPop = ref(false);
const sortPick = ref({ col: "", dir: "asc" as "asc" | "desc" });
const frozenCols = ref<string[]>([]);

const inserting = ref(false);
const saving = ref(false);
const newRow = reactive<Record<string, any>>({});
const drafts = reactive<Record<string, Record<string, any>>>({});

/** 待插入行：可挂在某数据行之前/之后，克隆时紧贴源行下方 */
type PendingInsert = {
    id: string;
    data: Record<string, any>;
    /** 插在该数据行之后 */
    afterRowKey?: string;
    /** 插在该数据行之前 */
    beforeRowKey?: string;
};
let pendingSeq = 0;
const pendingInserts = ref<PendingInsert[]>([]);
const pendingDeletes = ref<string[]>([]);

const pkName = computed(
    () => columns.value.find((c) => c.primary_key)?.name ?? null,
);
const totalPages = computed(() =>
    Math.max(1, Math.ceil(total.value / pageSize.value)),
);
const dirtyFieldCount = computed(() => {
    let n = 0;
    for (const k of Object.keys(drafts)) n += Object.keys(drafts[k] || {}).length;
    return n;
});
const dirtyTotal = computed(
    () =>
        dirtyFieldCount.value +
        pendingInserts.value.length +
        pendingDeletes.value.length,
);

type GridRow =
    | { kind: "data"; row: TableRowData; index: number }
    | { kind: "pending"; insert: PendingInsert };

/** 列筛选：输入不实时过滤，点「筛选」后走数据库 */
const filterColName = ref("__all__");
const filterKeyword = ref("");
const filterInputEl = ref<HTMLInputElement | null>(null);
/** 已应用到库里的筛选（仅用于状态展示） */
const appliedFilter = ref<{ col: string; q: string } | null>(null);

const filterColOptions = computed(() => [
    { value: "__all__", label: "全部列" },
    ...columns.value.map((c) => ({ value: c.name, label: c.name })),
]);

const sqlIdent = (name: string) => `"${String(name).replace(/"/g, '""')}"`;
const sqlLike = (q: string) => `'%${q.replace(/'/g, "''")}%'`;

/** 点筛选：按列拼 WHERE，从数据库拉取结果 */
const applyDbFilter = async () => {
    const q = filterKeyword.value.trim();
    const col = filterColName.value;
    if (!q) {
        appliedFilter.value = null;
        sqlText.value = "";
        await loadTable();
        return;
    }
    const table = props.tableName;
    if (!table) return;
    const like = sqlLike(q);
    let where: string;
    if (col === "__all__") {
        const parts = columns.value.map(
            (c) => `CAST(${sqlIdent(c.name)} AS TEXT) LIKE ${like}`,
        );
        where = parts.length ? parts.join(" OR ") : "1=1";
    } else {
        where = `CAST(${sqlIdent(col)} AS TEXT) LIKE ${like}`;
    }
    const orderBy = sortCol.value
        ? ` ORDER BY ${sqlIdent(sortCol.value)} ${sortDir.value === "desc" ? "DESC" : "ASC"}`
        : "";
    sqlText.value = `SELECT * FROM ${sqlIdent(table)} WHERE ${where}${orderBy} LIMIT ${pageSize.value}`;
    appliedFilter.value = { col, q };
    await runSql();
};

const clearFilters = async () => {
    filterKeyword.value = "";
    filterColName.value = "__all__";
    appliedFilter.value = null;
    sqlText.value = "";
    await loadTable();
};

/** 网格显示顺序：数据行 + 待插入锚点（筛选结果由数据库查询给出） */
const displayRows = computed<GridRow[]>(() => {
    const out: GridRow[] = [];
    const pending = pendingInserts.value;
    rows.value.forEach((row, index) => {
        const key = rowKey(row, index);
        for (const p of pending) {
            if (p.beforeRowKey === key) out.push({ kind: "pending", insert: p });
        }
        out.push({ kind: "data", row, index });
        for (const p of pending) {
            if (p.afterRowKey === key) out.push({ kind: "pending", insert: p });
        }
    });
    for (const p of pending) {
        if (!p.afterRowKey && !p.beforeRowKey) {
            out.push({ kind: "pending", insert: p });
        }
    }
    return out;
});

/** 列头类型徽标（JetBrains 123 / AZ） */
const colTypeBadge = (col: TableColumn) => {
    const k = colEditKind(col);
    if (k === "number") return { text: "123", cls: "text-zx-primary" };
    if (k === "datetime") return { text: "DT", cls: "text-zx-text-subtle" };
    if (k === "boolean") return { text: "01", cls: "text-zx-info" };
    if (k === "json") return { text: "{}", cls: "text-zx-warning" };
    return { text: "AZ", cls: "text-zx-text-muted" };
};

const rowKey = (row: TableRowData, index: number) => {
    if (pkName.value) return String(row.data?.[pkName.value] ?? row.id);
    return `i${index}`;
};

const isDirty = (key: string) =>
    Boolean(drafts[key] && Object.keys(drafts[key]).length) ||
    pendingDeletes.value.includes(key);

const cellValue = (row: TableRowData, index: number, col: string) => {
    const key = rowKey(row, index);
    if (drafts[key] && col in drafts[key]) return drafts[key][col];
    const v = row.data?.[col];
    return v === null || v === undefined ? "" : String(v);
};

const typeLabel = (t: string) => (t || "").toLowerCase();

/**
 * 列编辑类型 — 五类：
 * 数字 / 文本 / 时间 / 布尔 / JSON（含 id 等主键列也可编辑）
 */
type CellEditKind = "boolean" | "number" | "datetime" | "json" | "text";

const colEditKind = (col: TableColumn): CellEditKind => {
    const t = (col.type || "").toLowerCase();
    if (/\bbool/.test(t)) return "boolean";
    if (
        /int|float|double|numeric|decimal|real|serial|bigint|smallint|money/.test(
            t,
        )
    ) {
        return "number";
    }
    if (/date|time|timestamp/.test(t)) return "datetime";
    if (/json/.test(t)) return "json";
    return "text";
};

/** 单元格选中：单击 / Ctrl 多选 / Shift 框选 */
const selectedCell = ref<{ rowKey: string; col: string } | null>(null);
const selectedHeader = ref<string | null>(null);
/** 整行选中：点左侧序号；数据行=rowKey，待插入=pend:id */
const selectedRowKey = ref<string | null>(null);
/** 多选集合：key = rowKey + '\u0000' + col */
const selectedCells = ref<Set<string>>(new Set());
const selAnchorId = ref<string | null>(null);

const cellSelId = (key: string, col: string) => `${key}\u0000${col}`;

const editPopover = ref<{
    rowKey: string;
    col: string;
    index: number;
    row: TableRowData;
    draftValue: string;
    language: "text" | "json";
    x: number;
    y: number;
} | null>(null);

const isCellSelected = (key: string, col: string) => {
    // 表头单击 / 侧栏跳转：整列；序号单击：整行
    if (selectedHeader.value && selectedHeader.value === col) return true;
    if (selectedRowKey.value && selectedRowKey.value === key) return true;
    const id = cellSelId(key, col);
    if (selectedCells.value.size > 0) return selectedCells.value.has(id);
    return (
        !!selectedCell.value &&
        selectedCell.value.rowKey === key &&
        selectedCell.value.col === col
    );
};

/** 待插入行单元格 */
const pendingCellId = (insertId: string, col: string) =>
    `pend:${insertId}:${col}`;
const isPendingCellSelected = (insertId: string, col: string) =>
    (!!selectedHeader.value && selectedHeader.value === col) ||
    (!!selectedRowKey.value &&
        selectedRowKey.value === `pend:${insertId}`) ||
    selectedCells.value.has(pendingCellId(insertId, col));
const editingPending = ref<{ id: string; col: string } | null>(null);
const pendingDraft = ref("");
const pendingInputEl = ref<HTMLInputElement | null>(null);

const clickPendingCell = (insert: PendingInsert, col: TableColumn) => {
    selectedHeader.value = null;
    selectedRowKey.value = null;
    const id = pendingCellId(insert.id, col.name);
    selectedCells.value = new Set([id]);
    selectedCell.value = { rowKey: `pend:${insert.id}`, col: col.name };
    selAnchorId.value = id;
};

const startEditPending = async (
    insert: PendingInsert,
    col: TableColumn,
) => {
    clickPendingCell(insert, col);
    editingPending.value = { id: insert.id, col: col.name };
    const v = insert.data[col.name];
    pendingDraft.value = v == null ? "" : String(v);
    await nextTick();
    pendingInputEl.value?.focus();
    pendingInputEl.value?.select();
};

const commitPendingEdit = (insert: PendingInsert, col: TableColumn) => {
    if (
        editingPending.value?.id === insert.id &&
        editingPending.value?.col === col.name
    ) {
        insert.data[col.name] =
            pendingDraft.value === "" ? null : pendingDraft.value;
    }
    editingPending.value = null;
};

const cancelPendingEdit = () => {
    editingPending.value = null;
};

const removePendingInsert = (insert: PendingInsert) => {
    pendingInserts.value = pendingInserts.value.filter(
        (p) => p.id !== insert.id,
    );
};

const setPendingNull = (insert: PendingInsert, col: TableColumn) => {
    insert.data[col.name] = null;
};

const pendingCellText = (insert: PendingInsert, col: TableColumn) => {
    const v = insert.data[col.name];
    return v == null || v === "" ? "NULL" : String(v);
};

/** 待插入行右键：JetBrains 式分组 */
const showPendingMenu = (
    e: MouseEvent,
    insert: PendingInsert,
    col?: TableColumn,
) => {
    if (col) clickPendingCell(insert, col);
    const items: ZXContextMenuItem[] = [
        {
            label: "刷新",
            icon: RefreshCw,
            action: () => loadTable(),
        },
    ];
    if (col) {
        items.push(
            menuSep(),
            {
                label: "编辑单元格",
                icon: Pencil,
                action: () => void startEditPending(insert, col),
            },
            {
                label: "设为 NULL",
                icon: Trash2,
                action: () => setPendingNull(insert, col),
            },
        );
    }
    items.push(
        menuSep(),
        {
            label: "删除待插入行",
            icon: Trash2,
            danger: true,
            action: () => removePendingInsert(insert),
        },
    );
    ZXContextMenu.show({
        x: e.clientX,
        y: e.clientY,
        items,
    });
};
const isColReadonly = (_col: TableColumn) => false;

/** 单元格：鼠标双击 + 触控双击 同一套编辑入口 */
const cellDoubleTap = createDoubleTap(350);

const onCellClick = (
    row: TableRowData,
    index: number,
    col: TableColumn,
    e: MouseEvent,
) => {
    const key = rowKey(row, index);
    selectedHeader.value = null;
    selectedRowKey.value = null;
    const id = cellSelId(key, col.name);

    if (e.ctrlKey || e.metaKey) {
        const next = new Set(selectedCells.value);
        if (next.has(id) && next.size > 1) next.delete(id);
        else next.add(id);
        selectedCells.value = next;
        selectedCell.value = { rowKey: key, col: col.name };
        selAnchorId.value = id;
    } else if (e.shiftKey && selAnchorId.value) {
        const parts = selAnchorId.value.split("\u0000");
        const aKey = parts[0];
        const aCol = parts[1] || "";
        const colIdx = (c: string) =>
            columns.value.findIndex((x) => x.name === c);
        const rowIdx = (k: string) =>
            rows.value.findIndex((r, i) => rowKey(r, i) === k);
        const r0 = rowIdx(aKey);
        const r1 = rowIdx(key);
        const c0 = colIdx(aCol);
        const c1 = colIdx(col.name);
        if (r0 >= 0 && r1 >= 0 && c0 >= 0 && c1 >= 0) {
            const next = new Set<string>();
            const ra = Math.min(r0, r1);
            const rb = Math.max(r0, r1);
            const ca = Math.min(c0, c1);
            const cb = Math.max(c0, c1);
            for (let ri = ra; ri <= rb; ri++) {
                const rk = rowKey(rows.value[ri]!, ri);
                for (let ci = ca; ci <= cb; ci++) {
                    const cn = columns.value[ci]!.name;
                    next.add(cellSelId(rk, cn));
                }
            }
            selectedCells.value = next;
            selectedCell.value = { rowKey: key, col: col.name };
        }
    } else {
        selectedCells.value = new Set([id]);
        selectedCell.value = { rowKey: key, col: col.name };
        selAnchorId.value = id;
        const tapKey = `${key}:${col.name}`;
        if (cellDoubleTap(tapKey)) {
            openCellEditor(row, index, col, e);
        }
        return;
    }

    const tapKey = `${key}:${col.name}`;
    if (selectedCells.value.size === 1 && cellDoubleTap(tapKey)) {
        openCellEditor(row, index, col, e);
    }
};

const selectCell = (key: string, col: string) => {
    selectedHeader.value = null;
    selectedRowKey.value = null;
    if (isCellEditing(key, col)) return;
    selectedCell.value = { rowKey: key, col };
    selectedCells.value = new Set([cellSelId(key, col)]);
    selAnchorId.value = cellSelId(key, col);
};

/** 单击表头：选中整列（含当前页所有数据行/待插入行） */
const selectHeader = (colName: string) => {
    selectedCell.value = null;
    selectedRowKey.value = null;
    editPopover.value = null;
    dtEdit.value = null;
    dtHover.value = null;
    selectedHeader.value = colName;
    const next = new Set<string>();
    for (const g of displayRows.value) {
        if (g.kind === "data") {
            next.add(cellSelId(rowKey(g.row, g.index), colName));
        } else if (g.kind === "pending") {
            next.add(pendingCellId(g.insert.id, colName));
        }
    }
    selectedCells.value = next;
    selAnchorId.value = null;
};

/** 单击左侧序号：选中整行 */
const selectDataRow = (key: string) => {
    selectedHeader.value = null;
    selectedCell.value = null;
    editPopover.value = null;
    dtEdit.value = null;
    dtHover.value = null;
    selectedRowKey.value = key;
    selectedCells.value = new Set(
        columns.value.map((c) => cellSelId(key, c.name)),
    );
    selAnchorId.value = null;
};

const selectPendingRow = (insertId: string) => {
    selectedHeader.value = null;
    selectedCell.value = null;
    editPopover.value = null;
    dtEdit.value = null;
    dtHover.value = null;
    selectedRowKey.value = `pend:${insertId}`;
    selectedCells.value = new Set(
        columns.value.map((c) => pendingCellId(insertId, c.name)),
    );
    selAnchorId.value = null;
};

const boolChecked = (row: TableRowData, index: number, col: string) => {
    const v = cellValue(row, index, col);
    return v === true || v === "true" || v === "1" || v === 1;
};

/** 单元格显示文本：含 NULL 草稿；标记删除的行仍显示原数据 */
const displayCellText = (
    row: TableRowData,
    index: number,
    col: TableColumn,
): string => {
    if (colEditKind(col) === "boolean") {
        return boolChecked(row, index, col.name) ? "true" : "false";
    }
    const key = rowKey(row, index);
    const draftMap = drafts[key];
    const hasNullDraft =
        !!draftMap &&
        Object.prototype.hasOwnProperty.call(draftMap, col.name) &&
        (draftMap[col.name] === "" || draftMap[col.name] == null);
    const rawNull = row.data?.[col.name] == null;
    const text = cellValue(row, index, col.name);
    if (text === "" && (rawNull || hasNullDraft)) return "NULL";
    return String(text);
};

const toDatetimeLocal = (v: unknown) => {
    if (v === null || v === undefined || v === "") return "";
    const d = new Date(String(v));
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/**
 * 双击：
 * - 文本 / JSON = Supabase 结构浮窗（DbCellEditor + Monaco，跟主题）
 * - 时间 = Supabase 时间编辑浮层
 * - 其余类型 = 格内无皮肤输入
 */
const openCellEditor = (
    row: TableRowData,
    index: number,
    col: TableColumn,
    e: MouseEvent,
) => {
    const key = rowKey(row, index);
    selectedHeader.value = null;
    selectedRowKey.value = null;
    selectedCell.value = { rowKey: key, col: col.name };
    boolPop.value = null;
    editPopover.value = null;
    editingCell.value = null;
    dtHover.value = null;

    const kind = colEditKind(col);
    const raw = cellValue(row, index, col.name);

    if (kind === "text" || kind === "json") {
        const host = e.currentTarget as HTMLElement;
        const r = host.getBoundingClientRect();
        const w = 360;
        const h = 260;
        let draft = String(raw ?? "");
        if (kind === "json" && draft && !draft.startsWith("\n")) {
            try {
                const parsed = JSON.parse(draft);
                if (parsed && typeof parsed === "object") {
                    draft = JSON.stringify(parsed, null, 2);
                }
            } catch {
                /* 非法 JSON 保持原文，交给编辑器改 */
            }
        }
        editPopover.value = {
            rowKey: key,
            col: col.name,
            index,
            row,
            draftValue: draft,
            language: kind === "json" ? "json" : "text",
            x: Math.min(r.left, window.innerWidth - w - 12),
            y: Math.min(r.bottom + 4, window.innerHeight - h - 12),
        };
        return;
    }

    if (kind === "datetime") {
        const host = e.currentTarget as HTMLElement;
        const r = host.getBoundingClientRect();
        const w = 288;
        const h = 180;
        const rawStr = String(raw ?? "");
        // PG timestamp / datetime → 与库内一致的字符串格式
        const valueFormat =
            /timestamp|datetime/i.test(col.type || "") ||
            /\.\d{3,}\s*[+-]\d{2}/.test(rawStr)
                ? "postgres"
                : "iso";
        dtEdit.value = {
            rowKey: key,
            col: col.name,
            index,
            row,
            draftValue: rawStr,
            valueFormat,
            x: Math.min(r.left, window.innerWidth - w - 12),
            y: Math.min(r.bottom + 4, window.innerHeight - h - 12),
        };
        registerDtOverlay();
        void nextTick(() => {
            dtInputEl.value?.focus();
            dtInputEl.value?.select();
        });
        return;
    }

    inlineDraft.value = String(raw ?? "");
    editingCell.value = { rowKey: key, col: col.name, kind: "inline" };
    void nextTick(() => {
        numberInputEl.value?.focus();
        numberInputEl.value?.select();
    });
};

/** 时间：编辑浮层 + 悬停时区信息（对齐 Supabase） */
const dtEdit = ref<{
    rowKey: string;
    col: string;
    index: number;
    row: TableRowData;
    draftValue: string;
    valueFormat?: string;
    x: number;
    y: number;
} | null>(null);

const dtHover = ref<{
    x: number;
    y: number;
    utc: string;
    local: string;
    zone: string;
    relative: string;
    timestamp: string;
} | null>(null);

const MONTHS = [
    "1月",
    "2月",
    "3月",
    "4月",
    "5月",
    "6月",
    "7月",
    "8月",
    "9月",
    "10月",
    "11月",
    "12月",
];
const pad2 = (n: number) => String(n).padStart(2, "0");

/** 中文时间：2026年9月17日 23:52:12 */
const fmtClockZh = (d: Date, utc: boolean) => {
    const day = utc ? d.getUTCDate() : d.getDate();
    const mon = utc ? d.getUTCMonth() : d.getMonth();
    const yr = utc ? d.getUTCFullYear() : d.getFullYear();
    const hh = utc ? d.getUTCHours() : d.getHours();
    const mm = utc ? d.getUTCMinutes() : d.getMinutes();
    const ss = utc ? d.getUTCSeconds() : d.getSeconds();
    return `${yr}年${MONTHS[mon]}${day}日 ${pad2(hh)}:${pad2(mm)}:${pad2(ss)}`;
};

const fmtPreview = (v: string) => {
    if (!v) return "—";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return v;
    const off = -d.getTimezoneOffset();
    const sign = off >= 0 ? "+" : "-";
    const abs = Math.abs(off);
    return `${fmtClockZh(d, false)} (${sign}${pad2(Math.floor(abs / 60))}${pad2(abs % 60)})`;
};

const fmtRelative = (d: Date) => {
    const diff = Date.now() - d.getTime();
    const abs = Math.abs(diff);
    const sec = Math.round(abs / 1000);
    const min = Math.round(sec / 60);
    const hour = Math.round(min / 60);
    const day = Math.round(hour / 24);
    let unit: string;
    if (sec < 60) unit = `${sec} 秒`;
    else if (min < 60) unit = `${min} 分钟`;
    else if (hour < 24) unit = `${hour} 小时`;
    else unit = `${day} 天`;
    return diff >= 0 ? `${unit}前` : `${unit}后`;
};

const buildDtHoverInfo = (rawValue: string, e: { clientX: number; clientY: number }) => {
    if (!rawValue) return null;
    const d = new Date(rawValue);
    if (Number.isNaN(d.getTime())) return null;
    return {
        x: e.clientX + 12,
        y: Math.min(e.clientY + 12, window.innerHeight - 140),
        utc: fmtClockZh(d, true),
        local: fmtClockZh(d, false),
        zone: "本地时间",
        relative: fmtRelative(d),
        timestamp: String(d.getTime()),
    };
};

const showDtHover = (e: MouseEvent, row: TableRowData, index: number, col: TableColumn) => {
    // 仅选中单元格展示时区浮层；选中格不挂 title，避免系统 tooltip 遮挡
    const key = rowKey(row, index);
    if (!isCellSelected(key, col.name)) return;
    if (dtEdit.value) return;
    const raw = cellValue(row, index, col.name);
    dtHover.value = buildDtHoverInfo(String(raw ?? ""), e);
};

/** 浮窗内「格式化值」悬停：用当前草稿值展示时区信息 */
const showDtHoverFromDraft = (e: MouseEvent) => {
    if (!dtEdit.value) return;
    dtHover.value = buildDtHoverInfo(dtEdit.value.draftValue, e);
};

const hideDtHoverFromDraft = () => {
    dtHover.value = null;
};

const setDtNow = () => {
    if (!dtEdit.value) return;
    dtEdit.value.draftValue = new Date().toISOString();
};

/** 时间选择器 ↔ 草稿（datetime-local 需要本地可读格式） */
const dtLocalPicker = computed({
    get: () => toDatetimeLocal(dtEdit.value?.draftValue ?? ""),
    set: (v: string) => {
        if (!dtEdit.value) return;
        if (!v) {
            dtEdit.value.draftValue = "";
            return;
        }
        const d = new Date(v);
        dtEdit.value.draftValue = Number.isNaN(d.getTime())
            ? v
            : d.toISOString();
    },
});

const commitDtEdit = () => {
    const p = dtEdit.value;
    removeOverlay(OVERLAY_ID.cellDateTime);
    if (!p) return;
    const orig = p.row.data?.[p.col];
    const origStr = orig === null || orig === undefined ? "" : String(orig);
    const draft = p.draftValue.trim();
    if (!drafts[p.rowKey]) drafts[p.rowKey] = {};
    if (draft === origStr) {
        delete drafts[p.rowKey][p.col];
        if (!Object.keys(drafts[p.rowKey]).length) delete drafts[p.rowKey];
    } else {
        drafts[p.rowKey][p.col] = draft;
    }
    dtEdit.value = null;
    dtHover.value = null;
};

const cancelDtEdit = () => {
    removeOverlay(OVERLAY_ID.cellDateTime);
    dtEdit.value = null;
    dtHover.value = null;
};

/** 浮层栈：单元格时间编辑 / 上层面板一层一层关 */
const { pushOverlay, removeOverlay, isTopOverlay, isFocusInAnyOverlay } =
    useOverlayStack();

/** 失焦关闭：仅当本浮层在栈顶时才提交；上层还开着则交给栈处理 */
const dtPanelEl = ref<HTMLElement | null>(null);
const dtInputEl = ref<HTMLInputElement | null>(null);
const dtClockRef = ref<HTMLElement | null>(null);
const dtPickerRef = ref<{
    openPicker?: () => void;
    closePicker?: () => void;
} | null>(null);

const registerDtOverlay = () => {
    pushOverlay({
        id: OVERLAY_ID.cellDateTime,
        el: () => dtPanelEl.value,
        anchors: () => [dtClockRef.value, dtInputEl.value],
        onClose: () => commitDtEdit(),
        closeOnOutsideClick: true,
        closeOnEsc: true,
    });
};

const openDtPicker = () => {
    dtPickerRef.value?.openPicker?.();
};

const onDtFocusOut = (e: FocusEvent) => {
    const next = e.relatedTarget as HTMLElement | null;
    if (next && dtPanelEl.value?.contains(next)) return;
    // 焦点进入任一浮层（日期时间面板、时区地图等）→ 不关
    if (isFocusInAnyOverlay(next)) return;
    // 仍有更高层浮层开着：只关上层，不因失焦关掉底层单元格编辑
    if (!isTopOverlay(OVERLAY_ID.cellDateTime)) return;
    commitDtEdit();
};

const onDtKeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
        e.preventDefault();
        cancelDtEdit();
        return;
    }
    if (e.key === "Enter" && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        commitDtEdit();
    }
};

/** 格内编辑：所有类型同一套 */
const editingCell = ref<{
    rowKey: string;
    col: string;
    kind: "inline";
} | null>(null);
const boolDraft = ref("");
const boolPop = ref<{ x: number; y: number; row: TableRowData; index: number; col: string; rowKey: string } | null>(null);
const inlineDraft = ref("");
const numberInputEl = ref<HTMLInputElement | null>(null);

const isCellEditing = (key: string, col: string) =>
    editingCell.value?.rowKey === key && editingCell.value?.col === col;

const isInlineEditing = (key: string, col: string) => isCellEditing(key, col);

/** 写草稿；与原值相同则清掉 */
const commitInline = (
    row: TableRowData,
    index: number,
    col: string,
) => {
    const ed = editingCell.value;
    if (!ed) return;
    const key = rowKey(row, index);
    const orig = row.data?.[col];
    const origStr =
        orig === null || orig === undefined ? "" : String(orig);
    const draft = inlineDraft.value.trim();
    if (!drafts[key]) drafts[key] = {};
    if (draft === origStr) {
        delete drafts[key][col];
        if (!Object.keys(drafts[key]).length) delete drafts[key];
    } else {
        drafts[key][col] = draft;
    }
    editingCell.value = null;
};

const cancelInline = () => {
    editingCell.value = null;
};

/** 布尔 change：写草稿；失焦/取消：退出编辑 */
const onBoolChange = (
    row: TableRowData,
    index: number,
    col: string,
) => {
    const key = rowKey(row, index);
    const orig = row.data?.[col];
    const origStr =
        orig === null || orig === undefined
            ? ""
            : orig === true
              ? "true"
              : orig === false
                ? "false"
                : String(orig);
    if (!drafts[key]) drafts[key] = {};
    if (boolDraft.value === origStr) {
        delete drafts[key][col];
        if (!Object.keys(drafts[key]).length) delete drafts[key];
    } else {
        drafts[key][col] = boolDraft.value;
    }
};

const pickBool = (val: string) => {
    const p = boolPop.value;
    if (!p) return;
    boolDraft.value = val;
    onBoolChange(p.row, p.index, p.col);
    closeBoolPop();
};

const closeBoolPop = () => {
    boolPop.value = null;
    editingCell.value = null;
};

const exitBoolEdit = () => {
    // 失焦延迟关闭，避免点选项时先 blur
    setTimeout(() => {
        if (!boolPop.value) editingCell.value = null;
    }, 120);
};

const closePopover = () => {
    editPopover.value = null;
};

const commitPopover = () => {
    const p = editPopover.value;
    if (!p) return;
    const meta = columns.value.find((c) => c.name === p.col);
    if (!meta) return closePopover();
    const orig = p.row.data?.[p.col];
    const origStr = orig === null || orig === undefined ? "" : String(orig);
    if (p.draftValue === origStr) {
        if (drafts[p.rowKey]) {
            delete drafts[p.rowKey][p.col];
            if (!Object.keys(drafts[p.rowKey]).length) delete drafts[p.rowKey];
        }
    } else {
        if (!drafts[p.rowKey]) drafts[p.rowKey] = {};
        drafts[p.rowKey][p.col] = p.draftValue;
    }
    closePopover();
};

const setPopoverNull = () => {
    const p = editPopover.value;
    if (!p) return closePopover();
    if (!drafts[p.rowKey]) drafts[p.rowKey] = {};
    drafts[p.rowKey][p.col] = "";
    closePopover();
};

const onPopoverKeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
        e.preventDefault();
        closePopover();
        return;
    }
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        commitPopover();
    }
};

const popoverColMeta = computed(() =>
    columns.value.find((c) => c.name === editPopover.value?.col) ||
    ({ name: "", type: "", nullable: true } as TableColumn),
);

const loadTable = async () => {
    if (!props.tableName) return;
    loading.value = true;
    error.value = "";
    try {
        const [colRes, dataRes] = await Promise.all([
            databaseApi.getTableColumns(props.tableName),
            databaseApi.getTableData(props.tableName, page.value, pageSize.value),
        ]);
        if (colRes?.success && colRes.data) columns.value = colRes.data;
        if (dataRes?.success && dataRes.data) {
            let items = dataRes.data.items ?? [];
            total.value = dataRes.data.total ?? items.length;
            if (sortCol.value) {
                items = [...items].sort((a, b) => {
                    const cmp = String(a.data?.[sortCol.value] ?? "").localeCompare(
                        String(b.data?.[sortCol.value] ?? ""),
                        "zh",
                        { numeric: true },
                    );
                    return sortDir.value === "asc" ? cmp : -cmp;
                });
            }
            rows.value = items;
        } else if (dataRes && dataRes.success === false) {
            error.value = dataRes.message || "加载失败";
        }
    } catch (e: any) {
        error.value = e?.message || "加载失败";
    } finally {
        loading.value = false;
    }
};

const runSql = async () => {
    const sql = sqlText.value.trim();
    if (!sql) {
        await loadTable();
        return;
    }
    sqlRunning.value = true;
    error.value = "";
    try {
        const res = await databaseApi.executeSql({ sql });
        if (!res?.success || !res.data?.data) {
            error.value = res?.data?.message || res?.message || "SQL 执行失败";
            return;
        }
        const list = res.data.data as Record<string, any>[];
        const names = list.length ? Object.keys(list[0]) : [];
        // 用结果列覆盖网格（结构/主键以结果为准，便于只读查看）
        columns.value = names.map((n) => ({
            name: n,
            type: "",
            nullable: true,
            primary_key: n.toLowerCase() === "id" || n === pkName.value,
        }));
        rows.value = list.map((r, i) => ({ id: r.id ?? i, data: r }));
        total.value = list.length;
        page.value = 1;
        await dbStore.runSql(sql);
    } catch (e: any) {
        error.value = e?.response?.data?.message || e?.message || "SQL 执行失败";
    } finally {
        sqlRunning.value = false;
    }
};

const openSortPop = () => {
    sortPick.value = {
        col: sortCol.value || columns.value[0]?.name || "",
        dir: sortDir.value,
    };
    showSortPop.value = !showSortPop.value;
};

const applySort = () => {
    sortCol.value = sortPick.value.col;
    sortDir.value = sortPick.value.dir;
    showSortPop.value = false;
    sqlText.value = "";
    loadTable();
};

const startInsert = () => {
    inserting.value = true;
    for (const c of columns.value) newRow[c.name] = "";
};

const cancelInsert = () => {
    inserting.value = false;
    for (const k of Object.keys(newRow)) delete newRow[k];
};

const queueInsert = () => {
    const data: Record<string, any> = {};
    for (const c of columns.value) {
        const v = newRow[c.name];
        if (v === "" || v == null) continue;
        data[c.name] = v;
    }
    if (!Object.keys(data).length) return;
    pendingInserts.value = [
        ...pendingInserts.value,
        { id: `p${++pendingSeq}`, data },
    ];
    cancelInsert();
};

/** 待插入行：挂在数据行上/下；无锚点则列表末尾 */
const lastRowCtx = ref<{ row: TableRowData; index: number } | null>(null);

const blankRowData = () => {
    const data: Record<string, any> = {};
    for (const c of columns.value) data[c.name] = "";
    return data;
};

/** 克隆行：保留各列值（含 null），仅去掉主键 */
const cloneRowForInsert = (row: TableRowData) => {
    const data: Record<string, any> = {};
    for (const c of columns.value) {
        if (pkName.value && c.name === pkName.value) continue;
        const v = row.data?.[c.name];
        data[c.name] = v === undefined ? null : v;
    }
    return data;
};

const queueInsertAt = (
    data: Record<string, any>,
    anchor?: { after?: string; before?: string },
) => {
    pendingInserts.value = [
        ...pendingInserts.value,
        {
            id: `p${++pendingSeq}`,
            data,
            afterRowKey: anchor?.after,
            beforeRowKey: anchor?.before,
        },
    ];
    ZXNotification({
        title: "已加入待插入",
        message: "新行显示在对应位置，保存后写入数据库",
        type: "info",
        position: "top-right",
    });
};

const insertRowAt = (pos: "above" | "below") => {
    const ctx = lastRowCtx.value;
    const key = ctx ? rowKey(ctx.row, ctx.index) : undefined;
    queueInsertAt(blankRowData(), {
        after: pos === "below" ? key : undefined,
        before: pos === "above" ? key : undefined,
    });
};

const duplicateRowDown = (row: TableRowData, index: number) => {
    queueInsertAt(cloneRowForInsert(row), {
        after: rowKey(row, index),
    });
};

const copyCellToClipboard = (row: TableRowData, index: number, col: string) => {
    const text = String(cellValue(row, index, col) ?? "");
    void navigator.clipboard?.writeText(text);
    ZXNotification({
        title: "已复制",
        message: `单元格「${col}」内容已复制`,
        type: "success",
        position: "top-right",
    });
};

const setCellNull = (row: TableRowData, index: number, col: string) => {
    const targets: Array<{ key: string; col: string }> = [];
    if (selectedCells.value.size > 1) {
        for (const id of selectedCells.value) {
            const parts = id.split("\u0000");
            if (parts[0] && parts[1]) {
                targets.push({ key: parts[0], col: parts[1] });
            }
        }
    } else {
        targets.push({ key: rowKey(row, index), col });
    }
    for (const t of targets) {
        if (!drafts[t.key]) drafts[t.key] = {};
        drafts[t.key][t.col] = "";
    }
    ZXNotification({
        title: "已设为 NULL",
        message: `${targets.length} 个单元格待保存`,
        type: "info",
        position: "top-right",
    });
};

const toggleDelete = (row: TableRowData, index: number) => {
    const key = rowKey(row, index);
    if (!pkName.value) return;
    pendingDeletes.value = pendingDeletes.value.includes(key)
        ? pendingDeletes.value.filter((k) => k !== key)
        : [...pendingDeletes.value, key];
};

const discardAll = () => {
    for (const k of Object.keys(drafts)) delete drafts[k];
    pendingInserts.value = [];
    pendingDeletes.value = [];
    cancelInsert();
};

/** 表头菜单：仅排序 + 复制列名（筛选在表头上方筛选栏，避免两套入口） */
const showColumnMenu = (e: MouseEvent, col: TableColumn) => {
    const badge = colTypeBadge(col);
    const applySort = (dir: "asc" | "desc" | null) => {
        sortCol.value = dir ? col.name : "";
        sortDir.value = dir || "asc";
        sqlText.value = "";
        loadTable();
    };
    ZXContextMenu.show({
        x: e.clientX,
        y: e.clientY,
        items: [
            { label: "升序", action: () => applySort("asc") },
            { label: "降序", action: () => applySort("desc") },
            {
                label: "清除排序",
                disabled: sortCol.value !== col.name,
                action: () => applySort(null),
            },
            menuSep(),
            {
                label: "复制列名",
                icon: Copy,
                action: () => {
                    void navigator.clipboard?.writeText(col.name);
                    ZXNotification({
                        title: "已复制",
                        message: col.name,
                        type: "success",
                        position: "top-right",
                    });
                },
            },
            menuSep(),
            {
                label: `${badge.text}  ${typeLabel(col.type) || "unknown"}`,
                disabled: true,
            },
        ],
    });
};

/** 单元格 / 行右键；刷新在首，删除/恢复按行状态切换 */
const showRowMenu = (
    e: MouseEvent,
    row: TableRowData,
    index: number,
    col?: string,
) => {
    const key = rowKey(row, index);
    const marked = pendingDeletes.value.includes(key);
    lastRowCtx.value = { row, index };

    // 右键单元格时先选中，保证 NULL/复制作用在点中的格上
    if (col) {
        selectedCell.value = { rowKey: key, col };
        const id = cellSelId(key, col);
        if (!selectedCells.value.has(id)) {
            selectedCells.value = new Set([id]);
            selAnchorId.value = id;
        }
    }

    const colName = col || "";
    const colMeta = colName
        ? columns.value.find((c) => c.name === colName)
        : undefined;

    /** JetBrains 式：刷新 | 单元格编辑 | 行结构 | 危险操作 */
    const items: ZXContextMenuItem[] = [
        {
            label: "刷新",
            icon: RefreshCw,
            action: () => loadTable(),
        },
    ];

    if (colMeta || colName) {
        items.push(menuSep());
        if (colMeta) {
            items.push({
                label: "编辑单元格",
                icon: Pencil,
                action: () => openCellEditor(row, index, colMeta, e),
            });
        }
        if (colName) {
            items.push(
                {
                    label: "复制",
                    icon: Copy,
                    action: () => copyCellToClipboard(row, index, colName),
                },
                {
                    label: "设为 NULL",
                    icon: Trash2,
                    action: () => setCellNull(row, index, colName),
                },
            );
        }
    }

    items.push(
        menuSep(),
        {
            label: "插入行",
            icon: Plus,
            children: [
                {
                    label: "向上插入",
                    icon: CornerLeftUp,
                    action: () => insertRowAt("above"),
                },
                {
                    label: "向下插入",
                    icon: CornerRightDown,
                    action: () => insertRowAt("below"),
                },
            ],
        },
        {
            label: "复制当前行",
            icon: Copy,
            action: () => duplicateRowDown(row, index),
        },
        menuSep(),
        {
            label: marked ? "恢复当前行" : "删除当前行",
            icon: marked ? RotateCcw : Trash2,
            danger: !marked,
            success: marked,
            action: () => toggleDelete(row, index),
        },
    );

    ZXContextMenu.show({
        x: e.clientX,
        y: e.clientY,
        items,
    });
};

const revertRow = (row: TableRowData, index: number) => {
    delete drafts[rowKey(row, index)];
};

const saveAll = async () => {
    if (!props.tableName || !dirtyTotal.value) return;
    saving.value = true;
    let ok = 0;
    let fail = 0;
    try {
        for (const item of pendingInserts.value) {
            const res = await databaseApi.insertRow(props.tableName, {
                data: item.data,
            });
            res?.success ? ok++ : fail++;
        }
        for (const [key, draft] of Object.entries(drafts)) {
            if (!Object.keys(draft).length || !pkName.value) continue;
            const row = rows.value.find((r, i) => rowKey(r, i) === key);
            const id = row?.data?.[pkName.value] ?? key;
            const res = await databaseApi.updateRow(props.tableName, id, {
                data: draft,
            });
            res?.success ? ok++ : fail++;
        }
        for (const key of pendingDeletes.value) {
            if (!pkName.value) continue;
            const row = rows.value.find((r, i) => rowKey(r, i) === key);
            const id = row?.data?.[pkName.value] ?? key;
            const res = await databaseApi.deleteRow(props.tableName, id);
            res?.success ? ok++ : fail++;
        }
        if (fail === 0) {
            ZXNotification({
                title: "保存成功～",
                message: `已提交 ${ok} 项`,
                type: "success",
                position: "top-right",
            });
            discardAll();
            loadTable();
        } else {
            ZXNotification({
                title: "部分失败",
                message: `成功 ${ok} · 失败 ${fail}`,
                type: "error",
                position: "top-right",
            });
            loadTable();
        }
    } catch (e: any) {
        ZXNotification({
            title: "保存失败",
            message: e?.message || "",
            type: "error",
            position: "top-right",
        });
    } finally {
        saving.value = false;
    }
};

/** 当前网格导出为 CSV（含待插入/未保存草稿的展示值） */
const exportGridCsv = () => {
    const cols = columns.value.map((c) => c.name);
    const lines = [cols.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")];
    for (const g of displayRows.value) {
        const vals =
            g.kind === "data"
                ? cols.map((c) => {
                      const t = displayCellText(g.row, g.index, columns.value.find((x) => x.name === c)!);
                      return `"${String(t).replace(/"/g, '""')}"`;
                  })
                : cols.map((c) => {
                      const t = pendingCellText(
                          g.insert,
                          columns.value.find((x) => x.name === c)!,
                      );
                      return `"${String(t).replace(/"/g, '""')}"`;
                  });
        lines.push(vals.join(","));
    }
    const blob = new Blob(["\uFEFF" + lines.join("\n")], {
        type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${props.tableName || "table"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
};

const changePageSize = (n: number) => {
    pageSize.value = n;
    page.value = 1;
    loadTable();
};

const markDeleteSelected = () => {
    const ctx = lastRowCtx.value;
    if (!ctx) return;
    toggleDelete(ctx.row, ctx.index);
};

const cloneSelectedRow = () => {
    const ctx = lastRowCtx.value;
    if (!ctx) return;
    duplicateRowDown(ctx.row, ctx.index);
};

const tbCls =
    "btn-touch flex h-7 items-center gap-1 rounded-md px-2 text-xs text-zx-text-muted transition-colors hover:bg-white hover:text-zx-text disabled:pointer-events-none disabled:opacity-35";

const openRefreshMenu = (e: MouseEvent) => {
    ZXContextMenu.show({
        x: e.clientX,
        y: e.clientY,
        items: [
            {
                label: "刷新当前页",
                icon: RefreshCw,
                action: () => loadTable(),
            },
            {
                label: "刷新并清除 SQL",
                icon: RefreshCw,
                action: () => {
                    sqlText.value = "";
                    loadTable();
                },
            },
        ],
    });
};

const openSaveMenu = (e: MouseEvent) => {
    ZXContextMenu.show({
        x: e.clientX,
        y: e.clientY,
        items: [
            {
                label: "保存全部更改",
                icon: CheckCircle2,
                disabled: dirtyTotal.value <= 0 || saving.value,
                action: () => void saveAll(),
            },
            menuSep(),
            {
                label: "放弃全部更改",
                icon: X,
                danger: true,
                disabled: dirtyTotal.value <= 0,
                action: () => discardAll(),
            },
        ],
    });
};

const openExportMenu = (e: MouseEvent) => {
    ZXContextMenu.show({
        x: e.clientX,
        y: e.clientY,
        items: [
            {
                label: "导出当前页 CSV",
                icon: Download,
                action: () => exportGridCsv(),
            },
        ],
    });
};

const handlePageChange = (p: number) => {
    page.value = p;
    loadTable();
};

watch(
    () => props.tableName,
    () => {
        page.value = 1;
        sqlText.value = "";
        selectedCell.value = null;
        selectedCells.value = new Set();
        selAnchorId.value = null;
        selectedHeader.value = null;
        selectedRowKey.value = null;
        editPopover.value = null;
        editingCell.value = null;
        discardAll();
        loadTable();
    },
);

/** 网格滚动容器：定位列时仅在网格内滚动 */
const gridEl = ref<HTMLElement | null>(null);

/** 侧栏双击列：整列选中 + 横向滚到该列（不滚动外层） */
const applyFocusColumn = async (colName?: string) => {
    if (!colName) return;
    // 等列数据就绪
    for (let i = 0; i < 40 && !columns.value.length; i++) {
        await new Promise((r) => setTimeout(r, 50));
    }
    if (!columns.value.some((c) => c.name === colName)) return;
    // 与表头单击同一路径：选中整列
    selectHeader(colName);
    await nextTick();
    const root = gridEl.value;
    const el = root?.querySelector<HTMLElement>(
        `[data-col="${CSS.escape(colName)}"]`,
    );
    scrollElementInContainer(root, el, "both");
};

watch(
    () => [props.focusColumn, columns.value.length, props.tableName] as const,
    ([col, n]) => {
        if (col && n) void applyFocusColumn(col);
    },
    { immediate: true },
);

onMounted(loadTable);
</script>

<template>
    <div
        class="flex h-full min-h-0 w-full flex-col overflow-hidden bg-white text-xs"
    >
        <!-- JetBrains DataGrip 风格表头工具栏 -->
        <div
            class="flex h-9 flex-shrink-0 items-center gap-0.5 border-b border-slate-200 bg-slate-100/60 px-2"
        >
            <!-- 刷新 -->
            <div class="flex items-center">
                <button
                    type="button"
                    :class="tbCls"
                    title="刷新"
                    @click="sqlText = ''; loadTable()"
                >
                    <RefreshCw
                        class="h-3.5 w-3.5"
                        :class="{ 'animate-spin': loading }"
                    />
                    <span>刷新</span>
                </button>
                <button
                    type="button"
                    class="btn-touch flex h-7 w-5 items-center justify-center rounded-md text-zx-text-muted hover:bg-white"
                    title="刷新选项"
                    @click="openRefreshMenu"
                >
                    <ChevronDown class="h-3 w-3" />
                </button>
            </div>

            <span class="mx-0.5 h-4 w-px bg-slate-300/80" />

            <!-- 保存 / 取消 -->
            <div class="flex items-center">
                <button
                    type="button"
                    class="btn-touch flex h-7 items-center gap-1 rounded-md px-2 text-xs transition-colors"
                    :class="
                        dirtyTotal > 0 && !saving
                            ? 'text-zx-primary hover:bg-zx-primary-soft'
                            : 'text-zx-text-subtle opacity-40'
                    "
                    :disabled="dirtyTotal <= 0 || saving"
                    title="保存全部更改"
                    @click="saveAll"
                >
                    <CheckCircle2 class="h-3.5 w-3.5" />
                    <span>{{ saving ? "保存中…" : "保存" }}</span>
                </button>
                <button
                    type="button"
                    class="btn-touch flex h-7 w-5 items-center justify-center rounded-md text-zx-text-muted hover:bg-white disabled:opacity-35"
                    :disabled="dirtyTotal <= 0"
                    title="保存选项"
                    @click="openSaveMenu"
                >
                    <ChevronDown class="h-3 w-3" />
                </button>
            </div>
            <button
                type="button"
                class="btn-touch ml-0.5 flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-xs text-zx-text-muted transition-colors disabled:pointer-events-none disabled:opacity-35"
                :disabled="dirtyTotal <= 0"
                title="取消未保存更改"
                @click="discardAll"
            >
                <X class="h-3.5 w-3.5" />
                <span>取消</span>
            </button>
            <span
                v-if="dirtyTotal > 0"
                class="ml-1 tabular-nums text-[11px] text-amber-600"
            >
                {{ dirtyTotal }}
            </span>

            <span class="mx-0.5 h-4 w-px bg-slate-300/80" />

            <!-- 行操作（图标钮，JetBrains 式） -->
            <button
                type="button"
                :class="tbCls"
                title="插入行"
                @click="startInsert()"
            >
                <Plus class="h-3.5 w-3.5" />
            </button>
            <button
                type="button"
                :class="tbCls"
                :disabled="!lastRowCtx"
                title="克隆当前行"
                @click="cloneSelectedRow"
            >
                <Copy class="h-3.5 w-3.5" />
            </button>
            <button
                type="button"
                class="btn-touch flex h-7 items-center rounded-md px-2 text-xs text-zx-text-muted transition-colors hover:bg-zx-danger-soft hover:text-zx-danger disabled:pointer-events-none disabled:opacity-35"
                :disabled="!lastRowCtx || !pkName"
                title="删除/恢复当前行"
                @click="markDeleteSelected"
            >
                <Trash2 class="h-3.5 w-3.5" />
            </button>

            <span class="mx-0.5 h-4 w-px bg-slate-300/80" />

            <!-- 分页（ZxPagination mini 档） -->
            <ZxPagination
                mini
                :page="page"
                :total-pages="totalPages"
                @update:model-value="handlePageChange"
            />

            <span class="mx-0.5 h-4 w-px bg-slate-300/80" />

            <!-- 导出 -->
            <div class="flex items-center">
                <button
                    type="button"
                    :class="tbCls"
                    title="导出当前页 CSV"
                    @click="exportGridCsv"
                >
                    <Download class="h-3.5 w-3.5" />
                    <span class="hidden md:inline">导出数据</span>
                </button>
                <button
                    type="button"
                    class="btn-touch flex h-7 w-5 items-center justify-center rounded-md text-zx-text-muted hover:bg-white"
                    title="导出选项"
                    @click="openExportMenu"
                >
                    <ChevronDown class="h-3 w-3" />
                </button>
            </div>

            <span class="mx-0.5 h-4 w-px bg-slate-300/80" />

            <!-- 打开 SQL 控制台 -->
            <button
                type="button"
                :class="tbCls"
                title="打开 SQL 控制台"
                @click="emit('openSqlConsole')"
            >
                <SquareTerminal class="h-3.5 w-3.5" />
                <span class="hidden md:inline">SQL</span>
            </button>

            <span class="mx-0.5 h-4 w-px bg-slate-300/80" />

            <!-- 设置 / 每页行数（对齐 JetBrains 右侧数字框） -->
            <button
                type="button"
                :class="tbCls"
                title="页面行数设置"
                @click="
                    changePageSize(pageSize === 200 ? 50 : pageSize === 50 ? 100 : 200)
                "
            >
                <Settings class="h-3.5 w-3.5" />
            </button>
            <input
                :value="pageSize"
                class="h-6 w-12 rounded-md border border-slate-200 bg-white text-center font-mono text-[11px] tabular-nums text-zx-text outline-none focus:border-zx-primary"
                title="每页行数"
                @change="
                    changePageSize(
                        Math.max(
                            1,
                            Number(
                                ($event.target as HTMLInputElement).value,
                            ) || 50,
                        ),
                    )
                "
            />
            <span class="ml-1 tabular-nums text-[11px] text-zx-text-subtle">
                {{ displayRows.length }}
            </span>
        </div>

        <!-- 表头上方：筛选（点按钮从数据库查询） -->
        <div
            class="flex h-8 flex-shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-2"
        >
            <span class="text-[11px] text-zx-text-subtle">筛选</span>
            <select
                v-model="filterColName"
                class="h-6 max-w-36 cursor-pointer rounded-md border border-slate-200 bg-white px-1 text-[11px] text-zx-text outline-none focus:border-zx-primary"
                title="筛选列"
            >
                <option
                    v-for="opt in filterColOptions"
                    :key="opt.value"
                    :value="opt.value"
                >
                    {{ opt.label }}
                </option>
            </select>
            <div
                class="flex h-6 min-w-0 flex-1 items-center gap-1 rounded-md border border-slate-200 bg-slate-50/60 px-2 focus-within:border-zx-primary focus-within:bg-white"
            >
                <Filter class="h-3 w-3 shrink-0 text-zx-text-subtle" />
                <input
                    ref="filterInputEl"
                    v-model="filterKeyword"
                    type="text"
                    class="min-w-0 flex-1 bg-transparent text-[11px] outline-none placeholder:text-zx-text-subtle"
                    placeholder="关键字…（回车或点筛选，从数据库查询）"
                    @keydown.enter.prevent="applyDbFilter"
                />
            </div>
            <button
                type="button"
                class="btn-touch flex h-6 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[11px] text-zx-text transition-colors hover:border-zx-primary hover:text-zx-primary disabled:opacity-40"
                :disabled="sqlRunning || loading"
                title="从数据库按条件查询"
                @click="applyDbFilter"
            >
                <Filter class="h-3 w-3" />
                <span>筛选</span>
            </button>
            <button
                v-if="
                    filterKeyword ||
                    filterColName !== '__all__' ||
                    appliedFilter
                "
                type="button"
                class="btn-touch flex h-6 items-center rounded-md px-2 text-[11px] text-zx-text-muted hover:bg-slate-100"
                title="清除筛选并重新加载整表"
                @click="clearFilters"
            >
                清除
            </button>
            <span
                v-if="appliedFilter"
                class="truncate text-[11px] text-zx-primary"
            >
                已筛选
            </span>
        </div>

        <!-- 网格 -->
        <div
            ref="gridEl"
            class="min-h-0 flex-1 overflow-auto"
            style="overflow-anchor: none"
            @click="showSortPop = false"
        >
            <div
                v-if="loading && !rows.length"
                class="flex h-full items-center justify-center"
            >
                <div
                    class="h-6 w-6 animate-spin rounded-full border-2 border-zx-primary border-b-transparent"
                />
            </div>
            <div
                v-else-if="error"
                class="flex h-full items-center justify-center p-4 text-xs text-zx-danger"
            >
                {{ error }}
            </div>
            <table v-else class="w-max min-w-full border-collapse">
                <thead class="sticky top-0 z-10 bg-slate-50/90">
                    <tr>
                        <th
                            class="w-7 border-b border-r border-slate-300 px-1.5 py-0 text-left"
                        ></th>
                        <th
                            v-for="col in columns"
                            :key="col.name"
                            :data-col="col.name"
                            class="relative border-b border-r border-slate-300 px-2 py-0 text-left"
                            style="height: 32px"
                            :class="
                                selectedHeader === col.name
                                    ? 'bg-zx-primary-tint/50 shadow-[inset_0_0_0_1px_var(--zx-color-primary)]'
                                    : ''
                            "
                            @click.stop="selectHeader(col.name)"
                        >
                            <div class="flex h-full items-center gap-2">
                                <KeyRound
                                    v-if="col.primary_key"
                                    class="h-3 w-3 flex-shrink-0 text-zx-primary"
                                />
                                <span
                                    class="flex-shrink-0 rounded px-1 font-mono text-[10px]"
                                    :class="colTypeBadge(col).cls"
                                    :title="typeLabel(col.type) || 'unknown'"
                                    >{{ colTypeBadge(col).text }}</span
                                >
                                <span
                                    class="font-semibold text-zx-text-strong"
                                    :title="col.name"
                                    >{{ col.name }}</span
                                >
                                <span
                                    v-if="sortCol === col.name"
                                    class="flex-shrink-0 text-zx-primary"
                                >
                                    {{ sortDir === "asc" ? "↑" : "↓" }}
                                </span>
                                <ZxButton
                                    variant="ghost"
                                    circle
                                    size="sm"
                                    class="!h-6 !w-6 ml-auto"
                                    title="列菜单（排序）"
                                    @click.stop="showColumnMenu($event, col)"
                                >
                                    <ChevronDown class="h-3.5 w-3.5" />
                                </ZxButton>
                            </div>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    <tr
                        v-if="!inserting && !pendingInserts.length && !rows.length"
                    >
                        <td
                            :colspan="columns.length + 1"
                            class="px-3 py-8 text-center text-xs text-zx-text-subtle"
                        >
                            无数据
                        </td>
                    </tr>

                    <tr
                        v-for="(g, gi) in displayRows"
                        :key="
                            g.kind === 'data'
                                ? rowKey(g.row, g.index)
                                : g.insert.id
                        "
                        :class="
                            g.kind === 'pending'
                                ? 'bg-emerald-50'
                                : pendingDeletes.includes(rowKey(g.row, g.index))
                                  ? 'bg-red-50'
                                  : isDirty(rowKey(g.row, g.index))
                                    ? 'bg-amber-50/80'
                                    : 'hover:bg-slate-50'
                        "
                        @contextmenu.prevent.stop="
                            g.kind === 'data'
                                ? showRowMenu($event, g.row, g.index)
                                : showPendingMenu($event, g.insert)
                        "
                    >
                        <td
                            class="cursor-pointer border-b border-r border-slate-300 px-1.5 py-0 tabular-nums text-[11px] text-zx-text-subtle transition-colors hover:bg-zx-primary-soft/50"
                            :class="[
                                g.kind === 'pending'
                                    ? 'border-l-2 border-l-emerald-500'
                                    : g.kind === 'data' &&
                                        pendingDeletes.includes(
                                            rowKey(g.row, g.index),
                                        )
                                      ? 'border-l-2 border-l-red-400/80'
                                      : '',
                                g.kind === 'data' &&
                                selectedRowKey === rowKey(g.row, g.index)
                                    ? 'bg-zx-primary-tint/60 font-medium text-zx-primary'
                                    : g.kind === 'pending' &&
                                        selectedRowKey ===
                                            `pend:${g.insert.id}`
                                      ? 'bg-zx-primary-tint/60 font-medium text-zx-primary'
                                      : '',
                            ]"
                            title="点击选中整行"
                            @click.stop="
                                g.kind === 'data'
                                    ? selectDataRow(rowKey(g.row, g.index))
                                    : selectPendingRow(g.insert.id)
                            "
                        >
                            {{ gi + 1 }}
                        </td>
                        <template v-if="g.kind === 'data'">
                            <td
                                v-for="col in columns"
                                :key="col.name"
                                class="relative border-b border-r border-slate-300 px-0.5 py-0"
                                style="height: 28px"
                                :class="[
                                    isCellEditing(rowKey(g.row, g.index), col.name) ||
                                    (dtEdit &&
                                        dtEdit.rowKey === rowKey(g.row, g.index) &&
                                        dtEdit.col === col.name)
                                        ? 'bg-zx-primary-tint/60 shadow-[inset_0_0_0_1px_var(--zx-color-dirty)]'
                                        : isCellSelected(rowKey(g.row, g.index), col.name)
                                          ? 'bg-zx-primary-tint/30 shadow-[inset_0_0_0_1px_var(--zx-color-primary)]'
                                          : drafts[rowKey(g.row, g.index)] &&
                                              col.name in
                                                  (drafts[rowKey(g.row, g.index)] || {})
                                            ? 'bg-amber-50/60'
                                            : '',
                                ]"
                                @click="onCellClick(g.row, g.index, col, $event)"
                                @contextmenu.prevent.stop="
                                    showRowMenu($event, g.row, g.index, col.name)
                                "
                                @mouseenter="
                                    colEditKind(col) === 'datetime' &&
                                        showDtHover($event, g.row, g.index, col)
                                "
                                @mouseleave="
                                    colEditKind(col) === 'datetime' &&
                                        (dtHover = null)
                                "
                            >
                                <div class="relative h-full w-full min-w-28">
                                    <div
                                        class="absolute inset-0 flex items-center truncate px-1.5 font-mono"
                                        :class="[
                                            isInlineEditing(
                                                rowKey(g.row, g.index),
                                                col.name,
                                            )
                                                ? 'invisible'
                                                : '',
                                            pendingDeletes.includes(
                                                rowKey(g.row, g.index),
                                            )
                                                ? 'line-through opacity-70'
                                                : '',
                                        ]"
                                        :title="
                                            isCellSelected(
                                                rowKey(g.row, g.index),
                                                col.name,
                                            ) || isCellEditing(rowKey(g.row, g.index), col.name)
                                                ? undefined
                                                : displayCellText(g.row, g.index, col)
                                        "
                                    >
                                        {{ displayCellText(g.row, g.index, col) }}
                                    </div>

                                    <input
                                        v-if="
                                            isInlineEditing(
                                                rowKey(g.row, g.index),
                                                col.name,
                                            )
                                        "
                                        ref="numberInputEl"
                                        v-model="inlineDraft"
                                        type="text"
                                        class="absolute inset-0 h-full w-full border-0 bg-transparent px-1.5 font-mono text-xs outline-none"
                                        @click.stop
                                        @dblclick.stop
                                        @keydown.enter.prevent="
                                            commitInline(g.row, g.index, col.name)
                                        "
                                        @keydown.esc.prevent="cancelInline"
                                        @blur="commitInline(g.row, g.index, col.name)"
                                    />
                                </div>
                            </td>
                        </template>
                        <template v-else>
                            <td
                                v-for="col in columns"
                                :key="col.name"
                                class="relative cursor-pointer border-b border-r border-slate-300 px-0.5 py-0"
                                style="height: 28px"
                                :class="
                                    isPendingCellSelected(g.insert.id, col.name)
                                        ? 'bg-zx-primary-tint/30 shadow-[inset_0_0_0_1px_var(--zx-color-primary)]'
                                        : 'bg-transparent'
                                "
                                @click.stop="clickPendingCell(g.insert, col)"
                                @dblclick.stop="
                                    startEditPending(g.insert, col)
                                "
                                @contextmenu.prevent.stop="
                                    showPendingMenu($event, g.insert, col)
                                "
                            >
                                <div class="relative h-full w-full min-w-28">
                                    <input
                                        v-if="
                                            editingPending?.id ===
                                                g.insert.id &&
                                            editingPending?.col === col.name
                                        "
                                        ref="pendingInputEl"
                                        v-model="pendingDraft"
                                        class="absolute inset-0 h-full w-full border-0 bg-transparent px-1.5 font-mono text-xs outline-none"
                                        @click.stop
                                        @keydown.enter.prevent="
                                            commitPendingEdit(g.insert, col)
                                        "
                                        @keydown.esc.prevent="cancelPendingEdit"
                                        @blur="
                                            commitPendingEdit(g.insert, col)
                                        "
                                    />
                                    <div
                                        v-else
                                        class="absolute inset-0 flex items-center truncate px-1.5 font-mono text-zx-text-muted"
                                    >
                                        {{ pendingCellText(g.insert, col) }}
                                    </div>
                                </div>
                            </td>
                        </template>
                    </tr>

                    <!-- 底部新建输入行 -->
                    <tr v-if="inserting" class="bg-zx-primary-tint/20">
                        <td
                            class="border-b border-r border-slate-300 px-1.5 py-0 text-[10px] text-zx-primary"
                        >
                            +
                        </td>
                        <td
                            v-for="col in columns"
                            :key="col.name"
                            class="border-b border-r border-slate-300 px-0.5 py-0"
                            style="height: 28px"
                        >
                            <input
                                v-model="newRow[col.name]"
                                type="text"
                                class="w-full min-w-24 rounded-sm border border-slate-200 bg-white px-1.5 py-0 font-mono outline-none focus:border-zx-primary"
                                :placeholder="col.primary_key ? '可填 id' : ''"
                                @keydown.enter.prevent="queueInsert"
                                @keydown.esc.prevent="cancelInsert"
                            />
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- 编辑弹层 -->
        <Teleport to="body">
            <!-- 布尔下拉：置顶，模仿 Supabase TRUE/FALSE/NULL -->
            <div
                v-if="boolPop"
                class="fixed z-[100] w-36 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
                :style="{
                    left: `${boolPop.x}px`,
                    top: `${boolPop.y}px`,
                }"
                @click.stop
            >
                <ul class="py-1 text-sm">
                    <li
                        v-for="opt in [
                            { v: 'true', label: 'TRUE' },
                            { v: 'false', label: 'FALSE' },
                            { v: '', label: 'NULL' },
                        ]"
                        :key="opt.v"
                    >
                        <button
                            type="button"
                            class="btn-touch flex w-full items-center gap-2 px-3 py-2 text-left font-mono hover:bg-slate-50"
                            :class="
                                boolDraft === opt.v
                                    ? 'bg-zx-primary-tint/50 text-zx-primary'
                                    : 'text-zx-text'
                            "
                            @click="pickBool(opt.v)"
                        >
                            <span class="w-4 text-center">{{
                                boolDraft === opt.v ? "✓" : ""
                            }}</span>
                            {{ opt.label }}
                        </button>
                    </li>
                </ul>
            </div>

            <!-- 文本 / JSON：Supabase 结构浮窗（独立组件，跟主题） -->
            <DbCellEditor
                v-if="
                    editPopover &&
                    ['text', 'json'].includes(colEditKind(popoverColMeta))
                "
                :x="editPopover.x"
                :y="editPopover.y"
                :col-name="editPopover.col"
                :col-type="typeLabel(popoverColMeta.type || '')"
                :model-value="editPopover.draftValue"
                :language="editPopover.language"
                @update:model-value="editPopover.draftValue = $event"
                @save="commitPopover"
                @cancel="closePopover"
            />

            <!-- 时间：Supabase 风格编辑浮层（跟主题，中文） -->
            <div
                v-if="dtEdit"
                ref="dtPanelEl"
                class="fixed z-[100] w-80 overflow-hidden rounded-xl border border-zx-border bg-white shadow-[var(--shadow-zx-popover)]"
                :style="{
                    left: `${dtEdit.x}px`,
                    top: `${dtEdit.y}px`,
                }"
                @click.stop
                @keydown="onDtKeydown"
                @focusout="onDtFocusOut"
            >
                <div class="px-3 pt-3">
                    <!-- [ 可编辑输入框 …… 行末时钟 ] 时钟才打开面板 -->
                    <div
                        class="flex items-center rounded-md border border-slate-200 bg-transparent transition-colors focus-within:border-zx-primary"
                    >
                        <input
                            ref="dtInputEl"
                            v-model="dtEdit.draftValue"
                            class="h-8 min-w-0 flex-1 border-0 bg-transparent px-2 font-mono text-xs text-zx-text outline-none"
                            placeholder="ISO 时间 / 时间戳"
                        />
                        <button
                            ref="dtClockRef"
                            type="button"
                            class="btn-touch mr-0.5 flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-zx-text-muted hover:bg-slate-100/80 hover:text-zx-primary"
                            title="打开时间选择器"
                            @click.stop="openDtPicker"
                        >
                            <Clock class="h-4 w-4" />
                        </button>
                    </div>
                    <MiniDateTimePicker
                        ref="dtPickerRef"
                        v-model="dtEdit.draftValue"
                        type="datetime"
                        variant="panel"
                        :value-format="dtEdit.valueFormat || 'postgres'"
                        :anchor="dtClockRef"
                    />
                </div>

                <div class="px-3 pt-2 pb-3">
                    <div class="mb-0.5 text-[11px] text-zx-text-subtle">
                        格式化值：
                    </div>
                    <div
                        class="cursor-default font-mono text-xs break-all text-zx-text"
                        @mouseenter="showDtHoverFromDraft"
                        @mouseleave="hideDtHoverFromDraft"
                    >
                        {{ fmtPreview(dtEdit.draftValue) }}
                    </div>
                </div>
            </div>

            <!-- 时间悬停：时区 / 相对时间 / 时间戳（单元格与格式化值共用） -->
            <div
                v-if="dtHover"
                class="db-dt-hover pointer-events-none fixed z-[110] w-60 rounded-lg border border-zx-border bg-white px-3 py-2 shadow-[var(--shadow-zx-popover)]"
                :style="{
                    left: `${dtHover.x}px`,
                    top: `${dtHover.y}px`,
                }"
            >
                <div
                    v-for="rowInfo in [
                        { label: 'UTC', value: dtHover.utc },
                        {
                            label: dtHover.zone,
                            value: dtHover.local,
                        },
                        { label: '时间戳', value: dtHover.timestamp },
                        { label: '时间差', value: dtHover.relative },
                    ]"
                    :key="rowInfo.label"
                    class="flex items-start justify-between gap-3 py-0.5 text-[11px]"
                >
                    <span class="flex-shrink-0 text-zx-text-subtle">{{
                        rowInfo.label
                    }}</span>
                    <span class="truncate text-right font-mono text-zx-text">{{
                        rowInfo.value
                    }}</span>
                </div>
            </div>
        </Teleport>

        <!-- 底栏：仅状态（文件编辑器外层还有全局状态栏，此处保留表内脏数据提示） -->
        <div
            class="flex h-7 flex-shrink-0 items-center gap-2 border-t border-slate-200 px-2"
        >
            <span class="tabular-nums text-[11px] text-zx-text-subtle">
                {{ displayRows.length }} / {{ total }} 行
            </span>
            <span
                v-if="appliedFilter"
                class="rounded-md bg-zx-primary-tint px-2 py-0.5 text-[11px] text-zx-primary"
            >
                已筛选 · {{ appliedFilter.q }}
            </span>
            <span
                v-if="sortCol"
                class="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-zx-text-muted"
            >
                {{ sortCol }} {{ sortDir === "asc" ? "↑" : "↓" }}
            </span>
            <span
                v-if="dirtyTotal > 0"
                class="ml-auto tabular-nums text-[11px] text-amber-600"
            >
                {{ dirtyTotal }} 未保存
            </span>
        </div>
    </div>
</template>
