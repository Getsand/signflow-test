/**
 * Templates Page
 * 
 * Displays all user's uploaded documents.
 * Users can view and open their own documents.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StatusBadge, Button } from '../../components/ui';
import { listFiles, deleteFile, FileListItem } from '../../lib/fileApi';


export const Templates: React.FC = () => {
  const navigate = useNavigate();
  const [files, setFiles] = useState<FileListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ fileId: string; filename: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch user's files on mount
  useEffect(() => {
    const fetchFiles = async () => {
      try {
        setIsLoading(true);
        const data = await listFiles();
        // Filter templates: Only show DRAFT (UPLOADING) and READY (COMPLETED)
        // Exclude LOCKED, FAILED, and other statuses
        const templateFiles = data.filter(
          (file) => file.status === 'UPLOADING' || file.status === 'COMPLETED'
        );
        setFiles(templateFiles);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch files:', err);
        setError('Failed to load documents');
      } finally {
        setIsLoading(false);
      }
    };

    fetchFiles();
  }, []);

  // Refresh files list
  const refreshFiles = async () => {
    try {
      setIsLoading(true);
      const data = await listFiles();
      const templateFiles = data.filter(
        (file) => file.status === 'UPLOADING' || file.status === 'COMPLETED'
      );
      setFiles(templateFiles);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch files:', err);
      setError('Failed to load documents');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle document click - navigate to prepare view
  const handleDocumentClick = (fileId: string) => {
    navigate(`/templates/${fileId}/prepare`);
  };

  // Handle delete button click
  const handleDeleteClick = (e: React.MouseEvent, fileId: string, filename: string) => {
    e.stopPropagation(); // Prevent navigation
    setDeleteConfirm({ fileId, filename });
  };

  // Handle delete confirmation
  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;

    try {
      setIsDeleting(true);
      await deleteFile(deleteConfirm.fileId);
      setDeleteConfirm(null);
      // Refresh the files list
      await refreshFiles();
    } catch (err: any) {
      console.error('Failed to delete file:', err);
      setError(err.message || 'Failed to delete file');
      setDeleteConfirm(null);
    } finally {
      setIsDeleting(false);
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Templates</h1>
          <p className="mt-1 text-sm text-gray-600">
            {isLoading ? 'Loading...' : `${files.length} document${files.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Button
          variant="primary"
          size="lg"
          onClick={() => navigate('/upload', { state: { from: 'templates' } })}
          leftIcon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          }
          className="shadow-lg hover:shadow-xl transition-shadow"
        >
          Add Template
        </Button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Documents Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : files.length === 0 ? (
        <div className="text-center py-16 bg-white border border-gray-200 rounded-lg">
          <div className="max-w-md mx-auto">
            <div className="flex items-center justify-center w-20 h-20 mx-auto bg-indigo-100 rounded-full">
              <svg
                className="w-10 h-10 text-indigo-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
                />
              </svg>
            </div>
            <h3 className="mt-6 text-lg font-semibold text-gray-900">No templates yet</h3>
            <p className="mt-2 text-sm text-gray-600">
              Get started by uploading your first document template. You can add signature fields and prepare it for signing.
            </p>
            <div className="mt-6">
              <Button
                variant="primary"
                size="lg"
                onClick={() => navigate('/upload', { state: { from: 'templates' } })}
                leftIcon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                }
              >
                Upload Your First Template
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {files.map((file) => (
            <div
              key={file.id}
              onClick={() => handleDocumentClick(file.id)}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group"
            >
              {/* Document Icon */}
              <div className="flex items-center justify-center w-16 h-16 bg-gray-100 rounded-lg mb-3 group-hover:bg-indigo-50 transition-colors">
                <svg className="w-8 h-8 text-gray-600 group-hover:text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>

              {/* Document Info */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 truncate mb-1" title={file.filename}>
                  {file.filename}
                </h3>
                <div className="flex items-center gap-2 mb-2">
                  <StatusBadge 
                    status={file.status === 'COMPLETED' ? 'READY' : file.status === 'UPLOADING' ? 'DRAFT' : file.status} 
                    size="sm" 
                  />
                </div>
                <p className="text-xs text-gray-500">
                  {formatDate(file.created_at)}
                </p>
              </div>

              {/* Action Indicator */}
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log('[Templates] Use Template clicked, file.id:', file.id);
                        navigate(`/signing-requests/new/${file.id}`);
                      }}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded transition-colors whitespace-nowrap shrink-0"
                      title="Use Template"
                    >
                      Use Template
                    </button>
                    <div className="flex items-center text-xs text-gray-500 shrink-0">
                      <span>or</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDocumentClick(file.id);
                        }}
                        className="ml-1 text-indigo-600 hover:text-indigo-700 underline"
                      >
                        prepare
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDeleteClick(e, file.id, file.filename)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors shrink-0"
                    title="Delete template"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Template</h3>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete <strong>{deleteConfirm.filename}</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="secondary"
                onClick={() => setDeleteConfirm(null)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
