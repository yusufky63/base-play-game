"use client";

import { LayoutGrid, LockKeyhole, ScrollText, Settings2, Vault } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useIsOwner } from "@/hooks/useIsOwner";
import { WalletStatus } from "@/components/wallet/WalletStatus";

const adminLinks = [
  { href: "/admin", label: "Dashboard", icon: LayoutGrid },
  { href: "/admin/games", label: "Games", icon: Settings2 },
  { href: "/admin/vault", label: "Vault", icon: Vault },
  { href: "/admin/logs", label: "Logs", icon: ScrollText }
];

export function AdminShell({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  const isOwner = useIsOwner();
  const pathname = usePathname();
  const router = useRouter();

  if (!isOwner) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 items-center px-4 py-16">
        <section className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--surface-2)] text-[var(--text-2)]">
              <LockKeyhole size={18} />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-[var(--text-1)]">Admin access required</h1>
              <p className="mt-2 text-sm leading-6 text-[var(--text-2)]">Connect the configured owner wallet to view operational controls.</p>
              <div className="mt-4">
                <WalletStatus />
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="display-heading text-3xl font-bold text-[var(--text-1)]">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-2)]">{description}</p>
        </div>
        <select
          value={pathname}
          onChange={(event) => router.push(event.target.value)}
          className="h-10 rounded-md border border-[var(--border-2)] bg-[var(--surface)] px-3 text-sm text-[var(--text-1)] outline-none focus:border-[var(--accent)] md:w-44"
          aria-label="Admin section"
        >
          {adminLinks.map((item) => (
            <option key={item.href} value={item.href}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <nav className="admin-sidebar hidden p-2 lg:block lg:self-start">
          {adminLinks.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`admin-sidebar-link ${
                  active ? "admin-sidebar-link-active" : ""
                }`}
              >
                <Icon size={15} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <section>{children}</section>
      </div>
    </main>
  );
}

export function AdminMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="admin-metric">
      <div className="font-mono text-[10px] font-semibold uppercase text-[var(--text-3)]">{label}</div>
      <div className="mt-2 font-mono text-2xl font-semibold text-[var(--text-1)]">{value}</div>
      <div className="mt-2 text-xs text-[var(--text-2)]">{detail}</div>
    </div>
  );
}
