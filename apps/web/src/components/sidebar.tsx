"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Server,
  Users,
  Settings,
  LogOut,
  X,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/servers", label: "Servers", icon: Server },
  { href: "/dashboard/clients", label: "Clients", icon: Users },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export function Sidebar({ open = true, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();

  const content = (
    <>
      <div className="flex items-center justify-between p-4 md:p-6">
        <h1 className="text-xl font-bold">Hy2 Panel</h1>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {onClose && (
            <Button variant="ghost" size="icon" className="md:hidden" onClick={onClose} aria-label="Close menu">
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-4">
        <div className="mb-2 truncate text-sm text-muted-foreground">
          {user?.username || user?.email}
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={() => {
            logout();
            onClose?.();
          }}
        >
          <LogOut className="mr-2 h-4 w-4 shrink-0" />
          Logout
        </Button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile: overlay drawer */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 md:hidden",
          open ? "visible" : "invisible opacity-0 transition-all duration-200"
        )}
        aria-hidden
        onClick={onClose}
      />
      <aside
        className={cn(
          "flex h-full w-64 flex-col border-r bg-card transition-transform duration-200 ease-out md:translate-x-0",
          "fixed inset-y-0 left-0 z-50 md:static",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {content}
      </aside>
    </>
  );
}
