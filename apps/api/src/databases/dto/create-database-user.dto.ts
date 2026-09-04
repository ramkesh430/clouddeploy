import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, Matches } from "class-validator";

export class CreateDatabaseUserDto {
  @ApiProperty({ example: "analytics", description: "Lowercase letters, numbers, and underscores only" })
  @IsString()
  @Matches(/^[a-z][a-z0-9_]{0,30}$/)
  username!: string;

  @ApiPropertyOptional({ enum: ["readonly", "readwrite"], default: "readonly" })
  @IsOptional()
  @IsIn(["readonly", "readwrite"])
  role?: "readonly" | "readwrite";
}
