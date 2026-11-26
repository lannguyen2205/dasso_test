import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  Logger,
  OnModuleInit,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, MoreThan } from "typeorm";
import { JwtService } from "@nestjs/jwt";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { VerifyEmailDto } from "./dto/verify-email.dto";
import { ResendVerificationDto } from "./dto/resend-verification.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { LogoutDto } from "./dto/logout.dto";
import { AppDefaults } from "../../common/constants/defaults";
import { ResponseCodes } from "../../common/constants/response-codes";
import { EmailService } from "../email/email.service";
import { User } from "../users/entities/user.entity";
import { EmailOtp } from "./entities/email-otp.entity";
import { KeycloakAdminService } from "../keycloak/keycloak-admin.service";
import * as bcrypt from "bcryptjs";

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(EmailOtp)
    private readonly otpRepository: Repository<EmailOtp>,
    private readonly emailService: EmailService,
    private readonly jwtService: JwtService,
    private readonly keycloakAdmin: KeycloakAdminService,
  ) {}

  /**
   * Seed default test user on startup if not exists
   */
  async onModuleInit() {
    try {
      const defaultEmail = "testuser@example.com";
      const existing = await this.userRepository.findOne({
        where: { email: defaultEmail },
      });
      if (!existing) {
        const defaultPasswordHash = await bcrypt.hash("Test@123", 10);
        const testUser = this.userRepository.create({
          email: defaultEmail,
          username: "testuser",
          displayName: "Test User",
          passwordHash: defaultPasswordHash,
          avatarUrl: AppDefaults.AVATAR.getAvatarUrl("testuser"),
          isEmailVerified: true,
          emailVerifiedAt: new Date(),
          roles: ["user", "admin"],
        });
        await this.userRepository.save(testUser);
        this.logger.log(
          `✅ Default test user seeded in Supabase [${process.env.DB_SCHEMA}]: ${defaultEmail}`,
        );
      }
    } catch (err) {
      this.logger.warn(`Could not seed default user: ${(err as Error).message}`);
    }
  }

  /**
   * Register a new user account with Email Verification
   */
  async register(dto: RegisterDto) {
    const cleanEmail = dto.email.trim().toLowerCase();
    const existing = await this.userRepository.findOne({
      where: [{ email: cleanEmail }],
    });

    if (existing && existing.isEmailVerified) {
      throw new ConflictException({
        code: ResponseCodes.EMAIL_ALREADY_EXISTS,
        message: "An account with this email address already exists",
      });
    }

    const username =
      dto.username?.trim().toLowerCase() ||
      cleanEmail.split("@")[0] ||
      `user_${Date.now()}`;

    const existingUsername = await this.userRepository.findOne({
      where: { username },
    });

    if (existingUsername && existingUsername.email !== cleanEmail) {
      throw new ConflictException({
        code: ResponseCodes.USERNAME_ALREADY_EXISTS,
        message: "An account with this username already exists",
      });
    }

    const displayName = dto.displayName?.trim() || username;
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    let user = existing;
    if (!user) {
      user = this.userRepository.create({
        email: cleanEmail,
        username,
        displayName,
        passwordHash: hashedPassword,
        avatarUrl: AppDefaults.AVATAR.getAvatarUrl(username),
        isEmailVerified: false,
        emailVerifiedAt: null,
        roles: ["user"],
      });
      await this.userRepository.save(user);
    } else {
      user.passwordHash = hashedPassword;
      user.displayName = displayName;
      await this.userRepository.save(user);
    }

    // Generate 6-digit OTP code (5 minutes validity)
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const otpEntity = this.otpRepository.create({
      email: cleanEmail,
      otpCode,
      expiresAt,
      isUsed: false,
    });
    await this.otpRepository.save(otpEntity);

    // Send verification email with OTP
    await this.emailService.sendVerificationEmail(cleanEmail, otpCode, displayName);

    return {
      message:
        "Verification OTP code sent to your email. Please verify to activate your account.",
      email: cleanEmail,
      expiresInMinutes: 5,
      otpCode,
      user: this.sanitizeUser(user),
    };
  }

  /**
   * Verify email with 6-digit OTP code
   */
  async verifyEmail(dto: VerifyEmailDto) {
    const cleanEmail = dto.email.trim().toLowerCase();
    const cleanOtp = dto.otp.trim();

    const otpRecord = await this.otpRepository.findOne({
      where: {
        email: cleanEmail,
        otpCode: cleanOtp,
        isUsed: false,
        expiresAt: MoreThan(new Date()),
      },
      order: { createdAt: "DESC" },
    });

    if (!otpRecord) {
      throw new BadRequestException({
        code: ResponseCodes.INVALID_OTP,
        message: "Invalid or expired verification OTP code",
      });
    }

    const user = await this.userRepository.findOne({
      where: { email: cleanEmail },
    });

    if (!user) {
      throw new NotFoundException({
        code: ResponseCodes.USER_NOT_FOUND,
        message: "User account not found",
      });
    }

    // Mark OTP as used
    otpRecord.isUsed = true;
    await this.otpRepository.save(otpRecord);

    // Mark user email as verified
    user.isEmailVerified = true;
    user.emailVerifiedAt = new Date();
    await this.userRepository.save(user);

    // Generate authentication tokens
    const tokens = await this.generateTokens(user);

    return {
      message: "Email successfully verified. Account is now active.",
      user: this.sanitizeUser(user),
      tokens,
    };
  }

  /**
   * Resend OTP verification email
   */
  async resendVerification(dto: ResendVerificationDto) {
    const cleanEmail = dto.email.trim().toLowerCase();
    const user = await this.userRepository.findOne({
      where: { email: cleanEmail },
    });

    if (!user) {
      throw new NotFoundException({
        code: ResponseCodes.USER_NOT_FOUND,
        message: "No account found with this email",
      });
    }

    if (user.isEmailVerified) {
      throw new BadRequestException({
        code: ResponseCodes.EMAIL_ALREADY_VERIFIED,
        message: "This email address is already verified. You can log in directly.",
      });
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const otpEntity = this.otpRepository.create({
      email: cleanEmail,
      otpCode,
      expiresAt,
      isUsed: false,
    });
    await this.otpRepository.save(otpEntity);

    await this.emailService.sendVerificationEmail(cleanEmail, otpCode, user.displayName);

    return {
      message: "A new verification OTP code has been sent to your email",
      email: cleanEmail,
      expiresInMinutes: 5,
      otpCode,
    };
  }

  /**
   * Login user with Email/Username and Password
   */
  async login(dto: LoginDto) {
    const identifier = dto.email.trim().toLowerCase();
    const user = await this.userRepository.findOne({
      where: [{ email: identifier }, { username: identifier }],
    });

    if (!user) {
      throw new UnauthorizedException({
        code: ResponseCodes.INVALID_CREDENTIALS,
        message: "Invalid email or password",
      });
    }

    const isPasswordValid = user.passwordHash.startsWith("$2")
      ? await bcrypt.compare(dto.password, user.passwordHash)
      : user.passwordHash === dto.password;

    if (!isPasswordValid) {
      throw new UnauthorizedException({
        code: ResponseCodes.INVALID_CREDENTIALS,
        message: "Invalid email or password",
      });
    }

    if (!user.isEmailVerified) {
      throw new UnauthorizedException({
        code: ResponseCodes.EMAIL_NOT_VERIFIED,
        message:
          "Email has not been verified yet. Please verify your email before logging in.",
      });
    }

    const tokens = await this.generateTokens(user);
    await this.refreshSsoLink(user);

    return {
      message: "Login successful",
      user: this.sanitizeUser(user),
      tokens,
    };
  }

  /**
   * Refresh JWT access token
   */
  async refreshToken(dto: RefreshTokenDto) {
    try {
      const payload = this.jwtService.verify(dto.refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET || "default_jwt_refresh_secret_dasso",
      });

      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException({
          code: ResponseCodes.INVALID_TOKEN,
          message: "User session not found",
        });
      }

      const tokens = await this.generateTokens(user);
      return {
        message: "Token refreshed successfully",
        tokens,
      };
    } catch {
      throw new UnauthorizedException({
        code: ResponseCodes.INVALID_TOKEN,
        message: "Invalid or expired refresh token",
      });
    }
  }

  /**
   * Terminate user session
   */
  async logout(_dto: LogoutDto) {
    return {
      message: "Logout successful",
    };
  }

  /**
   * Get user profile by ID or JWT payload
   */
  async getProfile(userParam: any) {
    const rawId =
      typeof userParam === "string"
        ? userParam
        : userParam?.id || userParam?.sub;
    const userEmail =
      typeof userParam === "object" ? userParam?.email : undefined;

    // UUID v4 format regex to avoid PostgreSQL syntax error on non-UUID strings
    const isUuid =
      typeof rawId === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        rawId,
      );

    let user = null;
    if (isUuid) {
      user = await this.userRepository.findOne({
        where: { id: rawId },
      });
    }

    if (!user && userEmail) {
      user = await this.userRepository.findOne({
        where: { email: userEmail.toLowerCase().trim() },
      });
    }

    if (user) {
      await this.refreshSsoLink(user);
      return this.sanitizeUser(user);
    }

    // If user is authenticated via Keycloak SSO token but not recorded in local DB:
    if (typeof userParam === "object" && userParam !== null) {
      return {
        id: userParam.id || userParam.sub || "sso-user",
        email: userParam.email || "",
        username: userParam.username || userParam.sub || "",
        displayName:
          userParam.displayName ||
          userParam.name ||
          userParam.email ||
          "DaSSO User",
        roles: userParam.roles || [],
        isEmailVerified: true,
        source: "keycloak_sso",
        avatarUrl: userParam.avatarUrl || null,
      };
    }

    throw new NotFoundException({
      code: ResponseCodes.USER_NOT_FOUND,
      message: "User profile not found",
    });
  }

  /**
   * Create a Keycloak user for the currently logged-in local account.
   * The bearer token's signature is verified here (the shared JwtStrategy only
   * decodes it), and the email is taken from the database, never from the client.
   */
  async createKeycloakAccount(accessToken: string) {
    let payload: { sub?: string };
    try {
      payload = this.jwtService.verify(accessToken, {
        secret: process.env.JWT_SECRET || "default_jwt_secret_dasso",
      });
    } catch {
      throw new UnauthorizedException({
        code: ResponseCodes.INVALID_TOKEN,
        message: "Access token is invalid or was not issued by this server",
      });
    }

    const user = payload.sub
      ? await this.userRepository.findOne({ where: { id: payload.sub } })
      : null;
    if (!user) {
      throw new NotFoundException({
        code: ResponseCodes.USER_NOT_FOUND,
        message: "User not found",
      });
    }
    if (!user.isEmailVerified) {
      throw new UnauthorizedException({
        code: ResponseCodes.EMAIL_NOT_VERIFIED,
        message: "Email must be verified before creating a Keycloak account",
      });
    }

    // Create the Keycloak user; if it already exists, reuse it so the
    // set-password email can be (re)sent.
    let keycloakUserId: string | null;
    let created = true;
    try {
      ({ id: keycloakUserId } = await this.keycloakAdmin.createUser({
        email: user.email,
        emailVerified: user.isEmailVerified,
        firstName: user.displayName || undefined,
      }));
      this.logger.log(`🔑 Keycloak user created for ${user.email} (id: ${keycloakUserId})`);
    } catch (err) {
      if (!(err instanceof ConflictException)) throw err;
      created = false;
      keycloakUserId = await this.keycloakAdmin.findUserIdByEmail(user.email);
    }

    if (!keycloakUserId) {
      throw new NotFoundException({
        code: ResponseCodes.USER_NOT_FOUND,
        message: "Keycloak user could not be resolved",
      });
    }

    if (user.keycloakUserId !== keycloakUserId) {
      user.keycloakUserId = keycloakUserId;
      await this.userRepository.save(user);
    }

    // Password already set on Keycloak (e.g. link done in another tab): mark linked, no email.
    if (await this.refreshSsoLink(user)) {
      return {
        keycloakUserId,
        email: user.email,
        created,
        isLinkedSSO: true,
        passwordEmailSent: false,
        passwordEmailError: null,
      };
    }

    // The user was created without a password: email them a set-password link.
    // A failed email must not hide the fact that the user now exists.
    let passwordEmailSent = false;
    let passwordEmailError: string | null = null;
    try {
      await this.keycloakAdmin.sendSetPasswordEmail(keycloakUserId, {
        clientId: AppDefaults.KEYCLOAK.CLIENT_ID,
        redirectUri: `${process.env.CLIENT_ORIGIN || AppDefaults.APP.DEFAULT_CLIENT_ORIGIN}/`,
        lifespanSeconds: AppDefaults.KEYCLOAK.SET_PASSWORD_LINK_LIFESPAN_SECONDS,
      });
      passwordEmailSent = true;
      this.logger.log(`📧 Keycloak set-password email sent to ${user.email}`);
    } catch (err) {
      passwordEmailError = (err as Error).message;
    }

    return {
      keycloakUserId,
      email: user.email,
      created,
      isLinkedSSO: false,
      passwordEmailSent,
      passwordEmailError,
    };
  }

  /**
   * Sets isLinkedSSO once the linked Keycloak user has a password.
   * Keycloak does not notify us when the set-password link is completed,
   * so this is checked lazily (login, /me, link button). Never throws:
   * a Keycloak outage must not break local login. Returns the flag.
   */
  private async refreshSsoLink(user: User): Promise<boolean> {
    if (user.isLinkedSSO || !user.keycloakUserId) return user.isLinkedSSO;
    try {
      if (await this.keycloakAdmin.hasPassword(user.keycloakUserId)) {
        user.isLinkedSSO = true;
        await this.userRepository.save(user);
        this.logger.log(`🔗 ${user.email} is now linked to Keycloak SSO`);
      }
    } catch (err) {
      this.logger.warn(`Could not check Keycloak link for ${user.email}: ${(err as Error).message}`);
    }
    return user.isLinkedSSO;
  }

  /**
   * Get all registered users
   */
  async getAllUsers() {
    const users = await this.userRepository.find({
      order: { createdAt: "DESC" },
    });
    return users.map((u) => this.sanitizeUser(u));
  }

  /**
   * Helper: Generate JWT tokens
   */
  private async generateTokens(user: User) {
    const payload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      roles: user.roles,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET || "default_jwt_secret_dasso",
      expiresIn: "1h",
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET || "default_jwt_refresh_secret_dasso",
      expiresIn: "7d",
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 3600,
      tokenType: "Bearer",
    };
  }

  /**
   * Helper: Remove sensitive credentials from user response
   */
  public sanitizeUser(user: User) {
    const { passwordHash, ...safeUser } = user;
    void passwordHash;
    return safeUser;
  }
}
