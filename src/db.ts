import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(dirname, "..", "scrapers.db");

export type Job = {
    id: number;
    url: string;
    fields: string[];
    createdAt: number;
};

export type JobRow = {
    id: number;
    [key: string]: string | number; // dynamic string fields
};

let sqlite: Database.Database | null = null;
let db: ReturnType<typeof drizzle> | null = null;
let idCounter = 0;

export function getSQLite(): ReturnType<typeof Database> {
    if (!sqlite) {
        sqlite = new Database(dbPath);
        sqlite.pragma("journal_mode = WAL");
        db = drizzle(sqlite);
    }
    return sqlite;
}

export function closeDB() {
    if (!sqlite) {
        return;
    }
    sqlite.close();
    sqlite = null;
    db = null;
    idCounter = 0;
}

function sanitize(name: string, options?: { prefix?: string; isColumn?: boolean }): string {
    let sanitized = name.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();
    // Column names cannot start with a digit in SQL, prepend 'f_' if needed
    if (options?.isColumn && /^\d/.test(sanitized)) {
        sanitized = "f_" + sanitized;
    }
    return options?.prefix ? `${options.prefix}${sanitized}` : sanitized;
}

export function createJob(url: string, fields: string[]): Job {
    const now = Date.now();
    const id = now + idCounter++;
    const tableName = sanitize(`${id}`, { prefix: "job_" });

    // Create table with user-defined field columns as TEXT
    const fieldColumns = fields.map((f) => `${sanitize(f, { isColumn: true })} TEXT`).join(", ");
    getSQLite().exec(`
        CREATE TABLE ${tableName} (
            id INTEGER PRIMARY KEY AUTOINCREMENT
            ${fields.length > 0 ? "," : ""} ${fieldColumns}
        )
    `);

    return { id, url, fields, createdAt: id };
}

export function getJob(id: number): Job | null {
    const tableName = sanitize(`${id}`, { prefix: "job_" });

    // Check if table exists
    const table = getSQLite().prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(tableName) as any;
    if (!table) return null;

    // Get table schema to extract fields
    const columns = getSQLite().prepare(`PRAGMA table_info(${tableName})`).all() as any[];
    const fields = columns
        .filter((col) => col.name !== "id")
        .map((col) => {
            // Reverse sanitization for display - this is a best effort
            // For now, just return the sanitized name
            return col.name.replace(/^f_/, "");
        });

    // Since we don't have metadata, we can't recover the original URL or field names perfectly
    // This is a limitation of removing the metadata table
    return {
        id,
        url: "", // URL not stored anymore
        fields,
        createdAt: id,
    };
}

export function listJobs(): Job[] {
    const tables = getSQLite()
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'job_%'")
        .all() as any[];

    return tables
        .map((t) => {
            const idStr = t.name.replace("job_", "");
            const id = parseInt(idStr, 10);
            return isNaN(id) ? null : getJob(id);
        })
        .filter((j): j is Job => j !== null)
        .sort((a, b) => b.createdAt - a.createdAt);
}

export function deleteJob(id: number): boolean {
    const tableName = sanitize(`${id}`, { prefix: "job_" });

    const table = getSQLite().prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(tableName) as any;
    if (!table) return false;

    getSQLite().exec(`DROP TABLE ${tableName}`);
    return true;
}

export function insertJobData(jobId: number, data: Record<string, string>): number {
    const job = getJob(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);

    const tableName = sanitize(`${jobId}`, { prefix: "job_" });

    const columns = Object.keys(data).map((f) => sanitize(f, { isColumn: true }));
    const values = Object.values(data);
    const placeholders = columns.map(() => "?").join(", ");

    const stmt = getSQLite().prepare(`
        INSERT INTO ${tableName} (${columns.join(", ")})
        VALUES (${placeholders})
    `);
    const result = stmt.run(...values);
    return result.lastInsertRowid as number;
}

export function getJobData(jobId: number): JobRow[] {
    const job = getJob(jobId);
    if (!job) return [];

    const tableName = sanitize(`${jobId}`, { prefix: "job_" });
    const stmt = getSQLite().prepare(`SELECT * FROM ${tableName}`);
    return stmt.all() as JobRow[];
}

export function deleteJobData(jobId: number, dataId: number): boolean {
    const tableName = sanitize(`${jobId}`, { prefix: "job_" });
    const stmt = getSQLite().prepare(`DELETE FROM ${tableName} WHERE id = ?`);
    const result = stmt.run(dataId);
    return result.changes > 0;
}
