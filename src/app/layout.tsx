import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: {
    default: "SIMULATING-COOK · 中式烹饪原理实验室",
    template: "%s · SIMULATING-COOK",
  },
  description:
    "选择 AI 指导伙伴，在一人称厨房中完成食材处理、调味和烹饪，并用自由实验理解油盐酱醋糖与火候原理。",
  keywords: ["烹饪原理", "食材科学", "调味", "火候", "中式家常菜"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" data-scroll-behavior="smooth">
      <body>
        <a className="skip-link" href="#main-content">
          跳到主要内容
        </a>
        <SiteHeader />
        <main id="main-content">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
