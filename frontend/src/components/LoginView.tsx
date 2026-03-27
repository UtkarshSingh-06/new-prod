import { useState } from "react";

type Props = {
  apiBase: string;
  onLogin: (token: string) => void;
  onSwitchToRegister: () => void;
};

export default function LoginView({
  apiBase,
  onLogin,
  onSwitchToRegister,
}: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      const form = new URLSearchParams();
      form.set("username", email);
      form.set("password", password);

      const res = await fetch(`${apiBase}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Login failed: ${res.status}`);
      }
      const data = await res.json();
      onLogin(data.access_token);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100 p-6">
      <div className="w-full max-w-md border border-zinc-800 rounded-xl p-6 bg-zinc-900/40">
        <h1 className="text-2xl font-semibold mb-1">Login</h1>
        <p className="text-sm text-zinc-400 mb-5">JWT-protected task planner</p>

        <div className="space-y-3">
          <label className="block">
            <div className="text-sm text-zinc-300 mb-1">Email</div>
            <input
              className="w-full rounded-md bg-zinc-950 border border-zinc-800 px-3 py-2 outline-none focus:border-violet-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </label>

          <label className="block">
            <div className="text-sm text-zinc-300 mb-1">Password</div>
            <input
              type="password"
              className="w-full rounded-md bg-zinc-950 border border-zinc-800 px-3 py-2 outline-none focus:border-violet-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </label>

          {error ? (
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
              {error}
            </div>
          ) : null}

          <button
            disabled={loading}
            className="w-full rounded-md bg-violet-600 hover:bg-violet-500 disabled:opacity-60 py-2 font-medium"
            onClick={submit}
          >
            {loading ? "Logging in..." : "Login"}
          </button>

          <button
            className="w-full rounded-md border border-zinc-800 hover:bg-zinc-800/40 py-2 font-medium"
            onClick={onSwitchToRegister}
          >
            Create account
          </button>
        </div>
      </div>
    </div>
  );
}

