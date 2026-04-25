import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reading Box",
  description: "A communal co-reading platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
