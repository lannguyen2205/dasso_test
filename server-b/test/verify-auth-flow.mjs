/**
 * Verification test script for DaSSO Server A authentication & user management flows.
 * Run with: node test/verify-auth-flow.mjs
 */

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:4002';

async function runTests() {
  console.log(`\n=============================================`);
  console.log(`🧪 Verifying DaSSO Server B API Flow on ${BASE_URL}`);
  console.log(`=============================================\n`);

  let passed = 0;
  let failed = 0;

  async function check(name, fn) {
    try {
      process.stdout.write(`👉 ${name}... `);
      await fn();
      console.log(`✅ PASSED`);
      passed++;
    } catch (err) {
      console.log(`❌ FAILED: ${err.message}`);
      failed++;
    }
  }

  // 1. Health check
  await check('GET /health returns healthy status envelope', async () => {
    const res = await fetch(`${BASE_URL}/health`);
    if (!res.ok) throw new Error(`HTTP status ${res.status}`);
    const body = await res.json();
    if (!body.success || body.code !== 'success' || !body.data || body.data.status !== 'healthy') {
      throw new Error(`Unexpected payload: ${JSON.stringify(body)}`);
    }
  });

  // 2. Gateway Status
  await check('GET /api/v1/auth/status returns gateway metadata', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/auth/status`);
    if (!res.ok) throw new Error(`HTTP status ${res.status}`);
    const body = await res.json();
    if (!body.success || !body.data.keycloakIntegrated) {
      throw new Error(`Unexpected payload: ${JSON.stringify(body)}`);
    }
  });

  // 3. Register user
  const randomSuffix = Math.floor(Math.random() * 100000);
  const testUser = {
    username: `testuser_${randomSuffix}`,
    email: `test_${randomSuffix}@example.com`,
    password: 'Password123!',
    firstName: 'Test',
    lastName: 'User',
    displayName: `Test User ${randomSuffix}`,
  };

  await check('POST /api/v1/auth/register creates new user account', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser),
    });
    const body = await res.json();
    if (!body.success || body.code !== 'register_successful') {
      throw new Error(`Register failed: ${JSON.stringify(body)}`);
    }
  });

  // 4. Login user
  let accessToken = '';
  let refreshToken = '';

  await check('POST /api/v1/auth/login authenticates user', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: testUser.username,
        password: testUser.password,
      }),
    });
    const body = await res.json();
    if (!body.success || body.code !== 'login_successful' || !body.data.tokens?.accessToken) {
      throw new Error(`Login failed: ${JSON.stringify(body)}`);
    }
    accessToken = body.data.tokens.accessToken;
    refreshToken = body.data.tokens.refreshToken;
  });

  // 5. Protected /api/v1/auth/me
  await check('GET /api/v1/auth/me returns authenticated profile with Bearer token', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const body = await res.json();
    if (!body.success || body.code !== 'profile_fetched') {
      throw new Error(`Profile fetch failed: ${JSON.stringify(body)}`);
    }
  });

  // 6. Logout
  await check('POST /api/v1/auth/logout terminates session', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    const body = await res.json();
    if (!body.success || body.code !== 'logout_successful') {
      throw new Error(`Logout failed: ${JSON.stringify(body)}`);
    }
  });

  console.log(`\n=============================================`);
  console.log(`Summary: Passed: ${passed} | Failed: ${failed}`);
  console.log(`=============================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
