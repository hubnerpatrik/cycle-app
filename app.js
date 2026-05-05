const qs = id => document.getElementById(id);
const qsa = sel => document.querySelectorAll(sel);
const DAY_WIDTH = 32;
const LABEL_WIDTH = 80;

/* utils */

function parseDateKey(key){
  const [y,m,d] = key.split("-").map(Number);
  return new Date(y, m-1, d);
}

function normalize(d){
  const n = new Date(d);
  n.setHours(0,0,0,0);
  return n;
}

function formatDateKey(date){
  const d = normalize(date);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function daysBetween(a, b){
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.floor((utcA - utcB) / 86400000);
}

function getDaysInMonth(y,m){
  return new Date(y, m+1, 0).getDate();
}

function getOffset(y,m){
  return (new Date(y,m,1).getDay()+6)%7;
}

function formatTemp(t){
  return t != null ? Number(t).toFixed(2) : "-";
}

/* validation */

function isValidTemp(t){
  return t == null || (t >= 34 && t <= 42);
}

function sanitizeModal(modal){
  return {
    temp: isValidTemp(modal.temp) ? modal.temp : null,
    bleeding: modal.bleeding || "none",
    discharge: modal.discharge || "none",
    peak: !!modal.peak
  };
}

function validateTempInput(){
  const raw = qs("tempInput")?.value.trim();
  if(raw === "") return true;

  const val = parseFloat(raw);
  return !isNaN(val) && isValidTemp(val);
}

/* store */

class Store{
  constructor(){
    this.data = JSON.parse(localStorage.getItem("cycleData")||"{}");
    this.selectedDate=null;

    const n=new Date();
    this.month=n.getMonth();
    this.year=n.getFullYear();

    this.modal={temp:null,bleeding:"none",discharge:"none",peak:false};

    this._cycleStarts=null;
  }

  save(){
    localStorage.setItem("cycleData",JSON.stringify(this.data));
    this._cycleStarts=null;
  }
}

const store=new Store();

/* cycle */

function getCycleStartDates(){
  return Object.keys(store.data)
    .filter(k => store.data[k]?.bleeding === "menstruation")
    .map(k => normalize(parseDateKey(k)))
    .sort((a,b)=>a-b);
}

function getCycleStartDatesCached(){
  if(!store._cycleStarts){
    store._cycleStarts = getCycleStartDates();
  }
  return store._cycleStarts;
}

function recalculateCycle(){
  store._cycleStarts = null;

  const starts = getCycleStartDatesCached();
  if(!starts.length) return;

  let cycleId = 0;

  starts.forEach((start, index)=>{
    cycleId++;

    const next = starts[index+1] || null;

    let d = new Date(start);
    let day = 1;
    let safety = 0;

    while((!next || d < next) && safety < 90){
      const key = formatDateKey(d);

      if(store.data[key]){
        store.data[key].cycleDay = day;
        store.data[key].cycleId = cycleId;
      }

      d.setDate(d.getDate()+1);
      day++;
      safety++;
    }
  });
}

/* ovulation */

function detectOvulation(cycleDays){
  const temps = cycleDays.map(d => d.temp);

  for(let i=6;i<temps.length-2;i++){
    const lows = temps.slice(i-6,i);
    const valid = lows.filter(t => t != null);

    if(valid.length < 4) continue;

    const maxLow = Math.max(...valid);
    const cover = maxLow + 0.05;

    const t1 = temps[i];
    const t2 = temps[i+1];
    const t3 = temps[i+2];

    if(t1 == null || t2 == null || t3 == null) continue;

    if(t1 > cover && t2 > cover && t3 > cover && t2 >= t1 && t3 >= t2){
      if(t3 - maxLow >= 0.2) return Math.max(0, i-1);

      const t4 = temps[i+3];
      if(t4 != null && t4 > cover) return Math.max(0, i-1);
    }
  }

  return null;
}

function getLastDataDate(){
  const keys = Object.keys(store.data);
  if(!keys.length) return null;

  const last = keys
    .map(k => parseDateKey(k))
    .sort((a,b)=>a-b)
    .pop();

  return normalize(last);
}

/* main calc */

function recalculateFertileFromTemps(){

  store._cycleStarts = null;

  const starts = getCycleStartDatesCached();
  if(!starts.length) return;

  const lastDataDate = getLastDataDate();
  if(!lastDataDate) return;

  const MAX = 90;

  starts.forEach((start, index)=>{

    const next = starts[index+1] || null;

    const cycleDays = [];
    let d = new Date(start);
    let safety = 0;

    while((!next ? d <= lastDataDate : d < next) && safety < MAX){

      const key = formatDateKey(d);

      cycleDays.push({
        date: new Date(d),
        key,
        temp: store.data[key]?.temp ?? null
      });

      d.setDate(d.getDate()+1);
      safety++;
    }

    cycleDays.forEach(day=>{
      if(store.data[day.key]){
        delete store.data[day.key].fertile;
      }
    });

    const ovulationIndex = detectOvulation(cycleDays);
    if(ovulationIndex == null) return;

    const ovulationDate = normalize(cycleDays[ovulationIndex].date);

    cycleDays.forEach(day=>{
      if(!store.data[day.key]) return;

      const diff = daysBetween(day.date, ovulationDate);

      if(diff >= -5 && diff <= 0){
        store.data[day.key].fertile = true;
      }
    });

  });
}

/* modal */

function openModal(){
  if(!store.selectedDate) return;

  const key = formatDateKey(store.selectedDate);
  const d = store.data[key] || {};

  store.modal = {
    temp: d.temp ?? null,
    bleeding: d.bleeding ?? "none",
    discharge: d.discharge ?? "none",
    peak: d.peak ?? false
  };

  const cd = d.cycleDay ?? "-";
  qs("modalTitle").innerText = `${key} (CD ${cd})`;

  qs("tempInput").value =
    store.modal.temp != null ? Number(store.modal.temp).toFixed(2) : "";

  updateUI();

  qs("modal").classList.remove("hidden");
  setTimeout(()=>qs("modal").classList.add("show"),10);
}

function closeModal(){
  qs("modal").classList.remove("show");
  setTimeout(()=>qs("modal").classList.add("hidden"),200);
}

function updateUI(){
  qsa(".segmented").forEach(g=>{
    const name=g.dataset.group;

    g.querySelectorAll("button").forEach(b=>{
      const v=b.dataset.value;

      b.classList.toggle(
        "active",
        name==="markers"
          ? store.modal[v]
          : store.modal[name]===v
      );
    });
  });
}

/* render */

function renderMonth(){
  qs("monthLabel").innerText =
    new Date(store.year, store.month)
      .toLocaleString("en-US", { month: "long", year: "numeric" });
}

function renderCalendar(){
  const el = qs("calendar");
  el.innerHTML = "";

  const days = getDaysInMonth(store.year, store.month);
  const off = getOffset(store.year, store.month);

  ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].forEach(d=>{
    const w = document.createElement("div");
    w.textContent = d;
    w.style.textAlign = "center";
    w.style.fontSize = "12px";
    w.style.opacity = "0.6";
    el.appendChild(w);
  });

  for(let i=0;i<off;i++){
    el.appendChild(document.createElement("div"));
  }

  for(let d=1; d<=days; d++){
    const date = new Date(store.year, store.month, d);
    const key = formatDateKey(date);
    const data = store.data[key];

    const div = document.createElement("div");
    div.className = "day";
    div.textContent = d;

    if(data?.bleeding === "menstruation") div.classList.add("red");
    else if(data?.fertile) div.classList.add("green");

    if(store.selectedDate && formatDateKey(store.selectedDate) === key){
      div.classList.add("selected");
    }

    const cd = data?.cycleDay;
    if(cd){
      const label = document.createElement("div");
      label.style.position = "absolute";
      label.style.top = "4px";
      label.style.right = "6px";
      label.style.fontSize = "10px";
      label.style.opacity = "0.6";
      label.textContent = cd;
      div.appendChild(label);
    }

    div.onclick = ()=>{
      store.selectedDate = date;
      render();
    };

    el.appendChild(div);
  }
}

function renderInfo(){
  if(!store.selectedDate){
    qs("infoTitle").innerText = "No day selected";
    qs("infoTemp").innerText = "-";
    qs("infoBleeding").innerText = "-";
    qs("infoDischarge").innerText = "-";
    return;
  }

  const key = formatDateKey(store.selectedDate);
  const d = store.data[key] || {};
  const cd = d.cycleDay ?? "-";

  qs("infoTitle").innerText = `${key} (CD ${cd})`;

  qs("infoTemp").innerText = formatTemp(d.temp);
  qs("infoBleeding").innerText = d.bleeding !== "none" ? d.bleeding : "-";
  qs("infoDischarge").innerText = d.discharge !== "none" ? d.discharge : "-";
}

function renderChart(){
  const canvas = qs("tempChart");
  if(!canvas) return;

  const ctx = canvas.getContext("2d");

  const dpr = window.devicePixelRatio || 1;
  canvas.width = canvas.offsetWidth * dpr;
  canvas.height = canvas.offsetHeight * dpr;

  ctx.setTransform(1,0,0,1,0,0);
  ctx.scale(dpr, dpr);

  ctx.clearRect(0,0,canvas.offsetWidth,canvas.offsetHeight);

  const paddingTop = 20;
  const paddingBottom = 30;

  const height = canvas.offsetHeight - paddingTop - paddingBottom;

  const minTemp = 36.0;
  const maxTemp = 37.5;

  const latest = Object.values(store.data)
    .filter(d => d.cycleId != null)
    .sort((a,b)=>b.cycleId - a.cycleId || b.cycleDay - a.cycleDay)[0];

  if(!latest) return;

  const days = Object.values(store.data)
    .filter(d => d.cycleId === latest.cycleId)
    .sort((a,b)=>a.cycleDay - b.cycleDay);

  if(!days.length) return;

  /* FIX: pevná šířka grafu */
  const totalWidth = LABEL_WIDTH + days.length * DAY_WIDTH;

  if(canvas.offsetWidth < totalWidth){
    canvas.style.width = totalWidth + "px";
  }

  const getX = i => LABEL_WIDTH + i * DAY_WIDTH + DAY_WIDTH/2;
  const getY = t => paddingTop + (maxTemp - t)/(maxTemp - minTemp) * height;

  /* fertile background */
  days.forEach((d,i)=>{
    if(d.fertile){
      const x = LABEL_WIDTH + i * DAY_WIDTH;
      ctx.fillStyle = "rgba(34,197,94,0.15)";
      ctx.fillRect(x, paddingTop, DAY_WIDTH, height);
    }
  });

  /* vertical grid */
  for(let i=0;i<=days.length;i++){
    const x = LABEL_WIDTH + i * DAY_WIDTH;

    ctx.beginPath();
    ctx.strokeStyle = i % 5 === 0 ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.05)";
    ctx.moveTo(x, paddingTop);
    ctx.lineTo(x, canvas.offsetHeight - paddingBottom);
    ctx.stroke();
  }

  /* horizontal grid */
  for(let t=minTemp; t<=maxTemp; t+=0.1){
    const y = getY(t);

    ctx.beginPath();
    ctx.strokeStyle = (Math.round(t*10) % 5 === 0)
      ? "rgba(0,0,0,0.2)"
      : "rgba(0,0,0,0.05)";

    ctx.moveTo(LABEL_WIDTH, y);
    ctx.lineTo(totalWidth, y);
    ctx.stroke();

    if(Math.round(t*10) % 5 === 0){
      ctx.fillStyle = "#6b7280";
      ctx.font = "11px Inter";
      ctx.fillText(t.toFixed(1), 5, y+3);
    }
  }

  /* line */
  ctx.beginPath();
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 2;

  let started = false;

  days.forEach((d,i)=>{
    if(d.temp == null) return;

    const x = getX(i);
    const y = getY(d.temp);

    if(!started){
      ctx.moveTo(x,y);
      started = true;
    }else{
      ctx.lineTo(x,y);
    }
  });

  ctx.stroke();

  /* points */
  days.forEach((d,i)=>{
    if(d.temp == null) return;

    const x = getX(i);
    const y = getY(d.temp);

    ctx.beginPath();
    ctx.arc(x,y,3,0,Math.PI*2);
    ctx.fillStyle = "#111";
    ctx.fill();
  });

  renderChartTable(days);
}

function renderChartTable(days){
  const el = qs("chartTable");
  if(!el) return;

  el.innerHTML = "";

  const rows = [
    {
      label: "Bleeding",
      get: d => d.bleeding === "menstruation" ? "●" : ""
    },
    {
      label: "Discharge",
      get: d => d.discharge?.[0]?.toUpperCase() || ""
    },
    {
      label: "Peak",
      get: d => d.peak ? "▲" : ""
    }
  ];

  rows.forEach(r=>{
    const row = document.createElement("div");
    row.className = "chart-row";

    row.style.display = "grid";
    row.style.gridTemplateColumns =
      `${LABEL_WIDTH}px repeat(${days.length}, ${DAY_WIDTH}px)`;

    const label = document.createElement("div");
    label.className = "chart-label";
    label.textContent = r.label;

    row.appendChild(label);

    days.forEach(d=>{
      const cell = document.createElement("div");
      cell.className = "chart-cell";

      const val = r.get(d);
      cell.textContent = val;

      if(r.label === "Bleeding" && val) cell.classList.add("red");
      if(r.label === "Peak" && val) cell.classList.add("active");

      row.appendChild(cell);
    });

    el.appendChild(row);
  });
}

function render(){
  renderMonth();
  renderCalendar();
  renderInfo();
  renderChart();

}

/* init */

function init(){

  qs("tempInput").oninput = validateTempInput;

  qs("prevMonth").onclick=()=>{
    store.month--;
    if(store.month<0){store.month=11;store.year--;}
    store.selectedDate=null;
    render();
  };

  qs("nextMonth").onclick=()=>{
    store.month++;
    if(store.month>11){store.month=0;store.year++;}
    store.selectedDate=null;
    render();
  };

  qs("editBtn").onclick=openModal;
  qs("closeBtn").onclick=closeModal;

  qs("saveBtn").onclick=()=>{
    if(!store.selectedDate) return;
    if(!validateTempInput()) return;

    const key=formatDateKey(store.selectedDate);
    const temp=parseFloat(qs("tempInput").value);

    store.modal.temp = isNaN(temp) ? null : temp;

    const clean = sanitizeModal(store.modal);

    store.data[key] = {
      ...(store.data[key] || {}),
      ...clean
    };

    recalculateCycle();
    recalculateFertileFromTemps();

    store.save();

    closeModal();

    setTimeout(()=>{
      render();
    }, 200);
  };

  qsa(".segmented button").forEach(b=>{
    b.onclick=()=>{
      const g=b.parentElement.dataset.group;
      const v=b.dataset.value;

      if(g==="markers") store.modal[v]=!store.modal[v];
      else store.modal[g]=v;

      updateUI();
    };
  });

  qs("devReset").onclick=resetApp;
}

function resetApp(){
  localStorage.removeItem("cycleData");
  store.data = {};
  store.selectedDate = null;
  store._cycleStarts = null;

  const n = new Date();
  store.month = n.getMonth();
  store.year = n.getFullYear();

  render();
}

document.addEventListener("DOMContentLoaded",()=>{
  recalculateCycle();
  recalculateFertileFromTemps();
  init();
  render();
});