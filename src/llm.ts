import { fileURLToPath } from "url";
import path from "path";
import { getLlama, LlamaChatSession, resolveModelFile } from "node-llama-cpp";
import xpath from "xpath";
import { JSDOM } from "jsdom";

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

export function parseXPATH(response: string): string | null {
    // no existing ggml grammar: https://github.com/ggml-org/llama.cpp/tree/master/grammars
    const lines = response
        .trim()
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

    for (const line of lines) {
        if (line.startsWith("//") || line.startsWith("/")) {
            if (isValidXPATH(line)) return line;
        }

        // code blocks ```
        const match1 = line.match(/```(?:xpath)?\s*(\/\/?.+?)```/);
        if (match1 && match1[1]) {
            const xpath = match1[1].trim();
            if (isValidXPATH(xpath)) return xpath;
        }

        // backticks `
        const match2 = line.match(/`(\/\/?.+?)`/);
        if (match2 && match2[1]) {
            const xpath = match2[1].trim();
            if (isValidXPATH(xpath)) return xpath;
        }

        // loose XPath anywhere in the line
        const match3 = line.match(/(\/\/[^\s]+)/);
        if (match3 && match3[1]) {
            const xpath = match3[1].trim();
            if (isValidXPATH(xpath)) return xpath;
        }
    }

    const trimmed = response.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("/")) {
        const firstLine = trimmed.split("\n")[0];
        if (firstLine && isValidXPATH(firstLine)) return firstLine;
    }

    return null;
}

export function isValidXPATH(xpathStr: string): boolean {
    if (!xpathStr.startsWith("/") && !xpathStr.startsWith("//")) return false;

    const content = xpathStr.replace(/^\/+/, "");
    if (content.length === 0) return false;

    if (xpathStr.includes("<") || xpathStr.includes(">")) return false;
    if (xpathStr.length < 2 || xpathStr.length >= 1000) return false;

    try {
        const dummyDom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
        const dummyDoc = dummyDom.window.document;
        xpath.selectWithResolver(xpathStr, dummyDoc, { lookupNamespaceURI: () => "http://example.com/ns" });
        return true;
    } catch {
        return false;
    }
}

export async function promptGrammarXPATH(input: string): Promise<string | null> {
    const response = await session.prompt(input, enableReprod);
    return parseXPATH(response);
}
