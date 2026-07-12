import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useAuthActions } from "@convex-dev/auth/react";

// Email + password sign-in / sign-up, backed by Convex Auth.
export function SignIn() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
      className="min-h-[100dvh] flex items-center justify-center px-4 py-6 sm:px-6"
      style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', background: "#F3F0EA" }}
    >
      <div className="w-full max-w-md bg-[#faf9f7] rounded-3xl border border-[rgba(15,23,42,0.08)] shadow-sm p-6 sm:p-8">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-6 sm:mb-7">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg,#0284C7,#0284C7)" }}
          >
            <span className="text-[#faf9f7] font-bold" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>A</span>
          </div>
          <span
            className="font-bold text-[#0B192C] text-lg sm:text-xl"
            style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
          >
            astra
          </span>
        </div>

        <h1 className="text-[21px] sm:text-2xl font-medium text-[#0B192C]" style={{ fontFamily: '"Ivar Display", Georgia, "Times New Roman", serif' }}>
          {flow === "signIn" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="text-sm text-[#64748B] mt-1 mb-5 sm:mb-6">
          {flow === "signIn" ? "Sign in to your healthcare journey." : "Start managing a healthcare journey."}
        </p>

        <form onSubmit={submit} className="flex flex-col gap-3">
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-[rgba(15,23,42,0.12)] px-4 py-3 text-sm outline-none focus:border-[#0284C7]"
          />
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              required
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-[rgba(15,23,42,0.12)] px-4 py-3 pr-11 text-sm outline-none focus:border-[#0284C7]"
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="absolute inset-y-0 right-0 flex items-center justify-center px-3 text-[#64748B] hover:text-[#0B192C] transition"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {error && <p className="text-xs text-[#FF6B6B]">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="mt-1 w-full rounded-xl py-3 text-sm font-bold text-[#faf9f7] disabled:opacity-60 transition"
            style={{ background: "#0B192C" }}
          >
            {busy ? "Please wait…" : flow === "signIn" ? "Sign in" : "Sign up"}
          </button>
        </form>

        <button
          onClick={() => {
            setFlow(flow === "signIn" ? "signUp" : "signIn");
            setError(null);
          }}
          className="mt-5 w-full text-center text-xs text-[#64748B] hover:text-[#0284C7] transition"
        >
          {flow === "signIn" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
