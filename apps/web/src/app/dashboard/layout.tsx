"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Sidebar } from "@/components/sidebar";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { token, _hasHydrated, checkAuth } = useAuthStore();
  const [fallbackReady, setFallbackReady] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setFallbackReady(true), 400);
    return () => clearTimeout(t);
  }, []);

  const ready = _hasHydrated || fallbackReady;

  useEffect(() => {
    if (!ready) return;
    if (!token) {
      router.push("/login");
      return;
    }
    checkAuth();
  }, [ready, token, router, checkAuth]);

  const t = useTranslations("common");
  const tNav = useTranslations("nav");

  if (!ready || !token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-1 flex-col min-w-0">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4 md:hidden">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </Button>
          <span className="font-semibold">{tNav("appName")}</span>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
