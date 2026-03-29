import { type FormEvent, useState } from "react";
import type { AssistantChatResponse } from "../App";

type Props = {
  apiBase: string;
  authHeaders: Record<string, string>;
  onSessionInvalid?: () => void;
};

type ChatMsg = { role: "user" | "assistant"; content: string };

function formatChatHttpError(status: number, body: string): string {
  let detail = body.trim();
  try {
    const j = JSON.parse(body) as { detail?: unknown };
    if (typeof j.detail === "string") {
      detail = j.detail;
    } else if (Array.isArray(j.detail)) {
      detail = j.detail
        .map((e: { msg?: string }) => (typeof e?.msg === "string" ? e.msg : JSON.stringify(e)))
        .join(" ");
    }
  } catch {
    /* keep raw text */
  }

  // Always show API detail for 503 — the backend lists OpenAI, Groq, and Ollama; a short
  // rewrite here was misleading when OPENAI_API_KEY appeared next to LLM_PROVIDER=ollama.
  if (status === 503 && /quota|rate limit|insufficient_quota|billing/i.test(detail) && !/LLM_PROVIDER/i.test(detail)) {
    return (
      "OpenAI quota or rate limit hit.\n\n" +
      "Fix billing: https://platform.openai.com/account/billing\n\n" +
      "Or use a free provider (backend/.env, then restart the API):\n" +
      "• Groq: LLM_PROVIDER=groq and put your Groq key in OPENAI_API_KEY (https://console.groq.com)\n" +
      "• Local: LLM_PROVIDER=ollama with Ollama running"
    );
  }
  if (!detail) return `Request failed (${status})`;
  if (detail.length > 900) return `${detail.slice(0, 897)}…`;
  return detail;
}

export default function ChatPanel({ apiBase, authHeaders, onSessionInvalid }: Props) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [lastResponse, setLastResponse] = useState<AssistantChatResponse | null>(null);

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    const userText = input.trim();
    if (!userText) return;

    setLoading(true);
    setError(null);
    try {
      setChat((prev) => [...prev, { role: "user", content: userText }]);
      setInput("");

      const res = await fetch(`${apiBase}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({ message: userText }),
      });
      if (!res.ok) {
        const text = await res.text();
        if (res.status === 401) {
          onSessionInvalid?.();
          return;
        }
        throw new Error(formatChatHttpError(res.status, text));
      }
      const data = (await res.json()) as AssistantChatResponse;
      setLastResponse(data);

      setChat((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Planned ${data.plan.tasks.length} task(s).`,
        },
      ]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="group/card rounded-2xl border border-white/[0.08] bg-zinc-900/45 shadow-2xl shadow-black/40 ring-1 ring-inset ring-white/[0.04] backdrop-blur-xl transition-[box-shadow,transform] duration-300 hover:shadow-violet-950/25 hover:ring-violet-500/10">
      <div className="border-b border-white/[0.06] bg-gradient-to-r from-zinc-900/80 to-zinc-900/40 px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-cyan-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-cyan-300/90">
            Live
          </span>
          <div className="font-semibold tracking-tight text-zinc-50">Chat &amp; task plan</div>
        </div>
        <div className="mt-1.5 text-xs leading-relaxed text-zinc-500 sm:text-sm">
          Describe work in your own words — we turn it into a structured plan and tasks.
        </div>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <div className="min-h-[200px] max-h-[min(50vh,320px)] overflow-y-auto rounded-xl border border-zinc-700/40 bg-gradient-to-b from-zinc-950/90 via-zinc-950/70 to-zinc-950/50 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:min-h-[240px] sm:max-h-[min(52vh,400px)]">
          {chat.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-700/50 bg-zinc-900/30 p-4 text-sm leading-relaxed text-zinc-500">
              <span className="font-medium text-zinc-400">Example:</span> “Prepare for the product interview tomorrow and book a
              doctor appointment next week.”
            </div>
          ) : null}
          <div className="space-y-3 pt-1">
            {chat.map((m, idx) => (
              <div key={idx} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[92%] rounded-2xl rounded-br-md bg-gradient-to-br from-violet-600 via-violet-600 to-fuchsia-600 px-3.5 py-2.5 text-sm text-white shadow-lg shadow-violet-900/35 ring-1 ring-white/10 sm:max-w-[85%]"
                      : "max-w-[92%] rounded-2xl rounded-bl-md border border-zinc-600/40 bg-zinc-800/70 px-3.5 py-2.5 text-sm text-zinc-100 shadow-md backdrop-blur-sm sm:max-w-[85%]"
                  }
                >
                  {m.content}
                </div>
              </div>
            ))}
          </div>
        </div>

        {lastResponse ? (
          <div className="rounded-xl border border-violet-500/20 bg-gradient-to-br from-zinc-950/80 to-violet-950/20 p-4 shadow-[0_0_40px_-12px_rgba(139,92,246,0.35)] ring-1 ring-inset ring-white/[0.04]">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-violet-300/80">Latest plan</div>
            <div className="mb-3 text-xs text-zinc-400">
              Next step:{" "}
              <span className="font-medium text-cyan-300">{lastResponse.plan.next_action}</span>
            </div>

            {lastResponse.plan.clarification_questions.length > 0 ? (
              <div className="space-y-2">
                {lastResponse.plan.clarification_questions.map((q, i) => (
                  <div key={i} className="rounded-lg border border-amber-500/20 bg-amber-950/20 px-3 py-2 text-sm text-amber-100/90">
                    <span className="font-medium text-amber-200/90">Q{i + 1}:</span> {q}
                  </div>
                ))}
              </div>
            ) : (
              <ul className="space-y-2.5">
                {lastResponse.plan.tasks.map((t, i) => (
                  <li
                    key={i}
                    className="flex flex-col gap-2 rounded-xl border border-zinc-700/40 bg-zinc-900/50 p-3 backdrop-blur-sm sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-zinc-50">{t.title}</div>
                      <div className="mt-0.5 text-xs leading-relaxed text-zinc-400">{t.description}</div>
                    </div>
                    <span className="shrink-0 self-start rounded-full border border-fuchsia-500/35 bg-fuchsia-500/10 px-2.5 py-1 text-xs font-medium capitalize text-fuchsia-200">
                      {t.priority}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] text-zinc-500 sm:text-xs">
              <span className="rounded-md bg-zinc-900/60 px-2 py-0.5">Created {lastResponse.created_task_ids.length}</span>
              <span className="rounded-md bg-zinc-900/60 px-2 py-0.5">Scheduled {lastResponse.scheduled_task_ids.length}</span>
              <span className="rounded-md bg-zinc-900/60 px-2 py-0.5">Notifications {lastResponse.notifications_sent}</span>
              <span className="rounded-md bg-zinc-900/60 px-2 py-0.5">Memory {String(lastResponse.memory_written)}</span>
            </div>
          </div>
        ) : null}

        {error ? (
          <div
            className={`rounded-xl border px-3 py-2.5 text-sm leading-relaxed whitespace-pre-line ${
              error.includes("LLM agent") ||
              error.includes("restart the API") ||
              error.includes("backend/.env") ||
              error.includes("LLM_PROVIDER") ||
              error.includes("Groq") ||
              error.includes("Ollama")
                ? "border-amber-500/35 bg-amber-950/30 text-amber-100"
                : "border-red-500/30 bg-red-950/35 text-red-200"
            }`}
            role="alert"
          >
            {error}
          </div>
        ) : null}

        <form className="flex flex-col gap-3 sm:flex-row sm:items-stretch" onSubmit={send}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="What do you need to get done?"
            aria-label="Task message"
            className="min-h-11 flex-1 rounded-xl border border-zinc-600/45 bg-zinc-950/55 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-sm transition hover:border-zinc-500/55 focus:border-cyan-400/45 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
          />
          <button
            type="submit"
            disabled={loading}
            className="btn-primary-glow inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-violet-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/35 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:cursor-not-allowed disabled:opacity-55"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Planning…
              </span>
            ) : (
              "Send"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
