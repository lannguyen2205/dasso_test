/**
 * Application Default Configurations and Fallback Constants
 * Follows Bunny Cove Project Rule: Zero hard-coded paths or URLs in services/controllers.
 */
export const AppDefaults = {
  APP: {
    PORT: 4001,
    NAME: "DaSSO Backend A",
    SERVICE_ID: "server-a",
    DEFAULT_CLIENT_ORIGIN: "http://localhost:3001",
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
    CLIENT_ID: "app-a",
    ADMIN_CLIENT_ID: "dasso-admin-api",
    SET_PASSWORD_LINK_LIFESPAN_SECONDS: 43200, // 12 hours
  },
  AVATAR: {
    DEFAULT_AVATAR_URL: "https://api.dicebear.com/7.x/bottts/png?seed=dasso-a",
    getAvatarUrl(seed: string): string {
      return `https://api.dicebear.com/7.x/bottts/png?seed=${encodeURIComponent(seed)}`;
    },
  },
} as const;
