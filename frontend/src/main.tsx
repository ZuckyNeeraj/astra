import { createRoot } from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import App from "./app/App.tsx";
import { ConvexStatus } from "./app/components/ConvexStatus.tsx";
import "./styles/index.css";

// Connect to the shared Convex deployment (URL from frontend/.env.local).
const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

createRoot(document.getElementById("root")!).render(
  <ConvexProvider client={convex}>
    <App />
    <ConvexStatus />
  </ConvexProvider>
);
