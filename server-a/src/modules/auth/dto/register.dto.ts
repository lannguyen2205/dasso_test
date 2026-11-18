import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class RegisterDto {
  @ApiProperty({
    example: "user@example.com",
    description: "Unique email address for registration",
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: "SecurePass123!",
    description: "Account password (minimum 6 characters)",
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({
    example: "Nguyen Van A",
    description: "User display name",
  })
  @IsString()
  @IsOptional()
  displayName?: string;

  @ApiPropertyOptional({
    example: "nguyenvana",
    description: "Unique username (auto-generated from email if omitted)",
  })
  @IsString()
  @IsOptional()
  @MinLength(3)
  @MaxLength(30)
  username?: string;
}
