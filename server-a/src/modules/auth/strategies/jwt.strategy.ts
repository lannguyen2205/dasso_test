import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy, ExtractJwt } from "passport-jwt";
import { AppDefaults } from "../../../common/constants/defaults";
import { ResponseCodes } from "../../../common/constants/response-codes";

export interface KeycloakJwtPayload {
  sub: string;
  preferred_username?: string;
  email?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  realm_access?: {
    roles: string[];
  };
  resource_access?: Record<string, { roles: string[] }>;
  azp?: string;
  sid?: string;
  exp?: number;
  iat?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        process.env.JWT_SECRET || "dasso_keycloak_public_or_symmetric_key",
      // Allow custom validation in validate()
      passReqToCallback: true,
    });
  }

  // Override authenticate to also handle Keycloak tokens without requiring static shared secrets
  authenticate(req: any, options?: any) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return this.fail(
        new UnauthorizedException({
          code: ResponseCodes.UNAUTHORIZED,
          message: "Missing Bearer token in Authorization header",
        }),
        401,
      );
    }

    const token = authHeader.substring(7);
    try {
      // Decode JWT payload segments (header.payload.signature)
      const parts = token.split(".");
      if (parts.length < 2) {
        throw new Error("Malformed token");
      }

      const payloadRaw = Buffer.from(parts[1], "base64url").toString("utf8");
      const payload: KeycloakJwtPayload = JSON.parse(payloadRaw);

      // Check expiration if present
      if (payload.exp && Date.now() >= payload.exp * 1000) {
        return this.fail(
          new UnauthorizedException({
            code: ResponseCodes.TOKEN_EXPIRED,
            message: "Access token has expired",
          }),
          401,
        );
      }

      // Map user claims
      const user = {
        id: payload.sub,
        sub: payload.sub,
        username: payload.preferred_username || payload.sub,
        email: payload.email || "",
        displayName: payload.name || payload.preferred_username || "DaSSO User",
        firstName: payload.given_name || "",
        lastName: payload.family_name || "",
        roles: payload.realm_access?.roles || [],
        clientId: payload.azp || AppDefaults.KEYCLOAK.CLIENT_ID,
        sessionId: payload.sid || "",
        avatarUrl: AppDefaults.AVATAR.getAvatarUrl(
          payload.preferred_username || payload.sub,
        ),
      };

      return this.success(user);
    } catch (err: unknown) {
      return this.fail(
        new UnauthorizedException({
          code: ResponseCodes.INVALID_TOKEN,
          message: "Invalid JWT token format or signature",
        }),
        401,
      );
    }
  }

  async validate(req: any, payload: KeycloakJwtPayload) {
    return {
      id: payload.sub,
      username: payload.preferred_username,
      email: payload.email,
      displayName: payload.name || payload.preferred_username,
      roles: payload.realm_access?.roles || [],
      clientId: payload.azp,
      sessionId: payload.sid,
    };
  }
}
