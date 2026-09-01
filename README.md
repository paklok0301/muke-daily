# 暮刻

暮刻是一個繁體中文、深色風格的個人日常 PWA，用來記錄：

- 月／週／日行事曆與香港公眾假期
- 未來活動、準確時間及手機行事曆提醒
- 兼職工作、工時、堂數、地點及每月應收金額
- 胸、背、肩、腿訓練記錄
- 待辦、活動及本機資料備份

所有個人記錄只儲存在使用者自己的瀏覽器。App 不使用 GPT，也不需要登入。

## iPhone 原生版

[`ios/`](ios/) 是配合現有介面的原生 iOS 17 工程，加入網站做不到的系統功能：

- 活動、每週課堂、功課死線及公事自動建立／更新於 Apple 行事曆
- 由 iOS 預排「明日安排」及功課提醒，關閉 App 後仍可送達
- 鎖屏 Widget 顯示下一項，以及仿參考設計的黑色 Live Activity 行程／待辦卡

安裝、簽署、權限和 Apple 平台限制請看 [`ios/README.md`](ios/README.md)。

## 本機開發

需要 Node.js 22 或以上版本。

```bash
pnpm install
pnpm run dev
```

## 建置

```bash
pnpm run build
pnpm run build:github
```

推送到 `main` 後，`.github/workflows/pages.yml` 會自動建置並發佈 GitHub Pages 網站。
