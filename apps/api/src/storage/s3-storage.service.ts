import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { AppConfig } from "../config/configuration";
import type { PresignedUpload, StoragePort } from "./storage.port";

const PRESIGNED_URL_TTL_SECONDS = 5 * 60;

/**
 * Real S3-compatible storage adapter (MinIO locally, AWS S3 in production —
 * ADR-0005/ADR-0015). Presigned-URL generation is a pure local computation
 * (no network call); getObjectBuffer/deleteObject do hit the storage
 * backend and are used only by the malware-scan job.
 */
@Injectable()
export class S3StorageService implements StoragePort {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(configService: ConfigService) {
    const { storage } = configService.getOrThrow<AppConfig>("app");
    this.bucket = storage.bucket;
    this.client = new S3Client({
      endpoint: storage.endpoint,
      region: storage.region,
      forcePathStyle: storage.forcePathStyle,
      credentials: {
        accessKeyId: storage.accessKeyId,
        secretAccessKey: storage.secretAccessKey,
      },
    });
  }

  async createPresignedUploadUrl(params: {
    key: string;
    contentType: string;
  }): Promise<PresignedUpload> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: params.key,
      ContentType: params.contentType,
    });
    const url = await getSignedUrl(this.client, command, { expiresIn: PRESIGNED_URL_TTL_SECONDS });
    return { url, key: params.key };
  }

  async createPresignedDownloadUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: PRESIGNED_URL_TTL_SECONDS });
  }

  async getObjectBuffer(key: string): Promise<Buffer> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const chunks: Buffer[] = [];
    const body = result.Body as NodeJS.ReadableStream;
    for await (const chunk of body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as unknown as Uint8Array));
    }
    return Buffer.concat(chunks);
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
