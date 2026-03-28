import { useEffect, useMemo, useState } from "react";
import ChatPanel from "./components/ChatPanel";
import Dashboard from "./components/Dashboard";
import LoginView from "./components/LoginView";
import RegisterView from "./components/RegisterView";

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

  return (
    <div className="relative min-h-dvh min-h-svh overflow-x-hidden bg-zinc-950 text-zinc-100">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_100%_60%_at_50%_-10%,rgba(139,92,246,0.18),transparent)]"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_100%_0%,rgba(59,130,246,0.08),transparent_40%)]"
      />

      <header className="sticky top-0 z-20 border-b border-white/10 bg-zinc-950/75 px-4 py-3 backdrop-blur-xl sm:px-6 sm:py-4">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-lg font-semibold tracking-tight text-transparent">
              AI Task Assistant
            </div>
            <div className="text-xs text-zinc-400 sm:text-sm">
              {"Chat → plan → priority → schedule"}
            </div>
          </div>
          <button
            type="button"
            className="self-start rounded-xl border border-zinc-600/80 bg-zinc-800/40 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 active:scale-[0.98] sm:self-auto"
            onClick={onLogout}
          >
            Log out
          </button>
        </div>
      </header>

      <main className="relative z-10 mx-auto grid max-w-7xl grid-cols-1 gap-4 p-4 sm:gap-6 sm:p-6 lg:grid-cols-12">
        <section className="lg:col-span-5">
          <ChatPanel apiBase={API_BASE} authHeaders={authHeaders} />
        </section>
        <section className="lg:col-span-7">
          <Dashboard apiBase={API_BASE} authHeaders={authHeaders} />
        </section>
      </main>
    </div>
  );
}

