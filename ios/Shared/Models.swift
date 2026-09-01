import Foundation

public struct Job: Codable, Hashable, Sendable {
    public var id: String
    public var name: String
    public var rate: Double
    public var color: String

    public init(id: String, name: String, rate: Double, color: String) {
        self.id = id
        self.name = name
        self.rate = rate
        self.color = color
    }

    public init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        id = values.value(.id, default: "")
        name = values.value(.name, default: "")
        rate = values.value(.rate, default: 0)
        color = values.value(.color, default: "#767a8a")
    }
}

public struct Shift: Codable, Hashable, Sendable {
    public var id: String
    public var jobId: String
    public var date: String
    public var start: String
    public var end: String
    public var breakMinutes: Int
    public var jobName: String?
    public var rate: Double?
    public var location: String?
    public var sessions: Int?
    public var amount: Double?

    public init(
        id: String,
        jobId: String,
        date: String,
        start: String,
        end: String,
        breakMinutes: Int = 0,
        jobName: String? = nil,
        rate: Double? = nil,
        location: String? = nil,
        sessions: Int? = nil,
        amount: Double? = nil
    ) {
        self.id = id
        self.jobId = jobId
        self.date = date
        self.start = start
        self.end = end
        self.breakMinutes = breakMinutes
        self.jobName = jobName
        self.rate = rate
        self.location = location
        self.sessions = sessions
        self.amount = amount
    }

    public init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        id = values.value(.id, default: "")
        jobId = values.value(.jobId, default: "")
        date = values.value(.date, default: "")
        start = values.value(.start, default: "")
        end = values.value(.end, default: "")
        breakMinutes = values.value(.breakMinutes, default: 0)
        jobName = values.optional(.jobName)
        rate = values.optional(.rate)
        location = values.optional(.location)
        sessions = values.optional(.sessions)
        amount = values.optional(.amount)
    }
}

public struct TodoTask: Codable, Hashable, Sendable {
    public var id: String
    public var text: String
    public var done: Bool

    public init(id: String, text: String, done: Bool = false) {
        self.id = id
        self.text = text
        self.done = done
    }

    public init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        id = values.value(.id, default: "")
        text = values.value(.text, default: "")
        done = values.value(.done, default: false)
    }
}

public struct Plan: Codable, Hashable, Sendable {
    public var id: String
    public var activity: String
    public var date: String
    public var time: String
    public var color: String
    public var emoji: String?
    public var reminderDays: Int?
    public var done: Bool
    public var notified: Bool
    public var calendarAdded: Bool?

    public init(
        id: String,
        activity: String,
        date: String,
        time: String,
        color: String,
        emoji: String? = nil,
        reminderDays: Int? = nil,
        done: Bool = false,
        notified: Bool = false,
        calendarAdded: Bool? = nil
    ) {
        self.id = id
        self.activity = activity
        self.date = date
        self.time = time
        self.color = color
        self.emoji = emoji
        self.reminderDays = reminderDays
        self.done = done
        self.notified = notified
        self.calendarAdded = calendarAdded
    }

    public init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        id = values.value(.id, default: "")
        activity = values.value(.activity, default: "")
        date = values.value(.date, default: "")
        time = values.value(.time, default: "")
        color = values.value(.color, default: "#767a8a")
        emoji = values.optional(.emoji)
        reminderDays = values.optional(.reminderDays)
        done = values.value(.done, default: false)
        notified = values.value(.notified, default: false)
        calendarAdded = values.optional(.calendarAdded)
    }
}

public struct RecurringClass: Codable, Hashable, Sendable {
    public var id: String
    public var name: String
    public var emoji: String
    /// JavaScript weekday convention: Sunday is 0 and Saturday is 6.
    public var weekday: Int
    public var startTime: String
    public var endTime: String
    public var startDate: String
    public var endDate: String
    public var location: String?
    public var color: String

    public init(
        id: String,
        name: String,
        emoji: String = "🎓",
        weekday: Int,
        startTime: String,
        endTime: String,
        startDate: String,
        endDate: String,
        location: String? = nil,
        color: String
    ) {
        self.id = id
        self.name = name
        self.emoji = emoji
        self.weekday = weekday
        self.startTime = startTime
        self.endTime = endTime
        self.startDate = startDate
        self.endDate = endDate
        self.location = location
        self.color = color
    }

    public init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        id = values.value(.id, default: "")
        name = values.value(.name, default: "")
        emoji = values.value(.emoji, default: "🎓")
        weekday = values.value(.weekday, default: 1)
        startTime = values.value(.startTime, default: "")
        endTime = values.value(.endTime, default: "")
        startDate = values.value(.startDate, default: "")
        endDate = values.value(.endDate, default: "")
        location = values.optional(.location)
        color = values.value(.color, default: "#6683cf")
    }
}

public struct Assignment: Codable, Hashable, Sendable {
    public var id: String
    public var course: String
    public var title: String
    public var emoji: String
    public var dueDate: String
    public var dueTime: String
    public var color: String
    public var done: Bool
    public var reminded: Bool
    public var calendarAdded: Bool?

    public init(
        id: String,
        course: String,
        title: String,
        emoji: String = "📝",
        dueDate: String,
        dueTime: String,
        color: String,
        done: Bool = false,
        reminded: Bool = false,
        calendarAdded: Bool? = nil
    ) {
        self.id = id
        self.course = course
        self.title = title
        self.emoji = emoji
        self.dueDate = dueDate
        self.dueTime = dueTime
        self.color = color
        self.done = done
        self.reminded = reminded
        self.calendarAdded = calendarAdded
    }

    public init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        id = values.value(.id, default: "")
        course = values.value(.course, default: "")
        title = values.value(.title, default: "")
        emoji = values.value(.emoji, default: "📝")
        dueDate = values.value(.dueDate, default: "")
        dueTime = values.value(.dueTime, default: "23:59")
        color = values.value(.color, default: "#9471c7")
        done = values.value(.done, default: false)
        reminded = values.value(.reminded, default: false)
        calendarAdded = values.optional(.calendarAdded)
    }
}

/// The persisted data contract shared by the website, iOS app, widgets and notification service.
public struct MukeData: Codable, Equatable, Sendable {
    public var jobs: [Job]
    public var shifts: [Shift]
    public var tasks: [TodoTask]
    public var plans: [Plan]
    public var classes: [RecurringClass]
    public var assignments: [Assignment]
    public var classReminderLog: [String]
    public var diary: [String: String]
    public var workouts: [String: String]
    public var campusCalendarDownloaded: Bool
    public var notificationSetupDone: Bool
    public var scheduleReminderDays: Int
    public var assignmentReminderDays: Int
    public var lastBackupAt: String?

    public init(
        jobs: [Job] = [],
        shifts: [Shift] = [],
        tasks: [TodoTask] = [],
        plans: [Plan] = [],
        classes: [RecurringClass] = [],
        assignments: [Assignment] = [],
        classReminderLog: [String] = [],
        diary: [String: String] = [:],
        workouts: [String: String] = [:],
        campusCalendarDownloaded: Bool = false,
        notificationSetupDone: Bool = false,
        scheduleReminderDays: Int = 1,
        assignmentReminderDays: Int = 7,
        lastBackupAt: String? = nil
    ) {
        self.jobs = jobs
        self.shifts = shifts
        self.tasks = tasks
        self.plans = plans
        self.classes = classes
        self.assignments = assignments
        self.classReminderLog = classReminderLog
        self.diary = diary
        self.workouts = workouts
        self.campusCalendarDownloaded = campusCalendarDownloaded
        self.notificationSetupDone = notificationSetupDone
        self.scheduleReminderDays = scheduleReminderDays
        self.assignmentReminderDays = assignmentReminderDays
        self.lastBackupAt = lastBackupAt
    }

    public static let empty = MukeData()

    private enum CodingKeys: String, CodingKey {
        case jobs, shifts, tasks, plans, classes, assignments
        case classReminderLog, diary, workouts, gymDates
        case campusCalendarDownloaded, notificationSetupDone
        case scheduleReminderDays, assignmentReminderDays, lastBackupAt
    }

    public init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        jobs = values.value(.jobs, default: [])
        shifts = values.value(.shifts, default: [])
        tasks = values.value(.tasks, default: [])
        plans = values.value(.plans, default: [])
        classes = values.value(.classes, default: [])
        assignments = values.value(.assignments, default: [])
        classReminderLog = values.value(.classReminderLog, default: [])
        diary = values.value(.diary, default: [:])

        if let decodedWorkouts: [String: String] = values.optional(.workouts) {
            workouts = decodedWorkouts
        } else {
            let legacyGymDates: [String] = values.value(.gymDates, default: [])
            workouts = Dictionary(uniqueKeysWithValues: legacyGymDates.map { ($0, "腿") })
        }

        campusCalendarDownloaded = values.value(.campusCalendarDownloaded, default: false)
        notificationSetupDone = values.value(.notificationSetupDone, default: false)
        scheduleReminderDays = values.value(.scheduleReminderDays, default: 1)
        assignmentReminderDays = values.value(.assignmentReminderDays, default: 7)
        lastBackupAt = values.optional(.lastBackupAt)
    }

    public func encode(to encoder: Encoder) throws {
        var values = encoder.container(keyedBy: CodingKeys.self)
        try values.encode(jobs, forKey: .jobs)
        try values.encode(shifts, forKey: .shifts)
        try values.encode(tasks, forKey: .tasks)
        try values.encode(plans, forKey: .plans)
        try values.encode(classes, forKey: .classes)
        try values.encode(assignments, forKey: .assignments)
        try values.encode(classReminderLog, forKey: .classReminderLog)
        try values.encode(diary, forKey: .diary)
        try values.encode(workouts, forKey: .workouts)
        try values.encode(campusCalendarDownloaded, forKey: .campusCalendarDownloaded)
        try values.encode(notificationSetupDone, forKey: .notificationSetupDone)
        try values.encode(scheduleReminderDays, forKey: .scheduleReminderDays)
        try values.encode(assignmentReminderDays, forKey: .assignmentReminderDays)
        try values.encodeIfPresent(lastBackupAt, forKey: .lastBackupAt)
    }
}

private extension KeyedDecodingContainer {
    func value<T: Decodable>(_ key: Key, default defaultValue: T) -> T {
        (try? decode(T.self, forKey: key)) ?? defaultValue
    }

    func optional<T: Decodable>(_ key: Key) -> T? {
        guard contains(key) else { return nil }
        return try? decodeIfPresent(T.self, forKey: key)
    }
}
