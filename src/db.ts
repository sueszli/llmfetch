import { drizzle } from "drizzle-orm/better-sqlite3";
import { sql } from "drizzle-orm";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(dirname, "..", "scrapers.db");

export type ScraperStatus = "pending" | "running" | "completed" | "failed";

export type Scraper = {
    id: number;
    url: string;
    fields: string[];
    status: ScraperStatus;
    createdAt: number;
};

export type ScraperRow = {
    id: number;
    url: string;
    status: ScraperStatus;
    createdAt: number;
    [key: string]: any; // Dynamic fields
};

let sqlite: Database.Database | null = null;
let db: ReturnType<typeof drizzle> | null = null;

export function initDB(customPath?: string) {
    const actualPath = customPath || dbPath;
    sqlite = new Database(actualPath);
    sqlite.pragma("journal_mode = WAL");
    db = drizzle(sqlite);
    return db;
}

export function getDB() {
    if (!db) throw new Error("Database not initialized. Call initDB() first.");
    return db;
}

export function getSQLite(): ReturnType<typeof Database> {
    if (!sqlite) throw new Error("Database not initialized. Call initDB() first.");
    return sqlite;
}

export function closeDB() {
    if (sqlite) {
        sqlite.close();
        sqlite = null;
        db = null;
    }
}

function sanitizeTableName(name: string): string {
    return "scraper_" + name.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();
}

function sanitizeColumnName(name: string): string {
    return name.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();
}

export function createScraper(url: string, fields: string[]): Scraper {
    const now = Date.now();
    const id = now; // Use timestamp as unique ID
    const tableName = sanitizeTableName(`${id}`);

    // Create table with metadata columns + dynamic field columns
    const fieldColumns = fields.map((f) => `${sanitizeColumnName(f)} TEXT`).join(", ");
    getSQLite().exec(`
        CREATE TABLE ${tableName} (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            url TEXT NOT NULL,
            status TEXT NOT NULL,
            created_at INTEGER NOT NULL
            ${fields.length > 0 ? "," : ""} ${fieldColumns}
        )
    `);

    return { id, url, fields, status: "pending", createdAt: now };
}

export function getScraper(id: number): Scraper | null {
    const tableName = sanitizeTableName(`${id}`);

    // Check if table exists
    const tables = getSQLite().prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(tableName) as any;

    if (!tables) return null;

    // Get table info to extract field names
    const columns = getSQLite().prepare(`PRAGMA table_info(${tableName})`).all() as any[];
    const fields = columns.map((col) => col.name).filter((name) => !["id", "url", "status", "created_at"].includes(name));

    // Get the first row to extract metadata (or use defaults if no rows)
    const firstRow = getSQLite().prepare(`SELECT url, status, created_at FROM ${tableName} LIMIT 1`).get() as any;

    if (!firstRow) {
        return { id, url: "", fields, status: "pending", createdAt: id };
    }

    return {
        id,
        url: firstRow.url,
        fields,
        status: firstRow.status as ScraperStatus,
        createdAt: firstRow.created_at,
    };
}

export function listScrapers(): Scraper[] {
    const tables = getSQLite().prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'scraper_%'").all() as any[];

    return tables
        .map((t) => {
            const idStr = t.name.replace("scraper_", "");
            const id = parseInt(idStr, 10);
            return isNaN(id) ? null : getScraper(id);
        })
        .filter((s): s is Scraper => s !== null)
        .sort((a, b) => b.createdAt - a.createdAt);
}

export function updateScraper(id: number, updates: Partial<Pick<Scraper, "status">>): Scraper | null {
    const scraper = getScraper(id);
    if (!scraper) return null;

    const tableName = sanitizeTableName(`${id}`);

    if (updates.status) {
        getSQLite().prepare(`UPDATE ${tableName} SET status = ?`).run(updates.status);
    }

    return getScraper(id);
}

export function deleteScraper(id: number): boolean {
    const tableName = sanitizeTableName(`${id}`);

    const tables = getSQLite().prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(tableName) as any;

    if (!tables) return false;

    getSQLite().exec(`DROP TABLE ${tableName}`);
    return true;
}

export function insertScraperData(scraperId: number, url: string, status: ScraperStatus, data: Record<string, string[] | null>): number {
    const scraper = getScraper(scraperId);
    if (!scraper) throw new Error(`Scraper ${scraperId} not found`);

    const tableName = sanitizeTableName(`${scraperId}`);
    const now = Date.now();

    const columns = ["url", "status", "created_at", ...scraper.fields.map(sanitizeColumnName)];
    const values = [url, status, now, ...scraper.fields.map((f) => JSON.stringify(data[f] || null))];
    const placeholders = columns.map(() => "?").join(", ");

    const stmt = getSQLite().prepare(`
        INSERT INTO ${tableName} (${columns.join(", ")})
        VALUES (${placeholders})
    `);
    const result = stmt.run(...values);
    return result.lastInsertRowid as number;
}

export function getScraperData(scraperId: number): ScraperRow[] {
    const scraper = getScraper(scraperId);
    if (!scraper) return [];

    const tableName = sanitizeTableName(`${scraperId}`);
    const stmt = getSQLite().prepare(`SELECT * FROM ${tableName} ORDER BY created_at DESC`);
    const rows = stmt.all() as any[];

    return rows.map((row) => {
        const result: ScraperRow = {
            id: row.id,
            url: row.url,
            status: row.status,
            createdAt: row.created_at,
        };
        scraper.fields.forEach((field) => {
            const colName = sanitizeColumnName(field);
            result[field] = row[colName] ? JSON.parse(row[colName]) : null;
        });
        return result;
    });
}

export function deleteScraperData(scraperId: number, dataId: number): boolean {
    const tableName = sanitizeTableName(`${scraperId}`);
    const stmt = getSQLite().prepare(`DELETE FROM ${tableName} WHERE id = ?`);
    const result = stmt.run(dataId);
    return result.changes > 0;
}
