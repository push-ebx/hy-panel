"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { useAuthStore } from "@/store/auth";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { token, checkAuth } = useAuthStore();

  useEffect(() => {
    if (!token) {
      router.push("/login");
      return;
    }
    checkAuth();
  }, [token, router, checkAuth]);

  if (!token) {
    return null;
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
