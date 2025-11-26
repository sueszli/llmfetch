import { describe, test } from "node:test";
import assert from "node:assert";
import { parseXPathFromResponse } from "./llm.js";

test("should extract plain XPath starting with //", () => {
    const result = parseXPathFromResponse("//div[@class='test']/text()");
    assert.strictEqual(result, "//div[@class='test']/text()");
});

test("should extract plain XPath starting with /", () => {
    const result = parseXPathFromResponse("/html/body/div/text()");
    assert.strictEqual(result, "/html/body/div/text()");
});

test("should extract XPath from code block with xpath language", () => {
    const result = parseXPathFromResponse("```xpath\n//div[@class='container']/text()\n```");
    assert.strictEqual(result, "//div[@class='container']/text()");
});

test("should extract XPath from code block without language specifier", () => {
    const result = parseXPathFromResponse("``` //div[@id='main']/span/text() ```");
    assert.strictEqual(result, "//div[@id='main']/span/text()");
});

test("should extract XPath from backticks", () => {
    const result = parseXPathFromResponse("The XPath is `//div[@class='item']/text()`");
    assert.strictEqual(result, "//div[@class='item']/text()");
});

test("should extract XPath from first line when surrounded by text", () => {
    const result = parseXPathFromResponse("Here is your XPath:\n//div[@class='result']/text()\nThis should work.");
    assert.strictEqual(result, "//div[@class='result']/text()");
});

test("should extract XPath from response starting with it", () => {
    const result = parseXPathFromResponse("//div[@class='answer']/text()\nSome explanation here");
    assert.strictEqual(result, "//div[@class='answer']/text()");
});

test("should return null when no valid XPath found", () => {
    const result = parseXPathFromResponse("I cannot provide an XPath for this.");
    assert.strictEqual(result, null);
});

test("should return null for empty response", () => {
    const result = parseXPathFromResponse("");
    assert.strictEqual(result, null);
});

test("should return null for response with only whitespace", () => {
    const result = parseXPathFromResponse("   \n\n  \n");
    assert.strictEqual(result, null);
});

test("should handle XPath with complex predicates", () => {
    const result = parseXPathFromResponse("//div[@class='item' and @data-type='product']/span[@class='price']/text()");
    assert.strictEqual(result, "//div[@class='item' and @data-type='product']/span[@class='price']/text()");
});

test("should handle XPath with position predicates", () => {
    const result = parseXPathFromResponse("//div[@class='container']/div[1]/text()");
    assert.strictEqual(result, "//div[@class='container']/div[1]/text()");
});

test("should handle XPath with namespace-like syntax", () => {
    const result = parseXPathFromResponse("//ns:element[@attr='value']/text()");
    assert.strictEqual(result, "//ns:element[@attr='value']/text()");
});

test("should reject XPath with invalid characters", () => {
    const result = parseXPathFromResponse("//div<script>alert('xss')</script>");
    assert.strictEqual(result, null);
});

test("should reject response with only slashes", () => {
    const result = parseXPathFromResponse("//");
    assert.strictEqual(result, null);
});

test("should handle XPath with wildcard", () => {
    const result = parseXPathFromResponse("//*[@class='item']/text()");
    assert.strictEqual(result, "//*[@class='item']/text()");
});

test("should handle XPath with union operator", () => {
    const result = parseXPathFromResponse("//div[@class='a'] | //div[@class='b']");
    assert.strictEqual(result, "//div[@class='a'] | //div[@class='b']");
});

test("should extract first valid XPath when multiple are present", () => {
    const result = parseXPathFromResponse("Try this: //div[@class='first']/text() or maybe //div[@class='second']/text()");
    assert.strictEqual(result, "//div[@class='first']/text()");
});

test("should handle XPath in multiline response with explanations", () => {
    const result = parseXPathFromResponse(
        `
Here is the XPath you requested:
//div[@class='country-name']/text()
This will extract all country names from the HTML.
    `.trim(),
    );
    assert.strictEqual(result, "//div[@class='country-name']/text()");
});

test("should handle XPath without /text() suffix", () => {
    const result = parseXPathFromResponse("//div[@class='container']");
    assert.strictEqual(result, "//div[@class='container']");
});

test("should handle XPath with double quotes in attributes", () => {
    const result = parseXPathFromResponse('//div[@class="container"]/text()');
    assert.strictEqual(result, '//div[@class="container"]/text()');
});

test("should handle complex XPath from realistic LLM response", () => {
    const result = parseXPathFromResponse(`Based on the HTML structure, here's the XPath:

\`\`\`xpath
//h3[@class='country-name']/text()
\`\`\`

This will select all country names.`);
    assert.strictEqual(result, "//h3[@class='country-name']/text()");
});
