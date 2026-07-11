import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";

// Email + password sign-in / sign-up, backed by Convex Auth.
export function SignIn() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn("password", { email, password, flow });
    } catch {
      setError(
        flow === "signIn"
          ? "Couldn't sign in. Check your email and password."
          : "Couldn't sign up. Try a stronger password (8+ chars) or a different email.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: "#F8FAFF" }}
    >
      <div className="w-full max-w-sm bg-white rounded-3xl border border-[rgba(15,23,42,0.08)] shadow-sm p-8">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-7">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,#0EA5E9,#14B8A6)" }}
          >
            <span className="text-white font-black" style={{ fontFamily: "'Outfit', sans-serif" }}>A</span>
          </div>
          <span
            className="font-black text-[#0F172A] text-xl tracking-tight"
            style={{ fontFamily: "'Outfit', sans-serif" }}
          >
            astra
          </span>
        </div>

        <h1 className="text-2xl font-black text-[#0F172A] tracking-tight" style={{ fontFamily: "'Outfit', sans-serif" }}>
          {flow === "signIn" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="text-sm text-[#64748B] mt-1 mb-6">
          {flow === "signIn" ? "Sign in to your healthcare journey." : "Start managing a healthcare journey."}
        </p>

        <form onSubmit={submit} className="flex flex-col gap-3">
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-[rgba(15,23,42,0.12)] px-4 py-2.5 text-sm outline-none focus:border-[#0EA5E9]"
          />
          <input
            type="password"
            required
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-[rgba(15,23,42,0.12)] px-4 py-2.5 text-sm outline-none focus:border-[#0EA5E9]"
          />

          {error && <p className="text-xs text-[#DC2626] leading-snug">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="mt-1 w-full rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-60 transition"
            style={{ background: "linear-gradient(135deg,#0EA5E9,#14B8A6)" }}
          >
            {busy ? "Please wait…" : flow === "signIn" ? "Sign in" : "Sign up"}
          </button>
        </form>

        <button
          onClick={() => {
            setFlow(flow === "signIn" ? "signUp" : "signIn");
            setError(null);
          }}
          className="mt-5 w-full text-center text-xs text-[#64748B] hover:text-[#0EA5E9] transition"
        >
          {flow === "signIn" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
