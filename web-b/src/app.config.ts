// Per-app settings. App A has the same file with its own values.
export const appConfig = {
  name: "App B",
  otherAppName: "App A",
  // Tailwind classes for this app's accent color
  accent: {
    button: "bg-emerald-600 hover:bg-emerald-500 focus-visible:outline-emerald-600",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    ring: "ring-emerald-600/20",
    border: "border-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  keycloak: {
    url: process.env.NEXT_PUBLIC_KEYCLOAK_URL ?? "http://localhost:8080",
    realm: process.env.NEXT_PUBLIC_KEYCLOAK_REALM ?? "dasso",
    clientId: process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID ?? "app-b",
  },
  serverUrl:
    process.env.NEXT_PUBLIC_SERVER_B_URL ??
    process.env.NEXT_PUBLIC_SERVER_URL ??
    "http://localhost:4002",
  otherAppUrl: process.env.NEXT_PUBLIC_OTHER_APP_URL ?? "http://localhost:3001",
};
