import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NextRep",
  description: "Progressive overload, tracked per set",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#0B0C0E",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-bg text-white antialiased">{children}</body>
    </html>
  );
}
