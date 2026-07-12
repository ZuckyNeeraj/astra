import { useState } from "react";
import { useQuery } from "convex/react";
import { X } from "lucide-react";
import astraBot from "../../assets/astra-bot.svg";
import { api } from "@convex/_generated/api";

/**
 * Small floating badge proving the UI is reading LIVE from the shared Convex DB.
 * Add a row from the CLI (`npx convex run activity:log ...`) and watch the count
 * tick up here with no refresh — that's Convex's reactive queries in action.
 *
 * This is a wiring demo. Tomorrow, real screens will call useQuery the same way.
 */
export function ConvexStatus() {
  const [open, setOpen] = useState(false);
  const journeys = useQuery(api.journeys.listActive);
  const journey = journeys?.[0];
  const activity = useQuery(
    api.activity.recent,
    journey ? { journeyId: journey._id, limit: 50 } : "skip",
  );

  const connected = journeys !== undefined;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 16,
        right: 16,
        zIndex: 9999,
        fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
      }}
      className="flex flex-col items-end gap-2"
    >
      {open && (
        <div className="scrollbar-none max-h-[40dvh] w-64 overflow-y-auto rounded-2xl border border-[rgba(15,23,42,0.1)] bg-[#faf9f7] shadow-lg px-4 py-3 text-xs">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 font-bold text-[#0B192C]">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: connected ? "#16A34A" : "#D97706" }}
              />
              {connected ? "Live from Convex" : "Connecting…"}
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Collapse Convex status"
              className="rounded-lg p-1 text-[#64748B] transition hover:bg-[#EEEAE2] hover:text-[#0B192C]"
            >
              <X size={14} />
            </button>
          </div>
          {journey && (
            <div className="mt-2 text-[#64748B]">
              <div className="font-medium text-[#0B192C]">{journey.title}</div>
              <div>{journeys!.length} active journey(s)</div>
              <div>{activity?.length ?? 0} activity events</div>
            </div>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? "Collapse Convex status" : "Expand Convex status"}
        aria-expanded={open}
        title={connected ? "Live from Convex" : "Connecting…"}
        className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-[rgba(15,23,42,0.1)] bg-[#faf9f7] text-[#0B192C] shadow-lg transition hover:-translate-y-0.5 hover:bg-[#EEEAE2]"
      >
        <img src={astraBot} alt="Astra" className="h-10 w-auto" />
        <span
          className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full border-2 border-[#faf9f7]"
          style={{ backgroundColor: connected ? "#16A34A" : "#D97706" }}
        />
      </button>
    </div>
  );
}
