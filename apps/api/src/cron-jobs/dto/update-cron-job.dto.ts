import { PartialType, OmitType } from "@nestjs/swagger";
import { CreateCronJobDto } from "./create-cron-job.dto";

export class UpdateCronJobDto extends PartialType(OmitType(CreateCronJobDto, ["projectId"] as const)) {}
