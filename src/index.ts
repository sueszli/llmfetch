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
