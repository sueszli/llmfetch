import { test } from "node:test";
import assert from "node:assert";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
    createScraper,
    getScraper,
    listScrapers,
    deleteScraper,
    insertScraperData,
    getScraperData,
    deleteScraperData,
    closeDB,
} from "./db.js";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(dirname, "..", "scrapers.db");

// Clean up database before and after tests
function cleanupDB() {
    closeDB();
    if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
    }
    // Also remove WAL files if they exist
    const walPath = dbPath + "-wal";
    const shmPath = dbPath + "-shm";
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
}

test("should create a scraper with empty fields", () => {
    cleanupDB();
    const scraper = createScraper("https://example.com", []);

    assert.ok(scraper.id);
    assert.strictEqual(scraper.url, "https://example.com");
    assert.deepStrictEqual(scraper.fields, []);
    assert.ok(scraper.createdAt);

    cleanupDB();
});

test("should create a scraper with multiple fields", () => {
    cleanupDB();
    const fields = ["title", "price", "description"];
    const scraper = createScraper("https://example.com/products", fields);

    assert.ok(scraper.id);
    assert.strictEqual(scraper.url, "https://example.com/products");
    assert.deepStrictEqual(scraper.fields, fields);

    cleanupDB();
});

test("should sanitize field names with special characters", () => {
    cleanupDB();
    const fields = ["Product Title!", "Price ($)", "Rating ★"];
    const scraper = createScraper("https://example.com", fields);

    // Should create successfully and retrieve the scraper with original field names
    const retrieved = getScraper(scraper.id);
    assert.ok(retrieved);
    assert.deepStrictEqual(retrieved.fields, fields);

    cleanupDB();
});

test("should get a scraper by ID", () => {
    cleanupDB();
    const scraper = createScraper("https://example.com", ["field1", "field2"]);

    const retrieved = getScraper(scraper.id);
    assert.ok(retrieved);
    assert.strictEqual(retrieved.id, scraper.id);
    assert.strictEqual(retrieved.url, scraper.url);
    assert.deepStrictEqual(retrieved.fields, scraper.fields);

    cleanupDB();
});

test("should return null for non-existent scraper", () => {
    cleanupDB();
    const retrieved = getScraper(999999999);
    assert.strictEqual(retrieved, null);
    cleanupDB();
});

test("should list all scrapers", () => {
    cleanupDB();
    const scraper1 = createScraper("https://example1.com", ["field1"]);
    const scraper2 = createScraper("https://example2.com", ["field2"]);
    const scraper3 = createScraper("https://example3.com", ["field3"]);

    const list = listScrapers();
    assert.strictEqual(list.length, 3);

    // Should be sorted by createdAt descending
    assert.strictEqual(list[0].id, scraper3.id);
    assert.strictEqual(list[1].id, scraper2.id);
    assert.strictEqual(list[2].id, scraper1.id);

    cleanupDB();
});

test("should return empty list when no scrapers exist", () => {
    cleanupDB();
    const list = listScrapers();
    assert.deepStrictEqual(list, []);
    cleanupDB();
});

test("should delete a scraper", () => {
    cleanupDB();
    const scraper = createScraper("https://example.com", ["field1"]);

    const deleted = deleteScraper(scraper.id);
    assert.strictEqual(deleted, true);

    const retrieved = getScraper(scraper.id);
    assert.strictEqual(retrieved, null);

    cleanupDB();
});

test("should return false when deleting non-existent scraper", () => {
    cleanupDB();
    const deleted = deleteScraper(999999999);
    assert.strictEqual(deleted, false);
    cleanupDB();
});

test("should insert scraper data with all fields", () => {
    cleanupDB();
    const scraper = createScraper("https://example.com", ["title", "price"]);

    const data = {
        title: ["Product 1"],
        price: ["$19.99"],
    };

    const rowId = insertScraperData(scraper.id, data);
    assert.ok(rowId);

    cleanupDB();
});

test("should insert scraper data with null values", () => {
    cleanupDB();
    const scraper = createScraper("https://example.com", ["title", "price", "rating"]);

    const data = {
        title: ["Product 1"],
        price: null,
        rating: ["4.5"],
    };

    const rowId = insertScraperData(scraper.id, data);
    assert.ok(rowId);

    const rows = getScraperData(scraper.id);
    assert.strictEqual(rows.length, 1);
    assert.deepStrictEqual(rows[0].title, ["Product 1"]);
    assert.strictEqual(rows[0].price, null);
    assert.deepStrictEqual(rows[0].rating, ["4.5"]);

    cleanupDB();
});

test("should throw error when inserting data for non-existent scraper", () => {
    cleanupDB();
    assert.throws(() => {
        insertScraperData(999999999, {});
    }, /Scraper 999999999 not found/);
    cleanupDB();
});

test("should get scraper data", () => {
    cleanupDB();
    const scraper = createScraper("https://example.com", ["title", "price"]);

    const data1 = {
        title: ["Product 1"],
        price: ["$19.99"],
    };
    const data2 = {
        title: ["Product 2"],
        price: ["$29.99"],
    };

    insertScraperData(scraper.id, data1);
    insertScraperData(scraper.id, data2);

    const rows = getScraperData(scraper.id);
    assert.strictEqual(rows.length, 2);

    // Verify both rows exist
    assert.ok(rows.some((r) => r.title[0] === "Product 1"));
    assert.ok(rows.some((r) => r.title[0] === "Product 2"));

    cleanupDB();
});

test("should return empty array for scraper with no data", () => {
    cleanupDB();
    const scraper = createScraper("https://example.com", ["field1"]);

    const rows = getScraperData(scraper.id);
    assert.deepStrictEqual(rows, []);

    cleanupDB();
});

test("should return empty array for non-existent scraper", () => {
    cleanupDB();
    const rows = getScraperData(999999999);
    assert.deepStrictEqual(rows, []);
    cleanupDB();
});

test("should delete scraper data", () => {
    cleanupDB();
    const scraper = createScraper("https://example.com", ["title"]);

    const data = { title: ["Product 1"] };
    const rowId = insertScraperData(scraper.id, data);

    const deleted = deleteScraperData(scraper.id, rowId);
    assert.strictEqual(deleted, true);

    const rows = getScraperData(scraper.id);
    assert.strictEqual(rows.length, 0);

    cleanupDB();
});

test("should return false when deleting non-existent data", () => {
    cleanupDB();
    const scraper = createScraper("https://example.com", ["field1"]);

    const deleted = deleteScraperData(scraper.id, 999999);
    assert.strictEqual(deleted, false);

    cleanupDB();
});

test("should handle multiple scrapers with different fields", () => {
    cleanupDB();
    const scraper1 = createScraper("https://example1.com", ["title", "price"]);
    const scraper2 = createScraper("https://example2.com", ["name", "rating", "description"]);

    insertScraperData(scraper1.id, {
        title: ["Product A"],
        price: ["$10"],
    });

    insertScraperData(scraper2.id, {
        name: ["Item B"],
        rating: ["5.0"],
        description: ["Great product"],
    });

    const rows1 = getScraperData(scraper1.id);
    const rows2 = getScraperData(scraper2.id);

    assert.strictEqual(rows1.length, 1);
    assert.strictEqual(rows2.length, 1);

    assert.ok("title" in rows1[0]);
    assert.ok("price" in rows1[0]);
    assert.strictEqual("name" in rows1[0], false);

    assert.ok("name" in rows2[0]);
    assert.ok("rating" in rows2[0]);
    assert.ok("description" in rows2[0]);
    assert.strictEqual("title" in rows2[0], false);

    cleanupDB();
});

test("should handle scrapers with identical field names", () => {
    cleanupDB();
    const scraper1 = createScraper("https://example1.com", ["title"]);
    const scraper2 = createScraper("https://example2.com", ["title"]);

    insertScraperData(scraper1.id, {
        title: ["Title 1"],
    });

    insertScraperData(scraper2.id, {
        title: ["Title 2"],
    });

    const rows1 = getScraperData(scraper1.id);
    const rows2 = getScraperData(scraper2.id);

    assert.strictEqual(rows1.length, 1);
    assert.strictEqual(rows2.length, 1);
    assert.deepStrictEqual(rows1[0].title, ["Title 1"]);
    assert.deepStrictEqual(rows2[0].title, ["Title 2"]);

    cleanupDB();
});

test("should preserve field order", () => {
    cleanupDB();
    const fields = ["field1", "field2", "field3", "field4", "field5"];
    const scraper = createScraper("https://example.com", fields);

    const retrieved = getScraper(scraper.id);
    assert.ok(retrieved);
    assert.deepStrictEqual(retrieved.fields, fields);

    cleanupDB();
});

test("should handle complex URLs", () => {
    cleanupDB();
    const url = "https://example.com/products?category=electronics&sort=price&page=1#results";
    const scraper = createScraper(url, ["title"]);

    const retrieved = getScraper(scraper.id);
    assert.ok(retrieved);
    assert.strictEqual(retrieved.url, url);

    cleanupDB();
});

test("should handle array data in fields", () => {
    cleanupDB();
    const scraper = createScraper("https://example.com", ["items", "prices"]);

    const data = {
        items: ["Item 1", "Item 2", "Item 3"],
        prices: ["$10", "$20", "$30"],
    };

    insertScraperData(scraper.id, data);

    const rows = getScraperData(scraper.id);
    assert.strictEqual(rows.length, 1);
    assert.deepStrictEqual(rows[0].items, ["Item 1", "Item 2", "Item 3"]);
    assert.deepStrictEqual(rows[0].prices, ["$10", "$20", "$30"]);

    cleanupDB();
});

test("should handle empty arrays in data", () => {
    cleanupDB();
    const scraper = createScraper("https://example.com", ["items"]);

    const data = {
        items: [],
    };

    insertScraperData(scraper.id, data);

    const rows = getScraperData(scraper.id);
    assert.strictEqual(rows.length, 1);
    assert.deepStrictEqual(rows[0].items, []);

    cleanupDB();
});

test("should handle field names that need sanitization", () => {
    cleanupDB();
    const fields = ["Title (Main)", "Price-USD", "Rating/Score", "Description & Details", "Stock?"];
    const scraper = createScraper("https://example.com", fields);

    const data = {
        "Title (Main)": ["Product Title"],
        "Price-USD": ["$99.99"],
        "Rating/Score": ["4.5"],
        "Description & Details": ["Great product"],
        "Stock?": ["Yes"],
    };

    insertScraperData(scraper.id, data);

    const rows = getScraperData(scraper.id);
    assert.strictEqual(rows.length, 1);
    assert.deepStrictEqual(rows[0]["Title (Main)"], ["Product Title"]);
    assert.deepStrictEqual(rows[0]["Price-USD"], ["$99.99"]);
    assert.deepStrictEqual(rows[0]["Rating/Score"], ["4.5"]);
    assert.deepStrictEqual(rows[0]["Description & Details"], ["Great product"]);
    assert.deepStrictEqual(rows[0]["Stock?"], ["Yes"]);

    cleanupDB();
});

test("should handle field names starting with numbers", () => {
    cleanupDB();
    const fields = ["1st_place", "2nd_place", "3rd_place"];
    const scraper = createScraper("https://example.com", fields);

    const data = {
        "1st_place": ["Gold"],
        "2nd_place": ["Silver"],
        "3rd_place": ["Bronze"],
    };

    insertScraperData(scraper.id, data);

    const rows = getScraperData(scraper.id);
    assert.strictEqual(rows.length, 1);
    assert.deepStrictEqual(rows[0]["1st_place"], ["Gold"]);
    assert.deepStrictEqual(rows[0]["2nd_place"], ["Silver"]);
    assert.deepStrictEqual(rows[0]["3rd_place"], ["Bronze"]);

    cleanupDB();
});

test("should handle multiple data insertions", () => {
    cleanupDB();
    const scraper = createScraper("https://example.com", ["product"]);

    for (let i = 0; i < 10; i++) {
        insertScraperData(scraper.id, {
            product: [`Product ${i}`],
        });
    }

    const rows = getScraperData(scraper.id);
    assert.strictEqual(rows.length, 10);

    cleanupDB();
});

test("should delete metadata when scraper is deleted", () => {
    cleanupDB();
    const scraper = createScraper("https://example.com", ["field1"]);

    insertScraperData(scraper.id, { field1: ["value1"] });

    deleteScraper(scraper.id);

    const retrieved = getScraper(scraper.id);
    assert.strictEqual(retrieved, null);

    const rows = getScraperData(scraper.id);
    assert.deepStrictEqual(rows, []);

    cleanupDB();
});
