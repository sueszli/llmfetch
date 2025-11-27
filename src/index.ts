import { parseHTML } from "./llm.js";

const response = await fetch("https://example.com/");
const html = await response.text();

const fields = ["title"];

for (const field of fields) {
    const result = await parseHTML(html, field);
    console.log(field, result);
}
