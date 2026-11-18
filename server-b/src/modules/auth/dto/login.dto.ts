import { IsString, IsNotEmpty, MinLength, IsOptional } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class LoginDto {
  @ApiPropertyOptional({
    example: "testuser",
    description: "Username or registered email address",
  })
  @IsString()
  @IsOptional()
  identifier?: string;

  @ApiPropertyOptional({
    example: "testuser",
    description: "Username for authentication",
  })
  @IsString()
  @IsOptional()
  username?: string;

  @ApiPropertyOptional({
    example: "testuser@example.com",
    description: "Email address for authentication",
  })
  @IsString()
  @IsOptional()
  email?: string;

  @ApiProperty({
    example: "Test@123",
    description: "Account password (minimum 6 characters)",
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;
}
