import blessed from "blessed";

type Job = { id: number; createdAt: string; fields: Record<string, number> };
type Row = { id: number; [key: string]: string | number };

const API = process.env.API_URL || "http://localhost:3000";
const screen = blessed.screen({ smartCSR: true, title: "LLMFetch Database Browser" });

let jobs: Job[] = [];
let currentView: "list" | "table" = "list";
let selectedJobId: number | null = null;
let tableData: Row[] = [];

const header = blessed.box({
    top: 0,
    left: 0,
    width: "100%",
    height: 3,
    content: "{center}{bold}LLMFetch Database Browser{/bold}{/center}\n{center}q: quit | ↑↓: navigate | Enter: view table | ESC: back{/center}",
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

screen.append(header);
screen.append(jobList);
screen.append(tableView);
tableView.hide();

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
    tableView.hide();
    jobList.show();
    jobList.focus();
    screen.render();
}

function showTable() {
    currentView = "table";
    jobList.hide();
    tableView.show();
    tableView.focus();
    screen.render();
}

jobList.on("select", async (_item, index) => {
    if (jobs[index]) {
        selectedJobId = jobs[index]!.id;
        await fetchTable(selectedJobId);
        showTable();
    }
});

screen.key(["escape"], () => {
    if (currentView === "table") showList();
});

screen.key(["q", "C-c"], () => process.exit(0));

await fetchJobs();
setInterval(fetchJobs, 3000);
jobList.focus();
screen.render();
