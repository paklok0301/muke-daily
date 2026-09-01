import SwiftUI

struct RootView: View {
    @EnvironmentObject private var model: NativeAppModel
    @AppStorage("muke-native-onboarding-complete") private var onboardingComplete = false

    var body: some View {
        ZStack {
            Color(red: 0.027, green: 0.031, blue: 0.039).ignoresSafeArea()

            WebContainer(
                isLoading: $model.isLoading,
                onSnapshot: { data in await model.receive(snapshotData: data) },
                onNativeSettings: { model.showNativeSettings = true }
            )
            .ignoresSafeArea(.container, edges: .bottom)

            if model.isLoading {
                ProgressView()
                    .tint(Color(red: 0.95, green: 0.91, blue: 0.87))
            }
        }
        .preferredColorScheme(.dark)
        .task {
            if !onboardingComplete {
                model.showNativeSettings = true
            }
        }
        .sheet(isPresented: $model.showNativeSettings) {
            NativeSetupView(onboardingComplete: $onboardingComplete)
                .environmentObject(model)
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
        }
    }
}

private struct NativeSetupView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var model: NativeAppModel
    @Binding var onboardingComplete: Bool
    @State private var requesting = false

    private let ink = Color(red: 0.027, green: 0.031, blue: 0.039)
    private let ivory = Color(red: 0.96, green: 0.95, blue: 0.93)
    private let muted = Color(red: 0.58, green: 0.60, blue: 0.64)
    private let wine = Color(red: 0.62, green: 0.24, blue: 0.29)

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("IPHONE NATIVE")
                            .font(.caption2.weight(.bold))
                            .tracking(2.4)
                            .foregroundStyle(wine)
                        Text("讓系統接手，\n不用靠你記得開 App。")
                            .font(.system(size: 34, weight: .regular, design: .serif))
                            .foregroundStyle(ivory)
                        Text("一次授權後，暮刻會自動同步已知行程、預排通知，並把同一份資料交給鎖屏。")
                            .font(.subheadline)
                            .foregroundStyle(muted)
                            .lineSpacing(4)
                    }

                    VStack(spacing: 10) {
                        setupRow(symbol: "calendar", title: "自動加入 Apple 行事曆", detail: "新增、修改或刪除活動時同步更新，不再逐個開啟 .ics。", color: .orange)
                        setupRow(symbol: "bell.badge", title: "關閉 App 仍會提醒", detail: "已排程的本機通知交由 iOS 發送；Focus 模式仍由你控制。", color: .green)
                        setupRow(symbol: "rectangle.on.rectangle", title: "真正的鎖屏資訊", detail: "常駐小工具顯示下一項；Live Activity 顯示今日大型黑卡。", color: .blue)
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        Text(model.permissionSummary)
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(ivory)
                        Text(model.syncSummary)
                            .font(.caption)
                            .foregroundStyle(muted)
                    }
                    .padding(15)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.white.opacity(0.045), in: RoundedRectangle(cornerRadius: 17, style: .continuous))

                    Button {
                        requesting = true
                        Task {
                            await model.requestPermissions()
                            onboardingComplete = true
                            requesting = false
                        }
                    } label: {
                        HStack {
                            if requesting { ProgressView().tint(ink) }
                            Text(requesting ? "正在設定…" : "授權行事曆與通知")
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(FilledSetupButtonStyle(background: ivory, foreground: ink))
                    .disabled(requesting)

                    Button {
                        Task { await model.refreshLiveActivity() }
                    } label: {
                        Text("立即顯示今日 Live Activity")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(OutlineSetupButtonStyle(foreground: ivory))

                    VStack(alignment: .leading, spacing: 7) {
                        Text("把常駐小工具放到鎖屏")
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(ivory)
                        Text("長按鎖屏 → 自訂 → 鎖定畫面 → 加入「暮刻下一項」。Apple 不允許 App 自動替你把 Widget 放上鎖屏。")
                            .font(.caption)
                            .foregroundStyle(muted)
                            .lineSpacing(3)
                        Text("由網站轉移資料時，先下載「暮刻備份」，再在原生 App 的資料管理中匯入一次。")
                            .font(.caption)
                            .foregroundStyle(muted)
                            .lineSpacing(3)
                    }

                    Button("完成") {
                        onboardingComplete = true
                        dismiss()
                    }
                    .frame(maxWidth: .infinity)
                    .foregroundStyle(muted)
                }
                .padding(22)
            }
            .background(ink)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("關閉") { dismiss() }
                        .foregroundStyle(muted)
                }
            }
        }
        .preferredColorScheme(.dark)
    }

    private func setupRow(symbol: String, title: String, detail: String, color: Color) -> some View {
        HStack(alignment: .top, spacing: 13) {
            Image(systemName: symbol)
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(color)
                .frame(width: 38, height: 38)
                .background(color.opacity(0.11), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(.subheadline.weight(.semibold)).foregroundStyle(ivory)
                Text(detail).font(.caption).foregroundStyle(muted).lineSpacing(2)
            }
            Spacer(minLength: 0)
        }
        .padding(14)
        .background(Color.white.opacity(0.035), in: RoundedRectangle(cornerRadius: 17, style: .continuous))
    }
}

private struct FilledSetupButtonStyle: ButtonStyle {
    let background: Color
    let foreground: Color
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline.weight(.bold))
            .foregroundStyle(foreground)
            .padding(.vertical, 15)
            .background(background.opacity(configuration.isPressed ? 0.8 : 1), in: Capsule())
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
    }
}

private struct OutlineSetupButtonStyle: ButtonStyle {
    let foreground: Color
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(foreground.opacity(configuration.isPressed ? 0.7 : 1))
            .padding(.vertical, 14)
            .overlay(Capsule().stroke(Color.white.opacity(0.14), lineWidth: 1))
    }
}
