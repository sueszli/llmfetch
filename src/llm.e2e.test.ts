import { test } from "node:test";
import assert from "node:assert";
import { parseHTML } from "./llm.js";

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
`;

test("should extract product title from HTML", async () => {
    const result = await parseHTML(html, "product title");
    assert.deepStrictEqual(result, ["Wireless Headphones", "Smart Watch", "Laptop Stand"]);
});

test("should extract price from HTML", async () => {
    const result = await parseHTML(html, "price");
    assert.deepStrictEqual(result, ["$89.99", "$199.99", "$45.00"]);
});

test("should extract rating from HTML", async () => {
    const result = await parseHTML(html, "rating");
    assert.deepStrictEqual(result, ["4.5", "4.8", "4.2"]);
});
