import { type FormEvent, useState } from "react";
import AuthSurface from "./AuthSurface";

type Props = {
  apiBase: string;
  onLogin: (token: string) => void;
  onSwitchToRegister: () => void;
};

const inputClass =
  "block w-full rounded-xl border border-zinc-600/45 bg-zinc-950/50 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-sm transition duration-200 hover:border-zinc-500/55 focus:border-cyan-400/45 focus:outline-none focus:ring-2 focus:ring-cyan-500/20";

export default function LoginView({
  apiBase,
  onLogin,
  onSwitchToRegister,
}: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthSurface title="Welcome back" subtitle="Sign in to your AI task workspace">
      <form className="space-y-5" onSubmit={submit} noValidate>
        <div className="space-y-4">
          <div>
            <label htmlFor="login-email" className="mb-1.5 block text-sm font-medium text-zinc-200">
              Email
            </label>
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className={inputClass}
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label htmlFor="login-password" className="mb-1.5 block text-sm font-medium text-zinc-200">
              Password
            </label>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className={inputClass}
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
              placeholder="Enter your password"
            />
          </div>
        </div>

        {error ? (
          <div
            className="rounded-xl border border-red-400/25 bg-red-950/35 px-4 py-3 text-sm text-red-100 shadow-[0_0_24px_-8px_rgba(248,113,113,0.35)]"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        <div className="flex flex-col gap-3 pt-1">
          <button
            type="submit"
            disabled={loading}
            className="btn-primary-glow inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-violet-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:cursor-not-allowed disabled:opacity-55"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Signing in…
              </span>
            ) : (
              "Sign in"
            )}
          </button>
          <button
            type="button"
            className="inline-flex w-full items-center justify-center rounded-xl border border-zinc-600/50 bg-zinc-800/30 px-4 py-3.5 text-sm font-medium text-zinc-200 backdrop-blur-sm transition duration-200 hover:border-cyan-500/25 hover:bg-zinc-800/55 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/25 active:scale-[0.98]"
            onClick={onSwitchToRegister}
          >
            Create an account
          </button>
        </div>
      </form>
    </AuthSurface>
  );
}
