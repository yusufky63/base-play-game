import { Newspaper } from "lucide-react";
import { SITE_UPDATES } from "@/lib/updates";

export default function UpdatesPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10">
      <div className="mb-7 border-b border-[var(--border)] pb-6">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-md border border-[var(--border-2)] bg-[var(--accent-light)] text-[var(--accent)]">
          <Newspaper size={22} />
        </div>
        <h1 className="display-heading text-4xl font-bold text-[var(--text-1)]">Updates</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-2)]">
          Public release notes will appear here after BasePlay is ready for production.
        </p>
      </div>

      {SITE_UPDATES.length > 0 ? (
        <section className="grid gap-3">
          {SITE_UPDATES.map((update) => (
            <article key={update.title} className="panel p-4">
              <div className="font-mono text-[11px] font-bold uppercase text-[var(--text-3)]">{update.date}</div>
              <h2 className="mt-2 display-heading text-xl font-bold text-[var(--text-1)]">{update.title}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--text-2)]">{update.body}</p>
            </article>
          ))}
        </section>
      ) : (
        <section className="panel p-6">
          <h2 className="display-heading text-xl font-bold text-[var(--text-1)]">No public updates yet</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-2)]">
            BasePlay is still in pre-production. Release notes will be published here once the production launch starts.
          </p>
        </section>
      )}
    </main>
  );
}
