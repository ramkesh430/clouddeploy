import { IsString, Length } from "class-validator";

export class VerifyTwoFactorDto {
  @IsString()
  @Length(6, 12)
  code!: string;
}
