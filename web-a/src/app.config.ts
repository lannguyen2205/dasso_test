// Per-app settings. App B has the same file with its own values.
export const appConfig = {
  name: "App A",
  otherAppName: "App B",
  // Tailwind classes for this app's accent color
  accent: {
    button: "bg-indigo-600 hover:bg-indigo-500 focus-visible:outline-indigo-600",
    badge: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
    ring: "ring-indigo-600/20",
    border: "border-indigo-500",
    text: "text-indigo-600 dark:text-indigo-400",
  },
  keycloak: {
    url: process.env.NEXT_PUBLIC_KEYCLOAK_URL ?? "http://localhost:8080",
    realm: process.env.NEXT_PUBLIC_KEYCLOAK_REALM ?? "dasso",
    clientId: process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID ?? "app-a",
  },
  serverUrl:
    process.env.NEXT_PUBLIC_SERVER_A_URL ??
    process.env.NEXT_PUBLIC_SERVER_URL ??
    "http://localhost:4001",
  otherAppUrl: process.env.NEXT_PUBLIC_OTHER_APP_URL ?? "http://localhost:3002",
};
