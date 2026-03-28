import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle: string;
  children: ReactNode;
};

/**
 * Shared full-viewport auth background + glass card shell.
 */
export default function AuthSurface({ title, subtitle, children }: Props) {
  return (
    <div className="relative min-h-dvh min-h-svh overflow-x-hidden bg-zinc-950 text-zinc-100">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(139,92,246,0.35),transparent)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_60%,rgba(59,130,246,0.12),transparent_50%)]"
      />
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative z-10 flex min-h-dvh min-h-svh items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-md">
          <div
            className="rounded-2xl border border-white/10 bg-zinc-900/60 p-6 shadow-2xl shadow-violet-950/40 backdrop-blur-xl transition-shadow duration-300 hover:shadow-violet-900/25 sm:p-8"
            style={{ animation: "auth-fade-in 0.45s ease-out both" }}
          >
            <div className="mb-6 text-center sm:mb-8">
              <h1 className="bg-gradient-to-br from-white to-zinc-300 bg-clip-text text-2xl font-semibold tracking-tight text-transparent sm:text-3xl">
                {title}
              </h1>
              <p className="mt-2 text-sm text-zinc-400 sm:text-base">{subtitle}</p>
            </div>
            {children}
          </div>
          <p className="mt-6 text-center text-xs text-zinc-500">
            AI Task Management Assistant — secure JWT session
          </p>
        </div>
      </div>

      <style>{`
        @keyframes auth-fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
