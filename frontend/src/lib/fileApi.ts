/**
 * File API - Document listing and detail endpoints
 */

import api from './api';

// ---- Types ----

export interface FileListItem {
  id: string;
  filename: string;
  status: 'UPLOADING' | 'COMPLETED' | 'FAILED' | 'LOCKED';
  created_at: string;
}

export interface SignatureFieldSummary {
  id: string;
  page_number: number;
  x: number;
  y: number;
  width: number;
  height: number;
  assigned_to: string;
  status: 'PENDING' | 'SIGNED';
  signature_type: string | null;
  signed_at: string | null;
  created_at: string;
}

export interface FileDetail {
  id: string;
  filename: string;
  mime_type: string;
  size: number | null;
  status: 'UPLOADING' | 'COMPLETED' | 'FAILED' | 'LOCKED';
  bucket: string;
  storage_key: string;
  document_hash: string | null;
  locked_at: string | null;
  created_at: string;
  signature_fields: SignatureFieldSummary[];
}

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

// ---- API Functions ----

/**
 * List all files owned by current user
 * @returns Array of files ordered by created_at DESC
 */
export async function listFiles(): Promise<FileListItem[]> {
  const response = await api.get<FileListItem[]>('/api/v1/files');
  return response.data;
}

/**
 * Get detailed file information with signature fields
 * @param fileId - UUID of the file
 * @returns Detailed file information
 */
export async function getFileDetail(fileId: string): Promise<FileDetail> {
  try {
    const response = await api.get<FileDetail>(`/api/v1/files/${fileId}`);
    return response.data;
  } catch (err: any) {
    // Extract user-friendly error message
    const errorMsg = err.response?.data?.detail || err.message || 'Failed to load document';
    throw new Error(errorMsg);
  }
}

/**
 * Request presigned upload URL
 * @param request - File metadata
 * @returns Presigned upload URL and file ID
 */
export async function requestPresignedUpload(
  request: PresignRequest
): Promise<PresignResponse> {
  const response = await api.post<PresignResponse>('/api/v1/files/presign', request);
  return response.data;
}

/**
 * Finalize file upload after direct upload to MinIO
 * @param fileId - UUID of the file
 */
export async function finalizeUpload(fileId: string): Promise<void> {
  try {
    await api.post(`/api/v1/files/${fileId}/finalize`);
  } catch (err: any) {
    // Extract user-friendly error message
    const errorMsg = err.response?.data?.detail || err.message || 'Failed to finalize upload';
    throw new Error(errorMsg);
  }
}

/**
 * Complete file upload workflow
 * @param file - File to upload
 * @param onProgress - Progress callback
 * @returns File metadata
 */
export async function uploadFile(
  file: File,
  onProgress?: (progress: { loaded: number; total: number; percentage: number }) => void
): Promise<{ id: string; filename: string; mime_type: string; size: number | null; status: string }> {
  try {
    // Step 1: Request presigned URL
    const presignResponse = await requestPresignedUpload({
      filename: file.name,
      mime_type: file.type,
      size: file.size,
    });

    // Step 2: Upload directly to MinIO
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress({
            loaded: e.loaded,
            total: e.total,
            percentage: Math.round((e.loaded / e.total) * 100),
          });
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Upload to storage failed with status ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Network error during upload'));
      });

      xhr.addEventListener('abort', () => {
        reject(new Error('Upload was cancelled'));
      });

      xhr.open('PUT', presignResponse.upload_url);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.send(file);
    });

    // Step 3: Finalize upload
    await finalizeUpload(presignResponse.file_id);

    // Return file metadata
    return {
      id: presignResponse.file_id,
      filename: file.name,
      mime_type: file.type,
      size: file.size,
      status: 'COMPLETED' as const,
    };
  } catch (err: any) {
    // Re-throw with user-friendly message
    if (err instanceof Error) {
      throw err;
    }
    throw new Error(err.message || 'Upload failed. Please try again.');
  }
}

/**
 * Delete a file from both storage and database
 * @param fileId - UUID of the file to delete
 */
export async function deleteFile(fileId: string): Promise<void> {
  try {
    await api.delete(`/api/v1/files/${fileId}`);
  } catch (err: any) {
    // Extract user-friendly error message
    const errorMsg = err.response?.data?.detail || err.message || 'Failed to delete file';
    throw new Error(errorMsg);
  }
}

/**
 * Rename a file
 * @param fileId - UUID of the file to rename
 * @param newFilename - New filename
 * @returns Updated file metadata
 */
export async function renameFile(fileId: string, newFilename: string): Promise<FileListItem> {
  try {
    const response = await api.patch<FileListItem>(`/api/v1/files/${fileId}/rename`, {
      filename: newFilename,
    });
    return response.data;
  } catch (err: any) {
    // Extract user-friendly error message
    const errorMsg = err.response?.data?.detail || err.message || 'Failed to rename file';
    throw new Error(errorMsg);
  }
}
