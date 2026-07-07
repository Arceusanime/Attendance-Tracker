/**
 * ATTENDANCE TRACKER — src/index.jsx
 * Entry: src/main.jsx → import App from './index.jsx'
 *
 * Setup:
 *   1. npm install   (installs everything in package.json)
 *   2. Fill firebaseConfig below with your project values
 *   3. npm run dev
 */

import { useState, useMemo, useEffect, useRef } from "react";
import "./App.css";

// ─── Firebase v10 ────────────────────────────────────────────────
import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";

// ── Paste your Firebase config here ──────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyA8O-eoAJ3SqF5zDh66iLF_h7VGNIdiJaw",
  authDomain: "attendence-f0cbd.firebaseapp.com",
  projectId: "attendence-f0cbd",
  storageBucket: "attendence-f0cbd.firebasestorage.app",
  messagingSenderId: "897068110536",
  appId: "1:897068110536:web:15c7a49f5de8c9ef44cbfd"
};

// Safe init — won't crash if config is still placeholder
const hasFirebaseConfig = ({ apiKey, authDomain, projectId, appId }) =>
  [apiKey, authDomain, projectId, appId].every(value =>
    typeof value === "string" && value.trim() && !value.startsWith("YOUR_")
  );

let db = null;
try {
  if (hasFirebaseConfig(firebaseConfig)) {
    const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    db = getFirestore(app);
  }
} catch (e) {
  console.warn("Firebase init failed:", e.message);
}

const PRESETS_COL = "college_presets";

async function dbSavePreset(name, description, holidays) {
  if (!db) throw new Error("Firebase not initialised");
  const id = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
  await setDoc(doc(db, PRESETS_COL, id), {
    name: name.trim(),
    description: description.trim(),
    holidays: [...holidays].sort(),
    updatedAt: new Date().toISOString().slice(0, 10),
  });
}

async function dbListPresets() {
  if (!db) throw new Error("Firebase not initialised");
  const snap = await getDocs(query(collection(db, PRESETS_COL), orderBy("name")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

const isFirebaseConfigured = () => !!db;

// ─── Constants ───────────────────────────────────────────────────
const DAY_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const WEEKDAYS  = [
  { key:1, short:"Mon", full:"Monday"    },
  { key:2, short:"Tue", full:"Tuesday"   },
  { key:3, short:"Wed", full:"Wednesday" },
  { key:4, short:"Thu", full:"Thursday"  },
  { key:5, short:"Fri", full:"Friday"    },
  { key:6, short:"Sat", full:"Saturday"  },
];
const STEPS = ["Schedule","Setup","Results"];

// ─── Pure helpers ────────────────────────────────────────────────
const isoToday = () => new Date().toISOString().slice(0, 10);

function getDatesInRange(start, end) {
  const out = [], cur = new Date(start), last = new Date(end);
  while (cur <= last) { out.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }
  return out;
}
const isHoliday = (date, hDates) =>
  hDates.includes(date.toISOString().slice(0, 10));

function workingDaysInRange(start, end, schedule, hDates) {
  return getDatesInRange(start, end).filter(d => {
    const dow = d.getDay();
    return dow !== 0 && (schedule[dow] || 0) > 0 && !isHoliday(d, hDates);
  });
}
const totalClassesFor = (days, sch) =>
  days.reduce((s, d) => s + (sch[d.getDay()] || 0), 0);

const fmt = n => (Number.isFinite(n) ? n.toFixed(1) : "0.0");

function avgPeriodsPerDay(schedule) {
  const vals = Object.values(schedule).filter(v => v > 0);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 1;
}
const classesToDays = (count, sch) =>
  Math.ceil(count / (avgPeriodsPerDay(sch) || 1));

// ─── Icons ───────────────────────────────────────────────────────
const CalIcon   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
const SunIcon   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>;
const MoonIcon  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>;
const PlusIcon  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const TrashIcon = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>;
const CheckIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
const HelpIcon  = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 1 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12" y2="17.01"/></svg>;
const CloseIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const HeartIcon = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="#FF0000" stroke="#FF0000" strokeWidth="1"><path d="M12 21s-6.7-4.3-9.3-8.3C1 9.7 1.8 6.4 4.6 5 7 3.8 9.7 4.6 12 7.3 14.3 4.6 17 3.8 19.4 5c2.8 1.4 3.6 4.7 1.9 7.7C18.7 16.7 12 21 12 21z"/></svg>;

// ─── DatePicker ───────────────────────────────────────────────────
function DatePicker({ label, value, onChange, hint }) {
  const [text, setText] = useState(value || "");
  const nativeRef = useRef(null);

  useEffect(() => { setText(value || ""); }, [value]);

  function commit(v) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(new Date(v).getTime())) {
      onChange(v);
    } else {
      setText(value || "");
    }
  }

  function openPicker() {
    const el = nativeRef.current;
    if (!el) return;
    try { if (typeof el.showPicker === "function") { el.showPicker(); return; } }
    catch (_) {}
    el.focus();
  }

  return (
    <div className="dp-wrap">
      {label && <label className="field-label">{label}</label>}
      {hint  && <span  className="field-hint">{hint}</span>}
      <div className="dp-input-row">
        <input
          className="dp-text"
          type="text"
          inputMode="numeric"
          value={text}
          placeholder="YYYY-MM-DD"
          onChange={e => setText(e.target.value)}
          onBlur={e  => commit(e.target.value)}
          onKeyDown={e => e.key === "Enter" && commit(e.target.value)}
        />
        <input
          ref={nativeRef}
          type="date"
          className="dp-native-overlay"
          value={/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ""}
          tabIndex={-1}
          aria-hidden="true"
          onChange={e => { onChange(e.target.value); setText(e.target.value); }}
        />
        <button type="button" className="dp-cal-btn" onClick={openPicker} tabIndex={-1}>
          <CalIcon />
        </button>
      </div>
    </div>
  );
}

// ─── HelpModal ────────────────────────────────────────────────────
function HelpModal({ open, onClose }) {
  if (!open) return null;
  const steps = [
    { title: "Set your weekly schedule",
      desc:  "Enter how many class periods happen each day, Monday to Saturday. Sundays are excluded automatically." },
    { title: "Enter semester details",
      desc:  "Provide semester start/end dates, classes attended so far, total conducted, your target, and any holidays." },
    { title: "Read your result",
      desc:  "See your current percentage and exactly how many classes (and days) you must attend or can skip to hit your target." },
  ];
  return (
    <div className="help-overlay" onClick={onClose}>
      <div className="help-modal" onClick={e => e.stopPropagation()}>
        <div className="help-modal-header">
          <span className="help-modal-title">How it works</span>
          <button className="help-close" onClick={onClose}><CloseIcon /></button>
        </div>
        <div className="help-steps">
          {steps.map((s, i) => (
            <div key={i} className="help-step">
              <div className="help-step-num">{i + 1}</div>
              <div>
                <div className="help-step-title">{s.title}</div>
                <div className="help-step-desc">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <button className="btn-primary help-done-btn" onClick={onClose}>Got it</button>
      </div>
    </div>
  );
}

// ─── CollegePresets ───────────────────────────────────────────────
function CollegePresets({ holidayDates, applyDates }) {
  const [panel,    setPanel]    = useState(null);
  const [list,     setList]     = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [search,   setSearch]   = useState("");
  const [saveName, setSaveName] = useState("");
  const [saveDesc, setSaveDesc] = useState("");
  const [saving,   setSaving]   = useState(false);
  const [msg,      setMsg]      = useState({ text: "", type: "" });

  const flash = (text, type = "ok") => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: "", type: "" }), 5000);
  };

  async function loadList() {
    setLoading(true);
    try { setList(await dbListPresets()); }
    catch (e) { setList([]); flash("Could not load: " + e.message, "err"); }
    setLoading(false);
  }

  function togglePanel(p) {
    if (panel === p) { setPanel(null); return; }
    setPanel(p);
    if (p === "browse") loadList();
  }

  function applyPreset(entry) {
    if (!entry.holidays?.length) return;
    applyDates(entry.holidays);
    flash(`Loaded ${entry.holidays.length} holidays from ${entry.name}.`);
    setPanel(null);
  }

  async function savePreset() {
    if (!saveName.trim())     { flash("Enter a college name.", "err"); return; }
    if (!holidayDates.length) { flash("Add holiday dates first.", "err"); return; }
    setSaving(true);
    try {
      await dbSavePreset(saveName, saveDesc, holidayDates);
      flash(`"${saveName.trim()}" saved — visible to everyone.`);
      setSaveName(""); setSaveDesc(""); setPanel(null);
    } catch (e) {
      flash("Save failed: " + e.message, "err");
    }
    setSaving(false);
  }

  if (!isFirebaseConfigured()) {
    return (
      <div className="firebase-notice">
        <div className="firebase-notice-title">Firebase not configured</div>
        <p className="firebase-notice-body">
          To enable globally shared college holiday presets, fill in the{" "}
          <code>firebaseConfig</code> values at the top of{" "}
          <code>src/index.jsx</code> with your Firebase project credentials.
          See <code>FIREBASE_SETUP.md</code> for instructions.
        </p>
      </div>
    );
  }

  const filtered = list.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="preset-root">
      <div className="preset-action-row">
        <button
          className={`preset-pill ${panel === "browse" ? "active" : ""}`}
          onClick={() => togglePanel("browse")}
        >Browse saved colleges</button>
        <button
          className={`preset-pill ${panel === "save" ? "active" : ""}`}
          onClick={() => togglePanel("save")}
        >Save my college</button>
      </div>

      {panel === "browse" && (
        <div className="preset-box">
          <p className="preset-box-title">College Holiday Presets</p>
          <p className="preset-box-sub">Select a college to load its full holiday calendar.</p>
          <input
            className="preset-search"
            placeholder="Search by college name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {loading && <p className="preset-status">Loading...</p>}
          {!loading && filtered.length === 0 && (
            <p className="preset-status">
              {search ? "No colleges match." : "None saved yet. Be the first to add yours."}
            </p>
          )}
          <div className="preset-list">
            {filtered.map(entry => (
              <div key={entry.id} className="preset-row">
                <div className="preset-row-info">
                  <span className="preset-row-name">{entry.name}</span>
                  {entry.description && <span className="preset-row-desc">{entry.description}</span>}
                  <span className="preset-row-meta">
                    {entry.holidays?.length || 0} holidays · updated {entry.updatedAt}
                  </span>
                </div>
                <button className="btn-load" onClick={() => applyPreset(entry)}>Load</button>
              </div>
            ))}
          </div>
          {msg.text && <div className={`preset-msg ${msg.type}`}>{msg.text}</div>}
        </div>
      )}

      {panel === "save" && (
        <div className="preset-box">
          <p className="preset-box-title">Save College Holiday Preset</p>
          <p className="preset-box-sub">
            {holidayDates.length > 0
              ? `${holidayDates.length} holiday date${holidayDates.length !== 1 ? "s" : ""} will be saved to Firestore and shared globally.`
              : "Add holiday dates below first, then come back to save."}
          </p>
          <div className="save-form">
            <div className="field-group">
              <label className="field-label">College Name</label>
              <input className="text-input" type="text" placeholder="e.g. Anna University"
                value={saveName} onChange={e => setSaveName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && savePreset()} />
            </div>
            <div className="field-group">
              <label className="field-label">Description <span className="optional">(optional)</span></label>
              <input className="text-input" type="text" placeholder="e.g. 2025–26 Academic Year"
                value={saveDesc} onChange={e => setSaveDesc(e.target.value)} />
            </div>
            <button className="btn-primary" onClick={savePreset} disabled={saving}>
              {saving ? "Saving..." : "Save and share with all users"}
            </button>
          </div>
          <p className="preset-note">Written to a public database — anyone using this app can load it.</p>
          {msg.text && <div className={`preset-msg ${msg.type}`}>{msg.text}</div>}
        </div>
      )}
    </div>
  );
}

// ─── HolidayManager ──────────────────────────────────────────────
function HolidayManager({ holidays, setHolidays }) {
  const [newDate,  setNewDate]  = useState("");
  const [newLabel, setNewLabel] = useState("");
  const nativeRef = useRef(null);

  function add() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) return;
    setHolidays(prev => {
      if (prev.find(h => h.date === newDate)) return prev;
      return [...prev, { date: newDate, label: newLabel.trim() || newDate }]
        .sort((a, b) => a.date.localeCompare(b.date));
    });
    setNewDate(""); setNewLabel("");
  }

  function applyFromPreset(dates) {
    setHolidays(prev => {
      const map = new Map(prev.map(h => [h.date, h]));
      dates.forEach(d => { if (!map.has(d)) map.set(d, { date: d, label: d }); });
      return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
    });
  }

  function openPicker() {
    const el = nativeRef.current;
    if (!el) return;
    try { if (typeof el.showPicker === "function") { el.showPicker(); return; } }
    catch (_) {}
    el.focus();
  }

  return (
    <div className="hm-root">
      <CollegePresets holidayDates={holidays.map(h => h.date)} applyDates={applyFromPreset} />
      <div className="hm-divider"><span>Or add individual dates</span></div>
      <div className="hm-add-row">
        <div className="hm-add-date">
          <input className="text-input" type="text" inputMode="numeric"
            placeholder="YYYY-MM-DD" value={newDate}
            onChange={e => setNewDate(e.target.value)}
            onKeyDown={e => e.key === "Enter" && add()} />
          <input ref={nativeRef} type="date" className="dp-native-overlay"
            value={/^\d{4}-\d{2}-\d{2}$/.test(newDate) ? newDate : ""}
            tabIndex={-1} aria-hidden="true"
            onChange={e => setNewDate(e.target.value)} />
          <button type="button" className="dp-cal-btn" onClick={openPicker}><CalIcon /></button>
        </div>
        <input className="text-input hm-add-label" type="text" placeholder="Label (optional)"
          value={newLabel} onChange={e => setNewLabel(e.target.value)}
          onKeyDown={e => e.key === "Enter" && add()} />
        <button className="btn-icon-add" onClick={add}><PlusIcon /> Add</button>
      </div>
      {holidays.length > 0 ? (
        <div className="hm-list">
          {holidays.map(h => (
            <div key={h.date} className="hm-row">
              <span className="hm-dot" />
              <span className="hm-date">{h.date}</span>
              <span className="hm-label">{h.label !== h.date ? h.label : ""}</span>
              <button className="hm-remove"
                onClick={() => setHolidays(p => p.filter(x => x.date !== h.date))}>
                <TrashIcon />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="hm-empty">No holidays added. Load a college preset or add dates manually.</p>
      )}
    </div>
  );
}

// ─── Step 1 — Schedule ───────────────────────────────────────────
function StepSchedule({ schedule, onChange }) {
  return (
    <div className="step-content">
      <div className="step-header">
        <h2 className="step-title">Weekly Class Schedule</h2>
        <p className="step-desc">Set how many class periods happen on each working day. Sundays are automatically excluded.</p>
      </div>
      <div className="schedule-grid">
        {WEEKDAYS.map(({ key, short, full }) => (
          <div key={key} className="schedule-card">
            <div className="schedule-day-name">{full}</div>
            <div className="schedule-day-short">{short}</div>
            <div className="stepper">
              <button className="stepper-btn" onClick={() => onChange(key, Math.max(0, (schedule[key]||0)-1))}>−</button>
              <span className="stepper-count">{schedule[key]||0}</span>
              <button className="stepper-btn" onClick={() => onChange(key, Math.min(12,(schedule[key]||0)+1))}>+</button>
            </div>
            <span className="schedule-unit">{schedule[key]===1?"period":"periods"}</span>
          </div>
        ))}
      </div>
      <div className="info-block">
        <strong>Note:</strong> Sundays are excluded automatically. Set 0 for days with no classes. Each number is the total class periods held that day.
      </div>
    </div>
  );
}

// ─── Step 2 — Setup ──────────────────────────────────────────────
function StepSetup({ state, setState, holidays, setHolidays }) {
  const { semStart, semEnd, currentDate, attendedClasses, totalConducted, targetPct } = state;
  const set = (k, v) => setState(p => ({ ...p, [k]: v }));
  return (
    <div className="step-content">
      <div className="step-header">
        <h2 className="step-title">Semester Details</h2>
        <p className="step-desc">Enter your semester dates, current attendance record, and target percentage.</p>
      </div>

      <div className="section-card">
        <div className="section-card-title">Semester Period</div>
        <div className="form-row-2">
          <DatePicker label="Semester Start" value={semStart} onChange={v=>set("semStart",v)} hint="First day of classes" />
          <DatePicker label="Semester End"   value={semEnd}   onChange={v=>set("semEnd",v)}   hint="Last day of classes" />
        </div>
        <div style={{marginTop:"1rem"}}>
          <DatePicker label="Today's Date" value={currentDate} onChange={v=>set("currentDate",v)}
            hint="Classes from tomorrow onward are counted as remaining" />
        </div>
      </div>

      <div className="section-card">
        <div className="section-card-title">Current Attendance Record</div>
        <div className="form-row-2">
          <div className="field-group">
            <label className="field-label">Classes Attended</label>
            <span className="field-hint">Total classes you were present for so far</span>
            <input className="text-input" type="number" min="0" placeholder="e.g. 60"
              value={attendedClasses} onChange={e=>set("attendedClasses",e.target.value)} />
          </div>
          <div className="field-group">
            <label className="field-label">Classes Conducted</label>
            <span className="field-hint">Total classes held by the college so far</span>
            <input className="text-input" type="number" min="0" placeholder="e.g. 80"
              value={totalConducted} onChange={e=>set("totalConducted",e.target.value)} />
          </div>
        </div>
      </div>

      <div className="section-card">
        <div className="section-card-title">Attendance Target</div>
        <div className="field-group">
          <label className="field-label">Desired Attendance Percentage</label>
          <span className="field-hint">Most colleges require a minimum of 75%.</span>
          <div className="target-input-row">
            <input className="text-input target-input" type="number" min="0" max="100" step="1"
              placeholder="75" value={targetPct} onChange={e=>set("targetPct",e.target.value)} />
            <span className="target-pct-symbol">%</span>
          </div>
        </div>
      </div>

      <div className="section-card">
        <div className="section-card-title">Holidays and Leaves</div>
        <HolidayManager holidays={holidays} setHolidays={setHolidays} />
      </div>
    </div>
  );
}

// ─── Step 3 — Results ────────────────────────────────────────────
function StepResults({ state, holidays, schedule }) {
  const { semStart, semEnd, currentDate, attendedClasses, totalConducted, targetPct } = state;

  const R = useMemo(() => {
    const start    = new Date(semStart);
    const end      = new Date(semEnd);
    const today    = new Date(currentDate);
    const attended = attendedClasses === "" ? NaN : parseInt(attendedClasses, 10);
    const conducted= totalConducted  === "" ? NaN : parseInt(totalConducted,  10);
    const target   = targetPct       === "" ? NaN : parseFloat(targetPct);

    if ([start,end,today].some(d => isNaN(d.getTime()))) return null;
    if (start > end) return null;
    if (!Number.isFinite(attended)||!Number.isFinite(conducted)||!Number.isFinite(target)) return null;
    if (conducted <= 0) return null;
    if (attended > conducted) return { error: "Classes attended cannot exceed classes conducted." };

    const currentPct = (attended / conducted) * 100;
    const tomorrow   = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const hDates      = holidays.map(h => h.date);
    const futureDays  = tomorrow <= end ? workingDaysInRange(tomorrow, end, schedule, hDates) : [];
    const futureTotal = totalClassesFor(futureDays, schedule);
    const grandTotal  = conducted + futureTotal;

    const needed     = Math.ceil((target/100)*grandTotal - attended);
    const mustAttend = Math.max(0, Math.min(needed, futureTotal));
    const canSkip    = Math.max(0, futureTotal - mustAttend);
    const pctIfAll   = grandTotal > 0 ? ((attended+futureTotal)/grandTotal)*100 : currentPct;
    const pctIfNone  = grandTotal > 0 ? (attended/grandTotal)*100 : currentPct;
    const unreachable= needed > futureTotal;

    const mustAttendDays  = classesToDays(mustAttend, schedule);
    const canSkipDays     = classesToDays(canSkip,    schedule);
    const futureTotalDays = futureDays.length;

    const breakdown = [];
    let rAtt = attended, rCon = conducted;
    const cur = new Date(tomorrow);
    let shown = 0;
    while (cur <= end && shown < 30) {
      const dow = cur.getDay(), cls = schedule[dow]||0;
      if (dow !== 0 && cls > 0 && !isHoliday(cur, hDates)) {
        rCon += cls;
        breakdown.push({
          date: cur.toISOString().slice(0,10), day: DAY_NAMES[dow], classes: cls,
          ifPresent: ((rAtt+cls)/rCon*100).toFixed(1),
          ifAbsent:  (rAtt/rCon*100).toFixed(1),
        });
        shown++;
      }
      cur.setDate(cur.getDate()+1);
    }
    return { currentPct, target, attended, conducted, futureTotal, futureTotalDays,
      grandTotal, mustAttend, mustAttendDays, canSkip, canSkipDays,
      pctIfAll, pctIfNone, unreachable, breakdown };
  }, [semStart, semEnd, currentDate, attendedClasses, totalConducted, targetPct, holidays, schedule]);

  if (!R) return (
    <div className="step-content">
      <div className="results-empty">
        <p className="results-empty-title">No results yet</p>
        <p className="results-empty-sub">Complete the Schedule and Setup steps to see your analysis.</p>
      </div>
    </div>
  );
  if (R.error) return (
    <div className="step-content">
      <div className="results-empty">
        <p className="results-empty-title">Check your numbers</p>
        <p className="results-empty-sub">{R.error}</p>
      </div>
    </div>
  );

  const status = R.unreachable ? "critical"
    : R.currentPct >= R.target      ? "safe"
    : R.currentPct >= R.target - 10 ? "warn" : "low";
  const statusLabel = { safe:"Above Target", warn:"Approaching Limit", low:"Below Target", critical:"Target Unreachable" }[status];

  return (
    <div className="step-content">
      <div className="step-header">
        <h2 className="step-title">Attendance Analysis</h2>
        <p className="step-desc">Your full attendance summary and what you need to do from here.</p>
      </div>

      <div className={`result-hero status-${status}`}>
        <div className="result-hero-inner">
          <div className="result-pct">{fmt(R.currentPct)}%</div>
          <div className="result-pct-label">Current Attendance</div>
          <div className={`result-status-badge status-${status}`}>{statusLabel}</div>
        </div>
        <div className="result-hero-meta">
          <div className="rhm-item"><span className="rhm-val">{R.attended}</span><span className="rhm-key">Attended</span></div>
          <div className="rhm-sep"/>
          <div className="rhm-item"><span className="rhm-val">{R.conducted}</span><span className="rhm-key">Conducted</span></div>
          <div className="rhm-sep"/>
          <div className="rhm-item"><span className="rhm-val">{R.target}%</span><span className="rhm-key">Target</span></div>
        </div>
      </div>

      <div className={`verdict-card status-${status}`}>
        {status==="safe"&&R.canSkip>0&&<p>You are above your target. You can skip up to <strong>{R.canSkip} more classes (≈ {R.canSkipDays} day{R.canSkipDays!==1?"s":""})</strong> and still maintain {R.target}%.</p>}
        {status==="safe"&&R.canSkip===0&&<p>You are exactly at your target. Attend all remaining classes to stay safe.</p>}
        {(status==="warn"||status==="low")&&!R.unreachable&&<p>You must attend at least <strong>{R.mustAttend} of the {R.futureTotal}</strong> remaining classes (≈ <strong>{R.mustAttendDays} day{R.mustAttendDays!==1?"s":""}</strong>) to reach {R.target}%. You can skip at most <strong>{R.canSkip} class{R.canSkip!==1?"es":""} (≈ {R.canSkipDays} day{R.canSkipDays!==1?"s":""})</strong>.</p>}
        {status==="critical"&&<p>Even attending every remaining class, you would only reach <strong>{fmt(R.pctIfAll)}%</strong>. The {R.target}% target is not achievable this semester. Contact your department.</p>}
      </div>

      <div className="stat-grid">
        <StatTile accent label="Remaining Classes" value={R.futureTotal}    sub={`≈ ${R.futureTotalDays} day${R.futureTotalDays!==1?"s":""}`}/>
        <StatTile accent label="Must Attend"       value={R.mustAttend}     sub={`≈ ${R.mustAttendDays} day${R.mustAttendDays!==1?"s":""}`}/>
        <StatTile        label="Can Skip"          value={R.canSkip}        sub={`≈ ${R.canSkipDays} day${R.canSkipDays!==1?"s":""}`}/>
        <StatTile        label="Working Days Left" value={R.futureTotalDays} sub="calendar days"/>
      </div>

      <div className="projection-row">
        <div className="projection-card">
          <div className="projection-label">If you attend all remaining</div>
          <div className={`projection-val ${R.pctIfAll>=R.target?"proj-good":"proj-bad"}`}>{fmt(R.pctIfAll)}%</div>
        </div>
        <div className="projection-card">
          <div className="projection-label">If you skip all remaining</div>
          <div className={`projection-val ${R.pctIfNone>=R.target?"proj-good":"proj-bad"}`}>{fmt(R.pctIfNone)}%</div>
        </div>
      </div>

      <div className="progress-section">
        <div className="progress-labels"><span>Current: {fmt(R.currentPct)}%</span><span>Target: {R.target}%</span></div>
        <div className="progress-track">
          <div className="progress-fill" style={{width:`${Math.min(100,Math.max(0,R.currentPct))}%`}}/>
          <div className="progress-target-line" style={{left:`${Math.min(100,Math.max(0,R.target))}%`}}/>
        </div>
        <div className="progress-scale"><span>0%</span><span>50%</span><span>100%</span></div>
      </div>

      {R.breakdown.length > 0 && (
        <div className="breakdown-section">
          <div className="breakdown-header">
            <span className="breakdown-title">Upcoming Working Days</span>
            <span className="breakdown-sub">Next {R.breakdown.length} days — green is above target, red is below.</span>
          </div>
          <div className="breakdown-scroll">
            <table className="breakdown-table">
              <thead><tr><th>Date</th><th>Day</th><th>Periods</th><th>If Present</th><th>If Absent</th></tr></thead>
              <tbody>
                {R.breakdown.map((row,i)=>(
                  <tr key={row.date} className={i%2===0?"row-even":"row-odd"}>
                    <td className="td-date">{row.date}</td>
                    <td className="td-day">{row.day}</td>
                    <td>{row.classes}</td>
                    <td className={parseFloat(row.ifPresent)>=R.target?"td-good":"td-bad"}>{row.ifPresent}%</td>
                    <td className={parseFloat(row.ifAbsent)>=R.target?"td-ok":"td-bad"}>{row.ifAbsent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatTile({ label, value, sub, accent }) {
  return (
    <div className={`stat-tile ${accent?"stat-tile-accent":""}`}>
      <div className="stat-tile-val">{value}</div>
      <div className="stat-tile-label">{label}</div>
      {sub && <div className="stat-tile-sub">{sub}</div>}
    </div>
  );
}

// ─── StepBar ─────────────────────────────────────────────────────
function StepBar({ current, setCurrent, canProceed }) {
  return (
    <div className="stepbar">
      {STEPS.map((name, i) => {
        const done   = i < current;
        const active = i === current;
        const ok     = done || active || (i === current+1 && canProceed);
        return (
          <button key={i}
            className={`stepbar-item ${active?"sb-active":""} ${done?"sb-done":""}`}
            onClick={() => ok && setCurrent(i)} disabled={!ok}>
            <span className="sb-circle">{done ? <CheckIcon/> : <span>{i+1}</span>}</span>
            <span className="sb-label">{name}</span>
            {i < STEPS.length-1 && <span className="sb-connector"/>}
          </button>
        );
      })}
    </div>
  );
}

// ─── Root App ────────────────────────────────────────────────────
export default function App() {
  const [theme,    setTheme]    = useState("light");
  const [step,     setStep]     = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const [schedule, setSchedule] = useState({ 1:6, 2:6, 3:6, 4:6, 5:6, 6:3 });
  const [setup,    setSetup]    = useState({
    semStart:"", semEnd:"", currentDate:isoToday(),
    attendedClasses:"", totalConducted:"", targetPct:"75",
  });
  const [holidays, setHolidays] = useState([]);

  // Sync theme on <html> element
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const canGoNext = useMemo(() => {
    if (step === 0) return Object.values(schedule).some(v => v > 0);
    if (step === 1) {
      const { semStart, semEnd, attendedClasses, totalConducted, targetPct } = setup;
      const att = parseInt(attendedClasses, 10);
      const con = parseInt(totalConducted,  10);
      const tgt = parseFloat(targetPct);
      return !!semStart && !!semEnd && semStart <= semEnd
        && Number.isFinite(att) && att >= 0
        && Number.isFinite(con) && con > 0 && att <= con
        && Number.isFinite(tgt) && tgt > 0 && tgt <= 100;
    }
    return false;
  }, [step, schedule, setup]);

  return (
    <div className="app-root">
      <div className="app-shell">
        <div className="topbar">
          <div>
            <div className="topbar-eyebrow">Academic Tool</div>
            <h1 className="topbar-title">Attendance<span>.</span></h1>
          </div>
          <div className="topbar-actions">
            <button className="icon-btn" onClick={() => setHelpOpen(true)} title="How it works">
              <HelpIcon/>
            </button>
            <button className="theme-btn"
              onClick={() => setTheme(t => t==="light"?"dark":"light")}>
              {theme==="light" ? <><MoonIcon/> Dark</> : <><SunIcon/> Light</>}
            </button>
          </div>
        </div>

        <StepBar current={step} setCurrent={setStep} canProceed={canGoNext}/>

        {step===0 && <StepSchedule schedule={schedule}
          onChange={(dow,val)=>setSchedule(s=>({...s,[dow]:val}))}/>}
        {step===1 && <StepSetup state={setup} setState={setSetup}
          holidays={holidays} setHolidays={setHolidays}/>}
        {step===2 && <StepResults state={setup} holidays={holidays} schedule={schedule}/>}

        <div className="nav-row">
          {step > 0
            ? <button className="btn-ghost" onClick={()=>setStep(s=>s-1)}>Back</button>
            : <span/>}
          {step < 2 && (
            <button className="btn-primary" disabled={!canGoNext}
              onClick={()=>setStep(s=>s+1)}>
              {step===0 ? "Continue to Setup" : "View Results"}
            </button>
          )}
        </div>
      </div>

      <footer className="app-footer">
        Made with Love <HeartIcon/> by <strong>Arceus</strong>
      </footer>

      <HelpModal open={helpOpen} onClose={()=>setHelpOpen(false)}/>
    </div>
  );
}
