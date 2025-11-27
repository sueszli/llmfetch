import { test } from "node:test";
import assert from "node:assert";
import { createJob, readJob, updateJob, deleteJob, listJobs, closeDB, type JobRow, type JobInfo } from "./db.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(dirname, "..", "scrapers.db");

test("should create a job with fields", () => {
    const fields = ["title", "price", "rating"];
    const jobId = createJob(fields);

    assert.strictEqual(typeof jobId, "number");
    assert.ok(jobId >= 0);

    deleteJob(jobId);
});

test("should create a job with empty fields", () => {
    const jobId = createJob([]);

    assert.strictEqual(typeof jobId, "number");
    assert.ok(jobId >= 0);

    deleteJob(jobId);
});

test("should create a job with fields starting with digits", () => {
    const fields = ["123_field", "456_test"];
    const jobId = createJob(fields);

    assert.strictEqual(typeof jobId, "number");
    assert.ok(jobId >= 0);

    deleteJob(jobId);
});

test("should create a job with special characters in field names", () => {
    const fields = ["product-name", "price$", "rating@5"];
    const jobId = createJob(fields);

    assert.strictEqual(typeof jobId, "number");
    assert.ok(jobId >= 0);

    deleteJob(jobId);
});

test("should insert and read job data", () => {
    const fields = ["name", "email"];
    const jobId = createJob(fields);

    const rowId = updateJob(jobId, {
        name: "John Doe",
        email: "john@example.com",
    });

    const rows = readJob(jobId);
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0]!.name, "John Doe");
    assert.strictEqual(rows[0]!.email, "john@example.com");
    assert.strictEqual(rows[0]!.id, rowId);

    deleteJob(jobId);
});

test("should insert multiple rows and read all", () => {
    const fields = ["product", "price"];
    const jobId = createJob(fields);

    updateJob(jobId, { product: "Laptop", price: "$999" });
    updateJob(jobId, { product: "Mouse", price: "$25" });
    updateJob(jobId, { product: "Keyboard", price: "$75" });

    const rows = readJob(jobId);
    assert.strictEqual(rows.length, 3);
    assert.strictEqual(rows[0]!.product, "Laptop");
    assert.strictEqual(rows[1]!.product, "Mouse");
    assert.strictEqual(rows[2]!.product, "Keyboard");

    deleteJob(jobId);
});

test("should read specific row by rowId", () => {
    const fields = ["title"];
    const jobId = createJob(fields);

    const rowId1 = updateJob(jobId, { title: "First" });
    const rowId2 = updateJob(jobId, { title: "Second" });
    const rowId3 = updateJob(jobId, { title: "Third" });

    const row = readJob(jobId, rowId2);
    assert.strictEqual(row.length, 1);
    assert.strictEqual(row[0]!.title, "Second");
    assert.strictEqual(row[0]!.id, rowId2);

    deleteJob(jobId);
});

test("should return empty array when reading non-existent job", () => {
    const rows = readJob(99999);
    assert.deepStrictEqual(rows, []);
});

test("should return empty array when reading non-existent row", () => {
    const fields = ["field"];
    const jobId = createJob(fields);

    const rows = readJob(jobId, 99999);
    assert.deepStrictEqual(rows, []);

    deleteJob(jobId);
});

test("should throw error when updating non-existent job", () => {
    assert.throws(
        () => {
            updateJob(99999, { field: "value" });
        },
        {
            message: "Job 99999 not found",
        },
    );
});

test("should delete a job", () => {
    const fields = ["field"];
    const jobId = createJob(fields);

    const deleted = deleteJob(jobId);
    assert.strictEqual(deleted, true);

    const rows = readJob(jobId);
    assert.deepStrictEqual(rows, []);
});

test("should return false when deleting non-existent job", () => {
    const deleted = deleteJob(99999);
    assert.strictEqual(deleted, false);
});

test("should list all jobs", () => {
    const jobId1 = createJob(["field1"]);
    const jobId2 = createJob(["field2"]);
    const jobId3 = createJob(["field3"]);

    const jobs = listJobs();

    const createdJobs = jobs.filter((job) => [jobId1, jobId2, jobId3].includes(job.id));
    assert.strictEqual(createdJobs.length, 3);

    deleteJob(jobId1);
    deleteJob(jobId2);
    deleteJob(jobId3);
});

test("should list jobs in descending order by id", () => {
    const jobId1 = createJob(["a"]);
    const jobId2 = createJob(["b"]);
    const jobId3 = createJob(["c"]);

    const jobs = listJobs();
    const createdJobs = jobs.filter((job) => [jobId1, jobId2, jobId3].includes(job.id));

    assert.strictEqual(createdJobs[0]!.id, jobId3);
    assert.strictEqual(createdJobs[1]!.id, jobId2);
    assert.strictEqual(createdJobs[2]!.id, jobId1);

    deleteJob(jobId1);
    deleteJob(jobId2);
    deleteJob(jobId3);
});

test("should count field entries correctly", () => {
    const fields = ["name", "email", "phone"];
    const jobId = createJob(fields);

    updateJob(jobId, { name: "Alice", email: "alice@test.com", phone: "123" });
    updateJob(jobId, { name: "Bob", email: "bob@test.com", phone: "" });
    updateJob(jobId, { name: "Charlie", email: "", phone: "" });

    const jobs = listJobs();
    const job = jobs.find((j) => j.id === jobId);

    assert.ok(job);
    assert.strictEqual(job.fields.name, 3);
    assert.strictEqual(job.fields.email, 2);
    assert.strictEqual(job.fields.phone, 1);

    deleteJob(jobId);
});

test("should handle field names with leading digits by prepending f_", () => {
    const fields = ["123abc"];
    const jobId = createJob(fields);

    updateJob(jobId, { "123abc": "test value" });

    const rows = readJob(jobId);
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0]!["f_123abc"], "test value");

    deleteJob(jobId);
});

test("should handle mixed valid and invalid field name characters", () => {
    const fields = ["valid_field", "field-with-dash", "field.with.dots", "field spaces"];
    const jobId = createJob(fields);

    updateJob(jobId, {
        valid_field: "value1",
        "field-with-dash": "value2",
        "field.with.dots": "value3",
        "field spaces": "value4",
    });

    const rows = readJob(jobId);
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0]!.valid_field, "value1");
    assert.strictEqual(rows[0]!.field_with_dash, "value2");
    assert.strictEqual(rows[0]!.field_with_dots, "value3");
    assert.strictEqual(rows[0]!.field_spaces, "value4");

    deleteJob(jobId);
});

test("should preserve job creation timestamp in table name", () => {
    const jobId = createJob(["field"]);
    const jobs = listJobs();
    const job = jobs.find((j) => j.id === jobId);

    assert.ok(job);
    assert.ok(job.createdAt instanceof Date);
    assert.ok(!isNaN(job.createdAt.getTime()));

    const now = new Date();
    const timeDiff = Math.abs(now.getTime() - job.createdAt.getTime());
    assert.ok(timeDiff < 60000);

    deleteJob(jobId);
});

test("should increment job counter for each new job", () => {
    const jobId1 = createJob(["a"]);
    const jobId2 = createJob(["b"]);
    const jobId3 = createJob(["c"]);

    assert.ok(jobId2 > jobId1);
    assert.ok(jobId3 > jobId2);

    deleteJob(jobId1);
    deleteJob(jobId2);
    deleteJob(jobId3);
});

test("should handle empty string values in fields", () => {
    const fields = ["field1", "field2"];
    const jobId = createJob(fields);

    updateJob(jobId, { field1: "", field2: "value" });

    const rows = readJob(jobId);
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0]!.field1, "");
    assert.strictEqual(rows[0]!.field2, "value");

    deleteJob(jobId);
});

test("should handle UTF-8 characters in data", () => {
    const fields = ["text"];
    const jobId = createJob(fields);

    updateJob(jobId, { text: "Hello 世界 🌍" });

    const rows = readJob(jobId);
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0]!.text, "Hello 世界 🌍");

    deleteJob(jobId);
});

test("should handle very long field values", () => {
    const fields = ["content"];
    const jobId = createJob(fields);

    const longText = "a".repeat(10000);
    updateJob(jobId, { content: longText });

    const rows = readJob(jobId);
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0]!.content, longText);

    deleteJob(jobId);
});

test("should create database file if it doesn't exist", () => {
    assert.ok(fs.existsSync(dbPath));
});

test("should allow updating only subset of fields", () => {
    const fields = ["field1", "field2", "field3"];
    const jobId = createJob(fields);

    updateJob(jobId, { field1: "value1" });
    updateJob(jobId, { field2: "value2" });

    const rows = readJob(jobId);
    assert.strictEqual(rows.length, 2);
    assert.strictEqual(rows[0]!.field1, "value1");
    assert.strictEqual(rows[1]!.field2, "value2");

    deleteJob(jobId);
});

test("should handle many jobs created simultaneously", () => {
    const jobIds: number[] = [];

    for (let i = 0; i < 10; i++) {
        const jobId = createJob([`field${i}`]);
        jobIds.push(jobId);
    }

    const jobs = listJobs();
    const createdJobs = jobs.filter((job) => jobIds.includes(job.id));
    assert.strictEqual(createdJobs.length, 10);

    for (const jobId of jobIds) {
        deleteJob(jobId);
    }
});

test("integration: complete workflow", () => {
    const jobId = createJob(["product", "price", "stock"]);

    updateJob(jobId, { product: "Laptop", price: "$999", stock: "In Stock" });
    updateJob(jobId, { product: "Mouse", price: "$25", stock: "Out of Stock" });
    updateJob(jobId, { product: "Keyboard", price: "$75", stock: "In Stock" });

    const allRows = readJob(jobId);
    assert.strictEqual(allRows.length, 3);

    const secondRow = readJob(jobId, allRows[1]!.id);
    assert.strictEqual(secondRow[0]!.product, "Mouse");

    const jobs = listJobs();
    const currentJob = jobs.find((j) => j.id === jobId);
    assert.ok(currentJob);
    assert.strictEqual(currentJob.fields.product, 3);
    assert.strictEqual(currentJob.fields.price, 3);
    assert.strictEqual(currentJob.fields.stock, 3);

    const deleted = deleteJob(jobId);
    assert.strictEqual(deleted, true);

    const rowsAfterDelete = readJob(jobId);
    assert.deepStrictEqual(rowsAfterDelete, []);
});
