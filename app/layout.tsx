import type { Metadata } from "next";
import "./globals.css";
import "./editor.css";

export const metadata: Metadata = {
  title: "Corte 15 — Editor de video",
  description: "Editor multipista con procesamiento local y exportación real.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  );
}
