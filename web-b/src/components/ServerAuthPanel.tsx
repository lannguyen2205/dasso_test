"use client";

import { useState } from "react";
import { appConfig } from "@/app.config";

interface ServerUser {
  id: string;
  email: string;
  displayName?: string;
  username?: string;
  isEmailVerified: boolean;
  roles?: string[];
}

export default function ServerAuthPanel() {
  const [user, setUser] = useState<ServerUser | null>(null);
  const [token, setToken] = useState<string | null>(null);

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

  // 1. Đăng ký tài khoản mới bằng Email
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

  // 2. Xác thực OTP Email
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

      if (body.data?.tokens?.accessToken) {
        setToken(body.data.tokens.accessToken);
        setUser(body.data.user);
      } else if (body.data?.user) {
        setUser(body.data.user);
      }

      setVerificationPending(false);
      setOtpInput("");
      setHintOtp(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Xác thực thất bại";
      setVerifyMessage({ type: "error", text: msg });
    } finally {
      setVerifyLoading(false);
    }
  }

  // 3. Gửi lại mã OTP
  async function handleResendOtp() {
    setVerifyLoading(true);
    try {
      const res = await fetch(`${appConfig.serverUrl}/api/v1/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: verifyingEmail }),
      });
      const body = await res.json();
      if (body.success) {
        setHintOtp(body.data?.otpCode || null);
        setVerifyMessage({ type: "success", text: "Đã gửi lại mã OTP mới vào hòm thư!" });
      }
    } catch {
      setVerifyMessage({ type: "error", text: "Không thể gửi lại mã OTP" });
    } finally {
      setVerifyLoading(false);
    }
  }

  // 4. Đăng nhập Email + Mật khẩu
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
        if (body.code === "email_not_verified") {
          setVerifyingEmail(loginForm.email.trim());
          setVerificationPending(true);
          setVerifyMessage({
            type: "error",
            text: "Email này chưa được xác thực. Vui lòng nhập mã OTP để tiếp tục.",
          });
          return;
        }
        throw new Error(body.error?.message || "Đăng nhập không thành công");
      }

      setToken(body.data.tokens.accessToken);
      setUser(body.data.user);
      setLoginForm({ email: "", password: "" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lỗi đăng nhập";
      setLoginError(msg);
    } finally {
      setLoginLoading(false);
    }
  }

  // 5. Test Endpoint bảo vệ: GET /api/v1/auth/me
  async function handleTestProfile() {
    if (!token) return;
    setTestMeLoading(true);
    try {
      const res = await fetch(`${appConfig.serverUrl}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
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

  // 6. Đăng xuất
  async function handleLogout() {
    try {
      await fetch(`${appConfig.serverUrl}/api/v1/auth/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      }).catch(() => {});
    } finally {
      setUser(null);
      setToken(null);
      setTestMeOutput(null);
    }
  }

  return (
    <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      {/* Header Info */}
      <div className="flex items-center justify-between border-b border-zinc-100 pb-4 dark:border-zinc-800">
        <div>
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${appConfig.accent.badge}`}>
            {appConfig.name} - Backend Riêng
          </span>
        </div>
        <span className="text-xs font-mono text-zinc-400">API: {appConfig.serverUrl}</span>
      </div>

      {/* MÀN HÌNH ĐÃ ĐĂNG NHẬP */}
      {user ? (
        <div className="mt-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              Xin chào, {user.displayName || user.username || user.email}!
            </h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Đã xác thực Email
            </span>
          </div>

          {/* User Details */}
          <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 space-y-2 text-xs font-mono dark:border-zinc-800 dark:bg-zinc-950/40">
            <div className="flex justify-between">
              <span className="text-zinc-500">ID:</span>
              <span className="text-zinc-800 dark:text-zinc-200">{user.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Email:</span>
              <span className="text-zinc-800 dark:text-zinc-200 font-semibold">{user.email}</span>
            </div>
            {user.displayName && (
              <div className="flex justify-between">
                <span className="text-zinc-500">Display Name:</span>
                <span className="text-zinc-800 dark:text-zinc-200">{user.displayName}</span>
              </div>
            )}
            {user.roles && user.roles.length > 0 && (
              <div className="flex justify-between">
                <span className="text-zinc-500">Roles:</span>
                <span className="text-zinc-800 dark:text-zinc-200">{user.roles.join(", ")}</span>
              </div>
            )}
          </div>

          {/* Token Preview */}
          {token && (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  JWT Access Token
                </span>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(token)}
                  className="text-xs text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  Sao chép Token
                </button>
              </div>
              <p className="font-mono text-xs text-zinc-500 break-all line-clamp-2">
                {token}
              </p>
            </div>
          )}

          {/* Test Profile API */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleTestProfile}
              disabled={testMeLoading}
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700/60"
            >
              {testMeLoading ? "Đang gọi..." : "🔍 Test API Protected: GET /api/v1/auth/me"}
            </button>

            {testMeOutput && (
              <pre className="max-h-48 overflow-auto rounded-lg bg-zinc-900 p-3 font-mono text-[11px] text-emerald-400">
                {testMeOutput}
              </pre>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <a
              href={appConfig.otherAppUrl}
              target="_blank"
              rel="noreferrer"
              className="flex-1 text-center rounded-lg border border-zinc-300 px-4 py-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300"
            >
              Mở {appConfig.otherAppName} ↗
            </a>
            <button
              type="button"
              onClick={handleLogout}
              className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-red-700 transition-colors"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      ) : verificationPending ? (
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
                <span>Mã OTP test nhanh:</span>
                <strong className="font-mono text-sm tracking-wider">{hintOtp}</strong>
              </div>
            )}
          </div>

          {verifyMessage && (
            <div
              className={`rounded-lg p-3 text-xs ${
                verifyMessage.type === "success"
                  ? "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300"
                  : "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300"
              }`}
            >
              {verifyMessage.text}
            </div>
          )}

          <form onSubmit={handleVerifyEmail} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Nhập mã OTP 6 số
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
              Quay lại
            </button>
          </div>
        </div>
      ) : (
        /* MÀN HÌNH ĐĂNG NHẬP / ĐĂNG KÝ */
        <div className="mt-6">
          {/* Tabs switch */}
          <div className="flex border-b border-zinc-200 dark:border-zinc-800 mb-6">
            <button
              type="button"
              onClick={() => {
                setTab("login");
                setLoginError(null);
              }}
              className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                tab === "login"
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
              className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                tab === "register"
                  ? `${appConfig.accent.border} ${appConfig.accent.text}`
                  : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400"
              }`}
            >
              Đăng ký Email (OTP)
            </button>
          </div>

          {/* TAB 1: ĐĂNG NHẬP */}
          {tab === "login" && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <h1 className="text-lg font-semibold tracking-tight">Đăng nhập tài khoản nội bộ</h1>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Sử dụng email và mật khẩu của {appConfig.name} (chạy qua {appConfig.serverUrl}).
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
                {loginLoading ? "Đang xử lý…" : "Đăng nhập vào Server"}
              </button>
            </form>
          )}

          {/* TAB 2: ĐĂNG KÝ BẰNG EMAIL */}
          {tab === "register" && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <h1 className="text-lg font-semibold tracking-tight">Đăng ký tài khoản mới</h1>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Đăng ký bằng email thật hoặc email test. Hệ thống sẽ gửi mã OTP 6 số để xác thực.
                </p>
              </div>

              {regError && (
                <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-300">
                  {regError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Tên hiển thị (Display Name)
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
                  Mật khẩu (ít nhất 6 ký tự)
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={regForm.password}
                  onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={regLoading}
                className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors ${appConfig.accent.button} disabled:opacity-50`}
              >
                {regLoading ? "Đang gửi mã OTP..." : "Đăng ký & Nhận mã OTP"}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
