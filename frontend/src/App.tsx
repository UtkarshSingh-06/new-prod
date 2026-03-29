import { useCallback, useEffect, useMemo, useState } from "react";
import ChatPanel from "./components/ChatPanel";
import Dashboard from "./components/Dashboard";
import LoginView from "./components/LoginView";
import RegisterView from "./components/RegisterView";

export type TaskSubItemOut = {
  id: number;
  title: string;
  done: boolean;
  position: number;
};

export type TaskOut = {
  id: number;
  title: string;
  description: string;
  priority_score: number;
  priority_label: string;
  due_at: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  status: string;
  calendar_event_status: string;
  subitems: TaskSubItemOut[];
};

export type AssistantChatResponse = {
  plan: {
    tasks: Array<{
      title: string;
      description: string;
      priority: "low" | "medium" | "high";
      due_at: string | null;
      estimated_minutes: number | null;
      category: string | null;
    }>;
    assumptions: string[];
    next_action: "create_tasks" | "clarify_user";
    clarification_questions: string[];
  };
  created_task_ids: number[];
  scheduled_task_ids: number[];
  notifications_sent: number;
  memory_written: boolean;
};

// Dev: use Vite proxy (/api → 127.0.0.1:8000) so we never rely on localhost→IPv6 for the API.
// Override with VITE_API_BASE for Docker or a remote API.
const API_BASE =
  import.meta.env.VITE_API_BASE ||
  (import.meta.env.DEV ? "/api" : "http://127.0.0.1:8000");

function getStoredToken() {
  return localStorage.getItem("access_token");
}

export default function App() {
  const [token, setToken] = useState<string | null>(getStoredToken());
  const [view, setView] = useState<"login" | "register" | "app">(
    token ? "app" : "login",
  );

  const authHeaders = useMemo((): Record<string, string> => {
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  }, [token]);

  useEffect(() => {
    if (token) setView("app");
  }, [token]);

  const onLogout = () => {
    localStorage.removeItem("access_token");
    setToken(null);
    setView("login");
  };

  /** Clear stale JWT when the API returns 401 (secret rotation, DB reset, or expired token). */
  const onSessionInvalid = useCallback(() => {
    localStorage.removeItem("access_token");
    setToken(null);
    setView("login");
  }, []);

  if (view === "login") {
    return (
      <LoginView
        apiBase={API_BASE}
        onLogin={(nextToken) => {
          localStorage.setItem("access_token", nextToken);
          setToken(nextToken);
          setView("app");
        }}
        onSwitchToRegister={() => setView("register")}
      />
    );
  }

  if (view === "register") {
    return (
      <RegisterView
        apiBase={API_BASE}
        onRegister={(nextToken) => {
          localStorage.setItem("access_token", nextToken);
          setToken(nextToken);
          setView("app");
        }}
        onSwitchToLogin={() => setView("login")}
      />
    );
  }

  if (!token) return null;

  const flowSteps = ["Chat", "Plan", "Priority", "Schedule"] as const;

  return (
    <div className="relative min-h-dvh min-h-svh overflow-x-hidden bg-zinc-950 text-zinc-100">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_110%_70%_at_50%_-15%,rgba(139,92,246,0.22),transparent_50%)]"
      />
      <div
        aria-hidden
        className="app-mesh-layer pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_95%_10%,rgba(34,211,238,0.12),transparent_42%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_0%_100%,rgba(217,70,239,0.07),transparent_45%)]"
      />
      <div
        aria-hidden
        className="fixed inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <header className="sticky top-0 z-20 border-b border-white/[0.07] bg-zinc-950/80 px-4 py-3 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.5)] backdrop-blur-xl backdrop-saturate-150 sm:px-6 sm:py-4">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/35 to-cyan-500/20 ring-1 ring-white/10 shadow-lg shadow-violet-900/20">
                <svg className="h-5 w-5 text-violet-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                  />
                </svg>
              </div>
              <div>
                <div className="bg-gradient-to-r from-white via-zinc-100 to-zinc-400 bg-clip-text text-lg font-semibold tracking-tight text-transparent">
                  AI Task Assistant
                </div>
                <p className="mt-0.5 text-xs text-zinc-500 sm:text-sm">Plan work in plain language — we structure and schedule it.</p>
              </div>
            </div>
            <nav
              className="hidden items-center gap-1.5 rounded-full border border-white/[0.06] bg-zinc-900/50 p-1 md:flex"
              aria-label="Workflow"
            >
              {flowSteps.map((step, i) => (
                <span key={step} className="flex items-center gap-1.5">
                  {i > 0 ? <span className="text-zinc-600">→</span> : null}
                  <span className="rounded-full bg-zinc-800/80 px-2.5 py-1 text-[11px] font-medium tracking-wide text-zinc-300">
                    {step}
                  </span>
                </span>
              ))}
            </nav>
          </div>
          <button
            type="button"
            className="self-start rounded-xl border border-zinc-600/50 bg-zinc-800/35 px-4 py-2.5 text-sm font-medium text-zinc-200 backdrop-blur-sm transition hover:border-red-400/30 hover:bg-red-950/30 hover:text-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/30 active:scale-[0.98] sm:self-auto"
            onClick={onLogout}
          >
            Log out
          </button>
        </div>
      </header>

      <main className="relative z-10 mx-auto grid max-w-7xl grid-cols-1 gap-5 p-4 sm:gap-6 sm:p-6 lg:grid-cols-12 lg:gap-8">
        <section className="lg:col-span-5">
          <ChatPanel
            apiBase={API_BASE}
            authHeaders={authHeaders}
            onSessionInvalid={onSessionInvalid}
          />
        </section>
        <section className="lg:col-span-7">
          <Dashboard
            apiBase={API_BASE}
            authHeaders={authHeaders}
            onSessionInvalid={onSessionInvalid}
          />
        </section>
      </main>
    </div>
  );
}

