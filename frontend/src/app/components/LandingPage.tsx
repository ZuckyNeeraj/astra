import { useState } from "react";
import {
  ArrowRight,
  Bell,
  Bot,
  CalendarCheck,
  FileSearch,
  GitBranch,
  HeartPulse,
  LineChart,
  Mail,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import astraLogo from "../../assets/astra-logo.svg";
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

const agentCards = [
  ["Document Agent", "Collects PDFs, reports, bills and discharge summaries."],
  ["Insurance Agent", "Tracks approvals, policy clauses and claim readiness."],
  ["Care Agent", "Schedules follow-ups, medicines and recovery checkpoints."],
];

function isDemoSignInUrl() {
  return new URLSearchParams(window.location.search).get("demo") === "signin";
}

export function LandingPage() {
  const [showSignIn, setShowSignIn] = useState(isDemoSignInUrl);
  const demoMode = isDemoSignInUrl();

  if (showSignIn) return <SignIn demoMode={demoMode} />;

  return (
    <main className="min-h-screen overflow-hidden bg-[#F3F0EA] text-[#0B192C]">
      <div className="pointer-events-none fixed inset-0 opacity-70">
        <div className="absolute -left-24 top-32 h-72 w-72 rounded-full bg-[#00E5FF]/20 blur-3xl" />
        <div className="absolute right-0 top-20 h-96 w-96 rounded-full bg-[#0284C7]/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-80 w-80 rounded-full bg-[#FF6B6B]/10 blur-3xl" />
      </div>

      <nav className="fixed inset-x-0 top-0 z-50 border-b border-[rgba(15,23,42,0.06)] bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <img src={astraLogo} alt="Astra" className="h-10 w-auto" />
          <div className="hidden items-center gap-6 text-sm text-[#64748B] md:flex">
            <a href="#problem" className="hover:text-[#0B192C]">Problem</a>
            <a href="#demo" className="hover:text-[#0B192C]">Demo flow</a>
            <a href="#agents" className="hover:text-[#0B192C]">Agents</a>
            <a href="#agency" className="hover:text-[#0B192C]">AI as Agency</a>
            <a href="#evaluation" className="hover:text-[#0B192C]">Evaluation</a>
            <a href="/qr" className="hover:text-[#0B192C]">Demo QR</a>
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

      <section className="relative min-h-screen px-5 pb-16 pt-36 sm:px-8 lg:pb-24 lg:pt-40">
        <div className="absolute inset-x-0 inset-y-0 overflow-hidden bg-[#0B192C] shadow-2xl shadow-[#0B192C]/20">
          <div className="absolute left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#00E5FF]/20" />
          <div className="absolute left-1/2 top-1/2 h-[23rem] w-[23rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#00E5FF]/25" />
          <div className="absolute left-1/2 top-1/2 h-[12rem] w-[12rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#00E5FF]/10 blur-3xl" />
          <div className="absolute -left-16 -top-16 h-72 w-72 rounded-full bg-[#00E5FF]/20 blur-3xl" />
          <div className="absolute -bottom-24 right-0 h-96 w-96 rounded-full bg-[#0284C7]/25 blur-3xl" />
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(250,249,247,0.08),transparent_35%,rgba(0,229,255,0.08))]" />
        </div>
        <div className="relative z-10 mx-auto flex min-h-[calc(100vh-10rem)] max-w-6xl flex-col items-center justify-center py-12 text-center">
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
          <p className="mx-auto mt-6 max-w-2xl text-base text-[#D7E2EA] sm:text-lg">
            Astra monitors emails, reports, appointments, insurance updates and health records,
            then alerts you only when action is needed.
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

      <section id="agency" className="relative mx-auto max-w-7xl px-5 pb-16 sm:px-8">
        <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="mb-3 text-sm font-medium text-[#0284C7]">AI as Agency</p>
            <h2 className="max-w-3xl text-[21px] font-medium sm:text-4xl" style={{ fontFamily: ivar, lineHeight: 1.08 }}>
              A team of agents replaces the full human care-coordinator function.
            </h2>
          </div>
          <p className="max-w-md text-sm text-[#64748B]">
            Hermes Buildathon Track 03 — if an agency was run with agents instead of humans, how would it work?
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Users, title: "Manager plans", copy: "The Hermes orchestrator breaks each journey brief into subtasks and reviews specialist output." },
            { icon: Bot, title: "Specialists execute", copy: "Document, Insurance, Care and Hospital agents each own a slice of the patient journey." },
            { icon: GitBranch, title: "Handoffs pass work", copy: "Agents hand context between steps — no patient re-explaining the same story five times." },
            { icon: RefreshCw, title: "Memory persists", copy: "Health vault and journey state live in Convex, surviving across tasks and sessions." },
          ].map((item) => (
            <div key={item.title} className="rounded-[1.75rem] border border-[rgba(15,23,42,0.08)] bg-white p-5 shadow-sm">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#E0FBFD] text-[#0284C7]">
                <item.icon size={18} />
              </div>
              <h3 className="text-lg font-medium" style={{ fontFamily: ivar }}>{item.title}</h3>
              <p className="mt-2 text-sm text-[#64748B]">{item.copy}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-[1.75rem] border border-[rgba(15,23,42,0.08)] bg-[#F3F0EA] p-5 sm:p-6">
          <p className="text-sm font-medium text-[#0284C7]">Control surface</p>
          <p className="mt-2 max-w-3xl text-sm text-[#64748B]">
            A non-engineer assigns work from the dashboard — launch a journey, approve a claim step,
            or trigger a document scan — without touching prompts or code.
          </p>
        </div>
      </section>

      <section id="evaluation" className="relative border-y border-[rgba(15,23,42,0.06)] bg-white">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
          <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="mb-3 text-sm font-medium text-[#0284C7]">Evaluation & iteration</p>
              <h2 className="max-w-3xl text-[21px] font-medium sm:text-4xl" style={{ fontFamily: ivar, lineHeight: 1.08 }}>
                Closed-loop: failed runs feed a growing eval set.
              </h2>
            </div>
            <p className="max-w-md text-sm text-[#64748B]">
              Version-controlled prompts and agents, measurable gains across versions.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="grid gap-4">
              {[
                "Production failures automatically become new eval cases.",
                "Prompts and agent definitions are version-controlled in git.",
                "Quality is demonstrably climbing across versions.",
              ].map((line, index) => (
                <div key={line} className="flex items-start gap-4 rounded-3xl bg-[#F3F0EA] p-4">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl bg-[#0B192C] text-sm font-bold text-[#faf9f7]">
                    {index + 1}
                  </span>
                  <p className="text-base text-[#0B192C]">{line}</p>
                </div>
              ))}
              <p className="text-sm text-[#64748B]">
                A mentor verifies by tracing one real failure into the eval set and seeing the score trend across versions.
              </p>
            </div>

            <div className="rounded-[2rem] bg-[#0B192C] p-6 text-[#faf9f7] sm:p-8">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-[#faf9f7]/10 px-3 py-2 text-sm text-[#00E5FF]">
                <LineChart size={16} /> Example
              </div>
              <p className="text-sm opacity-90">
                Every support ticket that escalates to a human is auto-captured as a new eval case.
                The team pulls up a chart of pass rate rising across v1 through v4 — each version&apos;s prompts tagged in git.
              </p>
              <div className="mt-6 rounded-2xl border border-[#faf9f7]/10 bg-[#faf9f7]/5 p-4">
                <div className="flex items-end justify-between gap-2">
                  {["v1", "v2", "v3", "v4"].map((version, index) => (
                    <div key={version} className="flex flex-1 flex-col items-center gap-2">
                      <div
                        className="w-full rounded-t-lg bg-[#00E5FF]"
                        style={{ height: `${40 + index * 18}%`, minHeight: "2.5rem" }}
                      />
                      <span className="text-xs opacity-70">{version}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-center text-xs opacity-60">Eval pass rate by agent version</p>
              </div>
            </div>
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
