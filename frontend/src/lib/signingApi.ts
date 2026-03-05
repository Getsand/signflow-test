/**
 * Public Signing API - Token-based signing endpoints
 * 
 * These endpoints are PUBLIC (no authentication required).
 * Access is controlled via signing tokens sent via email.
 */

import axios from 'axios';

// Create a separate axios instance for public endpoints (no auth token)
const publicApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Add error interceptor for public API
publicApi.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('Public API error:', error);
    if (error.response) {
      // Server responded with error status
      return Promise.reject(error);
    } else if (error.request) {
      // Request made but no response received
      return Promise.reject(new Error('Network error. Please check your connection.'));
    } else {
      // Something else happened
      return Promise.reject(new Error('An unexpected error occurred'));
    }
  }
);

// ---- Types ----

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

export interface SignerContext {
  recipient: {
    id: string;
    role: string;
    email: string;
    order_index: number;
    status: string;
    created_at: string;
    sent_at: string | null;
  };
  signing_request: {
    id: string;
    title: string;
    status: string;
    signing_order: string;
  };
  pdf_view_url: string;
  fields: SigningRequestField[];
  signing_order: string;
}

export interface SignFieldRequest {
  signature_type: 'DRAW' | 'TYPED';
  signature_image_base64?: string;
  typed_name?: string;
}

export interface SignFieldResponse {
  field: SigningRequestField;
  all_fields_signed: boolean;
}

// ---- API Functions ----

/**
 * Get signing context by token (public endpoint)
 */
export async function getSignerContext(token: string): Promise<SignerContext> {
  const response = await publicApi.get<SignerContext>(`/api/v1/signing/by-token/${token}`);
  return response.data;
}

/**
 * Sign a field using token (public endpoint)
 */
export async function signField(
  fieldId: string,
  token: string,
  payload: SignFieldRequest
): Promise<SignFieldResponse> {
  const response = await publicApi.post<SignFieldResponse>(
    `/api/v1/signing/fields/${fieldId}/sign?token=${encodeURIComponent(token)}`,
    payload
  );
  return response.data;
}

/**
 * Complete signing for recipient (public endpoint)
 */
export async function completeSigning(token: string): Promise<{ message: string }> {
  const response = await publicApi.post<{ message: string }>(
    `/api/v1/signing/complete?token=${encodeURIComponent(token)}`
  );
  return response.data;
}
