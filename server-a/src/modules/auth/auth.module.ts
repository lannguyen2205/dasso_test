import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { JwtModule } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { RolesGuard } from "./guards/roles.guard";
import { EmailModule } from "../email/email.module";
import { User } from "../users/entities/user.entity";
import { EmailOtp } from "./entities/email-otp.entity";
import { KeycloakAdminService } from "../keycloak/keycloak-admin.service";

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.register({}),
    TypeOrmModule.forFeature([User, EmailOtp]),
    EmailModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard, RolesGuard, KeycloakAdminService],
  exports: [AuthService, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
