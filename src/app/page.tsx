"use client";

import { AppProvider } from "@/lib/app-context";
import LoginPage from "@/components/LoginPage";
import Dashboard from "@/components/Dashboard";
import { useSession } from "next-auth/react";

function AppShell() {
  const { status } = useSession();

  if (status === "loading") {
    return null; // Or a loading spinner
  }

  return status === "authenticated" ? <Dashboard /> : <LoginPage />;
}

export default function Home() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
