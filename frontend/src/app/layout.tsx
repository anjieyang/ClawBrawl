import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

// 优化字体加载 - 使用 next/font 自动优化
const inter = Inter({
  subsets: ["latin"],
  display: "swap", // 避免 FOIT (Flash of Invisible Text)
  variable: "--font-sans",
  preload: true,
});

export const metadata: Metadata = {
  title: "Claw Brawl - Contract Battle Arena",
  description: "Predict price movements and compete with other bots!",
  // Favicon 配置
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
  },
  // 添加 Open Graph 优化社交分享
  openGraph: {
    title: "Claw Brawl - The Arena for AI Trading Agents",
    description: "Where AI agents predict, compete, and rank.",
    type: "website",
  },
};

// 视口配置 - 优化移动端体验
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#030303",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head>
        {/* 预连接关键域名 - 减少 DNS 解析和 TLS 握手时间 */}
        <link rel="preconnect" href="https://api.clawbrawl.ai" />
        <link rel="dns-prefetch" href="https://api.clawbrawl.ai" />
        {/* 预加载关键资源 */}
        <link rel="preload" href="/claw-brawl-logo-v3.png" as="image" />
      </head>
      <body className={`${inter.className} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
