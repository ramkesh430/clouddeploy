import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser, RequestUser } from "../common/decorators/current-user.decorator";
import { StorageService } from "./storage.service";
import { CreateBucketDto } from "./dto/create-bucket.dto";
import { OrgRole } from "@clouddeploy/database";

@ApiTags("storage")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: "storage", version: "1" })
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Get("buckets")
  @ApiOperation({ summary: "List storage buckets in a workspace" })
  listBuckets(@Query("organizationId") organizationId: string) {
    return this.storageService.listBuckets(organizationId);
  }

  @Post("buckets")
  @Roles(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.DEVELOPER)
  @ApiOperation({ summary: "Create a storage bucket" })
  createBucket(@Body() dto: CreateBucketDto) {
    return this.storageService.createBucket(dto);
  }

  @Get("buckets/:bucketId")
  @ApiOperation({ summary: "Get bucket details" })
  getBucket(@Param("bucketId") bucketId: string) {
    return this.storageService.getBucket(bucketId);
  }

  @Patch("buckets/:bucketId")
  @Roles(OrgRole.OWNER, OrgRole.ADMIN)
  @ApiOperation({ summary: "Update bucket security settings" })
  updateSecurity(@Param("bucketId") bucketId: string, @Body() patch: Record<string, unknown>) {
    return this.storageService.updateSecurity(bucketId, patch);
  }

  @Delete("buckets/:bucketId")
  @Roles(OrgRole.OWNER, OrgRole.ADMIN)
  @ApiOperation({ summary: "Delete a bucket and all of its objects" })
  deleteBucket(@Param("bucketId") bucketId: string) {
    return this.storageService.deleteBucket(bucketId);
  }

  @Get("buckets/:bucketId/objects")
  @ApiOperation({ summary: "List files and folders under a prefix" })
  listObjects(@Param("bucketId") bucketId: string, @Query("prefix") prefix = "") {
    return this.storageService.listObjects(bucketId, prefix);
  }

  @Post("buckets/:bucketId/folders")
  @Roles(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.DEVELOPER)
  @ApiOperation({ summary: "Create a folder" })
  createFolder(@Param("bucketId") bucketId: string, @Body("key") key: string) {
    return this.storageService.createFolder(bucketId, key);
  }

  @Post("buckets/:bucketId/objects")
  @Roles(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.DEVELOPER)
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "Upload a file" })
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 200 * 1024 * 1024 } }))
  uploadObject(
    @Param("bucketId") bucketId: string,
    @Body("key") key: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: RequestUser,
  ) {
    return this.storageService.uploadObject(bucketId, key || file.originalname, file, user.id);
  }

  @Get("buckets/:bucketId/objects/:objectId/signed-url")
  @ApiOperation({ summary: "Get a signed download URL for a private object" })
  signedUrl(@Param("bucketId") bucketId: string, @Param("objectId") objectId: string) {
    return this.storageService.getSignedUrl(bucketId, objectId);
  }

  @Delete("buckets/:bucketId/objects/:objectId")
  @Roles(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.DEVELOPER)
  @ApiOperation({ summary: "Delete a file" })
  deleteObject(@Param("bucketId") bucketId: string, @Param("objectId") objectId: string) {
    return this.storageService.deleteObject(bucketId, objectId);
  }
}
