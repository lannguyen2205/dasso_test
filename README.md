# DaSSO Test - Hướng Dẫn Triển Khai Monorepo & Multi-Pipeline CI/CD

Tài liệu hướng dẫn thiết lập và triển khai tự động độc lập 3 dịch vụ trong hệ thống DaSSO lên Cloud (**Railway** và **Vercel**), kết nối cơ sở dữ liệu **Supabase**, và cấu hình CI/CD tự động bằng **GitHub Actions**.

---

## 🏗️ Kiến Trúc Hệ Thống (Monorepo)

| Dịch vụ | Công nghệ | Nơi triển khai | Nhiệm vụ |
| :--- | :--- | :--- | :--- |
| **`keycloak/`** | Keycloak 26 Container (Docker) | **Railway** | Quản lý định danh SSO, kết nối Supabase PostgreSQL (Session Pooler port 5432). |
| **`server/`** | NestJS Backend Gateway (port 4000) | **Railway** | Bảo vệ Admin API, bọc dữ liệu chuẩn (`TransformInterceptor`, `AllExceptionsFilter`, `ResponseCodes`). |
| **`server-a/`** | NestJS Backend App A (port 4001) | **Railway** | Authentication API độc lập (Email OTP, Supabase schema `server_a`, JWT). |
| **`server-b/`** | NestJS Backend App B (port 4002) | **Railway** | Authentication API độc lập (Email OTP, Supabase schema `server_b`, JWT). |
| **`web-a/`** | Next.js App Router (Tailwind) — port 3001 | **Vercel** (`dasso-test`) | App A: giao diện đăng nhập kép (Server Email OTP + Keycloak SSO client `app-a`). |
| **`web-b/`** | Next.js App Router (Tailwind) — port 3002 | **Vercel** (`dasso-test-b`) | App B: giao diện đăng nhập kép (Server Email OTP + Keycloak SSO client `app-b`). |

---

## 📋 Hướng Dẫn Thiết Lập Từng Bước

### BƯỚC 1: Chuẩn bị Cơ sở dữ liệu trên Supabase
1. Đăng nhập [supabase.com](https://supabase.com) và tạo một Project mới.
2. Vào **Project Settings** $\rightarrow$ **Database** $\rightarrow$ cuộn xuống mục **Connection string** $\rightarrow$ chọn tab **URI** (chọn chế độ **Session Pooler**, port **5432**).
3. Lưu lại các thông tin: Host, Database Name, User, và Password của database để cấu hình cho Keycloak.

---

### BƯỚC 2: Triển khai `Keycloak` trên Railway
1. Đăng nhập [railway.app](https://railway.app) bằng tài khoản GitHub.
2. Bấm **New Project** $\rightarrow$ **Deploy from GitHub repo** $\rightarrow$ Chọn repo **`dasso_test`**.
3. Đổi tên service thành **`DaSSO-Keycloak`**.
4. Vào service vừa tạo để cấu hình:
   * **Settings** $\rightarrow$ mục **Branch**: Chọn nhánh **`deploy`**.
   * **Settings** $\rightarrow$ mục **Build**:
     * **Root Directory**: Nhập **`/keycloak`**
   * **Variables** $\rightarrow$ Bấm nút **Raw Editor** $\rightarrow$ Dán cấu hình kết nối Supabase của bạn:
     ```env
     KC_DB=postgres
     KC_DB_URL=jdbc:postgresql://<YOUR_SUPABASE_HOST>:5432/postgres?sslmode=require
     KC_DB_USERNAME=postgres.<YOUR_PROJECT_REF>
     KC_DB_PASSWORD=<YOUR_SUPABASE_PASSWORD>
     KC_BOOTSTRAP_ADMIN_USERNAME=admin
     KC_BOOTSTRAP_ADMIN_PASSWORD=admin
     KC_PROXY_HEADERS=xforwarded
     KC_HTTP_ENABLED=true
     KC_HOSTNAME_STRICT=false
     ```
   * **Settings** $\rightarrow$ mục **Networking**: Bấm **Generate Domain** $\rightarrow$ Chọn Port **`8080`**.
   * 👉 Copy lại Domain Keycloak vừa sinh ra (ví dụ: `https://dasso-keycloak-production.up.railway.app`).

---

### BƯỚC 3: Triển khai Backend Services (NestJS) trên Railway

Tạo các service tương ứng trên Railway (bấm **New** $\rightarrow$ **GitHub Repo** $\rightarrow$ chọn repo **`dasso_test`**):

#### 1. Backend Gateway `server/` (Service: `DaSSO-Server`)
* **Branch**: `deploy`
* **Root Directory**: `/server`
* **Variables**:
  ```env
  PORT=4000
  KEYCLOAK_URL=https://<domain_keycloak_o_buoc_2>
  ```
* **Networking**: Port `4000` $\rightarrow$ Generate Domain (ví dụ: `https://dasso-server-production.up.railway.app`).

#### 2. Backend App A `server-a/` (Service: `DaSSO-Server-A`)
* **Branch**: `deploy`
* **Root Directory**: `/server-a`
* **Variables**:
  ```env
  PORT=4001
  SUPABASE_DATABASE_URL=postgresql://postgres.<REF>:<PASS>@<HOST>:5432/postgres
  DB_SCHEMA=server_a
  JWT_SECRET=super_secret_jwt_key_a_2026
  GMAIL_USER=truongbmt4@gmail.com
  GMAIL_APP_PASSWORD=ewivyksqtuvangom
  CLIENT_ORIGIN=https://<domain_vercel_web_a>
  ```
* **Networking**: Port `4001` $\rightarrow$ Generate Domain (ví dụ: `https://dasso-server-a-production.up.railway.app`).

#### 3. Backend App B `server-b/` (Service: `DaSSO-Server-B`)
* **Branch**: `deploy`
* **Root Directory**: `/server-b`
* **Variables**:
  ```env
  PORT=4002
  SUPABASE_DATABASE_URL=postgresql://postgres.<REF>:<PASS>@<HOST>:5432/postgres
  DB_SCHEMA=server_b
  JWT_SECRET=super_secret_jwt_key_b_2026
  GMAIL_USER=truongbmt4@gmail.com
  GMAIL_APP_PASSWORD=ewivyksqtuvangom
  CLIENT_ORIGIN=https://<domain_vercel_web_b>
  ```
* **Networking**: Port `4002` $\rightarrow$ Generate Domain (ví dụ: `https://dasso-server-b-production.up.railway.app`).

---

### BƯỚC 4: Triển khai `web-a` và `web-b` (Next.js) trên Vercel
Mỗi app là **một Vercel project riêng**. Làm 2 lần theo bảng sau:

| | App A | App B |
| :-- | :-- | :-- |
| Project name | **`dasso-test`** | **`dasso-test-b`** |
| Root Directory | **`web-a`** | **`web-b`** |
| `NEXT_PUBLIC_OTHER_APP_URL` | `https://<domain_vercel_app_b>` | `https://<domain_vercel_app_a>` |

1. Đăng nhập [vercel.com](https://vercel.com) bằng tài khoản GitHub.
2. Bấm **Add New...** $\rightarrow$ **Project** $\rightarrow$ Import repo **`dasso_test`**.
3. Đặt tên Project theo bảng trên.
4. Cấu hình tại màn hình Import:
   * **Root Directory**: Bấm **Edit** $\rightarrow$ Chọn thư mục theo bảng trên $\rightarrow$ Bấm *Continue*.
   * **Environment Variables**:
     * `NEXT_PUBLIC_KEYCLOAK_URL` = `https://<domain_keycloak_o_buoc_2>`
     * `NEXT_PUBLIC_SERVER_URL` = `https://<domain_server_o_buoc_3>`
     * `NEXT_PUBLIC_OTHER_APP_URL` = theo bảng trên (domain của app còn lại)
     * *(Tuỳ chọn)* `NEXT_PUBLIC_KEYCLOAK_REALM` (mặc định `dasso`), `NEXT_PUBLIC_KEYCLOAK_CLIENT_ID` (mặc định `app-a` / `app-b`)
5. Bấm nút **Deploy**.
6. Trên Keycloak (realm `dasso`) $\rightarrow$ **Clients** $\rightarrow$ `app-a` / `app-b` $\rightarrow$ thêm `https://<domain_vercel_cua_app>/*` vào **Valid redirect URIs**.

> Nếu đặt tên project Vercel khác, khai báo ở GitHub **Settings → Secrets and variables → Actions → Variables**: `VERCEL_PROJECT_WEB_A`, `VERCEL_PROJECT_WEB_B`.

---

### BƯỚC 5: Kích hoạt GitHub Actions CI/CD Tự Động
Hệ thống sử dụng cơ chế Multi-Pipeline trên nhánh **`deploy`** với bộ lọc thư mục (`paths:`). Để kích hoạt triển khai tự động:

1. **Lấy Token trên Vercel**:
   * Vào [vercel.com/account/tokens](https://vercel.com/account/tokens).
   * Bấm **Create Token** $\rightarrow$ Đặt tên bất kỳ $\rightarrow$ Copy mã Token.
2. **Cấu hình trên GitHub**:
   * Mở: `https://github.com/<owner>/dasso_test/settings/secrets/actions`
   * Bấm **New repository secret**:
     * Name: **`VERCEL_TOKEN`**
     * Secret: *(Dán mã token vừa tạo ở trên)*

*(Lưu ý: Đối với Railway, khi repo được kết nối trực tiếp trên nhánh `deploy`, tính năng `Auto deploys when pushed to GitHub` của Railway sẽ tự động triển khai khi có commit mới mà không cần thêm token)*.

---

## 🎯 Cơ Chế Lọc Đường Dẫn Multi-Pipeline

* Sửa file trong `web-a/**` và/hoặc `web-b/**` $\rightarrow$ Chạy workflow `deploy-web.yml`, **chỉ deploy app có thay đổi** lên Vercel (chạy tay `workflow_dispatch` thì deploy cả 2).
* Sửa file trong `server/**`, `server-a/**` và/hoặc `server-b/**` $\rightarrow$ Chạy workflow `deploy-server.yml`, **chỉ deploy server có thay đổi** lên Railway (chạy tay `workflow_dispatch` thì deploy cả 3).
* Sửa file trong `keycloak/**` $\rightarrow$ Chỉ chạy workflow `deploy-keycloak.yml` (Railway).

---

## 🔐 Test SSO Local với `web-a` và `web-b`

### 1. Chạy Keycloak local (có sẵn realm `dasso`)
File [`keycloak/realm-dasso.json`](keycloak/realm-dasso.json) tạo realm `dasso`, 2 public client `app-a` (redirect `http://localhost:3001/*`) và `app-b` (redirect `http://localhost:3002/*`) dùng PKCE S256, cùng user test **`testuser` / `Test@123`**.

```bash
docker run -d --name kc-local -p 8080:8080 \
  -e KC_BOOTSTRAP_ADMIN_USERNAME=admin -e KC_BOOTSTRAP_ADMIN_PASSWORD=admin \
  -v "$PWD/keycloak/realm-dasso.json:/opt/keycloak/data/import/realm-dasso.json:ro" \
  quay.io/keycloak/keycloak:26.0 start-dev --import-realm
```

Với Keycloak trên Railway: Admin Console $\rightarrow$ **Create realm** $\rightarrow$ **Browse...** $\rightarrow$ chọn `realm-dasso.json` (nên đổi mật khẩu / xoá user test trước khi import lên môi trường public).

### 2. Chạy 2 app (mỗi app một terminal)
```bash
cd web-a && npm install && npm run dev   # http://localhost:3001
cd web-b && npm install && npm run dev   # http://localhost:3002
```
Hoặc bằng Docker: `docker compose up -d --build web-a web-b`.

Mặc định 2 app đã trỏ về `http://localhost:8080`, realm `dasso` — không cần file `.env` (xem `web-a/.env.example`, `web-b/.env.example` nếu muốn đổi).

### 3. Kịch bản test
1. Mở **App A** (`:3001`) $\rightarrow$ **Đăng nhập với Keycloak** $\rightarrow$ `testuser` / `Test@123`.
2. Bấm **Mở App B (test SSO)** $\rightarrow$ App B tự hiện đã đăng nhập, **không hỏi mật khẩu**; **Session ID** ở 2 app giống nhau.
3. Bấm **Đăng xuất (Single Logout)** ở một app $\rightarrow$ reload app còn lại cũng bị đăng xuất.

> App dùng `check-sso` (iframe ẩn) để tự nhận phiên SSO. Khi app và Keycloak khác domain (Vercel + Railway), trình duyệt có thể chặn third-party cookie $\rightarrow$ App B hiện nút login, nhưng bấm vào vẫn được SSO ngay không cần nhập lại mật khẩu.
