import { genXPATH } from "./llm.js";
import { log } from "./utils.js";

async function evalXPATH(html: string, xpath: string): Promise<string[]> {
    try {
        const { JSDOM } = await import("jsdom");
        const { document, XPathResult } = new JSDOM(html).window;
        const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        return Array.from({ length: result.snapshotLength }, (_, i) => result.snapshotItem(i)?.textContent?.trim() || "");
    } catch {
        return [];
    }
}

async function parseHTML(html: string, field: string, maxAttempts = 5) {
    for (let i = 0; i < maxAttempts; i++) {
        const xpath = await genXPATH(html, field, i).catch(() => null);
        if (!xpath) continue;
        const result = await evalXPATH(html, xpath);
        const success = result.length > 0 && result.some((r) => r.length > 0);
        if (success) {
            log(`successfully extracted "${field}"`);
            return result;
        }
    }
    return null;
}

const html = `
<!DOCTYPE html>
<html>
<body>
    <div class="products-list">
        <article class="product-card">
            <h2 class="product-title">Wireless Headphones</h2>
            <div class="product-price">$89.99</div>
            <span class="product-rating">4.5</span>
            <p class="product-description">Premium noise-cancelling headphones</p>
            <button class="product-stock">In Stock</button>
        </article>
        <article class="product-card">
            <h2 class="product-title">Smart Watch</h2>
            <div class="product-price">$199.99</div>
            <span class="product-rating">4.8</span>
            <p class="product-description">Fitness tracker with heart rate monitor</p>
            <button class="product-stock">In Stock</button>
        </article>
        <article class="product-card">
            <h2 class="product-title">Laptop Stand</h2>
            <div class="product-price">$45.00</div>
            <span class="product-rating">4.2</span>
            <p class="product-description">Adjustable aluminum laptop stand</p>
            <button class="product-stock">Out of Stock</button>
        </article>
    </div>
</body>
</html>
`.trim();

const fields = ["product title", "price", "rating", "stock"];

for (const field of fields) {
    const result = await parseHTML(html, field);
    console.log(field, result);
}
