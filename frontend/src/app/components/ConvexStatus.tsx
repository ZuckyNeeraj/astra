import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";

/**
 * Small floating badge proving the UI is reading LIVE from the shared Convex DB.
 * Add a row from the CLI (`npx convex run activity:log ...`) and watch the count
 * tick up here with no refresh — that's Convex's reactive queries in action.
 *
 * This is a wiring demo. Tomorrow, real screens will call useQuery the same way.
 */
export function ConvexStatus() {
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
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
      className="rounded-2xl border border-[rgba(15,23,42,0.1)] bg-white shadow-lg px-4 py-3 text-xs"
    >
      <div className="flex items-center gap-2 font-bold text-[#0F172A]">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: connected ? "#16A34A" : "#D97706" }}
        />
        {connected ? "Live from Convex" : "Connecting…"}
      </div>
      {journey && (
        <div className="mt-1.5 text-[#64748B] leading-relaxed">
          <div className="font-semibold text-[#0F172A]">{journey.title}</div>
          <div>{journeys!.length} active journey(s)</div>
          <div>{activity?.length ?? 0} activity events</div>
        </div>
      )}
    </div>
  );
}
