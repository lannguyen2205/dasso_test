"use client";

import { useState } from "react";
import ServerAuthPanel from "./ServerAuthPanel";
import KeycloakAuthPanel from "./KeycloakAuthPanel";

export default function AuthPanel() {
  const [authMode, setAuthMode] = useState<"server" | "keycloak">("server");

  return (
    <div className="w-full max-w-lg space-y-4">
      {/* Switcher: Chọn giữa Server Riêng (Mới) và Keycloak SSO (Cũ) */}
      <div className="flex rounded-xl bg-zinc-200/80 p-1 dark:bg-zinc-800">
        <button
          type="button"
          onClick={() => setAuthMode("server")}
          className={`flex-1 rounded-lg py-2.5 text-xs font-semibold transition-all ${
            authMode === "server"
              ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-100"
              : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          ⚡ Đăng nhập Server Riêng (Email & OTP)
        </button>
        <button
          type="button"
          onClick={() => setAuthMode("keycloak")}
          className={`flex-1 rounded-lg py-2.5 text-xs font-semibold transition-all ${
            authMode === "keycloak"
              ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-100"
              : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          🔑 Keycloak SSO (Hệ thống cũ)
        </button>
      </div>

      {/* Render Component tương ứng */}
      {authMode === "server" ? <ServerAuthPanel /> : <KeycloakAuthPanel />}
    </div>
  );
}
