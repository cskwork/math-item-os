import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Math Item OS",
  description: "수학 문항 관리 시스템",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
