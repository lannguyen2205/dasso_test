"use client";

import type Keycloak from "keycloak-js";
import { useEffect, useState } from "react";
import { appConfig } from "@/app.config";
import { getKeycloak } from "@/lib/keycloak";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "anonymous"; kc: Keycloak }
  | { status: "authenticated"; kc: Keycloak };

export default function AuthPanel() {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    getKeycloak()
      .then(({ kc, authenticated }) => {
        kc.onTokenExpired = () => void kc.updateToken(30);
        setState({ status: authenticated ? "authenticated" : "anonymous", kc });
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : JSON.stringify(err ?? "unknown error");
        setState({ status: "error", message });
      });
  }, []);

  return (
    <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <span
        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${appConfig.accent.badge}`}
      >
        {appConfig.name}
      </span>

      {state.status === "loading" && <Loading />}
      {state.status === "error" && <ErrorView message={state.message} />}
      {state.status === "anonymous" && <LoginView kc={state.kc} />}
      {state.status === "authenticated" && <ProfileView kc={state.kc} />}
    </div>
  );
}

function Loading() {
  return (
    <div className="mt-6 flex items-center gap-3 text-sm text-zinc-500">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
      Đang kiểm tra phiên SSO…
    </div>
  );
}

function ErrorView({ message }: { message: string }) {
  return (
    <div className="mt-6 space-y-3">
      <h1 className="text-xl font-semibold">Không kết nối được Keycloak</h1>
      <p className="rounded-lg bg-red-50 p-3 font-mono text-xs break-all text-red-700 dark:bg-red-500/10 dark:text-red-300">
        {message}
      </p>
      <ConfigInfo />
      <button
        onClick={() => window.location.reload()}
        className="w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        Thử lại
      </button>
    </div>
  );
}

function LoginView({ kc }: { kc: Keycloak }) {
  return (
    <div className="mt-6">
      <h1 className="text-2xl font-semibold tracking-tight">Đăng nhập</h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        Đăng nhập một lần qua Keycloak, sau đó mở {appConfig.otherAppName} để thấy SSO hoạt động
        mà không cần nhập lại mật khẩu.
      </p>

      <button
        onClick={() => void kc.login({ redirectUri: window.location.origin + "/" })}
        className={`mt-8 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${appConfig.accent.button}`}
      >
        <KeyIcon />
        Đăng nhập với Keycloak
      </button>

      <div className="mt-8 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <ConfigInfo />
      </div>
    </div>
  );
}

function ProfileView({ kc }: { kc: Keycloak }) {
  const t = kc.tokenParsed ?? {};
  const name = (t.name as string | undefined) ?? (t.preferred_username as string | undefined) ?? "User";
  const roles = (t.realm_access?.roles ?? []).filter(
    (r) => !r.startsWith("default-roles") && r !== "offline_access" && r !== "uma_authorization",
  );
  const expiresAt = t.exp ? new Date(t.exp * 1000).toLocaleTimeString() : "—";

  return (
    <div className="mt-6">
      <div className="flex items-center gap-4">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-semibold ${appConfig.accent.badge}`}
        >
          {name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold">Xin chào, {name}</h1>
          <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">{t.email as string}</p>
        </div>
      </div>

      <dl className="mt-6 space-y-2 rounded-lg bg-zinc-50 p-4 text-sm dark:bg-zinc-800/50">
        <Row label="Username" value={t.preferred_username as string} />
        <Row label="User ID (sub)" value={t.sub} mono />
        <Row label="Client" value={t.azp as string} mono />
        <Row label="Session ID" value={t.sid as string} mono />
        <Row label="Roles" value={roles.length ? roles.join(", ") : "—"} />
        <Row label="Token hết hạn" value={expiresAt} />
      </dl>

      <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
        Session ID giống nhau ở cả 2 app nghĩa là chúng dùng chung một phiên SSO.
      </p>

      <div className="mt-6 flex flex-col gap-3">
        <a
          href={appConfig.otherAppUrl}
          target="_blank"
          rel="noreferrer"
          className={`flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors ${appConfig.accent.button}`}
        >
          Mở {appConfig.otherAppName} (test SSO) ↗
        </a>
        <button
          onClick={() => void kc.logout({ redirectUri: window.location.origin + "/" })}
          className="w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Đăng xuất (Single Logout)
        </button>
      </div>

      <details className="mt-6 text-sm">
        <summary className="cursor-pointer text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
          Xem access token (decoded)
        </summary>
        <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-zinc-950 p-3 text-xs text-zinc-100">
          {JSON.stringify(t, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className={`truncate text-right ${mono ? "font-mono text-xs leading-5" : ""}`} title={value}>
        {value || "—"}
      </dd>
    </div>
  );
}

function ConfigInfo() {
  const { url, realm, clientId } = appConfig.keycloak;
  return (
    <dl className="space-y-1 text-xs text-zinc-500 dark:text-zinc-400">
      <div className="flex justify-between gap-4">
        <dt>Keycloak</dt>
        <dd className="truncate font-mono">{url}</dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt>Realm / Client</dt>
        <dd className="font-mono">
          {realm} / {clientId}
        </dd>
      </div>
    </dl>
  );
}

function KeyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4" aria-hidden>
      <circle cx="7.5" cy="15.5" r="4.5" />
      <path d="M10.7 12.3 21 2m-4 4 3 3m-6 0 3 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
