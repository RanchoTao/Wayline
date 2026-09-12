import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "wayline — 让目标，步步可达。",
  description:
    "将目标拆解为清晰可执行的计划，跟踪进度，并随时间变化调整安排。",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="h-full overflow-hidden">{children}</body>
    </html>
  );
}
