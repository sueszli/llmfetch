import blessed from "blessed";

type Job = { id: number; createdAt: string; fields: Record<string, number> };
type Row = { id: number; [key: string]: string | number };

const API = process.env.API_URL || "http://localhost:3000";
const screen = blessed.screen({ smartCSR: true, title: "LLMFetch Database Browser" });

let jobs: Job[] = [];
let currentView: "list" | "table" | "form" = "list";
let selectedJobId: number | null = null;
let tableData: Row[] = [];

const header = blessed.box({
    top: 0,
    left: 0,
    width: "100%",
    height: 3,
    content: "{center}{bold}LLMFetch Database Browser{/bold}{/center}\n{center}q: quit | n: new job | ↑↓: navigate | Enter: select | ESC: back{/center}",
    tags: true,
    style: { fg: "white", bg: "blue" },
});

const jobList = blessed.list({
    top: 3,
    left: 0,
    width: "100%",
    height: "100%-3",
    keys: true,
    vi: true,
    mouse: true,
    style: { selected: { bg: "blue", fg: "white" }, item: { fg: "green" } },
    border: { type: "line" },
    label: " Available Tables ",
});

const tableView = blessed.list({
    top: 3,
    left: 0,
    width: "100%",
    height: "100%-3",
    keys: true,
    vi: true,
    mouse: true,
    scrollable: true,
    scrollbar: { ch: " ", style: { bg: "blue" } },
    style: { selected: { bg: "blue", fg: "white" }, item: { fg: "white" } },
    border: { type: "line" },
    label: " Table Data ",
});

const formBox = blessed.form({
    top: 3,
    left: "center",
    width: "80%",
    height: 18,
    border: { type: "line" },
    label: " Create New Job ",
    style: { border: { fg: "blue" } },
    keys: true,
});

const urlLabel = blessed.text({
    top: 1,
    left: 2,
    content: "URL:",
    style: { fg: "white", bold: true },
});

const urlInput = blessed.textbox({
    top: 2,
    left: 2,
    width: "100%-4",
    height: 3,
    inputOnFocus: true,
    style: {
        fg: "white",
        bg: "black",
        focus: { fg: "white", bg: "black" },
        border: { fg: "cyan" },
    },
    border: { type: "line" },
});

const fieldsLabel = blessed.text({
    top: 5,
    left: 2,
    content: "Fields (comma-separated, e.g., field1,field2,field3):",
    style: { fg: "white", bold: true },
});
const fieldsInput = blessed.textbox({
    top: 6,
    left: 2,
    width: "100%-4",
    height: 3,
    inputOnFocus: true,
    style: {
        fg: "white",
        bg: "black",
        focus: { fg: "white", bg: "black" },
        border: { fg: "cyan" },
    },
    border: { type: "line" },
});

const submitButton = blessed.button({
    top: 10,
    left: "center",
    width: 20,
    height: 3,
    content: "Submit (Enter)",
    align: "center",
    valign: "middle",
    style: { fg: "white", bg: "green", focus: { bg: "blue" } },
    border: { type: "line" },
});

const formStatus = blessed.text({
    top: 13,
    left: 2,
    width: "100%-4",
    height: 1,
    content: "",
    style: { fg: "yellow" },
});

formBox.append(urlLabel);
formBox.append(urlInput);
formBox.append(fieldsLabel);
formBox.append(fieldsInput);
formBox.append(submitButton);
formBox.append(formStatus);

screen.append(header);
screen.append(jobList);
screen.append(tableView);
screen.append(formBox);
tableView.hide();
formBox.hide();

async function fetchJobs() {
    try {
        const res = await fetch(`${API}/jobs`);
        jobs = await res.json();
        const items = jobs.map((j) => {
            const fieldsList = Object.entries(j.fields)
                .map(([k, v]) => `${k}:${v}`)
                .join(", ");
            return `[${j.id}] ${new Date(j.createdAt).toLocaleString()} | ${fieldsList || "empty"}`;
        });
        jobList.setItems(items.length > 0 ? items : ["No tables found - create one!"]);
        screen.render();
    } catch (err) {
        jobList.setItems([`Error: ${err}`]);
        screen.render();
    }
}

async function fetchTable(id: number) {
    try {
        const res = await fetch(`${API}/jobs/${id}`);
        tableData = await res.json();
        if (tableData.length === 0) {
            tableView.setItems(["No data"]);
        } else {
            const headers = Object.keys(tableData[0]!);
            const lines = [headers.map((h) => h.padEnd(20)).join(" | "), "-".repeat(headers.length * 23), ...tableData.map((row) => headers.map((h) => String(row[h] || "").padEnd(20)).join(" | "))];
            tableView.setItems(lines);
        }
        screen.render();
    } catch (err) {
        tableView.setItems([`Error: ${err}`]);
        screen.render();
    }
}

function showList() {
    currentView = "list";
    // Hide all other views
    tableView.hide();
    formBox.hide();
    // Show and focus list
    jobList.show();
    jobList.focus();
    screen.render();
}

function showTable() {
    currentView = "table";
    // Hide all other views
    jobList.hide();
    formBox.hide();
    // Show and focus table
    tableView.show();
    tableView.focus();
    screen.render();
}

function showForm() {
    currentView = "form";
    // Hide all other views
    jobList.hide();
    tableView.hide();
    // Clear form fields
    urlInput.clearValue();
    fieldsInput.clearValue();
    formStatus.setContent("");
    // Show and focus form
    formBox.show();
    urlInput.focus();
    screen.render();
}

async function submitForm() {
    const url = urlInput.getValue();
    const fieldsStr = fieldsInput.getValue();

    if (!url || !fieldsStr) {
        formStatus.setContent("Error: Both URL and fields are required!");
        formStatus.style.fg = "red";
        screen.render();
        return;
    }

    const fields = fieldsStr
        .split(",")
        .map((f) => f.trim())
        .filter((f) => f.length > 0);

    if (fields.length === 0) {
        formStatus.setContent("Error: Please provide at least one field!");
        formStatus.style.fg = "red";
        screen.render();
        return;
    }

    try {
        formStatus.setContent("Submitting...");
        formStatus.style.fg = "yellow";
        screen.render();

        const res = await fetch(`${API}/jobs`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url, fields }),
        });

        if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        formStatus.setContent("Success! Redirecting...");
        formStatus.style.fg = "green";
        screen.render();

        await fetchJobs();
        setTimeout(() => showList(), 1000);
    } catch (err) {
        formStatus.setContent(`Error: ${err}`);
        formStatus.style.fg = "red";
        screen.render();
    }
}

jobList.on("select", async (_item, index) => {
    if (jobs[index]) {
        selectedJobId = jobs[index]!.id;
        await fetchTable(selectedJobId);
        showTable();
    }
});

urlInput.key(["enter"], () => {
    fieldsInput.focus();
});

urlInput.key(["escape"], () => {
    showList();
});

fieldsInput.key(["enter"], async () => {
    await submitForm();
});

fieldsInput.key(["escape"], () => {
    showList();
});

submitButton.on("press", async () => {
    await submitForm();
});

screen.key(["n"], () => {
    if (currentView === "list") showForm();
});

screen.key(["escape"], () => {
    if (currentView === "table") showList();
    if (currentView === "form") showList();
});

screen.key(["q", "C-c"], () => process.exit(0));

await fetchJobs();
setInterval(fetchJobs, 3000);
jobList.focus();
screen.render();
