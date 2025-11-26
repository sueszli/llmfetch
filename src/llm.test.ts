import { test } from "node:test";
import assert from "node:assert";
import { parseXPATH, isValidXPATH } from "./llm.js";

test("should accept valid simple XPath with //", () => {
    assert.strictEqual(isValidXPATH("//div"), true);
});

test("should accept valid simple XPath with /", () => {
    assert.strictEqual(isValidXPATH("/html/body/div"), true);
});

test("should accept XPath with attributes", () => {
    assert.strictEqual(isValidXPATH("//div[@class='test']"), true);
});

test("should accept XPath with double-quoted attributes", () => {
    assert.strictEqual(isValidXPATH('//div[@class="test"]'), true);
});

test("should accept XPath with complex predicates", () => {
    assert.strictEqual(isValidXPATH("//div[@class='test' and @id='main']"), true);
});

test("should accept XPath with position predicates", () => {
    assert.strictEqual(isValidXPATH("//div[@class='container']/div[1]"), true);
});

test("should accept XPath with text() function", () => {
    assert.strictEqual(isValidXPATH("//div[@class='test']/text()"), true);
});

test("should accept XPath with wildcard", () => {
    assert.strictEqual(isValidXPATH("//*[@class='item']"), true);
});

test("should accept XPath with union operator", () => {
    assert.strictEqual(isValidXPATH("//div[@class='a'] | //div[@class='b']"), true);
});

test("should accept XPath with namespace prefix", () => {
    assert.strictEqual(isValidXPATH("//ns:element[@attr='value']"), true);
});

test("should reject XPath not starting with / or //", () => {
    assert.strictEqual(isValidXPATH("div[@class='test']"), false);
});

test("should reject XPath with only slashes", () => {
    assert.strictEqual(isValidXPATH("//"), false);
});

test("should reject empty XPath", () => {
    assert.strictEqual(isValidXPATH(""), false);
});

test("should reject XPath with HTML-like tags", () => {
    assert.strictEqual(isValidXPATH("//div<script>alert('xss')</script>"), false);
});

test("should reject XPath with unclosed bracket", () => {
    assert.strictEqual(isValidXPATH("//div[@class='test'"), false);
});

test("should reject XPath with unclosed quote", () => {
    assert.strictEqual(isValidXPATH("//div[@class='test]"), false);
});

test("should reject XPath with double brackets", () => {
    assert.strictEqual(isValidXPATH("//div[[@class='test']]"), false);
});

test("should reject XPath with extra closing brackets", () => {
    assert.strictEqual(isValidXPATH("//div[@class='test']]]"), false);
});

test("should reject XPath with incomplete expression", () => {
    assert.strictEqual(isValidXPATH("//div[@class='test' and]"), false);
});

test("should reject XPath with empty predicate", () => {
    assert.strictEqual(isValidXPATH("//div[@]"), false);
});

test("should reject XPath with unclosed predicate", () => {
    assert.strictEqual(isValidXPATH("//div["), false);
});

test("should reject XPath with incomplete comparison", () => {
    assert.strictEqual(isValidXPATH("//div[@class='test' and @id=]"), false);
});

test("should reject XPath that is too long", () => {
    const longXPath = "//" + "div/".repeat(500);
    assert.strictEqual(isValidXPATH(longXPath), false);
});

test("should reject XPath that is too short", () => {
    assert.strictEqual(isValidXPATH("/"), false);
});

test("should extract plain XPath starting with //", () => {
    const result = parseXPATH("//div[@class='test']/text()");
    assert.strictEqual(result, "//div[@class='test']/text()");
});

test("should extract plain XPath starting with /", () => {
    const result = parseXPATH("/html/body/div/text()");
    assert.strictEqual(result, "/html/body/div/text()");
});

test("should extract XPath from code block with xpath language", () => {
    const result = parseXPATH("```xpath\n//div[@class='container']/text()\n```");
    assert.strictEqual(result, "//div[@class='container']/text()");
});

test("should extract XPath from code block without language specifier", () => {
    const result = parseXPATH("``` //div[@id='main']/span/text() ```");
    assert.strictEqual(result, "//div[@id='main']/span/text()");
});

test("should extract XPath from backticks", () => {
    const result = parseXPATH("The XPath is `//div[@class='item']/text()`");
    assert.strictEqual(result, "//div[@class='item']/text()");
});

test("should extract XPath from first line when surrounded by text", () => {
    const result = parseXPATH("Here is your XPath:\n//div[@class='result']/text()\nThis should work.");
    assert.strictEqual(result, "//div[@class='result']/text()");
});

test("should extract XPath from response starting with it", () => {
    const result = parseXPATH("//div[@class='answer']/text()\nSome explanation here");
    assert.strictEqual(result, "//div[@class='answer']/text()");
});

test("should return null when no valid XPath found", () => {
    const result = parseXPATH("I cannot provide an XPath for this.");
    assert.strictEqual(result, null);
});

test("should return null for empty response", () => {
    const result = parseXPATH("");
    assert.strictEqual(result, null);
});

test("should return null for response with only whitespace", () => {
    const result = parseXPATH("   \n\n  \n");
    assert.strictEqual(result, null);
});

test("should handle XPath with complex predicates", () => {
    const result = parseXPATH("//div[@class='item' and @data-type='product']/span[@class='price']/text()");
    assert.strictEqual(result, "//div[@class='item' and @data-type='product']/span[@class='price']/text()");
});

test("should handle XPath with position predicates", () => {
    const result = parseXPATH("//div[@class='container']/div[1]/text()");
    assert.strictEqual(result, "//div[@class='container']/div[1]/text()");
});

test("should handle XPath with namespace-like syntax", () => {
    const result = parseXPATH("//ns:element[@attr='value']/text()");
    assert.strictEqual(result, "//ns:element[@attr='value']/text()");
});

test("should reject XPath with invalid characters", () => {
    const result = parseXPATH("//div<script>alert('xss')</script>");
    assert.strictEqual(result, null);
});

test("should reject response with only slashes", () => {
    const result = parseXPATH("//");
    assert.strictEqual(result, null);
});

test("should handle XPath with wildcard", () => {
    const result = parseXPATH("//*[@class='item']/text()");
    assert.strictEqual(result, "//*[@class='item']/text()");
});

test("should handle XPath with union operator", () => {
    const result = parseXPATH("//div[@class='a'] | //div[@class='b']");
    assert.strictEqual(result, "//div[@class='a'] | //div[@class='b']");
});

test("should extract first valid XPath when multiple are present", () => {
    const result = parseXPATH("Try this: //div[@class='first']/text() or maybe //div[@class='second']/text()");
    assert.strictEqual(result, "//div[@class='first']/text()");
});

test("should handle XPath in multiline response with explanations", () => {
    const result = parseXPATH(
        `
Here is the XPath you requested:
//div[@class='country-name']/text()
This will extract all country names from the HTML.
    `.trim(),
    );
    assert.strictEqual(result, "//div[@class='country-name']/text()");
});

test("should handle XPath without /text() suffix", () => {
    const result = parseXPATH("//div[@class='container']");
    assert.strictEqual(result, "//div[@class='container']");
});

test("should handle XPath with double quotes in attributes", () => {
    const result = parseXPATH('//div[@class="container"]/text()');
    assert.strictEqual(result, '//div[@class="container"]/text()');
});

test("should handle complex XPath from realistic LLM response", () => {
    const result = parseXPATH(`Based on the HTML structure, here's the XPath:

\`\`\`xpath
//h3[@class='country-name']/text()
\`\`\`

This will select all country names.`);
    assert.strictEqual(result, "//h3[@class='country-name']/text()");
});
