import { fileURLToPath } from "url";
import path from "path";
import { getLlama, LlamaChatSession, resolveModelFile } from "node-llama-cpp";
import xpath from "xpath";
import { JSDOM } from "jsdom";
import { log } from "./utils.js";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const modelsDirectory = path.join(dirname, "..", "models");
const llama = await getLlama();
const modelPath = await resolveModelFile("hf:stabilityai/stable-code-instruct-3b/stable-code-3b-q5_k_m.gguf", modelsDirectory);
const model = await llama.loadModel({ modelPath });
const context = await model.createContext();
const session = new LlamaChatSession({ contextSequence: context.getSequence() });

export function isValidXPATH(xpathStr: string): boolean {
    const startsWithSlash = xpathStr.startsWith("/") || xpathStr.startsWith("//");
    const hasContent = xpathStr.replace(/^\/+/, "").length > 0;
    const hasNoHtmlTags = !xpathStr.includes("<") && !xpathStr.includes(">");
    const hasValidLength = xpathStr.length >= 2 && xpathStr.length < 1000;

    if (!startsWithSlash || !hasContent || !hasNoHtmlTags || !hasValidLength) {
        return false;
    }

    try {
        const { document } = new JSDOM("<!DOCTYPE html><html><body></body></html>").window;
        xpath.selectWithResolver(xpathStr, document, { lookupNamespaceURI: () => "http://example.com/ns" });
        return true;
    } catch {
        return false;
    }
}

// no existing ggml grammar: https://github.com/ggml-org/llama.cpp/tree/master/grammars
export function parseXPATH(response: string): string | null {
    const trimmed = response.trim();

    // Extract from multi-line markdown code blocks
    const codeBlockRegex = /```(?:xpath)?\s*\n?([\s\S]*?)\n?```/g;
    let match;
    while ((match = codeBlockRegex.exec(trimmed)) !== null) {
        const content = match[1]?.trim();
        if (content) {
            const lines = content.split("\n").map((l) => l.trim());
            for (const line of lines) {
                if ((line.startsWith("//") || line.startsWith("/")) && isValidXPATH(line)) {
                    return line;
                }
            }
        }
    }

    const lines = trimmed
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

    // prettier-ignore
    const extractionPatterns = [
        (line: string) => (line.startsWith("//") || line.startsWith("/")) ? line : null,
        (line: string) => line.match(/`(\/\/?.+?)`/)?.[1]?.trim() ?? null,
        (line: string) => line.match(/(\/\/[^\s]+)/)?.[1]?.trim() ?? null,
    ];

    for (const line of lines) {
        for (const extract of extractionPatterns) {
            const xpath = extract(line);
            if (xpath && isValidXPATH(xpath)) {
                return xpath;
            }
        }
    }

    const firstLine = trimmed.split("\n")[0];
    if (firstLine && (trimmed.startsWith("//") || trimmed.startsWith("/")) && isValidXPATH(firstLine)) {
        return firstLine;
    }

    return null;
}

function buildPrompt(html: string, query: string): string {
    // prettier-ignore
    return [
        `Task: Write XPath to select all "${query}" elements`,
        "",
        "STRICT RULES:",
        "1. Output ONLY the XPath expression - no explanations",
        "2. Find the class name that matches the query",
        "3. Use format: //element[@class='exact-class-name']",
        "4. Single closing bracket ] not double ]]",
        "5. NEVER use text(), contains(), or following-sibling",
        "",
        "EXAMPLES:",
        "Q: country names",
        "HTML: <div class='country'><h3 class='country-name'>Afghanistan</h3></div>",
        "A: //h3[@class='country-name']",
        "",
        "Q: capitals",
        "HTML: <div class='country'><span class='country-capital'>Kabul</span></div>",
        "A: //span[@class='country-capital']",
        "",
        "Q: population",
        "HTML: <div class='country'><span class='country-population'>38928346</span></div>",
        "A: //span[@class='country-population']",
        "",
        "NOW YOUR TURN:",
        html,
        "",
        `XPath for "${query}":`
    ].join("\n");
}

export async function genXPATH(html: string, query: string, attemptCount: number): Promise<string | null> {
    const promptText = buildPrompt(html, query);
    const samplingParams = {
        temperature: 0,
        topK: 1,
        topP: 1.0,
        seed: 42 + attemptCount * 1000,
        maxTokens: 150,
        stopStrings: ["\n\n", "Explanation:", "Note:", "This XPath"],
    };
    const response = await session.prompt(promptText, samplingParams);
    const parsed = parseXPATH(response);
    log("generated xpath", JSON.stringify({ query, xpath: parsed, attemptCount }));
    return parsed;
}
