import { Global, Module } from "@nestjs/common";
import { S3StorageService } from "./s3-storage.service";
import { STORAGE_PORT } from "./storage.port";

@Global()
@Module({
  providers: [{ provide: STORAGE_PORT, useClass: S3StorageService }],
  exports: [STORAGE_PORT],
})
export class StorageModule {}
