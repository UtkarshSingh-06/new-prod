import { useEffect, useState } from "react";
import type { TaskOut } from "../App";

type Props = {
  apiBase: string;
  authHeaders: Record<string, string>;
  onSessionInvalid?: () => void;
};

function formatTaskLoadError(status: number, body: string): string {
  const raw = body.trim();
  try {
    const j = JSON.parse(raw) as { detail?: unknown };
    if (typeof j.detail === "string") return j.detail;
    if (Array.isArray(j.detail)) {
      return j.detail.map((e: { msg?: string }) => e?.msg ?? JSON.stringify(e)).join(" ");
    }
  } catch {
    /* use raw */
  }
  return raw || `Failed to load tasks (${status})`;
}

/** For <input type="datetime-local" /> in local timezone */
function isoToDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function datetimeLocalToIso(local: string): string | null {
  const s = local.trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

const PRIORITY_HELP = `How priority is calculated (backend):

• Base weight from the plan’s level: low ≈ 10, medium ≈ 40, high ≈ 80 (combined as ~70% of the mix).
• Urgency from time until due: within 24h adds up to +60, within 72h +35, within a week +15, beyond that +5.
• Optional effort hint from estimated duration (if the model provides it): shorter tasks get a small boost.
• The score is capped at 100, then mapped to a label: ≥75 → high, ≥45 → medium, else low.

So the chat may say “high” while the dashboard shows “medium” after the engine refines the score from your due date and timing.`;

const DASHBOARD_FEATURES: ReadonlyArray<{ title: string; desc: string }> = [
  {
    title: "Task list",
    desc: "Everything the assistant saved for you, sorted by priority (highest first).",
  },
  {
    title: "Due date & time",
    desc: "Adjust when work is due; the score and high/medium/low label update from that date.",
  },
  {
    title: "Sub-tasks & checklist",
    desc: "Split a task into smaller steps. Checked items move to the Done section.",
  },
  {
    title: "Schedule & calendar",
    desc: "See planned start/end windows and whether an ICS calendar blob was generated.",
  },
  {
    title: "Refresh",
    desc: "Pull the latest tasks from the API after chat or other sessions change data.",
  },
  {
    title: "Priority explained",
    desc: "Expand the section below for the exact formula used on the server.",
  },
];

export default function Dashboard({ apiBase, authHeaders, onSessionInvalid }: Props) {
  const [tasks, setTasks] = useState<TaskOut[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dueDraft, setDueDraft] = useState<Record<number, string>>({});
  const [newSubByTask, setNewSubByTask] = useState<Record<number, string>>({});
  const [busyDueId, setBusyDueId] = useState<number | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

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
        if (res.status === 401) {
          onSessionInvalid?.();
          return;
        }
        throw new Error(formatTaskLoadError(res.status, text));
      }
      const data = (await res.json()) as TaskOut[];
      setTasks(data.map((t) => ({ ...t, subitems: t.subitems ?? [] })));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const next: Record<number, string> = {};
    for (const t of tasks) {
      next[t.id] = isoToDatetimeLocal(t.due_at);
    }
    setDueDraft(next);
  }, [tasks]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveDue = async (taskId: number) => {
    const raw = dueDraft[taskId] ?? "";
    const iso = datetimeLocalToIso(raw);
    setBusyDueId(taskId);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/tasks/${taskId}/due`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ due_at: iso }),
      });
      if (!res.ok) {
        const text = await res.text();
        if (res.status === 401) {
          onSessionInvalid?.();
          return;
        }
        throw new Error(formatTaskLoadError(res.status, text));
      }
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyDueId(null);
    }
  };

  const toggleSubitem = async (taskId: number, subId: number, done: boolean) => {
    const key = `${taskId}-${subId}`;
    setBusyKey(key);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/tasks/${taskId}/subitems/${subId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ done }),
      });
      if (!res.ok) {
        const text = await res.text();
        if (res.status === 401) {
          onSessionInvalid?.();
          return;
        }
        throw new Error(formatTaskLoadError(res.status, text));
      }
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyKey(null);
    }
  };

  const clearDue = async (taskId: number) => {
    setDueDraft((prev) => ({ ...prev, [taskId]: "" }));
    setBusyDueId(taskId);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/tasks/${taskId}/due`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ due_at: null }),
      });
      if (!res.ok) {
        const text = await res.text();
        if (res.status === 401) {
          onSessionInvalid?.();
          return;
        }
        throw new Error(formatTaskLoadError(res.status, text));
      }
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyDueId(null);
    }
  };

  const addSubitem = async (taskId: number) => {
    const title = (newSubByTask[taskId] ?? "").trim();
    if (!title) return;
    setBusyKey(`add-${taskId}`);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/tasks/${taskId}/subitems`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) {
        const text = await res.text();
        if (res.status === 401) {
          onSessionInvalid?.();
          return;
        }
        throw new Error(formatTaskLoadError(res.status, text));
      }
      setNewSubByTask((prev) => ({ ...prev, [taskId]: "" }));
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/45 shadow-2xl shadow-black/40 ring-1 ring-inset ring-white/[0.04] backdrop-blur-xl transition-[box-shadow] duration-300 hover:shadow-cyan-950/20 hover:ring-cyan-500/10">
      <div className="flex flex-col gap-3 border-b border-white/[0.06] bg-gradient-to-r from-zinc-900/80 to-transparent px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-fuchsia-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-fuchsia-200/90">
              Board
            </span>
            <div className="font-semibold tracking-tight text-zinc-50">Task dashboard</div>
          </div>
          <div className="mt-1 text-xs leading-relaxed text-zinc-500 sm:text-sm">
            Edit due dates, break work into checklists, and review schedule — all synced from chat.
          </div>
        </div>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-xl border border-zinc-600/50 bg-zinc-800/40 px-4 py-2.5 text-sm font-medium text-zinc-200 backdrop-blur-sm transition hover:border-cyan-500/35 hover:bg-zinc-800/65 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/30 disabled:opacity-50 active:scale-[0.98]"
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
        <section
          className="mb-4 rounded-xl border border-cyan-500/15 bg-gradient-to-br from-cyan-950/25 via-zinc-950/40 to-violet-950/20 px-4 py-4 shadow-[0_0_36px_-14px_rgba(34,211,238,0.25)]"
          aria-labelledby="dashboard-features-heading"
        >
          <h2
            id="dashboard-features-heading"
            className="text-sm font-semibold tracking-tight text-cyan-100/90"
          >
            What you can do here
          </h2>
          <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
            New tasks appear when you send a message in{" "}
            <span className="font-medium text-zinc-400">Chat &amp; task plan</span> (left column).
          </p>
          <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
            {DASHBOARD_FEATURES.map((f) => (
              <li
                key={f.title}
                className="flex gap-2.5 rounded-xl border border-zinc-700/35 bg-zinc-950/55 px-3 py-2.5 text-xs shadow-sm transition hover:border-cyan-500/20 hover:bg-zinc-900/50"
              >
                <span className="mt-1 size-2 shrink-0 rounded-full bg-gradient-to-br from-cyan-400 to-violet-500 shadow-sm" aria-hidden />
                <div>
                  <div className="font-medium text-zinc-100">{f.title}</div>
                  <div className="mt-0.5 leading-relaxed text-zinc-500">{f.desc}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {error ? (
          <div
            className="mb-4 rounded-xl border border-red-400/25 bg-red-950/35 px-3 py-2.5 text-sm text-red-100 shadow-[0_0_24px_-8px_rgba(248,113,113,0.35)]"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        <details className="group mb-4 rounded-xl border border-zinc-700/45 bg-zinc-950/50 px-4 py-3 text-sm text-zinc-300 open:border-cyan-500/20 open:bg-zinc-900/40 open:shadow-[0_0_28px_-10px_rgba(34,211,238,0.2)]">
          <summary className="cursor-pointer select-none list-none font-medium text-zinc-100 [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-2">
              How is priority calculated?
              <span className="text-[10px] font-normal text-zinc-500 group-open:hidden">Show</span>
              <span className="hidden text-[10px] font-normal text-cyan-400/80 group-open:inline">Hide</span>
            </span>
          </summary>
          <pre className="mt-3 max-h-48 overflow-y-auto whitespace-pre-wrap border-t border-zinc-800/60 pt-3 font-sans text-xs leading-relaxed text-zinc-400">
            {PRIORITY_HELP}
          </pre>
        </details>

        {tasks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-600/50 bg-gradient-to-b from-zinc-950/60 to-zinc-950/30 px-4 py-10 text-center">
            <p className="text-sm text-zinc-300">No tasks yet</p>
            <p className="mt-2 text-sm text-zinc-500">Describe what you need in chat — we will plan and save tasks here.</p>
            <p className="mt-3 text-xs text-zinc-600">
              Tip: each task card will include due dates, priority, and a checklist you can tick off.
            </p>
          </div>
        ) : (
          <ul className="space-y-4">
            {tasks.map((t) => {
              const subs = t.subitems ?? [];
              const openSubs = subs.filter((s) => !s.done);
              const doneSubs = subs.filter((s) => s.done);
              return (
                <li
                  key={t.id}
                  className="rounded-2xl border border-zinc-700/40 bg-gradient-to-br from-zinc-950/80 to-zinc-950/50 p-4 shadow-lg shadow-black/20 ring-1 ring-inset ring-white/[0.03] transition hover:border-zinc-600/50 hover:shadow-violet-950/10"
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
                    <div className="flex shrink-0 flex-col items-start gap-1.5 sm:items-end">
                      <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-200 shadow-sm">
                        {t.status}
                      </span>
                      <span className="text-[11px] text-zinc-500">Calendar: {t.calendar_event_status}</span>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col gap-2 border-t border-zinc-800/50 pt-4 sm:flex-row sm:flex-wrap sm:items-end sm:gap-3">
                    <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                      Due date &amp; time
                      <input
                        type="datetime-local"
                        value={dueDraft[t.id] ?? ""}
                        onChange={(e) =>
                          setDueDraft((prev) => ({ ...prev, [t.id]: e.target.value }))
                        }
                        className="rounded-lg border border-zinc-600/45 bg-zinc-950/60 px-2 py-2 text-sm text-zinc-100 shadow-inner backdrop-blur-sm transition hover:border-zinc-500/55 focus:border-cyan-400/45 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => saveDue(t.id)}
                      disabled={busyDueId === t.id}
                      className="btn-primary-glow rounded-lg border border-violet-500/40 bg-gradient-to-r from-violet-600/80 to-fuchsia-600/70 px-4 py-2 text-sm font-medium text-white shadow-md transition disabled:opacity-50"
                    >
                      {busyDueId === t.id ? "Saving…" : "Save due date"}
                    </button>
                    <button
                      type="button"
                      onClick={() => clearDue(t.id)}
                      title="Clear due date"
                      disabled={busyDueId === t.id}
                      className="rounded-lg border border-zinc-600/50 bg-zinc-800/30 px-4 py-2 text-sm text-zinc-300 backdrop-blur-sm transition hover:border-zinc-500 hover:bg-zinc-800/50 disabled:opacity-50"
                    >
                      Clear due
                    </button>
                  </div>

                  <div className="mt-3 border-t border-zinc-800/50 pt-3 text-xs text-zinc-500">
                    <span className="block sm:inline">Due: {t.due_at ?? "TBD"}</span>
                    <span className="mx-0 my-1 hidden text-zinc-700 sm:mx-2 sm:inline">·</span>
                    <span className="block sm:inline">
                      Scheduled:{" "}
                      {t.scheduled_start ? t.scheduled_start.slice(0, 16).replace("T", " ") : "TBD"} —{" "}
                      {t.scheduled_end ? t.scheduled_end.slice(0, 16).replace("T", " ") : "TBD"}
                    </span>
                  </div>

                  <div className="mt-4 border-t border-zinc-800/50 pt-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      Sub-tasks &amp; checklist
                    </div>
                    <ul className="mt-2 space-y-2">
                      {openSubs.map((s) => (
                        <li
                          key={s.id}
                          className="flex items-start gap-3 rounded-xl border border-zinc-700/35 bg-zinc-900/40 px-3 py-2 transition hover:border-cyan-500/15"
                        >
                          <input
                            type="checkbox"
                            checked={false}
                            onChange={() => toggleSubitem(t.id, s.id, true)}
                            disabled={busyKey === `${t.id}-${s.id}`}
                            className="mt-0.5 size-4 shrink-0 cursor-pointer rounded border-zinc-500 accent-cyan-500"
                            aria-label={`Mark done: ${s.title}`}
                          />
                          <span className="text-sm text-zinc-100">{s.title}</span>
                        </li>
                      ))}
                    </ul>
                    {doneSubs.length > 0 ? (
                      <div className="mt-3">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                          Done
                        </div>
                        <ul className="mt-1.5 space-y-1.5">
                          {doneSubs.map((s) => (
                            <li
                              key={s.id}
                              className="flex items-start gap-3 rounded-xl border border-zinc-800/40 bg-zinc-950/40 px-3 py-2"
                            >
                              <input
                                type="checkbox"
                                checked
                                onChange={() => toggleSubitem(t.id, s.id, false)}
                                disabled={busyKey === `${t.id}-${s.id}`}
                                className="mt-0.5 size-4 shrink-0 cursor-pointer rounded border-zinc-500 accent-cyan-500"
                                aria-label={`Mark not done: ${s.title}`}
                              />
                              <span className="text-sm text-zinc-500 line-through">{s.title}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                      <input
                        type="text"
                        value={newSubByTask[t.id] ?? ""}
                        onChange={(e) =>
                          setNewSubByTask((prev) => ({ ...prev, [t.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void addSubitem(t.id);
                          }
                        }}
                        placeholder="Add a sub-task…"
                        className="min-w-0 flex-1 rounded-xl border border-zinc-600/45 bg-zinc-950/55 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 backdrop-blur-sm transition hover:border-zinc-500/55 focus:border-cyan-400/45 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                      />
                      <button
                        type="button"
                        onClick={() => addSubitem(t.id)}
                        disabled={busyKey === `add-${t.id}`}
                        className="rounded-xl border border-cyan-500/30 bg-cyan-950/30 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-950/50 disabled:opacity-50"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
