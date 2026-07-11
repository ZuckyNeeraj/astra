import { httpRouter } from "convex/server";
import { auth } from "./auth";

const http = httpRouter();

// Registers the auth endpoints (/api/auth/*) Convex Auth needs.
auth.addHttpRoutes(http);

export default http;
