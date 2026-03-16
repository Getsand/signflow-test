import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button } from '../../components/ui';
import { uploadFile } from '../../lib/fileApi';
import { UploadProgress } from '../../types/file';
import { logger } from '../../utils/logger';

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

  // After upload we redirect to Prepare page for the uploaded file.


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


      // Reset state
      setSelectedFile(null);
      setUploadProgress(0);

      // Redirect to Prepare page so user can add signature fields
      navigate(`/documents/${fileMetadata.id}/prepare`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed. Please try again.';
      setError(errorMessage);
      logger.error('Upload failed:', err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Upload Document</h1>
          <p className="mt-1 text-sm text-gray-500">
            Upload a PDF to add signature fields and send for signing.
          </p>
        </div>

        <Card padding="lg">
          <CardHeader>
            <CardTitle className="text-lg">Select Document</CardTitle>
            <CardDescription>
              Choose a PDF file from your computer. Maximum file size: 10MB.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedFile && (
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`relative border-2 border-dashed rounded-xl p-10 text-center transition-smooth bg-gray-50/50 ${
                  dragActive
                    ? 'border-indigo-500 bg-indigo-50/80'
                    : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'
                }`}
              >
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center gap-4">
                  <div className="w-14 h-14 bg-indigo-100 rounded-xl flex items-center justify-center">
                    <svg
                      className="w-7 h-7 text-indigo-600"
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
                    <p className="text-base font-medium text-gray-900">
                      Drag and drop your PDF here
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      or click to browse files
                    </p>
                  </div>
                  <p className="text-xs text-gray-400">
                    PDF only • Max 10MB
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 mb-6">
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
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="w-12 h-12 bg-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg
                      className="w-6 h-6 text-indigo-600"
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
                    <p className="font-medium text-gray-900 truncate">
                      {selectedFile.name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedFile(null)}
                    disabled={uploading}
                    className="p-2 text-gray-500 hover:text-red-600 transition-smooth disabled:opacity-50"
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
                      <span className="font-medium text-gray-700">Uploading...</span>
                      <span className="text-gray-600">{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
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
            <CardTitle className="text-lg">What happens after upload?</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { n: 1, title: 'Add Signature Fields', desc: 'Place signature fields on your document where signers need to sign.' },
                { n: 2, title: 'Assign Signers', desc: 'Specify who needs to sign each field.' },
                { n: 3, title: 'Send for Signature', desc: 'Signers will receive notifications and can sign the document.' },
              ].map(({ n, title, desc }) => (
                <div key={n} className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-semibold">
                    {n}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{title}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
    </div>
  );
};

