/**
 * Signature Field API - Create, list, and manage signature fields
 */

import api from './api';

// ---- Types ----

export interface SignatureField {
  id: string;
  file_id: string;
  page_number: number;
  x: number;
  y: number;
  width: number;
  height: number;
  assigned_to: string;
  status: 'PENDING' | 'SIGNED';
  signature_type?: string | null;
  field_type?: string | null;
  role?: string | null; // Me, Signer 1, Signer 2 - used when creating signing request
  signed_at: string | null;
  created_at: string;
}

export interface CreateSignatureFieldRequest {
  file_id: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  assigned_to: string;
  field_type?: string;
  role?: string; // Me, Signer 1, Signer 2
}

// ---- API Functions ----

/**
 * List all signature fields for a file
 * @param fileId - UUID of the file
 * @returns Array of signature fields
 */
export async function listSignatureFields(fileId: string): Promise<SignatureField[]> {
  const response = await api.get<SignatureField[]>('/api/v1/signatures/fields', {
    params: { file_id: fileId },
  });
  return response.data;
}

/**
 * Create a new signature field
 * @param data - Signature field data
 * @returns Created signature field
 */
export async function createSignatureField(data: CreateSignatureFieldRequest): Promise<SignatureField> {
  const response = await api.post<SignatureField>('/api/v1/signatures/fields', data);
  return response.data;
}

/**
 * Delete a signature field (only if PENDING)
 * @param fieldId - UUID of the signature field
 */
export async function deleteSignatureField(fieldId: string): Promise<void> {
  await api.delete(`/api/v1/signatures/fields/${fieldId}`);
}

/**
 * Get presigned view URL for a file
 * @param fileId - UUID of the file
 * @returns View URL and expiration
 */
export async function getFileViewUrl(fileId: string): Promise<{ view_url: string; expires_in: number }> {
  try {
    const response = await api.get<{ view_url: string; expires_in: number }>(`/api/v1/files/${fileId}/view-url`);
    return response.data;
  } catch (err: any) {
    // Extract user-friendly error message
    const errorMsg = err.response?.data?.detail || err.message || 'Failed to generate view URL';
    throw new Error(errorMsg);
  }
}
