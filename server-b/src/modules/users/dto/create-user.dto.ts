import {
  IsString,
  IsEmail,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsOptional,
  IsBoolean,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateUserDto {
  @ApiProperty({ example: "johndoe", description: "Unique username" })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(30)
  username: string;

  @ApiProperty({ example: "johndoe@example.com", description: "User email" })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: "Password123!",
    description: "Initial password",
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({ example: "John", description: "First name" })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiPropertyOptional({ example: "Doe", description: "Last name" })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiPropertyOptional({ example: true, description: "Is user enabled" })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}
