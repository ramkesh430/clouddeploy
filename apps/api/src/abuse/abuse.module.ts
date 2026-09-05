import { Module } from "@nestjs/common";
import { AbuseController, AdminAbuseController } from "./abuse.controller";
import { AbuseService } from "./abuse.service";

@Module({ controllers: [AbuseController, AdminAbuseController], providers: [AbuseService], exports: [AbuseService] })
export class AbuseModule {}
