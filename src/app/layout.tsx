import type { Metadata } from "next";
import "./globals.css";
import ThemeProviderWrapper from "@/components/ThemeProviderWrapper";
import NextAuthProvider from "@/components/NextAuthProvider";

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
      <body>
        <ThemeProviderWrapper>
          <NextAuthProvider>
            {children}
          </NextAuthProvider>
        </ThemeProviderWrapper>
      </body>
    </html>
  );
}
