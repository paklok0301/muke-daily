import Foundation
@preconcurrency import UserNotifications

public struct ReminderScheduleResult: Sendable, Equatable {
    public let dailySummaries: Int
    public let assignmentReminders: Int

    public var summary: String {
        "已預排 \(dailySummaries) 個每日摘要及 \(assignmentReminders) 個功課提醒"
    }
}

public enum ReminderSchedulerError: LocalizedError, Sendable {
    case accessDenied

    public var errorDescription: String? {
        "未允許通知，請到「設定」開啟暮刻通知。"
    }
}

/// Pre-schedules local notifications with iOS. Once accepted by
/// `UNUserNotificationCenter`, they fire even when the app is suspended or closed.
@MainActor
public final class ReminderScheduler {
    private static let identifierPrefix = "muke."
    private static let summaryDaysAhead = 28
    private static let maximumAssignmentRequests = 32

    private let center: UNUserNotificationCenter
    private let calendar: Calendar
    private let agendaBuilder: AgendaBuilder

    public init(
        center: UNUserNotificationCenter = .current(),
        calendar: Calendar = HongKongDate.calendar,
        agendaBuilder: AgendaBuilder = AgendaBuilder()
    ) {
        self.center = center
        self.calendar = calendar
        self.agendaBuilder = agendaBuilder
    }

    public var isAuthorized: Bool {
        get async {
            let settings = await center.notificationSettings()
            return settings.authorizationStatus == .authorized
                || settings.authorizationStatus == .provisional
                || settings.authorizationStatus == .ephemeral
        }
    }

    @discardableResult
    public func requestAuthorization() async throws -> Bool {
        let settings = await center.notificationSettings()
        switch settings.authorizationStatus {
        case .authorized, .provisional, .ephemeral:
            return true
        case .notDetermined:
            return try await center.requestAuthorization(options: [.alert, .badge, .sound])
        case .denied:
            return false
        @unknown default:
            return false
        }
    }

    /// Replaces only requests owned by 暮刻, preserving notifications from every other app.
    /// The 28 + 32 split stays below iOS's practical 64-pending-request limit.
    public func reschedule(for data: MukeData, now: Date = Date()) async throws -> ReminderScheduleResult {
        guard await isAuthorized else { throw ReminderSchedulerError.accessDenied }

        let currentRequests = await center.pendingNotificationRequests()
        let managedIdentifiers = currentRequests
            .map(\.identifier)
            .filter { $0.hasPrefix(Self.identifierPrefix) }
        center.removePendingNotificationRequests(withIdentifiers: managedIdentifiers)

        var dailyCount = 0
        var assignmentCount = 0
        let pendingTasks = agendaBuilder.pendingTasks(from: data)

        for dayOffset in 1...Self.summaryDaysAhead {
            guard let targetDate = calendar.date(byAdding: .day, value: dayOffset, to: now),
                  let fireDate = eveningBefore(targetDate),
                  fireDate > now
            else { continue }

            // `entries(on:)` already attaches pending tasks for widgets. Daily summaries append
            // them separately under a clear "待辦" label, so remove the attached copies here.
            let entries = agendaBuilder.entries(on: targetDate, from: data)
                .filter { $0.kind != .task }
            guard !entries.isEmpty || !pendingTasks.isEmpty else { continue }

            let identifier = "\(Self.identifierPrefix)summary.\(HongKongDate.dateKey(for: targetDate))"
            let content = dailySummaryContent(
                entries: entries,
                pendingTasks: pendingTasks,
                targetDate: targetDate
            )
            try await center.add(UNNotificationRequest(
                identifier: identifier,
                content: content,
                trigger: calendarTrigger(on: fireDate)
            ))
            dailyCount += 1
        }

        let assignmentCandidates = data.assignments
            .filter { !$0.done }
            .compactMap { assignment -> (Assignment, Date, Date)? in
                guard let dueDate = HongKongDate.dateTime(
                    dateKey: assignment.dueDate,
                    time: assignment.dueTime
                ), dueDate > now else { return nil }
                let reminderDate = calendar.date(
                    byAdding: .day,
                    value: -max(0, data.assignmentReminderDays),
                    to: dueDate
                ) ?? now
                return (assignment, dueDate, reminderDate)
            }
            .sorted { $0.1 < $1.1 }
            .prefix(Self.maximumAssignmentRequests)

        for (assignment, dueDate, nominalReminderDate) in assignmentCandidates {
            let fireDate = normalizedAssignmentFireDate(
                nominalReminderDate,
                dueDate: dueDate,
                now: now
            )
            guard fireDate < dueDate else { continue }

            let content = assignmentContent(assignment, dueDate: dueDate)
            let identifier = "\(Self.identifierPrefix)assignment.\(assignment.id)"
            let trigger: UNNotificationTrigger
            if fireDate.timeIntervalSince(now) < 2 {
                trigger = UNTimeIntervalNotificationTrigger(timeInterval: 2, repeats: false)
            } else {
                trigger = calendarTrigger(on: fireDate)
            }
            try await center.add(UNNotificationRequest(
                identifier: identifier,
                content: content,
                trigger: trigger
            ))
            assignmentCount += 1
        }

        return ReminderScheduleResult(
            dailySummaries: dailyCount,
            assignmentReminders: assignmentCount
        )
    }

    public func removeAllScheduledReminders() async {
        let requests = await center.pendingNotificationRequests()
        let identifiers = requests
            .map(\.identifier)
            .filter { $0.hasPrefix(Self.identifierPrefix) }
        center.removePendingNotificationRequests(withIdentifiers: identifiers)
    }
}

private extension ReminderScheduler {
    func eveningBefore(_ targetDate: Date) -> Date? {
        guard let previousDay = calendar.date(byAdding: .day, value: -1, to: targetDate) else {
            return nil
        }
        return calendar.date(bySettingHour: 20, minute: 30, second: 0, of: previousDay)
    }

    func calendarTrigger(on date: Date) -> UNCalendarNotificationTrigger {
        var components = calendar.dateComponents(
            [.year, .month, .day, .hour, .minute, .second],
            from: date
        )
        components.timeZone = calendar.timeZone
        return UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
    }

    func dailySummaryContent(
        entries: [AgendaEntry],
        pendingTasks: [AgendaEntry],
        targetDate: Date
    ) -> UNMutableNotificationContent {
        let content = UNMutableNotificationContent()
        let total = entries.count + pendingTasks.count
        content.title = "🗓️ 明日安排 · \(total) 項"
        content.subtitle = fullDateFormatter.string(from: targetDate)

        var lines = entries.prefix(8).map { entry in
            let time = entry.start.map(shortTimeFormatter.string(from:)) ?? "全日"
            return "\(time) \(entry.emoji) \(entry.title)"
        }
        lines.append(contentsOf: pendingTasks.prefix(3).map { "待辦 \($0.emoji) \($0.title)" })
        if total > lines.count {
            lines.append("另外還有 \(total - lines.count) 項，打開暮刻查看")
        }
        content.body = lines.joined(separator: "\n")
        content.sound = .default
        content.badge = NSNumber(value: total)
        content.threadIdentifier = "muke.daily-summary"
        content.categoryIdentifier = "MUKE_DAILY_SUMMARY"
        content.interruptionLevel = .active
        content.userInfo = [
            "destination": "today",
            "date": HongKongDate.dateKey(for: targetDate)
        ]
        return content
    }

    func assignmentContent(_ assignment: Assignment, dueDate: Date) -> UNMutableNotificationContent {
        let content = UNMutableNotificationContent()
        content.title = "\(assignment.emoji) 功課死線提醒"
        content.subtitle = assignment.course
        content.body = "\(assignment.title) · \(fullDateTimeFormatter.string(from: dueDate)) 截止"
        content.sound = .default
        content.threadIdentifier = "muke.assignments"
        content.categoryIdentifier = "MUKE_ASSIGNMENT"
        content.interruptionLevel = .active
        content.userInfo = [
            "destination": "campus",
            "assignmentID": assignment.id,
            "date": assignment.dueDate
        ]
        return content
    }

    /// Past reminder dates are delivered shortly after the latest sync instead of being lost.
    func normalizedAssignmentFireDate(_ nominal: Date, dueDate: Date, now: Date) -> Date {
        let nineInTheMorning = calendar.date(
            bySettingHour: 9,
            minute: 0,
            second: 0,
            of: nominal
        ) ?? nominal
        if nineInTheMorning > now {
            return nineInTheMorning
        }
        return min(now.addingTimeInterval(2), dueDate.addingTimeInterval(-1))
    }

    var shortTimeFormatter: DateFormatter {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "zh_HK")
        formatter.timeZone = calendar.timeZone
        formatter.dateFormat = "HH:mm"
        return formatter
    }

    var fullDateFormatter: DateFormatter {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "zh_HK")
        formatter.timeZone = calendar.timeZone
        formatter.dateFormat = "M 月 d 日 EEEE"
        return formatter
    }

    var fullDateTimeFormatter: DateFormatter {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "zh_HK")
        formatter.timeZone = calendar.timeZone
        formatter.dateFormat = "M 月 d 日 HH:mm"
        return formatter
    }
}
