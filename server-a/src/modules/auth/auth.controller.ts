import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import type { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { VerifyEmailDto } from "./dto/verify-email.dto";
import { ResendVerificationDto } from "./dto/resend-verification.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { LogoutDto } from "./dto/logout.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { ResponseCodes } from "../../common/constants/response-codes";

@ApiTags("Authentication")
@Controller("api/v1/auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Register new account with Email (triggers OTP verification)",
  })
  @ApiResponse({
    status: 201,
    description: "User registered, verification OTP dispatched",
  })
  @ApiResponse({
    status: 409,
    description: "Email or username already exists",
  })
  async register(@Body() dto: RegisterDto) {
    const data = await this.authService.register(dto);
    return {
      _code: ResponseCodes.REGISTER_SUCCESSFUL,
      data,
    };
  }

  @Post("verify-email")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Verify registered email with 6-digit OTP code" })
  @ApiResponse({
    status: 200,
    description: "Email verified successfully, session established",
  })
  @ApiResponse({
    status: 400,
    description: "Invalid or expired OTP code",
  })
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    const data = await this.authService.verifyEmail(dto);
    return {
      _code: ResponseCodes.EMAIL_VERIFIED_SUCCESSFUL,
      data,
    };
  }

  @Post("resend-verification")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Resend OTP verification code to registered email" })
  @ApiResponse({
    status: 200,
    description: "New OTP verification code sent",
  })
  async resendVerification(@Body() dto: ResendVerificationDto) {
    const data = await this.authService.resendVerification(dto);
    return {
      _code: ResponseCodes.VERIFICATION_EMAIL_SENT,
      data,
    };
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Login with verified Email and Password" })
  @ApiResponse({
    status: 200,
    description: "User authenticated, tokens returned",
  })
  @ApiResponse({
    status: 401,
    description: "Invalid credentials or email not yet verified",
  })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.authService.login(dto);

    if (data.tokens?.refreshToken) {
      res.cookie("refresh_token", data.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: (data.tokens.expiresIn || 3600) * 1000,
      });
    }

    return {
      _code: ResponseCodes.LOGIN_SUCCESSFUL,
      data,
    };
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Logout and terminate active session" })
  @ApiResponse({
    status: 200,
    description: "Session terminated",
  })
  async logout(
    @Body() dto: LogoutDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken =
      dto.refreshToken || (req.cookies?.refresh_token as string | undefined);

    const data = await this.authService.logout({ refreshToken });
    res.clearCookie("refresh_token");

    return {
      _code: ResponseCodes.LOGOUT_SUCCESSFUL,
      data,
    };
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Refresh access token with refresh token" })
  async refreshToken(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    const refreshToken =
      dto.refreshToken || (req.cookies?.refresh_token as string);

    const data = await this.authService.refreshToken({ refreshToken });
    return {
      _code: ResponseCodes.TOKEN_REFRESHED,
      data,
    };
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Get current authenticated user profile & claims" })
  async getProfile(@Req() req: any) {
    const data = await this.authService.getProfile(req.user);
    return {
      _code: ResponseCodes.PROFILE_FETCHED,
      data,
    };
  }
}
