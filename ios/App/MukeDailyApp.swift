import SwiftUI

@main
struct MukeDailyApp: App {
    @StateObject private var model = NativeAppModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(model)
        }
    }
}

@MainActor
final class NativeAppModel: ObservableObject {
    @Published var isLoading = true
    @Published var showNativeSettings = false
    @Published var permissionSummary = "尚未設定 Apple 行事曆與通知。"
    @Published var syncSummary = "等待暮刻資料…"

    init() {
        ScheduleSyncCoordinator.shared.installLiveActivityRefresher(LiveActivityService.shared)
    }

    func requestPermissions() async {
        let report = await ScheduleSyncCoordinator.shared.requestPermissions()
        permissionSummary = report.summary
    }

    func receive(snapshotData: Data) async {
        let report = await ScheduleSyncCoordinator.shared.receive(snapshotData: snapshotData)
        syncSummary = report.summary
    }

    func refreshLiveActivity() async {
        let snapshot = SharedScheduleStore().load()
        await LiveActivityService.refresh(with: snapshot)
    }
}
