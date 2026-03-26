import React, { useEffect, useState } from "react";
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
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="border border-zinc-800 rounded-xl bg-zinc-900/40">
      <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between gap-3">
        <div>
          <div className="font-semibold">Task Dashboard</div>
          <div className="text-xs text-zinc-400">Persisted tasks with priority scoring + scheduling</div>
        </div>
        <button
          className="rounded-md border border-zinc-800 hover:bg-zinc-800/40 px-3 py-2 text-sm"
          onClick={load}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="p-5">
        {error ? (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2 mb-3">
            {error}
          </div>
        ) : null}

        {tasks.length === 0 ? (
          <div className="text-sm text-zinc-400">No tasks yet. Use the chat to create one.</div>
        ) : (
          <div className="space-y-3">
            {tasks.map((t) => (
              <div
                key={t.id}
                className="rounded-lg border border-zinc-800 bg-zinc-950/30 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{t.title}</div>
                    <div className="text-xs text-zinc-400 mt-1">{t.description || "No description."}</div>
                    <div className="text-xs text-zinc-500 mt-2">
                      Priority: <span className="text-zinc-200">{t.priority_label}</span> ({Math.round(t.priority_score)}/100)
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-zinc-400">Status</div>
                    <div className="text-sm mt-1">{t.status}</div>
                    <div className="text-[11px] text-zinc-500 mt-2">
                      Calendar: {t.calendar_event_status}
                    </div>
                  </div>
                </div>

                <div className="text-xs text-zinc-500 mt-3">
                  Due: {t.due_at ?? "TBD"} | Scheduled:{" "}
                  {t.scheduled_start ? t.scheduled_start.slice(0, 16).replace("T", " ") : "TBD"} -{" "}
                  {t.scheduled_end ? t.scheduled_end.slice(0, 16).replace("T", " ") : "TBD"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

