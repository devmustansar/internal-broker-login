import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Internal Credentials Broker",
  description:
    "Secure internal portal for brokered access to client applications",
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
