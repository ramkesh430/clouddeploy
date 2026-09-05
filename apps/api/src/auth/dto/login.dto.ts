import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, Length, MinLength } from "class-validator";

export class LoginDto {
  @ApiProperty({ example: "ada@example.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "Password123!" })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ required: false, description: "Authenticator or recovery code when 2FA is enabled" })
  @IsOptional()
  @IsString()
  @Length(6, 16)
  otpCode?: string;
}
