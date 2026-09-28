import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api.js";
import { Card, ErrorState, SimulatedBadge, Skeleton } from "../components/ui.js";
import { cn } from "../lib/utils.js";
import type { LessonSummary } from "@aadiinvest/shared";

export default function LearnPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["lessons"],
    queryFn: () => api.get<{ items: LessonSummary[] }>("/api/lessons"),
  });

  if (isLoading) return <Skeleton className="h-96" />;
  if (error) return <ErrorState message="Couldn't load lessons." onRetry={() => refetch()} />;

  const lessons = data?.items ?? [];
  const categories = [...new Set(lessons.map((l) => l.category))];
  const completed = lessons.filter((l) => l.completed).length;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Learning Center</h1>
          <p className="text-sm text-ink-dim mt-0.5">
            {completed}/{lessons.length} lessons complete · +25 XP each
          </p>
        </div>
        <SimulatedBadge />
      </header>

      {categories.map((cat) => (
        <section key={cat}>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-dim mb-2.5">
            {cat}
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {lessons
              .filter((l) => l.category === cat)
              .map((l) => (
                <Link key={l.id} to={`/learn/${l.slug}`}>
                  <Card className="h-full hover:border-brand transition-colors cursor-pointer">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-sm">{l.title}</h3>
                      {l.completed && (
                        <span className="text-up text-sm" aria-label="Completed">✓</span>
                      )}
                    </div>
                    <p className="text-xs text-ink-faint mt-2">
                      ~{l.estimatedMinutes} min · +{l.xpReward} XP
                      {l.quizBestScore !== null && ` · Quiz: ${l.quizBestScore}%`}
                    </p>
                    <div className="mt-3 h-1.5 rounded-full bg-card-hover overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          l.completed ? "bg-up" : "bg-edge",
                        )}
                        style={{ width: l.completed ? "100%" : "8%" }}
                      />
                    </div>
                  </Card>
                </Link>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
