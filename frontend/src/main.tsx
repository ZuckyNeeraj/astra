import { createRoot } from "react-dom/client";
import { ConvexReactClient, Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import App from "./app/App.tsx";
import { ConvexStatus } from "./app/components/ConvexStatus.tsx";
import { LandingPage } from "./app/components/LandingPage.tsx";
import "./styles/index.css";

// Connect to the shared Convex deployment (URL from frontend/.env.local).
const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

createRoot(document.getElementById("root")!).render(
  <ConvexAuthProvider client={convex}>
    <AuthLoading>
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: "#64748B" }}>
        Loading…
      </div>
    </AuthLoading>
    <Unauthenticated>
      <LandingPage />
    </Unauthenticated>
    <Authenticated>
      <App />
      <ConvexStatus />
    </Authenticated>
  </ConvexAuthProvider>
);
