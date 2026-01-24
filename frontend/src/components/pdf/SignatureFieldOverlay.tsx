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
    if (!editable || field.status === 'SIGNED') return;

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

  const statusColor = field.status === 'SIGNED' ? 'bg-green-200 border-green-400' : 'bg-blue-200 border-blue-400';
  const cursorStyle = editable && field.status === 'PENDING' ? 'cursor-move' : 'cursor-default';

  return (
    <div
      ref={boxRef}
      className={`absolute ${statusColor} border-2 ${cursorStyle} ${editable && field.status === 'PENDING' ? 'hover:opacity-80' : ''}`}
      style={{
        left: `${screenPos.x}px`,
        top: `${adjustedY}px`,
        width: `${screenDims.width}px`,
        height: `${screenDims.height}px`,
        zIndex: isDragging || isResizing ? 1000 : 100,
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Field label */}
      <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-gray-700 pointer-events-none">
        {field.status === 'SIGNED' ? '✓ Signed' : 'Signature'}
      </div>

      {/* Resize handle (bottom-right corner) */}
      {editable && field.status === 'PENDING' && (
        <div
          className="resize-handle absolute bottom-0 right-0 w-3 h-3 bg-blue-600 cursor-se-resize"
          style={{ transform: 'translate(50%, 50%)' }}
        />
      )}

      {/* Delete button */}
      {editable && field.status === 'PENDING' && onDelete && (
        <button
          className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
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
