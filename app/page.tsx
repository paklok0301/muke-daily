"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Tab = "home" | "work" | "diary";
type Job = { id: string; name: string; rate: number; color: string };
type Shift = {
  id: string;
  jobId: string;
  date: string;
  start: string;
  end: string;
  breakMinutes: number;
};
type Task = { id: string; text: string; done: boolean };
type RunningShift = { jobId: string; startedAt: number } | null;
type WorkoutType = "胸" | "背" | "肩" | "腿";
type AppData = {
  jobs: Job[];
  shifts: Shift[];
  tasks: Task[];
  diary: Record<string, string>;
  workouts: Record<string, WorkoutType>;
  runningShift: RunningShift;
};

const STORAGE_KEY = "muke-app-v1";
const accentColors = ["#9f3d4a", "#b48062", "#767a8a", "#786472"];

const pad = (value: number) => String(value).padStart(2, "0");
const isoDate = (date = new Date()) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const defaultData: AppData = {
  jobs: [
    { id: "taekwondo", name: "跆拳道", rate: 70, color: "#9f3d4a" },
    { id: "tutor", name: "補習", rate: 120, color: "#b48062" },
  ],
  shifts: [],
  tasks: [
    { id: "task-1", text: "確認週末兼職時間", done: false },
    { id: "task-2", text: "整理本週開支", done: false },
  ],
  diary: {},
  workouts: {},
  runningShift: null,
};

function minutesBetween(start: string, end: string, breakMinutes = 0) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let value = eh * 60 + em - (sh * 60 + sm);
  if (value < 0) value += 24 * 60;
  return Math.max(0, value - breakMinutes);
}

function formatHours(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins ? `${hours}h ${mins}m` : `${hours}h`;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("zh-HK", { maximumFractionDigits: 0 }).format(value);
}

function startOfMonth(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function parseIso(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function useClock(running: RunningShift) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [running]);
  if (!running) return "00:00:00";
  const seconds = Math.max(0, Math.floor((now - running.startedAt) / 1000));
  return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`;
}

function MiniCalendar({
  markedDates, workouts, shifts, jobs, diary,
}: {
  markedDates: Set<string>;
  workouts: Record<string, WorkoutType>;
  shifts: Shift[];
  jobs: Job[];
  diary: Record<string, string>;
}) {
  const [view, setView] = useState<"month" | "week" | "day">("month");
  const [selected, setSelected] = useState(isoDate());
  const todayKey = isoDate();
  const selectedDate = parseIso(selected);
  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();
  const days = new Date(year, month + 1, 0).getDate();
  const leading = new Date(year, month, 1).getDay();
  const cells = Array.from({ length: leading + days }, (_, index) => index < leading ? null : index - leading + 1);
  const weekStart = addDays(selectedDate, -selectedDate.getDay());
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const selectedShifts = shifts.filter((shift) => shift.date === selected);

  const title = view === "month"
    ? selectedDate.toLocaleDateString("zh-HK", { year: "numeric", month: "long" })
    : view === "week"
      ? `${weekStart.toLocaleDateString("zh-HK", { month: "short", day: "numeric" })} — ${weekDays[6].toLocaleDateString("zh-HK", { month: "short", day: "numeric" })}`
      : selectedDate.toLocaleDateString("zh-HK", { month: "long", day: "numeric", weekday: "long" });

  function navigate(direction: number) {
    if (view === "day") return setSelected(isoDate(addDays(selectedDate, direction)));
    if (view === "week") return setSelected(isoDate(addDays(selectedDate, direction * 7)));
    const next = new Date(year, month + direction, 1, 12);
    next.setDate(Math.min(selectedDate.getDate(), new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
    setSelected(isoDate(next));
  }

  function hasActivity(date: string) {
    return markedDates.has(date) || Boolean(workouts[date]);
  }

  return (
    <section className="card calendar-card" aria-label="生活月曆">
      <div className="calendar-switch" aria-label="月曆檢視">
        <button className={view === "month" ? "active" : ""} onClick={() => setView("month")}>月</button>
        <button className={view === "week" ? "active" : ""} onClick={() => setView("week")}>週</button>
        <button className={view === "day" ? "active" : ""} onClick={() => setView("day")}>日</button>
      </div>
      <div className="calendar-title-row">
        <button onClick={() => navigate(-1)} aria-label="上一個時段">‹</button>
        <div><span className="eyebrow">Calendar</span><h2>{title}</h2></div>
        <button onClick={() => navigate(1)} aria-label="下一個時段">›</button>
      </div>
      <button className="today-jump" onClick={() => setSelected(todayKey)}>回到今天</button>

      {view === "month" && <>
        <div className="calendar-grid week-labels"><span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span></div>
        <div className="calendar-grid dates">
          {cells.map((day, index) => {
            const key = day ? `${year}-${pad(month + 1)}-${pad(day)}` : `blank-${index}`;
            if (!day) return <span key={key} />;
            return <button key={key} aria-label={`${month + 1}月${day}日`} onClick={() => setSelected(key)} className={`calendar-day ${key === todayKey ? "today" : ""} ${key === selected ? "selected" : ""}`}>
              <span>{day}</span><span className="date-marks">{markedDates.has(key) && <i />}{workouts[key] && <b aria-label={`當日是${workouts[key]}日`} title={`${workouts[key]}日`} />}</span>
            </button>;
          })}
        </div>
      </>}

      {view === "week" && <div className="week-view">
        <div className="week-strip">{weekDays.map((date) => {
          const key = isoDate(date);
          return <button key={key} className={`${key === selected ? "selected" : ""} ${key === todayKey ? "today" : ""}`} onClick={() => setSelected(key)}>
            <small>{date.toLocaleDateString("zh-HK", { weekday: "narrow" })}</small><strong>{date.getDate()}</strong><span>{hasActivity(key) && <i />}{workouts[key] && <b />}</span>
          </button>;
        })}</div>
        <div className="week-summary">
          {weekDays.filter((date) => hasActivity(isoDate(date))).map((date) => {
            const key = isoDate(date);
            const count = shifts.filter((shift) => shift.date === key).length;
            return <button key={key} onClick={() => { setSelected(key); setView("day"); }}><span>{date.toLocaleDateString("zh-HK", { weekday: "short", day: "numeric" })}</span><strong>{[count ? `${count} 段工時` : "", workouts[key] ? `${workouts[key]}日` : "", diary[key]?.trim() ? "有日記" : ""].filter(Boolean).join(" · ")}</strong><em>›</em></button>;
          })}
          {!weekDays.some((date) => hasActivity(isoDate(date))) && <p className="empty-calendar">本週尚未有記錄</p>}
        </div>
      </div>}

      {view === "day" && <div className="day-view">
        {workouts[selected] && <div className="day-event workout-event"><span className="event-icon">練</span><div><small>健身</small><strong>{workouts[selected]}日訓練</strong></div></div>}
        {selectedShifts.map((shift) => <div className="day-event" key={shift.id}><span className="event-icon">時</span><div><small>{jobs.find((job) => job.id === shift.jobId)?.name ?? "兼職"}</small><strong>{shift.start} — {shift.end}</strong></div><em>{formatHours(minutesBetween(shift.start, shift.end, shift.breakMinutes))}</em></div>)}
        {diary[selected]?.trim() && <div className="day-event"><span className="event-icon">記</span><div><small>日記</small><strong>{diary[selected].slice(0, 42)}{diary[selected].length > 42 ? "…" : ""}</strong></div></div>}
        {!hasActivity(selected) && <p className="empty-calendar">這天還沒有記錄。<br />留白也可以是一種休息。</p>}
      </div>}
      <div className="calendar-legend"><span><i />日記／工時</span><span><b />健身</span></div>
    </section>
  );
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("home");
  const [data, setData] = useState<AppData>(defaultData);
  const [hydrated, setHydrated] = useState(false);
  const [taskText, setTaskText] = useState("");
  const [diaryText, setDiaryText] = useState("");
  const [showShiftForm, setShowShiftForm] = useState(false);
  const [showJobForm, setShowJobForm] = useState(false);
  const [jobName, setJobName] = useState("");
  const [jobRate, setJobRate] = useState("");
  const [selectedJob, setSelectedJob] = useState(defaultData.jobs[0].id);
  const [shiftDate, setShiftDate] = useState(isoDate());
  const [shiftStart, setShiftStart] = useState("17:00");
  const [shiftEnd, setShiftEnd] = useState("22:00");
  const [breakMinutes, setBreakMinutes] = useState("0");
  const [shiftError, setShiftError] = useState("");
  const elapsed = useClock(data.runningShift);

  useEffect(() => {
    let nextData = defaultData;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<AppData> & { gymDates?: string[] };
        const migratedWorkouts = parsed.workouts ?? Object.fromEntries((parsed.gymDates ?? []).map((date) => [date, "腿"]));
        const migratedJobs = (parsed.jobs ?? defaultData.jobs).map((job) => job.id === "cafe" || job.name === "咖啡店" ? { ...job, id: "taekwondo", name: "跆拳道" } : job);
        nextData = {
          ...defaultData,
          ...parsed,
          jobs: migratedJobs,
          shifts: (parsed.shifts ?? []).filter((shift) => !shift.id.startsWith("sample-")).map((shift) => shift.jobId === "cafe" ? { ...shift, jobId: "taekwondo" } : shift),
          runningShift: parsed.runningShift?.jobId === "cafe" ? { ...parsed.runningShift, jobId: "taekwondo" } : (parsed.runningShift ?? null),
          workouts: migratedWorkouts as Record<string, WorkoutType>,
        };
      }
    } catch {}
    setData(nextData);
    setDiaryText(nextData.diary[isoDate()] ?? "");
    setHydrated(true);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data, hydrated]);

  const totals = useMemo(() => {
    const month = startOfMonth();
    let minutes = 0;
    let pay = 0;
    const byJob: Record<string, { minutes: number; pay: number }> = {};
    for (const shift of data.shifts.filter((item) => item.date.startsWith(month))) {
      const shiftMinutes = minutesBetween(shift.start, shift.end, shift.breakMinutes);
      const job = data.jobs.find((item) => item.id === shift.jobId);
      const shiftPay = shiftMinutes / 60 * (job?.rate ?? 0);
      minutes += shiftMinutes;
      pay += shiftPay;
      byJob[shift.jobId] ??= { minutes: 0, pay: 0 };
      byJob[shift.jobId].minutes += shiftMinutes;
      byJob[shift.jobId].pay += shiftPay;
    }
    return { minutes, pay, byJob };
  }, [data.jobs, data.shifts]);

  const markedDates = useMemo(() => new Set([
    ...data.shifts.map((item) => item.date),
    ...Object.keys(data.diary).filter((key) => data.diary[key]?.trim()),
  ]), [data.diary, data.shifts]);
  const workoutToday = data.workouts?.[isoDate()];

  const currentJob = data.jobs.find((job) => job.id === (data.runningShift?.jobId ?? selectedJob)) ?? data.jobs[0];

  function addTask(event: FormEvent) {
    event.preventDefault();
    if (!taskText.trim()) return;
    setData((prev) => ({ ...prev, tasks: [{ id: crypto.randomUUID(), text: taskText.trim(), done: false }, ...prev.tasks] }));
    setTaskText("");
  }

  function toggleTask(id: string) {
    setData((prev) => ({ ...prev, tasks: prev.tasks.map((task) => task.id === id ? { ...task, done: !task.done } : task) }));
  }

  function toggleClock() {
    if (!data.runningShift) {
      setData((prev) => ({ ...prev, runningShift: { jobId: selectedJob, startedAt: Date.now() } }));
      return;
    }
    const started = new Date(data.runningShift.startedAt);
    const ended = new Date();
    const running = data.runningShift;
    setData((prev) => ({
      ...prev,
      runningShift: null,
      shifts: [{
        id: crypto.randomUUID(), jobId: running.jobId, date: isoDate(started),
        start: `${pad(started.getHours())}:${pad(started.getMinutes())}`,
        end: `${pad(ended.getHours())}:${pad(ended.getMinutes())}`, breakMinutes: 0,
      }, ...prev.shifts],
    }));
  }

  function saveShift() {
    const duration = minutesBetween(shiftStart, shiftEnd, Number(breakMinutes) || 0);
    if (shiftStart === shiftEnd || duration <= 0) {
      setShiftError("請確認開始、結束及休息時間，工時需要大於 0 分鐘。");
      return;
    }
    setShiftError("");
    setData((prev) => ({ ...prev, shifts: [{
      id: crypto.randomUUID(), jobId: selectedJob, date: shiftDate,
      start: shiftStart, end: shiftEnd, breakMinutes: Number(breakMinutes) || 0,
    }, ...prev.shifts] }));
    setShowShiftForm(false);
  }

  function addJob(event: FormEvent) {
    event.preventDefault();
    if (!jobName.trim() || !Number(jobRate)) return;
    const id = crypto.randomUUID();
    setData((prev) => ({ ...prev, jobs: [...prev.jobs, { id, name: jobName.trim(), rate: Number(jobRate), color: accentColors[prev.jobs.length % accentColors.length] }] }));
    setSelectedJob(id);
    setJobName(""); setJobRate(""); setShowJobForm(false);
  }

  function saveDiary() {
    setData((prev) => ({ ...prev, diary: { ...prev.diary, [isoDate()]: diaryText } }));
  }

  function recordWorkout(type: WorkoutType) {
    const today = isoDate();
    setData((prev) => {
      const workouts = { ...(prev.workouts ?? {}) };
      if (workouts[today] === type) delete workouts[today];
      else workouts[today] = type;
      return { ...prev, workouts };
    });
  }

  function changeTab(next: Tab) {
    const doc = document as Document & { startViewTransition?: (update: () => void) => void };
    if (doc.startViewTransition) doc.startViewTransition(() => setTab(next));
    else setTab(next);
  }

  const todayLabel = new Date().toLocaleDateString("zh-HK", { weekday: "long", month: "long", day: "numeric" });
  const monthLabel = new Date().toLocaleDateString("zh-HK", { month: "long" });

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
      <header className="topbar">
        <div><span className="brand-mark"><i />暮刻</span><p>{todayLabel}</p></div>
        <button className="round-button" aria-label="資料儲存在本機"><span className="storage-dot" />本機</button>
      </header>

      <div className="content" key={tab}>
        {tab === "home" && <>
          <section className="hero">
            <span className="eyebrow">Good evening</span>
            <h1>把今天，<br /><em>好好收住。</em></h1>
            <p>待辦、工時與心情，都在一個安靜的地方。</p>
          </section>

          <section className={`card clock-card ${data.runningShift ? "is-running" : ""}`}>
            <div className="clock-orbit"><div className="clock-dot" /></div>
            <div className="clock-copy">
              <span className="eyebrow">Part-time · {currentJob?.name}</span>
              <strong>{data.runningShift ? elapsed : `HK$ ${formatMoney(totals.pay)}`}</strong>
              <span>{data.runningShift ? `HK$${currentJob?.rate}/小時 · 正在記錄` : `本月 ${formatHours(totals.minutes)} · ${data.shifts.filter(s => s.date.startsWith(startOfMonth())).length} 次`}</span>
            </div>
            {!data.runningShift && <select aria-label="選擇兼職" value={selectedJob} onChange={(e) => setSelectedJob(e.target.value)}>{data.jobs.map((job) => <option key={job.id} value={job.id}>{job.name}</option>)}</select>}
            <button className="primary-button" onClick={toggleClock}>{data.runningShift ? "結束工作" : "開始工作"}</button>
          </section>

          <section className={`card gym-card ${workoutToday ? "checked" : ""}`}>
            <div className="gym-symbol"><span /><i /><span /></div>
            <div className="gym-copy"><span className="eyebrow">Daily movement</span><h2>{workoutToday ? `今天 · ${workoutToday}日` : "今天練哪裡？"}</h2><p>{workoutToday ? "已自動記在今天的月曆上" : "選擇訓練部位，點一下即儲存"}</p></div>
            <div className="workout-options" aria-label="選擇今天的訓練部位">
              {(["胸", "背", "肩", "腿"] as WorkoutType[]).map((type) => <button key={type} className={workoutToday === type ? "selected" : ""} onClick={() => recordWorkout(type)} aria-pressed={workoutToday === type}>{type}</button>)}
            </div>
          </section>

          <section className="card task-card">
            <div className="section-heading"><div><span className="eyebrow">Today</span><h2>今天要做的</h2></div><span className="count">{data.tasks.filter(t => !t.done).length}</span></div>
            <div className="task-list">
              {data.tasks.slice(0, 5).map((task) => <button key={task.id} className={`task-row ${task.done ? "done" : ""}`} onClick={() => toggleTask(task.id)}><span className="check" /> <span>{task.text}</span><small>{task.done ? "完成" : "待辦"}</small></button>)}
            </div>
            <form className="quick-add" onSubmit={addTask}><input value={taskText} onChange={(e) => setTaskText(e.target.value)} placeholder="記一件今天要做的事…" aria-label="新增待辦" /><button aria-label="加入待辦">↗</button></form>
          </section>
          <MiniCalendar markedDates={markedDates} workouts={data.workouts ?? {}} shifts={data.shifts} jobs={data.jobs} diary={data.diary} />
        </>}

        {tab === "work" && <>
          <section className="hero work-hero"><span className="eyebrow">{monthLabel} · Work</span><h1><small>HK$</small>{formatMoney(totals.pay)}</h1><p>本月預計收入 · {formatHours(totals.minutes)}</p></section>
          <section className={`card clock-card work-clock ${data.runningShift ? "is-running" : ""}`}>
            <div className="time-scale"><span /><span /><span /><span /><span /><span /><i style={{ width: data.runningShift ? "68%" : "14%" }} /></div>
            <div className="clock-copy"><span className="eyebrow">Quick clock</span><strong>{data.runningShift ? elapsed : "準備好了嗎？"}</strong><span>{currentJob?.name} · HK${currentJob?.rate}/小時</span></div>
            <select aria-label="選擇兼職" disabled={Boolean(data.runningShift)} value={selectedJob} onChange={(e) => setSelectedJob(e.target.value)}>{data.jobs.map((job) => <option key={job.id} value={job.id}>{job.name}</option>)}</select>
            <button className="primary-button" onClick={toggleClock}>{data.runningShift ? "結束並儲存" : "開始工作"}</button>
          </section>

          <section className="section-block">
            <div className="outside-heading"><div><span className="eyebrow">Jobs</span><h2>我的兼職</h2></div><button className="text-button" onClick={() => setShowJobForm(!showJobForm)}>＋ 新增</button></div>
            {showJobForm && <form className="card compact-form" onSubmit={addJob}><input placeholder="工作名稱" value={jobName} onChange={e => setJobName(e.target.value)} required /><input type="number" inputMode="decimal" placeholder="時薪 HK$" value={jobRate} onChange={e => setJobRate(e.target.value)} required /><button className="primary-button">儲存工作</button></form>}
            <div className="job-grid">{data.jobs.map(job => <div className="card job-card" key={job.id}><i style={{ background: job.color }} /><span>{job.name}</span><strong>HK${formatMoney(totals.byJob[job.id]?.pay ?? 0)}</strong><small>{formatHours(totals.byJob[job.id]?.minutes ?? 0)} · HK${job.rate}/h</small></div>)}</div>
          </section>

          <section className="card history-card">
            <div className="section-heading"><div><span className="eyebrow">History</span><h2>最近記錄</h2></div><button className="text-button" onClick={() => setShowShiftForm(!showShiftForm)}>＋ 補錄</button></div>
            {showShiftForm && <form className="shift-form" onSubmit={(event) => { event.preventDefault(); saveShift(); }}>
              <label>兼職<select value={selectedJob} onChange={e => setSelectedJob(e.target.value)}>{data.jobs.map(job => <option value={job.id} key={job.id}>{job.name}</option>)}</select></label>
              <label>日期<input type="date" value={shiftDate} onChange={e => setShiftDate(e.target.value)} /></label>
              <div className="form-pair"><label>開始<input type="time" value={shiftStart} onChange={e => setShiftStart(e.target.value)} /></label><label>結束<input type="time" value={shiftEnd} onChange={e => setShiftEnd(e.target.value)} /></label></div>
              <label>休息分鐘<input type="number" inputMode="numeric" min="0" value={breakMinutes} onChange={e => setBreakMinutes(e.target.value)} /></label>
              {shiftError && <p className="form-error" role="alert">{shiftError}</p>}
              <button className="primary-button" type="button" onClick={saveShift}>儲存這次工時</button>
            </form>}
            <div className="history-list">{data.shifts.slice(0, 6).map(shift => {
              const job = data.jobs.find(item => item.id === shift.jobId);
              const mins = minutesBetween(shift.start, shift.end, shift.breakMinutes);
              return <div className="history-row" key={shift.id}><span className="date-tile"><b>{Number(shift.date.slice(-2))}</b><small>{new Date(`${shift.date}T12:00:00`).toLocaleDateString("zh-HK", { month: "short" })}</small></span><div><strong>{job?.name ?? "兼職"}</strong><small>{shift.start}—{shift.end}{shift.breakMinutes ? ` · 休息 ${shift.breakMinutes}m` : ""}</small></div><span className="pay"><b>HK${formatMoney(mins / 60 * (job?.rate ?? 0))}</b><small>{formatHours(mins)}</small></span></div>;
            })}</div>
            {!data.shifts.length && !showShiftForm && <p className="empty-history">還未有工時記錄。按「補錄」或直接開始工作。</p>}
          </section>
        </>}

        {tab === "diary" && <>
          <section className="hero diary-hero"><span className="eyebrow">Daily note</span><h1>今天，<br /><em>想留下甚麼？</em></h1><p>{todayLabel}</p></section>
          <section className="card diary-card"><textarea value={diaryText} onChange={e => setDiaryText(e.target.value)} placeholder="寫下一件值得記住的小事、一個念頭，或只是今天的心情……" aria-label="今日日記" /><div className="diary-actions"><span>{diaryText.length} 字</span><button className="primary-button small" onClick={saveDiary}>儲存日記</button></div></section>
          <section className="whisper-card"><span className="eyebrow">Tonight&apos;s whisper</span><blockquote>「生活不是被安排好的日程，<br />而是你願意記住的那些片刻。」</blockquote></section>
          <MiniCalendar markedDates={markedDates} workouts={data.workouts ?? {}} shifts={data.shifts} jobs={data.jobs} diary={data.diary} />
        </>}
      </div>

      <nav className="bottom-nav" aria-label="主要導覽">
        <button className={tab === "home" ? "active" : ""} onClick={() => changeTab("home")}><span>⌂</span>今天</button>
        <button className={tab === "work" ? "active" : ""} onClick={() => changeTab("work")}><span>◷</span>工時</button>
        <button className={tab === "diary" ? "active" : ""} onClick={() => changeTab("diary")}><span>✦</span>日記</button>
      </nav>
    </main>
  );
}
