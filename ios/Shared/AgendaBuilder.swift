import Foundation

public enum AgendaKind: String, Codable, CaseIterable, Hashable, Sendable {
    case plan
    case recurringClass
    case assignment
    case shift
    case workout
    case task
}

/// A display-ready, Codable item that can cross the app/widget boundary unchanged.
public struct AgendaEntry: Codable, Hashable, Identifiable, Sendable {
    public var id: String
    public var title: String
    public var subtitle: String?
    public var start: Date?
    public var end: Date?
    public var kind: AgendaKind
    public var colorHex: String
    public var emoji: String
    public var dateKey: String
    public var isAllDay: Bool
    public var sourceID: String

    public init(
        id: String,
        title: String,
        subtitle: String? = nil,
        start: Date? = nil,
        end: Date? = nil,
        kind: AgendaKind,
        colorHex: String,
        emoji: String,
        dateKey: String,
        isAllDay: Bool = false,
        sourceID: String
    ) {
        self.id = id
        self.title = title
        self.subtitle = subtitle
        self.start = start
        self.end = end
        self.kind = kind
        self.colorHex = colorHex
        self.emoji = emoji
        self.dateKey = dateKey
        self.isAllDay = isAllDay
        self.sourceID = sourceID
    }
}

public struct DailyAgenda: Codable, Hashable, Sendable {
    public var dateKey: String
    public var generatedAt: Date
    public var entries: [AgendaEntry]

    public init(dateKey: String, generatedAt: Date = Date(), entries: [AgendaEntry]) {
        self.dateKey = dateKey
        self.generatedAt = generatedAt
        self.entries = entries
    }
}

public struct AgendaBuilder: Sendable {
    public init() {}

    public func entries(on date: Date, from data: MukeData) -> [AgendaEntry] {
        entries(onDateKey: HongKongDate.dateKey(for: date), from: data)
    }

    public func entries(from start: Date, through end: Date, from data: MukeData) -> [AgendaEntry] {
        var cursor = HongKongDate.calendar.startOfDay(for: start)
        let finalDay = HongKongDate.calendar.startOfDay(for: end)
        guard cursor <= finalDay else { return [] }

        var result: [AgendaEntry] = []
        var safetyCounter = 0
        while cursor <= finalDay, safetyCounter < 3_660 {
            result.append(contentsOf: entries(on: cursor, from: data))
            guard let next = HongKongDate.addingDays(1, to: cursor) else { break }
            cursor = next
            safetyCounter += 1
        }
        return result
    }

    /// Pending tasks are intentionally date-free; `entries(on:from:)` attaches them to the selected day.
    public func pendingTasks(from data: MukeData) -> [AgendaEntry] {
        data.tasks
            .filter { !$0.done && !$0.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
            .map { task in
                AgendaEntry(
                    id: "task-\(task.id)",
                    title: task.text,
                    kind: .task,
                    colorHex: "#767a8a",
                    emoji: "☑️",
                    dateKey: "",
                    isAllDay: true,
                    sourceID: task.id
                )
            }
    }

    public func dailyAgenda(on date: Date, from data: MukeData, generatedAt: Date = Date()) -> DailyAgenda {
        let key = HongKongDate.dateKey(for: date)
        return DailyAgenda(dateKey: key, generatedAt: generatedAt, entries: entries(on: date, from: data))
    }

    private func entries(onDateKey dateKey: String, from data: MukeData) -> [AgendaEntry] {
        guard let selectedDate = HongKongDate.date(from: dateKey),
              let selectedWeekday = HongKongDate.weekday(for: dateKey) else {
            return []
        }

        var result: [AgendaEntry] = []

        result.append(contentsOf: data.plans
            .filter { !$0.done && $0.date == dateKey }
            .map { plan in
                AgendaEntry(
                    id: "plan-\(plan.id)",
                    title: plan.activity,
                    start: HongKongDate.dateTime(dateKey: dateKey, time: plan.time),
                    kind: .plan,
                    colorHex: plan.color,
                    emoji: plan.emoji ?? "📌",
                    dateKey: dateKey,
                    isAllDay: HongKongDate.dateTime(dateKey: dateKey, time: plan.time) == nil,
                    sourceID: plan.id
                )
            })

        result.append(contentsOf: data.classes
            .filter {
                $0.startDate <= dateKey && dateKey <= $0.endDate &&
                    $0.weekday == selectedWeekday
            }
            .map { item in
                let start = HongKongDate.dateTime(dateKey: dateKey, time: item.startTime)
                let rawEnd = HongKongDate.dateTime(dateKey: dateKey, time: item.endTime)
                let end = adjustedEnd(rawEnd, after: start)
                return AgendaEntry(
                    id: "class-\(item.id)-\(dateKey)",
                    title: item.name,
                    subtitle: item.location,
                    start: start,
                    end: end,
                    kind: .recurringClass,
                    colorHex: item.color,
                    emoji: item.emoji,
                    dateKey: dateKey,
                    isAllDay: start == nil,
                    sourceID: item.id
                )
            })

        result.append(contentsOf: data.assignments
            .filter { !$0.done && $0.dueDate == dateKey }
            .map { item in
                let displayTitle = item.course.isEmpty ? item.title : "\(item.course) · \(item.title)"
                let start = HongKongDate.dateTime(dateKey: dateKey, time: item.dueTime)
                return AgendaEntry(
                    id: "assignment-\(item.id)",
                    title: displayTitle,
                    subtitle: "功課死線",
                    start: start,
                    kind: .assignment,
                    colorHex: item.color,
                    emoji: item.emoji,
                    dateKey: dateKey,
                    isAllDay: start == nil,
                    sourceID: item.id
                )
            })

        let jobsByID = Dictionary(uniqueKeysWithValues: data.jobs.map { ($0.id, $0) })
        result.append(contentsOf: data.shifts
            .filter { $0.date == dateKey }
            .map { shift in
                let job = jobsByID[shift.jobId]
                let start = HongKongDate.dateTime(dateKey: dateKey, time: shift.start)
                let rawEnd = HongKongDate.dateTime(dateKey: dateKey, time: shift.end)
                let end = adjustedEnd(rawEnd, after: start)
                let title = shift.jobName ?? job?.name ?? "兼職"
                let details = [shift.location, shift.sessions.map { "\($0) 堂／節" }]
                    .compactMap { $0 }
                    .filter { !$0.isEmpty }
                    .joined(separator: " · ")
                return AgendaEntry(
                    id: "shift-\(shift.id)",
                    title: title,
                    subtitle: details.isEmpty ? nil : details,
                    start: start,
                    end: end,
                    kind: .shift,
                    colorHex: job?.color ?? "#b48062",
                    emoji: "💼",
                    dateKey: dateKey,
                    isAllDay: start == nil,
                    sourceID: shift.id
                )
            })

        if let workout = data.workouts[dateKey], !workout.isEmpty {
            result.append(AgendaEntry(
                id: "workout-\(dateKey)",
                title: "\(workout)日訓練",
                subtitle: "今日運動",
                start: selectedDate,
                kind: .workout,
                colorHex: "#9f3d4a",
                emoji: workoutEmoji(for: workout),
                dateKey: dateKey,
                isAllDay: true,
                sourceID: dateKey
            ))
        }

        result.append(contentsOf: pendingTasks(from: data).map { task in
            var datedTask = task
            datedTask.id = "\(task.id)-\(dateKey)"
            datedTask.dateKey = dateKey
            datedTask.start = selectedDate
            return datedTask
        })

        return result.sorted(by: agendaSort)
    }

    private func adjustedEnd(_ end: Date?, after start: Date?) -> Date? {
        guard let end, let start else { return end }
        if end > start { return end }
        return HongKongDate.addingDays(1, to: end)
    }

    private func workoutEmoji(for workout: String) -> String {
        switch workout {
        case "胸": return "🏋️"
        case "背": return "🪽"
        case "肩": return "💪"
        case "腿": return "🦵"
        default: return "🏃"
        }
    }

    private func agendaSort(_ lhs: AgendaEntry, _ rhs: AgendaEntry) -> Bool {
        if lhs.isAllDay != rhs.isAllDay { return !lhs.isAllDay }
        if let leftStart = lhs.start, let rightStart = rhs.start, leftStart != rightStart {
            return leftStart < rightStart
        }
        let priority: [AgendaKind: Int] = [
            .plan: 0,
            .recurringClass: 1,
            .assignment: 2,
            .shift: 3,
            .workout: 4,
            .task: 5,
        ]
        let leftPriority = priority[lhs.kind, default: 99]
        let rightPriority = priority[rhs.kind, default: 99]
        if leftPriority != rightPriority { return leftPriority < rightPriority }
        if lhs.title != rhs.title { return lhs.title < rhs.title }
        return lhs.id < rhs.id
    }
}
