const STORAGE_KEY = "cycleData";

let selectedDate = null;


/* ===== STORAGE ===== */

function getStoredEntries() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
        return [];
    }
}

function saveEntries(entries) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}


/* ===== UTIL ===== */

function formatDate(date) {
    return date.toISOString().split("T")[0];
}

function findEntry(entries, date) {
    return entries.find(e => e.date === date);
}

function sortEntries(entries) {
    return entries.sort((a, b) => new Date(a.date) - new Date(b.date));
}


/* ===== CYCLE ===== */

function calculateCycleDay(currentDate, entries) {

    const periods = entries
        .filter(e => e.bleeding === "menstruation")
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    if (periods.length === 0) return 1;

    const lastStart = new Date(periods[periods.length - 1].date);
    const current = new Date(currentDate);

    return Math.floor((current - lastStart) / 86400000) + 1;
}


/* ===== STATUS LOGIC ===== */

function getStatus(entry, entries) {

    if (entry.bleeding === "menstruation") {
        return "period";
    }

    const index = entries.findIndex(e => e.date === entry.date);

    const prevDays = entries.slice(Math.max(0, index - 3), index);

    const hadWetBefore = prevDays.some(e => e.discharge === "wet");

    if (entry.discharge === "wet") {
        return "fertile";
    }

    if (hadWetBefore && entry.temperature && entry.temperature >= 36.7) {
        return "post";
    }

    return "post";
}


/* ===== CALENDAR ===== */

function renderCalendar() {

    const calendar = document.getElementById("calendar");
    calendar.innerHTML = "";

    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const entries = getStoredEntries();

    for (let day = 1; day <= lastDay.getDate(); day++) {

        const date = new Date(now.getFullYear(), now.getMonth(), day);
        const ds = formatDate(date);
        const entry = findEntry(entries, ds);

        const cell = document.createElement("div");
        cell.className = "day";
        cell.innerText = day;

        if (entry) {

            if (entry.bleeding === "menstruation") {
                cell.style.background = "#ef4444";
            } else if (entry.status === "fertile") {
                cell.style.background = "#eab308";
            } else if (entry.status === "post") {
                cell.style.background = "#22c55e";
            }
        }

        cell.onclick = () => loadDayEntry(ds);
        calendar.appendChild(cell);
    }
}


/* ===== LOAD ===== */

function loadDayEntry(date) {

    selectedDate = date;

    const entry = findEntry(getStoredEntries(), date);

    document.getElementById("formTitle").innerText =
        date + " | Cycle day: " + (entry?.cycleDay || "?");

    document.getElementById("temperature").value =
        entry?.temperature ?? "";

    restoreBleeding(entry);
    restoreDischarge(entry);
    updateSummary(entry);
}


/* ===== FORM ===== */

function restoreBleeding(entry) {

    const bleeding = entry?.bleeding || "none";

    document.getElementById("bleeding").value = bleeding;

    document.querySelectorAll("#bleedingButtons button")
        .forEach(button => {

            button.classList.remove("active");

            const label = button.textContent.trim().toLowerCase();

            if (label.includes(
                bleeding === "menstruation" ? "period" : bleeding
            )) {
                button.classList.add("active");
            }
        });
}

function restoreDischarge(entry) {

    const discharge = entry?.discharge || "none";

    document.getElementById("discharge").value = discharge;

    document.querySelectorAll("#dischargeButtons button")
        .forEach(button => {

            button.classList.remove("active");

            if (button.textContent.trim().toLowerCase() === discharge) {
                button.classList.add("active");
            }
        });
}


/* ===== SUMMARY ===== */

function updateSummary(entry) {

    const el = document.getElementById("daySummary");

   if (!entry) {
    el.innerText = "No data yet — add entry and save";
    return;
}

    el.innerText =
        `Bleeding: ${entry.bleeding} | Discharge: ${entry.discharge}`;
}


/* ===== BUTTONS ===== */

function setBleeding(value, event) {

    document.getElementById("bleeding").value = value;

    document.querySelectorAll("#bleedingButtons button")
        .forEach(b => b.classList.remove("active"));

    event.target.classList.add("active");
}

function setDischarge(value, event) {

    document.getElementById("discharge").value = value;

    document.querySelectorAll("#dischargeButtons button")
        .forEach(b => b.classList.remove("active"));

    event.target.classList.add("active");
}


/* ===== SAVE ===== */

function saveDayEntry() {

    if (!selectedDate) {
        alert("Vyber den v kalendáři");
        return;
    }

    let entries = getStoredEntries();

    const temperature = document.getElementById("temperature").value;
    const bleeding = document.getElementById("bleeding").value;
    const discharge = document.getElementById("discharge").value;

    const cycleDay = calculateCycleDay(selectedDate, entries);

    const newEntry = {
        date: selectedDate,
        temperature: temperature ? parseFloat(temperature) : null,
        bleeding,
        discharge,
        cycleDay,
        status: null
    };

    const index = entries.findIndex(e => e.date === selectedDate);

    if (index > -1) {
        entries[index] = newEntry;
    } else {
        entries.push(newEntry);
    }

    entries = sortEntries(entries);

    entries.forEach(e => {
        e.status = getStatus(e, entries);
    });

    saveEntries(entries);

    renderCalendar();
    renderTemperatureChart();
}


/* ===== RESET ===== */

function resetTestData() {
    localStorage.clear();
    location.reload();
}


/* ===== CHART ===== */

function renderTemperatureChart() {

    const chart = document.getElementById("tempChart");
    chart.innerHTML = "";

    const entries = getStoredEntries()
        .filter(e => e.temperature);

    if (entries.length === 0) return;

    const width = 500;
    const height = 220;

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", width);
    svg.setAttribute("height", height);

    const points = [];

    entries.forEach((entry, index) => {

        const x = 50 + (index * 70);
        const y = height - ((entry.temperature - 36) * 120);

        points.push(`${x},${y}`);
    });

    const line = document.createElementNS("http://www.w3.org/2000/svg", "polyline");

    line.setAttribute("fill", "none");
    line.setAttribute("stroke", "#22c55e");
    line.setAttribute("stroke-width", "3");
    line.setAttribute("points", points.join(" "));

    svg.appendChild(line);

    if (entries.length >= 4) {

        const cover = 36.55;
        const y = height - ((cover - 36) * 120);

        const cl = document.createElementNS("http://www.w3.org/2000/svg", "line");

        cl.setAttribute("x1", 30);
        cl.setAttribute("x2", 470);
        cl.setAttribute("y1", y);
        cl.setAttribute("y2", y);
        cl.setAttribute("stroke", "#f59e0b");
        cl.setAttribute("stroke-dasharray", "8,4");

        svg.appendChild(cl);
    }

    entries.forEach((entry, index) => {

        const x = 50 + (index * 70);
        const y = height - ((entry.temperature - 36) * 120);

        const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        dot.setAttribute("cx", x);
        dot.setAttribute("cy", y);
        dot.setAttribute("r", 5);
        dot.setAttribute("fill", "#22c55e");

        svg.appendChild(dot);

        const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
        t.setAttribute("x", x - 12);
        t.setAttribute("y", y - 10);
        t.setAttribute("fill", "white");
        t.textContent = entry.temperature;

        svg.appendChild(t);

        const d = document.createElementNS("http://www.w3.org/2000/svg", "text");
        d.setAttribute("x", x - 10);
        d.setAttribute("y", 210);
        d.setAttribute("fill", "white");
        d.textContent = "D" + entry.cycleDay;

        svg.appendChild(d);
    });

    chart.appendChild(svg);
}


/* ===== INIT ===== */

renderCalendar();
renderTemperatureChart();