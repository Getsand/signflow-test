/**
 * DocumentDetail Page
 * 
 * Displays detailed information about a specific document:
 * - File metadata
 * - Status and lock information
 * - Signature fields (read-only)
 * 
 * Uses REAL data from GET /api/v1/files/{file_id} API
 */

import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, StatusBadge } from '../../components/ui';
import { getFileDetail, FileDetail } from '../../lib/fileApi';

export const DocumentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [fileData, setFileData] = useState<FileDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch file details on mount
  useEffect(() => {
    const fetchFileDetails = async () => {
      if (!id) {
        setError('File ID not provided');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const data = await getFileDetail(id);
        setFileData(data);
        setError(null);
      } catch (err: any) {
        console.error('Failed to fetch file details:', err);
        if (err.response?.status === 404) {
          setError('Document not found or you do not have access');
        } else if (err.response?.status === 403) {
          setError('Access denied');
        } else {
          setError('Failed to load document details');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchFileDetails();
  }, [id]);

  // Format file size
  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-slide-up">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Link to="/dashboard" className="hover:text-indigo-600">Dashboard</Link>
          <span>/</span>
          <Link to="/documents" className="hover:text-indigo-600">Documents</Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">
            {fileData?.filename || 'Loading...'}
          </span>
        </div>

        {/* Page Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-bold text-gray-900 truncate">
              {isLoading ? 'Loading...' : fileData?.filename || 'Document'}
            </h1>
            <p className="mt-2 text-gray-600">
              View document details and signature fields
            </p>
          </div>
          <Link to="/documents">
            <Button variant="outline">
              Back to Documents
            </Button>
          </Link>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="font-medium">Error</p>
                <p className="mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        )}

        {/* Document Details */}
        {!isLoading && fileData && (
          <>
            {/* Lock Warning */}
            {fileData.status === 'LOCKED' && (
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg text-sm text-purple-700">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <div>
                    <p className="font-medium">Document Locked</p>
                    <p className="mt-1">
                      This document has been finalized and cannot be modified. 
                      {fileData.locked_at && ` Locked on ${new Date(fileData.locked_at).toLocaleString()}`}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* File Metadata Card */}
            <Card>
              <CardHeader>
                <CardTitle>Document Information</CardTitle>
                <CardDescription>File metadata and storage details</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Status</label>
                    <div className="mt-2">
                      <StatusBadge status={fileData.status} />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">File Size</label>
                    <p className="mt-2 text-sm text-gray-900">{formatFileSize(fileData.size)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">MIME Type</label>
                    <p className="mt-2 text-sm text-gray-900 font-mono">{fileData.mime_type}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Created</label>
                    <p className="mt-2 text-sm text-gray-900">
                      {new Date(fileData.created_at).toLocaleString('en-US', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </p>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-gray-500">Document ID</label>
                    <p className="mt-2 text-sm text-gray-900 font-mono break-all">{fileData.id}</p>
                  </div>
                  {fileData.document_hash && (
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium text-gray-500">Document Hash (SHA256)</label>
                      <p className="mt-2 text-sm text-gray-900 font-mono break-all">{fileData.document_hash}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Signature Fields Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Signature Fields</CardTitle>
                    <CardDescription>
                      {fileData.signature_fields.length === 0
                        ? 'No signature fields yet'
                        : `${fileData.signature_fields.length} signature field${fileData.signature_fields.length !== 1 ? 's' : ''}`}
                    </CardDescription>
                  </div>
                  {fileData.status !== 'LOCKED' && (
                    <Button variant="outline" size="sm" disabled>
                      Add Field (Coming Soon)
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {fileData.signature_fields.length === 0 ? (
                  <div className="text-center py-8">
                    <svg
                      className="mx-auto h-10 w-10 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                    <p className="mt-2 text-sm text-gray-600">
                      No signature fields have been added yet.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Page</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Position</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Signed At</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {fileData.signature_fields.map((field) => (
                          <tr key={field.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900">{field.page_number}</td>
                            <td className="px-4 py-3 text-sm text-gray-600 font-mono">
                              {field.x.toFixed(0)}, {field.y.toFixed(0)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 font-mono">
                              {field.width.toFixed(0)} × {field.height.toFixed(0)}
                            </td>
                            <td className="px-4 py-3">
                              <StatusBadge status={field.status} size="sm" />
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {field.signature_type ?? '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {field.signed_at
                                ? new Date(field.signed_at).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Storage Details Card */}
            <Card>
              <CardHeader>
                <CardTitle>Storage Information</CardTitle>
                <CardDescription>MinIO storage location</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Bucket</label>
                    <p className="mt-2 text-sm text-gray-900 font-mono">{fileData.bucket}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Storage Key</label>
                    <p className="mt-2 text-sm text-gray-900 font-mono break-all">{fileData.storage_key}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
    </div>
  );
};
