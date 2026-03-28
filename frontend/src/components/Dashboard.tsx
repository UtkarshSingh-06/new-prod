import { useEffect, useState } from "react";
import type { TaskOut } from "../App";

type Props = {
  apiBase: string;
  authHeaders: Record<string, string>;
};

export default function Dashboard({ apiBase, authHeaders }: Props) {
  const [tasks, setTasks] = useState<TaskOut[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/tasks`, {
        method: "GET",
        headers: { ...authHeaders },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to load tasks: ${res.status}`);
      }
      const data = (await res.json()) as TaskOut[];
      setTasks(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/55 shadow-xl shadow-black/20 backdrop-blur-md transition-shadow duration-300 hover:shadow-violet-950/20">
      <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-5">
        <div>
          <div className="font-semibold tracking-tight text-zinc-100">Task dashboard</div>
          <div className="mt-0.5 text-xs text-zinc-400 sm:text-sm">
            Priority scores, due dates, and schedule — synced from chat
          </div>
        </div>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-xl border border-zinc-600/80 bg-zinc-800/40 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800/65 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 disabled:opacity-50 active:scale-[0.98]"
          onClick={load}
          disabled={loading}
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <span className="size-3.5 animate-spin rounded-full border-2 border-zinc-500 border-t-zinc-200" />
              Refreshing…
            </span>
          ) : (
            "Refresh"
          )}
        </button>
      </div>

      <div className="p-4 sm:p-5">
        {error ? (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-950/35 px-3 py-2.5 text-sm text-red-200" role="alert">
            {error}
          </div>
        ) : null}

        {tasks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-700/80 bg-zinc-950/30 px-4 py-8 text-center text-sm text-zinc-400">
            No tasks yet. Describe work in chat to generate a plan and saved tasks.
          </div>
        ) : (
          <ul className="space-y-3">
            {tasks.map((t) => (
              <li
                key={t.id}
                className="rounded-xl border border-zinc-800/80 bg-zinc-950/45 p-4 transition hover:border-zinc-700/90"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="font-medium text-zinc-100">{t.title}</div>
                    <div className="mt-1 text-xs leading-relaxed text-zinc-400 sm:text-sm">
                      {t.description || "No description."}
                    </div>
                    <div className="mt-2 text-xs text-zinc-500">
                      Priority:{" "}
                      <span className="font-medium text-zinc-200">{t.priority_label}</span>{" "}
                      <span className="text-zinc-600">·</span> {Math.round(t.priority_score)}/100
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
                    <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
                      {t.status}
                    </span>
                    <span className="text-[11px] text-zinc-500">Calendar: {t.calendar_event_status}</span>
                  </div>
                </div>

                <div className="mt-3 border-t border-zinc-800/60 pt-3 text-xs text-zinc-500">
                  <span className="block sm:inline">Due: {t.due_at ?? "TBD"}</span>
                  <span className="mx-0 my-1 hidden text-zinc-700 sm:mx-2 sm:inline">·</span>
                  <span className="block sm:inline">
                    Scheduled:{" "}
                    {t.scheduled_start ? t.scheduled_start.slice(0, 16).replace("T", " ") : "TBD"} —{" "}
                    {t.scheduled_end ? t.scheduled_end.slice(0, 16).replace("T", " ") : "TBD"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
