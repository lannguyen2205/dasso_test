import { IsString, IsOptional } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class LogoutDto {
  @ApiPropertyOptional({
    example: "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    description: "Refresh token to invalidate Keycloak SSO session",
  })
  @IsString()
  @IsOptional()
  refreshToken?: string;
}
