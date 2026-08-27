# 暮刻

暮刻是一個繁體中文、深色風格的個人日常 PWA，用來記錄：

- 月／週／日行事曆與香港公眾假期
- 未來活動、準確時間及手機行事曆提醒
- 兼職工作、工時、堂數、地點及每月應收金額
- 胸、背、肩、腿訓練記錄
- 待辦、日記及本機資料備份

所有個人記錄只儲存在使用者自己的瀏覽器。App 不使用 GPT，也不需要登入。

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
