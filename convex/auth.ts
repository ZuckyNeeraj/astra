import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";

// Email + password auth, backed entirely by Convex (the "simple DB" auth).
// Sign in / sign up from the client via useAuthActions().signIn("password", {...}).
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password],
});
