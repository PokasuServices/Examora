export interface UploadItem {
  localId: string;
  fileName: string;
  progress: number;
  status: "uploading" | "confirming" | "done" | "error";
  error?: string;
}
