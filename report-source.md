# 暮刻產品審視 — 研究底稿

- 日期：2026-08-28
- 對象：暮刻的唯一主要使用者
- 範圍：每日待辦、活動、大學課表、功課死線、兼職工時與收入、健身、安裝及本機資料可靠度
- 方法：檢視現有程式與公開版本；以 Unigent 官方產品頁／商店資料、Apple WidgetKit／WebKit、RFC 5545、W3C、MDN 及香港政府 1823 的一手資料核對校園資訊架構、PWA、鎖屏、提醒、無障礙、本機儲存及假期資料能力。
- 假設：產品維持私人、本機優先、不連接 ChatGPT、不要求登入，正式版本繼續由 GitHub Pages 提供。

## Executive answer

暮刻已有清楚的視覺個性與五個實用核心：月曆、活動、校園、公事和健身。最大的使用阻力不是缺少更多功能，而是高頻資訊散落在不同分頁、工時錯誤難以修正，以及瀏覽器資料與提醒能力沒有被清楚解釋。最有價值的升級，是在首頁加入「今天摘要」、把公事變成可按月份瀏覽並可編輯、補上待辦清理和資料保護、改善觸控尺寸與文字縮放，並把通知描述改為與現況一致。

新增的大學生活需求適合採用「Unigent 式資訊層級、暮刻式私人介面」：整學期課堂只輸入一次，首頁先顯示今天與下一項，功課獨立管理死線，顏色與 emoji 用於掃視。Unigent 的社群、帳戶與校園討論並不符合暮刻免登入、私人使用的定位，因此不移植。純 GitHub Pages PWA 不能直接提供 WidgetKit 鎖屏小工具或 Live Activity；最可靠的無後端方案是輸出帶 `RRULE` 與 `VALARM` 的 iCalendar，由 Apple 日曆在鎖屏顯示及通知。

## Evidence and product implications

| Evidence | Product implication | Implemented response |
|---|---|---|
| iOS/iPadOS 16.4 起，加入主畫面的 Web App 可接收 Web Push；要求通知權限必須由直接操作觸發。 | 通知按鈕應由使用者主動點擊；不能暗示一般網頁在關閉後仍一定提醒。 | 保留主動開啟通知按鈕，明確標示現有「App 開啟時」提醒，重要項目可加入手機行事曆。 |
| Home Screen Web App 可用 Badging API；支援應以能力偵測處理。 | 待辦／到期計劃可在 App 圖示顯示數量，對每日回訪有價值。 | 以 `setAppBadge`／`clearAppBadge` 能力偵測更新未完成數量。 |
| 瀏覽器資料預設通常屬 best-effort；網站可透過 `navigator.storage.persist()` 要求持久儲存。 | 只說「本機儲存」不夠，使用者要知道備份狀態並可主動提高保留機會。 | 加入資料保護按鈕、上次備份時間和儲存錯誤提示；保留 JSON 匯出／匯入。 |
| WCAG 2.2 的最低目標尺寸為 24×24 CSS px 或具足夠間距；44×44 是更佳目標。 | 手機月曆箭嘴與主要操作不應只有細小文字點擊區。 | 主要導航與表單按鈕提高至約 44px，次要操作亦增加觸控範圍。 |
| WCAG 要求文字可放大至 200% 而不失去內容或功能。 | 不應以 viewport 鎖死縮放。 | 移除 `maximum-scale=1`。 |
| 香港政府 1823 提供的官方公眾假期 iCalendar 現時涵蓋 2025–2027，資料依憲報更新。 | 介面應標明實際資料範圍，不能聲稱永久每日自動更新。 | 假期來源改為「香港政府 1823 · 2025–2027」。 |

## Gap matrix

| Gap | Frequency | Impact | Decision |
|---|---:|---:|---|
| 今天要做的、活動、工時和健身分散 | 每日 | 高 | 首頁加入四格今天摘要、下一項及快速新增入口 |
| 工時只能新增／刪除，錯誤難修正 | 每月多次 | 高 | 加入編輯、重複偵測、月份切換及該月完整記錄 |
| 已完成待辦累積 | 每日 | 中 | 單項刪除及一鍵清除完成 |
| 本機資料可能被瀏覽器清理 | 低頻但高風險 | 高 | 持久儲存請求、上次備份時間、配額錯誤處理 |
| 小型觸控目標與禁止縮放 | 每日 | 中 | 放大目標並允許文字縮放 |
| 通知及假期文案過度承諾 | 偶發 | 中 | 改為能力如實說明 |

## Unigent benchmark and campus-mode synthesis

### 第一輪探索

- Unigent 官方網站把「這學期的課表一目了然」、學期行事曆及每週 Todo 放在核心位置，表示大學生最常用的不是通用待辦，而是具學期結構的課堂與死線。
- 官方 App Store 與 Google Play 說明同時強調整學期課表、今天課堂／課室和功課、測驗、報告；App Store 版本紀錄另顯示其鎖屏 Live Activity 會呈現今日課表及下一堂課。
- Apple WidgetKit 文件要求以 Xcode 建立 Widget Extension，並用 SwiftUI／WidgetKit 提供鎖屏小工具；因此靜態網站不能聲稱已建立同等原生 widget。
- Apple 支援文件確認 iOS 16 鎖屏可以加入「即將到來的日曆活動」等小工具，所以 Apple 日曆是暮刻現有架構的低摩擦橋接方案。
- WebKit 說明 iOS 16.4 主畫面 Web App 可接收 Web Push，但必須先取得推送訂閱並由遠端寄送訊息；GitHub Pages 沒有排程推送後端，不能保證關閉 App 後自行發送翌日摘要。
- RFC 5545 定義每週重複規則 `RRULE:FREQ=WEEKLY` 和相對警示 `VALARM`／`TRIGGER`，適合把課堂設成整學期每週重複，活動提前一天，功課提前七天。

### 證據缺口複核

| 問題 | 複核結果 | 產品決定 |
|---|---|---|
| Unigent 的價值是否來自社群功能？ | 官方三個產品頁一致把課表、今天課堂、課室與功課列為主要效益；社群不是此需求的必要條件。 | 只採用校園資訊層級，不加入帳戶或社群。 |
| 網站能否做真正的自訂 iPhone 鎖屏 widget？ | Apple 要求原生 Widget Extension；PWA 無法直接提供。 | App 內提供同風格「今日校園」卡；匯出 Apple 日曆，再使用系統日曆鎖屏 widget。 |
| 網站關閉後能否準時主動通知？ | Web Push 需要遠端發送者；目前靜態託管沒有。 | 開啟 App 時提供翌日摘要；Apple 日曆匯入檔承擔關閉 App 後的可靠提醒。 |
| 是否應增加更多通知？ | 使用者需求集中在明日行程與功課死線。 | 通知只保留翌日摘要與死線前七天，避免無關推送。 |

本輪在 Unigent 官方網站、兩個官方商店頁、Apple 開發者／支援文件、WebKit 與 RFC 規格後已出現明顯資料飽和；額外媒體文章沒有改變決策，故按邊際回報停止研究。

## Claim-to-source ledger

| Claim | Primary source | Confidence |
|---|---|---|
| Unigent 以整學期課表、今日課堂／課室、Todo／功課為主要校園功能。 | Unigent 官方網站；Apple App Store；Google Play | 高 |
| Unigent 的今日課表／下一堂課鎖屏呈現屬原生 Live Activity。 | Apple App Store 版本紀錄 | 高 |
| 自訂 iPhone 鎖屏 widget 需要原生 Widget Extension。 | Apple Developer WidgetKit | 高 |
| iPhone 鎖屏可加入顯示即將到來活動的日曆 widget。 | Apple Support | 高 |
| iOS 主畫面 Web App 的 Web Push 需要訂閱與遠端推送訊息。 | WebKit | 高 |
| iCalendar 能表達每週重複和提前一天／七天警示。 | RFC 5545 | 高 |

## Deliberately not added

- 不加入 ChatGPT、帳戶或雲端登入，避免 VPN／地區可用性和私隱負擔。
- 不把「App 關閉後一定通知」包裝成已完成；純前端 GitHub Pages 版本仍以加入手機行事曆作可靠備援。
- 不加入健康數據、定位追蹤或複雜分析，避免把私人日常工具變成資料密集型產品。

## Sources

1. WebKit, [Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).
2. WebKit, [Badging for Home Screen Web Apps](https://webkit.org/blog/14112/badging-for-home-screen-web-apps/).
3. MDN, [Storage quotas and eviction criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).
4. MDN, [`StorageManager.persist()`](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist).
5. W3C WAI, [Understanding SC 2.5.8: Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).
6. W3C WAI, [Understanding SC 1.4.4: Resize Text](https://www.w3.org/WAI/WCAG21/Understanding/resize-text.html).
7. 香港政府 1823, [香港公眾假期 iCal 月曆](https://www.1823.gov.hk/tc/hong-kong-public-holidays-ical).
8. Unigent, [官方產品網站](https://www.unigent.tw/).
9. Apple App Store, [Unigent 大學生校園社群](https://apps.apple.com/tw/app/unigent-%E5%A4%A7%E5%AD%B8%E7%94%9F%E6%A0%A1%E5%9C%92%E7%A4%BE%E7%BE%A4/id6757976384).
10. Google Play, [Unigent](https://play.google.com/store/apps/details?hl=en_US&id=com.unigents.unigents).
11. Apple Developer, [Creating a widget extension](https://developer.apple.com/documentation/widgetkit/creating-a-widget-extension).
12. Apple Support, [How to add and edit widgets on your iPhone](https://support.apple.com/en-ie/118610).
13. WebKit, [Meet Declarative Web Push](https://webkit.org/blog/16535/meet-declarative-web-push/).
14. IETF, [RFC 5545: Internet Calendaring and Scheduling Core Object Specification](https://www.rfc-editor.org/rfc/rfc5545.html).

## Limitations

- 研究未驗證每一款 Android 瀏覽器的通知／徽章行為；產品採能力偵測避免在不支援裝置報錯。
- GitHub Pages 是靜態託管，沒有伺服器排程推送；關閉 App 後的可靠提醒仍需手機行事曆或未來的推送服務。
- App 內的鎖屏卡是示意預覽；實際鎖屏呈現由 iOS 版本、Apple 日曆通知權限和使用者選用的小工具版面決定。
- 所有個人資料繼續只存在目前瀏覽器；資料保護請求會提高保留機會，但不能取代定期備份。
