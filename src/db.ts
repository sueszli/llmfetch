import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { log } from "./utils.js";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(dirname, "..", "scrapers.db");

export type JobRow = {
    id: number;
    [key: string]: string | number; // dynamic string fields
};

const sqlite: Database.Database = new Database(dbPath);
sqlite.pragma("journal_mode = WAL"); // fast table creation, https://sqlite.org/wal.html
sqlite.exec(`CREATE TABLE IF NOT EXISTS _metadata (key TEXT PRIMARY KEY, value INTEGER NOT NULL)`); // table counter

export function closeDB() {
    sqlite.close();
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
        const stmt = sqlite.prepare(`INSERT INTO _metadata (key, value) VALUES (?, 0) ON CONFLICT(key) DO UPDATE SET value = value + 1 RETURNING value`);
        const result = stmt.get(counterKey) as { value: number };
        return result.value;
    };
    log("generating table", JSON.stringify(fields));

    const id = getAndIncrementCounter();
    const timestamp = formatTimestamp();
    const tableName = `job_${id}_${timestamp}`;

    const fieldColumns = fields.map((f) => `${sanitize(f, { isColumn: true })} TEXT`).join(", ");
    sqlite.exec(`
        CREATE TABLE ${tableName} (
            id INTEGER PRIMARY KEY AUTOINCREMENT
            ${fields.length > 0 ? "," : ""} ${fieldColumns}
        )
    `);

    return id;
}

function getTableName(id: number): string | null {
    const pattern = `job_${id}_%`;
    const table = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE ?").get(pattern) as any;
    return table ? table.name : null;
}

export type JobInfo = {
    id: number;
    createdAt: Date;
    fields: Record<string, number>; // field name -> count of elements
};

export function listJobs(): JobInfo[] {
    const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'job_%'").all() as any[];

    return tables
        .map((t) => {
            const match = t.name.match(/^job_(\d+)_/);
            if (!match) return null;
            const id = parseInt(match[1], 10);
            if (isNaN(id)) return null;

            const tableName = t.name;

            // Extract creation datetime from id (timestamp in milliseconds)
            const createdAt = new Date(id);

            // Get column information
            const columns = sqlite.prepare(`PRAGMA table_info(${tableName})`).all() as any[];
            const fieldNames = columns.filter((col: any) => col.name !== "id").map((col: any) => col.name);

            // Count non-null values for each field
            const fields: Record<string, number> = {};
            for (const fieldName of fieldNames) {
                const result = sqlite.prepare(`SELECT COUNT(*) as count FROM ${tableName} WHERE ${fieldName} IS NOT NULL AND ${fieldName} != ''`).get() as any;
                const originalName = fieldName.replace(/^f_/, "");
                fields[originalName] = result.count;
            }

            return { id, createdAt, fields };
        })
        .filter((job): job is JobInfo => job !== null)
        .sort((a, b) => b.id - a.id);
}

export function deleteJob(id: number): boolean {
    const tableName = getTableName(id);
    if (!tableName) return false;

    sqlite.exec(`DROP TABLE ${tableName}`);
    return true;
}

export function insertJobData(jobId: number, data: Record<string, string>): number {
    const tableName = getTableName(jobId);
    if (!tableName) throw new Error(`Job ${jobId} not found`);

    const columns = Object.keys(data).map((f) => sanitize(f, { isColumn: true }));
    const values = Object.values(data);
    const placeholders = columns.map(() => "?").join(", ");

    const stmt = sqlite.prepare(`
        INSERT INTO ${tableName} (${columns.join(", ")})
        VALUES (${placeholders})
    `);
    const result = stmt.run(...values);
    return result.lastInsertRowid as number;
}

export function getJobData(jobId: number): JobRow[] {
    const tableName = getTableName(jobId);
    if (!tableName) return [];

    const stmt = sqlite.prepare(`SELECT * FROM ${tableName}`);
    return stmt.all() as JobRow[];
}

export function deleteJobData(jobId: number, dataId: number): boolean {
    const tableName = getTableName(jobId);
    if (!tableName) return false;

    const stmt = sqlite.prepare(`DELETE FROM ${tableName} WHERE id = ?`);
    const result = stmt.run(dataId);
    return result.changes > 0;
}
