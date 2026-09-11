import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VisualDeadline / AGENT — Make time visible.",
  description:
    "Agent-native deadline cockpit. Turns vague goals into visible, adaptive execution plans.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="h-full overflow-hidden">{children}</body>
    </html>
  );
}
