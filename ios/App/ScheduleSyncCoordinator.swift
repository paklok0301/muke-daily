import Foundation
import WidgetKit

@MainActor
public protocol LiveActivityRefreshing: AnyObject {
    func refresh(using data: MukeData) async
}

public struct PermissionReport: Sendable, Equatable {
    public let calendarAuthorized: Bool
    public let notificationsAuthorized: Bool
    public let errors: [String]

    public var summary: String {
        if calendarAuthorized && notificationsAuthorized {
            return "已開啟行事曆及通知；活動會自動同步，App 關閉後仍會收到提醒。"
        }
        if calendarAuthorized {
            return "行事曆已開啟；尚未允許通知。"
        }
        if notificationsAuthorized {
            return "通知已開啟；尚未允許行事曆完整存取。"
        }
        return errors.first ?? "尚未開啟行事曆及通知權限。"
    }
}

public struct SyncReport: Sendable, Equatable {
    public let savedToAppGroup: Bool
    public let calendar: CalendarSyncResult?
    public let reminders: ReminderScheduleResult?
    public let widgetReloaded: Bool
    public let liveActivityRefreshed: Bool
    public let errors: [String]

    public var succeeded: Bool {
        savedToAppGroup && errors.isEmpty
    }

    public var summary: String {
        guard savedToAppGroup else {
            return errors.first ?? "未能儲存最新資料。"
        }

        var parts = ["資料已儲存"]
        if calendar != nil { parts.append("行事曆已自動更新") }
        if reminders != nil { parts.append("背景提醒已重新安排") }
        if widgetReloaded { parts.append("鎖屏小工具已更新") }
        if !errors.isEmpty { parts.append(errors.joined(separator: "；")) }
        return parts.joined(separator: "，") + "。"
    }
}

/// The single entry point used by the WebView bridge and native settings screen.
/// It deliberately saves shared JSON first, so widgets always receive the latest snapshot even
/// when the user has declined Calendar or Notification permission.
@MainActor
public final class ScheduleSyncCoordinator {
    public static let shared = ScheduleSyncCoordinator()

    private let store: SharedScheduleStore
    private let calendarService: CalendarSyncService
    private let reminderScheduler: ReminderScheduler
    private weak var liveActivityRefresher: (any LiveActivityRefreshing)?

    public init(
        store: SharedScheduleStore = SharedScheduleStore(),
        calendarService: CalendarSyncService? = nil,
        reminderScheduler: ReminderScheduler? = nil,
        liveActivityRefresher: (any LiveActivityRefreshing)? = nil
    ) {
        self.store = store
        self.calendarService = calendarService ?? CalendarSyncService()
        self.reminderScheduler = reminderScheduler ?? ReminderScheduler()
        self.liveActivityRefresher = liveActivityRefresher
    }

    public func installLiveActivityRefresher(_ refresher: (any LiveActivityRefreshing)?) {
        liveActivityRefresher = refresher
    }

    /// Requests both user-facing permissions, then immediately applies any snapshot that was
    /// already received from the web app. This makes the first permission flow feel atomic.
    public func requestPermissions() async -> PermissionReport {
        var errors: [String] = []
        var calendarAuthorized = false
        var notificationsAuthorized = false

        do {
            calendarAuthorized = try await calendarService.requestFullAccess()
            if !calendarAuthorized {
                errors.append(CalendarSyncError.accessDenied.localizedDescription)
            }
        } catch {
            errors.append(userFacing(error))
        }

        do {
            notificationsAuthorized = try await reminderScheduler.requestAuthorization()
            if !notificationsAuthorized {
                errors.append(ReminderSchedulerError.accessDenied.localizedDescription)
            }
        } catch {
            errors.append(userFacing(error))
        }

        if calendarAuthorized || notificationsAuthorized {
            do {
                let snapshot = try store.loadThrowing()
                // An absent App Group value decodes to `.empty`. Do not let a first-run permission
                // sheet treat that placeholder as an instruction to erase an older 暮刻 calendar.
                // A genuinely empty user snapshot is still reconciled by `receive(snapshotData:)`.
                if snapshotHasContent(snapshot) {
                    if calendarAuthorized {
                        _ = try await calendarService.synchronize(snapshot)
                    }
                    if notificationsAuthorized {
                        _ = try await reminderScheduler.reschedule(for: snapshot)
                    }
                    await liveActivityRefresher?.refresh(using: snapshot)
                }
                WidgetCenter.shared.reloadAllTimelines()
            } catch {
                errors.append("權限已開啟，但首次同步失敗：\(userFacing(error))")
            }
        }

        return PermissionReport(
            calendarAuthorized: calendarAuthorized,
            notificationsAuthorized: notificationsAuthorized,
            errors: errors
        )
    }

    /// Receives one full JSON snapshot from JavaScript. Full-snapshot reconciliation avoids
    /// edge cases where several web mutations arrive while the native app is backgrounded.
    public func receive(snapshotData: Data) async -> SyncReport {
        let snapshot: MukeData
        do {
            snapshot = try JSONDecoder().decode(MukeData.self, from: snapshotData)
        } catch {
            return SyncReport(
                savedToAppGroup: false,
                calendar: nil,
                reminders: nil,
                widgetReloaded: false,
                liveActivityRefreshed: false,
                errors: ["收到的行程資料無法讀取：\(userFacing(error))"]
            )
        }

        do {
            try store.save(snapshot)
        } catch {
            return SyncReport(
                savedToAppGroup: false,
                calendar: nil,
                reminders: nil,
                widgetReloaded: false,
                liveActivityRefreshed: false,
                errors: ["無法儲存至鎖屏小工具：\(userFacing(error))"]
            )
        }

        var calendarResult: CalendarSyncResult?
        var reminderResult: ReminderScheduleResult?
        var errors: [String] = []

        if calendarService.hasFullAccess {
            do {
                calendarResult = try await calendarService.synchronize(snapshot)
            } catch {
                errors.append("行事曆同步失敗：\(userFacing(error))")
            }
        } else {
            errors.append("尚未允許行事曆完整存取")
        }

        if await reminderScheduler.isAuthorized {
            do {
                reminderResult = try await reminderScheduler.reschedule(for: snapshot)
            } catch {
                errors.append("提醒排程失敗：\(userFacing(error))")
            }
        } else {
            errors.append("尚未允許通知")
        }

        WidgetCenter.shared.reloadAllTimelines()
        let refreshedLiveActivity = liveActivityRefresher != nil
        await liveActivityRefresher?.refresh(using: snapshot)

        return SyncReport(
            savedToAppGroup: true,
            calendar: calendarResult,
            reminders: reminderResult,
            widgetReloaded: true,
            liveActivityRefreshed: refreshedLiveActivity,
            errors: errors
        )
    }

    private func userFacing(_ error: Error) -> String {
        if let localized = error as? LocalizedError,
           let description = localized.errorDescription {
            return description
        }
        return error.localizedDescription
    }

    private func snapshotHasContent(_ data: MukeData) -> Bool {
        !data.jobs.isEmpty
            || !data.shifts.isEmpty
            || !data.tasks.isEmpty
            || !data.plans.isEmpty
            || !data.classes.isEmpty
            || !data.assignments.isEmpty
            || !data.workouts.isEmpty
    }
}
