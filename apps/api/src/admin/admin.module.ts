import { Module } from "@nestjs/common";
import { SupportModule } from "../support/support.module";
import { SecuritySettingsModule } from "../security-settings/security-settings.module";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";

@Module({ imports: [SupportModule, SecuritySettingsModule], controllers: [AdminController], providers: [AdminService] })
export class AdminModule {}
