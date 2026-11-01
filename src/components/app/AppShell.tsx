import { Link, useLocation } from "@tanstack/react-router";
import { Home, ListOrdered, Store, User, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", icon: Home, key: "nav.home", match: (p: string) => p === "/" || p.startsWith("/product") },
  { to: "/shops", icon: Store, key: "nav.shops", match: (p: string) => p.startsWith("/shop") },
  { to: "/orders", icon: ListOrdered, key: "nav.orders", match: (p: string) => p.startsWith("/orders") },
  { to: "/wallet", icon: Wallet, key: "nav.wallet", match: (p: string) => p.startsWith("/wallet") },
  { to: "/profile", icon: User, key: "nav.profile", match: (p: string) => p.startsWith("/profile") || p.startsWith("/dashboard") || p.startsWith("/affiliate") || p.startsWith("/admin") },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const hideNav = pathname === "/auth" || pathname.startsWith("/checkout");
  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col bg-background">
      <main className={cn("flex-1", !hideNav && "pb-20")}>{children}</main>
      {!hideNav && (
        <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
          <div className="grid h-16 grid-cols-5">
            {NAV.map(({ to, icon: Icon, key, match }) => {
              const active = match(pathname);
              return (
                <Link key={to} to={to} className={cn("flex flex-col items-center justify-center gap-1 text-[10px] font-medium", active ? "text-primary" : "text-muted-foreground")}>
                  <Icon className={cn("h-5 w-5", active && "drop-shadow-[0_0_8px_currentColor]")} />
                  {t(key)}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
