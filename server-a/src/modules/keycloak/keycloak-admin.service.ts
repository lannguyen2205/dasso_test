import {
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { AppDefaults } from "../../common/constants/defaults";
import { ResponseCodes } from "../../common/constants/response-codes";

export interface CreateKeycloakUserInput {
  email: string;
  emailVerified: boolean;
  firstName?: string;
}

/**
 * Calls the Keycloak Admin REST API with a service-account token
 * (client_credentials grant of a confidential client that holds the
 * realm-management "manage-users" role). Never expose these credentials
 * to the browser.
 */
@Injectable()
export class KeycloakAdminService {
  private readonly logger = new Logger(KeycloakAdminService.name);

  private get baseUrl() {
    return (process.env.KEYCLOAK_URL || AppDefaults.KEYCLOAK.URL).replace(/\/+$/, "");
  }

  private get realm() {
    return process.env.KEYCLOAK_REALM || AppDefaults.KEYCLOAK.REALM;
  }

  private async getAdminToken(): Promise<string> {
    const clientId =
      process.env.KEYCLOAK_ADMIN_CLIENT_ID || AppDefaults.KEYCLOAK.ADMIN_CLIENT_ID;
    const clientSecret = process.env.KEYCLOAK_ADMIN_CLIENT_SECRET;
    if (!clientSecret) {
      throw new ServiceUnavailableException({
        code: ResponseCodes.KEYCLOAK_UNAVAILABLE,
        message: "KEYCLOAK_ADMIN_CLIENT_SECRET is not configured on the server",
      });
    }

    const res = await this.request(
      `${this.baseUrl}/realms/${this.realm}/protocol/openid-connect/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: clientId,
          client_secret: clientSecret,
        }),
      },
    );

    if (!res.ok) {
      this.logger.error(`Keycloak token request failed: ${res.status} ${await res.text()}`);
      throw new ServiceUnavailableException({
        code: ResponseCodes.KEYCLOAK_UNAVAILABLE,
        message: "Could not obtain Keycloak admin token (check client id/secret)",
      });
    }

    const body = (await res.json()) as { access_token: string };
    return body.access_token;
  }

  /** Creates a user in the realm and returns its Keycloak id. */
  async createUser(input: CreateKeycloakUserInput): Promise<{ id: string | null }> {
    const token = await this.getAdminToken();
    const email = input.email.toLowerCase().trim();

    const res = await this.request(`${this.baseUrl}/admin/realms/${this.realm}/users`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: email,
        email,
        emailVerified: input.emailVerified,
        enabled: true,
        ...(input.firstName ? { firstName: input.firstName } : {}),
      }),
    });

    if (res.status === 409) {
      throw new ConflictException({
        code: ResponseCodes.KEYCLOAK_USER_ALREADY_EXISTS,
        message: `Keycloak user with email ${email} already exists`,
      });
    }

    if (res.status !== 201) {
      this.logger.error(`Keycloak create user failed: ${res.status} ${await res.text()}`);
      throw new ServiceUnavailableException({
        code: ResponseCodes.KEYCLOAK_UNAVAILABLE,
        message: `Keycloak rejected user creation (HTTP ${res.status})`,
      });
    }

    // Keycloak returns the new user's URL in the Location header: .../users/{id}
    const location = res.headers.get("location");
    return { id: location ? location.substring(location.lastIndexOf("/") + 1) : null };
  }

  /** Finds a realm user by exact email; returns its id or null. */
  async findUserIdByEmail(email: string): Promise<string | null> {
    const token = await this.getAdminToken();
    const query = new URLSearchParams({ email: email.toLowerCase().trim(), exact: "true" });
    const res = await this.request(
      `${this.baseUrl}/admin/realms/${this.realm}/users?${query}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) {
      throw new ServiceUnavailableException({
        code: ResponseCodes.KEYCLOAK_UNAVAILABLE,
        message: `Keycloak user lookup failed (HTTP ${res.status})`,
      });
    }
    const users = (await res.json()) as { id: string }[];
    return users[0]?.id ?? null;
  }

  /** True once the user has a password credential (i.e. finished the set-password link). */
  async hasPassword(userId: string): Promise<boolean> {
    const token = await this.getAdminToken();
    const res = await this.request(
      `${this.baseUrl}/admin/realms/${this.realm}/users/${userId}/credentials`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) {
      throw new ServiceUnavailableException({
        code: ResponseCodes.KEYCLOAK_UNAVAILABLE,
        message: `Keycloak credentials lookup failed (HTTP ${res.status})`,
      });
    }
    const credentials = (await res.json()) as { type: string }[];
    return credentials.some((c) => c.type === "password");
  }

  /**
   * Asks Keycloak to email the user a link to perform required actions
   * (here: set a password). Requires SMTP to be configured on the realm.
   * After finishing, the user is redirected to `redirectUri` of `clientId`.
   */
  async sendSetPasswordEmail(
    userId: string,
    opts: { clientId: string; redirectUri: string; lifespanSeconds: number },
  ): Promise<void> {
    const token = await this.getAdminToken();
    const query = new URLSearchParams({
      client_id: opts.clientId,
      redirect_uri: opts.redirectUri,
      lifespan: String(opts.lifespanSeconds),
    });
    const res = await this.request(
      `${this.baseUrl}/admin/realms/${this.realm}/users/${userId}/execute-actions-email?${query}`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(["UPDATE_PASSWORD"]),
      },
    );

    if (res.status !== 204) {
      const detail = await res.text();
      this.logger.error(`Keycloak execute-actions-email failed: ${res.status} ${detail}`);
      throw new ServiceUnavailableException({
        code: ResponseCodes.KEYCLOAK_EMAIL_FAILED,
        message:
          res.status === 500
            ? "Keycloak could not send the email (is SMTP configured on the realm?)"
            : `Keycloak rejected the email request (HTTP ${res.status})`,
      });
    }
  }

  private async request(url: string, init: RequestInit): Promise<Response> {
    try {
      return await fetch(url, init);
    } catch (err) {
      this.logger.error(`Keycloak unreachable at ${url}: ${(err as Error).message}`);
      throw new ServiceUnavailableException({
        code: ResponseCodes.KEYCLOAK_UNAVAILABLE,
        message: "Keycloak server is unreachable",
      });
    }
  }
}
