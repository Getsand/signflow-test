/**
 * File Types
 * 
 * TypeScript types for file upload and management.
 */

export interface PresignRequest {
  filename: string;
  mime_type: string;
  size: number;
}

export interface PresignResponse {
  file_id: string;
  upload_url: string;
  storage_key: string;
  expires_in: number;
}

export interface FileMetadata {
  id: string;
  filename: string;
  mime_type: string;
  size: number | null;
  status: 'UPLOADING' | 'COMPLETED' | 'FAILED' | 'LOCKED';
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}


