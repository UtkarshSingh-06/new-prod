import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle: string;
  children: ReactNode;
};

function LogoMark() {
  return (
    <div
      className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/25 via-fuchsia-500/15 to-cyan-500/20 shadow-lg shadow-violet-900/30 ring-1 ring-white/10"
      aria-hidden
    >
      <svg className="h-7 w-7 text-violet-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.847a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.847.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z"
        />
      </svg>
    </div>
  );
}

/**
 * Shared full-viewport auth background + glass card shell.
 */
export default function AuthSurface({ title, subtitle, children }: Props) {
  return (
    <div className="relative min-h-dvh min-h-svh overflow-x-hidden bg-zinc-950 text-zinc-100">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_130%_90%_at_50%_-25%,rgba(139,92,246,0.4),transparent_55%)]"
      />
      <div
        aria-hidden
        className="app-mesh-layer pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_70%,rgba(34,211,238,0.14),transparent_45%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_80%,rgba(217,70,239,0.08),transparent_40%)]"
      />
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />

      <div className="relative z-10 flex min-h-dvh min-h-svh items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-md">
          <div
            className="overflow-hidden rounded-2xl border border-white/[0.09] bg-zinc-900/50 shadow-2xl shadow-black/50 ring-1 ring-inset ring-white/[0.04] backdrop-blur-2xl transition-[box-shadow,transform] duration-500 hover:shadow-violet-950/30 sm:rounded-3xl"
            style={{ animation: "auth-fade-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) both" }}
          >
            <div className="h-1 w-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400 opacity-90" />
            <div className="px-6 py-8 sm:px-8 sm:py-10">
              <LogoMark />
              <div className="mb-8 text-center">
                <h1 className="bg-gradient-to-br from-white via-zinc-100 to-zinc-400 bg-clip-text text-2xl font-semibold tracking-tight text-transparent sm:text-3xl">
                  {title}
                </h1>
                <p className="mt-2.5 text-sm leading-relaxed text-zinc-400 sm:text-base">{subtitle}</p>
              </div>
              {children}
            </div>
          </div>
          <p className="mt-8 text-center text-xs leading-relaxed text-zinc-600">
            Encrypted session · JWT · Your tasks stay in your workspace
          </p>
        </div>
      </div>

      <style>{`
        @keyframes auth-fade-in {
          from { opacity: 0; transform: translateY(16px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
