import blessed from "blessed";

type Job = { id: number; createdAt: string; fields: Record<string, number> };
type Row = { id: number; [key: string]: string | number };
type View = "list" | "table" | "form";

const API = process.env.API_URL || "http://localhost:3000";
const state = { jobs: [] as Job[], view: "list" as View, selectedId: null as number | null, tableData: [] as Row[] };

const screen = blessed.screen({ smartCSR: true, title: "LLMFetch Database Browser" });
const header = blessed.box({ top: 0, left: 0, width: "100%", height: 3, content: "{center}{bold}LLMFetch Database Browser{/bold}{/center}\n{center}q: quit | n: new job | ↑↓: navigate | Enter: select | ESC: back{/center}", tags: true, style: { fg: "white", bg: "blue" } });
const jobList = blessed.list({ top: 3, left: 0, width: "100%", height: "100%-3", keys: true, vi: true, mouse: true, style: { selected: { bg: "blue", fg: "white" }, item: { fg: "green" } }, border: { type: "line" }, label: " Available Tables " });
const tableView = blessed.list({ top: 3, left: 0, width: "100%", height: "100%-3", keys: true, vi: true, mouse: true, scrollable: true, scrollbar: { ch: " ", style: { bg: "blue" } }, style: { selected: { bg: "blue", fg: "white" }, item: { fg: "white" } }, border: { type: "line" }, label: " Table Data " });
const formBox = blessed.form({ top: 3, left: "center", width: "80%", height: 18, border: { type: "line" }, label: " Create New Job ", style: { border: { fg: "blue" } }, keys: true });
const urlInput = blessed.textbox({ top: 2, left: 2, width: "100%-4", height: 3, inputOnFocus: true, style: { fg: "white", bg: "black", focus: { fg: "white", bg: "black" }, border: { fg: "cyan" } }, border: { type: "line" } });
const fieldsInput = blessed.textbox({ top: 6, left: 2, width: "100%-4", height: 3, inputOnFocus: true, style: { fg: "white", bg: "black", focus: { fg: "white", bg: "black" }, border: { fg: "cyan" } }, border: { type: "line" } });
const submitButton = blessed.button({ top: 10, left: "center", width: 20, height: 3, content: "Submit (Enter)", align: "center", valign: "middle", style: { fg: "white", bg: "green", focus: { bg: "blue" } }, border: { type: "line" } });
const formStatus = blessed.text({ top: 13, left: 2, width: "100%-4", height: 1, content: "", style: { fg: "yellow" } });

formBox.append(blessed.text({ top: 1, left: 2, content: "URL:", style: { fg: "white", bold: true } }));
formBox.append(urlInput);
formBox.append(blessed.text({ top: 5, left: 2, content: "Fields (comma-separated, e.g., field1,field2,field3):", style: { fg: "white", bold: true } }));
formBox.append(fieldsInput);
formBox.append(submitButton);
formBox.append(formStatus);

[header, jobList, tableView, formBox].forEach((w) => screen.append(w));
[tableView, formBox].forEach((w) => w.hide());

//
// pure functions
//

const formatJob = (j: Job) =>
    `[${j.id}] ${new Date(j.createdAt).toLocaleString()} | ${
        Object.entries(j.fields)
            .map(([k, v]) => `${k}:${v}`)
            .join(", ") || "empty"
    }`;
const formatTable = (data: Row[]) => {
    const headers = Object.keys(data[0]!);
    const w = 20;
    return [headers.map((h) => h.padEnd(w)).join(" | "), "-".repeat(headers.length * 23), ...data.map((row) => headers.map((h) => String(row[h] || "").padEnd(w)).join(" | "))];
};
const parseFields = (s: string) =>
    s
        .split(",")
        .map((f) => f.trim())
        .filter((f) => f.length > 0);

//
// view transitions
//

const showView = (view: View, widget: blessed.Widgets.BlessedElement) => {
    state.view = view;
    [jobList, tableView, formBox].forEach((w) => w.hide());
    widget.show();
    widget.focus();
    screen.render();
};
const showList = () => showView("list", jobList);
const showTable = () => showView("table", tableView);
const showForm = () => {
    showView("form", formBox);
    urlInput.clearValue();
    fieldsInput.clearValue();
    formStatus.setContent("");
    urlInput.focus();
};

//
// api calls
//

const fetchJobs = async () => {
    try {
        state.jobs = await (await fetch(`${API}/jobs`)).json();
        jobList.setItems(state.jobs.length > 0 ? state.jobs.map(formatJob) : ["No tables found - create one!"]);
        screen.render();
    } catch (err) {
        jobList.setItems([`Error: ${err}`]);
        screen.render();
    }
};
const fetchTable = async (id: number) => {
    try {
        state.tableData = await (await fetch(`${API}/jobs/${id}`)).json();
        tableView.setItems(state.tableData.length === 0 ? ["No data"] : formatTable(state.tableData));
        screen.render();
    } catch (err) {
        tableView.setItems([`Error: ${err}`]);
        screen.render();
    }
};
const submitJob = async () => {
    const url = urlInput.getValue();
    const fields = fieldsInput.getValue();
    if (!url || !fields) {
        formStatus.setContent("Error: Both URL and fields are required!");
        formStatus.style.fg = "red";
        screen.render();
        return;
    }
    const parsed = parseFields(fields);
    if (parsed.length === 0) {
        formStatus.setContent("Error: Please provide at least one field!");
        formStatus.style.fg = "red";
        screen.render();
        return;
    }
    try {
        formStatus.setContent("Submitting...");
        formStatus.style.fg = "yellow";
        screen.render();
        const res = await fetch(`${API}/jobs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, fields: parsed }) });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        formStatus.setContent("Success! Redirecting...");
        formStatus.style.fg = "green";
        screen.render();
        await fetchJobs();
        setTimeout(showList, 1000);
    } catch (err) {
        formStatus.setContent(`Error: ${err}`);
        formStatus.style.fg = "red";
        screen.render();
    }
};

//
// event handlers
//

jobList.on("select", async (_item, index) => {
    if (state.jobs[index]) {
        state.selectedId = state.jobs[index]!.id;
        await fetchTable(state.selectedId);
        showTable();
    }
});
urlInput.key(["enter"], () => fieldsInput.focus());
urlInput.key(["escape"], showList);
fieldsInput.key(["enter"], submitJob);
fieldsInput.key(["escape"], showList);
submitButton.on("press", submitJob);
screen.key(["n"], () => state.view === "list" && showForm());
screen.key(["escape"], () => state.view !== "list" && showList());
screen.key(["q", "C-c"], () => process.exit(0));

//
// bootstrap
//

await fetchJobs();
setInterval(fetchJobs, 3000);
jobList.focus();
screen.render();
