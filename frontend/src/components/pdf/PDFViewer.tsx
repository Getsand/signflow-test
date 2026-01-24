/**
 * PDF Viewer Component
 * 
 * Renders PDF pages using react-pdf with proper scaling and page management.
 */

import React, { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';

// Set up PDF.js worker - use Vite's ?url import for reliable bundling
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

if (typeof window !== 'undefined') {
  // Use Vite's ?url import - bundles worker correctly in dev and production
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;
}

interface PDFViewerProps {
  fileUrl: string;
  onPageRender?: (pageNumber: number, width: number, height: number) => void;
  scale?: number;
  className?: string;
}

/**
 * PDFViewer - Renders PDF document with pages
 */
export const PDFViewer: React.FC<PDFViewerProps> = ({
  fileUrl,
  onPageRender,
  scale = 1.0,
  className = '',
}) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
    setError(null);
  };

  const onDocumentLoadError = (error: Error) => {
    console.error('PDF load error:', error);
    setError('Failed to load PDF document');
    setLoading(false);
  };

  const onPageLoadSuccess = (page: any) => {
    const { width, height } = page;
    const pageNumber = page._pageIndex + 1;

    if (onPageRender) {
      onPageRender(pageNumber, width, height);
    }
  };

  if (error) {
    return (
      <div className={`flex items-center justify-center p-8 bg-red-50 border border-red-200 rounded ${className}`}>
        <div className="text-center">
          <p className="text-red-700 font-medium">{error}</p>
          <p className="text-red-600 text-sm mt-2">Please check the file URL and try again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {loading && (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      )}

      <Document
        file={fileUrl}
        onLoadSuccess={onDocumentLoadSuccess}
        onLoadError={onDocumentLoadError}
        loading={
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        }
        className="flex flex-col items-center gap-4"
      >
        {numPages && (
          <div className="space-y-4">
            {Array.from({ length: numPages }, (_, index) => (
              <div key={index + 1} className="relative border border-gray-300 shadow-sm bg-white">
                <Page
                  pageNumber={index + 1}
                  scale={scale}
                  onLoadSuccess={onPageLoadSuccess}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                  className="relative"
                />
              </div>
            ))}
          </div>
        )}
      </Document>
    </div>
  );
};

/**
 * Get page dimensions for coordinate conversion
 */
export const usePageDimensions = (pageNumber: number, pageDimensions: Map<number, { width: number; height: number }>) => {
  return pageDimensions.get(pageNumber) || null;
};
