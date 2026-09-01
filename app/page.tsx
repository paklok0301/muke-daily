"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";

type Tab = "home" | "activity" | "campus" | "work";
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
type PlanItem = { id: string; activity: string; date: string; time: string; color: string; emoji?: string; reminderDays?: number; done: boolean; notified: boolean; calendarAdded?: boolean };
type RecurringClass = { id: string; name: string; emoji: string; weekday: number; startTime: string; endTime: string; startDate: string; endDate: string; location?: string; color: string };
type Assignment = { id: string; course: string; title: string; emoji: string; dueDate: string; dueTime: string; color: string; done: boolean; reminded: boolean; calendarAdded?: boolean };
type AgendaItem = { id: string; time: string; endTime?: string; emoji: string; label: string; detail?: string; kind: "活動" | "課堂" | "死線"; color: string };
type WorkoutType = "胸" | "背" | "肩" | "腿";
type NativeMessageHandler = { postMessage: (payload: unknown) => void };
type NativeBridgeWindow = Window & { webkit?: { messageHandlers?: { mukeSync?: NativeMessageHandler; mukeNativeSettings?: NativeMessageHandler } } };
type AppData = {
  jobs: Job[];
  shifts: Shift[];
  tasks: Task[];
  plans: PlanItem[];
  classes: RecurringClass[];
  assignments: Assignment[];
  classReminderLog: string[];
  diary: Record<string, string>; // Legacy backup field; no longer shown in the app.
  workouts: Record<string, WorkoutType>;
  campusCalendarDownloaded: boolean;
  notificationSetupDone: boolean;
  scheduleReminderDays: number;
  assignmentReminderDays: number;
  lastBackupAt?: string;
};

const STORAGE_KEY = "muke-app-v1";
const accentColors = ["#9f3d4a", "#b48062", "#767a8a", "#786472"];
const planColors = ["#d75b68", "#dd8b51", "#c7ad4b", "#65ad7b", "#4ea2aa", "#6683cf", "#9471c7", "#cc66a3"];
const planColorNames = ["珊瑚紅", "琥珀橙", "麥穗金", "翡翠綠", "湖水藍", "靛青藍", "紫藤紫", "玫瑰粉"];
const emojiOptions = ["📌", "🎓", "📚", "💻", "🧪", "🧮", "🎨", "📝", "🏫", "✨"];
const weekdayNames = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];

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
  classes: [],
  assignments: [],
  classReminderLog: [],
  diary: {},
  workouts: {},
  campusCalendarDownloaded: false,
  notificationSetupDone: false,
  scheduleReminderDays: 1,
  assignmentReminderDays: 7,
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

function classOccursOn(item: RecurringClass, dateKey: string) {
  if (dateKey < item.startDate || dateKey > item.endDate) return false;
  return parseIso(dateKey).getDay() === item.weekday;
}

function classesOnDate(classes: RecurringClass[], dateKey: string) {
  return classes.filter((item) => classOccursOn(item, dateKey)).sort((a, b) => a.startTime.localeCompare(b.startTime));
}

function agendaOnDate(plans: PlanItem[], classes: RecurringClass[], assignments: Assignment[], dateKey: string): AgendaItem[] {
  return [
    ...plans.filter((item) => !item.done && item.date === dateKey).map((item) => ({ id: `plan-${item.id}`, time: item.time, emoji: item.emoji ?? "📌", label: item.activity, kind: "活動" as const, color: item.color })),
    ...classesOnDate(classes, dateKey).map((item) => ({ id: `class-${item.id}-${dateKey}`, time: item.startTime, endTime: item.endTime, emoji: item.emoji, label: item.name, detail: item.location, kind: "課堂" as const, color: item.color })),
    ...assignments.filter((item) => !item.done && item.dueDate === dateKey).map((item) => ({ id: `assignment-${item.id}`, time: item.dueTime, emoji: item.emoji, label: `${item.course} · ${item.title}`, kind: "死線" as const, color: item.color })),
  ].sort((a, b) => a.time.localeCompare(b.time));
}

function agendaFingerprint(parts: string[]) {
  let hash = 2166136261;
  for (const character of [...parts].sort().join("\u001f")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function firstClassOccurrence(item: RecurringClass) {
  let date = parseIso(item.startDate);
  for (let count = 0; count < 7 && date.getDay() !== item.weekday; count += 1) date = addDays(date, 1);
  return isoDate(date) <= item.endDate ? date : null;
}

function calendarTime(date: Date) {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`;
}

function escapeCalendarText(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll(",", "\\,").replaceAll(";", "\\;").replaceAll("\n", "\\n");
}

function downloadCalendar(content: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/calendar;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function MiniCalendar({
  markedDates, workouts, shifts, jobs, plans, classes, assignments, holidays,
}: {
  markedDates: Set<string>;
  workouts: Record<string, WorkoutType>;
  shifts: Shift[];
  jobs: Job[];
  plans: PlanItem[];
  classes: RecurringClass[];
  assignments: Assignment[];
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
  const selectedClasses = classesOnDate(classes, selected);
  const selectedAssignments = assignments.filter((assignment) => assignment.dueDate === selected && !assignment.done).sort((a, b) => a.dueTime.localeCompare(b.dueTime));

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
    return markedDates.has(date) || classes.some((item) => classOccursOn(item, date)) || assignments.some((item) => item.dueDate === date && !item.done) || Boolean(workouts[date]) || Boolean(holidays[date]);
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
            const dayClasses = classesOnDate(classes, key);
            const dayAssignments = assignments.filter((assignment) => assignment.dueDate === key && !assignment.done);
            const daySchedule = [
              ...dayPlans.map((plan) => ({ id: plan.id, time: plan.time, label: `${plan.emoji ?? "📌"} ${plan.activity}`, color: plan.color })),
              ...dayClasses.map((item) => ({ id: item.id, time: item.startTime, label: `${item.emoji} ${item.name}`, color: item.color })),
              ...dayAssignments.map((item) => ({ id: item.id, time: item.dueTime, label: `${item.emoji} ${item.course}`, color: item.color })),
            ].sort((a, b) => a.time.localeCompare(b.time));
            const holiday = holidays[key];
            const isSunday = new Date(year, month, day, 12).getDay() === 0;
            return <button key={key} aria-label={`${month + 1}月${day}日${holiday ? `，${holiday}` : ""}`} onClick={() => { setSelected(key); setView("day"); }} className={`calendar-day ${key === todayKey ? "today" : ""} ${key === selected ? "selected" : ""} ${holiday ? "holiday" : ""} ${isSunday ? "sunday" : ""}`}>
              <span className="day-number">{day}</span>
              {holiday && <span className="holiday-label" title={holiday}>{holiday}</span>}
              {daySchedule.slice(0, 1).map((item) => <span className="calendar-plan-bar" style={{ background: item.color }} key={`${item.id}-${key}`}>{item.time} {item.label}</span>)}
              {daySchedule.length > 1 && <span className="more-plans">＋{daySchedule.length - 1}</span>}
              <span className="date-marks">{markedDates.has(key) && !daySchedule.length && <i />}{workouts[key] && <b aria-label={`當日是${workouts[key]}日`} title={`${workouts[key]}日`} />}</span>
            </button>;
          })}
        </div>
      </>}

      {view === "week" && <div className="week-view">
        <div className="week-strip">{weekDays.map((date) => {
          const key = isoDate(date);
          const firstPlan = plans.find((plan) => plan.date === key && !plan.done);
          const firstClass = classesOnDate(classes, key)[0];
          const firstAssignment = assignments.find((assignment) => assignment.dueDate === key && !assignment.done);
          return <button key={key} className={`${key === selected ? "selected" : ""} ${key === todayKey ? "today" : ""} ${holidays[key] ? "holiday" : ""}`} onClick={() => setSelected(key)}>
            <small>{date.toLocaleDateString("zh-HK", { weekday: "narrow" })}</small><strong>{date.getDate()}</strong><span>{hasActivity(key) && <i style={firstPlan || firstClass || firstAssignment ? { background: firstPlan?.color ?? firstClass?.color ?? firstAssignment?.color } : undefined} />}{workouts[key] && <b />}</span>
          </button>;
        })}</div>
        <div className="week-summary">
          {weekDays.filter((date) => hasActivity(isoDate(date))).map((date) => {
            const key = isoDate(date);
            const count = shifts.filter((shift) => shift.date === key).length;
            const planCount = plans.filter((plan) => plan.date === key && !plan.done).length;
            const classCount = classesOnDate(classes, key).length;
            const assignmentCount = assignments.filter((assignment) => assignment.dueDate === key && !assignment.done).length;
            return <button key={key} onClick={() => { setSelected(key); setView("day"); }}><span>{date.toLocaleDateString("zh-HK", { weekday: "short", day: "numeric" })}</span><strong>{[holidays[key] ?? "", classCount ? `${classCount} 堂課` : "", assignmentCount ? `${assignmentCount} 項功課` : "", planCount ? `${planCount} 項計劃` : "", count ? `${count} 段工時` : "", workouts[key] ? `${workouts[key]}日` : ""].filter(Boolean).join(" · ")}</strong><em>›</em></button>;
          })}
          {!weekDays.some((date) => hasActivity(isoDate(date))) && <p className="empty-calendar">本週尚未有記錄</p>}
        </div>
      </div>}

      {view === "day" && <div className="day-view">
        {holidays[selected] && <div className="day-event holiday-event"><span className="event-icon">假</span><div><small>香港公眾假期</small><strong>{holidays[selected]}</strong></div></div>}
        {selectedClasses.map((item) => <div className="day-event class-event" key={`${item.id}-${selected}`}><span className="event-icon" style={{ background: item.color }}>{item.emoji}</span><div><small>每週課堂 · {item.startTime}—{item.endTime}</small><strong>{item.name}{item.location ? ` · ${item.location}` : ""}</strong></div></div>)}
        {selectedAssignments.map((assignment) => <div className="day-event assignment-event" key={assignment.id}><span className="event-icon" style={{ background: assignment.color }}>{assignment.emoji}</span><div><small>功課死線 · {assignment.dueTime}</small><strong>{assignment.course} · {assignment.title}</strong></div></div>)}
        {selectedPlans.map((plan) => <div className="day-event plan-event" key={plan.id}><span className="event-icon" style={{ background: plan.color }}>{plan.emoji ?? "📌"}</span><div><small>計劃 · {plan.time}</small><strong>{plan.activity}</strong></div></div>)}
        {workouts[selected] && <div className="day-event workout-event"><span className="event-icon">練</span><div><small>健身</small><strong>{workouts[selected]}日訓練</strong></div></div>}
        {selectedShifts.map((shift) => {
          const job = jobs.find((item) => item.id === shift.jobId);
          return <div className="day-event" key={shift.id}><span className="event-icon">時</span><div><small>{job?.name ?? shift.jobName ?? "已刪除工作"}{shift.location ? ` · ${shift.location}` : ""}</small><strong>{shift.start} — {shift.end}{shift.sessions ? ` · ${shift.sessions} 堂` : ""}</strong></div><em>HK${formatMoney(shiftEarnings(shift, job))}</em></div>;
        })}
        {!hasActivity(selected) && <p className="empty-calendar">這天還沒有記錄。<br />留白也可以是一種休息。</p>}
      </div>}
      <div className="calendar-legend"><span><u />假期</span><span><i />工時</span><span><em />活動／課堂／功課</span><span><b />健身</span></div>
      <p className="holiday-source">假期資料：香港政府 1823 · 2025–2027</p>
    </section>
  );
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("home");
  const [data, setData] = useState<AppData>(defaultData);
  const [hydrated, setHydrated] = useState(false);
  const [nativeMode, setNativeMode] = useState(false);
  const [taskText, setTaskText] = useState("");
  const [planActivity, setPlanActivity] = useState("");
  const [planDate, setPlanDate] = useState(isoDate(addDays(new Date(), 1)));
  const [planTime, setPlanTime] = useState("09:00");
  const [planColor, setPlanColor] = useState(planColors[4]);
  const [planEmoji, setPlanEmoji] = useState(emojiOptions[0]);
  const [planError, setPlanError] = useState("");
  const [planFeedback, setPlanFeedback] = useState("");
  const [addPlanToCalendar, setAddPlanToCalendar] = useState(true);
  const [showClassForm, setShowClassForm] = useState(false);
  const [className, setClassName] = useState("");
  const [classEmoji, setClassEmoji] = useState("🎓");
  const [classWeekday, setClassWeekday] = useState(new Date().getDay());
  const [classStartTime, setClassStartTime] = useState("09:00");
  const [classEndTime, setClassEndTime] = useState("10:30");
  const [classStartDate, setClassStartDate] = useState(isoDate());
  const [classEndDate, setClassEndDate] = useState(isoDate(addDays(new Date(), 120)));
  const [classLocation, setClassLocation] = useState("");
  const [classColor, setClassColor] = useState(planColors[5]);
  const [classError, setClassError] = useState("");
  const [showAssignmentForm, setShowAssignmentForm] = useState(false);
  const [assignmentCourse, setAssignmentCourse] = useState("");
  const [assignmentTitle, setAssignmentTitle] = useState("");
  const [assignmentEmoji, setAssignmentEmoji] = useState("📝");
  const [assignmentDueDate, setAssignmentDueDate] = useState(isoDate(addDays(new Date(), 7)));
  const [assignmentDueTime, setAssignmentDueTime] = useState("23:59");
  const [assignmentColor, setAssignmentColor] = useState(planColors[6]);
  const [assignmentError, setAssignmentError] = useState("");
  const [campusSelectedDate, setCampusSelectedDate] = useState(isoDate());
  const [showReminderSettings, setShowReminderSettings] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");
  const [holidays, setHolidays] = useState<Record<string, string>>({});
  const [showDataTools, setShowDataTools] = useState(false);
  const [dataMessage, setDataMessage] = useState("");
  const [storagePersistent, setStoragePersistent] = useState<boolean | null>(null);
  const [storageMessage, setStorageMessage] = useState("");
  const [showShiftForm, setShowShiftForm] = useState(false);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [workMonth, setWorkMonth] = useState(startOfMonth());
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
          plans: (parsed.plans ?? []).map((plan, index) => ({ ...plan, emoji: plan.emoji ?? "📌", reminderDays: plan.reminderDays ?? 1, color: plan.color ?? planColors[index % planColors.length] })),
          classes: Array.isArray(parsed.classes) ? parsed.classes : [],
          assignments: Array.isArray(parsed.assignments) ? parsed.assignments : [],
          classReminderLog: Array.isArray(parsed.classReminderLog) ? parsed.classReminderLog : [],
          workouts: migratedWorkouts as Record<string, WorkoutType>,
          scheduleReminderDays: [1, 2, 3].includes(Number(parsed.scheduleReminderDays)) ? Number(parsed.scheduleReminderDays) : 1,
          assignmentReminderDays: [3, 7, 14].includes(Number(parsed.assignmentReminderDays)) ? Number(parsed.assignmentReminderDays) : 7,
        };
      }
    } catch {}
    if ("Notification" in window && Notification.permission !== "default") nextData = { ...nextData, notificationSetupDone: true };
    // Browser-only persisted state can only be hydrated after the server render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData(nextData);
    setNativeMode(Boolean((window as NativeBridgeWindow).webkit?.messageHandlers?.mukeSync));
    if ("Notification" in window) setNotificationPermission(Notification.permission);
    navigator.storage?.persisted?.().then(setStoragePersistent).catch(() => setStoragePersistent(null));
    setHydrated(true);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register(new URL("sw.js", document.baseURI).pathname).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      (window as NativeBridgeWindow).webkit?.messageHandlers?.mukeSync?.postMessage(data);
    } catch {
      // Surface failures from the external browser storage system to the user.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDataMessage("儲存空間不足，請先下載備份並清理瀏覽器空間。");
    }
  }, [data, hydrated]);

  useEffect(() => {
    let active = true;
    const serverSource = new URL("api/hk-holidays", document.baseURI);
    const staticSource = new URL("hk-holidays.json", document.baseURI);
    fetch(serverSource).then((response) => response.ok ? response.json() : Promise.reject()).catch(() => fetch(staticSource).then((response) => response.ok ? response.json() : Promise.reject())).then((payload: { holidays?: Record<string, string> }) => {
      if (active && payload.holidays) setHolidays(payload.holidays);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!hydrated || nativeMode || notificationPermission !== "granted") return;
    let notificationInFlight = false;
    const notifyUpcoming = async () => {
      if (notificationInFlight) return;
      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;
      const reminderDateKey = isoDate(addDays(new Date(), data.scheduleReminderDays));
      const reminderDateLabel = data.scheduleReminderDays === 1 ? "明日" : `${data.scheduleReminderDays} 日後`;
      const duePlans = data.plans.filter((plan) => !plan.done && plan.date === reminderDateKey);
      const dueAssignments = data.assignments.filter((assignment) => {
        const dueAt = new Date(`${assignment.dueDate}T${assignment.dueTime}:00`).getTime();
        return !assignment.done && !assignment.reminded && dueAt > now && dueAt - data.assignmentReminderDays * day <= now;
      });
      const dueClasses = classesOnDate(data.classes, reminderDateKey);
      const reminderDateAssignments = data.assignments.filter((assignment) => !assignment.done && assignment.dueDate === reminderDateKey);
      const reminderAgenda = [
        ...duePlans.map((plan) => ({ time: plan.time, text: `${plan.emoji ?? "📌"} ${plan.activity}` })),
        ...dueClasses.map((item) => ({ time: item.startTime, text: `${item.emoji} ${item.name}` })),
        ...reminderDateAssignments.map((item) => ({ time: item.dueTime, text: `${item.emoji} ${item.course} 截止` })),
      ].sort((a, b) => a.time.localeCompare(b.time));
      const agendaKey = `agenda:${data.scheduleReminderDays}:${reminderDateKey}:${agendaFingerprint([
        ...duePlans.map((item) => `plan:${item.id}:${item.time}:${item.activity}`),
        ...dueClasses.map((item) => `class:${item.id}:${item.startTime}:${item.name}`),
        ...reminderDateAssignments.map((item) => `assignment:${item.id}:${item.dueTime}:${item.title}`),
      ])}`;
      const shouldSendAgenda = reminderAgenda.length > 0 && !data.classReminderLog.includes(agendaKey);
      if (!shouldSendAgenda && !dueAssignments.length) return;
      notificationInFlight = true;
      try {
        const registration = await navigator.serviceWorker.ready;
        let agendaSent = false;
        const sentAssignmentIds = new Set<string>();
        if (shouldSendAgenda) {
          try {
            await registration.showNotification(`🗓️ ${reminderDateLabel}行程 · ${reminderAgenda.length} 項`, {
              body: reminderAgenda.map((item) => `${item.time} ${item.text}`).join(" · "),
              icon: new URL("icon-192.png", document.baseURI).href,
              badge: new URL("icon-192.png", document.baseURI).href,
              tag: `agenda-${reminderDateKey}`,
            });
            agendaSent = true;
          } catch {}
        }
        for (const assignment of dueAssignments) {
          try {
            await registration.showNotification(`${assignment.emoji} 功課死線提醒`, {
              body: `${assignment.course} · ${assignment.title} · ${assignment.dueDate} ${assignment.dueTime}`,
              icon: new URL("icon-192.png", document.baseURI).href,
              badge: new URL("icon-192.png", document.baseURI).href,
              tag: `assignment-${assignment.id}`,
            });
            sentAssignmentIds.add(assignment.id);
          } catch {}
        }
        if (!agendaSent && !sentAssignmentIds.size) return;
        const planIds = new Set(duePlans.map((plan) => plan.id));
        setData((prev) => ({
          ...prev,
          plans: agendaSent ? prev.plans.map((plan) => planIds.has(plan.id) ? { ...plan, notified: true } : plan) : prev.plans,
          assignments: prev.assignments.map((assignment) => sentAssignmentIds.has(assignment.id) ? { ...assignment, reminded: true } : assignment),
          classReminderLog: agendaSent ? [...prev.classReminderLog.filter((key) => (key.split(":")[2] ?? "") >= isoDate(addDays(new Date(), -14))), agendaKey] : prev.classReminderLog,
        }));
      } catch {
        // Keep reminder flags untouched so the next interval can retry.
      } finally {
        notificationInFlight = false;
      }
    };
    void notifyUpcoming();
    const timer = window.setInterval(() => { void notifyUpcoming(); }, 30_000);
    return () => window.clearInterval(timer);
  }, [data.assignmentReminderDays, data.assignments, data.classReminderLog, data.classes, data.plans, data.scheduleReminderDays, hydrated, nativeMode, notificationPermission]);

  useEffect(() => {
    if (!hydrated) return;
    const badgeNavigator = navigator as Navigator & { setAppBadge?: (value?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    const today = isoDate();
    const badgeCount = data.tasks.filter((task) => !task.done).length + data.plans.filter((plan) => !plan.done && plan.date <= today).length + data.assignments.filter((assignment) => !assignment.done && assignment.dueDate <= today).length;
    if (badgeCount && badgeNavigator.setAppBadge) badgeNavigator.setAppBadge(badgeCount).catch(() => undefined);
    else if (!badgeCount && badgeNavigator.clearAppBadge) badgeNavigator.clearAppBadge().catch(() => undefined);
  }, [data.assignments, data.plans, data.tasks, hydrated]);

  const totals = useMemo(() => {
    let minutes = 0;
    let pay = 0;
    let sessions = 0;
    const byJob: Record<string, { minutes: number; pay: number }> = {};
    for (const shift of data.shifts.filter((item) => item.date.startsWith(workMonth))) {
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
  }, [data.jobs, data.shifts, workMonth]);

  const markedDates = useMemo(() => new Set([
    ...data.shifts.map((item) => item.date),
    ...data.plans.filter((item) => !item.done).map((item) => item.date),
    ...data.assignments.filter((item) => !item.done).map((item) => item.dueDate),
  ]), [data.assignments, data.plans, data.shifts]);
  const workoutToday = data.workouts?.[isoDate()];

  const sortedPlans = useMemo(() => [...data.plans].sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`)), [data.plans]);
  const sortedClasses = useMemo(() => [...data.classes].sort((a, b) => `${a.weekday}-${a.startTime}`.localeCompare(`${b.weekday}-${b.startTime}`)), [data.classes]);
  const sortedAssignments = useMemo(() => [...data.assignments].sort((a, b) => `${a.dueDate}T${a.dueTime}`.localeCompare(`${b.dueDate}T${b.dueTime}`)), [data.assignments]);
  const sortedTasks = useMemo(() => [...data.tasks].sort((a, b) => Number(a.done) - Number(b.done)), [data.tasks]);
  const workShifts = useMemo(() => data.shifts.filter((shift) => shift.date.startsWith(workMonth)).sort((a, b) => `${b.date}T${b.start}`.localeCompare(`${a.date}T${a.start}`)), [data.shifts, workMonth]);
  const todayPlans = useMemo(() => data.plans.filter((plan) => plan.date === isoDate() && !plan.done).sort((a, b) => a.time.localeCompare(b.time)), [data.plans]);
  const todayClasses = useMemo(() => classesOnDate(data.classes, isoDate()), [data.classes]);
  const todayAssignments = useMemo(() => data.assignments.filter((assignment) => assignment.dueDate === isoDate() && !assignment.done).sort((a, b) => a.dueTime.localeCompare(b.dueTime)), [data.assignments]);
  const campusWeekDates = useMemo(() => Array.from({ length: 7 }, (_, index) => isoDate(addDays(new Date(), index))), []);
  const campusSelectedAgenda = useMemo(() => agendaOnDate(data.plans, data.classes, data.assignments, campusSelectedDate), [campusSelectedDate, data.assignments, data.classes, data.plans]);
  const nextAssignment = useMemo(() => sortedAssignments.find((item) => !item.done && new Date(`${item.dueDate}T${item.dueTime}:00`).getTime() >= Date.now()), [sortedAssignments]);
  const nextSchedule = useMemo(() => {
    const now = new Date();
    const candidates: { id: string; label: string; date: string; time: string; emoji: string; destination: "activity" | "campus" }[] = [
      ...data.plans.filter((plan) => !plan.done).map((plan) => ({ id: plan.id, label: plan.activity, date: plan.date, time: plan.time, emoji: plan.emoji ?? "📌", destination: "activity" as const })),
      ...data.assignments.filter((assignment) => !assignment.done).map((assignment) => ({ id: assignment.id, label: `${assignment.course} · ${assignment.title}`, date: assignment.dueDate, time: assignment.dueTime, emoji: assignment.emoji, destination: "campus" as const })),
    ];
    for (const item of data.classes) {
      let date = parseIso(isoDate());
      for (let count = 0; count <= 7; count += 1) {
        const key = isoDate(date);
        if (classOccursOn(item, key) && new Date(`${key}T${item.startTime}:00`) >= now) {
          candidates.push({ id: `${item.id}-${key}`, label: item.name, date: key, time: item.startTime, emoji: item.emoji, destination: "campus" });
          break;
        }
        date = addDays(date, 1);
      }
    }
    return candidates.filter((item) => new Date(`${item.date}T${item.time}:00`) >= now).sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))[0];
  }, [data.assignments, data.classes, data.plans]);
  const todayShiftSummary = useMemo(() => data.shifts.filter((shift) => shift.date === isoDate()).reduce((summary, shift) => {
    const job = data.jobs.find((item) => item.id === shift.jobId);
    summary.minutes += minutesBetween(shift.start, shift.end, shift.breakMinutes);
    summary.pay += shiftEarnings(shift, job);
    return summary;
  }, { minutes: 0, pay: 0 }), [data.jobs, data.shifts]);
  const notificationsConfigured = data.notificationSetupDone || notificationPermission !== "default";
  const showCampusSync = !nativeMode && (!data.campusCalendarDownloaded || !notificationsConfigured);

  function addTask(event: FormEvent) {
    event.preventDefault();
    if (!taskText.trim()) return;
    setData((prev) => ({ ...prev, tasks: [{ id: crypto.randomUUID(), text: taskText.trim(), done: false }, ...prev.tasks] }));
    setTaskText("");
  }

  function toggleTask(id: string) {
    setData((prev) => ({ ...prev, tasks: prev.tasks.map((task) => task.id === id ? { ...task, done: !task.done } : task) }));
  }

  function deleteTask(id: string) {
    setData((prev) => ({ ...prev, tasks: prev.tasks.filter((task) => task.id !== id) }));
  }

  function clearCompletedTasks() {
    setData((prev) => ({ ...prev, tasks: prev.tasks.filter((task) => !task.done) }));
  }

  function addPlan(event: FormEvent) {
    event.preventDefault();
    if (!planActivity.trim() || !planDate || !planTime) {
      setPlanError("請填寫活動、日期和確實時間。");
      return;
    }
    const shouldDownloadCalendar = addPlanToCalendar && !nativeMode;
    const nextPlan: PlanItem = {
      id: crypto.randomUUID(), activity: planActivity.trim(), date: planDate, time: planTime,
      color: planColor, emoji: planEmoji, reminderDays: data.scheduleReminderDays,
      done: false, notified: false, calendarAdded: nativeMode || addPlanToCalendar,
    };
    setPlanError("");
    setData((prev) => ({
      ...prev,
      campusCalendarDownloaded: false,
      plans: [...prev.plans, nextPlan],
    }));
    if (shouldDownloadCalendar) downloadPlanCalendar(nextPlan);
    setPlanFeedback(nativeMode ? "活動已送往 iPhone；獲授權後會自動同步行事曆與鎖屏。" : addPlanToCalendar ? "活動已儲存並下載。請在 iPhone 開啟 .ics 檔，再按「加入」。" : "活動已儲存在暮刻；之後仍可在下方加入手機行事曆。");
    setPlanActivity("");
  }

  function addRecurringClass(event: FormEvent) {
    event.preventDefault();
    if (!className.trim() || !classStartDate || !classEndDate || !classStartTime || !classEndTime) {
      setClassError("請填寫課堂、日期及時間。");
      return;
    }
    if (classStartDate > classEndDate || classStartTime >= classEndTime) {
      setClassError("請確認學期日期及下課時間。");
      return;
    }
    setData((prev) => ({ ...prev, campusCalendarDownloaded: false, classes: [...prev.classes, {
      id: crypto.randomUUID(), name: className.trim(), emoji: classEmoji, weekday: classWeekday,
      startTime: classStartTime, endTime: classEndTime, startDate: classStartDate, endDate: classEndDate,
      location: classLocation.trim() || undefined, color: classColor,
    }] }));
    setClassName(""); setClassLocation(""); setClassError(""); setShowClassForm(false);
  }

  function deleteRecurringClass(id: string) {
    const item = data.classes.find((entry) => entry.id === id);
    if (!item || !window.confirm(`確定刪除整個學期的「${item.name}」？`)) return;
    setData((prev) => ({ ...prev, campusCalendarDownloaded: false, classes: prev.classes.filter((entry) => entry.id !== id) }));
  }

  function addAssignment(event: FormEvent) {
    event.preventDefault();
    if (!assignmentCourse.trim() || !assignmentTitle.trim() || !assignmentDueDate || !assignmentDueTime) {
      setAssignmentError("請填寫科目、功課、死線日期及時間。");
      return;
    }
    setData((prev) => ({ ...prev, campusCalendarDownloaded: false, assignments: [...prev.assignments, {
      id: crypto.randomUUID(), course: assignmentCourse.trim(), title: assignmentTitle.trim(), emoji: assignmentEmoji,
      dueDate: assignmentDueDate, dueTime: assignmentDueTime, color: assignmentColor, done: false, reminded: false, calendarAdded: false,
    }] }));
    setAssignmentTitle(""); setAssignmentError(""); setShowAssignmentForm(false);
  }

  function toggleAssignment(id: string) {
    setData((prev) => ({ ...prev, campusCalendarDownloaded: false, assignments: prev.assignments.map((item) => item.id === id ? { ...item, done: !item.done } : item) }));
  }

  function deleteAssignment(id: string) {
    setData((prev) => ({ ...prev, campusCalendarDownloaded: false, assignments: prev.assignments.filter((item) => item.id !== id) }));
  }

  function togglePlan(id: string) {
    setData((prev) => ({ ...prev, campusCalendarDownloaded: false, plans: prev.plans.map((plan) => plan.id === id ? { ...plan, done: !plan.done } : plan) }));
  }

  function deletePlan(id: string) {
    setData((prev) => ({ ...prev, campusCalendarDownloaded: false, plans: prev.plans.filter((plan) => plan.id !== id) }));
  }

  async function enableNotifications() {
    if (!("Notification" in window)) {
      setPlanError("這個瀏覽器不支援通知；你仍可把項目加入手機行事曆。");
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission !== "default") setData((prev) => ({ ...prev, notificationSetupDone: true }));
  }

  function openNativeSettings() {
    (window as NativeBridgeWindow).webkit?.messageHandlers?.mukeNativeSettings?.postMessage({ action: "open-native-settings" });
  }

  function updateScheduleReminderDays(days: number) {
    setData((prev) => ({
      ...prev,
      scheduleReminderDays: days,
      campusCalendarDownloaded: false,
      classReminderLog: [],
      plans: prev.plans.map((item) => ({ ...item, reminderDays: days, notified: false })),
    }));
  }

  function updateAssignmentReminderDays(days: number) {
    setData((prev) => ({
      ...prev,
      assignmentReminderDays: days,
      campusCalendarDownloaded: false,
      assignments: prev.assignments.map((item) => ({ ...item, reminded: false })),
    }));
  }

  function downloadPlanCalendar(plan: PlanItem) {
    const start = new Date(`${plan.date}T${plan.time}:00`);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const safeActivity = escapeCalendarText(`${plan.emoji ?? "📌"} ${plan.activity}`);
    const content = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Muke//Plan//ZH-HK", "BEGIN:VEVENT",
      `UID:${plan.id}@muke`, `DTSTART:${calendarTime(start)}`, `DTEND:${calendarTime(end)}`,
      `SUMMARY:${safeActivity}`, "BEGIN:VALARM", `TRIGGER:-P${data.scheduleReminderDays}D`, "ACTION:DISPLAY", `DESCRIPTION:${data.scheduleReminderDays} 日後：${safeActivity}`, "END:VALARM",
      "END:VEVENT", "END:VCALENDAR",
    ].join("\r\n");
    downloadCalendar(content, `${plan.date}-${plan.time.replace(":", "")}-暮刻.ics`);
  }

  function addToPhoneCalendar(plan: PlanItem) {
    downloadPlanCalendar(plan);
    setData((prev) => ({ ...prev, plans: prev.plans.map((item) => item.id === plan.id ? { ...item, calendarAdded: true } : item) }));
  }

  function addAssignmentToPhoneCalendar(assignment: Assignment) {
    const due = new Date(`${assignment.dueDate}T${assignment.dueTime}:00`);
    const end = new Date(due.getTime() + 30 * 60 * 1000);
    const summary = escapeCalendarText(`${assignment.emoji} ${assignment.course} · ${assignment.title}`);
    const content = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Muke//Assignment//ZH-HK", "BEGIN:VEVENT",
      `UID:${assignment.id}@muke`, `DTSTART:${calendarTime(due)}`, `DTEND:${calendarTime(end)}`,
      `SUMMARY:${summary}`, "BEGIN:VALARM", `TRIGGER:-P${data.assignmentReminderDays}D`, "ACTION:DISPLAY", `DESCRIPTION:${data.assignmentReminderDays} 日後死線：${summary}`, "END:VALARM",
      "END:VEVENT", "END:VCALENDAR",
    ].join("\r\n");
    downloadCalendar(content, `${assignment.dueDate}-${assignment.course}-功課.ics`);
    setData((prev) => ({ ...prev, assignments: prev.assignments.map((item) => item.id === assignment.id ? { ...item, calendarAdded: true } : item) }));
  }

  function exportCampusCalendar() {
    const events: string[] = [];
    for (const item of data.classes) {
      const first = firstClassOccurrence(item);
      if (!first) continue;
      const start = new Date(`${isoDate(first)}T${item.startTime}:00`);
      const end = new Date(`${isoDate(first)}T${item.endTime}:00`);
      const until = `${item.endDate.replaceAll("-", "")}T235959`;
      const summary = escapeCalendarText(`${item.emoji} ${item.name}`);
      events.push("BEGIN:VEVENT", `UID:${item.id}@muke`, `DTSTART:${calendarTime(start)}`, `DTEND:${calendarTime(end)}`, `RRULE:FREQ=WEEKLY;UNTIL=${until}`, `SUMMARY:${summary}`);
      if (item.location) events.push(`LOCATION:${escapeCalendarText(item.location)}`);
      events.push("BEGIN:VALARM", `TRIGGER:-P${data.scheduleReminderDays}D`, "ACTION:DISPLAY", `DESCRIPTION:${data.scheduleReminderDays} 日後上課：${summary}`, "END:VALARM", "END:VEVENT");
    }
    for (const assignment of data.assignments.filter((item) => !item.done)) {
      const due = new Date(`${assignment.dueDate}T${assignment.dueTime}:00`);
      const end = new Date(due.getTime() + 30 * 60 * 1000);
      const summary = escapeCalendarText(`${assignment.emoji} ${assignment.course} · ${assignment.title}`);
      events.push("BEGIN:VEVENT", `UID:${assignment.id}@muke`, `DTSTART:${calendarTime(due)}`, `DTEND:${calendarTime(end)}`, `SUMMARY:${summary}`, "BEGIN:VALARM", `TRIGGER:-P${data.assignmentReminderDays}D`, "ACTION:DISPLAY", `DESCRIPTION:${data.assignmentReminderDays} 日後死線：${summary}`, "END:VALARM", "END:VEVENT");
    }
    for (const plan of data.plans.filter((item) => !item.done)) {
      const start = new Date(`${plan.date}T${plan.time}:00`);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      const summary = escapeCalendarText(`${plan.emoji ?? "📌"} ${plan.activity}`);
      events.push("BEGIN:VEVENT", `UID:${plan.id}@muke`, `DTSTART:${calendarTime(start)}`, `DTEND:${calendarTime(end)}`, `SUMMARY:${summary}`, "BEGIN:VALARM", `TRIGGER:-P${data.scheduleReminderDays}D`, "ACTION:DISPLAY", `DESCRIPTION:${data.scheduleReminderDays} 日後安排：${summary}`, "END:VALARM", "END:VEVENT");
    }
    const content = ["BEGIN:VCALENDAR", "VERSION:2.0", "CALSCALE:GREGORIAN", "PRODID:-//Muke//Campus//ZH-HK", ...events, "END:VCALENDAR"].join("\r\n");
    downloadCalendar(content, "暮刻-校園行事曆.ics");
    setData((prev) => ({ ...prev, campusCalendarDownloaded: true }));
  }

  function saveShift() {
    const duration = minutesBetween(shiftStart, shiftEnd, Number(breakMinutes) || 0);
    if (shiftStart === shiftEnd || duration <= 0) {
      setShiftError("請確認開始、結束及休息時間，工時需要大於 0 分鐘。");
      return;
    }
    const duplicate = data.shifts.some((shift) => shift.id !== editingShiftId && shift.jobId === selectedJob && shift.date === shiftDate && shift.start === shiftStart && shift.end === shiftEnd);
    if (duplicate) {
      setShiftError("這段工時似乎已經記錄過，請先檢查日期和時間。");
      return;
    }
    const savedJob = data.jobs.find((job) => job.id === selectedJob);
    const nextShift: Shift = {
      id: editingShiftId ?? crypto.randomUUID(), jobId: selectedJob, date: shiftDate,
      start: shiftStart, end: shiftEnd, breakMinutes: Number(breakMinutes) || 0,
      jobName: savedJob?.name, rate: savedJob?.rate,
      location: shiftLocation.trim() || undefined,
      sessions: Number(shiftSessions) > 0 ? Number(shiftSessions) : undefined,
      amount: shiftAmount === "" ? undefined : Math.max(0, Number(shiftAmount) || 0),
    };
    setShiftError("");
    setData((prev) => ({ ...prev, shifts: editingShiftId ? prev.shifts.map((shift) => shift.id === editingShiftId ? nextShift : shift) : [nextShift, ...prev.shifts] }));
    setShiftLocation("");
    setShiftSessions("1");
    setShiftAmount("");
    setEditingShiftId(null);
    setShowShiftForm(false);
  }

  function openShiftForm() {
    setEditingShiftId(null);
    setSelectedJob(data.jobs[0]?.id ?? "");
    setShiftDate(workMonth === startOfMonth() ? isoDate() : `${workMonth}-01`);
    setShiftStart("17:00");
    setShiftEnd("22:00");
    setBreakMinutes("0");
    setShiftLocation("");
    setShiftSessions("1");
    setShiftAmount("");
    setShiftError("");
    setShowShiftForm(true);
  }

  function startEditShift(shift: Shift) {
    setEditingShiftId(shift.id);
    setSelectedJob(data.jobs.some((job) => job.id === shift.jobId) ? shift.jobId : data.jobs[0]?.id ?? "");
    setShiftDate(shift.date);
    setShiftStart(shift.start);
    setShiftEnd(shift.end);
    setBreakMinutes(String(shift.breakMinutes));
    setShiftLocation(shift.location ?? "");
    setShiftSessions(String(shift.sessions ?? 1));
    setShiftAmount(typeof shift.amount === "number" ? String(shift.amount) : "");
    setShiftError("");
    setShowShiftForm(true);
  }

  function closeShiftForm() {
    setShowShiftForm(false);
    setEditingShiftId(null);
    setShiftError("");
  }

  function changeWorkMonth(amount: number) {
    const [year, month] = workMonth.split("-").map(Number);
    setWorkMonth(isoDate(new Date(year, month - 1 + amount, 1, 12)).slice(0, 7));
    closeShiftForm();
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

  function deleteShift(id: string) {
    const shift = data.shifts.find((item) => item.id === id);
    if (!shift) return;
    const job = data.jobs.find((item) => item.id === shift.jobId);
    if (!window.confirm(`確定刪除 ${shift.date} 的「${job?.name ?? shift.jobName ?? "工時"}」記錄？`)) return;
    setData((prev) => ({ ...prev, shifts: prev.shifts.filter((item) => item.id !== id) }));
    if (editingShiftId === id) closeShiftForm();
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
    const exportedAt = new Date().toISOString();
    const nextData = { ...data, lastBackupAt: exportedAt };
    const backup = JSON.stringify({ app: "暮刻", version: 1, exportedAt, data: nextData }, null, 2);
    const url = URL.createObjectURL(new Blob([backup], { type: "application/json;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `暮刻備份-${isoDate()}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setData(nextData);
    setDataMessage("備份已下載，可以在新網址匯入。");
  }

  async function protectStorage() {
    setStorageMessage("");
    if (!navigator.storage?.persist) {
      setStorageMessage("這個瀏覽器未提供資料保護功能，請定期下載備份。");
      return;
    }
    try {
      const persistent = await navigator.storage.persist();
      setStoragePersistent(persistent);
      setStorageMessage(persistent ? "已加強保護；資料只會在你主動清除時移除。" : "瀏覽器暫未批准，繼續使用 App 後可再試，並請定期備份。");
    } catch {
      setStorageMessage("未能開啟資料保護，請定期下載備份。");
    }
  }

  async function importData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!window.confirm("匯入會取代這部裝置目前的暮刻資料，確定繼續？")) return;
    try {
      const payload = JSON.parse(await file.text()) as Partial<AppData> & { data?: Partial<AppData> };
      const imported: Partial<AppData> = payload.data ?? payload;
      if (!Array.isArray(imported.jobs) || !imported.jobs.length || !Array.isArray(imported.shifts) || !Array.isArray(imported.tasks) || !Array.isArray(imported.plans)) throw new Error();
      const restored: AppData = {
        jobs: imported.jobs,
        shifts: imported.shifts,
        tasks: imported.tasks,
        plans: imported.plans.map((plan) => ({ ...plan, emoji: plan.emoji ?? "📌", reminderDays: plan.reminderDays ?? 1 })),
        classes: Array.isArray(imported.classes) ? imported.classes : [],
        assignments: Array.isArray(imported.assignments) ? imported.assignments : [],
        classReminderLog: Array.isArray(imported.classReminderLog) ? imported.classReminderLog : [],
        diary: imported.diary && typeof imported.diary === "object" ? imported.diary : {},
        workouts: imported.workouts && typeof imported.workouts === "object" ? imported.workouts : {},
        campusCalendarDownloaded: Boolean(imported.campusCalendarDownloaded),
        notificationSetupDone: Boolean(imported.notificationSetupDone),
        scheduleReminderDays: [1, 2, 3].includes(Number(imported.scheduleReminderDays)) ? Number(imported.scheduleReminderDays) : 1,
        assignmentReminderDays: [3, 7, 14].includes(Number(imported.assignmentReminderDays)) ? Number(imported.assignmentReminderDays) : 7,
        lastBackupAt: typeof imported.lastBackupAt === "string" ? imported.lastBackupAt : undefined,
      };
      setData(restored);
      setSelectedJob(restored.jobs[0].id);
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
  const workMonthLabel = parseIso(`${workMonth}-01`).toLocaleDateString("zh-HK", { year: "numeric", month: "long" });

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
          <p>所有記錄只儲存在這部裝置。可先開啟資料保護；換網址、換手機或清理瀏覽器前，請下載備份。</p>
          <div className="data-actions">
            <button className="primary-button" onClick={exportData}>下載備份</button>
            <label className="quiet-action" htmlFor="data-import">匯入備份</label>
            <input id="data-import" className="visually-hidden" type="file" accept="application/json,.json" onChange={importData} />
            <button className="quiet-action data-protect" onClick={protectStorage} disabled={storagePersistent === true}>{storagePersistent ? "資料保護已開啟" : "開啟資料保護"}</button>
          </div>
          {data.lastBackupAt && <p className="backup-date">上次備份：{new Date(data.lastBackupAt).toLocaleString("zh-HK", { dateStyle: "medium", timeStyle: "short" })}</p>}
          {storageMessage && <p className="data-message" role="status">{storageMessage}</p>}
          {dataMessage && <p className="data-message" role="status">{dataMessage}</p>}
        </section>
      </div>}

      <div className="content" key={tab}>
        {tab === "home" && <>
          <section className="hero">
            <span className="eyebrow">Good evening</span>
            <h1>Remember<br /><em>who you are.</em></h1>
            <p>待辦、活動與課堂，都在一個安靜的地方。</p>
          </section>

          <MiniCalendar markedDates={markedDates} workouts={data.workouts ?? {}} shifts={data.shifts} jobs={data.jobs} plans={data.plans} classes={data.classes} assignments={data.assignments} holidays={holidays} />

          <section className="card campus-widget">
            <div className="campus-widget-heading">
              <div><span className="eyebrow">Today on deck</span><h2>🗓️ 今日行程</h2></div>
              <button className="widget-link" onClick={() => changeTab("campus")}>管理 ›</button>
            </div>
            <div className="campus-day-list">
              {todayPlans.map((item) => <div className="campus-day-row" key={item.id} style={{ borderLeftColor: item.color }}><span>{item.emoji ?? "📌"}</span><div><small>{item.time} · 活動</small><strong>{item.activity}</strong></div></div>)}
              {todayClasses.map((item) => <div className="campus-day-row" key={item.id} style={{ borderLeftColor: item.color }}><span>{item.emoji}</span><div><small>{item.startTime}—{item.endTime}</small><strong>{item.name}</strong>{item.location && <em>⌖ {item.location}</em>}</div></div>)}
              {todayAssignments.map((item) => <div className="campus-day-row assignment" key={item.id} style={{ borderLeftColor: item.color }}><span>{item.emoji}</span><div><small>今天 {item.dueTime} 截止</small><strong>{item.course} · {item.title}</strong></div></div>)}
              {!todayPlans.length && !todayClasses.length && !todayAssignments.length && <div className="campus-empty"><span>☁️</span><div><strong>今天沒有活動、課堂或死線</strong><small>可以把注意力留給真正重要的事。</small></div></div>}
            </div>
            {!nativeMode && !data.campusCalendarDownloaded && <><button className="campus-calendar-button" onClick={exportCampusCalendar}>更新手機行事曆</button><p className="lockscreen-steps">包含普通活動、課堂與功課；在 iPhone 開啟 .ics 後按「加入全部」。</p></>}
          </section>

          <section className="card daily-brief-card">
            <div className="section-heading"><div><span className="eyebrow">At a glance</span><h2>今天摘要</h2></div><span className="brief-date">{new Date().toLocaleDateString("zh-HK", { weekday: "short" })}</span></div>
            <div className="brief-grid">
              <div><small>未完成</small><strong>{data.tasks.filter((task) => !task.done).length}</strong><span>件待辦</span></div>
              <div><small>今日行程</small><strong>{todayPlans.length + todayClasses.length + todayAssignments.length}</strong><span>課堂／活動</span></div>
              <div><small>今日工時</small><strong>{formatHours(todayShiftSummary.minutes)}</strong><span>HK${formatMoney(todayShiftSummary.pay)}</span></div>
              <div><small>健身</small><strong>{workoutToday ?? "—"}</strong><span>{workoutToday ? "已記錄" : "尚未記"}</span></div>
            </div>
            {nextSchedule && <button className="next-up" onClick={() => changeTab(nextSchedule.destination)}><span><small>下一項</small><strong>{nextSchedule.emoji} {nextSchedule.label}</strong></span><em>{nextSchedule.date === isoDate() ? "今天" : parseIso(nextSchedule.date).toLocaleDateString("zh-HK", { month: "short", day: "numeric" })} · {nextSchedule.time} ›</em></button>}
            <div className="brief-actions"><button onClick={() => changeTab("activity")}>＋ 新增活動</button><button onClick={() => { openShiftForm(); changeTab("work"); }}>＋ 補錄工時</button></div>
          </section>

          <section className={`card gym-card ${workoutToday ? "checked" : ""}`}>
            <div className="gym-symbol"><span /><i /><span /></div>
            <div className="gym-copy"><span className="eyebrow">Daily movement</span><h2>{workoutToday ? `今天 · ${workoutToday}日` : "今天練哪裡？"}</h2><p>{workoutToday ? "已自動記在今天的月曆上" : "選擇訓練部位，點一下即儲存"}</p></div>
            <div className="workout-options" aria-label="選擇今天的訓練部位">
              {(["胸", "背", "肩", "腿"] as WorkoutType[]).map((type) => <button key={type} className={workoutToday === type ? "selected" : ""} onClick={() => recordWorkout(type)} aria-pressed={workoutToday === type}>{type}</button>)}
            </div>
          </section>

          <section className="card task-card">
            <div className="section-heading"><div><span className="eyebrow">Today</span><h2>今天要做的</h2></div>{data.tasks.some((task) => task.done) ? <button className="clear-completed" onClick={clearCompletedTasks}>清除完成</button> : <span className="count">{data.tasks.filter(t => !t.done).length}</span>}</div>
            <div className="task-list">
              {sortedTasks.map((task) => <div key={task.id} className={`task-row ${task.done ? "done" : ""}`}><button className="task-toggle" onClick={() => toggleTask(task.id)} aria-label={`${task.done ? "取消完成" : "完成"}${task.text}`}><span className="check" /><span>{task.text}</span><small>{task.done ? "完成" : "待辦"}</small></button><button className="task-delete" onClick={() => deleteTask(task.id)} aria-label={`刪除${task.text}`}>×</button></div>)}
            </div>
            <form className="quick-add" onSubmit={addTask}><input value={taskText} onChange={(e) => setTaskText(e.target.value)} placeholder="記一件今天要做的事…" aria-label="新增待辦" /><button aria-label="加入待辦">↗</button></form>
          </section>
        </>}

        {tab === "activity" && <>
          <section className="hero plan-hero"><span className="eyebrow">New event</span><h1>把下一件事，<br /><em>放進日程。</em></h1><p>{nativeMode ? "設定一次，iPhone 會接手行事曆、通知與鎖屏顯示。" : "設定日期、時間和顏色；預設會同時下載到手機行事曆。"}</p></section>

          <section className="card plan-form-card">
            <div className="section-heading"><div><span className="eyebrow">Plan ahead</span><h2>新增活動</h2></div><span className="count">＋</span></div>
            <form className="plan-form" onSubmit={addPlan}>
              <div className="form-pair emoji-name-pair"><label>Emoji<select value={planEmoji} onChange={(event) => setPlanEmoji(event.target.value)}>{emojiOptions.map((emoji) => <option key={emoji}>{emoji}</option>)}</select></label><label>活動<input value={planActivity} onChange={(event) => { setPlanActivity(event.target.value); setPlanFeedback(""); }} placeholder="例如：跆拳道訓練" aria-label="活動名稱" /></label></div>
              <div className="form-pair"><label>日期<input type="date" value={planDate} onChange={(event) => setPlanDate(event.target.value)} /></label><label>確實時間<input type="time" value={planTime} onChange={(event) => setPlanTime(event.target.value)} /></label></div>
              <fieldset className="color-picker"><legend>活動顏色</legend><div>{planColors.map((color, index) => <button type="button" key={color} aria-label={`選擇${planColorNames[index]}`} title={planColorNames[index]} aria-pressed={planColor === color} className={planColor === color ? "selected" : ""} style={{ background: color }} onClick={() => setPlanColor(color)} />)}</div></fieldset>
              {nativeMode ? <div className="native-sync-option"><span>iPhone</span><div><strong>自動同步已連接</strong><small>儲存後會交由原生 App 寫入行事曆並更新鎖屏。</small></div></div> : <label className="calendar-download-option"><input type="checkbox" checked={addPlanToCalendar} onChange={(event) => setAddPlanToCalendar(event.target.checked)} /><span><strong>同時下載到手機行事曆</strong><small>iPhone 開啟 .ics 檔後按「加入」，活動才會出現在鎖屏日曆。</small></span></label>}
              <p className="field-note">🔔 提前 {data.scheduleReminderDays} 天提醒。</p>
              {planError && <p className="form-error" role="alert">{planError}</p>}
              <button className="primary-button" type="submit">{nativeMode ? "加入並自動同步" : addPlanToCalendar ? "加入活動並下載" : "加入活動"}</button>
              {planFeedback && <p className="form-success" role="status">{planFeedback}</p>}
            </form>
          </section>

          <MiniCalendar markedDates={markedDates} workouts={data.workouts ?? {}} shifts={data.shifts} jobs={data.jobs} plans={data.plans} classes={data.classes} assignments={data.assignments} holidays={holidays} />

          <section className="section-block plan-list-section">
            <div className="outside-heading"><div><span className="eyebrow">Upcoming</span><h2>接下來</h2></div><span className="plan-total">{data.plans.filter((plan) => !plan.done).length} 項</span></div>
            <div className="plan-list">{sortedPlans.map((plan) => <article className={`card plan-row ${plan.done ? "done" : ""}`} key={plan.id} style={{ borderLeftColor: plan.color }}>
              <button className="plan-check" aria-label={plan.done ? "標記為未完成" : "標記為完成"} onClick={() => togglePlan(plan.id)}><span /></button>
              <div className="plan-copy"><small>{parseIso(plan.date).toLocaleDateString("zh-HK", { month: "long", day: "numeric", weekday: "short" })}</small><strong>{plan.time}</strong><p>{plan.emoji ?? "📌"} {plan.activity} · 提前 {data.scheduleReminderDays} 天</p></div>
              <div className="plan-actions">{!nativeMode && <button onClick={() => addToPhoneCalendar(plan)} aria-label={`${plan.calendarAdded ? "重新下載" : "把"}${plan.activity}${plan.calendarAdded ? "的手機行事曆檔案" : "加入手機行事曆"}`}>{plan.calendarAdded ? "重新下載" : "加入行事曆"}</button>}<button className="delete-plan" onClick={() => deletePlan(plan.id)} aria-label={`刪除${plan.activity}`}>刪除</button></div>
            </article>)}</div>
            {!sortedPlans.length && <p className="empty-plans">暫時沒有未來活動。<br />把下一件重要的事放進來吧。</p>}
          </section>
        </>}

        {tab === "campus" && <>
          <section className="hero campus-hero"><span className="eyebrow">Campus rhythm</span><h1>先看下一堂，<br /><em>其他慢慢來。</em></h1><p>普通活動、每週課堂與功課死線，都會放進同一條時間線。</p></section>

          <section className="card campus-week-card" aria-label="未來七日安排">
            <div className="campus-week-heading"><div><span className="eyebrow">Next seven days</span><h2>這星期的節奏</h2></div><span>{campusWeekDates.reduce((total, dateKey) => total + agendaOnDate(data.plans, data.classes, data.assignments, dateKey).length, 0)} 項</span></div>
            <div className="campus-week-strip" aria-label="選擇校園日期">
              {campusWeekDates.map((dateKey) => {
                const date = parseIso(dateKey);
                const count = agendaOnDate(data.plans, data.classes, data.assignments, dateKey).length;
                return <button key={dateKey} className={`${dateKey === campusSelectedDate ? "selected" : ""} ${dateKey === isoDate() ? "today" : ""}`} onClick={() => setCampusSelectedDate(dateKey)} aria-label={`${date.toLocaleDateString("zh-HK", { month: "long", day: "numeric", weekday: "long" })}，${count}項安排`} aria-pressed={dateKey === campusSelectedDate}><small>{date.toLocaleDateString("zh-HK", { weekday: "narrow" })}</small><strong>{date.getDate()}</strong><i>{count || "·"}</i></button>;
              })}
            </div>
            <div className="campus-agenda-heading"><div><small>{campusSelectedDate === isoDate() ? "今天" : parseIso(campusSelectedDate).toLocaleDateString("zh-HK", { month: "long", day: "numeric" })}</small><strong>{parseIso(campusSelectedDate).toLocaleDateString("zh-HK", { weekday: "long" })}</strong></div>{nextAssignment && <span>下一死線 · {parseIso(nextAssignment.dueDate).toLocaleDateString("zh-HK", { month: "short", day: "numeric" })}</span>}</div>
            <div className="campus-agenda-list">
              {campusSelectedAgenda.map((item) => <article className="campus-agenda-row" key={item.id} style={{ borderLeftColor: item.color }}><time>{item.time}</time><span>{item.emoji}</span><div><small>{item.kind}{item.endTime ? ` · 至 ${item.endTime}` : ""}</small><strong>{item.label}</strong>{item.detail && <p>⌖ {item.detail}</p>}</div></article>)}
              {!campusSelectedAgenda.length && <div className="campus-agenda-empty"><span>☾</span><div><strong>這天沒有安排</strong><small>空下來也沒關係；活動新增後會立即出現在這裡。</small></div></div>}
            </div>
          </section>

          {showCampusSync && <section className="card notification-card campus-sync-card">
            <div><span className="eyebrow">Phone calendar</span><h2>{!data.campusCalendarDownloaded ? "手機行事曆需要更新" : "開啟行程通知"}</h2><p>{!data.campusCalendarDownloaded ? `目前包含 ${data.plans.filter((item) => !item.done).length} 個活動、${data.classes.length} 組課堂和 ${data.assignments.filter((item) => !item.done).length} 個死線。下載後，請在 iPhone 開啟 .ics 並按「加入全部」。` : "允許通知後，暮刻在開啟時會提醒你接下來的安排。"}</p></div>
            <div className="sync-actions">{!data.campusCalendarDownloaded && <button className="primary-button" onClick={exportCampusCalendar}>更新手機行事曆</button>}{!notificationsConfigured && <button className="quiet-action" onClick={enableNotifications}>開啟 App 通知</button>}</div>
          </section>}

          {nativeMode && <section className="card notification-card campus-sync-card native-sync-card">
            <div><span className="eyebrow">iPhone native</span><h2>由系統自動接手</h2><p>普通活動、課堂、功課與公事會寫入 Apple 行事曆；通知預排後，即使暮刻沒有開啟仍會送達。</p></div>
            <button className="quiet-action" onClick={openNativeSettings}>管理權限與鎖屏</button>
          </section>}

          <section className="card campus-preferences-card">
            <div className="section-heading"><div><span className="eyebrow">Personal rhythm</span><h2>提醒方式</h2></div><button className="text-button" onClick={() => setShowReminderSettings(!showReminderSettings)}>{showReminderSettings ? "完成" : "調整"}</button></div>
            <p className="preference-summary">活動／課堂提前 {data.scheduleReminderDays} 天 · 功課提前 {data.assignmentReminderDays} 天</p>
            {showReminderSettings && <div className="reminder-settings">
              <label><span>活動與課堂</span><select value={data.scheduleReminderDays} onChange={(event) => updateScheduleReminderDays(Number(event.target.value))}><option value={1}>提前 1 天</option><option value={2}>提前 2 天</option><option value={3}>提前 3 天</option></select></label>
              <label><span>功課死線</span><select value={data.assignmentReminderDays} onChange={(event) => updateAssignmentReminderDays(Number(event.target.value))}><option value={3}>提前 3 天</option><option value={7}>提前 7 天</option><option value={14}>提前 14 天</option></select></label>
              <p>{nativeMode ? "更改後，原生 App 會重新同步 Apple 行事曆與通知時間。" : "更改提醒時間後，「更新手機行事曆」會重新出現。這是因為網站不能在背景直接修改你已匯入的 iPhone 日曆。"}</p>
            </div>}
          </section>

          <section className="card academic-section">
            <div className="section-heading"><div><span className="eyebrow">Weekly timetable</span><h2>🎓 每週課表</h2></div><button className="text-button" onClick={() => setShowClassForm(!showClassForm)}>{showClassForm ? "收起" : "＋ 新增"}</button></div>
            {showClassForm && <form className="plan-form academic-form" onSubmit={addRecurringClass}>
              <div className="form-pair emoji-name-pair"><label>Emoji<select value={classEmoji} onChange={(event) => setClassEmoji(event.target.value)}>{emojiOptions.map((emoji) => <option key={emoji}>{emoji}</option>)}</select></label><label>課堂名稱<input value={className} onChange={(event) => setClassName(event.target.value)} placeholder="例如：教育心理學" /></label></div>
              <div className="form-pair"><label>每逢<select value={classWeekday} onChange={(event) => setClassWeekday(Number(event.target.value))}>{weekdayNames.map((name, index) => <option value={index} key={name}>{name}</option>)}</select></label><label>課室／地點<input value={classLocation} onChange={(event) => setClassLocation(event.target.value)} placeholder="例如：A302" /></label></div>
              <div className="form-pair"><label>上課<input type="time" value={classStartTime} onChange={(event) => setClassStartTime(event.target.value)} /></label><label>下課<input type="time" value={classEndTime} onChange={(event) => setClassEndTime(event.target.value)} /></label></div>
              <div className="form-pair"><label>學期開始<input type="date" value={classStartDate} onChange={(event) => setClassStartDate(event.target.value)} /></label><label>學期完結<input type="date" value={classEndDate} onChange={(event) => setClassEndDate(event.target.value)} /></label></div>
              <fieldset className="color-picker"><legend>課堂顏色</legend><div>{planColors.map((color, index) => <button type="button" key={color} aria-label={`選擇${planColorNames[index]}`} aria-pressed={classColor === color} className={classColor === color ? "selected" : ""} style={{ background: color }} onClick={() => setClassColor(color)} />)}</div></fieldset>
              <p className="field-note">設定一次後，月／週／日月曆會自動顯示每一週。🔔 提前 {data.scheduleReminderDays} 天提醒。</p>
              {classError && <p className="form-error" role="alert">{classError}</p>}
              <button className="primary-button" type="submit">加入整學期課表</button>
            </form>}
            <div className="academic-list">{sortedClasses.map((item) => <article className="academic-row class-row" key={item.id} style={{ borderLeftColor: item.color }}>
              <span className="academic-emoji">{item.emoji}</span><div className="academic-copy"><small>{weekdayNames[item.weekday]} · {item.startTime}—{item.endTime}</small><strong>{item.name}</strong><p>{item.location ? `⌖ ${item.location} · ` : ""}{parseIso(item.startDate).toLocaleDateString("zh-HK", { month: "short", day: "numeric" })}—{parseIso(item.endDate).toLocaleDateString("zh-HK", { month: "short", day: "numeric" })}</p></div>
              <button className="academic-delete" onClick={() => deleteRecurringClass(item.id)} aria-label={`刪除${item.name}`}>刪除</button>
            </article>)}</div>
            {!sortedClasses.length && !showClassForm && <p className="empty-plans">尚未有固定課堂。<br />新增一次，暮刻會替你排到學期完結。</p>}
          </section>

          <section className="card academic-section assignment-section">
            <div className="section-heading"><div><span className="eyebrow">Deadline desk</span><h2>📝 功課死線</h2></div><button className="text-button" onClick={() => setShowAssignmentForm(!showAssignmentForm)}>{showAssignmentForm ? "收起" : "＋ 新增"}</button></div>
            {showAssignmentForm && <form className="plan-form academic-form" onSubmit={addAssignment}>
              <div className="form-pair emoji-name-pair"><label>Emoji<select value={assignmentEmoji} onChange={(event) => setAssignmentEmoji(event.target.value)}>{emojiOptions.map((emoji) => <option key={emoji}>{emoji}</option>)}</select></label><label>科目<input value={assignmentCourse} onChange={(event) => setAssignmentCourse(event.target.value)} placeholder="例如：PSYC 2101" /></label></div>
              <label>功課／報告<input value={assignmentTitle} onChange={(event) => setAssignmentTitle(event.target.value)} placeholder="例如：研究報告初稿" /></label>
              <div className="form-pair"><label>死線日期<input type="date" value={assignmentDueDate} onChange={(event) => setAssignmentDueDate(event.target.value)} /></label><label>時間<input type="time" value={assignmentDueTime} onChange={(event) => setAssignmentDueTime(event.target.value)} /></label></div>
              <fieldset className="color-picker"><legend>科目顏色</legend><div>{planColors.map((color, index) => <button type="button" key={color} aria-label={`選擇${planColorNames[index]}`} aria-pressed={assignmentColor === color} className={assignmentColor === color ? "selected" : ""} style={{ background: color }} onClick={() => setAssignmentColor(color)} />)}</div></fieldset>
              <p className="field-note">🔔 暮刻會在死線前 {data.assignmentReminderDays} 天提醒你。</p>
              {assignmentError && <p className="form-error" role="alert">{assignmentError}</p>}
              <button className="primary-button" type="submit">加入功課死線</button>
            </form>}
            <div className="academic-list">{sortedAssignments.map((item) => <article className={`academic-row assignment-row ${item.done ? "done" : ""}`} key={item.id} style={{ borderLeftColor: item.color }}>
              <button className="assignment-check" onClick={() => toggleAssignment(item.id)} aria-label={item.done ? "標記未完成" : "標記完成"}>{item.done ? "✓" : item.emoji}</button><div className="academic-copy"><small>{parseIso(item.dueDate).toLocaleDateString("zh-HK", { month: "long", day: "numeric", weekday: "short" })} · {item.dueTime}</small><strong>{item.course}</strong><p>{item.title} · 提前 {data.assignmentReminderDays} 天提醒</p></div>
              <div className="academic-row-actions">{!nativeMode && <button onClick={() => addAssignmentToPhoneCalendar(item)} aria-label={`${item.calendarAdded ? "重新下載" : "把"}${item.title}${item.calendarAdded ? "的手機行事曆檔案" : "加入手機行事曆"}`}>{item.calendarAdded ? "重新下載" : "行事曆"}</button>}<button onClick={() => deleteAssignment(item.id)} aria-label={`刪除${item.title}`}>刪除</button></div>
            </article>)}</div>
            {!sortedAssignments.length && !showAssignmentForm && <p className="empty-plans">未有功課死線。<br />把作業、測驗或報告放進來吧。</p>}
          </section>

        </>}

        {tab === "work" && <>
          <section className="hero work-hero"><span className="eyebrow">{workMonthLabel} · Work</span><h1><small>HK$</small>{formatMoney(totals.pay)}</h1><p>所選月份預計收入 · {formatHours(totals.minutes)}</p></section>

          <div className="work-month-switch" aria-label="工時月份">
            <button onClick={() => changeWorkMonth(-1)} aria-label="上一個月份">‹</button>
            <strong>{workMonthLabel}</strong>
            <button onClick={() => changeWorkMonth(1)} aria-label="下一個月份">›</button>
          </div>

          <section className="section-block">
            <div className="outside-heading"><div><span className="eyebrow">Jobs</span><h2>我的兼職</h2></div><button className="text-button" onClick={() => setShowJobForm(!showJobForm)}>＋ 新增</button></div>
            {showJobForm && <form className="card compact-form" onSubmit={addJob}><input placeholder="工作名稱" value={jobName} onChange={e => setJobName(e.target.value)} required /><input type="number" inputMode="decimal" placeholder="時薪 HK$" value={jobRate} onChange={e => setJobRate(e.target.value)} required /><button className="primary-button">儲存工作</button></form>}
            <div className="job-grid">{data.jobs.map(job => <div className="card job-card" key={job.id}><div className="job-card-top"><i style={{ background: job.color }} /><button onClick={() => deleteJob(job.id)} aria-label={`刪除${job.name}`}>刪除</button></div><span>{job.name}</span><strong>HK${formatMoney(totals.byJob[job.id]?.pay ?? 0)}</strong><small>{formatHours(totals.byJob[job.id]?.minutes ?? 0)} · HK${job.rate}/h</small></div>)}</div>
            {jobError && <p className="form-error job-error" role="alert">{jobError}</p>}
          </section>

          <section className="card history-card">
            <div className="section-heading"><div><span className="eyebrow">History</span><h2>{workMonthLabel}記錄</h2></div><button className="text-button" onClick={() => showShiftForm && !editingShiftId ? closeShiftForm() : openShiftForm()}>{showShiftForm && !editingShiftId ? "收起" : "＋ 補錄"}</button></div>
            <div className="history-summary" aria-label="所選月份工作結算"><div><small>月份應收</small><strong>HK${formatMoney(totals.pay)}</strong></div><div><small>堂／節數</small><strong>{totals.sessions}</strong></div><div><small>總工時</small><strong>{formatHours(totals.minutes)}</strong></div></div>
            {showShiftForm && <form className="shift-form" onSubmit={(event) => { event.preventDefault(); saveShift(); }}>
              <div className="shift-form-heading"><strong>{editingShiftId ? "編輯工時" : "補錄工時"}</strong><button type="button" onClick={closeShiftForm}>取消</button></div>
              <label>兼職<select value={selectedJob} onChange={e => setSelectedJob(e.target.value)}>{data.jobs.map(job => <option value={job.id} key={job.id}>{job.name}</option>)}</select></label>
              <label>日期<input type="date" value={shiftDate} onChange={e => setShiftDate(e.target.value)} /></label>
              <div className="form-pair"><label>開始<input type="time" value={shiftStart} onChange={e => setShiftStart(e.target.value)} /></label><label>結束<input type="time" value={shiftEnd} onChange={e => setShiftEnd(e.target.value)} /></label></div>
              <label>休息分鐘<input type="number" inputMode="numeric" min="0" value={breakMinutes} onChange={e => setBreakMinutes(e.target.value)} /></label>
              <label>地點<input value={shiftLocation} onChange={e => setShiftLocation(e.target.value)} placeholder="例如：灣仔道場" /></label>
              <div className="form-pair"><label>堂數／節數<input type="number" inputMode="numeric" min="1" step="1" value={shiftSessions} onChange={e => setShiftSessions(e.target.value)} /></label><label>實收金額 HK$<input type="number" inputMode="decimal" min="0" step="0.01" value={shiftAmount} onChange={e => setShiftAmount(e.target.value)} placeholder="留空則按時薪" /></label></div>
              {shiftError && <p className="form-error" role="alert">{shiftError}</p>}
              <button className="primary-button" type="submit">{editingShiftId ? "更新這次工時" : "儲存這次工時"}</button>
            </form>}
            <div className="history-list">{workShifts.map(shift => {
              const job = data.jobs.find(item => item.id === shift.jobId);
              const mins = minutesBetween(shift.start, shift.end, shift.breakMinutes);
              return <div className="history-row" key={shift.id}><span className="date-tile"><b>{Number(shift.date.slice(-2))}</b><small>{new Date(`${shift.date}T12:00:00`).toLocaleDateString("zh-HK", { month: "short" })}</small></span><div className="history-copy"><strong>{job?.name ?? shift.jobName ?? "已刪除工作"}</strong><small>{shift.start}—{shift.end}{shift.breakMinutes ? ` · 休息 ${shift.breakMinutes}m` : ""}</small>{(shift.location || shift.sessions) && <span className="shift-meta">{shift.location && <i>⌖ {shift.location}</i>}{shift.sessions && <i>{shift.sessions} 堂／節</i>}</span>}</div><span className="pay"><b>HK${formatMoney(shiftEarnings(shift, job))}</b><small>{formatHours(mins)}</small><span className="pay-actions"><button onClick={() => startEditShift(shift)} aria-label={`編輯${shift.date}工時記錄`}>編輯</button><button onClick={() => deleteShift(shift.id)} aria-label={`刪除${shift.date}工時記錄`}>刪除</button></span></span></div>;
            })}</div>
            {!workShifts.length && !showShiftForm && <p className="empty-history">這個月份還未有工時記錄。按「補錄」加入記錄。</p>}
          </section>
        </>}

      </div>

      <nav className="bottom-nav" aria-label="主要導覽">
        <button className={tab === "home" ? "active" : ""} onClick={() => changeTab("home")}><span>⌂</span>今天</button>
        <button className={tab === "activity" ? "active" : ""} onClick={() => changeTab("activity")}><span>＋</span>新增活動</button>
        <button className={tab === "campus" ? "active" : ""} onClick={() => changeTab("campus")}><span>🎓</span>校園</button>
        <button className={tab === "work" ? "active" : ""} onClick={() => changeTab("work")}><span>◷</span>公事</button>
      </nav>
    </main>
  );
}
