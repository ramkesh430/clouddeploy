import { Module } from "@nestjs/common";
import { AdminStatusController, PublicStatusController } from "./status.controller";
import { StatusService } from "./status.service";

@Module({ controllers: [PublicStatusController, AdminStatusController], providers: [StatusService], exports: [StatusService] })
export class StatusModule {}
