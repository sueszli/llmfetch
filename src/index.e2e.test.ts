import { test } from "node:test";
import assert from "node:assert";
import { createServer, type Server } from "node:http";
import xpath from "xpath";
import { JSDOM } from "jsdom";

const testHTML = `
<!DOCTYPE html>
<html>
<head>
    <title>Example Domain</title>
</head>
<body>
    <h1>Example Domain</h1>
    <p>This domain is for use in illustrative examples in documents.</p>
</body>
</html>
`;

function startTestServer(): Promise<{ server: Server; port: number }> {
    return new Promise((resolve) => {
        const server = createServer((req, res) => {
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(testHTML);
        });

        server.listen(0, () => {
            const address = server.address();
            const port = typeof address === "object" && address !== null ? address.port : 0;
            resolve({ server, port });
        });
    });
}

function stopTestServer(server: Server): Promise<void> {
    return new Promise((resolve, reject) => {
        server.close((err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

function extractWithXPath(html: string, xpathExpr: string): string[] {
    const { document, XPathResult } = new JSDOM(html).window;
    const result = document.evaluate(xpathExpr, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    return Array.from({ length: result.snapshotLength }, (_, i) => result.snapshotItem(i)?.textContent?.trim() || "");
}

test("should extract title from local test server using XPath", async () => {
    const { server, port } = await startTestServer();

    try {
        const response = await fetch(`http://localhost:${port}`);
        const html = await response.text();

        // Extract title using XPath instead of LLM
        const result = extractWithXPath(html, "//title");

        console.log("Extracted title:", result);
        assert.ok(Array.isArray(result), "Result should be an array");
        assert.strictEqual(result.length, 1, "Should extract exactly one title");
        assert.strictEqual(result[0], "Example Domain", "Title should be 'Example Domain'");
    } finally {
        await stopTestServer(server);
    }
});
