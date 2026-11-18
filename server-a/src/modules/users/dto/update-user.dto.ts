import { IsString, IsEmail, IsOptional, IsBoolean } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateUserDto {
  @ApiPropertyOptional({
    example: "johndoe@example.com",
    description: "User email",
  })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: "John", description: "First name" })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiPropertyOptional({ example: "Doe", description: "Last name" })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiPropertyOptional({ example: true, description: "Is user active" })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}
