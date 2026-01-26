/**
 * Prepare Page - PDF Signature Field Placement
 * 
 * Zoho Sign-like 3-column layout:
 * - Left: Sidebar (via AppShell)
 * - Center: PDF viewer with field overlays
 * - Right: Field management panel
 * 
 * Features:
 * - PDF viewing with react-pdf
 * - Draggable/resizable signature fields
 * - Coordinate normalization (PDF ↔ screen)
 * - Save fields using existing API
 * - Fetch and re-render fields on reload
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import { Button, StatusBadge } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { getFileDetail, FileDetail } from '../../lib/fileApi';
import { getFileViewUrl } from '../../lib/signatureFieldApi';
import { listSignatureFields, createSignatureField, deleteSignatureField, SignatureField } from '../../lib/signatureFieldApi';
import { SignatureFieldOverlay } from '../../components/pdf/SignatureFieldOverlay';
import { FieldPanel } from '../../components/pdf/FieldPanel';
import { screenToPdf } from '../../utils/pdfCoordinates';

// Set up PDF.js worker - use Vite's ?url import for reliable bundling
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

if (typeof window !== 'undefined') {
  // Use Vite's ?url import - bundles worker correctly in dev and production
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;
}




interface PageInfo {
  pageNumber: number;
  pdfWidth: number; // PDF width in points
  pdfHeight: number; // PDF height in points
  screenWidth: number; // Rendered width in pixels
  screenHeight: number; // Rendered height in pixels
}

export const Prepare: React.FC = () => {
  const { file_id } = useParams<{ file_id: string }>();
  const { user } = useAuth();

  const [fileData, setFileData] = useState<FileDetail | null>(null);
  const [viewUrl, setViewUrl] = useState<string | null>(null);
  const [signatureFields, setSignatureFields] = useState<SignatureField[]>([]);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageInfos, setPageInfos] = useState<Map<number, PageInfo>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlacingField, setIsPlacingField] = useState(false);
  const [fieldType, setFieldType] = useState<string | null>(null);
  const [newFieldStart, setNewFieldStart] = useState<{ page: number; x: number; y: number } | null>(null);
  const [newFieldCurrent, setNewFieldCurrent] = useState<{ x: number; y: number } | null>(null);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [fieldRoles, setFieldRoles] = useState<Record<string, string>>({}); // UI-only role assignment
  const [highlightedFieldId, setHighlightedFieldId] = useState<string | null>(null);

  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Memoize PDF.js options to prevent unnecessary reloads
  const pdfOptions = useMemo(() => ({
    httpHeaders: {},
    withCredentials: false,
    cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
    cMapPacked: true,
  }), []);

  // Fetch file data and view URL
  useEffect(() => {
    const fetchData = async () => {
      if (!file_id) {
        setError('File ID not provided');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const [fileDetail, viewUrlData] = await Promise.all([
          getFileDetail(file_id),
          getFileViewUrl(file_id),
        ]);

        setFileData(fileDetail);
        setViewUrl(viewUrlData.view_url);

        // Use view URL directly - react-pdf handles CORS and blob conversion internally
        // Creating blob URLs can cause ArrayBuffer detachment issues
        // Better to let react-pdf handle the fetch internally

        // Fetch existing signature fields
        const fields = await listSignatureFields(file_id);
        setSignatureFields(fields);
        
        // Initialize roles (UI only) - default to "Signer 1"
        const initialRoles: Record<string, string> = {};
        fields.forEach(field => {
          initialRoles[field.id] = 'Signer 1';
        });
        setFieldRoles(initialRoles);

        setError(null);
      } catch (err: any) {
        console.error('Failed to fetch file data:', err);
        if (err.response?.status === 404) {
          setError('Document not found or you do not have access');
        } else {
          setError(`Failed to load document: ${err.message || 'Unknown error'}`);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [file_id]);

  // Handle PDF document load
  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    console.log('PDF loaded successfully, pages:', numPages);
    setNumPages(numPages);
    setError(null);
  };

  // Handle PDF document load error
  const onDocumentLoadError = (error: Error) => {
    console.error('PDF load error:', error);
    const errorMessage = error.message || 'Unknown error';
    console.error('PDF worker source:', pdfjs.GlobalWorkerOptions.workerSrc);
    console.error('PDF file URL:', viewUrl);
    setError(`Failed to load PDF: ${errorMessage}. Please check if the file exists and is accessible.`);
  };

  // Handle page render - capture dimensions
  const onPageLoadSuccess = useCallback((page: any) => {
    const pageNumber = page._pageIndex + 1;
    const { width: pdfWidth, height: pdfHeight } = page;
    
    // Get rendered dimensions from DOM
    const pageElement = pageRefs.current.get(pageNumber);
    if (pageElement) {
      const rect = pageElement.getBoundingClientRect();
      const screenWidth = rect.width;
      const screenHeight = rect.height;

      setPageInfos((prev) => {
        const next = new Map(prev);
        next.set(pageNumber, {
          pageNumber,
          pdfWidth,
          pdfHeight,
          screenWidth,
          screenHeight,
        });
        return next;
      });
    }
  }, []);

  // Handle start placement
  const handleStartPlacement = (type: string) => {
    setFieldType(type);
    setIsPlacingField(true);
  };

  // Handle cancel placement
  const handleCancelPlacement = () => {
    setIsPlacingField(false);
    setFieldType(null);
    setNewFieldStart(null);
    setNewFieldCurrent(null);
  };

  // Handle page mouse down - start placing new field
  const handlePageMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>, pageNumber: number) => {
    if (!isPlacingField || fileData?.status === 'LOCKED') return;
    e.preventDefault();
    e.stopPropagation();

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    setNewFieldStart({ page: pageNumber, x: clickX, y: clickY });
    setNewFieldCurrent({ x: clickX, y: clickY });
  }, [isPlacingField, fileData]);

  // Handle page mouse move - update field preview
  const handlePageMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>, pageNumber: number) => {
    if (!isPlacingField || !newFieldStart || newFieldStart.page !== pageNumber) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    setNewFieldCurrent({ x: currentX, y: currentY });
  }, [isPlacingField, newFieldStart]);

  // Handle page mouse up - complete field placement
  const handlePageMouseUp = useCallback((_e: React.MouseEvent<HTMLDivElement>, pageNumber: number) => {
    if (!isPlacingField || !newFieldStart || newFieldStart.page !== pageNumber || !newFieldCurrent) return;

    const pageInfo = pageInfos.get(pageNumber);
    if (!pageInfo) return;

    const startX = Math.min(newFieldStart.x, newFieldCurrent.x);
    const startY = Math.min(newFieldStart.y, newFieldCurrent.y);
    const width = Math.abs(newFieldCurrent.x - newFieldStart.x);
    const height = Math.abs(newFieldCurrent.y - newFieldStart.y);

    if (width > 10 && height > 10) {
      // Convert screen coordinates to PDF coordinates
      const pdfCoords = screenToPdf(
        startX,
        startY + height, // Add height for bottom-left origin
        pageInfo.pdfWidth,
        pageInfo.pdfHeight,
        pageInfo.screenWidth,
        pageInfo.screenHeight,
      );

      const pdfDims = {
        width: (width / pageInfo.screenWidth) * pageInfo.pdfWidth,
        height: (height / pageInfo.screenHeight) * pageInfo.pdfHeight,
      };

      handleCreateField(pageNumber, pdfCoords.x, pdfCoords.y, pdfDims.width, pdfDims.height);
    }

    setNewFieldStart(null);
    setNewFieldCurrent(null);
    setIsPlacingField(false);
  }, [isPlacingField, newFieldStart, newFieldCurrent, pageInfos]);

  // Create new signature field
  const handleCreateField = async (
    page: number,
    x: number,
    y: number,
    width: number,
    height: number,
  ) => {
    if (!file_id || !user) return;

    try {
      const newField = await createSignatureField({
        file_id,
        page,
        x,
        y,
        width,
        height,
        assigned_to: user.id, // Assign to current user by default
      });

      setSignatureFields((prev) => [...prev, newField]);
      // Initialize role for new field (UI only)
      setFieldRoles((prev) => ({ ...prev, [newField.id]: 'Signer 1' }));
      setError(null);
    } catch (err: any) {
      console.error('Failed to create signature field:', err);
      setError(err.response?.data?.detail || 'Failed to create signature field');
    }
  };

  // Update signature field position/size
  const handleUpdateField = async (
    fieldId: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ) => {
    // For now, delete and recreate (backend doesn't have update endpoint)
    const field = signatureFields.find((f) => f.id === fieldId);
    if (!field) return;

    try {
      await deleteSignatureField(fieldId);
      await handleCreateField(field.page_number, x, y, width, height);
      setSignatureFields((prev) => prev.filter((f) => f.id !== fieldId));
    } catch (err) {
      console.error('Failed to update field:', err);
    }
  };

  // Delete signature field
  const handleDeleteField = async (fieldId: string) => {
    try {
      await deleteSignatureField(fieldId);
      setSignatureFields((prev) => prev.filter((f) => f.id !== fieldId));
      // Remove role from state
      setFieldRoles((prev) => {
        const next = { ...prev };
        delete next[fieldId];
        return next;
      });
      if (selectedFieldId === fieldId) {
        setSelectedFieldId(null);
      }
    } catch (err: any) {
      console.error('Failed to delete field:', err);
      setError(err.response?.data?.detail || 'Failed to delete signature field');
    }
  };

  // Get fields for a specific page
  const getFieldsForPage = (pageNumber: number): SignatureField[] => {
    return signatureFields.filter((f) => f.page_number === pageNumber);
  };

  // Handle role change (UI only)
  const handleRoleChange = (fieldId: string, role: string) => {
    setFieldRoles((prev) => ({ ...prev, [fieldId]: role }));
  };

  // Handle field select from panel - scroll to field and highlight
  const handleFieldSelect = useCallback((fieldId: string) => {
    setSelectedFieldId(fieldId);
    
    const field = signatureFields.find(f => f.id === fieldId);
    if (!field) return;

    // Find the page element
    const pageElement = pageRefs.current.get(field.page_number);
    if (pageElement) {
      // Scroll to the page
      pageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Highlight the field
      setHighlightedFieldId(fieldId);
      
      // Remove highlight after 2 seconds
      setTimeout(() => {
        setHighlightedFieldId(null);
      }, 2000);
    }
  }, [signatureFields]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // Always render UI - never return null
  // If critical data is missing, show error state but keep page structure
  const hasCriticalError = error && !fileData;
  const hasPartialData = fileData && !viewUrl;

  // Show full error page only if we have no file data at all
  if (hasCriticalError) {
    return (
      <div className="max-w-3xl mx-auto p-8">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
        <Link to="/documents">
          <Button variant="outline" className="mt-4">Back to Documents</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Prepare Document</h1>
          <p className="text-sm text-gray-600 mt-0.5">{fileData?.filename || 'Loading...'}</p>
        </div>
        <div className="flex items-center gap-3">
          {fileData && <StatusBadge status={fileData.status} size="sm" />}
          <Link to={`/documents/${file_id || ''}`}>
            <Button variant="outline" size="sm">Back</Button>
          </Link>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="px-6 py-3 bg-red-50 border-b border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Lock Warning */}
      {fileData?.status === 'LOCKED' && (
        <div className="px-6 py-3 bg-purple-50 border-b border-purple-200 text-sm text-purple-700">
          This document is locked and cannot be modified.
        </div>
      )}

      {/* Main Content: PDF Viewer + Field Panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* PDF Viewer (Center) */}
        <div className="flex-1 overflow-y-auto bg-gray-100 p-6">
          {/* Show error if view URL is missing */}
          {hasPartialData ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md">
                <svg className="mx-auto h-12 w-12 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="mt-4 text-sm font-medium text-gray-900">PDF View URL Not Available</p>
                <p className="mt-2 text-sm text-gray-600">
                  Unable to load PDF view URL. Signature fields can still be managed below.
                </p>
                {error && (
                  <p className="mt-2 text-xs text-red-600">{error}</p>
                )}
              </div>
            </div>
          ) : !viewUrl ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                <p className="mt-4 text-sm text-gray-600">Loading PDF...</p>
              </div>
            </div>
          ) : (
            <Document
              file={viewUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={
                <div className="flex items-center justify-center p-8 min-h-[400px]">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                    <p className="mt-4 text-sm text-gray-600">Loading PDF document...</p>
                  </div>
                </div>
              }
              error={
                <div className="flex items-center justify-center p-8 min-h-[400px]">
                  <div className="text-center">
                    <svg className="mx-auto h-12 w-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="mt-4 text-sm font-medium text-gray-900">Failed to load PDF</p>
                    <p className="mt-2 text-sm text-gray-600">{error || 'Please try refreshing the page or contact support.'}</p>
                    <button
                      onClick={() => window.location.reload()}
                      className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
                    >
                      Refresh Page
                    </button>
                  </div>
                </div>
              }
              className="flex flex-col items-center gap-6 min-h-[400px]"
              options={pdfOptions}
            >
              {numPages && (
                <div className="space-y-6 flex flex-col items-center">
                  {Array.from({ length: numPages }, (_, index) => {
                    const pageNumber = index + 1;
                    const pageInfo = pageInfos.get(pageNumber);
                    const fields = getFieldsForPage(pageNumber);

                    return (
                      <div
                        key={pageNumber}
                        className="relative border border-gray-300 shadow-lg bg-white inline-block"
                        ref={(el) => {
                          if (el) pageRefs.current.set(pageNumber, el);
                        }}
                        onMouseDown={(e) => handlePageMouseDown(e, pageNumber)}
                        onMouseMove={(e) => handlePageMouseMove(e, pageNumber)}
                        onMouseUp={(e) => handlePageMouseUp(e, pageNumber)}
                        onMouseLeave={() => {
                          if (isPlacingField) {
                            handleCancelPlacement();
                          }
                        }}
                        style={{ cursor: isPlacingField ? 'crosshair' : 'default' }}
                      >
                        <Page
                          pageNumber={pageNumber}
                          scale={1.0}
                          onLoadSuccess={onPageLoadSuccess}
                          renderTextLayer={true}
                          renderAnnotationLayer={true}
                          className="block"
                        />

                        {/* Signature Field Overlays */}
                        {pageInfo && fields.map((field) => (
                          <SignatureFieldOverlay
                            key={field.id}
                            field={field}
                            pdfPageWidth={pageInfo.pdfWidth}
                            pdfPageHeight={pageInfo.pdfHeight}
                            screenPageWidth={pageInfo.screenWidth}
                            screenPageHeight={pageInfo.screenHeight}
                            onUpdate={handleUpdateField}
                            onDelete={handleDeleteField}
                            editable={fileData?.status !== 'LOCKED'}
                            role={fieldRoles[field.id] || 'Signer 1'}
                            isHighlighted={highlightedFieldId === field.id}
                          />
                        ))}

                        {/* New field preview */}
                        {isPlacingField &&
                          newFieldStart &&
                          newFieldStart.page === pageNumber &&
                          newFieldCurrent &&
                          pageInfo && (
                            <div
                              className="absolute border-2 border-dashed border-indigo-500 bg-indigo-100 bg-opacity-30 pointer-events-none"
                              style={{
                                left: `${Math.min(newFieldStart.x, newFieldCurrent.x)}px`,
                                top: `${Math.min(newFieldStart.y, newFieldCurrent.y)}px`,
                                width: `${Math.abs(newFieldCurrent.x - newFieldStart.x)}px`,
                                height: `${Math.abs(newFieldCurrent.y - newFieldStart.y)}px`,
                              }}
                            />
                          )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Document>
          )}
        </div>

        {/* Field Panel (Right) - Always render, even if PDF fails */}
        <FieldPanel
          fields={signatureFields}
          isPlacingField={isPlacingField}
          fieldType={fieldType}
          onStartPlacement={handleStartPlacement}
          onCancelPlacement={handleCancelPlacement}
          onDeleteField={handleDeleteField}
          onFieldSelect={handleFieldSelect}
          selectedFieldId={selectedFieldId}
          disabled={fileData?.status === 'LOCKED' || hasPartialData || false}
          fieldRoles={fieldRoles}
          onRoleChange={handleRoleChange}
        />
      </div>
    </div>
  );
};
