/**
 * Application Default Configurations and Fallback Constants
 * Follows Bunny Cove Project Rule: Zero hard-coded paths or URLs in services/controllers.
 */
export const AppDefaults = {
  APP: {
    PORT: 4002,
    NAME: "DaSSO Backend B",
    SERVICE_ID: "server-b",
    DEFAULT_CLIENT_ORIGIN: "http://localhost:3002",
  },
  AUTH: {
    OTP_TTL_SECONDS: 300, // 5 minutes validity
    MAX_OTP_ATTEMPTS: 5,
    generateOtp(): string {
      return Math.floor(100000 + Math.random() * 900000).toString();
    },
  },
  KEYCLOAK: {
    URL: "http://localhost:8080",
    REALM: "dasso",
    CLIENT_ID: "app-b",
  },
  AVATAR: {
    DEFAULT_AVATAR_URL: "https://api.dicebear.com/7.x/bottts/png?seed=dasso-b",
    getAvatarUrl(seed: string): string {
      return `https://api.dicebear.com/7.x/bottts/png?seed=${encodeURIComponent(seed)}`;
    },
  },
} as const;
