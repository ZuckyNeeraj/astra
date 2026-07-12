export const DEMO_EMAIL = "zuckyneeraj@gmail.com";
export const DEMO_PASSWORD = "12345678";

const SITE_URL =
  (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, "") ??
  "https://astra-bac.pages.dev";

/** Scan this URL to open Astra and auto sign in with the demo account. */
export const DEMO_SIGNIN_URL = `${SITE_URL}/?demo=signin`;

export const DEMO_SIGNIN_STEPS = [
  "Open the link (or scan the QR code)",
  'Click "Sign in" if the form is not already open',
  `Email: ${DEMO_EMAIL}`,
  `Password: ${DEMO_PASSWORD}`,
  'Click "Sign in" to submit',
] as const;
