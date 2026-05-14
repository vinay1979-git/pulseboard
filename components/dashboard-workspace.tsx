"use client";

import { motion } from "framer-motion";
import {
  ArrowUpDown,
  CalendarClock,
  Clock3,
  FilePlus2,
  Filter,
  LayoutGrid,
  Play,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  formatUpdatedAt,
  type PresentationRecord,
} from "@/lib/presentations";

type DashboardIcon = React.ComponentType<{ className?: string }>;

const statsMeta: { label: string; icon: DashboardIcon }[] = [
  { label: "Total decks", icon: LayoutGrid },
  { label: "Recently edited", icon: Clock3 },
  { label: "Slides", icon: CalendarClock },
];

export function DashboardWorkspace({
  email,
  presentations,
}: {
  email: string;
  presentations: PresentationRecord[];
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"recent" | "slides">("recent");

  const visiblePresentations = useMemo(() => {
    return presentations
      .filter((presentation) =>
        presentation.title.toLowerCase().includes(query.toLowerCase()),
      )
      .sort((first, second) => {
        if (sort === "slides") {
          return second.slides.length - first.slides.length;
        }

        return (
          new Date(second.updated_at).getTime() -
          new Date(first.updated_at).getTime()
        );
      });
  }, [presentations, query, sort]);

  const stats = [
    String(presentations.length),
    String(presentations.slice(0, 4).length),
    String(
      presentations.reduce(
        (total, presentation) => total + presentation.slides.length,
        0,
      ),
    ),
  ];

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-200">
            Dashboard
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-normal sm:text-5xl">
            Presentations
          </h1>
          <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-300">
            Welcome back, {email}. Create and manage only the presentations
            saved in your PulseBoard workspace.
          </p>
        </div>
        <Button asChild className="w-full sm:w-fit">
          <Link href="/builder">
            <FilePlus2 className="size-4" />
            Create presentation
          </Link>
        </Button>
      </div>

      <section className="mb-6 grid gap-4 sm:grid-cols-3">
        {statsMeta.map(({ label, icon: Icon }, index) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
            className="rounded-lg border border-slate-200/75 bg-white/75 p-5 shadow-xl shadow-slate-950/5 backdrop-blur-xl dark:border-white/10 dark:bg-white/9"
          >
            <Icon className="size-5 text-cyan-700 dark:text-cyan-200" />
            <p className="mt-5 text-sm text-slate-500 dark:text-slate-400">
              {label}
            </p>
            <p className="mt-1 text-2xl font-bold">{stats[index]}</p>
          </motion.div>
        ))}
      </section>

      <section className="mb-6 rounded-lg border border-slate-200/75 bg-white/75 p-4 shadow-xl shadow-slate-950/5 backdrop-blur-xl dark:border-white/10 dark:bg-white/9">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search your presentations"
              className="pl-9"
            />
          </div>

          <Button
            type="button"
            variant="secondary"
            className="text-slate-950 dark:text-white"
            onClick={() => setSort(sort === "recent" ? "slides" : "recent")}
          >
            <ArrowUpDown className="size-4" />
            {sort === "recent" ? "Recent" : "Slides"}
          </Button>
        </div>
      </section>

      {presentations.length === 0 ? (
        <section className="rounded-lg border border-dashed border-cyan-300/45 bg-white/65 p-10 text-center shadow-xl shadow-slate-950/5 backdrop-blur-xl dark:bg-white/8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg border border-cyan-300/30 bg-cyan-300/15 text-cyan-700 dark:text-cyan-200">
            <FilePlus2 className="size-6" />
          </div>
          <h2 className="mt-5 text-2xl font-black">No presentations yet</h2>
          <p className="mx-auto mt-2 max-w-md text-slate-600 dark:text-slate-300">
            Create your first presentation and it will appear here after
            Supabase saves it.
          </p>
          <Button asChild className="mt-6">
            <Link href="/builder">Create presentation</Link>
          </Button>
        </section>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">Presentation library</h2>
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <Filter className="size-4" />
                {visiblePresentations.length} decks
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {visiblePresentations.map((presentation, index) => (
                <motion.article
                  key={presentation.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ y: -6, scale: 1.01 }}
                  className="group overflow-hidden rounded-lg border border-slate-200/75 bg-white/78 shadow-xl shadow-slate-950/5 backdrop-blur-xl transition dark:border-white/10 dark:bg-white/9"
                >
                  <div className="h-28 bg-gradient-to-br from-cyan-300 to-emerald-300 p-4">
                    <span className="rounded-md bg-slate-950/15 px-2 py-1 text-xs font-bold text-white backdrop-blur">
                      Saved deck
                    </span>
                  </div>
                  <div className="p-5">
                    <h3 className="text-lg font-bold">{presentation.title}</h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Updated {formatUpdatedAt(presentation.updated_at)}
                    </p>

                    <div className="mt-5 flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
                      <span>{presentation.slides.length} slides</span>
                      <span>Draft</span>
                    </div>

                    <div className="mt-5 flex gap-2">
                      <Button asChild size="sm" className="flex-1">
                        <Link href={`/builder/${presentation.id}`}>
                          <Play className="size-4" />
                          Open
                        </Link>
                      </Button>
                    </div>
                  </div>
                </motion.article>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200/75 bg-white/75 p-5 shadow-xl shadow-slate-950/5 backdrop-blur-xl dark:border-white/10 dark:bg-white/9">
            <h2 className="text-xl font-bold">Recently edited</h2>
            <div className="mt-5 grid gap-3">
              {presentations.slice(0, 4).map((presentation) => (
                <Link
                  key={presentation.id}
                  href={`/builder/${presentation.id}`}
                  className="rounded-md border border-slate-200/80 bg-white/70 p-4 transition hover:translate-x-1 dark:border-white/10 dark:bg-slate-950/35"
                >
                  <p className="font-semibold">{presentation.title}</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {formatUpdatedAt(presentation.updated_at)}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
