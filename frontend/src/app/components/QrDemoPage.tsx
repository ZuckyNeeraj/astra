import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Copy, Download, ExternalLink, QrCode } from "lucide-react";
import astraLogo from "../../assets/astra-logo.svg";
import {
  DEMO_EMAIL,
  DEMO_PASSWORD,
  DEMO_SIGNIN_STEPS,
  DEMO_SIGNIN_URL,
} from "../demoAuth";

export function QrDemoPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState<"url" | "email" | "password" | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    void QRCode.toCanvas(canvas, DEMO_SIGNIN_URL, {
      width: 280,
      margin: 2,
      color: { dark: "#0B192C", light: "#faf9f7" },
      errorCorrectionLevel: "M",
    });
  }, []);

  async function copyText(label: "url" | "email" | "password", value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard may be blocked on some devices.
    }
  }

  function downloadQr() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement("a");
    link.download = "astra-demo-signin-qr.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <main
      className="min-h-screen bg-[#F3F0EA] px-4 py-8 text-[#0B192C] sm:px-6"
      style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <img src={astraLogo} alt="Astra" className="h-10 w-auto" />
          <a
            href="/"
            className="text-sm font-medium text-[#64748B] transition hover:text-[#0284C7]"
          >
            Back to site
          </a>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
          <div className="rounded-[2rem] border border-[rgba(15,23,42,0.08)] bg-[#faf9f7] p-6 shadow-sm sm:p-8">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#E0FBFD] px-3 py-2 text-sm font-medium text-[#0284C7]">
              <QrCode size={16} />
              Demo sign-in QR
            </div>
            <h1
              className="text-[21px] font-medium sm:text-3xl"
              style={{ fontFamily: '"Ivar Display", Georgia, "Times New Roman", serif' }}
            >
              Scan to open Astra and sign in
            </h1>
            <p className="mt-3 text-sm text-[#64748B]">
              Point a phone camera at the code. It opens the live app and runs the demo sign-in flow automatically.
            </p>

            <div className="mt-6 flex flex-col items-center rounded-3xl border border-[rgba(15,23,42,0.08)] bg-white p-5">
              <canvas ref={canvasRef} className="rounded-2xl" aria-label="Demo sign-in QR code" />
              <p className="mt-4 break-all text-center text-xs text-[#64748B]">{DEMO_SIGNIN_URL}</p>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={downloadQr}
                className="inline-flex items-center gap-2 rounded-xl bg-[#0B192C] px-4 py-2.5 text-sm font-medium text-[#faf9f7] transition hover:bg-[#12304D]"
              >
                <Download size={16} />
                Download PNG
              </button>
              <button
                type="button"
                onClick={() => copyText("url", DEMO_SIGNIN_URL)}
                className="inline-flex items-center gap-2 rounded-xl border border-[rgba(15,23,42,0.12)] bg-white px-4 py-2.5 text-sm font-medium transition hover:bg-[#F3F0EA]"
              >
                <Copy size={16} />
                {copied === "url" ? "Copied" : "Copy link"}
              </button>
              <a
                href={DEMO_SIGNIN_URL}
                className="inline-flex items-center gap-2 rounded-xl border border-[rgba(15,23,42,0.12)] bg-white px-4 py-2.5 text-sm font-medium transition hover:bg-[#F3F0EA]"
              >
                <ExternalLink size={16} />
                Open demo link
              </a>
            </div>
          </div>

          <div className="rounded-[2rem] border border-[rgba(15,23,42,0.08)] bg-white p-6 shadow-sm sm:p-8">
            <p className="text-sm font-medium text-[#0284C7]">Manual steps (if needed)</p>
            <ol className="mt-4 space-y-3">
              {DEMO_SIGNIN_STEPS.map((step, index) => (
                <li key={step} className="flex gap-3 text-sm text-[#0B192C]">
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#F3F0EA] text-xs font-bold">
                    {index + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>

            <div className="mt-6 space-y-3 rounded-2xl bg-[#F3F0EA] p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[#94A3B8]">Email</p>
                  <p className="truncate text-sm font-medium">{DEMO_EMAIL}</p>
                </div>
                <button
                  type="button"
                  onClick={() => copyText("email", DEMO_EMAIL)}
                  className="rounded-lg border border-[rgba(15,23,42,0.1)] bg-white px-3 py-1.5 text-xs font-medium"
                >
                  {copied === "email" ? "Copied" : "Copy"}
                </button>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-[#94A3B8]">Password</p>
                  <p className="text-sm font-medium">{DEMO_PASSWORD}</p>
                </div>
                <button
                  type="button"
                  onClick={() => copyText("password", DEMO_PASSWORD)}
                  className="rounded-lg border border-[rgba(15,23,42,0.1)] bg-white px-3 py-1.5 text-xs font-medium"
                >
                  {copied === "password" ? "Copied" : "Copy"}
                </button>
              </div>
            </div>

            <p className="mt-5 text-xs text-[#64748B]">
              Display this page on a laptop or print the QR for judges. The encoded link opens{" "}
              <span className="font-medium">astra-bac.pages.dev</span>, shows sign-in, fills the demo credentials, and submits.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
