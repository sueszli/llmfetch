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

const fields = ["product title", "price", "rating", "stock"];

for (const field of fields) {
    const result = await parseHTML(html, field);
    console.log(field, result);
}
