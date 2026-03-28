import { type FormEvent, useState } from "react";
import AuthSurface from "./AuthSurface";

type Props = {
  apiBase: string;
  onLogin: (token: string) => void;
  onSwitchToRegister: () => void;
};

const inputClass =
  "block w-full rounded-xl border border-zinc-700/80 bg-zinc-950/70 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition duration-200 focus:border-violet-500/70 focus:outline-none focus:ring-2 focus:ring-violet-500/25";

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
            <label htmlFor="login-email" className="mb-1.5 block text-sm font-medium text-zinc-300">
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
            <label htmlFor="login-password" className="mb-1.5 block text-sm font-medium text-zinc-300">
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
            className="rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-200"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        <div className="flex flex-col gap-3 pt-1">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/35 transition duration-200 hover:from-violet-500 hover:to-fuchsia-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60 disabled:cursor-not-allowed disabled:opacity-55 active:scale-[0.98]"
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
            className="inline-flex w-full items-center justify-center rounded-xl border border-zinc-600/70 bg-zinc-800/35 px-4 py-3.5 text-sm font-medium text-zinc-200 transition duration-200 hover:border-zinc-500 hover:bg-zinc-800/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/40 active:scale-[0.98]"
            onClick={onSwitchToRegister}
          >
            Create an account
          </button>
        </div>
      </form>
    </AuthSurface>
  );
}
