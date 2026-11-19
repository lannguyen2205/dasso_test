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
   * Get user profile by ID
   */
  async getProfile(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException({
        code: ResponseCodes.USER_NOT_FOUND,
        message: "User profile not found",
      });
    }

    return this.sanitizeUser(user);
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
