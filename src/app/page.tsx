"use client";

import { AppProvider, useApp } from "@/lib/app-context";
import LoginPage from "@/components/LoginPage";
import Dashboard from "@/components/Dashboard";

function AppShell() {
  const { isAuthenticated } = useApp();
  return isAuthenticated ? <Dashboard /> : <LoginPage />;
}

export default function Home() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
