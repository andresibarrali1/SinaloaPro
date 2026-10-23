import type { Metadata } from "next";
import "./globals.css";
import "./editor.css";

export const metadata: Metadata = {
  title: "Sinaloa Pro — Editor de vídeo",
  description: "Editor multipista con procesamiento local y exportación real.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: [{url: "/icons/favicon-s-pro-v3.png",type:"image/png",sizes:"32x32"},{url:"/favicon-s-pro-v3.svg",type:"image/svg+xml"}],
    shortcut: "/favicon-s-pro-v3.svg",
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
