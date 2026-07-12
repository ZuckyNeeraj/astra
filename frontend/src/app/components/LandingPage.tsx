import { useState } from "react";
import {
  ArrowRight,
  Bell,
  Bot,
  CalendarCheck,
  CheckCircle2,
  FileSearch,
  HeartPulse,
  Mail,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import astraHero from "../../assets/astra-hero-ai.png";
import { SignIn } from "./SignIn";

const ivar = '"Ivar Display", Georgia, "Times New Roman", serif';

const journeySteps = [
  { icon: Mail, label: "Health report arrives", sub: "Email trigger detected" },
  { icon: Bot, label: "Astra reads context", sub: "Diagnosis and urgency extracted" },
  { icon: FileSearch, label: "Vault is organized", sub: "Reports, bills and IDs sorted" },
  { icon: ShieldCheck, label: "Insurance tracked", sub: "Cashless and claim status monitored" },
  { icon: CalendarCheck, label: "Follow-up planned", sub: "Doctor visit and tests suggested" },
  { icon: HeartPulse, label: "Recovery watched", sub: "Medication and rehab reminders" },
];

const stats = [
  { value: "3.26cr", label: "health insurance claims processed in India" },
  { value: "₹1.2L cr+", label: "health insurance market and growing" },
  { value: "43%", label: "policyholders reported claims difficulty" },
];

const agentCards = [
  ["Document Agent", "Collects PDFs, reports, bills and discharge summaries."],
  ["Insurance Agent", "Tracks approvals, policy clauses and claim readiness."],
  ["Care Agent", "Schedules follow-ups, medicines and recovery checkpoints."],
];

export function LandingPage() {
  const [showSignIn, setShowSignIn] = useState(false);

  if (showSignIn) return <SignIn />;

  return (
    <main className="min-h-screen overflow-hidden bg-[#F3F0EA] text-[#0B192C]">
      <div className="pointer-events-none fixed inset-0 opacity-70">
        <div className="absolute -left-24 top-32 h-72 w-72 rounded-full bg-[#00E5FF]/20 blur-3xl" />
        <div className="absolute right-0 top-20 h-96 w-96 rounded-full bg-[#0284C7]/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-80 w-80 rounded-full bg-[#FF6B6B]/10 blur-3xl" />
      </div>

      <nav className="fixed inset-x-0 top-0 z-50 border-b border-[rgba(15,23,42,0.06)] bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#0B192C] text-[#faf9f7] shadow-sm">
              <span className="font-bold">A</span>
            </div>
            <span className="text-lg font-bold">astra</span>
          </div>
          <div className="hidden items-center gap-6 text-sm text-[#64748B] md:flex">
            <a href="#problem" className="hover:text-[#0B192C]">Problem</a>
            <a href="#demo" className="hover:text-[#0B192C]">Demo flow</a>
            <a href="#agents" className="hover:text-[#0B192C]">Agents</a>
          </div>
          <button
            type="button"
            onClick={() => setShowSignIn(true)}
            className="rounded-xl border border-[rgba(15,23,42,0.08)] bg-[#faf9f7] px-4 py-2 text-sm font-medium text-[#0B192C] shadow-sm transition hover:bg-[#EEEAE2]"
          >
            Sign in
          </button>
        </div>
      </nav>

      <section className="relative px-5 pb-16 pt-36 sm:px-8 lg:pb-24 lg:pt-40">
        <div className="absolute inset-x-0 inset-y-0 overflow-hidden bg-[#0B192C] shadow-2xl shadow-[#0B192C]/20">
          <div className="absolute left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#00E5FF]/20" />
          <div className="absolute left-1/2 top-1/2 h-[23rem] w-[23rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#00E5FF]/25" />
          <div className="absolute left-1/2 top-1/2 h-[12rem] w-[12rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#00E5FF]/10 blur-3xl" />
          <div className="absolute -left-16 -top-16 h-72 w-72 rounded-full bg-[#00E5FF]/20 blur-3xl" />
          <div className="absolute -bottom-24 right-0 h-96 w-96 rounded-full bg-[#0284C7]/25 blur-3xl" />
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(250,249,247,0.08),transparent_35%,rgba(0,229,255,0.08))]" />
        </div>
        <div className="relative z-10 mx-auto flex min-h-[72dvh] max-w-6xl flex-col items-center justify-center py-12 text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#00E5FF]/30 bg-[#faf9f7]/10 px-3 py-2 text-sm font-medium text-[#00E5FF] shadow-sm backdrop-blur-xl">
            <Sparkles size={16} />
            Silent AI care coordination
          </div>
          <h1
            className="mx-auto max-w-5xl text-[21px] font-medium text-[#faf9f7] sm:text-4xl lg:text-7xl"
            style={{ fontFamily: ivar, lineHeight: 1.02 }}
          >
            The AI healthcare assistant that works before you ask.
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-base text-[#D7E2EA] sm:text-lg">
            Astra monitors emails, reports, appointments, insurance updates and health records,
            then coordinates specialized agents in the background — alerting you only when action is needed.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => setShowSignIn(true)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#00E5FF] px-5 py-3 text-sm font-medium text-[#0B192C] shadow-xl shadow-[#00E5FF]/20 transition hover:-translate-y-0.5 hover:bg-[#faf9f7]"
            >
              Launch Astra <ArrowRight size={16} />
            </button>
            <a
              href="#demo"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#faf9f7]/15 bg-[#faf9f7]/10 px-5 py-3 text-sm font-medium text-[#faf9f7] shadow-sm backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-[#faf9f7]/20"
            >
              See how it works
            </a>
          </div>

          <div className="mt-9 grid w-full max-w-4xl gap-3 sm:grid-cols-3">
            {stats.map((stat) => (
              <div key={stat.value} className="rounded-3xl border border-[#faf9f7]/10 bg-[#faf9f7]/10 p-4 shadow-xl shadow-[#0B192C]/10 backdrop-blur-xl">
                <p className="text-2xl font-bold text-[#00E5FF]">{stat.value}</p>
                <p className="mt-1 text-xs text-[#C7D3DD]">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 w-full max-w-md rounded-3xl border border-[#00E5FF]/20 bg-[#faf9f7]/10 p-4 text-left shadow-2xl shadow-[#0B192C]/20 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#00E5FF]/15 text-[#00E5FF]">
                <Zap size={18} />
              </div>
              <div>
                <p className="text-sm font-medium text-[#faf9f7]">5 background agents completed tasks</p>
                <p className="mt-1 text-xs text-[#C7D3DD]">Only 1 action needs your approval.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="problem" className="relative border-y border-[rgba(15,23,42,0.06)] bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-16 sm:px-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div>
            <p className="mb-3 text-sm font-medium text-[#0284C7]">The real problem</p>
            <h2 className="text-[21px] font-medium sm:text-4xl" style={{ fontFamily: ivar, lineHeight: 1.08 }}>
              Healthcare isn’t broken because of medicine. It’s broken because of coordination.
            </h2>
          </div>
          <div className="grid gap-3">
            {[
              "Hospitals have management systems.",
              "Insurance companies have claim systems.",
              "Patients have WhatsApp, PDFs and stress.",
            ].map((line, index) => (
              <div key={line} className="flex items-center gap-4 rounded-3xl bg-[#F3F0EA] p-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#0B192C] text-sm font-bold text-[#faf9f7]">
                  {index + 1}
                </span>
                <p className="text-base text-[#0B192C]">{line}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="demo" className="relative mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="mb-3 text-sm font-medium text-[#0284C7]">Demo flow</p>
            <h2 className="text-[21px] font-medium sm:text-4xl" style={{ fontFamily: ivar }}>
              One report arrives. The journey starts itself.
            </h2>
          </div>
          <p className="max-w-md text-sm text-[#64748B]">
            Astra turns a passive medical email into coordinated next steps across documents,
            insurance, appointments and recovery.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {journeySteps.map((step, index) => (
            <div key={step.label} className="group rounded-[1.75rem] border border-[rgba(15,23,42,0.08)] bg-[#faf9f7] p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
              <div className="mb-5 flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#E0FBFD] text-[#0284C7]">
                  <step.icon size={18} />
                </div>
                <span className="text-sm font-medium text-[#94A3B8]">0{index + 1}</span>
              </div>
              <h3 className="text-lg font-medium" style={{ fontFamily: ivar }}>{step.label}</h3>
              <p className="mt-2 text-sm text-[#64748B]">{step.sub}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="agents" className="relative mx-auto max-w-7xl px-5 pb-16 sm:px-8">
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[2rem] bg-[#0B192C] p-8 text-[#faf9f7] sm:p-10">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-[#faf9f7]/10 px-3 py-2 text-sm text-[#00E5FF]">
              <Bot size={16} /> Agent team
            </div>
            <h2 className="text-[21px] font-medium sm:text-4xl" style={{ fontFamily: ivar, lineHeight: 1.08 }}>
              Not another chatbot. A background operating system for patients.
            </h2>
            <p className="mt-5 text-sm opacity-75">
              Astra replaces the manual coordination patients do every day: finding information,
              chasing documents, interpreting claim steps and remembering what comes next.
            </p>
          </div>
          <div className="grid gap-4">
            {agentCards.map(([title, copy], index) => (
              <div key={title} className="flex gap-4 rounded-[1.75rem] border border-[rgba(15,23,42,0.08)] bg-white p-5 shadow-sm">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-[#F3F0EA] text-[#0284C7]">
                  <Bot size={18} />
                </div>
                <div>
                  <p className="text-xs font-medium text-[#94A3B8]">SPECIALIST 0{index + 1}</p>
                  <h3 className="mt-1 text-lg font-medium" style={{ fontFamily: ivar }}>{title}</h3>
                  <p className="mt-2 text-sm text-[#64748B]">{copy}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative mx-auto max-w-7xl px-5 pb-16 sm:px-8">
        <div className="overflow-hidden rounded-[2rem] bg-[#0B192C] p-8 text-[#faf9f7] shadow-2xl sm:p-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_0.75fr] lg:items-center">
            <div>
              <h2 className="max-w-3xl text-[21px] font-medium sm:text-4xl" style={{ fontFamily: ivar, lineHeight: 1.08 }}>
                When people finally need insurance, the hardest part shouldn’t be navigating the system.
              </h2>
              <p className="mt-4 max-w-3xl text-sm opacity-75">
                Astra gives every patient a proactive AI care coordinator — silent by default,
                useful when it matters, and always one step ahead.
              </p>
            </div>
            <div className="rounded-3xl border border-[#faf9f7]/10 bg-[#faf9f7]/10 p-5">
              <div className="flex items-center gap-3">
                <Bell className="text-[#00E5FF]" size={20} />
                <p className="text-sm font-medium">Action required</p>
              </div>
              <p className="mt-3 text-sm opacity-75">
                “Approve cashless pre-auth request for Apollo Hospitals. All documents are ready.”
              </p>
              <button
                type="button"
                onClick={() => setShowSignIn(true)}
                className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-[#00E5FF] px-5 py-3 text-sm font-medium text-[#0B192C] transition hover:bg-[#faf9f7]"
              >
                Start with Astra <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
