import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { createJob, readJob, updateJob, deleteJob, listJobs } from "./db.js";
import { parseHTML } from "./llm.js";
import { log } from "./utils.js";

const app = new Hono();

app.get("/jobs", (c) => c.json(listJobs()));

app.post("/jobs", async (c) => {
    const { fields } = await c.req.json<{ fields: string[] }>();
    if (!Array.isArray(fields) || fields.length === 0) return c.json({ error: "fields array required" }, 400);
    const id = createJob(fields);
    return c.json({ id }, 201);
});

app.get("/jobs/:id", (c) => {
    const id = parseInt(c.req.param("id"));
    if (isNaN(id)) return c.json({ error: "invalid id" }, 400);
    const data = readJob(id);
    return data.length > 0 ? c.json(data) : c.json({ error: "not found" }, 404);
});

app.delete("/jobs/:id", (c) => {
    const id = parseInt(c.req.param("id"));
    if (isNaN(id)) return c.json({ error: "invalid id" }, 400);
    const success = deleteJob(id);
    return success ? c.json({ success: true }) : c.json({ error: "not found" }, 404);
});

app.post("/jobs/:id/scrape", async (c) => {
    const id = parseInt(c.req.param("id"));
    if (isNaN(id)) return c.json({ error: "invalid id" }, 400);

    const { url, fields } = await c.req.json<{ url: string; fields: string[] }>();
    if (!url || !Array.isArray(fields) || fields.length === 0) return c.json({ error: "url and fields required" }, 400);

    try {
        const response = await fetch(url);
        const html = await response.text();

        const results: Record<string, string> = {};
        for (const field of fields) {
            const extracted = await parseHTML(html, field);
            results[field] = extracted?.[0] || "";
        }

        const rowId = updateJob(id, results);
        return c.json({ rowId, results });
    } catch (err) {
        log("scrape error", err);
        return c.json({ error: "scraping failed" }, 500);
    }
});

const port = parseInt(process.env.PORT || "3000");

serve({ fetch: app.fetch, port }, () => log(`Server running on http://localhost:${port}`));
