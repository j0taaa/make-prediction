import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Secret Prediction Playground",
  description:
    "Generate timestamped cryptographic proof tokens for secret predictions and verify them later.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
