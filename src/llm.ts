import { fileURLToPath } from "url";
import path from "path";
import { getLlama, LlamaChatSession, resolveModelFile } from "node-llama-cpp";
import xpath from "xpath";
import { JSDOM } from "jsdom";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const modelsDirectory = path.join(dirname, "..", "models");
const llama = await getLlama();
const modelPath = await resolveModelFile("hf:stabilityai/stable-code-instruct-3b/stable-code-3b-q5_k_m.gguf", modelsDirectory);
const model = await llama.loadModel({ modelPath });
const context = await model.createContext();
const session = new LlamaChatSession({ contextSequence: context.getSequence() });
const enableReprod = { temperature: 0, topK: 1, topP: 1.0, seed: 42 };

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
    const lines = response
        .trim()
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

    // prettier-ignore
    const extractionPatterns = [
        (line: string) => (line.startsWith("//") || line.startsWith("/")) ? line : null,
        (line: string) => line.match(/```(?:xpath)?\s*(\/\/?.+?)```/)?.[1]?.trim() ?? null,
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

    const trimmed = response.trim();
    const firstLine = trimmed.split("\n")[0];
    if (firstLine && (trimmed.startsWith("//") || trimmed.startsWith("/")) && isValidXPATH(firstLine)) {
        return firstLine;
    }

    return null;
}

// prettier-ignore
const perturbations = [
    "\nUse class names like [@class='...'].",
    "\nTry different class or tag combinations.",
    "\nLook at the parent-child structure.",
    "\nUse position-based selectors if needed.",
    "\nTry a simpler selector.",
];

function buildPrompt(html: string, query: string, attemptCount: number): string {
    const extra = perturbations[attemptCount] || "";
    return `
Generate ONE XPATH expression to extract ALL "${query}" values from this HTML.

CRITICAL RULES:
- Return ONLY the XPATH expression, no explanations
- MUST use structural selectors (class names, tag names, positions)
- NEVER use contains() or text content matching
- Use [@class='className'] for class-based selection
- Add /text() at the end to get text content
- The XPATH must select ALL matching elements (not just one)${extra}

HTML:
${html}

XPATH for "${query}":`;
}

export async function genXPATH(html: string, query: string, attemptCount: number): Promise<string | null> {
    const promptText = buildPrompt(html, query, attemptCount);
    const response = await session.prompt(promptText, enableReprod);
    return parseXPATH(response);
}
