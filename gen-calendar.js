/**
 * Genererer data.json for dashbordet fra Google Calendar-avtaler.
 * KILDEDATA er hentet via Google Calendar MCP (ekte avtaler — ingen oppdiktede).
 * Recurring-rutiner og flerdags heldags-avtaler ekspanderes til konkrete datoer.
 * Kjør på nytt (manuelt eller via daglig rutine) for å friske opp kalenderen.
 *
 * Øyeblikksbilde generert: 2026-05-31. data.json er ferskvare — regenerer ved behov.
 */

const WINDOW_START = "2026-05-31";
const WINDOW_END   = "2026-07-14"; // inklusiv

// --- Ekte kildedata fra Google Calendar (oppdateres ved hver kjøring) ---
const SINGLE = [
  // SPO4100 muntlig eksamen (individuell semesteroppgave m/ muntlig justering)
  { date: "2026-06-10", time: "09:00", text: "SPO4100 muntlig eksamen" },
  { date: "2026-06-11", time: "09:00", text: "SPO4100 muntlig eksamen" },
  { date: "2026-06-12", time: "09:00", text: "SPO4100 muntlig eksamen" },
];
// flerdags heldags-avtaler: [startdato inkl, sluttdato EKSL, tekst]
const MULTI = [
  { start: "2026-06-19", endExcl: "2026-06-23", text: "Hemsedal" },
];
// recurring: dtstart, regel
const RECUR = [
  { from: "2026-05-31", time: "07:00", text: "Priming", freq: "DAILY" },
];

// --- Ekspansjon ---
function ymd(d){return d.toISOString().slice(0,10);}
function eachDay(startStr, endStr, cb){
  const end = new Date(endStr+"T00:00:00Z");
  for(let d=new Date(startStr+"T00:00:00Z"); d<=end; d.setUTCDate(d.getUTCDate()+1)) cb(new Date(d));
}
const events = {};
let n = 0;
function add(date, time, text){
  if(date < WINDOW_START || date > WINDOW_END) return;
  (events[date] ||= []).push({ id: "a_"+(n++), text, time: time||"", auto: true });
}

SINGLE.forEach(e => add(e.date, e.time, e.text));
MULTI.forEach(e => {
  const lastIncl = new Date(e.endExcl+"T00:00:00Z"); lastIncl.setUTCDate(lastIncl.getUTCDate()-1);
  eachDay(e.start, ymd(lastIncl), d => add(ymd(d), "", e.text));
});
RECUR.forEach(r => {
  const start = r.from < WINDOW_START ? WINDOW_START : r.from;
  eachDay(start, WINDOW_END, d => {
    const dow = d.getUTCDay(); // 0=sø
    if(r.freq === "DAILY") add(ymd(d), r.time, r.text);
    else if(r.freq === "WEEKLY" && r.byday.includes(dow === 0 ? 7 : dow)) add(ymd(d), r.time, r.text);
  });
});

// sorter hver dag på tid
for(const k in events) events[k].sort((a,b)=>(a.time||"99").localeCompare(b.time||"99"));

const out = { generated: WINDOW_START, source: "google-calendar", events };
require("fs").writeFileSync(__dirname + "/data.json", JSON.stringify(out, null, 1));
console.log("data.json skrevet:", Object.keys(events).length, "dager,", n, "hendelser");
