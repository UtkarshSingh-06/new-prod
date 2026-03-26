import React, { useState } from "react";
import type { AssistantChatResponse } from "../App";

type Props = {
  apiBase: string;
  authHeaders: Record<string, string>;
};

type ChatMsg = { role: "user" | "assistant"; content: string };

export default function ChatPanel({ apiBase, authHeaders }: Props) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [lastResponse, setLastResponse] = useState<AssistantChatResponse | null>(null);

  const send = async () => {
    setLoading(true);
    setError(null);
    try {
      const userText = input.trim();
      if (!userText) return;

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
        throw new Error(text || `Chat failed: ${res.status}`);
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
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border border-zinc-800 rounded-xl bg-zinc-900/40">
      <div className="px-5 py-4 border-b border-zinc-800">
        <div className="font-semibold">Chat + Task Plan</div>
        <div className="text-xs text-zinc-400">Natural language -> JSON plan -> priority -> schedule</div>
      </div>

      <div className="p-5 space-y-4">
        <div className="h-64 overflow-auto rounded-lg border border-zinc-800 bg-zinc-950/30 p-3">
          {chat.length === 0 ? (
            <div className="text-zinc-500 text-sm">
              Try: “Prepare for the product interview tomorrow and book a doctor appointment next week.”
            </div>
          ) : null}
          <div className="space-y-3">
            {chat.map((m, idx) => (
              <div key={idx} className={m.role === "user" ? "text-right" : "text-left"}>
                <div
                  className={
                    m.role === "user"
                      ? "inline-block max-w-[90%] rounded-lg px-3 py-2 bg-violet-600 text-white"
                      : "inline-block max-w-[90%] rounded-lg px-3 py-2 bg-zinc-800 text-zinc-100"
                  }
                >
                  {m.content}
                </div>
              </div>
            ))}
          </div>
        </div>

        {lastResponse ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/20 p-4">
            <div className="font-medium mb-2">Latest Plan</div>
            <div className="text-xs text-zinc-400 mb-3">
              Next action: <span className="text-zinc-200">{lastResponse.plan.next_action}</span>
            </div>

            {lastResponse.plan.clarification_questions.length > 0 ? (
              <div className="space-y-2">
                {lastResponse.plan.clarification_questions.map((q, i) => (
                  <div key={i} className="text-sm text-zinc-200">
                    Q{i + 1}: {q}
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {lastResponse.plan.tasks.map((t, i) => (
                  <div key={i} className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-zinc-100">{t.title}</div>
                      <div className="text-xs text-zinc-400">{t.description}</div>
                    </div>
                    <div className="text-xs rounded-md border border-zinc-800 px-2 py-1 text-zinc-200 shrink-0">
                      {t.priority}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 text-xs text-zinc-400">
              Created: {lastResponse.created_task_ids.length} | Scheduled: {lastResponse.scheduled_task_ids.length} | Notifications sent:{" "}
              {lastResponse.notifications_sent} | Memory written: {String(lastResponse.memory_written)}
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
            {error}
          </div>
        ) : null}

        <div className="flex gap-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe a task..."
            className="flex-1 rounded-md bg-zinc-950 border border-zinc-800 px-3 py-2 outline-none focus:border-violet-500"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) send();
            }}
          />
          <button
            disabled={loading}
            onClick={send}
            className="rounded-md bg-violet-600 hover:bg-violet-500 disabled:opacity-60 px-4 py-2 font-medium"
          >
            {loading ? "Planning..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

