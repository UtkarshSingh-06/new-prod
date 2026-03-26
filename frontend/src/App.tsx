import React, { useEffect, useMemo, useState } from "react";
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

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

function getStoredToken() {
  return localStorage.getItem("access_token");
}

export default function App() {
  const [token, setToken] = useState<string | null>(getStoredToken());
  const [view, setView] = useState<"login" | "register" | "app">(
    token ? "app" : "login",
  );

  const authHeaders = useMemo(() => {
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
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <div>
          <div className="text-lg font-semibold">LLM Task Assistant</div>
          <div className="text-xs text-zinc-400">Chat -> plan -> priority -> schedule</div>
        </div>
        <button
          className="rounded-md bg-zinc-800 hover:bg-zinc-700 px-3 py-2 text-sm"
          onClick={onLogout}
        >
          Logout
        </button>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-6">
        <section className="lg:col-span-5">
          <ChatPanel apiBase={API_BASE} authHeaders={authHeaders} />
        </section>
        <section className="lg:col-span-7">
          <Dashboard
            apiBase={API_BASE}
            authHeaders={authHeaders}
          />
        </section>
      </main>
    </div>
  );
}

