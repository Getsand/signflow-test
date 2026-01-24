/**
 * PDF Coordinate Utilities
 * 
 * Handles conversion between PDF coordinates (points) and screen coordinates (pixels).
 * 
 * PDF coordinates are in points (1/72 inch), typically:
 * - Standard page: 612 x 792 points (8.5" x 11")
 * - Coordinates start at bottom-left (0,0) in PDF space
 * - React-PDF renders with top-left (0,0) origin
 * 
 * Screen coordinates are in pixels, with top-left origin.
 */

/**
 * Convert PDF coordinates to screen coordinates
 * 
 * @param pdfX - X coordinate in PDF points
 * @param pdfY - Y coordinate in PDF points (bottom-left origin)
 * @param pdfWidth - PDF page width in points
 * @param pdfHeight - PDF page height in points
 * @param screenWidth - Rendered page width in pixels
 * @param screenHeight - Rendered page height in pixels
 * @returns Screen coordinates { x, y } in pixels (top-left origin)
 */
export function pdfToScreen(
  pdfX: number,
  pdfY: number,
  pdfWidth: number,
  pdfHeight: number,
  screenWidth: number,
  screenHeight: number,
): { x: number; y: number } {
  const scaleX = screenWidth / pdfWidth;
  const scaleY = screenHeight / pdfHeight;

  // PDF Y is bottom-left, screen Y is top-left
  const screenX = pdfX * scaleX;
  const screenY = (pdfHeight - pdfY) * scaleY;

  return { x: screenX, y: screenY };
}

/**
 * Convert screen coordinates to PDF coordinates
 * 
 * @param screenX - X coordinate in screen pixels (top-left origin)
 * @param screenY - Y coordinate in screen pixels (top-left origin)
 * @param pdfWidth - PDF page width in points
 * @param pdfHeight - PDF page height in points
 * @param screenWidth - Rendered page width in pixels
 * @param screenHeight - Rendered page height in pixels
 * @returns PDF coordinates { x, y } in points (bottom-left origin)
 */
export function screenToPdf(
  screenX: number,
  screenY: number,
  pdfWidth: number,
  pdfHeight: number,
  screenWidth: number,
  screenHeight: number,
): { x: number; y: number } {
  const scaleX = pdfWidth / screenWidth;
  const scaleY = pdfHeight / screenHeight;

  // Screen Y is top-left, PDF Y is bottom-left
  const pdfX = screenX * scaleX;
  const pdfY = pdfHeight - (screenY * scaleY);

  return { x: pdfX, y: pdfY };
}

/**
 * Convert PDF dimensions to screen dimensions
 * 
 * @param pdfWidth - Width in PDF points
 * @param pdfHeight - Height in PDF points
 * @param pdfPageWidth - PDF page width in points
 * @param pdfPageHeight - PDF page height in points
 * @param screenWidth - Rendered page width in pixels
 * @param screenHeight - Rendered page height in pixels
 * @returns Screen dimensions { width, height } in pixels
 */
export function pdfDimensionsToScreen(
  pdfWidth: number,
  pdfHeight: number,
  pdfPageWidth: number,
  pdfPageHeight: number,
  screenWidth: number,
  screenHeight: number,
): { width: number; height: number } {
  const scaleX = screenWidth / pdfPageWidth;
  const scaleY = screenHeight / pdfPageHeight;

  return {
    width: pdfWidth * scaleX,
    height: pdfHeight * scaleY,
  };
}

/**
 * Convert screen dimensions to PDF dimensions
 * 
 * @param screenWidth - Width in screen pixels
 * @param screenHeight - Height in screen pixels
 * @param pdfPageWidth - PDF page width in points
 * @param pdfPageHeight - PDF page height in points
 * @param screenPageWidth - Rendered page width in pixels
 * @param screenPageHeight - Rendered page height in pixels
 * @returns PDF dimensions { width, height } in points
 */
export function screenDimensionsToPdf(
  screenWidth: number,
  screenHeight: number,
  pdfPageWidth: number,
  pdfPageHeight: number,
  screenPageWidth: number,
  screenPageHeight: number,
): { width: number; height: number } {
  const scaleX = pdfPageWidth / screenPageWidth;
  const scaleY = pdfPageHeight / screenPageHeight;

  return {
    width: screenWidth * scaleX,
    height: screenHeight * scaleY,
  };
}
