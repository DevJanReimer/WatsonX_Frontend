import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Abraxas ISDP Wissensagent",
  description:
    "Abraxas ISDP Wissensagent — powered by IBM watsonx Orchestrate"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
