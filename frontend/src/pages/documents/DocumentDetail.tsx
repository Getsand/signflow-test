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
import { logger } from '../../utils/logger';

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
  const [pageInfos, setPageInfos] = useState<Map<number, { pdfWidth: number; pdfHeight: number; screenWidth: number; screenHeight: number }>>(new Map());
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Helper function to parse UTC datetime correctly
  const parseUtcDate = (dateString: string): Date => {
    // If the date string doesn't have timezone info, treat it as UTC
    let dateStr = dateString;
    if (!dateStr.includes('Z') && !dateStr.includes('+') && !dateStr.includes('-', 10)) {
      // Append 'Z' to indicate UTC if no timezone info is present
      dateStr = dateStr.endsWith('Z') ? dateStr : dateStr + 'Z';
    }
    return new Date(dateStr);
  };

  // Helper function to format date with time
  const formatDateTime = (dateString: string) => {
    const date = parseUtcDate(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Fetch details function (for initial load - shows loading state)
  const fetchDetails = useCallback(async (showLoading = true) => {
    if (!id) {
      setError('ID not provided');
      setIsLoading(false);
      return;
    }

    try {
      if (showLoading) {
        setIsLoading(true);
      }
      
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
            setIsLoadingPdf(false);
          } catch (fileErr) {
            logger.warn('Failed to fetch file details:', fileErr);
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
            logger.error('Failed to fetch file details:', fileErr);
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
      logger.error('Failed to fetch details:', err);
      if (err.response?.status === 404) {
        setError('Document not found or you do not have access');
      } else if (err.response?.status === 403) {
        setError('Access denied');
      } else {
        setError('Failed to load document details');
      }
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  }, [id]);

  // Fetch details on mount (initial load)
  useEffect(() => {
    fetchDetails(true);
  }, [fetchDetails]);

  // Smart polling: only update if signer status or signature fields actually changed
  useEffect(() => {
    // Clear any existing polling interval
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    // Don't poll if no ID
    if (!id) {
      return;
    }

    // Set up polling interval - only update if data actually changed
    pollingRef.current = setInterval(async () => {
      try {
        // Fetch signing request data
        const signingRequest = await getSigningRequestDetail(id);
        
        // Get current state for comparison (use functional update to get latest state)
        setSigningRequestData((currentData) => {
          // If no current data, set it (initial load)
          if (!currentData) {
            return signingRequest;
          }
          
          // Stop polling if document is completed
          if (signingRequest.status === 'COMPLETED' && currentData.status !== 'COMPLETED') {
            // Clear interval when completed
            if (pollingRef.current) {
              clearInterval(pollingRef.current);
              pollingRef.current = null;
            }
            return signingRequest;
          }
          
          // Check if anything actually changed (signer signed or status changed)
          const signedCountChanged = signingRequest.signed_fields_count !== currentData.signed_fields_count;
          const recipientStatusChanged = signingRequest.recipients.some((r) => {
            const currentRecipient = currentData.recipients.find(cr => cr.id === r.id);
            return currentRecipient && currentRecipient.status !== r.status;
          });
          const statusChanged = signingRequest.status !== currentData.status;
          
          // Only update if something actually changed (signer signed or status changed)
          if (signedCountChanged || recipientStatusChanged || statusChanged) {
            // Also update file details if file_id exists
            if (signingRequest.file_id) {
              Promise.all([
                getFileDetail(signingRequest.file_id),
                getFileViewUrl(signingRequest.file_id),
              ]).then(([fileDetail, viewUrlData]) => {
                setFileData(fileDetail);
                setPdfViewUrl(viewUrlData.view_url);
              }).catch((fileErr) => {
                logger.warn('Failed to fetch file details during polling:', fileErr);
              });
            }
            
            return signingRequest; // Return new data to update state
          }
          
          return currentData; // Return current data if nothing changed (no re-render, no visual refresh)
        });
      } catch (err) {
        // Silently fail during polling
        logger.warn('Polling update failed:', err);
      }
    }, 20000); // Poll every 20 seconds (less frequent to reduce unnecessary checks)

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [id]); // Only depend on id, not on signingRequestData to avoid restarting interval

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
      logger.error('Failed to download PDF:', err);
      setError(err.response?.data?.detail || err.message || 'Failed to download document');
    } finally {
      setIsLoadingPdf(false);
    }
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
    <div className="min-h-screen bg-gray-50">
      {/* Page Header - Zoho Sign style */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Breadcrumb and Title */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                <Link to="/documents" className="hover:text-gray-700">
                  Documents
                </Link>
                <span>/</span>
                <span className="text-gray-900 truncate">
                  {isLoading ? 'Loading...' : signingRequestData?.title || signingRequestData?.filename || fileData?.filename || 'Document'}
                </span>
              </div>
              <h1 className="text-2xl font-semibold text-gray-900 truncate">
                {isLoading ? 'Loading...' : signingRequestData?.title || signingRequestData?.filename || fileData?.filename || 'Document'}
              </h1>
              {signingRequestData && (
                <p className="mt-1 text-sm text-gray-600">
                  {signingRequestData.status === 'DRAFT' && 'Draft'}
                  {signingRequestData.status === 'SENT' && 'Sent for signature'}
                  {signingRequestData.status === 'IN_PROGRESS' && 'In progress'}
                  {signingRequestData.status === 'COMPLETED' && 'Completed'}
                </p>
              )}
            </div>
            
            {/* Download Button */}
            <div className="flex items-center gap-2 ml-6">
              {!isLoading && (signingRequestData || fileData) && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleDownload}
                  disabled={isLoadingPdf || !pdfViewUrl}
                >
                  {isLoadingPdf ? 'Downloading...' : 'Download'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="max-w-[1600px] mx-auto px-6 pt-4">
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
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <>
          {/* Two-Column Layout */}
          {(signingRequestData || fileData) && (
            <div className="max-w-[1600px] mx-auto px-6 py-6">
              <div className="grid grid-cols-1 lg:grid-cols-[7fr_3fr] gap-6">
                {/* Left Column: PDF Preview */}
                <div className="lg:sticky lg:top-20 lg:self-start">
                  {pdfViewUrl ? (
                    <Card className="overflow-hidden">
                      <CardContent className="p-0">
                        <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
                          <h3 className="text-sm font-semibold text-gray-900">PDF Preview</h3>
                        </div>
                        <div className="overflow-y-auto max-h-[calc(100vh-200px)] p-4">
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

                                        {/* Signature Field Overlays - Show all fields (pending and signed) */}
                                        {pageInfo && fields.map((field) => {
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

                                            const isSigned = field.status === 'SIGNED' && field.value;
                                            const isBase64Image = field.value && (
                                              field.value.startsWith('data:image') || 
                                              (field.value.length > 100 && !field.value.includes(' '))
                                            );

                                            return (
                                              <div
                                                key={field.id}
                                                className={`absolute border-2 ${isSigned ? 'border-green-500 bg-white' : 'border-dashed border-indigo-400 bg-indigo-50 bg-opacity-30'}`}
                                                style={{
                                                  left: `${screenPos.x}px`,
                                                  top: `${adjustedY}px`,
                                                  width: `${screenDims.width}px`,
                                                  height: `${screenDims.height}px`,
                                                }}
                                              >
                                                {isSigned ? (
                                                  isBase64Image ? (
                                                    <img
                                                      src={field.value!.startsWith('data:') ? field.value! : `data:image/png;base64,${field.value}`}
                                                      alt="Signature"
                                                      className="w-full h-full object-contain"
                                                      onError={(e) => {
                                                        logger.error('Failed to load signature image:', field.id);
                                                        e.currentTarget.style.display = 'none';
                                                      }}
                                                    />
                                                  ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-xs font-cursive text-gray-900 p-1 break-words">
                                                      {field.value}
                                                    </div>
                                                  )
                                                ) : (
                                                  <div className="w-full h-full flex items-center justify-center text-xs text-indigo-600 font-medium">
                                                    {field.role}
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          } catch (err) {
                                            logger.error('Error rendering signature overlay:', err, field);
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
                  ) : (
                    <Card>
                      <CardContent className="py-12">
                        <div className="text-center text-gray-500">
                          <p>PDF preview not available</p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Right Column: Information */}
                <div className="space-y-6">

                  {/* Status Card */}
                  {signingRequestData && (
                    <Card>
                      <CardContent className="pt-6">
                        <div className="space-y-4">
                          <div>
                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Status</label>
                            <div className="mt-2">
                              <StatusBadge status={signingRequestData.status} />
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Recipients Card */}
                  {signingRequestData && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Recipients</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {signingRequestData.recipients.length === 0 ? (
                          <div className="text-center py-4">
                            <p className="text-sm text-gray-500">No recipients assigned</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {signingRequestData.recipients
                              .sort((a, b) => a.order_index - b.order_index)
                              .map((recipient) => (
                                <div key={recipient.id} className="flex items-center gap-3">
                                  <div className="flex-shrink-0">
                                    {recipient.status === 'SIGNED' ? (
                                      <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center">
                                        <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                      </div>
                                    ) : (
                                      <div className="w-5 h-5 border-2 border-gray-300 rounded-full flex items-center justify-center">
                                        <div className="w-2 h-2 bg-gray-400 rounded-full" />
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900">{recipient.role}</p>
                                    <p className="text-xs text-gray-500 truncate">{recipient.email}</p>
                                  </div>
                                  <div className="flex-shrink-0">
                                    <StatusBadge status={recipient.status} size="sm" />
                                  </div>
                                </div>
                              ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Activity Card */}
                  {signingRequestData && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Activity</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {signingRequestData.sent_at && (
                            <div className="flex items-start gap-3">
                              <div className="w-2 h-2 bg-indigo-500 rounded-full mt-1.5"></div>
                              <div className="flex-1">
                                <p className="text-sm text-gray-900">Sent</p>
                                <p className="text-xs text-gray-500 mt-0.5">{formatDateTime(signingRequestData.sent_at)}</p>
                              </div>
                            </div>
                          )}
                          {signingRequestData.completed_at && (
                            <div className="flex items-start gap-3">
                              <div className="w-2 h-2 bg-green-500 rounded-full mt-1.5"></div>
                              <div className="flex-1">
                                <p className="text-sm text-gray-900">Completed</p>
                                <p className="text-xs text-gray-500 mt-0.5">{formatDateTime(signingRequestData.completed_at)}</p>
                              </div>
                            </div>
                          )}
                          <div className="flex items-start gap-3">
                            <div className="w-2 h-2 bg-gray-400 rounded-full mt-1.5"></div>
                            <div className="flex-1">
                              <p className="text-sm text-gray-900">Created</p>
                              <p className="text-xs text-gray-500 mt-0.5">{formatDateTime(signingRequestData.created_at)}</p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Document Information - Collapsible */}
                  {(signingRequestData || fileData) && (
                    <Card>
                      <CardHeader>
                        <button
                          onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                          className="flex items-center justify-between w-full text-left"
                        >
                          <div>
                            <CardTitle>Document Information</CardTitle>
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
                          <div className="space-y-4">
                            {signingRequestData && (
                              <>
                                <div>
                                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Signing Order</label>
                                  <p className="mt-1 text-sm text-gray-900 capitalize">{signingRequestData.signing_order.toLowerCase()}</p>
                                </div>
                                {signingRequestData.fields && signingRequestData.fields.length > 0 && (
                                  <div>
                                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Signature Fields</label>
                                    <p className="mt-1 text-sm text-gray-900">
                                      {signingRequestData.signed_fields_count} of {signingRequestData.total_signature_fields} completed
                                    </p>
                                  </div>
                                )}
                              </>
                            )}
                            {fileData && (
                              <>
                                <div>
                                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">File Size</label>
                                  <p className="mt-1 text-sm text-gray-900">{formatFileSize(fileData.size)}</p>
                                </div>
                                <div>
                                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">MIME Type</label>
                                  <p className="mt-1 text-sm text-gray-900 font-mono">{fileData.mime_type || '—'}</p>
                                </div>
                                {fileData.document_hash && (
                                  <div>
                                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Document Hash</label>
                                    <p className="mt-1 text-sm text-gray-900 font-mono break-all text-xs">{fileData.document_hash}</p>
                                  </div>
                                )}
                              </>
                            )}
                            <div>
                              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Document ID</label>
                              <p className="mt-1 text-sm text-gray-900 font-mono break-all text-xs">{signingRequestData?.id || fileData?.id || '—'}</p>
                            </div>
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
