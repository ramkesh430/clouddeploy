import { Module } from "@nestjs/common";
import { SecuritySettingsController } from "./security-settings.controller";
import { SecuritySettingsService } from "./security-settings.service";

@Module({ controllers: [SecuritySettingsController], providers: [SecuritySettingsService] })
export class SecuritySettingsModule {}
