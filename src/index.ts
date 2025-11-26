import { promptGrammarXPATH } from "./llm.js";

function buildPrompt(html: string, field: string, attempt: number): string {
    const perturbations = ["\nUse class names like [@class='...'].", "\nTry different class or tag combinations.", "\nLook at the parent-child structure.", "\nUse position-based selectors if needed.", "\nTry a simpler selector."];
    const extra = perturbations[attempt] || "";
    return `
Generate ONE XPATH expression to extract ALL "${field}" values from this HTML.

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

async function evalXPATH(html: string, xpath: string): Promise<string[]> {
    try {
        const { JSDOM } = await import("jsdom");
        const dom = new JSDOM(html);
        const { document } = dom.window;
        const XPathResult = dom.window.XPathResult;

        const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        const values: string[] = [];
        for (let i = 0; i < result.snapshotLength; i++) {
            const node = result.snapshotItem(i);
            if (node) {
                values.push(node.textContent || "");
            }
        }
        return values;
    } catch (e) {
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
            const promptText = buildPrompt(html, field, attempt);
            const generatedXPath = await promptGrammarXPATH(promptText);
            if (!generatedXPath) {
                continue;
            }

            const results = await evalXPATH(html, generatedXPath);
            console.log(results);

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

generateXPaths(html, fields)
    .then((xpaths) => {
        fields.forEach((field, i) => {
            console.log(`${field}: ${xpaths[i]}`);
        });
    })
    .catch(console.error);
