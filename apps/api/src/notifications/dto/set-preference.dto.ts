import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsEnum } from "class-validator";
import { NotificationType, NotificationChannel } from "@clouddeploy/database";

export class SetPreferenceDto {
  @ApiProperty({ enum: NotificationType })
  @IsEnum(NotificationType)
  type!: NotificationType;

  @ApiProperty({ enum: NotificationChannel })
  @IsEnum(NotificationChannel)
  channel!: NotificationChannel;

  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;
}
