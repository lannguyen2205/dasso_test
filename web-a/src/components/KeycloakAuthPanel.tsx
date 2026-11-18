"use client";

import type Keycloak from "keycloak-js";
import { useEffect, useState } from "react";
import { appConfig } from "@/app.config";
import { getKeycloak } from "@/lib/keycloak";

type KeycloakState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "anonymous"; kc: Keycloak }
  | {
      status: "authenticated";
      kc: Keycloak;
      user: {
        id: string;
        email: string;
        username?: string;
        displayName?: string;
        avatarUrl?: string;
        sub?: string;
        sid?: string;
        roles?: string[];
      };
      token: string;
    };

export default function KeycloakAuthPanel() {
  const [state, setState] = useState<KeycloakState>({ status: "loading" });

  useEffect(() => {
    getKeycloak()
      .then(({ kc, authenticated }) => {
        kc.onTokenExpired = () => void kc.updateToken(30);

        if (authenticated && kc.tokenParsed) {
          const t = kc.tokenParsed as Record<string, unknown>;
          const realmAccess = t.realm_access as { roles?: string[] } | undefined;
          const realmRoles = (realmAccess?.roles ?? []).filter(
            (r: string) =>
              typeof r === "string" &&
              !r.startsWith("default-roles") &&
              r !== "offline_access" &&
              r !== "uma_authorization",
          );

          setState({
            status: "authenticated",
            kc,
            token: kc.token || "",
            user: {
              id: typeof t.sub === "string" && t.sub ? t.sub : "sso-user",
              sub: typeof t.sub === "string" ? t.sub : undefined,
              email: typeof t.email === "string" && t.email ? t.email : "user@keycloak.local",
              username: typeof t.preferred_username === "string" ? t.preferred_username : "sso_user",
              displayName:
                (typeof t.name === "string" && t.name) ||
                (typeof t.preferred_username === "string" && t.preferred_username) ||
                "SSO User",
              sid: typeof t.sid === "string" ? t.sid : undefined,
              roles: realmRoles,
            },
          });
        } else {
          setState({ status: "anonymous", kc });
        }
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Không thể kết nối đến Keycloak";
        setState({ status: "error", message });
      });
  }, []);

  if (state.status === "loading") {
    return (
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mx-auto" />
        <p className="mt-3 text-xs text-zinc-500">Đang khởi tạo Keycloak SSO…</p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-4 dark:border-zinc-800">
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${appConfig.accent.badge}`}>
            {appConfig.name} - Keycloak SSO
          </span>
          <span className="text-xs font-mono text-zinc-400">Server: {appConfig.keycloak.url}</span>
        </div>
        <div className="mt-6 rounded-xl bg-amber-50 p-4 border border-amber-200 text-xs text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300">
          <p className="font-semibold mb-1">Chưa kết nối được Keycloak Server</p>
          <p className="font-mono text-[11px] break-all">{state.message}</p>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="flex-1 rounded-lg border border-zinc-300 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200"
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  if (state.status === "authenticated") {
    return (
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-4 dark:border-zinc-800">
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${appConfig.accent.badge}`}>
            {appConfig.name} - Keycloak SSO
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Keycloak Authenticated
          </span>
        </div>

        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            Xin chào, {state.user.displayName || state.user.username}!
          </h2>
          <p className="text-xs text-zinc-500 font-mono mt-1">{state.user.email}</p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 space-y-2 text-xs font-mono dark:border-zinc-800 dark:bg-zinc-950/40">
          <div className="flex justify-between">
            <span className="text-zinc-500">Session ID:</span>
            <span className="text-zinc-800 dark:text-zinc-200">{state.user.sid || "N/A"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Roles:</span>
            <span className="text-zinc-800 dark:text-zinc-200">
              {state.user.roles?.length ? state.user.roles.join(", ") : "none"}
            </span>
          </div>
        </div>

        <div className="flex gap-3">
          <a
            href={appConfig.otherAppUrl}
            target="_blank"
            rel="noreferrer"
            className="flex-1 text-center rounded-lg border border-zinc-300 px-4 py-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300"
          >
            Mở {appConfig.otherAppName} (Test SSO) ↗
          </a>
          <button
            type="button"
            onClick={() => void state.kc.logout({ redirectUri: window.location.origin + "/" })}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-red-700"
          >
            Đăng xuất SSO
          </button>
        </div>
      </div>
    );
  }

  // Anonymous state
  return (
    <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-100 pb-4 dark:border-zinc-800">
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${appConfig.accent.badge}`}>
          {appConfig.name} - Keycloak SSO
        </span>
        <span className="text-xs font-mono text-zinc-400">Realm: {appConfig.keycloak.realm}</span>
      </div>

      <div className="mt-6 text-center space-y-4">
        <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          Đăng nhập bằng Keycloak SSO
        </h1>
        <p className="text-xs text-zinc-500 max-w-sm mx-auto dark:text-zinc-400">
          Hệ thống xác thực SSO dùng chung cho toàn bộ App A và App B thông qua Keycloak Server.
        </p>

        <button
          type="button"
          onClick={() => void state.kc.login({ redirectUri: window.location.origin + "/" })}
          className={`w-full rounded-lg px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors ${appConfig.accent.button}`}
        >
          Đăng nhập với Keycloak
        </button>
      </div>
    </div>
  );
}
