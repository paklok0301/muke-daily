# 暮刻 iOS 原生 Companion

這個目錄把現有暮刻網頁介面連接到 iOS 系統能力。它不是另一張鎖屏示意圖，而是實際使用 EventKit、UserNotifications、WidgetKit 與 ActivityKit 的原生工程。

## 能做到的事

- 使用者一次授權完整行事曆存取後，普通活動、每週課堂、功課死線及工時會自動建立、更新或刪除於專屬「暮刻」Apple 行事曆。
- 本機通知在資料儲存時預先交給 iOS 排程；即使 App 已關閉，已排程通知仍可發出。
- 鎖屏 `accessoryRectangular` Widget 長駐顯示下一項與剩餘數量。
- `systemMedium` Widget 以深色雙欄顯示日程／待辦，接近參考圖片的資訊結構。
- Live Activity 在鎖屏底部顯示今日大型黑卡，最多展示最接近的日程和待辦，其餘用 `+N` 表示。

## Apple 的必要限制

- App 不能跳過使用者的行事曆及通知授權，也不能自動替使用者把 Widget 放到鎖屏。
- 一般鎖屏 Widget 很小；參考圖的大卡必須使用 Live Activity。
- Live Activity 最多活躍約 8 小時，不能成為永久 24/7 面板。純本機版本需要在 App 前景啟動；若要每天在 App 完全沒有開啟時自動開始，必須另設 APNs push-to-start 後端及 Apple Developer 推送金鑰。
- Safari PWA 的 `localStorage` 不能直接由 WKWebView 讀取。首次轉移需先在網站下載 JSON 備份，再於原生 App 匯入一次。

## 在 Mac 建立工程

目前這部 Mac 只有 Command Line Tools，沒有完整 Xcode／iPhone SDK，所以無法在此環境簽署或安裝到實機。完成以下一次性步驟後即可建置：

1. 從 Mac App Store 安裝最新版 Xcode，啟動一次並安裝 iOS Platform。
2. 安裝 XcodeGen：`brew install xcodegen`。
3. 在此目錄執行 `xcodegen generate`。
4. 開啟 `MukeDaily.xcodeproj`，在兩個 targets 選擇你的 Apple Team。
5. 把 `group.com.paklok0301.muke` App Group 加到你的 Apple Developer 帳戶，或同時修改 `project.yml`、entitlements 及 `AppGroup.identifier` 為你自己的唯一名稱。
6. 選擇已連接的 iPhone 後 Run；第一次開啟按「授權行事曆與通知」。
7. 長按 iPhone 鎖屏 → 自訂 → 鎖定畫面 → 加入「暮刻下一項」。

共用資料與日期邏輯可在沒有 Xcode 的情況下測試：

```sh
cd ios
swift test
```

## 資料流

```text
React / WKWebView
      │ 完整 versioned JSON snapshot
      ▼
ScheduleSyncCoordinator
  ├─ App Group JSON ───────► WidgetKit / Live Activity
  ├─ EventKit reconcile ───► Apple Calendar + alarms
  └─ Local scheduling ─────► iOS notifications
```
