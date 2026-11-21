"use client";

import type Keycloak from "keycloak-js";
import { useEffect, useState } from "react";
import { appConfig } from "@/app.config";
import { getKeycloak } from "@/lib/keycloak";

interface ServerUser {
  id: string;
  email: string;
  displayName?: string;
  username?: string;
  isEmailVerified: boolean;
  roles?: string[];
}

type KeycloakUserState = {
  id: string;
  email: string;
  username?: string;
  displayName?: string;
  sid?: string;
  roles?: string[];
};

export default function AuthPanel() {
  // Keycloak SSO State
  const [kc, setKc] = useState<Keycloak | null>(null);
  const [kcUser, setKcUser] = useState<KeycloakUserState | null>(null);
  const [kcLoading, setKcLoading] = useState(true);
  const [kcError, setKcError] = useState<string | null>(null);

  // Server Auth State
  const [serverUser, setServerUser] = useState<ServerUser | null>(null);
  const [serverToken, setServerToken] = useState<string | null>(null);

  // Tab State: "login" | "register"
  const [tab, setTab] = useState<"login" | "register">("login");

  // Login Form
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Register Form
  const [regForm, setRegForm] = useState({ email: "", password: "", displayName: "" });
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);

  // OTP Verification
  const [verificationPending, setVerificationPending] = useState(false);
  const [verifyingEmail, setVerifyingEmail] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [hintOtp, setHintOtp] = useState<string | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Profile Test Output
  const [testMeOutput, setTestMeOutput] = useState<string | null>(null);
  const [testMeLoading, setTestMeLoading] = useState(false);

  // Mock SSO Integration Message
  const [mockSsoMessage, setMockSsoMessage] = useState<string | null>(null);

  // Initialize Keycloak SSO on mount
  useEffect(() => {
    let isMounted = true;
    getKeycloak()
      .then(({ kc: keycloakInstance, authenticated }) => {
        if (!isMounted) return;
        setKc(keycloakInstance);
        setKcLoading(false);

        keycloakInstance.onTokenExpired = () => void keycloakInstance.updateToken(30);

        if (authenticated && keycloakInstance.tokenParsed) {
          const t = keycloakInstance.tokenParsed as Record<string, unknown>;
          const realmAccess = t.realm_access as { roles?: string[] } | undefined;
          const realmRoles = (realmAccess?.roles ?? []).filter(
            (r: string) =>
              typeof r === "string" &&
              !r.startsWith("default-roles") &&
              r !== "offline_access" &&
              r !== "uma_authorization",
          );

          setKcUser({
            id: typeof t.sub === "string" && t.sub ? t.sub : "sso-user",
            email: typeof t.email === "string" && t.email ? t.email : "user@keycloak.local",
            username: typeof t.preferred_username === "string" ? t.preferred_username : "sso_user",
            displayName:
              (typeof t.name === "string" && t.name) ||
              (typeof t.preferred_username === "string" && t.preferred_username) ||
              "SSO User",
            sid: typeof t.sid === "string" ? t.sid : undefined,
            roles: realmRoles,
          });
        }
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        setKcLoading(false);
        const message = err instanceof Error ? err.message : "Chưa kết nối Keycloak";
        setKcError(message);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // 1. Đăng nhập tài khoản nội bộ (Server Auth)
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);

    try {
      const res = await fetch(`${appConfig.serverUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: loginForm.email.trim(),
          password: loginForm.password,
        }),
      });

      const body = await res.json();
      if (!res.ok || !body.success) {
        throw new Error(body.error?.message || "Đăng nhập không thành công");
      }

      setServerUser(body.data.user);
      setServerToken(body.data.tokens?.accessToken || null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lỗi kết nối Backend Server";
      setLoginError(msg);
    } finally {
      setLoginLoading(false);
    }
  }

  // 2. Đăng ký tài khoản nội bộ bằng Email
  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setRegLoading(true);
    setRegError(null);

    try {
      const res = await fetch(`${appConfig.serverUrl}/api/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: regForm.email.trim(),
          password: regForm.password,
          displayName: regForm.displayName.trim() || undefined,
        }),
      });

      const body = await res.json();
      if (!res.ok || !body.success) {
        throw new Error(body.error?.message || "Đăng ký không thành công");
      }

      setVerifyingEmail(regForm.email.trim());
      setHintOtp(body.data?.otpCode || null);
      setVerificationPending(true);
      setVerifyMessage({
        type: "success",
        text: "Mã xác thực OTP đã được gửi! Vui lòng nhập mã 6 số bên dưới để kích hoạt tài khoản.",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lỗi kết nối Backend Server";
      setRegError(msg);
    } finally {
      setRegLoading(false);
    }
  }

  // 3. Xác thực OTP Email
  async function handleVerifyEmail(e: React.FormEvent) {
    e.preventDefault();
    setVerifyLoading(true);
    setVerifyMessage(null);

    try {
      const res = await fetch(`${appConfig.serverUrl}/api/v1/auth/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: verifyingEmail,
          otp: otpInput.trim(),
        }),
      });

      const body = await res.json();
      if (!res.ok || !body.success) {
        throw new Error(body.error?.message || "Mã OTP không hợp lệ hoặc đã hết hạn");
      }

      setServerUser(body.data.user);
      setServerToken(body.data.tokens?.accessToken || null);
      setVerificationPending(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lỗi xác thực mã OTP";
      setVerifyMessage({ type: "error", text: msg });
    } finally {
      setVerifyLoading(false);
    }
  }

  // 4. Gửi lại mã OTP
  async function handleResendOtp() {
    setVerifyLoading(true);
    setVerifyMessage(null);

    try {
      const res = await fetch(`${appConfig.serverUrl}/api/v1/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: verifyingEmail }),
      });

      const body = await res.json();
      if (!res.ok || !body.success) {
        throw new Error(body.error?.message || "Không thể gửi lại mã OTP");
      }

      setHintOtp(body.data?.otpCode || null);
      setVerifyMessage({
        type: "success",
        text: "Mã OTP mới đã được gửi lại vào email của bạn!",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lỗi khi gửi lại OTP";
      setVerifyMessage({ type: "error", text: msg });
    } finally {
      setVerifyLoading(false);
    }
  }

  // 5. Test API Protected: GET /api/v1/auth/me
  async function handleTestProfile() {
    if (!serverToken) return;
    setTestMeLoading(true);
    setTestMeOutput(null);

    try {
      const res = await fetch(`${appConfig.serverUrl}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${serverToken}` },
      });
      const body = await res.json();
      setTestMeOutput(JSON.stringify(body, null, 2));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lỗi gọi API";
      setTestMeOutput(`Error: ${msg}`);
    } finally {
      setTestMeLoading(false);
    }
  }

  // 6. Đăng xuất Server Riêng
  async function handleServerLogout() {
    if (serverToken) {
      try {
        await fetch(`${appConfig.serverUrl}/api/v1/auth/logout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serverToken}`,
          },
        });
      } catch {
        // Ignore logout network error
      }
    }
    setServerUser(null);
    setServerToken(null);
    setTestMeOutput(null);
  }

  // 7. Đăng nhập qua Keycloak SSO
  function handleKeycloakLogin() {
    if (kc) {
      void kc.login({ redirectUri: window.location.origin + "/" });
    }
  }

  // 8. Đăng xuất Keycloak SSO
  function handleKeycloakLogout() {
    if (kc) {
      void kc.logout({ redirectUri: window.location.origin + "/" });
    }
  }

  // ==========================================
  // VIEW 1: ĐÃ ĐĂNG NHẬP QUA KEYCLOAK SSO
  // ==========================================
  if (kcUser) {
    return (
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-4 dark:border-zinc-800">
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${appConfig.accent.badge}`}>
            {appConfig.name} - Keycloak SSO
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Đã đăng nhập qua SSO
          </span>
        </div>

        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            Xin chào, {kcUser.displayName || kcUser.username}!
          </h2>
          <p className="text-xs text-zinc-500 font-mono mt-1">{kcUser.email}</p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 space-y-2 text-xs font-mono dark:border-zinc-800 dark:bg-zinc-950/40">
          <div className="flex justify-between">
            <span className="text-zinc-500">Session ID:</span>
            <span className="text-zinc-800 dark:text-zinc-200">{kcUser.sid || "N/A"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Realm Roles:</span>
            <span className="text-zinc-800 dark:text-zinc-200 font-semibold">
              {kcUser.roles?.length ? kcUser.roles.join(", ") : "none"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Realm:</span>
            <span className="text-zinc-800 dark:text-zinc-200">{appConfig.keycloak.realm}</span>
          </div>
        </div>

        {/* Nút Tích hợp đăng nhập Keycloak SSO (Nút Mock hiển thị UI) */}
        <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
          <button
            type="button"
            onClick={() => {
              setMockSsoMessage("✓ Yêu cầu tích hợp Keycloak SSO đã được kích hoạt (Mock Demo)");
            }}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs font-semibold text-emerald-600 hover:bg-emerald-500/20 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-300 dark:hover:bg-emerald-400/20 transition-all"
          >
            <span className="text-base">🔑</span>
            <span>Tích hợp đăng nhập Keycloak SSO</span>
          </button>
          {mockSsoMessage && (
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2 text-center text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              {mockSsoMessage}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <a
            href={appConfig.otherAppUrl}
            target="_blank"
            rel="noreferrer"
            className="flex-1 text-center rounded-lg border border-zinc-300 px-4 py-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 transition-colors"
          >
            Mở {appConfig.otherAppName} (Test SSO) ↗
          </a>
          <button
            type="button"
            onClick={handleKeycloakLogout}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-red-700 transition-colors"
          >
            Đăng xuất SSO
          </button>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 2: ĐÃ ĐĂNG NHẬP QUA SERVER NỘI BỘ
  // ==========================================
  if (serverUser) {
    return (
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-4 dark:border-zinc-800">
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${appConfig.accent.badge}`}>
            {appConfig.name} - Tài khoản nội bộ
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Đã xác thực Email
          </span>
        </div>

        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            Xin chào, {serverUser.displayName || serverUser.username || serverUser.email}!
          </h2>
          <p className="text-xs text-zinc-500 font-mono mt-1">{serverUser.email}</p>
        </div>

        {/* User Details */}
        <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 space-y-2 text-xs font-mono dark:border-zinc-800 dark:bg-zinc-950/40">
          <div className="flex justify-between">
            <span className="text-zinc-500">ID:</span>
            <span className="text-zinc-800 dark:text-zinc-200">{serverUser.id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Email:</span>
            <span className="text-zinc-800 dark:text-zinc-200 font-semibold">{serverUser.email}</span>
          </div>
          {serverUser.displayName && (
            <div className="flex justify-between">
              <span className="text-zinc-500">Display Name:</span>
              <span className="text-zinc-800 dark:text-zinc-200">{serverUser.displayName}</span>
            </div>
          )}
          {serverUser.roles && serverUser.roles.length > 0 && (
            <div className="flex justify-between">
              <span className="text-zinc-500">Roles:</span>
              <span className="text-zinc-800 dark:text-zinc-200">{serverUser.roles.join(", ")}</span>
            </div>
          )}
        </div>

        {/* Token Preview */}
        {serverToken && (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                JWT Access Token
              </span>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(serverToken)}
                className="text-xs text-indigo-600 hover:underline dark:text-indigo-400 font-medium"
              >
                Sao chép Token
              </button>
            </div>
            <p className="font-mono text-xs text-zinc-500 break-all line-clamp-2">
              {serverToken}
            </p>
          </div>
        )}

        {/* Test Profile API */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleTestProfile}
            disabled={testMeLoading}
            className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700/60 transition-colors"
          >
            {testMeLoading ? "Đang gọi…" : "🔍 Test API Protected: GET /api/v1/auth/me"}
          </button>

          {testMeOutput && (
            <pre className="max-h-48 overflow-auto rounded-lg bg-zinc-900 p-3 font-mono text-[11px] text-emerald-400">
              {testMeOutput}
            </pre>
          )}
        </div>

        {/* Nút Tích hợp đăng nhập Keycloak SSO (Nút Mock hiển thị UI) */}
        <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
          <button
            type="button"
            onClick={() => {
              setMockSsoMessage("✓ Yêu cầu tích hợp Keycloak SSO đã được kích hoạt (Mock Demo)");
            }}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs font-semibold text-emerald-600 hover:bg-emerald-500/20 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-300 dark:hover:bg-emerald-400/20 transition-all"
          >
            <span className="text-base">🔑</span>
            <span>Tích hợp đăng nhập Keycloak SSO</span>
          </button>
          {mockSsoMessage && (
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2 text-center text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              {mockSsoMessage}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-1">
          <a
            href={appConfig.otherAppUrl}
            target="_blank"
            rel="noreferrer"
            className="flex-1 text-center rounded-lg border border-zinc-300 px-4 py-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 transition-colors"
          >
            Mở {appConfig.otherAppName} ↗
          </a>
          <button
            type="button"
            onClick={handleServerLogout}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-red-700 transition-colors"
          >
            Đăng xuất
          </button>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 3: CHƯA ĐĂNG NHẬP (FORM LOGIN/REGISTER + NÚT SSO PHÍA DƯỚI)
  // ==========================================
  return (
    <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-100 pb-4 dark:border-zinc-800">
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${appConfig.accent.badge}`}>
          {appConfig.name}
        </span>
        <span className="text-xs font-mono text-zinc-400">
          API: {appConfig.serverUrl}
        </span>
      </div>

      {verificationPending ? (
        /* MÀN HÌNH NHẬP MÃ OTP */
        <div className="mt-6 space-y-4">
          <div className="rounded-xl bg-indigo-50/70 p-4 border border-indigo-100 dark:border-indigo-900/50 dark:bg-indigo-950/20">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Xác thực Email
            </h2>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              Mã OTP 6 số đã được gửi tới:{" "}
              <strong className="text-indigo-600 dark:text-indigo-400 font-mono">
                {verifyingEmail}
              </strong>
            </p>

            {hintOtp && (
              <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1.5 border border-emerald-200 text-xs text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-300">
                <span>Mã OTP test:</span>
                <strong className="font-mono text-sm tracking-wider">{hintOtp}</strong>
              </div>
            )}
          </div>

          {verifyMessage && (
            <div
              className={`rounded-lg p-3 text-xs ${verifyMessage.type === "success"
                ? "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300"
                : "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300"
                }`}
            >
              {verifyMessage.text}
            </div>
          )}

          <form onSubmit={handleVerifyEmail} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Nhập mã 6 chữ số
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                className="w-full text-center tracking-widest text-lg font-mono rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={verifyLoading || otpInput.length !== 6}
              className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors ${appConfig.accent.button} disabled:opacity-50`}
            >
              {verifyLoading ? "Đang xác thực…" : "Kích hoạt & Đăng nhập"}
            </button>
          </form>

          <div className="flex items-center justify-between pt-2 text-xs">
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={verifyLoading}
              className="text-indigo-600 hover:underline dark:text-indigo-400 font-medium"
            >
              Gửi lại mã OTP
            </button>
            <button
              type="button"
              onClick={() => setVerificationPending(false)}
              className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400"
            >
              Quay lại form
            </button>
          </div>
        </div>
      ) : (
        /* MÀN HÌNH ĐĂNG NHẬP / ĐĂNG KÝ CHÍNH */
        <div className="mt-6">
          {/* Sub-tabs: Đăng nhập vs Đăng ký */}
          <div className="flex border-b border-zinc-200 dark:border-zinc-800 mb-6">
            <button
              type="button"
              onClick={() => {
                setTab("login");
                setLoginError(null);
              }}
              className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors ${tab === "login"
                ? `${appConfig.accent.border} ${appConfig.accent.text}`
                : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400"
                }`}
            >
              Đăng nhập
            </button>
            <button
              type="button"
              onClick={() => {
                setTab("register");
                setRegError(null);
              }}
              className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors ${tab === "register"
                ? `${appConfig.accent.border} ${appConfig.accent.text}`
                : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400"
                }`}
            >
              Đăng ký Email (OTP)
            </button>
          </div>

          {/* TAB 1: FORM ĐĂNG NHẬP NỘI BỘ */}
          {tab === "login" && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                  Đăng nhập {appConfig.name}
                </h1>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Nhập tài khoản email nội bộ của {appConfig.name} để tiếp tục.
                </p>
              </div>

              {loginError && (
                <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-300">
                  {loginError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={loginForm.email}
                  onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                  placeholder="name@example.com"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Mật khẩu
                </label>
                <input
                  type="password"
                  required
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={loginLoading}
                className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors ${appConfig.accent.button} disabled:opacity-50`}
              >
                {loginLoading ? "Đang xử lý…" : "Đăng nhập nội bộ"}
              </button>
            </form>
          )}

          {/* TAB 2: FORM ĐĂNG KÝ TÀI KHOẢN */}
          {tab === "register" && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                  Đăng ký tài khoản {appConfig.name}
                </h1>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Hệ thống sẽ gửi mã OTP 6 chữ số về email để kích hoạt.
                </p>
              </div>

              {regError && (
                <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-300">
                  {regError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Tên hiển thị
                </label>
                <input
                  type="text"
                  value={regForm.displayName}
                  onChange={(e) => setRegForm({ ...regForm, displayName: e.target.value })}
                  placeholder="Nguyễn Văn A"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={regForm.email}
                  onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                  placeholder="name@example.com"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Mật khẩu
                </label>
                <input
                  type="password"
                  required
                  value={regForm.password}
                  onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                  placeholder="Tối thiểu 6 ký tự"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={regLoading}
                className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors ${appConfig.accent.button} disabled:opacity-50`}
              >
                {regLoading ? "Đang gửi OTP…" : "Gửi mã OTP kích hoạt"}
              </button>
            </form>
          )}

          {/* DIVIDER: PHƯƠNG THỨC KHÁC */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-200 dark:border-zinc-800" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-3 font-medium text-zinc-400 dark:bg-zinc-900 dark:text-zinc-500">
                Hoặc phương thức khác
              </span>
            </div>
          </div>

          {/* NÚT ĐĂNG NHẬP SSO PHÍA DƯỚI (NHƯ 1 PHƯƠNG THỨC KHÁC) */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleKeycloakLogin}
              disabled={!kc || kcLoading}
              className="w-full flex items-center justify-center gap-2.5 rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-800 shadow-sm transition-all hover:bg-zinc-50 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800/90 dark:text-zinc-100 dark:hover:bg-zinc-700/80 disabled:opacity-50"
            >
              <span className="text-base">🔑</span>
              <span>Đăng nhập bằng DaSSO (Keycloak SSO)</span>
            </button>

            {kcError && (
              <p className="text-center text-[11px] text-amber-600 dark:text-amber-400 font-mono">
                Keycloak Server chưa sẵn sàng: {kcError}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
