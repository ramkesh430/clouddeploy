import { Module } from "@nestjs/common";
import { SecuritySettingsController } from "./security-settings.controller";
import { SecuritySettingsService } from "./security-settings.service";
import { EncryptionRotationService } from "./encryption-rotation.service";

@Module({
  controllers: [SecuritySettingsController],
  providers: [SecuritySettingsService, EncryptionRotationService],
  exports: [EncryptionRotationService],
})
export class SecuritySettingsModule {}
