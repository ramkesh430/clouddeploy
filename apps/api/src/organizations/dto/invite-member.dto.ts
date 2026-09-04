import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsEnum } from "class-validator";
import { OrgRole } from "@clouddeploy/database";

export class InviteMemberDto {
  @ApiProperty({ example: "teammate@example.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: OrgRole, example: OrgRole.DEVELOPER })
  @IsEnum(OrgRole)
  role!: OrgRole;
}
