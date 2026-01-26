/**
 * Signature Field Overlay Component
 * 
 * Draggable and resizable signature field box that overlays on PDF pages.
 * Handles coordinate conversion between screen and PDF space.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { SignatureField } from '../../lib/signatureFieldApi';
import { pdfToScreen, screenToPdf, pdfDimensionsToScreen, screenDimensionsToPdf } from '../../utils/pdfCoordinates';

interface SignatureFieldOverlayProps {
  field: SignatureField;
  pdfPageWidth: number; // PDF page width in points
  pdfPageHeight: number; // PDF page height in points
  screenPageWidth: number; // Rendered page width in pixels
  screenPageHeight: number; // Rendered page height in pixels
  onUpdate?: (fieldId: string, x: number, y: number, width: number, height: number) => void;
  onDelete?: (fieldId: string) => void;
  editable?: boolean;
  role?: string; // UI-only role assignment (default: "Signer 1")
  isHighlighted?: boolean; // For scroll-to-field highlight effect
}

/**
 * SignatureFieldOverlay - Draggable/resizable signature field box
 */
export const SignatureFieldOverlay: React.FC<SignatureFieldOverlayProps> = ({
  field,
  pdfPageWidth,
  pdfPageHeight,
  screenPageWidth,
  screenPageHeight,
  onUpdate,
  onDelete,
  editable = true,
  role = 'Signer 1',
  isHighlighted = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const boxRef = useRef<HTMLDivElement>(null);

  // Convert PDF coordinates to screen coordinates
  const screenPos = pdfToScreen(
    field.x,
    field.y,
    pdfPageWidth,
    pdfPageHeight,
    screenPageWidth,
    screenPageHeight,
  );

  const screenDims = pdfDimensionsToScreen(
    field.width,
    field.height,
    pdfPageWidth,
    pdfPageHeight,
    screenPageWidth,
    screenPageHeight,
  );

  // Adjust Y position: PDF Y is bottom-left, but we need to account for box height
  const adjustedY = screenPos.y - screenDims.height;

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!editable || field.status === 'SIGNED') return;

    e.preventDefault();
    e.stopPropagation();

    if ((e.target as HTMLElement).classList.contains('resize-handle')) {
      // Start resizing
      setIsResizing(true);
      setResizeStart({
        x: e.clientX,
        y: e.clientY,
        width: screenDims.width,
        height: screenDims.height,
      });
    } else {
      // Start dragging
      setIsDragging(true);
      setDragStart({
        x: e.clientX - screenPos.x,
        y: e.clientY - adjustedY,
      });
    }
  }, [editable, field.status, screenPos.x, adjustedY, screenDims.width, screenDims.height]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const isLocked = field.status === 'SIGNED' || !editable;
    if (isLocked) return;

    if (isDragging) {
      const newScreenX = e.clientX - dragStart.x;
      const newScreenY = e.clientY - dragStart.y;

      // Convert to PDF coordinates
      const pdfCoords = screenToPdf(
        newScreenX,
        newScreenY + screenDims.height, // Add height back for bottom-left origin
        pdfPageWidth,
        pdfPageHeight,
        screenPageWidth,
        screenPageHeight,
      );

      if (onUpdate) {
        onUpdate(field.id, pdfCoords.x, pdfCoords.y, field.width, field.height);
      }
    } else if (isResizing) {
      const deltaX = e.clientX - resizeStart.x;
      const deltaY = e.clientY - resizeStart.y;

      const newScreenWidth = Math.max(50, resizeStart.width + deltaX);
      const newScreenHeight = Math.max(30, resizeStart.height + deltaY);

      // Convert to PDF dimensions
      const pdfDims = screenDimensionsToPdf(
        newScreenWidth,
        newScreenHeight,
        pdfPageWidth,
        pdfPageHeight,
        screenPageWidth,
        screenPageHeight,
      );

      if (onUpdate) {
        onUpdate(field.id, field.x, field.y, pdfDims.width, pdfDims.height);
      }
    }
  }, [isDragging, isResizing, dragStart, resizeStart, field, pdfPageWidth, pdfPageHeight, screenPageWidth, screenPageHeight, screenDims.height, onUpdate, editable]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp]);

  // Determine field state styling
  const isLocked = field.status === 'SIGNED' || !editable;
  const isPending = field.status === 'PENDING' && editable;
  
  // Zoho-like styling: light blue background, blue dashed border
  const baseStyles = isLocked
    ? 'bg-gray-100 border-gray-300 cursor-not-allowed'
    : 'bg-[#EAF3FF] border-[#4F8DF7] cursor-move';
  
  const borderStyle = isLocked ? 'border-2 border-solid' : 'border-2 border-dashed';
  const highlightStyle = isHighlighted ? 'ring-2 ring-blue-500 ring-offset-2' : '';

  return (
    <div
      ref={boxRef}
      className={`absolute ${baseStyles} ${borderStyle} rounded-md ${highlightStyle} ${isPending ? 'hover:opacity-90' : ''}`}
      style={{
        left: `${screenPos.x}px`,
        top: `${adjustedY}px`,
        width: `${screenDims.width}px`,
        height: `${screenDims.height}px`,
        zIndex: isDragging || isResizing ? 1000 : 100,
        borderRadius: '6px',
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Role badge (top-left) */}
      <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-medium text-gray-600 pointer-events-none">
        {role}
      </div>

      {/* Field content: pen icon + "Sign here" text */}
      <div className="absolute inset-0 flex items-center justify-center gap-1.5 pointer-events-none">
        {field.status === 'SIGNED' ? (
          <div className="flex items-center gap-1.5 text-xs font-medium text-green-700">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Signed</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            <span>Sign here</span>
          </div>
        )}
      </div>

      {/* Resize handle (bottom-right corner) */}
      {isPending && (
        <div
          className="resize-handle absolute bottom-0 right-0 w-3 h-3 bg-[#4F8DF7] cursor-se-resize rounded-br-md"
          style={{ transform: 'translate(50%, 50%)' }}
        />
      )}

      {/* Delete button */}
      {isPending && onDelete && (
        <button
          className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 shadow-sm"
          onClick={(e) => {
            e.stopPropagation();
            if (onDelete) onDelete(field.id);
          }}
        >
          ×
        </button>
      )}
    </div>
  );
};
