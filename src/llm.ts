import { fileURLToPath } from "url";
import path from "path";
import { getLlama, LlamaChatSession, resolveModelFile } from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modelsDirectory = path.join(__dirname, "..", "models");
const llama = await getLlama();
const modelPath = await resolveModelFile("hf:stabilityai/stable-code-instruct-3b/stable-code-3b-q5_k_m.gguf", modelsDirectory);
const model = await llama.loadModel({ modelPath });
const context = await model.createContext();
const session = new LlamaChatSession({ contextSequence: context.getSequence() });
const enableReprod = { temperature: 0, topK: 1, topP: 1.0, seed: 42 };

export async function prompt(input: string): Promise<string> {
    return await session.prompt(input, enableReprod);
}

export function parseXPathFromResponse(response: string): string | null {
    const lines = response
        .trim()
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

    // Check each line for XPath expressions
    for (const line of lines) {
        if (line.startsWith("//") || line.startsWith("/")) {
            if (isValidXPath(line)) return line;
        }

        // Check for XPath in code blocks: ```xpath ... ``` or ``` ... ```
        const match1 = line.match(/```(?:xpath)?\s*(\/\/?.+?)```/);
        if (match1 && match1[1]) {
            const xpath = match1[1].trim();
            if (isValidXPath(xpath)) return xpath;
        }

        // Check for XPath in backticks: `...`
        const match2 = line.match(/`(\/\/?.+?)`/);
        if (match2 && match2[1]) {
            const xpath = match2[1].trim();
            if (isValidXPath(xpath)) return xpath;
        }

        // Check for XPath embedded in text (not in backticks)
        const match3 = line.match(/(\/\/[^\s]+)/);
        if (match3 && match3[1]) {
            const xpath = match3[1].trim();
            if (isValidXPath(xpath)) return xpath;
        }
    }

    // Check if the entire trimmed response starts with XPath
    const trimmed = response.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("/")) {
        const firstLine = trimmed.split("\n")[0];
        if (firstLine && isValidXPath(firstLine)) return firstLine;
    }

    return null;
}

export function isValidXPath(xpath: string): boolean {
    // Basic validation: must start with / or //
    if (!xpath.startsWith("/") && !xpath.startsWith("//")) return false;

    // Must have some content after the initial slashes
    const content = xpath.replace(/^\/+/, "");
    if (content.length === 0) return false;

    // Don't allow any HTML/script tags or other dangerous characters
    if (xpath.includes("<") || xpath.includes(">")) return false;

    // Very lenient check - just ensure it's not complete garbage
    // Allow alphanumeric, common XPath operators and punctuation
    return xpath.length > 1 && xpath.length < 1000;
}

export async function promptGrammarXPATH(input: string): Promise<string | null> {
    const response = await session.prompt(input, enableReprod);
    return parseXPathFromResponse(response);
}
