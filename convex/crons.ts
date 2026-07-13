import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Poll Gmail every minute. This is a no-op until the GMAIL_* env vars are set,
// so it's safe to leave running. Manual "Scan inbox" (inbox.simulateReport) is
// the demo trigger; this is the real always-on ingestion.
//
// PAUSED for stable demo runs: the always-on poll kept ingesting the same email
// into new plans → new journeys, churning the orchestration target. Use the
// "Scan inbox" button (inbox.scanInbox) to ingest on demand instead. Re-enable
// by uncommenting the line below.
// crons.interval("poll gmail inbox", { minutes: 1 }, internal.inbox.pollGmail, {});

export default crons;
