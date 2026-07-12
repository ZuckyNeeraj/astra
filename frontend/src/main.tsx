import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import { ConvexReactClient, Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import App from "./app/App.tsx";
import { ConvexStatus } from "./app/components/ConvexStatus.tsx";
import { LandingPage } from "./app/components/LandingPage.tsx";
import { QrDemoPage } from "./app/components/QrDemoPage.tsx";
import "./styles/index.css";

// Connect to the shared Convex deployment (URL from frontend/.env.local).
const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

function MainApp() {
  return (
    <>
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
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <ConvexAuthProvider client={convex}>
    <BrowserRouter>
      <Routes>
        <Route path="/qr" element={<QrDemoPage />} />
        <Route path="*" element={<MainApp />} />
      </Routes>
    </BrowserRouter>
  </ConvexAuthProvider>
);
