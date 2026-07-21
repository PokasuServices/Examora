/**
 * `clamscan` ships no TypeScript types. This declares only the surface this
 * codebase actually uses (see clamscan/API.md for the full API).
 */
declare module "clamscan" {
  import type { Readable } from "node:stream";

  interface ClamdscanOptions {
    host?: string;
    port?: number;
    socket?: string;
    timeout?: number;
  }

  interface NodeClamOptions {
    removeInfected?: boolean;
    clamdscan?: ClamdscanOptions;
  }

  interface ScanStreamResult {
    isInfected: boolean;
    viruses: string[];
  }

  class NodeClam {
    init(options?: NodeClamOptions): Promise<NodeClam>;
    scanStream(stream: Readable): Promise<ScanStreamResult>;
  }

  export = NodeClam;
}
