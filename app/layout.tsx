import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Abarxas ISDP Agent",
  description:
    "Abarxas ISDP Knowledge Gathering Agent — powered by IBM watsonx Orchestrate"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
