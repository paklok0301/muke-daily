import Foundation
import Testing
@testable import MukeShared

@Test func hongKongDateParsingIsStrictAndDeterministic() throws {
    let midnight = try #require(HongKongDate.date(from: "2026-09-01"))
    #expect(HongKongDate.dateKey(for: midnight) == "2026-09-01")
    #expect(HongKongDate.weekday(for: "2026-09-01") == 2)
    #expect(HongKongDate.date(from: "2026-02-30") == nil)
    #expect(HongKongDate.date(from: "2026-9-1") == nil)
    #expect(HongKongDate.dateTime(dateKey: "2026-09-01", time: "24:00") == nil)

    let instant = try #require(ISO8601DateFormatter().date(from: "2026-08-31T16:30:00Z"))
    #expect(HongKongDate.dateKey(for: instant) == "2026-09-01")
}

@Test func decodesCurrentWebsiteJSONAndLegacyGymDates() throws {
    let json = #"""
    {
      "jobs": [{"id":"tkd","name":"跆拳道","rate":80,"color":"#9f3d4a"}],
      "shifts": [{"id":"s1","jobId":"tkd","date":"2026-09-01","start":"18:00","end":"20:00","breakMinutes":0,"location":"灣仔","sessions":2,"amount":160}],
      "tasks": [{"id":"t1","text":"交學費","done":false}],
      "plans": [{"id":"p1","activity":"小組會議","date":"2026-09-01","time":"08:00","color":"#65ad7b","emoji":"📌","done":false,"notified":false}],
      "classes": [{"id":"c1","name":"統計學","emoji":"📚","weekday":2,"startTime":"09:00","endTime":"10:30","startDate":"2026-08-25","endDate":"2026-12-01","location":"A101","color":"#6683cf"}],
      "assignments": [{"id":"a1","course":"PSYC","title":"閱讀報告","emoji":"📝","dueDate":"2026-09-01","dueTime":"23:59","color":"#9471c7","done":false,"reminded":false}],
      "gymDates": ["2026-09-01"],
      "scheduleReminderDays": 2,
      "assignmentReminderDays": 14
    }
    """#

    let data = try JSONDecoder().decode(MukeData.self, from: Data(json.utf8))
    #expect(data.jobs.first?.rate == 80)
    #expect(data.shifts.first?.sessions == 2)
    #expect(data.classes.first?.weekday == 2)
    #expect(data.workouts["2026-09-01"] == "腿")
    #expect(data.scheduleReminderDays == 2)
    #expect(data.assignmentReminderDays == 14)
    #expect(data.notificationSetupDone == false)

    let encoded = try JSONEncoder().encode(data)
    let encodedObject = try #require(JSONSerialization.jsonObject(with: encoded) as? [String: Any])
    #expect(encodedObject["workouts"] != nil)
    #expect(encodedObject["gymDates"] == nil)
}

@Test func agendaIncludesEveryDailySourceAndOmitsCompletedItems() throws {
    let selectedDate = try #require(HongKongDate.date(from: "2026-09-01"))
    let data = MukeData(
        jobs: [Job(id: "tkd", name: "跆拳道", rate: 80, color: "#9f3d4a")],
        shifts: [
            Shift(id: "s1", jobId: "tkd", date: "2026-09-01", start: "13:00", end: "15:00", location: "灣仔", sessions: 2),
            Shift(id: "s2", jobId: "tkd", date: "2026-09-02", start: "13:00", end: "15:00"),
        ],
        tasks: [
            TodoTask(id: "t1", text: "買參考書"),
            TodoTask(id: "t2", text: "已完成", done: true),
        ],
        plans: [
            Plan(id: "p1", activity: "小組會議", date: "2026-09-01", time: "08:00", color: "#65ad7b"),
            Plan(id: "p2", activity: "已完成活動", date: "2026-09-01", time: "07:00", color: "#65ad7b", done: true),
        ],
        classes: [
            RecurringClass(id: "c1", name: "統計學", weekday: 2, startTime: "09:00", endTime: "10:30", startDate: "2026-08-25", endDate: "2026-12-01", location: "A101", color: "#6683cf"),
            RecurringClass(id: "c2", name: "錯誤星期", weekday: 3, startTime: "11:00", endTime: "12:00", startDate: "2026-08-25", endDate: "2026-12-01", color: "#6683cf"),
        ],
        assignments: [
            Assignment(id: "a1", course: "PSYC", title: "閱讀報告", dueDate: "2026-09-01", dueTime: "23:59", color: "#9471c7"),
            Assignment(id: "a2", course: "PSYC", title: "已交", dueDate: "2026-09-01", dueTime: "12:00", color: "#9471c7", done: true),
        ],
        workouts: ["2026-09-01": "胸"]
    )

    let entries = AgendaBuilder().entries(on: selectedDate, from: data)
    #expect(entries.map(\.kind) == [.plan, .recurringClass, .shift, .assignment, .workout, .task])
    #expect(entries.map(\.title) == ["小組會議", "統計學", "跆拳道", "PSYC · 閱讀報告", "胸日訓練", "買參考書"])
    #expect(entries.allSatisfy { $0.dateKey == "2026-09-01" })
    #expect(entries.first(where: { $0.kind == .shift })?.subtitle == "灣仔 · 2 堂／節")
    #expect(entries.first(where: { $0.kind == .recurringClass })?.subtitle == "A101")
}

@Test func overnightClassAndShiftEndOnFollowingDay() throws {
    let selectedDate = try #require(HongKongDate.date(from: "2026-09-01"))
    let data = MukeData(
        shifts: [Shift(id: "s", jobId: "", date: "2026-09-01", start: "22:00", end: "01:00")],
        classes: [RecurringClass(id: "c", name: "夜間課", weekday: 2, startTime: "23:00", endTime: "00:30", startDate: "2026-09-01", endDate: "2026-09-01", color: "#6683cf")]
    )

    let timedEntries = AgendaBuilder().entries(on: selectedDate, from: data).filter { $0.end != nil }
    #expect(timedEntries.count == 2)
    for entry in timedEntries {
        let end = try #require(entry.end)
        let start = try #require(entry.start)
        #expect(end > start)
        #expect(HongKongDate.dateKey(for: end) == "2026-09-02")
    }
}

@Test func dateRangeExpandsRecurringClassesAndPendingTasks() throws {
    let start = try #require(HongKongDate.date(from: "2026-09-01"))
    let end = try #require(HongKongDate.date(from: "2026-09-03"))
    let data = MukeData(
        tasks: [TodoTask(id: "t", text: "每日未完成事項")],
        classes: [RecurringClass(id: "c", name: "星期三課", weekday: 3, startTime: "10:00", endTime: "11:00", startDate: "2026-09-01", endDate: "2026-09-30", color: "#6683cf")]
    )

    let entries = AgendaBuilder().entries(from: start, through: end, from: data)
    #expect(entries.filter { $0.kind == .task }.count == 3)
    #expect(entries.filter { $0.kind == .recurringClass }.map(\.dateKey) == ["2026-09-02"])
    #expect(AgendaBuilder().entries(from: end, through: start, from: data).isEmpty)
}

@Test func sharedStoreRoundTripAndSafeFallback() throws {
    let suiteName = "MukeSharedTests.\(UUID().uuidString)"
    let defaults = try #require(UserDefaults(suiteName: suiteName))
    defaults.removePersistentDomain(forName: suiteName)
    defer { defaults.removePersistentDomain(forName: suiteName) }

    let store = SharedScheduleStore(suiteName: suiteName, storageKey: "schedule", userDefaults: defaults)
    #expect(store.load() == .empty)

    let expected = MukeData(
        tasks: [TodoTask(id: "t", text: "帶學生證")],
        plans: [Plan(id: "p", activity: "迎新", date: "2026-09-01", time: "09:00", color: "#65ad7b")],
        workouts: ["2026-09-01": "肩"]
    )
    try store.save(expected)
    #expect(try store.loadThrowing() == expected)

    defaults.set("not-json", forKey: "schedule")
    #expect(store.load() == .empty)
    #expect(throws: (any Error).self) {
        try store.loadThrowing()
    }

    store.removeAllData()
    #expect(store.load() == .empty)
}
