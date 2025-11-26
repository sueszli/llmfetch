import { fileURLToPath } from "url";
import path from "path";
import { getLlama, LlamaChatSession, resolveModelFile } from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modelsDirectory = path.join(__dirname, "..", "models");
const llama = await getLlama();
const modelPath = await resolveModelFile("hf:stabilityai/stable-code-instruct-3b/stable-code-3b-q5_k_m.gguf", modelsDirectory);
const model = await llama.loadModel({ modelPath });
const context = await model.createContext(); // limit mem: `contextSize: {max: 8096}`
const session = new LlamaChatSession({ contextSequence: context.getSequence() });
const enableReprod = { temperature: 0, topK: 1, topP: 1.0, seed: 42 };

const q1 = "Write a small XPATH expression to select all the book titles in an XML document.";
console.log("User: " + q1);
const a1 = await session.prompt(q1, enableReprod);
console.log("AI: " + a1);
