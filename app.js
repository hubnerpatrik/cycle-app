const STORAGE_KEY="cycleData";

let selectedDate=null;

function getStoredEntries(){

return JSON.parse(
localStorage.getItem(
STORAGE_KEY
)
)||[];

}

function saveEntries(entries){

localStorage.setItem(
STORAGE_KEY,
JSON.stringify(entries)
);

}

function formatDate(date){

return date
.toISOString()
.split("T")[0];

}

function calculateCycleDay(
currentDate,
entries
){

const periods=

entries
.filter(
e=>
e.bleeding==="menstruation"
)
.sort(
(a,b)=>
new Date(a.date)-
new Date(b.date)
);

if(periods.length===0){
return 1;
}

const lastStart=
new Date(
periods[
periods.length-1
].date
);

const current=
new Date(currentDate);

return Math.floor(
(current-lastStart)/
86400000
)+1;

}

function renderCalendar(){

const calendar=
document.getElementById(
"calendar"
);

calendar.innerHTML="";

const now=new Date();

const lastDay=
new Date(
now.getFullYear(),
now.getMonth()+1,
0
);

const entries=
getStoredEntries();

for(
let day=1;
day<=lastDay.getDate();
day++
){

const date=
new Date(
now.getFullYear(),
now.getMonth(),
day
);

const ds=
formatDate(date);

const entry=
entries.find(
e=>e.date===ds
);

const cell=
document.createElement(
"div"
);

cell.className="day";

cell.innerText=day;

if(entry){

if(
entry.bleeding===
"menstruation"
){
cell.style.background=
"#ef4444";
}

if(
entry.status===
"fertile"
){
cell.style.background=
"#eab308";
}

if(
entry.status===
"post"
){
cell.style.background=
"#22c55e";
}

}

cell.onclick=
()=>loadDayEntry(ds);

calendar.appendChild(
cell
);

}

}

function loadDayEntry(date){

selectedDate=date;

const entry=
getStoredEntries()
.find(
e=>e.date===date
);

document.getElementById(
"formTitle"
).innerText=
date+
" | Cycle day: "+
(entry?.cycleDay||"?");

document.getElementById(
"temperature"
).value=
entry?.temperature ?? "";


/* restore bleeding */

const bleeding=
entry?.bleeding || "none";

document.getElementById(
"bleeding"
).value=bleeding;

document
.querySelectorAll(
"#bleedingButtons button"
)
.forEach(
button=>{

button.classList.remove(
"active"
);

if(
button.textContent
.toLowerCase()
.includes(
bleeding==="menstruation"
?"period"
:bleeding
)
){
button.classList.add(
"active"
);
}

}
);


/* restore discharge */

const discharge=
entry?.discharge || "none";

document.getElementById(
"discharge"
).value=discharge;

document
.querySelectorAll(
"#dischargeButtons button"
)
.forEach(
button=>{

button.classList.remove(
"active"
);

if(
button.textContent
.toLowerCase()
===discharge
){
button.classList.add(
"active"
);
}

}
);

}
function setBleeding(
value,
event
){

document.getElementById(
"bleeding"
).value=value;

document
.querySelectorAll(
"#bleedingButtons button"
)
.forEach(
b=>
b.classList.remove(
"active"
)
);

event.target.classList.add(
"active"
);

}

function setDischarge(
value,
event
){

document.getElementById(
"discharge"
).value=value;

document
.querySelectorAll(
"#dischargeButtons button"
)
.forEach(
b=>
b.classList.remove(
"active"
)
);

event.target.classList.add(
"active"
);

}

function resetTestData(){

localStorage.clear();

location.reload();

}

function renderTemperatureChart(){

const chart=
document.getElementById(
"tempChart"
);

chart.innerHTML="";

const entries=

getStoredEntries()
.filter(
e=>e.temperature
);

if(
entries.length===0
){
return;
}

const width=500;
const height=220;

const svg=
document.createElementNS(
"http://www.w3.org/2000/svg",
"svg"
);

svg.setAttribute(
"width",
width
);

svg.setAttribute(
"height",
height
);

const points=[];

entries.forEach(
(entry,index)=>{

const x=
50+(index*70);

const y=
height-
(
(entry.temperature-36)
*120
);

points.push(
x+","+y
);

}
);

const line=
document.createElementNS(
"http://www.w3.org/2000/svg",
"polyline"
);

line.setAttribute(
"fill","none"
);

line.setAttribute(
"stroke","#22c55e"
);

line.setAttribute(
"stroke-width","3"
);

line.setAttribute(
"points",
points.join(" ")
);

svg.appendChild(line);


/* coverline */

if(
entries.length>=4
){

const cover=
36.55;

const y=
height-
(
(cover-36)*120
);

const cl=
document.createElementNS(
"http://www.w3.org/2000/svg",
"line"
);

cl.setAttribute(
"x1",30
);

cl.setAttribute(
"x2",470
);

cl.setAttribute(
"y1",y
);

cl.setAttribute(
"y2",y
);

cl.setAttribute(
"stroke",
"#f59e0b"
);

cl.setAttribute(
"stroke-dasharray",
"8,4"
);

svg.appendChild(cl);

}


/* points + labels */

entries.forEach(
(entry,index)=>{

const x=
50+(index*70);

const y=
height-
(
(entry.temperature-36)
*120
);

const dot=
document.createElementNS(
"http://www.w3.org/2000/svg",
"circle"
);

dot.setAttribute(
"cx",x
);

dot.setAttribute(
"cy",y
);

dot.setAttribute(
"r",5
);

dot.setAttribute(
"fill",
"#22c55e"
);

svg.appendChild(dot);


/* temp */

const t=
document.createElementNS(
"http://www.w3.org/2000/svg",
"text"
);

t.setAttribute(
"x",
x-12
);

t.setAttribute(
"y",
y-10
);

t.setAttribute(
"fill",
"white"
);

t.textContent=
entry.temperature;

svg.appendChild(t);


/* day */

const d=
document.createElementNS(
"http://www.w3.org/2000/svg",
"text"
);

d.setAttribute(
"x",
x-10
);

d.setAttribute(
"y",
210
);

d.setAttribute(
"fill",
"white"
);

d.textContent=
"D"+
entry.cycleDay;

svg.appendChild(d);

});

chart.appendChild(
svg
);

}

renderCalendar();

renderTemperatureChart();