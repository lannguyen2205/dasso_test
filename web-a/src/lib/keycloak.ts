import type Keycloak from "keycloak-js";
import { appConfig } from "@/app.config";

type KeycloakSession = { kc: Keycloak; authenticated: boolean };

// keycloak-js throws if init() is called twice on one instance, and React StrictMode
// runs effects twice in dev. The promise is assigned synchronously on the first call,
// so concurrent callers share the same (single, initialized) instance.
let sessionPromise: Promise<KeycloakSession> | null = null;

export function getKeycloak(): Promise<KeycloakSession> {
  sessionPromise ??= (async () => {
    const { default: KeycloakCtor } = await import("keycloak-js");
    const kc = new KeycloakCtor(appConfig.keycloak);
    const authenticated = await kc.init({
      // Silently checks whether a Keycloak SSO session already exists
      // (e.g. you logged in on the other app) without showing the login page.
      onLoad: "check-sso",
      silentCheckSsoRedirectUri: `${window.location.origin}/silent-check-sso.html`,
      silentCheckSsoFallback: false,
      pkceMethod: "S256",
      // The session iframe needs third-party cookies; not needed for this test.
      checkLoginIframe: false,
    });
    return { kc, authenticated };
  })().catch((err: unknown) => {
    sessionPromise = null; // allow a retry after a failure
    throw err;
  });
  return sessionPromise;
}
