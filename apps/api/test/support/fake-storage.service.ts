import { Injectable } from "@nestjs/common";
import type { PresignedUpload, StoragePort } from "../../src/storage/storage.port";

/**
 * Test double for STORAGE_PORT — an in-memory object store. No CI service
 * provides a real S3-compatible backend (see ADR-0015), so every automated
 * test uses this instead of S3StorageService.
 */
@Injectable()
export class FakeStorageService implements StoragePort {
  private readonly objects = new Map<string, Buffer>();

  async createPresignedUploadUrl(params: {
    key: string;
    contentType: string;
  }): Promise<PresignedUpload> {
    await Promise.resolve();
    return { url: `fake-storage://upload/${params.key}`, key: params.key };
  }

  async createPresignedDownloadUrl(key: string): Promise<string> {
    await Promise.resolve();
    return `fake-storage://download/${key}`;
  }

  async getObjectBuffer(key: string): Promise<Buffer> {
    await Promise.resolve();
    const object = this.objects.get(key);
    if (!object) {
      throw new Error(`FakeStorageService: no object at key "${key}"`);
    }
    return object;
  }

  async deleteObject(key: string): Promise<void> {
    await Promise.resolve();
    this.objects.delete(key);
  }

  /** Test-only helper: simulates the browser's direct-to-storage PUT via the presigned URL. */
  put(key: string, buffer: Buffer): void {
    this.objects.set(key, buffer);
  }

  has(key: string): boolean {
    return this.objects.has(key);
  }
}
