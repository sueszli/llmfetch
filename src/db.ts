import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import { log } from "./utils.js";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultDbPath = path.join(dirname, "..", "scrapers.db");

export type JobRow = {
    id: number;
    [key: string]: string | number; // dynamic string fields
};

let sqlite: Database.Database | null = null;

export function initDB(dbPath?: string) {
    // for custom path (like tests)
    if (sqlite) {
        sqlite.close();
    }
    sqlite = new Database(dbPath || defaultDbPath);
    sqlite.pragma("journal_mode = WAL");
    sqlite.exec("CREATE TABLE IF NOT EXISTS _metadata (key TEXT PRIMARY KEY, value INTEGER NOT NULL)");
}

function getDB(): Database.Database {
    if (!sqlite) {
        initDB();
    }
    if (!sqlite) {
        throw new Error("failed to init db");
    }
    return sqlite;
}

export function closeDB() {
    if (sqlite) {
        sqlite.close();
        sqlite = null;
    }
}

function sanitize(name: string, options?: { prefix?: string; isColumn?: boolean }): string {
    let sanitized = name.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();
    // column names cannot start with a digit in sql, prepend 'f_' if needed
    if (options?.isColumn && /^\d/.test(sanitized)) {
        sanitized = "f_" + sanitized;
    }
    return options?.prefix ? `${options.prefix}${sanitized}` : sanitized;
}

export function createJob(fields: string[]): number {
    const formatTimestamp = (): string => {
        const date = new Date();
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, "0");
        const dd = String(date.getDate()).padStart(2, "0");
        const hh = String(date.getHours()).padStart(2, "0");
        const min = String(date.getMinutes()).padStart(2, "0");
        const ss = String(date.getSeconds()).padStart(2, "0");
        return `${yyyy}_${mm}_${dd}_${hh}_${min}_${ss}`;
    };

    const getAndIncrementCounter = (): number => {
        const counterKey = "job_counter";
        const stmt = getDB().prepare("INSERT INTO _metadata (key, value) VALUES (?, 0) ON CONFLICT(key) DO UPDATE SET value = value + 1 RETURNING value");
        const result = stmt.get(counterKey) as { value: number };
        return result.value;
    };
    log("generating table", JSON.stringify(fields));

    const id = getAndIncrementCounter();
    const timestamp = formatTimestamp();
    const tableName = `job_${id}_${timestamp}`;

    const fieldColumns = fields.map((f) => `${sanitize(f, { isColumn: true })} TEXT`).join(", ");
    getDB().exec(`
        CREATE TABLE ${tableName} (
            id INTEGER PRIMARY KEY AUTOINCREMENT
            ${fields.length > 0 ? "," : ""} ${fieldColumns}
        )
    `);

    return id;
}

function getTableName(id: number): string | null {
    const pattern = `job_${id}_%`;
    const table = getDB().prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE ?").get(pattern) as any;
    return table ? table.name : null;
}

export function readJob(jobId: number, rowId?: number): JobRow[] {
    const tableName = getTableName(jobId);
    if (!tableName) return [];

    if (rowId !== undefined) {
        const stmt = getDB().prepare(`SELECT * FROM ${tableName} WHERE id = ?`);
        const result = stmt.get(rowId);
        return result ? [result as JobRow] : [];
    }

    const stmt = getDB().prepare(`SELECT * FROM ${tableName}`);
    return stmt.all() as JobRow[];
}

export function updateJob(jobId: number, data: Record<string, string>): number {
    const tableName = getTableName(jobId);
    if (!tableName) throw new Error(`Job ${jobId} not found`);

    const columns = Object.keys(data).map((f) => sanitize(f, { isColumn: true }));
    const values = Object.values(data);
    const placeholders = columns.map(() => "?").join(", ");

    const stmt = getDB().prepare(`
        INSERT INTO ${tableName} (${columns.join(", ")})
        VALUES (${placeholders})
    `);
    const result = stmt.run(...values);
    return result.lastInsertRowid as number;
}

export function deleteJob(id: number): boolean {
    const tableName = getTableName(id);
    if (!tableName) return false;

    getDB().exec(`DROP TABLE ${tableName}`);
    return true;
}

export type JobInfo = {
    id: number;
    createdAt: Date;
    fields: Record<string, number>; // field name -> count of elements
};

export function listJobs(): JobInfo[] {
    const parseTableName = (tableName: string): { id: number; createdAt: Date } | null => {
        const match = tableName.match(/^job_(\d+)_(\d{4})_(\d{2})_(\d{2})_(\d{2})_(\d{2})_(\d{2})$/);
        if (!match) return null;

        const id = parseInt(match[1]!, 10);
        if (isNaN(id)) return null;

        const [, , yyyy, mm, dd, hh, min, ss] = match;
        const createdAt = new Date(parseInt(yyyy!, 10), parseInt(mm!, 10) - 1, parseInt(dd!, 10), parseInt(hh!, 10), parseInt(min!, 10), parseInt(ss!, 10));

        return { id, createdAt };
    };

    const countEntries = (tableName: string): Record<string, number> => {
        const columns = getDB().prepare(`PRAGMA table_info(${tableName})`).all() as any[];
        const fieldNames = columns.filter((col: any) => col.name !== "id").map((col: any) => col.name);

        const fields: Record<string, number> = {};
        for (const fieldName of fieldNames) {
            const result = getDB().prepare(`SELECT COUNT(*) as count FROM ${tableName} WHERE ${fieldName} IS NOT NULL AND ${fieldName} != ''`).get() as any;
            const originalName = fieldName.replace(/^f_/, "");
            fields[originalName] = result.count;
        }

        return fields;
    };

    const tables = getDB().prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'job_%'").all() as any[];
    return tables
        .map((t) => {
            const parsed = parseTableName(t.name);
            if (!parsed) return null;
            const { id, createdAt } = parsed;

            const fields = countEntries(t.name);
            return { id, createdAt, fields };
        })
        .filter((job): job is JobInfo => job !== null)
        .sort((a, b) => b.id - a.id);
}
