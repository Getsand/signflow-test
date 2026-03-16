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
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import { Button } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { getFileDetail, FileDetail } from '../../lib/fileApi';
import { getFileViewUrl } from '../../lib/signatureFieldApi';
import { listSignatureFields, createSignatureField, deleteSignatureField, SignatureField } from '../../lib/signatureFieldApi';
import { SignatureFieldOverlay } from '../../components/pdf/SignatureFieldOverlay';
import { FieldPanel } from '../../components/pdf/FieldPanel';
import { screenToPdf } from '../../utils/pdfCoordinates';
import { getRecipientColor } from '../../utils/recipientColors';
import { logger } from '../../utils/logger';

// Set up PDF.js worker - use Vite's ?url import for reliable bundling
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

if (typeof window !== 'undefined') {
  // Use Vite's ?url import - bundles worker correctly in dev and production
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;
}

// Backend requires assigned_to = real user ID (FK to users). We always use current user and store role (Me, Signer 1, 2) on the field; create_signing_request maps by role.




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
  const navigate = useNavigate();
  const location = useLocation();
  const stateRecipients = (location.state as { recipients?: { role: string; email: string }[] })?.recipients;

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
  const [fieldRoles, setFieldRoles] = useState<Record<string, string>>({}); // fieldId -> Me | Signer 1 | Signer 2 | ...
  const [highlightedFieldId, setHighlightedFieldId] = useState<string | null>(null);
  const [expectedSignerCount, setExpectedSignerCount] = useState<number>(1);
  const [hasLegacyRoleFields, setHasLegacyRoleFields] = useState<boolean>(false);
  const [isRepairingFields, setIsRepairingFields] = useState<boolean>(false);
  // Zoho-style: recipients list (Me + Signer 1, 2, ...), select one then add fields
  const [recipients, setRecipients] = useState<string[]>(['Me', 'Signer 1']);
  const [selectedRecipient, setSelectedRecipient] = useState<string>('Signer 1');

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
        setHasLegacyRoleFields(fields.some((f) => !f.role));

        const initialRoles: Record<string, string> = {};
        const uniqueRecipients = new Set<string>(
          stateRecipients?.map((r) => r.role) ?? ['Me', 'Signer 1']
        );
        // Always ensure 'Me' is included so users can add fields for themselves
        uniqueRecipients.add('Me');
        fields.forEach((field) => {
          const role = field.role ?? (field.assigned_to === (user?.id ?? '') ? 'Me' : 'Signer 1');
          initialRoles[field.id] = role;
          uniqueRecipients.add(role);
        });
        setFieldRoles(initialRoles);
        const sortedRecipients = Array.from(uniqueRecipients).sort((a, b) => {
          if (a === 'Me') return -1;
          if (b === 'Me') return 1;
          const nA = parseInt(a.replace('Signer ', ''), 10) || 0;
          const nB = parseInt(b.replace('Signer ', ''), 10) || 0;
          return nA - nB;
        });
        // Ensure 'Me' is always first, and at least 'Me' and 'Signer 1' exist
        const finalRecipients = sortedRecipients.length > 0 ? sortedRecipients : ['Me', 'Signer 1'];
        if (!finalRecipients.includes('Me')) {
          finalRecipients.unshift('Me');
        }
        setRecipients(finalRecipients);
        setExpectedSignerCount(Math.max(1, Math.min(10, sortedRecipients.length || 2)));

        setError(null);
      } catch (err: any) {
        logger.error('Failed to fetch file data:', err);
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
  }, [file_id, user?.id]);

  // Repair templates created before role support: re-save legacy fields (role=null) with selected UI role.
  const handleRepairLegacyFields = useCallback(async () => {
    if (!file_id || !user) return;
    const legacy = signatureFields.filter((f) => !f.role);
    if (legacy.length === 0) {
      setHasLegacyRoleFields(false);
      return;
    }

    try {
      setIsRepairingFields(true);
      setError(null);

      const newFields: SignatureField[] = [];
      const newRoles: Record<string, string> = { ...fieldRoles };

      for (const oldField of legacy) {
        // Use selectedRecipient for all legacy fields (user should select the correct recipient before repairing)
        const role = selectedRecipient || 'Signer 1';
        // Delete legacy field first
        await deleteSignatureField(oldField.id);

        // Recreate with same geometry + field_type, but with role persisted
        const recreated = await createSignatureField({
          file_id,
          page: oldField.page_number,
          x: oldField.x,
          y: oldField.y,
          width: oldField.width,
          height: oldField.height,
          assigned_to: user.id,
          field_type: (oldField.field_type || 'SIGNATURE') as string,
          role,
        });

        newFields.push(recreated);
        delete newRoles[oldField.id];
        newRoles[recreated.id] = role;
      }

      // Refetch fields from server to ensure state is synchronized
      const refreshedFields = await listSignatureFields(file_id);
      setSignatureFields(refreshedFields);
      
      // Update fieldRoles based on refreshed fields
      const refreshedRoles: Record<string, string> = {};
      refreshedFields.forEach((field) => {
        if (field.role) {
          refreshedRoles[field.id] = field.role;
        }
      });
      setFieldRoles(refreshedRoles);
      setHasLegacyRoleFields(refreshedFields.some((f) => !f.role));
    } catch (err: any) {
      logger.error('Failed to repair legacy fields:', err?.response?.data ?? err);
      const detail = err?.response?.data?.detail;
      const msg =
        typeof detail === 'string'
          ? detail
          : err?.message || 'Failed to repair fields';
      setError(msg);
    } finally {
      setIsRepairingFields(false);
    }
  }, [file_id, user, signatureFields, selectedRecipient]);

  // Handle PDF document load
  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setError(null);
  };

  // Handle PDF document load error
  const onDocumentLoadError = (error: Error) => {
    logger.error('PDF load error:', error);
    const errorMessage = error.message || 'Unknown error';
    logger.error('PDF worker source:', pdfjs.GlobalWorkerOptions.workerSrc);
    logger.error('PDF file URL:', viewUrl);
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

    // Clear preview but keep placement mode active so user can place more fields
    setNewFieldStart(null);
    setNewFieldCurrent(null);
    // Don't cancel placement mode - keep it active for multiple field placement
    // setIsPlacingField(false);
  }, [isPlacingField, newFieldStart, newFieldCurrent, pageInfos]);

  // Create new signature field: assigned_to = current user (required by DB FK), role = selected recipient (Me, Signer 1, 2)
  const handleCreateField = async (
    page: number,
    x: number,
    y: number,
    width: number,
    height: number,
  ) => {
    if (!file_id || !user) return;

    try {
      // Map frontend field ids to backend types (e.g. datepicker -> DATE)
      const backendFieldType = fieldType === 'datepicker' ? 'DATE' : (fieldType ? fieldType.toUpperCase() : 'SIGNATURE');
      const newField = await createSignatureField({
        file_id,
        page,
        x,
        y,
        width,
        height,
        assigned_to: user.id,
        field_type: backendFieldType,
        role: selectedRecipient,
      });

      setSignatureFields((prev) => [...prev, newField]);
      setFieldRoles((prev) => ({ ...prev, [newField.id]: selectedRecipient }));
      setError(null);
    } catch (err: any) {
      logger.error('Failed to create signature field:', err?.response?.data ?? err);
      const detail = err?.response?.data?.detail;
      const msg = typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map((d: { msg?: string }) => d?.msg ?? '').filter(Boolean).join('. ') || 'Validation error'
          : err?.message || 'Failed to create signature field';
      setError(msg);
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
      logger.error('Failed to update field:', err);
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
      logger.error('Failed to delete signature field:', err?.response?.data ?? err);
      const detail = err?.response?.data?.detail;
      const msg = typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map((d: { msg?: string }) => d?.msg ?? '').filter(Boolean).join('. ') || 'Validation error'
          : err?.message || 'Failed to delete signature field';
      setError(msg);
    }
  };

  // Get fields for a specific page
  const getFieldsForPage = (pageNumber: number): SignatureField[] => {
    return signatureFields.filter((f) => f.page_number === pageNumber);
  };

  // Handle recipient change for a placed field (UI only; backend assigned_to stays as created)
  const handleRoleChange = (fieldId: string, role: string) => {
    setFieldRoles((prev) => ({ ...prev, [fieldId]: role }));
    setRecipients((prev) => {
      if (prev.includes(role)) return prev;
      const next = [...prev, role].sort((a, b) => {
        if (a === 'Me') return -1;
        if (b === 'Me') return 1;
        const nA = parseInt(a.replace('Signer ', ''), 10) || 0;
        const nB = parseInt(b.replace('Signer ', ''), 10) || 0;
        return nA - nB;
      });
      // Ensure 'Me' is always included
      if (!next.includes('Me')) {
        next.unshift('Me');
      }
      setExpectedSignerCount((c) => Math.max(c, Math.min(10, next.length)));
      return next;
    });
  };

  const handleAddRecipient = () => {
    // Find the maximum signer number among existing recipients
    const signerNumbers = recipients
      .filter((r) => r.startsWith('Signer '))
      .map((r) => {
        const match = r.match(/^Signer (\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      });
    
    // Get the next index: max number + 1, or 1 if no signers exist
    const maxNumber = signerNumbers.length > 0 ? Math.max(...signerNumbers) : 0;
    const nextIndex = maxNumber + 1;
    
    const newRole = `Signer ${nextIndex}`;
    setRecipients((prev) => [...prev, newRole]);
    setSelectedRecipient(newRole);
    setExpectedSignerCount((c) => Math.min(10, Math.max(c, nextIndex)));
  };

  // Handle recipient removal: delete recipient and all their fields
  const handleRemoveRecipient = useCallback(async (recipientToRemove: string) => {
    // Prevent removing "Me" or the last recipient
    if (recipientToRemove === 'Me' || recipients.length <= 1) {
      return;
    }

    if (!file_id) return;

    try {
      setError(null);

      // Find all fields assigned to this recipient
      const fieldsToDelete = signatureFields.filter((field) => {
        // Check fieldRoles first (UI state), then field.role (backend), fallback to selectedRecipient
        const fieldRole = fieldRoles[field.id] || (field as any).role || selectedRecipient;
        return fieldRole === recipientToRemove;
      });

      // Delete all fields for this recipient
      const deletePromises = fieldsToDelete.map((field) => deleteSignatureField(field.id));
      await Promise.all(deletePromises);

      // Update state: remove fields from signatureFields
      setSignatureFields((prev) => prev.filter((field) => {
        const fieldRole = fieldRoles[field.id] || selectedRecipient;
        return fieldRole !== recipientToRemove;
      }));

      // Remove field roles from state
      setFieldRoles((prev) => {
        const next = { ...prev };
        fieldsToDelete.forEach((field) => {
          delete next[field.id];
        });
        return next;
      });

      // Remove recipient from list (but always keep 'Me')
      setRecipients((prev) => {
        const filtered = prev.filter((r) => r !== recipientToRemove);
        // Ensure 'Me' is always included
        if (!filtered.includes('Me')) {
          filtered.unshift('Me');
        }
        return filtered;
      });

      // If the removed recipient was selected, select another one
      if (selectedRecipient === recipientToRemove) {
        const remainingRecipients = recipients.filter((r) => r !== recipientToRemove);
        // Ensure 'Me' is available as fallback
        setSelectedRecipient(remainingRecipients.includes('Me') ? 'Me' : (remainingRecipients[0] || 'Me'));
      }

      // Clear selected field if it was deleted
      if (selectedFieldId && fieldsToDelete.some((f) => f.id === selectedFieldId)) {
        setSelectedFieldId(null);
      }
    } catch (err: any) {
      logger.error('Failed to remove recipient:', err?.response?.data ?? err);
      const detail = err?.response?.data?.detail;
      const msg = typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map((d: { msg?: string }) => d?.msg ?? '').filter(Boolean).join('. ') || 'Validation error'
          : err?.message || 'Failed to remove recipient';
      setError(msg);
    }
  }, [file_id, recipients, signatureFields, fieldRoles, selectedRecipient, selectedFieldId]);

  // Handle navigation to signing request page (pass recipients from Add Recipients step if available)
  const handleNextToSigners = () => {
    if (!file_id) return;
    navigate(`/signing-requests/new/${file_id}`, {
      state: {
        expectedSignerCount: Math.max(expectedSignerCount, recipients.length),
        recipients: stateRecipients ?? recipients.map((role) => ({ role, email: '' })),
      },
    });
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
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
        <Link to="/documents">
          <Button variant="outline" className="mt-4">Back to Documents</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-white overflow-hidden">
      {/* Header — static, always visible */}
      <div className="shrink-0 flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Prepare Document</h1>
          <p className="text-sm text-gray-500 mt-1">{fileData?.filename || 'Loading...'}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link to={file_id ? `/documents/${file_id}` : '/documents'}>
            <Button variant="outline" size="sm">Back</Button>
          </Link>
        </div>
      </div>

      {/* Recipients summary + Next: Add Signers — static, always visible */}
      <div className="shrink-0 px-6 py-2.5 border-b border-gray-200 bg-gray-50/80">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium text-gray-700">Recipients:</span>
            <span className="text-gray-600">{recipients.join(', ')}</span>
            <span className="text-gray-500 text-xs hidden sm:inline">— Select in right panel, then add fields.</span>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={handleNextToSigners}
            disabled={fileData?.status === 'LOCKED'}
          >
            Next
          </Button>
        </div>
      </div>

      {/* Error Message — static, compact */}
      {error && (
        <div className="shrink-0 px-6 py-2 bg-red-50 border-b border-red-100 text-sm text-red-700 flex items-center gap-2">
          <span className="shrink-0 rounded-full bg-red-200/50 p-0.5 text-xs" aria-hidden>!</span>
          {error}
        </div>
      )}

      {/* Legacy role fields banner (templates created before role support) */}
      {hasLegacyRoleFields && (
        <div className="shrink-0 px-6 py-2 bg-amber-50 border-b border-amber-100 text-sm text-amber-800 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="font-medium">Action needed:</span>{' '}
            This template has older fields without recipient roles. Click “Repair fields” once to fix role mapping for signing requests.
          </div>
          <button
            type="button"
            onClick={handleRepairLegacyFields}
            disabled={isRepairingFields || fileData?.status === 'LOCKED'}
            className="shrink-0 px-3 py-1.5 rounded-md text-xs font-semibold bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-60"
          >
            {isRepairingFields ? 'Repairing…' : 'Repair fields'}
          </button>
        </div>
      )}

      {/* Lock Warning — static */}
      {fileData?.status === 'LOCKED' && (
        <div className="shrink-0 px-6 py-2 bg-violet-50 border-b border-violet-100 text-sm text-violet-700">
          This document is locked and cannot be modified.
        </div>
      )}

      {/* Main Content: fixed height, no outer scroll — only PDF area scrolls */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* PDF Viewer — only this area scrolls (inner scroll) */}
        <div className="flex-1 min-w-0 min-h-0 overflow-y-auto overflow-x-hidden bg-gray-100 p-6">
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
            <div className="flex items-center justify-center min-h-[320px] py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto" />
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
                          // Only clear the preview if user was actively dragging, but don't cancel placement mode
                          if (isPlacingField && newFieldStart) {
                            setNewFieldStart(null);
                            setNewFieldCurrent(null);
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
                            role={fieldRoles[field.id] || (field as any).role || 'Signer 1'}
                            isHighlighted={highlightedFieldId === field.id}
                            accentColor={getRecipientColor(fieldRoles[field.id] || (field as any).role || 'Signer 1')}
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

        {/* Field Panel (Right) — static, always visible, no scroll */}
        <div className="shrink-0 w-80 min-h-0 flex flex-col bg-white border-l border-gray-200">
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
          recipients={recipients}
          recipientEmails={stateRecipients ? Object.fromEntries(stateRecipients.map((r) => [r.role, r.email])) : {}}
          selectedRecipient={selectedRecipient}
          onSelectRecipient={setSelectedRecipient}
          onAddRecipient={handleAddRecipient}
          onRemoveRecipient={handleRemoveRecipient}
          />
        </div>
      </div>
    </div>
  );
};
