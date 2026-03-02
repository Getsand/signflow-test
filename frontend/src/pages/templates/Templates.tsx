/**
 * Templates Page
 * 
 * Displays all user's uploaded documents.
 * Users can view and open their own documents.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StatusBadge, Button } from '../../components/ui';
import { listFiles, deleteFile, renameFile, FileListItem, getFileDetail } from '../../lib/fileApi';
import { logger } from '../../utils/logger';


interface FileWithStatus extends FileListItem {
  displayStatus: 'DRAFT' | 'READY';
}

export const Templates: React.FC = () => {
  const navigate = useNavigate();
  const [files, setFiles] = useState<FileWithStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ fileId: string; filename: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [renameState, setRenameState] = useState<{ fileId: string; currentFilename: string } | null>(null);
  const [newFilename, setNewFilename] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Filter files by filename as user types (case-insensitive)
  const filteredFiles = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return files;
    return files.filter((f) => f.filename && f.filename.toLowerCase().includes(q));
  }, [files, searchQuery]);

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
        
        // Check each file to determine status: DRAFT (uploading or no fields) or READY (has fields)
        const filesWithStatus: FileWithStatus[] = await Promise.all(
          templateFiles.map(async (file) => {
            let displayStatus: 'DRAFT' | 'READY' = 'DRAFT';
            
            // If UPLOADING, it's always DRAFT
            if (file.status === 'UPLOADING') {
              displayStatus = 'DRAFT';
            } else if (file.status === 'COMPLETED') {
              // If COMPLETED, check if it has signature fields (is prepared)
              try {
                const fileDetail = await getFileDetail(file.id);
                // If file has signature fields, it's "Ready" (prepared)
                if (fileDetail.signature_fields && fileDetail.signature_fields.length > 0) {
                  displayStatus = 'READY';
                } else {
                  // COMPLETED but no fields = DRAFT
                  displayStatus = 'DRAFT';
                }
              } catch (err) {
                // If we can't fetch details, default to DRAFT
                logger.error(`Failed to fetch details for file ${file.id}:`, err);
                displayStatus = 'DRAFT';
              }
            }
            
            return {
              ...file,
              displayStatus,
            };
          })
        );
        
        setFiles(filesWithStatus);
        setError(null);
      } catch (err) {
        logger.error('Failed to fetch files:', err);
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
      
      // Check each file to determine status: DRAFT (uploading or no fields) or READY (has fields)
      const filesWithStatus: FileWithStatus[] = await Promise.all(
        templateFiles.map(async (file) => {
          let displayStatus: 'DRAFT' | 'READY' = 'DRAFT';
          
          // If UPLOADING, it's always DRAFT
          if (file.status === 'UPLOADING') {
            displayStatus = 'DRAFT';
          } else if (file.status === 'COMPLETED') {
            // If COMPLETED, check if it has signature fields (is prepared)
            try {
              const fileDetail = await getFileDetail(file.id);
              // If file has signature fields, it's "Ready" (prepared)
              if (fileDetail.signature_fields && fileDetail.signature_fields.length > 0) {
                displayStatus = 'READY';
              } else {
                // COMPLETED but no fields = DRAFT
                displayStatus = 'DRAFT';
              }
            } catch (err) {
              // If we can't fetch details, default to DRAFT
              logger.error(`Failed to fetch details for file ${file.id}:`, err);
              displayStatus = 'DRAFT';
            }
          }
          
          return {
            ...file,
            displayStatus,
          };
        })
      );
      
      setFiles(filesWithStatus);
      setError(null);
    } catch (err) {
        logger.error('Failed to fetch files:', err);
      setError('Failed to load documents');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle document click - use template: first add recipients, then prepare
  const handleDocumentClick = (fileId: string) => {
    navigate(`/templates/${fileId}/recipients`);
  };

  // Handle delete button click
  const handleDeleteClick = (e: React.MouseEvent, fileId: string, filename: string) => {
    e.stopPropagation(); // Prevent navigation
    setOpenMenuId(null);
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
      logger.error('Failed to delete file:', err);
      setError(err.message || 'Failed to delete file');
      setDeleteConfirm(null);
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle rename button click
  const handleRenameClick = (e: React.MouseEvent, fileId: string, filename: string) => {
    e.stopPropagation(); // Prevent navigation
    setOpenMenuId(null);
    setRenameState({ fileId, currentFilename: filename });
    setNewFilename(filename);
  };

  // Close actions menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-template-actions-menu]')) {
        setOpenMenuId(null);
      }
    };
    if (openMenuId) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [openMenuId]);

  // Handle rename confirmation
  const handleRenameConfirm = async () => {
    if (!renameState || !newFilename.trim()) return;

    try {
      setIsRenaming(true);
      await renameFile(renameState.fileId, newFilename.trim());
      setRenameState(null);
      setNewFilename('');
      // Refresh the files list
      await refreshFiles();
    } catch (err: any) {
      logger.error('Failed to rename file:', err);
      setError(err.message || 'Failed to rename file');
    } finally {
      setIsRenaming(false);
    }
  };

  // Format date and time of upload
  const formatUploadedAt = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold text-gray-900">Templates</h1>
          <p className="mt-1 text-sm text-gray-600">
            {isLoading ? 'Loading...' : `${filteredFiles.length} document${filteredFiles.length !== 1 ? 's' : ''}`}
            {searchQuery.trim() && files.length !== filteredFiles.length && (
              <span className="text-gray-500"> (filtered from {files.length})</span>
            )}
          </p>
        </div>
        
        {/* Search Box - Between title and button */}
        {!isLoading && files.length > 0 && (
          <div className="relative flex-1 max-w-md min-w-[200px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates by filename..."
              className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>
        )}
        
        <Button
          variant="primary"
          size="lg"
          onClick={() => navigate('/upload', { state: { from: 'templates' } })}
          leftIcon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          }
          className="shadow-lg hover:shadow-xl transition-shadow shrink-0"
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
      ) : filteredFiles.length === 0 ? (
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
            <h3 className="mt-6 text-lg font-semibold text-gray-900">
              {searchQuery.trim() ? 'No matching templates' : 'No templates yet'}
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              {searchQuery.trim()
                ? 'Try a different search term.'
                : 'Get started by uploading your first document template. You can add signature fields and prepare it for signing.'}
            </p>
            {searchQuery.trim() ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="mt-4 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Clear search
              </button>
            ) : (
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
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="hidden sm:grid sm:grid-cols-12 gap-4 px-4 py-3 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            <div className="sm:col-span-5">Name</div>
            <div className="sm:col-span-2">Status</div>
            <div className="sm:col-span-3">Uploaded</div>
            <div className="sm:col-span-2 text-right">Actions</div>
          </div>
          {filteredFiles.map((file) => (
            <div
              key={file.id}
              className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4 px-4 py-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50/80 transition-colors items-center group"
            >
              <div
                onClick={() => handleDocumentClick(file.id)}
                className="sm:col-span-5 flex items-center gap-3 min-w-0 cursor-pointer"
              >
                <div className="shrink-0 flex items-center justify-center w-10 h-10 bg-gray-100 rounded-lg group-hover:bg-indigo-50 transition-colors">
                  <svg className="w-5 h-5 text-gray-600 group-hover:text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <span className="font-medium text-gray-900 truncate" title={file.filename}>
                  {file.filename}
                </span>
              </div>
              <div className="sm:col-span-2 flex items-center">
                <StatusBadge
                  status={file.displayStatus}
                  size="sm"
                />
              </div>
              <div className="sm:col-span-3 text-sm text-gray-500" title={file.created_at}>
                {formatUploadedAt(file.created_at)}
              </div>
              <div className="sm:col-span-2 flex items-center justify-end gap-2 flex-wrap">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (file.displayStatus === 'READY') {
                      navigate(`/signing-requests/new/${file.id}`);
                    }
                  }}
                  disabled={file.displayStatus === 'DRAFT'}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                    file.displayStatus === 'DRAFT'
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'text-white bg-indigo-600 hover:bg-indigo-700'
                  }`}
                  title={file.displayStatus === 'DRAFT' ? 'Template must be prepared first' : 'Use Template'}
                >
                  Use Template
                </button>
                <div className="relative" data-template-actions-menu>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuId(openMenuId === file.id ? null : file.id);
                    }}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                    title="More actions"
                    aria-label="More actions"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                    </svg>
                  </button>
                  {openMenuId === file.id && (
                    <div className="absolute right-0 mt-1 w-44 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(null);
                          handleDocumentClick(file.id);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Prepare
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleRenameClick(e, file.id, file.filename)}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        Rename
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteClick(e, file.id, file.filename)}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
        >
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-2" style={{ color: '#111827' }}>
              Delete Template
            </h3>
            <p className="text-sm mb-6" style={{ color: '#6B7280' }}>
              Are you sure you want to delete <strong>{deleteConfirm.filename}</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#111827]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="px-4 py-2 rounded-md font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-[#DC2626] hover:bg-[#B91C1C]"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {renameState && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
        >
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-2" style={{ color: '#111827' }}>
              Rename Template
            </h3>
            <p className="text-sm mb-4" style={{ color: '#6B7280' }}>
              Enter a new name for <strong>{renameState.currentFilename}</strong>
            </p>
            <input
              type="text"
              value={newFilename}
              onChange={(e) => setNewFilename(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newFilename.trim()) {
                  handleRenameConfirm();
                } else if (e.key === 'Escape') {
                  setRenameState(null);
                  setNewFilename('');
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent mb-6"
              placeholder="Enter new filename"
              autoFocus
            />
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => {
                  setRenameState(null);
                  setNewFilename('');
                }}
                disabled={isRenaming}
                className="px-4 py-2 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#111827]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRenameConfirm}
                disabled={isRenaming || !newFilename.trim() || newFilename.trim() === renameState.currentFilename}
                className="px-4 py-2 rounded-md font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-indigo-600 hover:bg-indigo-700"
              >
                {isRenaming ? 'Renaming...' : 'Rename'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
