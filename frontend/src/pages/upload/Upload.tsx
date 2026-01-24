import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button } from '../../components/ui';
import { uploadFile } from '../../lib/fileApi';
import { UploadProgress } from '../../types/file';

/**
 * Upload Page
 * 
 * Page for uploading new documents to the system.
 * Uses presigned URL flow: presign → upload to MinIO → finalize.
 */
export const Upload: React.FC = () => {
  const navigate = useNavigate();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string>('');


  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const validateAndSetFile = (file: File) => {
    setError('');

    // Validate file type (only PDF)
    if (file.type !== 'application/pdf') {
      setError('Only PDF files are allowed.');
      return false;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > maxSize) {
      setError('File size must be less than 10MB.');
      return false;
    }

    // Validate file name length
    if (file.name.length > 255) {
      setError('File name is too long. Maximum 255 characters.');
      return false;
    }

    setSelectedFile(file);
    return true;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setUploadProgress(0);
    setError('');

    try {
      // Upload file using the complete workflow
      const fileMetadata = await uploadFile(
        selectedFile,
        (progress: UploadProgress) => {
          setUploadProgress(progress.percentage);
        }
      );

      console.log('Upload complete:', fileMetadata);

      // Reset state
      setSelectedFile(null);
      setUploadProgress(0);

      // Redirect to document detail page
      navigate(`/documents/${fileMetadata.id}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed. Please try again.';
      setError(errorMessage);
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-slide-up">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Upload Document</h1>
          <p className="mt-2 text-neutral-600">
            Upload a PDF document to add signature fields and send for signing.
          </p>
        </div>

        {/* Upload Card */}
        <Card padding="lg">
          <CardHeader>
            <CardTitle>Select Document</CardTitle>
            <CardDescription>
              Choose a PDF file from your computer. Maximum file size: 10MB.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Drag and Drop Area */}
            {!selectedFile && (
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-smooth ${
                  dragActive
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-neutral-300 hover:border-primary-400 hover:bg-neutral-50'
                }`}
              >
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center">
                    <svg
                      className="w-8 h-8 text-primary-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-lg font-medium text-neutral-900">
                      Drag and drop your PDF here
                    </p>
                    <p className="text-sm text-neutral-600 mt-1">
                      or click to browse files
                    </p>
                  </div>
                  <p className="text-xs text-neutral-500">
                    PDF files only • Maximum 10MB
                  </p>
                </div>
              </div>
            )}

            {            /* Error Message */}
            {error && (
              <div className="p-4 bg-error-50 border border-error-200 rounded-lg text-sm text-error-700 mb-6 animate-fade-in">
                <div className="flex items-start gap-3">
                  <svg
                    className="w-5 h-5 flex-shrink-0 mt-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <div>
                    <p className="font-medium">Upload Failed</p>
                    <p className="mt-1">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Selected File Preview */}
            {selectedFile && (
              <div className="space-y-6">
                <div className="flex items-center gap-4 p-4 bg-neutral-50 rounded-lg border border-neutral-200">
                  <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg
                      className="w-6 h-6 text-primary-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-neutral-900 truncate">
                      {selectedFile.name}
                    </p>
                    <p className="text-sm text-neutral-600">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedFile(null)}
                    disabled={uploading}
                    className="p-2 text-neutral-500 hover:text-error-600 transition-smooth disabled:opacity-50"
                  >
                    <svg
                      className="w-5 h-5"
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
                  </button>
                </div>

                {/* Upload Progress */}
                {uploading && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-neutral-700">Uploading...</span>
                      <span className="text-neutral-600">{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-neutral-200 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <Button
                    variant="primary"
                    size="lg"
                    fullWidth
                    onClick={handleUpload}
                    loading={uploading}
                    disabled={!selectedFile || uploading}
                  >
                    Upload Document
                  </Button>
                  {!uploading && (
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => setSelectedFile(null)}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Section */}
        <Card>
          <CardHeader>
            <CardTitle>What happens after upload?</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold">
                  1
                </div>
                <div>
                  <p className="font-medium text-neutral-900">Add Signature Fields</p>
                  <p className="text-sm text-neutral-600 mt-0.5">
                    Place signature fields on your document where signers need to sign.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold">
                  2
                </div>
                <div>
                  <p className="font-medium text-neutral-900">Assign Signers</p>
                  <p className="text-sm text-neutral-600 mt-0.5">
                    Specify who needs to sign each field.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold">
                  3
                </div>
                <div>
                  <p className="font-medium text-neutral-900">Send for Signature</p>
                  <p className="text-sm text-neutral-600 mt-0.5">
                    Signers will receive notifications and can sign the document.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
    </div>
  );
};

