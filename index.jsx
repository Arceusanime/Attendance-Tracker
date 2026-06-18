/**
 * ATTENDANCE TRACKER
 * ─────────────────────────────────────────────────────────────────
 * Tech Stack: React 18 · Custom CSS variables · DM Sans / DM Mono
 * Storage: Anthropic Artifact Storage API (window.storage) for
 *          shared college holiday presets — falls back to
 *          localStorage automatically when window.storage is absent
 *          (e.g. running locally via Create React App).
 * ─────────────────────────────────────────────────────────────────
 */

import { useState, useMemo, useEffect, useRef } from "react";

// ─── STORAGE SHIM ────────────────────────────────────────────────
// Works inside Claude artifacts (window.storage) AND in a normal
// browser / VS Code dev build (falls back to localStorage).
const storage = {
  async get(key, shared = false) {
    if (typeof window !== "undefined" && window.storage) {
      return window.storage.get(key, shared);
    }
    const raw = localStorage.getItem(key);
    if (raw === null) throw new Error("not found");
    return { key, value: raw, shared };
  },
  async set(key, value, shared = false) {
    if (typeof window !== "undefined" && window.storage) {
      return window.storage.set(key, value, shared);
    }
    localStorage.setItem(key, value);
    return { key, value, shared };
  },
  async list(prefix = "", shared = false) {
    if (typeof window !== "undefined" && window.storage) {
      return window.storage.list(prefix, shared);
    }
    const keys = Object.keys(localStorage).filter(k => k.startsWith(prefix));
    return { keys, prefix, shared };
  },
};

// ─── CONSTANTS ─────────────────────────────────────────────────────
const DAY_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const WEEKDAYS = [
  { key: 1, short: "Mon", full: "Monday"    },
  { key: 2, short: "Tue", full: "Tuesday"   },
  { key: 3, short: "Wed", full: "Wednesday" },
  { key: 4, short: "Thu", full: "Thursday"  },
  { key: 5, short: "Fri", full: "Friday"    },
  { key: 6, short: "Sat", full: "Saturday"  },
];
const STEPS = ["Schedule","Setup","Results"];

// ─── HELPERS ───────────────────────────────────────────────────────
function isoToday() { return new Date().toISOString().slice(0, 10); }

function getDatesInRange(start, end) {
  const out = [], cur = new Date(start), last = new Date(end);
  while (cur <= last) { out.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }
  return out;
}
function isHoliday(date, holidayDates) {
  const s = date.toISOString().slice(0, 10);
  return holidayDates.includes(s);
}
function workingDaysInRange(start, end, schedule, holidayDates) {
  return getDatesInRange(start, end).filter(d => {
    const dow = d.getDay();
    return dow !== 0 && (schedule[dow] || 0) > 0 && !isHoliday(d, holidayDates);
  });
}
function totalClassesFor(days, schedule) {
  return days.reduce((s, d) => s + (schedule[d.getDay()] || 0), 0);
}
function storageKeyFor(name) {
  return "college:" + name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
function fmt(n) { return Number.isFinite(n) ? n.toFixed(1) : "0.0"; }
// average periods/day across the days actually configured (used to convert "classes" -> "days")
function avgPeriodsPerDay(schedule) {
  const vals = Object.values(schedule).filter(v => v > 0);
  if (!vals.length) return 1;
  return vals.reduce((a,b)=>a+b,0) / vals.length;
}
function classesToDays(classCount, schedule) {
  const avg = avgPeriodsPerDay(schedule);
  if (!avg) return 0;
  return Math.ceil(classCount / avg);
}

// ─── SVG ICONS ─────────────────────────────────────────────────────
const CalIcon   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
const SunIcon    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>;
const MoonIcon   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>;
const PlusIcon   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const TrashIcon  = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>;
const CheckIcon  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
const HelpIcon   = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 1 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12" y2="17.01"/></svg>;
const CloseIcon  = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const HeartIcon  = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="#FF0000" stroke="#FF0000" strokeWidth="1"><path d="M12 21s-6.7-4.3-9.3-8.3C1 9.7 1.8 6.4 4.6 5 7 3.8 9.7 4.6 12 7.3 14.3 4.6 17 3.8 19.4 5c2.8 1.4 3.6 4.7 1.9 7.7C18.7 16.7 12 21 12 21z"/></svg>;

// ─── DATE PICKER (working calendar icon + manual typing) ───────────
function DatePicker({ label, value, onChange, hint, min, max }) {
  const [text, setText] = useState(value || "");
  const nativeRef = useRef(null);

  useEffect(() => { setText(value || ""); }, [value]);

  function commit(v) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      const d = new Date(v);
      if (!isNaN(d.getTime())) { onChange(v); return; }
    }
    // invalid -> revert text to last good value
    setText(value || "");
  }

  function openPicker() {
    const el = nativeRef.current;
    if (!el) return;
    if (typeof el.showPicker === "function") {
      try { el.showPicker(); return; } catch (e) { /* fall through */ }
    }
    el.focus();
    el.click();
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
          onBlur={e => commit(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") commit(e.target.value); }}
        />
        {/* Real date input — visually hidden but fully interactive & correctly sized,
            which is required for showPicker()/click() to work in Chrome/Edge/Firefox */}
        <input
          ref={nativeRef}
          className="dp-native-visible"
          type="date"
          value={/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ""}
          min={min}
          max={max}
          onChange={e => { onChange(e.target.value); setText(e.target.value); }}
          aria-hidden="true"
          tabIndex={-1}
        />
        <button
          type="button"
          className="dp-cal-btn"
          title="Open calendar"
          onClick={openPicker}
        >
          <CalIcon />
        </button>
      </div>
    </div>
  );
}

// ─── HELP MODAL ────────────────────────────────────────────────────
function HelpModal({ open, onClose }) {
  if (!open) return null;
  return (
    <div className="help-overlay" onClick={onClose}>
      <div className="help-modal" onClick={e => e.stopPropagation()}>
        <div className="help-modal-header">
          <span className="help-modal-title">How this works</span>
          <button className="help-close" onClick={onClose}><CloseIcon/></button>
        </div>
        <div className="help-steps">
          <div className="help-step">
            <div className="help-step-num">1</div>
            <div>
              <div className="help-step-title">Set your weekly schedule</div>
              <div className="help-step-desc">Tell us how many class periods you have each day, Monday through Saturday. Sundays are always excluded automatically.</div>
            </div>
          </div>
          <div className="help-step">
            <div className="help-step-num">2</div>
            <div>
              <div className="help-step-title">Enter semester details</div>
              <div className="help-step-desc">Add your semester start and end dates, how many classes you've attended so far, total conducted, your target attendance percentage, and any holidays.</div>
            </div>
          </div>
          <div className="help-step">
            <div className="help-step-num">3</div>
            <div>
              <div className="help-step-title">Get your result</div>
              <div className="help-step-desc">Instantly see your current percentage, exactly how many classes (and days) you must attend or can safely skip to hit your target.</div>
            </div>
          </div>
        </div>
        <button className="btn-primary help-done-btn" onClick={onClose}>Got it</button>
      </div>
    </div>
  );
}

// ─── COLLEGE PRESET SYSTEM ─────────────────────────────────────────
function CollegePresets({ holidayDates, applyDates }) {
  const [panel, setPanel] = useState(null);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [saveName, setSaveName] = useState("");
  const [saveDesc, setSaveDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ text: "", type: "" });

  function flash(text, type = "ok") {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: "", type: "" }), 4000);
  }

  async function loadList() {
    setLoading(true);
    try {
      const result = await storage.list("college:", true);
      const keys = result?.keys || [];
      const rows = [];
      for (const k of keys) {
        try {
          const r = await storage.get(k, true);
          if (r?.value) rows.push({ key: k, ...JSON.parse(r.value) });
        } catch {}
      }
      rows.sort((a, b) => a.name.localeCompare(b.name));
      setList(rows);
    } catch { setList([]); }
    setLoading(false);
  }

  function open(p) {
    if (panel === p) { setPanel(null); return; }
    setPanel(p);
    if (p === "browse") loadList();
  }

  async function applyPreset(entry) {
    if (!entry.holidays?.length) return;
    applyDates(entry.holidays);
    flash(`Loaded ${entry.holidays.length} holidays from ${entry.name}.`);
  }

  async function savePreset() {
    if (!saveName.trim()) { flash("Enter a college name.", "err"); return; }
    if (!holidayDates.length) { flash("No holidays to save. Add dates first.", "err"); return; }
    setSaving(true);
    try {
      const key = storageKeyFor(saveName);
      await storage.set(key, JSON.stringify({
        name: saveName.trim(),
        description: saveDesc.trim(),
        holidays: [...holidayDates].sort(),
        updatedAt: isoToday(),
      }), true);
      flash(`Saved "${saveName.trim()}" — visible to all users.`);
      setSaveName(""); setSaveDesc("");
    } catch { flash("Save failed. Please try again.", "err"); }
    setSaving(false);
  }

  const filtered = list.filter(c => c.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="preset-root">
      <div className="preset-action-row">
        <button className={`preset-pill ${panel === "browse" ? "active" : ""}`} onClick={() => open("browse")}>
          Browse saved colleges
        </button>
        <button className={`preset-pill ${panel === "save" ? "active" : ""}`} onClick={() => open("save")}>
          Save my college
        </button>
      </div>

      {panel === "browse" && (
        <div className="preset-box">
          <p className="preset-box-title">College Holiday Presets</p>
          <p className="preset-box-sub">Select a college to load its entire holiday calendar into your setup in one click.</p>
          <input className="preset-search" placeholder="Search by college name..." value={search} onChange={e => setSearch(e.target.value)} />
          {loading && <p className="preset-status">Loading...</p>}
          {!loading && filtered.length === 0 && (
            <p className="preset-status">{search ? "No colleges match your search." : "No colleges saved yet. Save your college to help others."}</p>
          )}
          <div className="preset-list">
            {filtered.map(entry => (
              <div key={entry.key} className="preset-row">
                <div className="preset-row-info">
                  <span className="preset-row-name">{entry.name}</span>
                  {entry.description && <span className="preset-row-desc">{entry.description}</span>}
                  <span className="preset-row-meta">{entry.holidays?.length || 0} holidays · updated {entry.updatedAt}</span>
                </div>
                <button className="btn-load" onClick={() => applyPreset(entry)}>Load</button>
              </div>
            ))}
          </div>
          {msg.text && panel === "browse" && <div className={`preset-msg ${msg.type}`}>{msg.text}</div>}
        </div>
      )}

      {panel === "save" && (
        <div className="preset-box">
          <p className="preset-box-title">Save College Holiday Preset</p>
          <p className="preset-box-sub">
            {holidayDates.length > 0
              ? `Your ${holidayDates.length} holiday date${holidayDates.length !== 1 ? "s" : ""} will be saved and shared publicly with all users.`
              : "Add holiday dates in the section below first, then save your college preset."}
          </p>
          <div className="save-form">
            <div className="field-group">
              <label className="field-label">College Name</label>
              <input className="text-input" type="text" placeholder="e.g. Anna University, IIT Madras" value={saveName} onChange={e => setSaveName(e.target.value)} />
            </div>
            <div className="field-group">
              <label className="field-label">Description <span className="optional">(optional)</span></label>
              <input className="text-input" type="text" placeholder="e.g. 2025 Academic Year" value={saveDesc} onChange={e => setSaveDesc(e.target.value)} />
            </div>
            <button className="btn-primary" onClick={savePreset} disabled={saving}>{saving ? "Saving..." : "Save and share with all users"}</button>
          </div>
          <p className="preset-note">This data is shared publicly. Anyone using this app can load it.</p>
          {msg.text && panel === "save" && <div className={`preset-msg ${msg.type}`}>{msg.text}</div>}
        </div>
      )}
    </div>
  );
}

// ─── HOLIDAY MANAGER ───────────────────────────────────────────────
function HolidayManager({ holidays, setHolidays }) {
  const [newDate, setNewDate] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const nativeRef = useRef(null);

  function add() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) return;
    if (!holidays.find(h => h.date === newDate)) {
      setHolidays(prev => [...prev, { date: newDate, label: newLabel.trim() || newDate }]
        .sort((a, b) => a.date.localeCompare(b.date)));
    }
    setNewDate(""); setNewLabel("");
  }
  function remove(date) { setHolidays(prev => prev.filter(h => h.date !== date)); }

  function applyFromPreset(dates) {
    setHolidays(prev => {
      const merged = [...new Map([...prev, ...dates.map(d => ({ date: d, label: d }))].map(h => [h.date, h])).values()];
      return merged.sort((a, b) => a.date.localeCompare(b.date));
    });
  }

  function openPicker() {
    const el = nativeRef.current;
    if (!el) return;
    if (typeof el.showPicker === "function") {
      try { el.showPicker(); return; } catch (e) {}
    }
    el.focus();
    el.click();
  }

  return (
    <div className="hm-root">
      <CollegePresets holidayDates={holidays.map(h => h.date)} applyDates={applyFromPreset} />

      <div className="hm-divider"><span>Or add individual dates</span></div>

      <div className="hm-add-row">
        <div className="hm-add-date">
          <input
            className="text-input"
            type="text"
            inputMode="numeric"
            placeholder="YYYY-MM-DD"
            value={newDate}
            onChange={e => setNewDate(e.target.value)}
          />
          <input
            ref={nativeRef}
            className="dp-native-visible"
            type="date"
            value={/^\d{4}-\d{2}-\d{2}$/.test(newDate) ? newDate : ""}
            onChange={e => setNewDate(e.target.value)}
            aria-hidden="true"
            tabIndex={-1}
          />
          <button type="button" className="dp-cal-btn" onClick={openPicker} title="Pick date">
            <CalIcon/>
          </button>
        </div>
        <input className="text-input hm-add-label" type="text" placeholder="Label (optional)"
          value={newLabel} onChange={e => setNewLabel(e.target.value)}
          onKeyDown={e => e.key === "Enter" && add()} />
        <button className="btn-icon-add" onClick={add} title="Add holiday"><PlusIcon/> Add</button>
      </div>

      {holidays.length > 0 ? (
        <div className="hm-list">
          {holidays.map(h => (
            <div key={h.date} className="hm-row">
              <span className="hm-dot" />
              <span className="hm-date">{h.date}</span>
              <span className="hm-label">{h.label !== h.date ? h.label : ""}</span>
              <button className="hm-remove" onClick={() => remove(h.date)} title="Remove"><TrashIcon/></button>
            </div>
          ))}
        </div>
      ) : (
        <p className="hm-empty">No holidays added. Load a college preset or add dates manually.</p>
      )}
    </div>
  );
}

// ─── STEP 1: SCHEDULE ──────────────────────────────────────────────
function StepSchedule({ schedule, onChange }) {
  return (
    <div className="step-content">
      <div className="step-header">
        <h2 className="step-title">Weekly Class Schedule</h2>
        <p className="step-desc">Set how many class periods happen on each working day. Sundays are automatically excluded from all calculations.</p>
      </div>

      <div className="schedule-grid">
        {WEEKDAYS.map(({ key, short, full }) => (
          <div key={key} className="schedule-card">
            <div className="schedule-day-name">{full}</div>
            <div className="schedule-day-short">{short}</div>
            <div className="stepper">
              <button className="stepper-btn" onClick={() => onChange(key, Math.max(0, (schedule[key] || 0) - 1))} aria-label={`Decrease ${full}`}>−</button>
              <span className="stepper-count">{schedule[key] || 0}</span>
              <button className="stepper-btn" onClick={() => onChange(key, Math.min(12, (schedule[key] || 0) + 1))} aria-label={`Increase ${full}`}>+</button>
            </div>
            <span className="schedule-unit">{schedule[key] === 1 ? "period" : "periods"}</span>
          </div>
        ))}
      </div>

      <div className="info-block">
        <strong>Note:</strong> Sundays are excluded automatically. Set 0 for days with no classes. Each number represents the total class periods held that day.
      </div>
    </div>
  );
}

// ─── STEP 2: SETUP ─────────────────────────────────────────────────
function StepSetup({ state, setState, holidays, setHolidays }) {
  const { semStart, semEnd, currentDate, attendedClasses, totalConducted, targetPct } = state;
  const set = (k, v) => setState(prev => ({ ...prev, [k]: v }));

  return (
    <div className="step-content">
      <div className="step-header">
        <h2 className="step-title">Semester Details</h2>
        <p className="step-desc">Enter your semester dates, current attendance record, and your target percentage.</p>
      </div>

      <div className="section-card">
        <div className="section-card-title">Semester Period</div>
        <div className="form-row-2">
          <DatePicker label="Semester Start" value={semStart} onChange={v => set("semStart", v)} hint="First day of classes" />
          <DatePicker label="Semester End" value={semEnd} onChange={v => set("semEnd", v)} hint="Last day of classes" />
        </div>
        <div style={{ marginTop: "1rem" }}>
          <DatePicker label="Today's Date" value={currentDate} onChange={v => set("currentDate", v)} hint="Used to calculate remaining classes from today onward" />
        </div>
      </div>

      <div className="section-card">
        <div className="section-card-title">Current Attendance Record</div>
        <div className="form-row-2">
          <div className="field-group">
            <label className="field-label">Classes Attended</label>
            <span className="field-hint">Total classes you were present for</span>
            <input className="text-input" type="number" min="0" placeholder="e.g. 60" value={attendedClasses} onChange={e => set("attendedClasses", e.target.value)} />
          </div>
          <div className="field-group">
            <label className="field-label">Classes Conducted</label>
            <span className="field-hint">Total classes held so far</span>
            <input className="text-input" type="number" min="0" placeholder="e.g. 80" value={totalConducted} onChange={e => set("totalConducted", e.target.value)} />
          </div>
        </div>
      </div>

      <div className="section-card">
        <div className="section-card-title">Attendance Target</div>
        <div className="field-group">
          <label className="field-label">Desired Attendance Percentage</label>
          <span className="field-hint">Most colleges require a minimum of 75%. Enter your institution's requirement.</span>
          <div className="target-input-row">
            <input className="text-input target-input" type="number" min="0" max="100" step="1" placeholder="75" value={targetPct} onChange={e => set("targetPct", e.target.value)} />
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

// ─── STEP 3: RESULTS ───────────────────────────────────────────────
function StepResults({ state, holidays, schedule }) {
  const { semStart, semEnd, currentDate, attendedClasses, totalConducted, targetPct } = state;

  const R = useMemo(() => {
    const start = new Date(semStart);
    const end = new Date(semEnd);
    const today = new Date(currentDate);
    const attended = attendedClasses === "" ? NaN : parseInt(attendedClasses, 10);
    const conducted = totalConducted === "" ? NaN : parseInt(totalConducted, 10);
    const target = targetPct === "" ? NaN : parseFloat(targetPct);

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || isNaN(today.getTime())) return null;
    if (start > end) return null;
    if (!Number.isFinite(attended) || !Number.isFinite(conducted) || !Number.isFinite(target)) return null;
    if (conducted <= 0) return null;
    if (attended > conducted) return { error: "Classes attended cannot exceed classes conducted." };

    const currentPct = (attended / conducted) * 100;

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const holidayDates = holidays.map(h => h.date);
    const futureDays = tomorrow <= end ? workingDaysInRange(tomorrow, end, schedule, holidayDates) : [];
    const futureTotal = totalClassesFor(futureDays, schedule);
    const grandTotal = conducted + futureTotal;

    const needed = Math.ceil((target / 100) * grandTotal - attended);
    const mustAttend = Math.max(0, Math.min(needed, futureTotal));
    const canSkip = Math.max(0, futureTotal - mustAttend);
    const pctIfAll = grandTotal > 0 ? ((attended + futureTotal) / grandTotal) * 100 : currentPct;
    const pctIfNone = grandTotal > 0 ? (attended / grandTotal) * 100 : currentPct;
    const unreachable = needed > futureTotal;

    // Day-equivalent conversions
    const mustAttendDays = classesToDays(mustAttend, schedule);
    const canSkipDays = classesToDays(canSkip, schedule);
    const futureTotalDays = futureDays.length;

    // 30-entry day-by-day breakdown
    const breakdown = [];
    let rAttended = attended, rConducted = conducted;
    const cur = new Date(tomorrow);
    let shown = 0;
    while (cur <= end && shown < 30) {
      const dow = cur.getDay();
      const cls = schedule[dow] || 0;
      if (dow !== 0 && cls > 0 && !isHoliday(cur, holidayDates)) {
        rConducted += cls;
        breakdown.push({
          date: cur.toISOString().slice(0, 10),
          day: DAY_NAMES[dow],
          classes: cls,
          ifPresent: ((rAttended + cls) / rConducted * 100).toFixed(1),
          ifAbsent: (rAttended / rConducted * 100).toFixed(1),
        });
        shown++;
      }
      cur.setDate(cur.getDate() + 1);
    }

    return {
      currentPct, target, attended, conducted, futureTotal, futureTotalDays,
      grandTotal, mustAttend, mustAttendDays, canSkip, canSkipDays,
      pctIfAll, pctIfNone, unreachable, breakdown,
    };
  }, [semStart, semEnd, currentDate, attendedClasses, totalConducted, targetPct, holidays, schedule]);

  if (!R) {
    return (
      <div className="step-content">
        <div className="results-empty">
          <p className="results-empty-title">No results yet</p>
          <p className="results-empty-sub">Go back and complete the Schedule and Setup steps — semester dates, attendance counts, and target — to see your analysis.</p>
        </div>
      </div>
    );
  }

  if (R.error) {
    return (
      <div className="step-content">
        <div className="results-empty">
          <p className="results-empty-title">Check your numbers</p>
          <p className="results-empty-sub">{R.error}</p>
        </div>
      </div>
    );
  }

  const status = R.unreachable ? "critical" : R.currentPct >= R.target ? "safe" : R.currentPct >= R.target - 10 ? "warn" : "low";
  const statusLabels = { safe: "Above Target", warn: "Approaching Limit", low: "Below Target", critical: "Target Unreachable" };

  return (
    <div className="step-content">
      <div className="step-header">
        <h2 className="step-title">Attendance Analysis</h2>
        <p className="step-desc">Your complete attendance summary and what you need to do from here.</p>
      </div>

      <div className={`result-hero status-${status}`}>
        <div className="result-hero-inner">
          <div className="result-pct">{fmt(R.currentPct)}%</div>
          <div className="result-pct-label">Current Attendance</div>
          <div className={`result-status-badge status-${status}`}>{statusLabels[status]}</div>
        </div>
        <div className="result-hero-meta">
          <div className="rhm-item"><span className="rhm-val">{R.attended}</span><span className="rhm-key">Attended</span></div>
          <div className="rhm-sep" />
          <div className="rhm-item"><span className="rhm-val">{R.conducted}</span><span className="rhm-key">Conducted</span></div>
          <div className="rhm-sep" />
          <div className="rhm-item"><span className="rhm-val">{R.target}%</span><span className="rhm-key">Target</span></div>
        </div>
      </div>

      <div className={`verdict-card status-${status}`}>
        {status === "safe" && R.canSkip > 0 &&
          <p>You are above your target. You can skip up to <strong>{R.canSkip} more classes ({R.canSkipDays} day{R.canSkipDays !== 1 ? "s" : ""})</strong> this semester and still maintain {R.target}% attendance.</p>}
        {status === "safe" && R.canSkip === 0 &&
          <p>You are exactly at your target. Attend all remaining classes to stay safe.</p>}
        {(status === "warn" || status === "low") && !R.unreachable &&
          <p>You must attend at least <strong>{R.mustAttend} of the {R.futureTotal}</strong> remaining classes (roughly <strong>{R.mustAttendDays} day{R.mustAttendDays !== 1 ? "s" : ""}</strong>) to reach {R.target}%. You can afford to skip at most <strong>{R.canSkip} classes ({R.canSkipDays} day{R.canSkipDays !== 1 ? "s" : ""})</strong> from here.</p>}
        {status === "critical" &&
          <p>Even if you attend every remaining class, you will only reach <strong>{fmt(R.pctIfAll)}%</strong>. The {R.target}% target cannot be achieved this semester. Contact your department for options.</p>}
      </div>

      <div className="stat-grid">
        <StatTile label="Remaining Classes" value={R.futureTotal} sub={`≈ ${R.futureTotalDays} day${R.futureTotalDays !== 1 ? "s" : ""}`} accent />
        <StatTile label="Must Attend" value={R.mustAttend} sub={`≈ ${R.mustAttendDays} day${R.mustAttendDays !== 1 ? "s" : ""}`} accent />
        <StatTile label="Can Skip" value={R.canSkip} sub={`≈ ${R.canSkipDays} day${R.canSkipDays !== 1 ? "s" : ""}`} />
        <StatTile label="Working Days Left" value={R.futureTotalDays} sub="calendar days" />
      </div>

      <div className="projection-row">
        <div className="projection-card">
          <div className="projection-label">If you attend all remaining</div>
          <div className={`projection-val ${R.pctIfAll >= R.target ? "proj-good" : "proj-bad"}`}>{fmt(R.pctIfAll)}%</div>
        </div>
        <div className="projection-card">
          <div className="projection-label">If you skip all remaining</div>
          <div className={`projection-val ${R.pctIfNone >= R.target ? "proj-good" : "proj-bad"}`}>{fmt(R.pctIfNone)}%</div>
        </div>
      </div>

      <div className="progress-section">
        <div className="progress-labels"><span>Current: {fmt(R.currentPct)}%</span><span>Target: {R.target}%</span></div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${Math.min(100, Math.max(0, R.currentPct))}%` }} />
          <div className="progress-target-line" style={{ left: `${Math.min(100, Math.max(0, R.target))}%` }} />
        </div>
        <div className="progress-scale"><span>0%</span><span>50%</span><span>100%</span></div>
      </div>

      {R.breakdown.length > 0 && (
        <div className="breakdown-section">
          <div className="breakdown-header">
            <span className="breakdown-title">Upcoming Working Days</span>
            <span className="breakdown-sub">Projected attendance if you attend or skip each day (next {R.breakdown.length} days)</span>
          </div>
          <div className="breakdown-scroll">
            <table className="breakdown-table">
              <thead><tr><th>Date</th><th>Day</th><th>Periods</th><th>If Present</th><th>If Absent</th></tr></thead>
              <tbody>
                {R.breakdown.map((row, i) => (
                  <tr key={row.date} className={i % 2 === 0 ? "row-even" : "row-odd"}>
                    <td className="td-date">{row.date}</td>
                    <td className="td-day">{row.day}</td>
                    <td>{row.classes}</td>
                    <td className={parseFloat(row.ifPresent) >= R.target ? "td-good" : "td-bad"}>{row.ifPresent}%</td>
                    <td className={parseFloat(row.ifAbsent) >= R.target ? "td-ok" : "td-bad"}>{row.ifAbsent}%</td>
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
    <div className={`stat-tile ${accent ? "stat-tile-accent" : ""}`}>
      <div className="stat-tile-val">{value}</div>
      <div className="stat-tile-label">{label}</div>
      {sub && <div className="stat-tile-sub">{sub}</div>}
    </div>
  );
}

// ─── STEPPER PROGRESS BAR ──────────────────────────────────────────
function StepBar({ current, setCurrent, canProceed }) {
  return (
    <div className="stepbar">
      {STEPS.map((name, i) => {
        const done = i < current;
        const active = i === current;
        const reachable = done || active || (i === current + 1 && canProceed);
        return (
          <button key={i} className={`stepbar-item ${active ? "sb-active" : ""} ${done ? "sb-done" : ""}`}
            onClick={() => { if (reachable) setCurrent(i); }} disabled={!reachable}>
            <span className="sb-circle">{done ? <CheckIcon /> : <span>{i + 1}</span>}</span>
            <span className="sb-label">{name}</span>
            {i < STEPS.length - 1 && <span className="sb-connector" />}
          </button>
        );
      })}
    </div>
  );
}

// ─── CSS ───────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=DM+Mono:wght@400;500&display=swap');

:root {
  --c-bg:       #E1DCC9;
  --c-surface:  #EEEEEE;
  --c-surface2: #d8d3be;
  --c-border:   #c8c2ac;
  --c-text:     #000000;
  --c-text2:    #444444;
  --c-text3:    #777777;
  --c-accent:   #FF0000;
  --c-accent-d: #cc0000;
  --c-card:     #EEEEEE;
  --c-invert:   #000000;
  --c-invert-t: #EEEEEE;
  --r: 10px;
  --r-lg: 16px;
  --shadow: 0 1px 3px rgba(0,0,0,0.10), 0 4px 16px rgba(0,0,0,0.06);
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.08);
  font-family: 'DM Sans', sans-serif;
}
[data-theme="dark"] {
  --c-bg:       #0e0e0e;
  --c-surface:  #1a1a1a;
  --c-surface2: #111111;
  --c-border:   #2a2a2a;
  --c-text:     #EEEEEE;
  --c-text2:    #aaaaaa;
  --c-text3:    #666666;
  --c-accent:   #FF0000;
  --c-accent-d: #cc0000;
  --c-card:     #1a1a1a;
  --c-invert:   #EEEEEE;
  --c-invert-t: #000000;
  --shadow: 0 1px 4px rgba(0,0,0,0.4), 0 4px 24px rgba(0,0,0,0.3);
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.3);
}

*,*::before,*::after { box-sizing:border-box; margin:0; padding:0; }
html { font-size:16px; }
body {
  background: var(--c-bg);
  color: var(--c-text);
  font-family: 'DM Sans', sans-serif;
  min-height: 100vh;
  transition: background 0.25s, color 0.25s;
  -webkit-font-smoothing: antialiased;
}
input, button, select, textarea { font-family: inherit; }

.app-root { min-height: 100vh; display: flex; flex-direction: column; }
.app-shell { max-width: 820px; margin: 0 auto; padding: 2rem 1.25rem 3rem; flex: 1; width: 100%; }

/* ── TOPBAR ── */
.topbar { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 2.5rem; gap: 1rem; }
.topbar-eyebrow { font-size: 0.65rem; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: var(--c-text3); margin-bottom: 0.25rem; }
.topbar-title { font-size: clamp(1.8rem, 5vw, 2.8rem); font-weight: 700; letter-spacing: -0.04em; line-height: 1.05; color: var(--c-text); }
.topbar-title span { color: var(--c-accent); }
.topbar-actions { display: flex; align-items: center; gap: 0.6rem; flex-shrink: 0; }

.icon-btn {
  display: flex; align-items: center; justify-content: center;
  width: 38px; height: 38px;
  border-radius: 50%;
  border: 1px solid var(--c-border);
  background: var(--c-surface);
  color: var(--c-text2);
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}
.icon-btn:hover { border-color: var(--c-text); color: var(--c-text); }

.theme-btn {
  display: flex; align-items: center; gap: 0.4rem;
  padding: 0.5rem 0.9rem;
  border-radius: var(--r);
  border: 1px solid var(--c-border);
  background: var(--c-surface);
  color: var(--c-text2);
  font-size: 0.78rem; font-weight: 500;
  cursor: pointer; transition: all 0.15s;
  white-space: nowrap; flex-shrink: 0;
}
.theme-btn:hover { border-color: var(--c-text); color: var(--c-text); }

/* ── HELP MODAL ── */
.help-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.55);
  display: flex; align-items: center; justify-content: center;
  padding: 1.25rem;
  z-index: 1000;
  animation: fadeIn 0.15s ease;
}
@keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
.help-modal {
  background: var(--c-bg);
  border: 1px solid var(--c-border);
  border-radius: var(--r-lg);
  max-width: 460px;
  width: 100%;
  padding: 1.5rem;
  box-shadow: 0 20px 60px rgba(0,0,0,0.35);
  animation: fadeUp 0.2s ease;
  max-height: 90vh;
  overflow-y: auto;
}
.help-modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem; }
.help-modal-title { font-size: 1.15rem; font-weight: 700; letter-spacing: -0.02em; color: var(--c-text); }
.help-close { display: flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 50%; border: none; background: var(--c-surface); color: var(--c-text2); cursor: pointer; transition: all 0.15s; }
.help-close:hover { background: var(--c-text); color: var(--c-bg); }
.help-steps { display: flex; flex-direction: column; gap: 1.1rem; margin-bottom: 1.4rem; }
.help-step { display: flex; gap: 0.9rem; align-items: flex-start; }
.help-step-num {
  width: 30px; height: 30px; border-radius: 50%;
  background: var(--c-text); color: var(--c-bg);
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 0.85rem; flex-shrink: 0;
}
.help-step-title { font-size: 0.92rem; font-weight: 700; color: var(--c-text); margin-bottom: 0.2rem; }
.help-step-desc { font-size: 0.82rem; color: var(--c-text2); line-height: 1.55; }
.help-done-btn { width: 100%; }

/* ── STEP BAR ── */
.stepbar { display: flex; align-items: center; margin-bottom: 2rem; background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--r-lg); padding: 0.5rem; gap: 0; }
.stepbar-item { flex: 1; display: flex; align-items: center; gap: 0; background: none; border: none; cursor: pointer; padding: 0; position: relative; }
.stepbar-item:disabled { cursor: default; opacity: 0.5; }
.sb-circle { width: 32px; height: 32px; border-radius: 50%; border: 2px solid var(--c-border); background: var(--c-bg); display: flex; align-items: center; justify-content: center; font-size: 0.78rem; font-weight: 600; color: var(--c-text3); flex-shrink: 0; transition: all 0.2s; z-index: 1; }
.sb-active .sb-circle { border-color: var(--c-accent); background: var(--c-accent); color: #fff; }
.sb-done .sb-circle { border-color: var(--c-text); background: var(--c-text); color: var(--c-bg); }
.sb-label { font-size: 0.8rem; font-weight: 500; color: var(--c-text3); padding: 0 0.6rem; transition: color 0.2s; white-space: nowrap; }
.sb-active .sb-label { color: var(--c-text); font-weight: 600; }
.sb-done .sb-label { color: var(--c-text2); }
.sb-connector { flex: 1; height: 1px; background: var(--c-border); margin: 0 0.25rem; }

/* ── NAV BUTTONS ── */
.nav-row { display: flex; justify-content: space-between; align-items: center; margin-top: 2rem; gap: 1rem; }
.btn-primary { padding: 0.75rem 1.6rem; border-radius: var(--r); border: none; background: var(--c-text); color: var(--c-bg); font-family: inherit; font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: all 0.15s; letter-spacing: -0.01em; }
.btn-primary:hover { background: var(--c-accent); }
.btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-ghost { padding: 0.75rem 1.6rem; border-radius: var(--r); border: 1px solid var(--c-border); background: transparent; color: var(--c-text2); font-family: inherit; font-size: 0.9rem; font-weight: 500; cursor: pointer; transition: all 0.15s; }
.btn-ghost:hover { border-color: var(--c-text); color: var(--c-text); }

/* ── STEP CONTENT ── */
.step-content { animation: fadeUp 0.25s ease; }
@keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
.step-header { margin-bottom: 1.75rem; }
.step-title { font-size: 1.5rem; font-weight: 700; letter-spacing: -0.03em; color: var(--c-text); margin-bottom: 0.4rem; }
.step-desc { font-size: 0.88rem; color: var(--c-text2); line-height: 1.55; }

/* ── SECTION CARD ── */
.section-card { background: var(--c-card); border: 1px solid var(--c-border); border-radius: var(--r-lg); padding: 1.5rem; margin-bottom: 1rem; box-shadow: var(--shadow-sm); }
.section-card-title { font-size: 0.65rem; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--c-text3); margin-bottom: 1.1rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--c-border); }

/* ── FORMS ── */
.form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
@media (max-width: 540px) { .form-row-2 { grid-template-columns: 1fr; } }
.field-group { display: flex; flex-direction: column; gap: 0.3rem; }
.field-label { font-size: 0.75rem; font-weight: 600; color: var(--c-text2); letter-spacing: 0.04em; text-transform: uppercase; }
.field-hint { font-size: 0.72rem; color: var(--c-text3); line-height: 1.4; }
.optional { font-weight: 400; text-transform: none; color: var(--c-text3); }
.text-input {
  background: var(--c-bg); border: 1px solid var(--c-border); border-radius: var(--r);
  padding: 0.65rem 0.85rem; color: var(--c-text); font-family: 'DM Mono', monospace;
  font-size: 0.9rem; font-weight: 400; outline: none; width: 100%;
  transition: border-color 0.15s, box-shadow 0.15s; -webkit-appearance: none;
}
.text-input:focus { border-color: var(--c-text); box-shadow: 0 0 0 3px rgba(0,0,0,0.08); }
[data-theme="dark"] .text-input:focus { box-shadow: 0 0 0 3px rgba(255,255,255,0.08); }
.text-input::placeholder { color: var(--c-text3); }

/* ── DATE PICKER (fixed) ── */
.dp-wrap { display: flex; flex-direction: column; gap: 0.3rem; }
.dp-input-row { position: relative; display: flex; align-items: stretch; }
.dp-text {
  flex: 1; background: var(--c-bg); border: 1px solid var(--c-border); border-right: none;
  border-radius: var(--r) 0 0 var(--r); padding: 0.65rem 0.85rem; color: var(--c-text);
  font-family: 'DM Mono', monospace; font-size: 0.9rem; outline: none;
  transition: border-color 0.15s; -webkit-appearance: none; min-width: 0;
}
.dp-text:focus { border-color: var(--c-text); }
/* The native date input must stay rendered at a real size (not display:none / 0x0)
   for showPicker()/click() to be honored by the browser. We visually collapse it
   into the calendar button's footprint instead of hiding it entirely. */
.dp-native-visible {
  position: absolute;
  right: 0; top: 0; bottom: 0;
  width: 42px;
  opacity: 0;
  cursor: pointer;
  border: none;
  padding: 0;
  font-size: 16px; /* prevents iOS zoom-on-focus */
}
.dp-cal-btn {
  position: relative;
  display: flex; align-items: center; justify-content: center;
  padding: 0 0.75rem; border: 1px solid var(--c-border); border-radius: 0 var(--r) var(--r) 0;
  background: var(--c-surface); color: var(--c-text2); cursor: pointer;
  transition: all 0.15s; flex-shrink: 0; pointer-events: none;
}
.dp-input-row:hover .dp-cal-btn,
.dp-cal-btn:hover { background: var(--c-text); color: var(--c-bg); border-color: var(--c-text); }
/* re-enable pointer events on the actual button only; the overlapping native
   input sits above it and receives the click, then the button visual updates */
.dp-cal-btn { pointer-events: auto; }
.dp-native-visible { z-index: 2; }
.dp-cal-btn { z-index: 1; }

/* ── TARGET INPUT ── */
.target-input-row { display: flex; align-items: center; gap: 0.5rem; }
.target-input { max-width: 140px; }
.target-pct-symbol { font-size: 1.2rem; font-weight: 600; color: var(--c-text2); }

/* ── INFO BLOCK ── */
.info-block { background: var(--c-surface2); border: 1px solid var(--c-border); border-radius: var(--r); padding: 0.85rem 1rem; font-size: 0.8rem; color: var(--c-text2); line-height: 1.55; margin-top: 1.25rem; }
.info-block strong { color: var(--c-text); }

/* ── SCHEDULE GRID ── */
.schedule-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; }
@media (max-width: 480px) { .schedule-grid { grid-template-columns: repeat(2, 1fr); } }
.schedule-card { background: var(--c-bg); border: 1px solid var(--c-border); border-radius: var(--r-lg); padding: 1.1rem 0.75rem; display: flex; flex-direction: column; align-items: center; gap: 0.5rem; transition: border-color 0.15s; }
.schedule-card:hover { border-color: var(--c-text2); }
.schedule-day-name { font-size: 0.78rem; font-weight: 600; color: var(--c-text); }
.schedule-day-short { font-size: 0.65rem; color: var(--c-text3); letter-spacing: 0.1em; text-transform: uppercase; display: none; }
@media (max-width: 360px) { .schedule-day-name { display: none; } .schedule-day-short { display: block; } }
.stepper { display: flex; align-items: center; gap: 0.6rem; }
.stepper-btn { width: 30px; height: 30px; border-radius: 50%; border: 1px solid var(--c-border); background: var(--c-surface); color: var(--c-text); font-size: 1.1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; line-height: 1; font-weight: 300; }
.stepper-btn:hover { background: var(--c-text); color: var(--c-bg); border-color: var(--c-text); }
.stepper-count { font-family: 'DM Mono', monospace; font-size: 1.2rem; font-weight: 500; color: var(--c-text); min-width: 1.5rem; text-align: center; }
.schedule-unit { font-size: 0.65rem; color: var(--c-text3); text-transform: uppercase; letter-spacing: 0.06em; }

/* ── HOLIDAY MANAGER ── */
.hm-root { display: flex; flex-direction: column; gap: 1rem; }
.hm-divider { display: flex; align-items: center; gap: 0.75rem; color: var(--c-text3); font-size: 0.75rem; }
.hm-divider::before, .hm-divider::after { content: ''; flex: 1; height: 1px; background: var(--c-border); }
.hm-add-row { display: flex; gap: 0.6rem; align-items: stretch; flex-wrap: wrap; }
.hm-add-date { position: relative; display: flex; align-items: stretch; flex: 0 0 auto; }
.hm-add-date .text-input { border-radius: var(--r) 0 0 var(--r); border-right: none; width: 140px; }
.hm-add-label { flex: 1; min-width: 120px; }
.btn-icon-add { display: flex; align-items: center; gap: 0.35rem; padding: 0.65rem 1rem; border-radius: var(--r); border: 1px solid var(--c-text); background: var(--c-text); color: var(--c-bg); font-family: inherit; font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: all 0.15s; white-space: nowrap; }
.btn-icon-add:hover { background: var(--c-accent); border-color: var(--c-accent); }
.hm-list { display: flex; flex-direction: column; gap: 0.4rem; max-height: 240px; overflow-y: auto; }
.hm-list::-webkit-scrollbar { width: 4px; }
.hm-list::-webkit-scrollbar-thumb { background: var(--c-border); border-radius: 2px; }
.hm-row { display: flex; align-items: center; gap: 0.6rem; padding: 0.55rem 0.75rem; background: var(--c-bg); border: 1px solid var(--c-border); border-radius: var(--r); }
.hm-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--c-accent); flex-shrink: 0; }
.hm-date { font-family: 'DM Mono', monospace; font-size: 0.82rem; color: var(--c-text); flex-shrink: 0; }
.hm-label { font-size: 0.8rem; color: var(--c-text2); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hm-remove { display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border: none; background: none; color: var(--c-text3); cursor: pointer; border-radius: 4px; transition: all 0.15s; flex-shrink: 0; }
.hm-remove:hover { background: #ff000015; color: var(--c-accent); }
.hm-empty { font-size: 0.82rem; color: var(--c-text3); text-align: center; padding: 1.25rem; background: var(--c-bg); border: 1px dashed var(--c-border); border-radius: var(--r); }

/* ── COLLEGE PRESETS ── */
.preset-root { display: flex; flex-direction: column; gap: 0.75rem; }
.preset-action-row { display: flex; gap: 0.6rem; flex-wrap: wrap; }
.preset-pill { padding: 0.55rem 1.1rem; border-radius: 100px; border: 1px solid var(--c-border); background: var(--c-bg); color: var(--c-text2); font-family: inherit; font-size: 0.82rem; font-weight: 500; cursor: pointer; transition: all 0.15s; }
.preset-pill:hover { border-color: var(--c-text); color: var(--c-text); }
.preset-pill.active { background: var(--c-text); color: var(--c-bg); border-color: var(--c-text); }
.preset-box { background: var(--c-bg); border: 1px solid var(--c-border); border-radius: var(--r-lg); padding: 1.25rem; animation: fadeUp 0.2s ease; }
.preset-box-title { font-size: 0.9rem; font-weight: 700; color: var(--c-text); margin-bottom: 0.35rem; letter-spacing: -0.02em; }
.preset-box-sub { font-size: 0.78rem; color: var(--c-text2); margin-bottom: 1rem; line-height: 1.5; }
.preset-search { width: 100%; background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--r); padding: 0.65rem 0.85rem; color: var(--c-text); font-family: inherit; font-size: 0.88rem; outline: none; margin-bottom: 0.75rem; transition: border-color 0.15s; -webkit-appearance: none; }
.preset-search:focus { border-color: var(--c-text); }
.preset-search::placeholder { color: var(--c-text3); }
.preset-status { font-size: 0.82rem; color: var(--c-text3); text-align: center; padding: 1rem; }
.preset-list { display: flex; flex-direction: column; gap: 0.5rem; max-height: 260px; overflow-y: auto; }
.preset-list::-webkit-scrollbar { width: 4px; }
.preset-list::-webkit-scrollbar-thumb { background: var(--c-border); border-radius: 2px; }
.preset-row { display: flex; align-items: center; gap: 0.75rem; padding: 0.9rem 1rem; background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--r); transition: border-color 0.15s; }
.preset-row:hover { border-color: var(--c-text2); }
.preset-row-info { flex: 1; display: flex; flex-direction: column; gap: 0.2rem; min-width: 0; }
.preset-row-name { font-size: 0.88rem; font-weight: 600; color: var(--c-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.preset-row-desc { font-size: 0.72rem; color: var(--c-text2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.preset-row-meta { font-size: 0.65rem; color: var(--c-text3); font-family: 'DM Mono', monospace; }
.btn-load { padding: 0.42rem 0.9rem; border-radius: var(--r); border: 1px solid var(--c-border); background: var(--c-surface); color: var(--c-text); font-family: inherit; font-size: 0.78rem; font-weight: 600; cursor: pointer; transition: all 0.15s; flex-shrink: 0; }
.btn-load:hover { background: var(--c-text); color: var(--c-bg); border-color: var(--c-text); }
.save-form { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 0.75rem; }
.preset-note { font-size: 0.7rem; color: var(--c-text3); margin-top: 0.6rem; line-height: 1.5; }
.preset-msg { margin-top: 0.75rem; padding: 0.6rem 0.85rem; border-radius: var(--r); font-size: 0.78rem; border: 1px solid; }
.preset-msg.ok { background: var(--c-surface); border-color: var(--c-text); color: var(--c-text); }
.preset-msg.err { background: #ff000008; border-color: var(--c-accent); color: var(--c-accent); }

/* ── RESULTS ── */
.results-empty { text-align: center; padding: 4rem 1rem; background: var(--c-surface); border: 1px dashed var(--c-border); border-radius: var(--r-lg); }
.results-empty-title { font-size: 1.1rem; font-weight: 600; color: var(--c-text); margin-bottom: 0.4rem; }
.results-empty-sub { font-size: 0.85rem; color: var(--c-text3); }

.result-hero { border-radius: var(--r-lg); border: 1px solid var(--c-border); overflow: hidden; margin-bottom: 1rem; box-shadow: var(--shadow); }
.result-hero.status-safe { border-color: var(--c-text); }
.result-hero.status-warn { border-color: #b86000; }
.result-hero.status-low { border-color: var(--c-accent); }
.result-hero.status-critical { border-color: var(--c-accent); }
.result-hero-inner { background: var(--c-invert); padding: 2rem 2rem 1.5rem; text-align: center; }
.result-pct { font-size: clamp(3.5rem,12vw,5.5rem); font-weight: 700; letter-spacing: -0.05em; color: var(--c-invert-t); line-height: 1; font-family: 'DM Mono', monospace; }
.result-pct-label { font-size: 0.72rem; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--c-invert-t); opacity: 0.5; margin-top: 0.5rem; }
.result-status-badge { display: inline-block; margin-top: 0.85rem; padding: 0.3rem 0.9rem; border-radius: 100px; font-size: 0.75rem; font-weight: 600; letter-spacing: 0.04em; background: rgba(255,255,255,0.12); color: var(--c-invert-t); }
.result-status-badge.status-safe { background: rgba(255,255,255,0.15); }
.result-status-badge.status-warn { background: rgba(184,96,0,0.3); color: #ffb347; }
.result-status-badge.status-low { background: rgba(255,0,0,0.3); color: #ff8888; }
.result-status-badge.status-critical { background: rgba(255,0,0,0.4); color: #ffaaaa; }
.result-hero-meta { display: flex; align-items: center; justify-content: center; gap: 0; background: var(--c-surface); border-top: 1px solid var(--c-border); padding: 1rem; }
.rhm-item { display: flex; flex-direction: column; align-items: center; gap: 0.15rem; flex: 1; }
.rhm-val { font-size: 1.25rem; font-weight: 700; color: var(--c-text); letter-spacing: -0.03em; font-family:'DM Mono',monospace; }
.rhm-key { font-size: 0.62rem; font-weight: 600; color: var(--c-text3); text-transform: uppercase; letter-spacing: 0.1em; }
.rhm-sep { width: 1px; height: 36px; background: var(--c-border); flex-shrink: 0; }

.verdict-card { border-radius: var(--r-lg); padding: 1.1rem 1.4rem; margin-bottom: 1rem; border: 1px solid; font-size: 0.88rem; line-height: 1.65; color: var(--c-text); }
.verdict-card.status-safe { background: var(--c-surface); border-color: var(--c-border); }
.verdict-card.status-warn { background: #fff8f0; border-color: #e8a050; color: #6b3a00; }
.verdict-card.status-low { background: #fff5f5; border-color: #ffb0b0; color: #6b0000; }
.verdict-card.status-critical { background: #fff5f5; border-color: var(--c-accent); color: #8b0000; }
[data-theme="dark"] .verdict-card.status-warn { background: #1a1200; border-color: #8b6000; color: #f0c060; }
[data-theme="dark"] .verdict-card.status-low { background: #1a0000; border-color: #880000; color: #ff9999; }
[data-theme="dark"] .verdict-card.status-critical { background: #1a0000; border-color: var(--c-accent); color: #ffaaaa; }
.verdict-card strong { font-weight: 700; }

.stat-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem; margin-bottom: 0.75rem; }
@media (min-width: 560px) { .stat-grid { grid-template-columns: repeat(4, 1fr); } }
.stat-tile { background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--r-lg); padding: 1.1rem 0.9rem; text-align: center; box-shadow: var(--shadow-sm); }
.stat-tile-accent { background: var(--c-text); border-color: var(--c-text); }
.stat-tile-val { font-size: 1.8rem; font-weight: 700; color: var(--c-text); letter-spacing: -0.04em; font-family: 'DM Mono', monospace; }
.stat-tile-accent .stat-tile-val { color: var(--c-bg); }
.stat-tile-label { font-size: 0.65rem; font-weight: 600; color: var(--c-text3); text-transform: uppercase; letter-spacing: 0.08em; margin-top: 0.3rem; }
.stat-tile-accent .stat-tile-label { color: var(--c-bg); opacity: 0.65; }
.stat-tile-sub { font-size: 0.66rem; color: var(--c-text3); margin-top: 0.25rem; font-family: 'DM Mono', monospace; }
.stat-tile-accent .stat-tile-sub { color: var(--c-bg); opacity: 0.55; }

.projection-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem; }
.projection-card { background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--r-lg); padding: 1.1rem; text-align: center; }
.projection-label { font-size: 0.72rem; color: var(--c-text3); margin-bottom: 0.4rem; line-height: 1.4; }
.projection-val { font-size: 1.5rem; font-weight: 700; font-family:'DM Mono',monospace; letter-spacing:-0.03em; }
.proj-good { color: var(--c-text); }
.proj-bad { color: var(--c-accent); }

.progress-section { background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--r-lg); padding: 1.25rem; margin-bottom: 1rem; }
.progress-labels { display: flex; justify-content: space-between; font-size: 0.75rem; font-weight: 600; color: var(--c-text2); margin-bottom: 0.6rem; }
.progress-track { position: relative; height: 8px; background: var(--c-border); border-radius: 100px; overflow: visible; }
.progress-fill { height: 100%; background: var(--c-text); border-radius: 100px; transition: width 0.4s ease; }
.progress-target-line { position: absolute; top: -4px; bottom: -4px; width: 2px; background: var(--c-accent); border-radius: 1px; transform: translateX(-50%); }
.progress-scale { display: flex; justify-content: space-between; font-size: 0.65rem; color: var(--c-text3); margin-top: 0.5rem; font-family:'DM Mono',monospace; }

.breakdown-section { background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--r-lg); overflow: hidden; box-shadow: var(--shadow-sm); }
.breakdown-header { padding: 1rem 1.25rem 0.75rem; border-bottom: 1px solid var(--c-border); display: flex; flex-direction: column; gap: 0.15rem; }
.breakdown-title { font-size: 0.85rem; font-weight: 700; color: var(--c-text); letter-spacing: -0.01em; }
.breakdown-sub { font-size: 0.72rem; color: var(--c-text3); }
.breakdown-scroll { overflow-x: auto; }
.breakdown-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
.breakdown-table th { text-align: left; padding: 0.55rem 1rem; font-size: 0.62rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--c-text3); background: var(--c-surface); white-space: nowrap; }
.breakdown-table td { padding: 0.6rem 1rem; color: var(--c-text2); white-space: nowrap; font-family: 'DM Mono', monospace; font-size: 0.78rem; }
.row-even { background: var(--c-bg); }
.row-odd { background: var(--c-surface); }
.td-date { color: var(--c-text); font-weight: 500; }
.td-day { color: var(--c-text3); font-family: 'DM Sans', sans-serif; font-size: 0.78rem; }
.td-good { color: var(--c-text); font-weight: 600; }
.td-ok { color: var(--c-text2); }
.td-bad { color: var(--c-accent); font-weight: 600; }

/* ── FOOTER ── */
.app-footer {
  border-top: 1px solid var(--c-border);
  padding: 1.4rem 1.25rem;
  text-align: center;
  display: flex; align-items: center; justify-content: center; gap: 0.4rem;
  font-size: 0.8rem;
  color: var(--c-text3);
}
.app-footer strong { color: var(--c-text2); font-weight: 600; }

/* ── RESPONSIVE ── */
@media (max-width: 600px) {
  .app-shell { padding: 1.25rem 1rem 2.5rem; }
  .topbar { margin-bottom: 1.5rem; }
  .topbar-title { font-size: 1.8rem; }
  .stepbar { padding: 4px; gap: 0; }
  .sb-label { display: none; }
  .sb-circle { width: 28px; height: 28px; font-size: 0.72rem; }
  .sb-connector { margin: 0; }
  .section-card { padding: 1.1rem; }
  .result-hero-inner { padding: 1.5rem 1rem 1rem; }
  .nav-row { flex-direction: column-reverse; }
  .btn-primary, .btn-ghost { width: 100%; text-align: center; }
  .stat-grid { grid-template-columns: repeat(2, 1fr); }
  .projection-row { grid-template-columns: 1fr; }
  .hm-add-row { flex-direction: column; }
  .hm-add-label { min-width: unset; }
  .app-footer { font-size: 0.75rem; padding: 1.1rem 1rem; }
}
@media (max-width: 400px) {
  .schedule-grid { grid-template-columns: repeat(2, 1fr); }
  .form-row-2 { grid-template-columns: 1fr; }
}
`;

// ─── ROOT APP ──────────────────────────────────────────────────────
export default function App() {
  const [theme, setTheme] = useState("light");
  const [step, setStep] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);

  const [schedule, setSchedule] = useState({ 1: 6, 2: 6, 3: 6, 4: 6, 5: 6, 6: 3 });
  const [setupState, setSetupState] = useState({
    semStart: "2025-01-06",
    semEnd: "2025-05-10",
    currentDate: isoToday(),
    attendedClasses: "",
    totalConducted: "",
    targetPct: "75",
  });
  const [holidays, setHolidays] = useState([]);

  function updateSchedule(dow, val) { setSchedule(s => ({ ...s, [dow]: val })); }

  useEffect(() => {
    let el = document.getElementById("__att_css");
    if (!el) { el = document.createElement("style"); el.id = "__att_css"; document.head.appendChild(el); }
    el.textContent = CSS;
  }, []);

  useEffect(() => { document.documentElement.setAttribute("data-theme", theme); }, [theme]);

  const canGoNext = useMemo(() => {
    if (step === 0) return Object.values(schedule).some(v => v > 0);
    if (step === 1) {
      const { semStart, semEnd, attendedClasses, totalConducted, targetPct } = setupState;
      const attended = parseInt(attendedClasses, 10);
      const conducted = parseInt(totalConducted, 10);
      const target = parseFloat(targetPct);
      return !!semStart && !!semEnd && semStart <= semEnd &&
        Number.isFinite(attended) && attended >= 0 &&
        Number.isFinite(conducted) && conducted > 0 &&
        attended <= conducted &&
        Number.isFinite(target) && target > 0 && target <= 100;
    }
    return false;
  }, [step, schedule, setupState]);

  return (
    <div className="app-root">
      <div className="app-shell">
        <div className="topbar">
          <div className="topbar-brand">
            <div className="topbar-eyebrow">Academic Tool</div>
            <h1 className="topbar-title">Attendance<span>.</span></h1>
          </div>
          <div className="topbar-actions">
            <button className="icon-btn" onClick={() => setHelpOpen(true)} title="How it works">
              <HelpIcon />
            </button>
            <button className="theme-btn" onClick={() => setTheme(t => t === "light" ? "dark" : "light")}>
              {theme === "light" ? <><MoonIcon /> Dark</> : <><SunIcon /> Light</>}
            </button>
          </div>
        </div>

        <StepBar current={step} setCurrent={setStep} canProceed={canGoNext} />

        {step === 0 && <StepSchedule schedule={schedule} onChange={updateSchedule} />}
        {step === 1 && <StepSetup state={setupState} setState={setSetupState} holidays={holidays} setHolidays={setHolidays} />}
        {step === 2 && <StepResults state={setupState} holidays={holidays} schedule={schedule} />}

        <div className="nav-row">
          {step > 0 ? <button className="btn-ghost" onClick={() => setStep(s => s - 1)}>Back</button> : <span />}
          {step < 2 && (
            <button className="btn-primary" disabled={!canGoNext} onClick={() => setStep(s => s + 1)}>
              {step === 0 ? "Continue to Setup" : "View Results"}
            </button>
          )}
        </div>
      </div>

      <footer className="app-footer">
        Made with Love <HeartIcon /> by Arceus
      </footer>

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}