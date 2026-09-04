import { Module } from "@nestjs/common";
import { StorageController } from "./storage.controller";
import { StorageService } from "./storage.service";
import { RolesGuard } from "../auth/guards/roles.guard";

@Module({
  controllers: [StorageController],
  providers: [StorageService, RolesGuard],
  exports: [StorageService],
})
export class StorageModule {}
