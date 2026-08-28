import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://paklok0301.github.io"),
  title: "暮刻 — 你的日常與工時",
  description: "一個安靜的個人日常助手，記錄活動、課表、功課死線、待辦、兼職工時和健身。",
  applicationName: "暮刻",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "暮刻" },
  icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" },
  openGraph: {
    title: "暮刻 — 你的日常與工時",
    description: "活動、課表、功課、待辦與公事，都安靜地留在同一個地方。",
    type: "website",
    locale: "zh_HK",
    url: "https://paklok0301.github.io/muke-daily/",
    images: [{ url: "/muke-daily/og.png", width: 1200, height: 630, alt: "暮刻 — Remember who you are." }],
  },
  twitter: {
    card: "summary_large_image",
    title: "暮刻 — 你的日常與工時",
    description: "活動、課表、功課、待辦與公事，都安靜地留在同一個地方。",
    images: ["/muke-daily/og.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b0a0a",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-HK"><body>{children}</body></html>;
}
