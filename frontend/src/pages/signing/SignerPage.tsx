/**
 * Signer Page - Public signing experience
 * 
 * Route: /sign/:token
 * Public route (no authentication required)
 * 
 * Features:
 * - Token validation
 * - PDF viewer (read-only)
 * - Field overlays (only for this recipient)
 * - Signature modal (draw/type)
 * - Sequential signing enforcement
 * - Progress tracking
 * - Completion workflow
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import { getSignerContext, signField, completeSigning, SigningRequestField, SignerContext } from '../../lib/signingApi';
import { pdfToScreen, pdfDimensionsToScreen } from '../../utils/pdfCoordinates';
import { Button } from '../../components/ui';

// Set up PDF.js worker
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;
}

interface PageInfo {
  pageNumber: number;
  pdfWidth: number;
  pdfHeight: number;
  screenWidth: number;
  screenHeight: number;
}

interface SignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (signatureType: 'DRAW' | 'TYPED', signatureData: string) => void;
  fieldLabel?: string;
  fieldType?: string; // Field type to determine input method
}

const SignatureModal: React.FC<SignatureModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  fieldLabel = 'Sign here',
  fieldType = 'SIGNATURE',
}) => {
  // Determine if this field type requires signature input or text input
  const fieldTypeUpper = fieldType?.toUpperCase() || 'SIGNATURE';
  const requiresSignature = ['SIGNATURE', 'INITIAL'].includes(fieldTypeUpper);
  const isDateField = fieldTypeUpper === 'DATE' || fieldTypeUpper === 'DATEPICKER';
  const isEmailField = fieldTypeUpper === 'EMAIL';
  const isTextField = ['TEXT', 'FULLNAME', 'COMPANY'].includes(fieldTypeUpper);
  const [mode, setMode] = useState<'DRAW' | 'TYPED'>('DRAW');
  const [signature, setSignature] = useState<string>('');
  const [typedName, setTypedName] = useState<string>('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  // Set default date when modal opens for date fields
  useEffect(() => {
    if (isOpen && isDateField && !typedName) {
      // Set today's date in YYYY-MM-DD format (required for date input)
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      setTypedName(`${year}-${month}-${day}`);
    }
  }, [isOpen, isDateField]);

  useEffect(() => {
    if (isOpen && mode === 'DRAW' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }
  }, [isOpen, mode]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (mode !== 'DRAW' || !canvasRef.current) return;
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || mode !== 'DRAW' || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
      ctx.stroke();
      setHasSignature(true);
    }
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
    // Always update signature when mouse is released
    if (canvasRef.current) {
      const dataUrl = canvasRef.current.toDataURL('image/png');
      // Check if canvas has any content (not blank)
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        const imageData = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
        const hasContent = imageData.data.some((channel, index) => {
          // Check alpha channel (every 4th byte)
          return index % 4 === 3 && channel > 0;
        });
        if (hasContent) {
          setSignature(dataUrl);
          setHasSignature(true);
        }
      }
    }
  };

  const clearSignature = () => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
    setSignature('');
    setHasSignature(false);
  };

  const handleConfirm = () => {
    // For non-signature fields (date, email, text, etc.), always use typed value
    if (!requiresSignature) {
      if (typedName.trim()) {
        onConfirm('TYPED', typedName.trim());
      } else {
        console.error('Field value is required');
      }
      return;
    }

    // For signature/initial fields, handle draw or typed
    if (mode === 'DRAW') {
      // Always get fresh data from canvas when confirming
      if (canvasRef.current) {
        const dataUrl = canvasRef.current.toDataURL('image/png');
        // Check if canvas has any content
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          const imageData = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
          const hasContent = imageData.data.some((channel, index) => {
            // Check alpha channel (every 4th byte)
            return index % 4 === 3 && channel > 0;
          });
          if (hasContent) {
            // Extract base64 data (remove data:image/png;base64, prefix)
            const base64Data = dataUrl.split(',')[1];
            if (base64Data) {
              onConfirm('DRAW', base64Data);
            } else {
              console.error('Failed to extract base64 data from signature');
            }
          } else {
            console.error('Canvas is blank, cannot confirm empty signature');
          }
        }
      } else {
        console.error('Canvas ref is null');
      }
    } else {
      // TYPED mode for signature/initial
      if (typedName.trim()) {
        onConfirm('TYPED', typedName.trim());
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-semibold mb-4">
          {isDateField ? 'Enter Date' : 
           isEmailField ? 'Enter Email' : 
           isTextField ? 'Enter Text' : 
           'Sign Document'}
        </h2>
        
        {/* Mode Toggle - Only show for SIGNATURE and INITIAL fields */}
        {requiresSignature && (
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => {
                setMode('DRAW');
                clearSignature();
              }}
              className={`flex-1 px-4 py-2 rounded ${
                mode === 'DRAW'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              Draw {fieldType?.toUpperCase() === 'INITIAL' ? 'Initial' : 'Signature'}
            </button>
            <button
              onClick={() => {
                setMode('TYPED');
                setSignature('');
              }}
              className={`flex-1 px-4 py-2 rounded ${
                mode === 'TYPED'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              Type {fieldType?.toUpperCase() === 'INITIAL' ? 'Initial' : 'Signature'}
            </button>
          </div>
        )}

        {/* Field Input - Different based on field type */}
        {requiresSignature ? (
          // Signature/Initial fields - use draw/type
          mode === 'DRAW' ? (
            <div>
              <canvas
                ref={canvasRef}
                width={400}
                height={200}
                className="border border-gray-300 rounded cursor-crosshair w-full"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              />
              <button
                onClick={clearSignature}
                className="mt-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Clear
              </button>
            </div>
          ) : (
            <div>
              <input
                type="text"
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                placeholder={fieldType?.toUpperCase() === 'INITIAL' ? "Type your initial" : "Type your name"}
                className="w-full px-4 py-2 border border-gray-300 rounded text-lg"
                style={{ fontFamily: 'cursive' }}
              />
            </div>
          )
        ) : isDateField ? (
          // Date field - use date picker
          <div>
            <input
              type="date"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded text-lg"
            />
          </div>
        ) : isEmailField ? (
          // Email field - use email input
          <div>
            <input
              type="email"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              placeholder="Enter your email"
              className="w-full px-4 py-2 border border-gray-300 rounded text-lg"
            />
          </div>
        ) : (
          // Text/Fullname/Company fields - use text input
          <div>
            <input
              type="text"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              placeholder={
                fieldType?.toUpperCase() === 'FULLNAME' ? "Enter your full name" :
                fieldType?.toUpperCase() === 'COMPANY' ? "Enter company name" :
                "Enter text"
              }
              className="w-full px-4 py-2 border border-gray-300 rounded text-lg"
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            disabled={
              requiresSignature
                ? ((mode === 'DRAW' && !signature) || (mode === 'TYPED' && !typedName.trim()))
                : !typedName.trim()
            }
            className="flex-1"
          >
            {requiresSignature 
              ? `Confirm ${fieldType?.toUpperCase() === 'INITIAL' ? 'Initial' : 'Signature'}` 
              : isDateField 
                ? 'Confirm Date' 
                : isEmailField 
                  ? 'Confirm Email' 
                  : 'Confirm'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export const SignerPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();

  // Debug: Log component mount
  useEffect(() => {
    console.log('SignerPage mounted with token:', token);
  }, [token]);

  const [context, setContext] = useState<SignerContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageInfos, setPageInfos] = useState<Map<number, PageInfo>>(new Map());
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Load signing context
  useEffect(() => {
    const loadContext = async () => {
      if (!token) {
        setError('Signing token is required');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        console.log('Loading signing context for token:', token);
        const data = await getSignerContext(token);
        console.log('Signing context loaded:', data);
        setContext(data);
      } catch (err: any) {
        console.error('Failed to load signing context:', err);
        console.error('Error details:', err.response?.data);
        if (err.response?.status === 404) {
          setError('This signing link is invalid or has already been used.');
        } else if (err.response?.status === 400) {
          setError(err.response?.data?.detail || 'This signing link has already been used.');
        } else {
          setError(err.response?.data?.detail || err.message || 'Failed to load signing page');
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadContext();
  }, [token]);

  // Handle PDF document load
  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  // Handle page render - capture dimensions
  const onPageRender = useCallback((page: any) => {
    const pageNumber = page._pageIndex + 1;
    const { width: pdfWidth, height: pdfHeight } = page;

    const pageElement = pageRefs.current.get(pageNumber);
    if (!pageElement) return;

    const rect = pageElement.getBoundingClientRect();
    const screenWidth = rect.width;
    const screenHeight = rect.height;

    setPageInfos((prev) => {
      const updated = new Map(prev);
      updated.set(pageNumber, {
        pageNumber,
        pdfWidth,
        pdfHeight,
        screenWidth,
        screenHeight,
      });
      return updated;
    });
  }, []);

  // Get fields for a specific page
  const getFieldsForPage = (pageNumber: number): SigningRequestField[] => {
    if (!context) return [];
    return context.fields.filter((f) => f.page === pageNumber);
  };

  // Get field type label for display
  const getFieldTypeLabel = (fieldType?: string): string => {
    if (!fieldType) return 'Signed';
    const type = fieldType.toUpperCase();
    const labels: Record<string, string> = {
      'SIGNATURE': 'Signed',
      'INITIAL': 'Initialed',
      'DATE': 'Date Added',
      'TEXT': 'Text Entered',
      'EMAIL': 'Email Entered',
      'FULLNAME': 'Name Entered',
      'COMPANY': 'Company Entered',
    };
    return labels[type] || 'Completed';
  };

  // Get field type action text
  const getFieldTypeAction = (fieldType?: string): string => {
    if (!fieldType) return 'sign';
    const type = fieldType.toUpperCase();
    const actions: Record<string, string> = {
      'SIGNATURE': 'sign',
      'INITIAL': 'initial',
      'DATE': 'add date',
      'TEXT': 'enter text',
      'EMAIL': 'enter email',
      'FULLNAME': 'enter name',
      'COMPANY': 'enter company',
    };
    return actions[type] || 'complete';
  };

  // Check if field can be signed (sequential signing check)
  const canSignField = (field: SigningRequestField): boolean => {
    if (field.status === 'SIGNED') return false;
    if (!context) return false;

    // If parallel signing, all fields can be signed
    if (context.signing_order === 'PARALLEL') return true;

    // Sequential signing: check if previous fields are signed
    const allFields = [...context.fields].sort((a, b) => {
      if (a.page !== b.page) return a.page - b.page;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    const currentIndex = allFields.findIndex((f) => f.id === field.id);
    if (currentIndex === -1) return false;

    // Check if all previous fields are signed
    for (let i = 0; i < currentIndex; i++) {
      if (allFields[i].status !== 'SIGNED') {
        return false;
      }
    }

    return true;
  };

  // Handle field click
  const handleFieldClick = (field: SigningRequestField) => {
    if (!canSignField(field)) return;
    setSelectedFieldId(field.id);
  };

  // Handle signature confirmation
  const handleSignatureConfirm = async (
    signatureType: 'DRAW' | 'TYPED',
    signatureData: string
  ) => {
    if (!token || !selectedFieldId || !context) return;

    const selectedField = context.fields.find((f) => f.id === selectedFieldId);
    const requiresSignature = selectedField && ['SIGNATURE', 'INITIAL'].includes(selectedField.field_type?.toUpperCase() || 'SIGNATURE');

    try {
      setIsSigning(true);
      setError(null);

      // For non-signature fields, always use TYPED with the text value
      const finalSignatureType = requiresSignature ? signatureType : 'TYPED';
      const finalData = requiresSignature 
        ? (signatureType === 'DRAW' ? signatureData : signatureData)
        : signatureData; // For text/date/email fields, signatureData is the text value

      const response = await signField(selectedFieldId, token, {
        signature_type: finalSignatureType,
        signature_image_base64: finalSignatureType === 'DRAW' ? finalData : undefined,
        typed_name: finalSignatureType === 'TYPED' ? finalData : undefined,
      });

      // Update context with signed field
      setContext({
        ...context,
        fields: context.fields.map((f) =>
          f.id === selectedFieldId ? response.field : f
        ),
      });

      setSelectedFieldId(null);

      // Check if all fields are signed
      if (response.all_fields_signed) {
        // Auto-complete signing
        await handleComplete();
      }
    } catch (err: any) {
      console.error('Failed to sign field:', err);
      setError(err.response?.data?.detail || 'Failed to sign field');
    } finally {
      setIsSigning(false);
    }
  };

  // Handle completion
  const handleComplete = async () => {
    if (!token) return;

    try {
      setIsCompleting(true);
      await completeSigning(token);
      setShowSuccess(true);
    } catch (err: any) {
      console.error('Failed to complete signing:', err);
      setError(err.response?.data?.detail || 'Failed to complete signing');
    } finally {
      setIsCompleting(false);
    }
  };

  // Calculate progress
  const progress = useMemo(() => {
    if (!context) return { signed: 0, total: 0 };
    const signed = context.fields.filter((f) => f.status === 'SIGNED').length;
    return { signed, total: context.fields.length };
  }, [context]);

  // Check if all fields are signed
  const allFieldsSigned = useMemo(() => {
    if (!context) return false;
    return context.fields.every((f) => f.status === 'SIGNED');
  }, [context]);

  // Success screen
  if (showSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            Signing Complete
          </h1>
          <p className="text-gray-600 mb-6">
            You have successfully signed this document.
          </p>
          <p className="text-sm text-gray-500">
            You can close this page now.
          </p>
        </div>
      </div>
    );
  }

  // Error screen
  if (error && !isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            Invalid Signing Link
          </h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  // Loading screen
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading document...</p>
          {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
        </div>
      </div>
    );
  }

  // If not loading but no context and no error, something went wrong
  if (!context && !error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            Unable to Load Document
          </h1>
          <p className="text-gray-600">Please try again later.</p>
        </div>
      </div>
    );
  }

  const selectedField = selectedFieldId
    ? context.fields.find((f) => f.id === selectedFieldId)
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              {context.signing_request.title}
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Signing as: {context.recipient.role} ({context.recipient.email})
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium text-gray-900">
              {progress.signed} of {progress.total} fields signed
            </div>
            <div className="w-32 h-2 bg-gray-200 rounded-full mt-2">
              <div
                className="h-2 bg-indigo-600 rounded-full transition-all"
                style={{ width: `${(progress.signed / progress.total) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-3">
          <div className="max-w-6xl mx-auto text-sm text-red-700">{error}</div>
        </div>
      )}

      {/* PDF Viewer */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {context.pdf_view_url && (
          <Document
            file={context.pdf_view_url}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              </div>
            }
            className="flex flex-col items-center gap-6"
          >
            {numPages &&
              Array.from({ length: numPages }, (_, index) => {
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

                    {/* Field Overlays */}
                    {pageInfo &&
                      fields.map((field) => {
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
                        const canSign = canSignField(field);
                        const isSigned = field.status === 'SIGNED';

                        return (
                          <div
                            key={field.id}
                            onClick={() => handleFieldClick(field)}
                            className={`absolute border-2 rounded ${
                              isSigned
                                ? 'border-green-500 bg-green-50'
                                : canSign
                                ? 'border-indigo-500 bg-indigo-50 cursor-pointer hover:bg-indigo-100'
                                : 'border-gray-300 bg-gray-100 opacity-50 cursor-not-allowed'
                            }`}
                            style={{
                              left: `${screenPos.x}px`,
                              top: `${adjustedY}px`,
                              width: `${screenDims.width}px`,
                              height: `${screenDims.height}px`,
                            }}
                          >
                            <div className="absolute inset-0 flex items-center justify-center text-xs">
                              {isSigned ? (
                                <span className="text-green-700 font-medium">✓ {getFieldTypeLabel(field.field_type)}</span>
                              ) : canSign ? (
                                <span className="text-indigo-700">Click to {getFieldTypeAction(field.field_type)}</span>
                              ) : (
                                <span className="text-gray-500">Complete previous fields first</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                );
              })}
          </Document>
        )}
      </div>

      {/* Footer with Complete Button */}
      {allFieldsSigned && !showSuccess && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <p className="text-sm text-gray-600">
              All fields signed. Click below to complete.
            </p>
            <Button
              variant="primary"
              onClick={handleComplete}
              disabled={isCompleting}
            >
              {isCompleting ? 'Completing...' : 'Finish Signing'}
            </Button>
          </div>
        </div>
      )}

      {/* Signature Modal */}
      <SignatureModal
        isOpen={!!selectedFieldId}
        onClose={() => setSelectedFieldId(null)}
        onConfirm={handleSignatureConfirm}
        fieldLabel={selectedField ? `${getFieldTypeLabel(selectedField.field_type)} - ${selectedField.role}` : 'Sign here'}
        fieldType={selectedField?.field_type}
      />
    </div>
  );
};
