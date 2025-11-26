import { prompt } from "./llm.js";

function buildPrompt(html: string, field: string, attempt: number): string {
    const perturbations = [
        " Use class names like [@class='...']",
        " Try different class or tag combinations",
        " Look at the parent-child structure",
        " Use position-based selectors if needed",
        " Try a simpler selector",
    ];
    const extra = perturbations[attempt] || "";
    return `Generate ONE XPATH expression to extract ALL "${field}" values from this HTML.

CRITICAL RULES:
- Return ONLY the XPATH expression, no explanations
- MUST use structural selectors (class names, tag names, positions)
- NEVER use contains() or text content matching
- Use [@class='className'] for class-based selection
- Add /text() at the end to get text content
- The XPATH must select ALL matching elements (not just one)${extra}

HTML:
${html}

XPATH for "${field}":`;
}

function parseXPath(response: string): string {
    const lines = response.trim().split('\n').map(l => l.trim()).filter(l => l.length > 0);
    for (const line of lines) {
        if (line.startsWith('//') || line.startsWith('/')) return line;
        const match1 = line.match(/```(?:xpath)?\s*(\/\/?.+?)```/);
        if (match1 && match1[1]) return match1[1].trim();
        const match2 = line.match(/`(\/\/?.+?)`/);
        if (match2 && match2[1]) return match2[1].trim();
    }
    const trimmed = response.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('/')) {
        const firstLine = trimmed.split('\n')[0];
        if (firstLine) return firstLine;
    }
    return '//text()';
}

async function evaluateXPath(html: string, xpath: string): Promise<number> {
    try {
        const { JSDOM } = await import('jsdom');
        const dom = new JSDOM(html);
        const { document } = dom.window;
        const XPathResult = dom.window.XPathResult;

        const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        return result.snapshotLength;
    } catch (e) {
        console.log(`    Error evaluating XPATH: ${e}`);
        return 0;
    }
}

async function generateXPath(html: string, field: string): Promise<string> {
    const maxAttempts = 5;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        console.log(`  [Attempt ${attempt + 1}/${maxAttempts}]`);

        const promptText = buildPrompt(html, field, attempt);
        const response = await prompt(promptText);
        const xpath = parseXPath(response);

        console.log(`    Generated: ${xpath}`);

        const count = await evaluateXPath(html, xpath);
        console.log(`    Matched: ${count} nodes`);

        if (count > 0) {
            console.log(`    ✓ Success`);
            return xpath;
        }

        console.log(`    ✗ Failed, retrying...`);
    }

    console.log(`    ⚠ All attempts failed, returning last XPATH`);
    const finalPromptText = buildPrompt(html, field, 0);
    const finalResponse = await prompt(finalPromptText);
    return parseXPath(finalResponse);
}

async function generateXPaths(html: string, fields: string[]): Promise<string[]> {
    const xpaths: string[] = [];
    for (let i = 0; i < fields.length; i++) {
        const field = fields[i];
        if (!field) continue;
        console.log(`\n[${i + 1}/${fields.length}] Processing field: "${field}"`);
        const xpath = await generateXPath(html, field);
        xpaths.push(xpath);
        console.log(`Final XPATH: ${xpath}\n`);
    }
    return xpaths;
}

const html = `
<!DOCTYPE html>
<html>
<body>
    <div class="container">
        <div class="country">
            <h3 class="country-name"><i class="icon-flag"></i>Afghanistan</h3>
            <span class="country-capital">Kabul</span>
            <span class="country-population">38928346</span>
            <span class="country-area">652090.0</span>
        </div>
        <div class="country">
            <h3 class="country-name"><i class="icon-flag"></i>Åland Islands</h3>
            <span class="country-capital">Mariehamn</span>
            <span class="country-population">28875</span>
            <span class="country-area">1580.0</span>
        </div>
        <div class="country">
            <h3 class="country-name"><i class="icon-flag"></i>Albania</h3>
            <span class="country-capital">Tirana</span>
            <span class="country-population">2877797</span>
            <span class="country-area">28748.0</span>
        </div>
    </div>
</body>
</html>
`.trim();

const fields = ["country name", "capital", "population"];

console.log("Starting XPATH generation...\n");
console.log("=".repeat(60));

generateXPaths(html, fields).then(xpaths => {
    console.log("=".repeat(60));
    console.log("\n✓ Final Results:");
    fields.forEach((field, i) => {
        console.log(`  ${field}: ${xpaths[i]}`);
    });
}).catch(console.error);
