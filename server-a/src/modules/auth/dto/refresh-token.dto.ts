import { IsString, IsNotEmpty } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class RefreshTokenDto {
  @ApiProperty({
    example: "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    description: "Valid Keycloak Refresh Token",
  })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
