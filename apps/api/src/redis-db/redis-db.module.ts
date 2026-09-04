import { Module } from "@nestjs/common";
import { RedisDbController } from "./redis-db.controller";
import { RedisDbService } from "./redis-db.service";
import { RedisAdminService } from "./redis-admin.service";
import { RolesGuard } from "../auth/guards/roles.guard";

@Module({
  controllers: [RedisDbController],
  providers: [RedisDbService, RedisAdminService, RolesGuard],
  exports: [RedisDbService],
})
export class RedisDbModule {}
