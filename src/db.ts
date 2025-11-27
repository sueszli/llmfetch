import { drizzle } from "drizzle-orm/better-sqlite3";
import { sql } from "drizzle-orm";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(dirname, "..", "scrapers.db");

export type Scraper = {
    id: number;
    url: string;
    fields: string[];
    createdAt: number;
};

export type ScraperRow = {
    id: number;
    [key: string]: any; // dynamic fields, based on user-defined schema
};

let sqlite: Database.Database | null = null;
let db: ReturnType<typeof drizzle> | null = null;
let idCounter = 0;

export function getSQLite(): ReturnType<typeof Database> {
    if (!sqlite) {
        sqlite = new Database(dbPath);
        sqlite.pragma("journal_mode = WAL");
        db = drizzle(sqlite);
        initMetadataTable();
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

function initMetadataTable() {
    if (!sqlite) return;
    // Create metadata table if it doesn't exist
    sqlite.exec(`
        CREATE TABLE IF NOT EXISTS scraper_metadata (
            id INTEGER PRIMARY KEY,
            url TEXT NOT NULL,
            fields TEXT NOT NULL,
            created_at INTEGER NOT NULL
        )
    `);
}

function sanitize(name: string, options?: { prefix?: string; isColumn?: boolean }): string {
    let sanitized = name.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();
    // Column names cannot start with a digit in SQL, prepend 'f_' if needed
    // But don't do this for table names since we control the prefix
    if (options?.isColumn && /^\d/.test(sanitized)) {
        sanitized = "f_" + sanitized;
    }
    return options?.prefix ? `${options.prefix}${sanitized}` : sanitized;
}

export function createScraper(url: string, fields: string[]): Scraper {
    const now = Date.now();
    const id = now + idCounter++; // Use timestamp + counter for unique ID
    const tableName = sanitize(`${id}`, { prefix: "scraper_" });

    // Create table with only dynamic field columns (no url, status, created_at per row)
    const fieldColumns = fields.map((f) => `${sanitize(f, { isColumn: true })} TEXT`).join(", ");
    getSQLite().exec(`
        CREATE TABLE ${tableName} (
            id INTEGER PRIMARY KEY AUTOINCREMENT
            ${fields.length > 0 ? "," : ""} ${fieldColumns}
        )
    `);

    // Store metadata in the metadata table
    getSQLite()
        .prepare("INSERT INTO scraper_metadata (id, url, fields, created_at) VALUES (?, ?, ?, ?)")
        .run(id, url, JSON.stringify(fields), id);

    return { id, url, fields, createdAt: id };
}

export function getScraper(id: number): Scraper | null {
    const tableName = sanitize(`${id}`, { prefix: "scraper_" });

    // Check if table exists
    const tables = getSQLite().prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(tableName) as any;

    if (!tables) return null;

    // Get metadata from metadata table
    const metadata = getSQLite().prepare("SELECT url, fields, created_at FROM scraper_metadata WHERE id = ?").get(id) as any;

    if (!metadata) {
        return null;
    }

    return {
        id,
        url: metadata.url,
        fields: JSON.parse(metadata.fields),
        createdAt: metadata.created_at,
    };
}

export function listScrapers(): Scraper[] {
    const tables = getSQLite()
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'scraper_%' AND name != 'scraper_metadata'")
        .all() as any[];

    return tables
        .map((t) => {
            const idStr = t.name.replace("scraper_", "");
            const id = parseInt(idStr, 10);
            return isNaN(id) ? null : getScraper(id);
        })
        .filter((s): s is Scraper => s !== null)
        .sort((a, b) => b.createdAt - a.createdAt);
}

export function deleteScraper(id: number): boolean {
    const tableName = sanitize(`${id}`, { prefix: "scraper_" });

    const tables = getSQLite().prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(tableName) as any;

    if (!tables) return false;

    getSQLite().exec(`DROP TABLE ${tableName}`);
    getSQLite().prepare("DELETE FROM scraper_metadata WHERE id = ?").run(id);
    return true;
}

export function insertScraperData(scraperId: number, data: Record<string, string[] | null>): number {
    const scraper = getScraper(scraperId);
    if (!scraper) throw new Error(`Scraper ${scraperId} not found`);

    const tableName = sanitize(`${scraperId}`, { prefix: "scraper_" });

    const columns = scraper.fields.map((f) => sanitize(f, { isColumn: true }));
    const values = scraper.fields.map((f) => JSON.stringify(data[f] || null));
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

    const tableName = sanitize(`${scraperId}`, { prefix: "scraper_" });
    const stmt = getSQLite().prepare(`SELECT * FROM ${tableName}`);
    const rows = stmt.all() as any[];

    return rows.map((row) => {
        const result: ScraperRow = {
            id: row.id,
        };
        scraper.fields.forEach((field) => {
            const colName = sanitize(field, { isColumn: true });
            result[field] = row[colName] ? JSON.parse(row[colName]) : null;
        });
        return result;
    });
}

export function deleteScraperData(scraperId: number, dataId: number): boolean {
    const tableName = sanitize(`${scraperId}`, { prefix: "scraper_" });
    const stmt = getSQLite().prepare(`DELETE FROM ${tableName} WHERE id = ?`);
    const result = stmt.run(dataId);
    return result.changes > 0;
}
