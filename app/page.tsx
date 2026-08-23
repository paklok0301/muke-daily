"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";

type Tab = "home" | "plan" | "work" | "diary";
type Job = { id: string; name: string; rate: number; color: string };
type Shift = {
  id: string;
  jobId: string;
  date: string;
  start: string;
  end: string;
  breakMinutes: number;
  jobName?: string;
  rate?: number;
  location?: string;
  sessions?: number;
  amount?: number;
};
type Task = { id: string; text: string; done: boolean };
type PlanItem = { id: string; activity: string; date: string; time: string; color: string; done: boolean; notified: boolean };
type WorkoutType = "胸" | "背" | "肩" | "腿";
type AppData = {
  jobs: Job[];
  shifts: Shift[];
  tasks: Task[];
  plans: PlanItem[];
  diary: Record<string, string>;
  workouts: Record<string, WorkoutType>;
};

const STORAGE_KEY = "muke-app-v1";
const accentColors = ["#9f3d4a", "#b48062", "#767a8a", "#786472"];
const planColors = ["#d75b68", "#dd8b51", "#c7ad4b", "#65ad7b", "#4ea2aa", "#6683cf", "#9471c7", "#cc66a3"];
const planColorNames = ["珊瑚紅", "琥珀橙", "麥穗金", "翡翠綠", "湖水藍", "靛青藍", "紫藤紫", "玫瑰粉"];

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
  plans: [],
  diary: {},
  workouts: {},
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

function shiftEarnings(shift: Shift, job?: Job) {
  if (typeof shift.amount === "number") return shift.amount;
  return minutesBetween(shift.start, shift.end, shift.breakMinutes) / 60 * (shift.rate ?? job?.rate ?? 0);
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

function MiniCalendar({
  markedDates, workouts, shifts, jobs, diary, plans, holidays,
}: {
  markedDates: Set<string>;
  workouts: Record<string, WorkoutType>;
  shifts: Shift[];
  jobs: Job[];
  diary: Record<string, string>;
  plans: PlanItem[];
  holidays: Record<string, string>;
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
  const selectedPlans = plans.filter((plan) => plan.date === selected && !plan.done).sort((a, b) => a.time.localeCompare(b.time));

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
    return markedDates.has(date) || Boolean(workouts[date]) || Boolean(holidays[date]);
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
            const dayPlans = plans.filter((plan) => plan.date === key && !plan.done).sort((a, b) => a.time.localeCompare(b.time));
            const holiday = holidays[key];
            const isSunday = new Date(year, month, day, 12).getDay() === 0;
            return <button key={key} aria-label={`${month + 1}月${day}日${holiday ? `，${holiday}` : ""}`} onClick={() => { setSelected(key); setView("day"); }} className={`calendar-day ${key === todayKey ? "today" : ""} ${key === selected ? "selected" : ""} ${holiday ? "holiday" : ""} ${isSunday ? "sunday" : ""}`}>
              <span className="day-number">{day}</span>
              {holiday && <span className="holiday-label" title={holiday}>{holiday}</span>}
              {dayPlans.slice(0, 1).map((plan) => <span className="calendar-plan-bar" style={{ background: plan.color }} key={plan.id}>{plan.time} {plan.activity}</span>)}
              {dayPlans.length > 1 && <span className="more-plans">＋{dayPlans.length - 1}</span>}
              <span className="date-marks">{markedDates.has(key) && !dayPlans.length && <i />}{workouts[key] && <b aria-label={`當日是${workouts[key]}日`} title={`${workouts[key]}日`} />}</span>
            </button>;
          })}
        </div>
      </>}

      {view === "week" && <div className="week-view">
        <div className="week-strip">{weekDays.map((date) => {
          const key = isoDate(date);
          const firstPlan = plans.find((plan) => plan.date === key && !plan.done);
          return <button key={key} className={`${key === selected ? "selected" : ""} ${key === todayKey ? "today" : ""} ${holidays[key] ? "holiday" : ""}`} onClick={() => setSelected(key)}>
            <small>{date.toLocaleDateString("zh-HK", { weekday: "narrow" })}</small><strong>{date.getDate()}</strong><span>{hasActivity(key) && <i style={firstPlan ? { background: firstPlan.color } : undefined} />}{workouts[key] && <b />}</span>
          </button>;
        })}</div>
        <div className="week-summary">
          {weekDays.filter((date) => hasActivity(isoDate(date))).map((date) => {
            const key = isoDate(date);
            const count = shifts.filter((shift) => shift.date === key).length;
            const planCount = plans.filter((plan) => plan.date === key && !plan.done).length;
            return <button key={key} onClick={() => { setSelected(key); setView("day"); }}><span>{date.toLocaleDateString("zh-HK", { weekday: "short", day: "numeric" })}</span><strong>{[holidays[key] ?? "", planCount ? `${planCount} 項計劃` : "", count ? `${count} 段工時` : "", workouts[key] ? `${workouts[key]}日` : "", diary[key]?.trim() ? "有日記" : ""].filter(Boolean).join(" · ")}</strong><em>›</em></button>;
          })}
          {!weekDays.some((date) => hasActivity(isoDate(date))) && <p className="empty-calendar">本週尚未有記錄</p>}
        </div>
      </div>}

      {view === "day" && <div className="day-view">
        {holidays[selected] && <div className="day-event holiday-event"><span className="event-icon">假</span><div><small>香港公眾假期</small><strong>{holidays[selected]}</strong></div></div>}
        {selectedPlans.map((plan) => <div className="day-event plan-event" key={plan.id}><span className="event-icon" style={{ background: plan.color }}>行</span><div><small>計劃 · {plan.time}</small><strong>{plan.activity}</strong></div></div>)}
        {workouts[selected] && <div className="day-event workout-event"><span className="event-icon">練</span><div><small>健身</small><strong>{workouts[selected]}日訓練</strong></div></div>}
        {selectedShifts.map((shift) => {
          const job = jobs.find((item) => item.id === shift.jobId);
          return <div className="day-event" key={shift.id}><span className="event-icon">時</span><div><small>{job?.name ?? shift.jobName ?? "已刪除工作"}{shift.location ? ` · ${shift.location}` : ""}</small><strong>{shift.start} — {shift.end}{shift.sessions ? ` · ${shift.sessions} 堂` : ""}</strong></div><em>HK${formatMoney(shiftEarnings(shift, job))}</em></div>;
        })}
        {diary[selected]?.trim() && <div className="day-event"><span className="event-icon">記</span><div><small>日記</small><strong>{diary[selected].slice(0, 42)}{diary[selected].length > 42 ? "…" : ""}</strong></div></div>}
        {!hasActivity(selected) && <p className="empty-calendar">這天還沒有記錄。<br />留白也可以是一種休息。</p>}
      </div>}
      <div className="calendar-legend"><span><u />公眾假期</span><span><i />日記／工時</span><span><em />活動</span><span><b />健身</span></div>
      <p className="holiday-source">假期資料：香港政府 1823 · 每日自動更新</p>
    </section>
  );
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("home");
  const [data, setData] = useState<AppData>(defaultData);
  const [hydrated, setHydrated] = useState(false);
  const [taskText, setTaskText] = useState("");
  const [diaryText, setDiaryText] = useState("");
  const [planActivity, setPlanActivity] = useState("");
  const [planDate, setPlanDate] = useState(isoDate(addDays(new Date(), 1)));
  const [planTime, setPlanTime] = useState("09:00");
  const [planColor, setPlanColor] = useState(planColors[4]);
  const [planError, setPlanError] = useState("");
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");
  const [holidays, setHolidays] = useState<Record<string, string>>({});
  const [showDataTools, setShowDataTools] = useState(false);
  const [dataMessage, setDataMessage] = useState("");
  const [showShiftForm, setShowShiftForm] = useState(false);
  const [showJobForm, setShowJobForm] = useState(false);
  const [jobName, setJobName] = useState("");
  const [jobRate, setJobRate] = useState("");
  const [jobError, setJobError] = useState("");
  const [selectedJob, setSelectedJob] = useState(defaultData.jobs[0].id);
  const [shiftDate, setShiftDate] = useState(isoDate());
  const [shiftStart, setShiftStart] = useState("17:00");
  const [shiftEnd, setShiftEnd] = useState("22:00");
  const [breakMinutes, setBreakMinutes] = useState("0");
  const [shiftLocation, setShiftLocation] = useState("");
  const [shiftSessions, setShiftSessions] = useState("1");
  const [shiftAmount, setShiftAmount] = useState("");
  const [shiftError, setShiftError] = useState("");

  useEffect(() => {
    let nextData = defaultData;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<AppData> & { gymDates?: string[]; runningShift?: unknown };
        delete parsed.runningShift;
        const migratedWorkouts = parsed.workouts ?? Object.fromEntries((parsed.gymDates ?? []).map((date) => [date, "腿"]));
        const migratedJobs = (parsed.jobs ?? defaultData.jobs).map((job) => job.id === "cafe" || job.name === "咖啡店" ? { ...job, id: "taekwondo", name: "跆拳道" } : job);
        nextData = {
          ...defaultData,
          ...parsed,
          jobs: migratedJobs,
          shifts: (parsed.shifts ?? []).filter((shift) => !shift.id.startsWith("sample-")).map((shift) => shift.jobId === "cafe" ? { ...shift, jobId: "taekwondo" } : shift),
          plans: (parsed.plans ?? []).map((plan, index) => ({ ...plan, color: plan.color ?? planColors[index % planColors.length] })),
          workouts: migratedWorkouts as Record<string, WorkoutType>,
        };
      }
    } catch {}
    setData(nextData);
    setDiaryText(nextData.diary[isoDate()] ?? "");
    if ("Notification" in window) setNotificationPermission(Notification.permission);
    setHydrated(true);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data, hydrated]);

  useEffect(() => {
    let active = true;
    fetch("/api/hk-holidays").then((response) => response.ok ? response.json() : Promise.reject()).then((payload: { holidays?: Record<string, string> }) => {
      if (active && payload.holidays) setHolidays(payload.holidays);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!hydrated || notificationPermission !== "granted") return;
    const notifyDuePlans = () => {
      const now = Date.now();
      const dueIds = data.plans.filter((plan) => !plan.done && !plan.notified && new Date(`${plan.date}T${plan.time}:00`).getTime() <= now).map((plan) => plan.id);
      if (!dueIds.length) return;
      for (const plan of data.plans.filter((item) => dueIds.includes(item.id))) {
        navigator.serviceWorker.ready.then((registration) => registration.showNotification("暮刻提醒", {
          body: `${plan.time} · ${plan.activity}`,
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          tag: `plan-${plan.id}`,
        })).catch(() => undefined);
      }
      setData((prev) => ({ ...prev, plans: prev.plans.map((plan) => dueIds.includes(plan.id) ? { ...plan, notified: true } : plan) }));
    };
    notifyDuePlans();
    const timer = window.setInterval(notifyDuePlans, 30_000);
    return () => window.clearInterval(timer);
  }, [data.plans, hydrated, notificationPermission]);

  const totals = useMemo(() => {
    const month = startOfMonth();
    let minutes = 0;
    let pay = 0;
    let sessions = 0;
    const byJob: Record<string, { minutes: number; pay: number }> = {};
    for (const shift of data.shifts.filter((item) => item.date.startsWith(month))) {
      const shiftMinutes = minutesBetween(shift.start, shift.end, shift.breakMinutes);
      const job = data.jobs.find((item) => item.id === shift.jobId);
      const shiftPay = shiftEarnings(shift, job);
      minutes += shiftMinutes;
      pay += shiftPay;
      sessions += shift.sessions ?? 0;
      byJob[shift.jobId] ??= { minutes: 0, pay: 0 };
      byJob[shift.jobId].minutes += shiftMinutes;
      byJob[shift.jobId].pay += shiftPay;
    }
    return { minutes, pay, sessions, byJob };
  }, [data.jobs, data.shifts]);

  const markedDates = useMemo(() => new Set([
    ...data.shifts.map((item) => item.date),
    ...data.plans.filter((item) => !item.done).map((item) => item.date),
    ...Object.keys(data.diary).filter((key) => data.diary[key]?.trim()),
  ]), [data.diary, data.plans, data.shifts]);
  const workoutToday = data.workouts?.[isoDate()];

  const sortedPlans = useMemo(() => [...data.plans].sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`)), [data.plans]);

  function addTask(event: FormEvent) {
    event.preventDefault();
    if (!taskText.trim()) return;
    setData((prev) => ({ ...prev, tasks: [{ id: crypto.randomUUID(), text: taskText.trim(), done: false }, ...prev.tasks] }));
    setTaskText("");
  }

  function toggleTask(id: string) {
    setData((prev) => ({ ...prev, tasks: prev.tasks.map((task) => task.id === id ? { ...task, done: !task.done } : task) }));
  }

  function addPlan(event: FormEvent) {
    event.preventDefault();
    if (!planActivity.trim() || !planDate || !planTime) {
      setPlanError("請填寫活動、日期和確實時間。");
      return;
    }
    setPlanError("");
    setData((prev) => ({
      ...prev,
      plans: [...prev.plans, { id: crypto.randomUUID(), activity: planActivity.trim(), date: planDate, time: planTime, color: planColor, done: false, notified: false }],
    }));
    setPlanActivity("");
  }

  function togglePlan(id: string) {
    setData((prev) => ({ ...prev, plans: prev.plans.map((plan) => plan.id === id ? { ...plan, done: !plan.done } : plan) }));
  }

  function deletePlan(id: string) {
    setData((prev) => ({ ...prev, plans: prev.plans.filter((plan) => plan.id !== id) }));
  }

  async function enableNotifications() {
    if (!("Notification" in window)) {
      setPlanError("這個瀏覽器不支援通知；你仍可把項目加入手機行事曆。");
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
  }

  function addToPhoneCalendar(plan: PlanItem) {
    const start = new Date(`${plan.date}T${plan.time}:00`);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const calendarTime = (date: Date) => `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`;
    const safeActivity = plan.activity.replaceAll("\\", "\\\\").replaceAll(",", "\\,").replaceAll(";", "\\;").replaceAll("\n", "\\n");
    const content = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Muke//Plan//ZH-HK", "BEGIN:VEVENT",
      `UID:${plan.id}@muke`, `DTSTART:${calendarTime(start)}`, `DTEND:${calendarTime(end)}`,
      `SUMMARY:${safeActivity}`, "BEGIN:VALARM", "TRIGGER:-PT10M", "ACTION:DISPLAY", `DESCRIPTION:${safeActivity}`, "END:VALARM",
      "END:VEVENT", "END:VCALENDAR",
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/calendar;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${plan.date}-${plan.time.replace(":", "")}-暮刻.ics`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function saveShift() {
    const duration = minutesBetween(shiftStart, shiftEnd, Number(breakMinutes) || 0);
    if (shiftStart === shiftEnd || duration <= 0) {
      setShiftError("請確認開始、結束及休息時間，工時需要大於 0 分鐘。");
      return;
    }
    const savedJob = data.jobs.find((job) => job.id === selectedJob);
    setShiftError("");
    setData((prev) => ({ ...prev, shifts: [{
      id: crypto.randomUUID(), jobId: selectedJob, date: shiftDate,
      start: shiftStart, end: shiftEnd, breakMinutes: Number(breakMinutes) || 0,
      jobName: savedJob?.name, rate: savedJob?.rate,
      location: shiftLocation.trim() || undefined,
      sessions: Number(shiftSessions) > 0 ? Number(shiftSessions) : undefined,
      amount: shiftAmount === "" ? undefined : Math.max(0, Number(shiftAmount) || 0),
    }, ...prev.shifts] }));
    setShiftLocation("");
    setShiftSessions("1");
    setShiftAmount("");
    setShowShiftForm(false);
  }

  function addJob(event: FormEvent) {
    event.preventDefault();
    if (!jobName.trim() || !Number(jobRate)) return;
    const id = crypto.randomUUID();
    setData((prev) => ({ ...prev, jobs: [...prev.jobs, { id, name: jobName.trim(), rate: Number(jobRate), color: accentColors[prev.jobs.length % accentColors.length] }] }));
    setSelectedJob(id);
    setJobName(""); setJobRate(""); setJobError(""); setShowJobForm(false);
  }

  function deleteJob(id: string) {
    const job = data.jobs.find((item) => item.id === id);
    if (!job) return;
    if (data.jobs.length <= 1) {
      setJobError("至少需要保留一個工作。");
      return;
    }
    if (!window.confirm(`確定刪除「${job.name}」？過往工時記錄會保留。`)) return;
    const remainingJobs = data.jobs.filter((item) => item.id !== id);
    setData((prev) => ({
      ...prev,
      jobs: prev.jobs.filter((item) => item.id !== id),
      shifts: prev.shifts.map((shift) => shift.jobId === id ? { ...shift, jobName: shift.jobName ?? job.name, rate: shift.rate ?? job.rate } : shift),
    }));
    if (selectedJob === id) setSelectedJob(remainingJobs[0].id);
    setJobError("");
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

  function exportData() {
    const backup = JSON.stringify({ app: "暮刻", version: 1, exportedAt: new Date().toISOString(), data }, null, 2);
    const url = URL.createObjectURL(new Blob([backup], { type: "application/json;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `暮刻備份-${isoDate()}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setDataMessage("備份已下載，可以在新網址匯入。");
  }

  async function importData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!window.confirm("匯入會取代這部裝置目前的暮刻資料，確定繼續？")) return;
    try {
      const payload = JSON.parse(await file.text()) as { data?: Partial<AppData> } | Partial<AppData>;
      const imported = "data" in payload && payload.data ? payload.data : payload;
      if (!Array.isArray(imported.jobs) || !imported.jobs.length || !Array.isArray(imported.shifts) || !Array.isArray(imported.tasks) || !Array.isArray(imported.plans)) throw new Error();
      const restored: AppData = {
        jobs: imported.jobs,
        shifts: imported.shifts,
        tasks: imported.tasks,
        plans: imported.plans,
        diary: imported.diary && typeof imported.diary === "object" ? imported.diary : {},
        workouts: imported.workouts && typeof imported.workouts === "object" ? imported.workouts : {},
      };
      setData(restored);
      setSelectedJob(restored.jobs[0].id);
      setDiaryText(restored.diary[isoDate()] ?? "");
      setDataMessage("資料已成功匯入這部裝置。");
    } catch {
      setDataMessage("無法匯入：請選擇由暮刻下載的 JSON 備份檔。");
    }
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
        <button className="round-button" aria-label="開啟資料管理" onClick={() => { setShowDataTools(true); setDataMessage(""); }}><span className="storage-dot" />本機</button>
      </header>

      {showDataTools && <div className="data-overlay" role="presentation" onClick={() => setShowDataTools(false)}>
        <section className="card data-panel" role="dialog" aria-modal="true" aria-labelledby="data-title" onClick={(event) => event.stopPropagation()}>
          <div className="data-panel-heading"><div><span className="eyebrow">Local data</span><h2 id="data-title">資料管理</h2></div><button onClick={() => setShowDataTools(false)} aria-label="關閉資料管理">×</button></div>
          <p>所有記錄只儲存在這部裝置。換網址或換手機前，請先下載備份。</p>
          <div className="data-actions">
            <button className="primary-button" onClick={exportData}>下載備份</button>
            <label className="quiet-action" htmlFor="data-import">匯入備份</label>
            <input id="data-import" className="visually-hidden" type="file" accept="application/json,.json" onChange={importData} />
          </div>
          {dataMessage && <p className="data-message" role="status">{dataMessage}</p>}
        </section>
      </div>}

      <div className="content" key={tab}>
        {tab === "home" && <>
          <section className="hero">
            <span className="eyebrow">Good evening</span>
            <h1>Remember<br /><em>who you are.</em></h1>
            <p>待辦、計劃與心情，都在一個安靜的地方。</p>
          </section>

          <MiniCalendar markedDates={markedDates} workouts={data.workouts ?? {}} shifts={data.shifts} jobs={data.jobs} diary={data.diary} plans={data.plans} holidays={holidays} />

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
        </>}

        {tab === "plan" && <>
          <section className="card plan-form-card">
            <div className="section-heading"><div><span className="eyebrow">New event</span><h2>新增活動</h2></div><span className="count">＋</span></div>
            <form className="plan-form" onSubmit={addPlan}>
              <label>活動<input value={planActivity} onChange={(event) => setPlanActivity(event.target.value)} placeholder="例如：跆拳道訓練" aria-label="活動名稱" /></label>
              <div className="form-pair"><label>日期<input type="date" value={planDate} onChange={(event) => setPlanDate(event.target.value)} /></label><label>確實時間<input type="time" value={planTime} onChange={(event) => setPlanTime(event.target.value)} /></label></div>
              <fieldset className="color-picker"><legend>活動顏色</legend><div>{planColors.map((color, index) => <button type="button" key={color} aria-label={`選擇${planColorNames[index]}`} title={planColorNames[index]} aria-pressed={planColor === color} className={planColor === color ? "selected" : ""} style={{ background: color }} onClick={() => setPlanColor(color)} />)}</div></fieldset>
              {planError && <p className="form-error" role="alert">{planError}</p>}
              <button className="primary-button" type="submit">加入計劃</button>
            </form>
          </section>

          <section className="hero plan-hero plan-hero-after"><span className="eyebrow">Plan ahead</span><h1>留一個位置，<br /><em>給未來的事。</em></h1><p>準確日期、時間、活動與顏色，一眼便看懂。</p></section>
          <MiniCalendar markedDates={markedDates} workouts={data.workouts ?? {}} shifts={data.shifts} jobs={data.jobs} diary={data.diary} plans={data.plans} holidays={holidays} />

          <section className="card notification-card">
            <div><span className="eyebrow">Reminder</span><h2>{notificationPermission === "granted" ? "到點通知已開啟" : "不要錯過這件事"}</h2><p>開啟 App 通知；再把重要項目加入手機行事曆，即使 App 關閉也會可靠提醒。</p></div>
            <button className="quiet-action" onClick={enableNotifications} disabled={notificationPermission !== "default"}>{notificationPermission === "granted" ? "已開啟" : notificationPermission === "denied" ? "到設定開啟" : "開啟通知"}</button>
          </section>

          <section className="section-block plan-list-section">
            <div className="outside-heading"><div><span className="eyebrow">Upcoming</span><h2>接下來</h2></div><span className="plan-total">{data.plans.filter((plan) => !plan.done).length} 項</span></div>
            <div className="plan-list">{sortedPlans.map((plan) => <article className={`card plan-row ${plan.done ? "done" : ""}`} key={plan.id} style={{ borderLeftColor: plan.color }}>
              <button className="plan-check" aria-label={plan.done ? "標記為未完成" : "標記為完成"} onClick={() => togglePlan(plan.id)}><span /></button>
              <div className="plan-copy"><small>{parseIso(plan.date).toLocaleDateString("zh-HK", { month: "long", day: "numeric", weekday: "short" })}</small><strong>{plan.time}</strong><p>{plan.activity}</p></div>
              <div className="plan-actions"><button onClick={() => addToPhoneCalendar(plan)} aria-label={`把${plan.activity}加入手機行事曆`}>加入行事曆</button><button className="delete-plan" onClick={() => deletePlan(plan.id)} aria-label={`刪除${plan.activity}`}>刪除</button></div>
            </article>)}</div>
            {!sortedPlans.length && <p className="empty-plans">暫時沒有未來活動。<br />把下一件重要的事放進來吧。</p>}
          </section>
        </>}

        {tab === "work" && <>
          <section className="hero work-hero"><span className="eyebrow">{monthLabel} · Work</span><h1><small>HK$</small>{formatMoney(totals.pay)}</h1><p>本月預計收入 · {formatHours(totals.minutes)}</p></section>

          <section className="section-block">
            <div className="outside-heading"><div><span className="eyebrow">Jobs</span><h2>我的兼職</h2></div><button className="text-button" onClick={() => setShowJobForm(!showJobForm)}>＋ 新增</button></div>
            {showJobForm && <form className="card compact-form" onSubmit={addJob}><input placeholder="工作名稱" value={jobName} onChange={e => setJobName(e.target.value)} required /><input type="number" inputMode="decimal" placeholder="時薪 HK$" value={jobRate} onChange={e => setJobRate(e.target.value)} required /><button className="primary-button">儲存工作</button></form>}
            <div className="job-grid">{data.jobs.map(job => <div className="card job-card" key={job.id}><div className="job-card-top"><i style={{ background: job.color }} /><button onClick={() => deleteJob(job.id)} aria-label={`刪除${job.name}`}>刪除</button></div><span>{job.name}</span><strong>HK${formatMoney(totals.byJob[job.id]?.pay ?? 0)}</strong><small>{formatHours(totals.byJob[job.id]?.minutes ?? 0)} · HK${job.rate}/h</small></div>)}</div>
            {jobError && <p className="form-error job-error" role="alert">{jobError}</p>}
          </section>

          <section className="card history-card">
            <div className="section-heading"><div><span className="eyebrow">History</span><h2>最近記錄</h2></div><button className="text-button" onClick={() => setShowShiftForm(!showShiftForm)}>＋ 補錄</button></div>
            <div className="history-summary" aria-label="本月工作結算"><div><small>本月應收</small><strong>HK${formatMoney(totals.pay)}</strong></div><div><small>堂／節數</small><strong>{totals.sessions}</strong></div><div><small>總工時</small><strong>{formatHours(totals.minutes)}</strong></div></div>
            {showShiftForm && <form className="shift-form" onSubmit={(event) => { event.preventDefault(); saveShift(); }}>
              <label>兼職<select value={selectedJob} onChange={e => setSelectedJob(e.target.value)}>{data.jobs.map(job => <option value={job.id} key={job.id}>{job.name}</option>)}</select></label>
              <label>日期<input type="date" value={shiftDate} onChange={e => setShiftDate(e.target.value)} /></label>
              <div className="form-pair"><label>開始<input type="time" value={shiftStart} onChange={e => setShiftStart(e.target.value)} /></label><label>結束<input type="time" value={shiftEnd} onChange={e => setShiftEnd(e.target.value)} /></label></div>
              <label>休息分鐘<input type="number" inputMode="numeric" min="0" value={breakMinutes} onChange={e => setBreakMinutes(e.target.value)} /></label>
              <label>地點<input value={shiftLocation} onChange={e => setShiftLocation(e.target.value)} placeholder="例如：灣仔道場" /></label>
              <div className="form-pair"><label>堂數／節數<input type="number" inputMode="numeric" min="1" step="1" value={shiftSessions} onChange={e => setShiftSessions(e.target.value)} /></label><label>實收金額 HK$<input type="number" inputMode="decimal" min="0" step="0.01" value={shiftAmount} onChange={e => setShiftAmount(e.target.value)} placeholder="留空則按時薪" /></label></div>
              {shiftError && <p className="form-error" role="alert">{shiftError}</p>}
              <button className="primary-button" type="button" onClick={saveShift}>儲存這次工時</button>
            </form>}
            <div className="history-list">{data.shifts.slice(0, 6).map(shift => {
              const job = data.jobs.find(item => item.id === shift.jobId);
              const mins = minutesBetween(shift.start, shift.end, shift.breakMinutes);
              return <div className="history-row" key={shift.id}><span className="date-tile"><b>{Number(shift.date.slice(-2))}</b><small>{new Date(`${shift.date}T12:00:00`).toLocaleDateString("zh-HK", { month: "short" })}</small></span><div className="history-copy"><strong>{job?.name ?? shift.jobName ?? "已刪除工作"}</strong><small>{shift.start}—{shift.end}{shift.breakMinutes ? ` · 休息 ${shift.breakMinutes}m` : ""}</small>{(shift.location || shift.sessions) && <span className="shift-meta">{shift.location && <i>⌖ {shift.location}</i>}{shift.sessions && <i>{shift.sessions} 堂／節</i>}</span>}</div><span className="pay"><b>HK${formatMoney(shiftEarnings(shift, job))}</b><small>{formatHours(mins)}</small></span></div>;
            })}</div>
            {!data.shifts.length && !showShiftForm && <p className="empty-history">還未有工時記錄。按「補錄」加入第一次記錄。</p>}
          </section>
        </>}

        {tab === "diary" && <>
          <section className="hero diary-hero"><span className="eyebrow">Daily note</span><h1>今天，<br /><em>想留下甚麼？</em></h1><p>{todayLabel}</p></section>
          <section className="card diary-card"><textarea value={diaryText} onChange={e => setDiaryText(e.target.value)} placeholder="寫下一件值得記住的小事、一個念頭，或只是今天的心情……" aria-label="今日日記" /><div className="diary-actions"><span>{diaryText.length} 字</span><button className="primary-button small" onClick={saveDiary}>儲存日記</button></div></section>
          <section className="whisper-card"><span className="eyebrow">Tonight&apos;s whisper</span><blockquote>「生活不是被安排好的日程，<br />而是你願意記住的那些片刻。」</blockquote></section>
          <MiniCalendar markedDates={markedDates} workouts={data.workouts ?? {}} shifts={data.shifts} jobs={data.jobs} diary={data.diary} plans={data.plans} holidays={holidays} />
        </>}
      </div>

      <nav className="bottom-nav" aria-label="主要導覽">
        <button className={tab === "home" ? "active" : ""} onClick={() => changeTab("home")}><span>⌂</span>今天</button>
        <button className={tab === "plan" ? "active" : ""} onClick={() => changeTab("plan")}><span>◇</span>計劃</button>
        <button className={tab === "work" ? "active" : ""} onClick={() => changeTab("work")}><span>◷</span>工時</button>
        <button className={tab === "diary" ? "active" : ""} onClick={() => changeTab("diary")}><span>✦</span>日記</button>
      </nav>
    </main>
  );
}
