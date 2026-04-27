const qs = id => document.getElementById(id);
const qsa = sel => document.querySelectorAll(sel);

class Store {
  constructor(){
    this.data = JSON.parse(localStorage.getItem("cycleData") || "{}");
    this.selectedDay = null;
    this.rangeStart = null;
    this.rangeEnd = null;

    this.modalState = {
      temp: "",
      bleeding: "none",
      discharge: "none",
      peak: false
    };
  }

  save(){
    localStorage.setItem("cycleData", JSON.stringify(this.data));
  }

  reset(){
    localStorage.removeItem("cycleData");
    this.data = {};
  }
}

const store = new Store();

/* ================= CALENDAR ================= */
function renderCalendar(){
  const el = qs("calendar");
  el.innerHTML="";

  for(let i=1;i<=30;i++){
    const d = store.data[i];
    const div = document.createElement("div");

    div.className="day";
    div.textContent=i;

    if(d?.bleeding==="menstruation") div.classList.add("red");
    else if(d?.fertile) div.classList.add("green");
    else if(d) div.classList.add("yellow");

    if(store.selectedDay===i) div.classList.add("selected");

    if(d?.peak){
      const mark = document.createElement("div");
      mark.style.width = "6px";
      mark.style.height = "6px";
      mark.style.background = "#a855f7";
      mark.style.borderRadius = "50%";
      mark.style.position = "absolute";
      mark.style.bottom = "6px";

      div.style.position = "relative";
      div.appendChild(mark);
    }

    div.onclick=()=>{
      store.selectedDay=i;
      render();
    };

    el.appendChild(div);
  }
}

/* ================= INFO ================= */
function renderInfo(){
  if(!store.selectedDay){
    qs("infoTitle").innerText="No day selected";
    qs("infoTemp").innerText="-";
    qs("infoBleeding").innerText="-";
    qs("infoDischarge").innerText="-";
    return;
  }

  const d = store.data[store.selectedDay] || {};

  qs("infoTitle").innerText="Day "+store.selectedDay;
  qs("infoTemp").innerText=d.temp || "-";
  qs("infoBleeding").innerText=d.bleeding || "-";
  qs("infoDischarge").innerText=d.discharge || "-";
}

/* ================= CHART ================= */
function renderChart(){
  const canvas = qs("tempChart");
  const ctx = canvas.getContext("2d");

  const dpr = window.devicePixelRatio || 1;

  canvas.width = canvas.offsetWidth * dpr;
  canvas.height = canvas.offsetHeight * dpr;

  ctx.setTransform(1,0,0,1,0,0);
  ctx.scale(dpr, dpr);

  ctx.clearRect(0,0,canvas.width,canvas.height);

  const paddingLeft = 50;
  const paddingBottom = 30;
  const paddingTop = 20;
  const paddingRight = 20;

  const width = canvas.offsetWidth - paddingLeft - paddingRight;
  const height = canvas.offsetHeight - paddingTop - paddingBottom;

  const minTemp = 36.0;
  const maxTemp = 37.5;

  const stepX = width / 30;

  const getX = d => paddingLeft + (d - 0.5) * stepX;
  const getY = t => paddingTop + (maxTemp - t)/(maxTemp - minTemp) * height;

  /* ===== FERTILE BACKGROUND ===== */
  for(let i=1;i<=30;i++){
    const d = store.data[i];
    if(d?.fertile){
      const x = paddingLeft + (i-1)*stepX;
      ctx.fillStyle = "rgba(30, 187, 82, 0.26)";
      ctx.fillRect(x, paddingTop, stepX, height);
    }
  }

  /* GRID */
  for(let i=0;i<=30;i++){
    const x = paddingLeft + i * stepX;
    const isMajor = i % 5 === 0;

    ctx.beginPath();
    ctx.strokeStyle = isMajor ? "rgba(0,0,0,0.18)" : "rgba(0,0,0,0.06)";
    ctx.lineWidth = isMajor ? 2 : 2;

    ctx.moveTo(x, paddingTop);
    ctx.lineTo(x, canvas.offsetHeight - paddingBottom);
    ctx.stroke();
  }

  for(let t = minTemp; t <= maxTemp; t += 0.1){
    const y = getY(t);
    const isMajor = Math.abs((t * 10) % 5) < 0.001;

    ctx.beginPath();
    ctx.strokeStyle = isMajor ? "rgba(0,0,0,0.18)" : "rgba(0,0,0,0.06)";
    ctx.lineWidth = isMajor ? 2 : 2;

    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(canvas.offsetWidth - paddingRight, y);
    ctx.stroke();
  }

  /* Y LABELS */
  ctx.fillStyle = "#374151";
  ctx.font = "12px Inter";

  for(let t = minTemp; t <= maxTemp; t += 0.2){
    const y = getY(t);
    ctx.fillText(t.toFixed(1), 5, y+4);
  }

  /* DATA */
  const points = [];

  for(let i=1;i<=30;i++){
    const d = store.data[i];
    if(!d?.temp) continue;

    let raw = parseFloat(d.temp.replace(",","."));
    if(raw < 10) raw += 36;

    points.push({
      x: getX(i),
      y: getY(raw),
      day: i,
      data: d
    });
  }

  /* LINE */
  if(points.length > 1){
    ctx.beginPath();
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 1.5;

    ctx.moveTo(points[0].x, points[0].y);

    for(let i=1;i<points.length;i++){
      ctx.lineTo(points[i].x, points[i].y);
    }

    ctx.stroke();
  }

  /* POINTS */
 points.forEach(p => {

  const isSelected = p.day === store.selectedDay;

  /* MAIN POINT */
  ctx.beginPath();
  ctx.fillStyle = isSelected ? "#2563eb" : "#111";
  ctx.arc(p.x, p.y, isSelected ? 4.5 : 3, 0, Math.PI*2);
  ctx.fill();

  /* SELECTED RING */
  if(isSelected){
    ctx.beginPath();
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 2;
    ctx.arc(p.x, p.y, 8, 0, Math.PI*2);
    ctx.stroke();
  }

  /* PEAK */
  if(p.data.peak){
    ctx.beginPath();
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 2;
    ctx.arc(p.x, p.y, isSelected ? 10 : 8, 0, Math.PI*2);
    ctx.stroke();
  }
});
  /* X LABELS */
  ctx.fillStyle = "#6b7280";
  ctx.font = "11px Inter";
  ctx.textAlign = "center";

  for(let i=1;i<=30;i++){
    const x = getX(i);
    ctx.fillText(i, x, canvas.offsetHeight - 4);
  }

  /* TOOLTIP */
  const tooltip = qs("chartTooltip");

canvas.onmousemove = (e)=>{
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  const hit = points.find(p =>
    Math.hypot(p.x - mx, p.y - my) < 10
  );

  if(hit){
    tooltip.style.opacity = 1;

    tooltip.style.left = e.clientX + "px";
    tooltip.style.top = e.clientY + "px";

    tooltip.innerHTML = `
      Day ${hit.day}<br>
      Temp: ${hit.data.temp || "-"}<br>
      Bleeding: ${hit.data.bleeding || "-"}<br>
      Discharge: ${hit.data.discharge || "-"}<br>
      Peak: ${hit.data.peak ? "yes" : "no"}
    `;
  } else {
    tooltip.style.opacity = 0;
  }
};

canvas.onmouseleave = ()=>{
  tooltip.style.opacity = 0;
};

  /* CLICK SELECT */
  canvas.onclick = (e)=>{
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;

    const day = Math.round((x - paddingLeft) / stepX + 1);

    if(day >=1 && day <=30){
      store.selectedDay = day;
      render();
    }
  };
}

/* ================= MODAL ================= */
function openModal(){
  if(!store.selectedDay) return;

  const d = store.data[store.selectedDay] || {};

  store.modalState = {
    temp: d.temp || "",
    bleeding: d.bleeding || "none",
    discharge: d.discharge || "none",
    peak: d.peak || false
  };

  qs("tempInput").value = store.modalState.temp;
  updateSegmentedUI();

  qs("modalTitle").innerText = "Edit Day " + store.selectedDay;

  qs("modal").classList.remove("hidden");
  setTimeout(()=>qs("modal").classList.add("show"),10);
}

function closeModal(){
  qs("modal").classList.remove("show");
  setTimeout(()=>qs("modal").classList.add("hidden"),200);
}

qsa(".segmented button").forEach(btn=>{
  btn.onclick=()=>{
    const group = btn.parentElement.dataset.group;
    const val = btn.dataset.value;

    if(group==="markers"){
      store.modalState[val] = !store.modalState[val];
    } else {
      store.modalState[group] = val;
    }

    updateSegmentedUI();
  };
});

function updateSegmentedUI(){
  qsa(".segmented").forEach(group=>{
    const name = group.dataset.group;

    group.querySelectorAll("button").forEach(btn=>{
      const val = btn.dataset.value;

      let active = false;

      if(name==="markers"){
        active = store.modalState[val];
      } else {
        active = store.modalState[name] === val;
      }

      btn.classList.toggle("active", active);
    });
  });
}

qs("saveBtn").onclick=()=>{
  if(!store.selectedDay) return;

  store.modalState.temp = qs("tempInput").value;

  store.data[store.selectedDay] = {
    ...store.data[store.selectedDay],
    ...store.modalState
  };

  store.save();
  closeModal();
  render();
};

/* ================= RANGE ================= */
function openRange(){
  store.rangeStart=null;
  store.rangeEnd=null;

  qs("rangeModal").classList.remove("hidden");
  setTimeout(()=>qs("rangeModal").classList.add("show"),10);

  renderRange();
}

function renderRange(){
  const grid=qs("rangeCalendar");
  grid.innerHTML="";

  for(let i=1;i<=30;i++){
    const el=document.createElement("div");
    el.className="range-day";
    el.textContent=i;

    if(
      store.rangeStart &&
      store.rangeEnd &&
      i>=Math.min(store.rangeStart,store.rangeEnd) &&
      i<=Math.max(store.rangeStart,store.rangeEnd)
    ){
      el.classList.add("in-range");
    }

    if(i===store.rangeStart || i===store.rangeEnd){
      el.classList.add("edge");
    }

    el.onclick=()=>{
      clickRange(i);
      renderRange();
    };

    grid.appendChild(el);
  }

  qs("rangeFrom").innerText = store.rangeStart || "-";
  qs("rangeTo").innerText = store.rangeEnd || "-";
}

function clickRange(day){
  if(!store.rangeStart){
    store.rangeStart=day;
  } else if(!store.rangeEnd){
    store.rangeEnd=day;
  } else{
    store.rangeStart=day;
    store.rangeEnd=null;
  }
}

qs("confirmRangeBtn").onclick=()=>{
  if(!store.rangeStart || !store.rangeEnd) return;

  const start = Math.min(store.rangeStart, store.rangeEnd);
  const end = Math.max(store.rangeStart, store.rangeEnd);

  for(let i=1;i<=30;i++){
    if(!store.data[i]) store.data[i]={};
    store.data[i].fertile = (i>=start && i<=end);
  }

  store.save();
  closeRange();
  render();
};

function closeRange(){
  qs("rangeModal").classList.remove("show");
  setTimeout(()=>qs("rangeModal").classList.add("hidden"),200);
}

/* ================= DEV ================= */
qs("resetBtn").onclick=()=>{
  store.reset();
  render();
};

qs("seedBtn").onclick=()=>{
  store.data = {};
  for(let i=1;i<=30;i++){
    store.data[i] = {
      temp: (36 + Math.random()).toFixed(2)
    };
  }
  store.save();
  render();
};

/* ================= EVENTS ================= */
qs("editBtn").onclick=openModal;
qs("closeBtn").onclick=closeModal;

qs("rangeBtn").onclick=openRange;
qs("closeRangeBtn").onclick=closeRange;

/* ================= RENDER ================= */
function render(){
  renderCalendar();
  renderInfo();
  renderChart();
}

render();