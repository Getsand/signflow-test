/**
 * DocumentDetail Page
 * 
 * Displays detailed information about a signing request:
 * - Signing request metadata
 * - Status and recipients
 * - File information
 * - Signature fields (read-only)
 * 
 * Handles both file IDs and signing request IDs
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, StatusBadge } from '../../components/ui';
import { getFileDetail, FileDetail } from '../../lib/fileApi';
import { getFileViewUrl } from '../../lib/signatureFieldApi';
import { getSigningRequestDetail, SigningRequestDetail, SigningRequestField, downloadSignedPdf } from '../../lib/signingRequestApi';
import { pdfToScreen, pdfDimensionsToScreen } from '../../utils/pdfCoordinates';

// Set up PDF.js worker
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;
}

export const DocumentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [fileData, setFileData] = useState<FileDetail | null>(null);
  const [signingRequestData, setSigningRequestData] = useState<SigningRequestDetail | null>(null);
  const [pdfViewUrl, setPdfViewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [showPdfViewer, setShowPdfViewer] = useState(false);
  const [pageInfos, setPageInfos] = useState<Map<number, { pdfWidth: number; pdfHeight: number; screenWidth: number; screenHeight: number }>>(new Map());
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  // Fetch details on mount - try signing request first, then file
  useEffect(() => {
    const fetchDetails = async () => {
      if (!id) {
        setError('ID not provided');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        
        // Try to fetch as signing request first
        try {
          const signingRequest = await getSigningRequestDetail(id);
          setSigningRequestData(signingRequest);
          
          // Also fetch file details and PDF view URL for the associated file
          if (signingRequest.file_id) {
            try {
              const [fileDetail, viewUrlData] = await Promise.all([
                getFileDetail(signingRequest.file_id),
                getFileViewUrl(signingRequest.file_id),
              ]);
              setFileData(fileDetail);
              setPdfViewUrl(viewUrlData.view_url);
            } catch (fileErr) {
              console.warn('Failed to fetch file details:', fileErr);
              // Continue without file details
            }
          }
          
          setError(null);
        } catch (signingRequestErr: any) {
          // If signing request fails, try as file ID
          if (signingRequestErr.response?.status === 404) {
            try {
              const [fileDetail, viewUrlData] = await Promise.all([
                getFileDetail(id),
                getFileViewUrl(id),
              ]);
              setFileData(fileDetail);
              setPdfViewUrl(viewUrlData.view_url);
              setError(null);
            } catch (fileErr: any) {
              console.error('Failed to fetch file details:', fileErr);
              if (fileErr.response?.status === 404) {
                setError('Document not found or you do not have access');
              } else if (fileErr.response?.status === 403) {
                setError('Access denied');
              } else {
                setError('Failed to load document details');
              }
            }
          } else {
            throw signingRequestErr;
          }
        }
      } catch (err: any) {
        console.error('Failed to fetch details:', err);
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

    fetchDetails();
  }, [id]);

  // Format file size
  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Handle PDF download
  const handleDownload = async () => {
    try {
      setIsLoadingPdf(true);
      
      // If we have a signing request, download the signed PDF with embedded signatures
      if (signingRequestData?.id) {
        const blob = await downloadSignedPdf(signingRequestData.id);
        
        // Create download link
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = signingRequestData.filename || 'document.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else if (fileData?.id) {
        // For regular files, use the view URL
        if (!pdfViewUrl) {
          const viewUrlData = await getFileViewUrl(fileData.id);
          setPdfViewUrl(viewUrlData.view_url);
        }
        
        const response = await fetch(pdfViewUrl!);
        if (!response.ok) {
          throw new Error(`Failed to fetch PDF: ${response.statusText}`);
        }
        const blob = await response.blob();
        
        // Create download link
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileData.filename || 'document.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else {
        setError('No file available for download');
      }
    } catch (err: any) {
      console.error('Failed to download PDF:', err);
      setError(err.response?.data?.detail || err.message || 'Failed to download document');
    } finally {
      setIsLoadingPdf(false);
    }
  };

  // Handle PDF view toggle
  const handleViewPdf = async () => {
    if (showPdfViewer) {
      setShowPdfViewer(false);
      return;
    }

    // If PDF URL not loaded yet, fetch it
    if (!pdfViewUrl && (fileData?.id || signingRequestData?.file_id)) {
      try {
        setIsLoadingPdf(true);
        const fileId = fileData?.id || signingRequestData?.file_id;
        if (fileId) {
          const viewUrlData = await getFileViewUrl(fileId);
          setPdfViewUrl(viewUrlData.view_url);
        }
      } catch (err) {
        console.error('Failed to load PDF view URL:', err);
        setError('Failed to load PDF');
      } finally {
        setIsLoadingPdf(false);
      }
    }
    
    setShowPdfViewer(true);
  };

  // Handle PDF document load
  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  // Handle page render to get dimensions
  const onPageRender = useCallback((page: any) => {
    const pageNumber = page.pageNumber;
    const pageElement = pageRefs.current.get(pageNumber);
    if (!pageElement) return;

    const rect = pageElement.getBoundingClientRect();
    setPageInfos((prev) => {
      const newMap = new Map(prev);
      newMap.set(pageNumber, {
        pdfWidth: page.width,
        pdfHeight: page.height,
        screenWidth: rect.width,
        screenHeight: rect.height,
      });
      return newMap;
    });
  }, []);

  // Get fields for a specific page
  const getFieldsForPage = (pageNumber: number): SigningRequestField[] => {
    if (!signingRequestData?.fields) return [];
    return signingRequestData.fields.filter((f) => f.page === pageNumber);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-6">
        {/* Page Header - Zoho Sign style */}
        <div className="flex items-start justify-between pb-6 border-b border-gray-200">
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-bold text-gray-900 truncate">
              {isLoading ? 'Loading...' : signingRequestData?.title || signingRequestData?.filename || fileData?.filename || 'Document'}
            </h1>
            <p className="mt-1.5 text-sm text-gray-500">
              Signing request details
            </p>
          </div>
          <div className="flex items-center gap-3 ml-6">
            {/* View PDF Button - Primary action */}
            {!isLoading && (signingRequestData?.status === 'SENT' || signingRequestData?.status === 'IN_PROGRESS' || signingRequestData?.status === 'COMPLETED' || fileData) && (
              <Button
                variant="primary"
                onClick={handleViewPdf}
                disabled={isLoadingPdf}
              >
                {showPdfViewer ? 'Hide PDF' : 'View PDF'}
              </Button>
            )}
            {/* Download Button - Show only if COMPLETED */}
            {!isLoading && signingRequestData?.status === 'COMPLETED' && (
              <Button
                variant="secondary"
                onClick={handleDownload}
                disabled={isLoadingPdf || !pdfViewUrl}
              >
                {isLoadingPdf ? 'Downloading...' : 'Download'}
              </Button>
            )}
            <Link to="/documents">
              <Button variant="ghost" size="sm">
                Back
              </Button>
            </Link>
          </div>
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

        {/* Signing Request Details */}
        {!isLoading && signingRequestData && (
          <>
            {/* Status Summary Card - 2-column grid */}
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Status</label>
                    <div className="mt-2">
                      <StatusBadge status={signingRequestData.status} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Signing Order</label>
                    <p className="mt-2 text-sm text-gray-900 capitalize">{signingRequestData.signing_order.toLowerCase()}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Created</label>
                    <p className="mt-2 text-sm text-gray-900">
                      {new Date(signingRequestData.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  {signingRequestData.sent_at ? (
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Sent</label>
                      <p className="mt-2 text-sm text-gray-900">
                        {new Date(signingRequestData.sent_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Sent</label>
                      <p className="mt-2 text-sm text-gray-400">—</p>
                    </div>
                  )}
                  {signingRequestData.completed_at ? (
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Completed</label>
                      <p className="mt-2 text-sm text-gray-900">
                        {new Date(signingRequestData.completed_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Completed</label>
                      <p className="mt-2 text-sm text-gray-400">—</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Recipients Section - Timeline style */}
            <Card>
              <CardHeader>
                <CardTitle>Recipients</CardTitle>
                <CardDescription>
                  {signingRequestData.recipients.length === 0
                    ? 'No recipients'
                    : `${signingRequestData.recipients.length} recipient${signingRequestData.recipients.length !== 1 ? 's' : ''}`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {signingRequestData.recipients.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-gray-500">No recipients assigned</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {signingRequestData.recipients
                      .sort((a, b) => a.order_index - b.order_index)
                      .map((recipient, index) => (
                        <div key={recipient.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                          {/* Left: Status icon */}
                          <div className="flex-shrink-0">
                            {recipient.status === 'SIGNED' ? (
                              <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                                <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              </div>
                            ) : (
                              <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center">
                                <div className="w-2 h-2 bg-gray-400 rounded-full" />
                              </div>
                            )}
                          </div>
                          {/* Middle: Role and email */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {signingRequestData.signing_order === 'SEQUENTIAL' && (
                                <span className="text-xs font-medium text-gray-400">{index + 1}.</span>
                              )}
                              <p className="text-sm font-medium text-gray-900">{recipient.role}</p>
                            </div>
                            <p className="text-sm text-gray-500 truncate mt-0.5">{recipient.email}</p>
                          </div>
                          {/* Right: Status badge */}
                          <div className="flex-shrink-0">
                            <StatusBadge status={recipient.status} size="sm" />
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Signature Progress */}
            <Card>
              <CardHeader>
                <CardTitle>Signature Progress</CardTitle>
              </CardHeader>
              <CardContent>
                {signingRequestData.total_signature_fields === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-sm text-gray-500">No signature fields</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                        style={{ width: `${(signingRequestData.signed_fields_count / signingRequestData.total_signature_fields) * 100}%` }}
                      />
                    </div>
                    <p className="text-sm text-gray-600 text-center">
                      {signingRequestData.signed_fields_count} of {signingRequestData.total_signature_fields} fields completed
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Signature Fields Table */}
            {signingRequestData.fields && signingRequestData.fields.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Signature Fields</CardTitle>
                  <CardDescription>
                    {signingRequestData.fields.length} field{signingRequestData.fields.length !== 1 ? 's' : ''} total
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Page</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Size</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Signed At</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {signingRequestData.fields.map((field) => (
                          <tr key={field.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900">{field.page}</td>
                            <td className="px-4 py-3 text-sm text-gray-600 font-mono text-xs">
                              {field.x.toFixed(0)}, {field.y.toFixed(0)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 font-mono text-xs">
                              {field.width.toFixed(0)} × {field.height.toFixed(0)}
                            </td>
                            <td className="px-4 py-3">
                              <StatusBadge status={field.status} size="sm" />
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 capitalize">
                              {field.field_type?.toLowerCase() ?? '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {field.signed_at
                                ? new Date(field.signed_at).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : <span className="text-gray-400">—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* PDF Viewer Section */}
        {!isLoading && showPdfViewer && pdfViewUrl && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Document Preview</CardTitle>
                  <CardDescription>View the PDF document</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPdfViewer(false)}
                >
                  Hide PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center gap-4">
                {isLoadingPdf ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                  </div>
                ) : (
                  <Document
                    file={pdfViewUrl}
                    onLoadSuccess={onDocumentLoadSuccess}
                    loading={
                      <div className="flex items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                      </div>
                    }
                    className="flex flex-col items-center gap-4"
                  >
                    {numPages && (
                      <div className="space-y-4">
                        {Array.from({ length: numPages }, (_, index) => {
                          const pageNumber = index + 1;
                          const pageInfo = pageInfos.get(pageNumber);
                          const fields = getFieldsForPage(pageNumber);

                          return (
                            <div
                              key={pageNumber}
                              ref={(el) => {
                                if (el) pageRefs.current.set(pageNumber, el);
                              }}
                              className="relative border border-gray-300 shadow-sm bg-white"
                            >
                              <Page
                                pageNumber={pageNumber}
                                scale={1.0}
                                onLoadSuccess={onPageRender}
                                renderTextLayer={true}
                                renderAnnotationLayer={true}
                                className="relative"
                              />

                              {/* Signature Overlays */}
                              {pageInfo &&
                                fields
                                  .filter((f) => f && f.status === 'SIGNED' && f.value)
                                  .map((field) => {
                                    try {
                                      const screenPos = pdfToScreen(
                                        field.x,
                                        field.y,
                                        pageInfo.pdfWidth,
                                        pageInfo.pdfHeight,
                                        pageInfo.screenWidth,
                                        pageInfo.screenHeight
                                      );
                                      const screenDims = pdfDimensionsToScreen(
                                        field.width,
                                        field.height,
                                        pageInfo.pdfWidth,
                                        pageInfo.pdfHeight,
                                        pageInfo.screenWidth,
                                        pageInfo.screenHeight
                                      );
                                      const adjustedY = screenPos.y - screenDims.height;

                                      // Check if value is base64 image or typed text
                                      // Base64 images are long strings without spaces, typed names are short with spaces
                                      const isBase64Image = field.value && (
                                        field.value.startsWith('data:image') || 
                                        (field.value.length > 100 && !field.value.includes(' '))
                                      );

                                      return (
                                        <div
                                          key={field.id}
                                          className="absolute border-2 border-green-500 bg-white"
                                          style={{
                                            left: `${screenPos.x}px`,
                                            top: `${adjustedY}px`,
                                            width: `${screenDims.width}px`,
                                            height: `${screenDims.height}px`,
                                          }}
                                        >
                                          {isBase64Image ? (
                                            <img
                                              src={field.value!.startsWith('data:') ? field.value! : `data:image/png;base64,${field.value}`}
                                              alt="Signature"
                                              className="w-full h-full object-contain"
                                              onError={(e) => {
                                                console.error('Failed to load signature image:', field.id);
                                                // Fallback to text if image fails
                                                e.currentTarget.style.display = 'none';
                                              }}
                                            />
                                          ) : (
                                            <div className="w-full h-full flex items-center justify-center text-xs font-cursive text-gray-900 p-1 break-words">
                                              {field.value}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    } catch (err) {
                                      console.error('Error rendering signature overlay:', err, field);
                                      return null;
                                    }
                                  })}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Document>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* File Details (shown if fileData exists, regardless of signing request) */}
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

            {/* File Status Card (only if no signing request) */}
            {!signingRequestData && (
              <Card>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Status</label>
                      <div className="mt-2">
                        <StatusBadge status={fileData.status} />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">File Size</label>
                      <p className="mt-2 text-sm text-gray-900">{formatFileSize(fileData.size)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Signature Fields Table (for file data, not signing request) */}
            {!signingRequestData && fileData.signature_fields.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Signature Fields</CardTitle>
                  <CardDescription>
                    {fileData.signature_fields.length} field{fileData.signature_fields.length !== 1 ? 's' : ''} total
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Page</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Size</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Signed At</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {fileData.signature_fields.map((field) => (
                          <tr key={field.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900">{field.page_number}</td>
                            <td className="px-4 py-3 text-sm text-gray-600 font-mono text-xs">
                              {field.x.toFixed(0)}, {field.y.toFixed(0)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 font-mono text-xs">
                              {field.width.toFixed(0)} × {field.height.toFixed(0)}
                            </td>
                            <td className="px-4 py-3">
                              <StatusBadge status={field.status} size="sm" />
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 capitalize">
                              {field.signature_type?.toLowerCase() ?? <span className="text-gray-400">—</span>}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {field.signed_at
                                ? new Date(field.signed_at).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : <span className="text-gray-400">—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Technical Details - Collapsible Accordion */}
            <Card>
              <CardHeader>
                <button
                  onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                  className="flex items-center justify-between w-full text-left"
                >
                  <div>
                    <CardTitle>Technical Details</CardTitle>
                    <CardDescription>Document metadata and storage information</CardDescription>
                  </div>
                  <svg
                    className={`w-5 h-5 text-gray-500 transition-transform ${showTechnicalDetails ? 'transform rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </CardHeader>
              {showTechnicalDetails && (
                <CardContent>
                  <div className="space-y-6 pt-2">
                    {/* Document Information */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-4">Document Information</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">File Size</label>
                          <p className="mt-1.5 text-sm text-gray-900">{formatFileSize(fileData?.size || null)}</p>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">MIME Type</label>
                          <p className="mt-1.5 text-sm text-gray-900 font-mono">{fileData?.mime_type || '—'}</p>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Created</label>
                          <p className="mt-1.5 text-sm text-gray-900">
                            {fileData?.created_at
                              ? new Date(fileData.created_at).toLocaleString('en-US', {
                                  dateStyle: 'medium',
                                  timeStyle: 'short',
                                })
                              : '—'}
                          </p>
                        </div>
                        {fileData?.document_hash && (
                          <div className="md:col-span-2">
                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Document Hash (SHA256)</label>
                            <p className="mt-1.5 text-sm text-gray-900 font-mono break-all">{fileData.document_hash}</p>
                          </div>
                        )}
                        <div className="md:col-span-2">
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Document ID</label>
                          <p className="mt-1.5 text-sm text-gray-900 font-mono break-all">{fileData?.id || signingRequestData?.id || '—'}</p>
                        </div>
                        {signingRequestData && (
                          <div className="md:col-span-2">
                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Signing Request ID</label>
                            <p className="mt-1.5 text-sm text-gray-900 font-mono break-all">{signingRequestData.id}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Storage Information */}
                    {fileData && (
                      <div className="border-t border-gray-200 pt-6">
                        <h4 className="text-sm font-medium text-gray-900 mb-4">Storage Information</h4>
                        <div className="space-y-4">
                          <div>
                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Bucket</label>
                            <p className="mt-1.5 text-sm text-gray-900 font-mono">{fileData.bucket}</p>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Storage Key</label>
                            <p className="mt-1.5 text-sm text-gray-900 font-mono break-all">{fileData.storage_key}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          </>
        )}
    </div>
  );
};
