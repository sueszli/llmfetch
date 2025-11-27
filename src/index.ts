import { genXPATH } from "./llm.js";

async function evalXPATH(html: string, xpath: string): Promise<string[]> {
    try {
        const { JSDOM } = await import("jsdom");
        const { document, XPathResult } = new JSDOM(html).window;
        const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        return Array.from({ length: result.snapshotLength }, (_, i) => result.snapshotItem(i)?.textContent || "");
    } catch {
        return [];
    }
}

async function generateXPaths(html: string, fields: string[]): Promise<string[]> {
    const xpaths: string[] = [];
    const maxAttempts = 5;

    for (let i = 0; i < fields.length; i++) {
        const field = fields[i];
        if (!field) continue;

        let xpath = "//text()";
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const generatedXPath = await genXPATH(html, field, attempt);
            if (!generatedXPath) {
                continue;
            }

            const results = await evalXPATH(html, generatedXPath);

            if (results.length > 0) {
                xpath = generatedXPath;
                break;
            }
        }

        xpaths.push(xpath);
    }
    return xpaths;
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

generateXPaths(html, fields)
    .then((xpaths) => {
        fields.forEach((field, i) => {
            console.log(`Field: ${field}\nXPath: ${xpaths[i]}\n`);
        });
    })
    .catch(console.error);
