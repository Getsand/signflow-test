/**
 * Signing Request API - Document workflow management
 */

import api from './api';

// ---- Types ----

export interface Recipient {
  id: string;
  role: string;
  email: string;
  order_index: number;
  status: 'PENDING' | 'SIGNED';
  created_at: string;
  sent_at: string | null;
}

export interface SigningRequestListItem {
  id: string;
  file_id: string;
  title: string;
  status: 'DRAFT' | 'SENT' | 'IN_PROGRESS' | 'COMPLETED';
  signing_order: 'SEQUENTIAL' | 'PARALLEL';
  created_at: string;
  updated_at: string;
  sent_at: string | null;
  completed_at: string | null;
  filename: string;
  file_status: string;
}

export interface SigningRequestField {
  id: string;
  signing_request_id: string;
  template_field_id: string;
  recipient_id: string;
  role: string;
  field_type: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  value: string | null;
  status: 'PENDING' | 'SIGNED';
  signed_at: string | null;
  created_at: string;
}

export interface SigningRequestDetail {
  id: string;
  file_id: string;
  owner_id: string;
  title: string;
  status: 'DRAFT' | 'SENT' | 'IN_PROGRESS' | 'COMPLETED';
  signing_order: 'SEQUENTIAL' | 'PARALLEL';
  created_at: string;
  updated_at: string;
  sent_at: string | null;
  completed_at: string | null;
  filename: string;
  mime_type: string;
  file_size: number | null;
  file_status: string;
  storage_key: string;
  recipients: Recipient[];
  total_signature_fields: number;
  signed_fields_count: number;
  fields: SigningRequestField[];
}

export interface SigningRequestStats {
  total: number;
  draft: number;
  sent: number;
  in_progress: number;
  completed: number;
}

export interface RecipientCreate {
  role: string;
  email: string;
  order_index: number;
}

export interface CreateSigningRequestRequest {
  file_id: string;
  title?: string;
  signing_order: 'SEQUENTIAL' | 'PARALLEL';
  recipients: RecipientCreate[];
}

// ---- API Functions ----

/**
 * List all signing requests for current user
 * @returns Array of signing requests ordered by created_at DESC
 */
export async function listSigningRequests(): Promise<SigningRequestListItem[]> {
  const response = await api.get<SigningRequestListItem[]>('/api/v1/signing-requests');
  return response.data;
}

/**
 * Get signing request statistics for dashboard
 * @returns Stats by status
 */
export async function getSigningRequestStats(): Promise<SigningRequestStats> {
  const response = await api.get<SigningRequestStats>('/api/v1/signing-requests/stats');
  return response.data;
}

/**
 * Get detailed signing request information
 * @param signingRequestId - UUID of the signing request
 * @returns Detailed signing request information
 */
export async function getSigningRequestDetail(signingRequestId: string): Promise<SigningRequestDetail> {
  const response = await api.get<SigningRequestDetail>(`/api/v1/signing-requests/${signingRequestId}`);
  return response.data;
}

/**
 * Create a signing request from an uploaded file
 * @param data - File ID and optional title
 * @returns Created signing request
 */
export async function createSigningRequest(data: CreateSigningRequestRequest): Promise<SigningRequestListItem> {
  const response = await api.post<SigningRequestListItem>('/api/v1/signing-requests', data);
  return response.data;
}

export interface SendSigningRequestResponse {
  signing_request: SigningRequestListItem;
  sent: boolean;
  failed_recipients: string[];
}

/**
 * Send signing request (transition from DRAFT to SENT)
 * @param signingRequestId - UUID of the signing request
 * @returns Response with signing request, sent status, and failed recipients
 */
export async function sendSigningRequest(signingRequestId: string): Promise<SendSigningRequestResponse> {
  const response = await api.post<SendSigningRequestResponse>(`/api/v1/signing-requests/${signingRequestId}/send`);
  return response.data;
}

/**
 * Download signed PDF with all signatures embedded
 * @param signingRequestId - UUID of the signing request
 * @returns Blob of the signed PDF
 */
export async function downloadSignedPdf(signingRequestId: string): Promise<Blob> {
  const response = await api.get(`/api/v1/signing-requests/${signingRequestId}/download`, {
    responseType: 'blob',
  });
  return response.data;
}

/**
 * Delete a signing request
 * @param signingRequestId - UUID of the signing request
 */
export async function deleteSigningRequest(signingRequestId: string): Promise<void> {
  await api.delete(`/api/v1/signing-requests/${signingRequestId}`);
}
