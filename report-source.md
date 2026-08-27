# 暮刻產品審視 — 研究底稿

- 日期：2026-08-27
- 對象：暮刻的唯一主要使用者
- 範圍：每日待辦、日程、兼職工時與收入、健身、日記、安裝及本機資料可靠度
- 方法：檢視現有程式與公開版本；以 Apple WebKit、W3C、MDN 及香港政府 1823 的一手資料核對 PWA、提醒、無障礙、本機儲存及假期資料能力。
- 假設：產品維持私人、本機優先、不連接 ChatGPT、不要求登入，正式版本繼續由 GitHub Pages 提供。

## Executive answer

暮刻已有清楚的視覺個性與五個實用核心：月曆、計劃、兼職、健身和日記。最大的使用阻力不是缺少更多功能，而是高頻資訊散落在不同分頁、工時錯誤難以修正，以及瀏覽器資料與提醒能力沒有被清楚解釋。最有價值的升級，是在首頁加入「今天摘要」、把工時變成可按月份瀏覽並可編輯、補上待辦清理和資料保護、改善觸控尺寸與文字縮放，並把通知描述改為與現況一致。

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

## Limitations

- 研究未驗證每一款 Android 瀏覽器的通知／徽章行為；產品採能力偵測避免在不支援裝置報錯。
- GitHub Pages 是靜態託管，沒有伺服器排程推送；關閉 App 後的可靠提醒仍需手機行事曆或未來的推送服務。
- 所有個人資料繼續只存在目前瀏覽器；資料保護請求會提高保留機會，但不能取代定期備份。
