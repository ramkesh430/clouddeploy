import { Module } from "@nestjs/common";
import { DomainsController } from "./domains.controller";
import { DomainsService } from "./domains.service";
import { RolesGuard } from "../auth/guards/roles.guard";

@Module({
  controllers: [DomainsController],
  providers: [DomainsService, RolesGuard],
  exports: [DomainsService],
})
export class DomainsModule {}
