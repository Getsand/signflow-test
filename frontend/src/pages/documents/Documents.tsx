/**
 * Documents Page - Primary Workflow Screen
 * 
 * Zoho Sign-like document management interface.
 * 
 * Features:
 * - Clean table layout (no cards)
 * - Status badges: DRAFT, SENT, IN_PROGRESS, COMPLETED
 * - Recipient status summary with signed/pending indicators
 * - Action buttons per status (Send/View/Download)
 * - Row click navigation to /documents/{id}
 * - Uses GET /api/v1/signing-requests
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StatusBadge, Button } from '../../components/ui';
import { listSigningRequests, getSigningRequestDetail, sendSigningRequest, SigningRequestListItem, SigningRequestDetail, downloadSignedPdf, deleteSigningRequest } from '../../lib/signingRequestApi';
import { logger } from '../../utils/logger';

interface SigningRequestWithDetails extends SigningRequestListItem {
  recipients?: SigningRequestDetail['recipients'];
}

type Recipient = SigningRequestDetail['recipients'][0];

export const Documents: React.FC = () => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<SigningRequestWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendingRequestId, setSendingRequestId] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<{ requestId: string; failedRecipients: string[] } | null>(null);
  const [deletingRequestId, setDeletingRequestId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Filter requests by search (title + filename), case-insensitive, updates as user types
  const filteredRequests = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return requests;
    return requests.filter(
      (r) =>
        (r.title && r.title.toLowerCase().includes(q)) ||
        (r.filename && r.filename.toLowerCase().includes(q))
    );
  }, [requests, searchQuery]);

  // Fetch signing requests and their details on mount
  useEffect(() => {
    const fetchRequests = async () => {
      try {
        setIsLoading(true);
        const data = await listSigningRequests();
        
        // Fetch recipient details for each request in parallel
        const requestsWithDetails = await Promise.all(
          data.map(async (request) => {
            try {
              const detail = await getSigningRequestDetail(request.id);
              return {
                ...request,
                recipients: detail.recipients,
              };
            } catch (err) {
              logger.error(`Failed to fetch details for request ${request.id}:`, err);
              return request; // Return without recipients if fetch fails
            }
          })
        );
        
        setRequests(requestsWithDetails);
        setError(null);
      } catch (err) {
        logger.error('Failed to fetch signing requests:', err);
        setError('Failed to load documents');
      } finally {
        setIsLoading(false);
      }
    };

    fetchRequests();
  }, []);

  // Handle row click
  const handleRowClick = (requestId: string, e?: React.MouseEvent) => {
    // Don't navigate if clicking on action buttons or dropdown menu
    if (e) {
      const target = e.target as HTMLElement;
      if (target.closest('button') || target.closest('[data-action-menu]')) {
        return;
      }
    }
    navigate(`/documents/${requestId}`);
  };

  // Handle menu toggle
  const handleMenuToggle = (e: React.MouseEvent, requestId: string) => {
    e.stopPropagation();
    setOpenMenuId(openMenuId === requestId ? null : requestId);
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-action-menu]')) {
        setOpenMenuId(null);
      }
    };

    if (openMenuId) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [openMenuId]);

  // Handle send action
  const handleSend = async (e: React.MouseEvent, requestId: string) => {
    e.stopPropagation();
    try {
      setSendingRequestId(requestId);
      setEmailError(null);
      setError(null);
      
      const response = await sendSigningRequest(requestId);
      
      // Check if emails failed
      if (!response.sent) {
        setEmailError({
          requestId,
          failedRecipients: response.failed_recipients,
        });
      }
      
      // Refresh the list
      const data = await listSigningRequests();
      const requestsWithDetails = await Promise.all(
        data.map(async (request) => {
          try {
            const detail = await getSigningRequestDetail(request.id);
            return {
              ...request,
              recipients: detail.recipients,
            };
          } catch (err) {
            return request;
          }
        })
      );
      setRequests(requestsWithDetails);
    } catch (err: any) {
      logger.error('Failed to send signing request:', err);
      setError(err.response?.data?.detail || 'Failed to send signing request');
    } finally {
      setSendingRequestId(null);
    }
  };

  // Handle view action
  const handleView = (e: React.MouseEvent, requestId: string) => {
    e.stopPropagation();
    navigate(`/documents/${requestId}`);
  };

  // Handle download action
  const handleDownload = async (e: React.MouseEvent, requestId: string) => {
    e.stopPropagation();
    try {
      // Download signed PDF with embedded signatures
      const blob = await downloadSignedPdf(requestId);
      
      // Get filename from detail
      const detail = await getSigningRequestDetail(requestId);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = detail.filename || 'document.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      logger.error('Failed to download PDF:', err);
      setError(err.response?.data?.detail || err.message || 'Failed to download document');
    }
  };

  // Handle delete action
  const handleDelete = async (e: React.MouseEvent, requestId: string) => {
    e.stopPropagation();
    setDeleteConfirmId(requestId);
  };

  // Confirm delete
  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    
    try {
      setDeletingRequestId(deleteConfirmId);
      setError(null);
      
      await deleteSigningRequest(deleteConfirmId);
      
      // Refresh the list
      const data = await listSigningRequests();
      const requestsWithDetails = await Promise.all(
        data.map(async (request) => {
          try {
            const detail = await getSigningRequestDetail(request.id);
            return {
              ...request,
              recipients: detail.recipients,
            };
          } catch (err) {
            return request;
          }
        })
      );
      setRequests(requestsWithDetails);
      setDeleteConfirmId(null);
    } catch (err: any) {
      logger.error('Failed to delete signing request:', err);
      setError(err.response?.data?.detail || 'Failed to delete document');
    } finally {
      setDeletingRequestId(null);
    }
  };

  // Cancel delete
  const cancelDelete = () => {
    setDeleteConfirmId(null);
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    // If the date string doesn't have timezone info, treat it as UTC
    let dateStr = dateString;
    if (!dateStr.includes('Z') && !dateStr.includes('+') && !dateStr.includes('-', 10)) {
      // Append 'Z' to indicate UTC if no timezone info is present
      dateStr = dateStr.endsWith('Z') ? dateStr : dateStr + 'Z';
    }
    const date = new Date(dateStr);
    // Use toLocaleString to include both date and time
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true, // Use AM/PM format
    });
  };

  // Get recipient status for timeline display
  const getRecipientStatus = (recipient: Recipient): 'signed' | 'pending' | 'sent' => {
    if (recipient.status === 'SIGNED') {
      return 'signed';
    }
    // If sent_at is set, email was sent successfully
    if (recipient.sent_at) {
      return 'sent';
    }
    // Otherwise pending (not sent yet)
    return 'pending';
  };

  // Get recipient summary display (Zoho-style timeline)
  const getRecipientSummary = (recipients?: SigningRequestDetail['recipients']) => {
    if (!recipients || recipients.length === 0) {
      return null;
    }

    // Sort recipients by order_index if sequential
    const sortedRecipients = [...recipients].sort((a, b) => a.order_index - b.order_index);

    return (
      <div className="mt-1.5 space-y-1">
        {sortedRecipients.map((recipient) => {
          const status = getRecipientStatus(recipient);
          
          return (
            <div key={recipient.id} className="flex items-center gap-2 text-xs">
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                {status === 'signed' ? (
                  <>
                    <svg className="w-3.5 h-3.5 text-green-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="truncate text-green-700">{recipient.email}</span>
                    <span className="text-xs text-green-600">— Signed</span>
                  </>
                ) : status === 'sent' ? (
                  <>
                    <svg className="w-3.5 h-3.5 text-blue-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                      <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                    </svg>
                    <span className="truncate text-gray-600">{recipient.email}</span>
                    <span className="text-xs text-gray-500">— Sent</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                    </svg>
                    <span className="truncate text-gray-600">{recipient.email}</span>
                    <span className="text-xs text-gray-500">— Pending</span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Calculate document status based on signer progress
  const getDocumentStatus = (request: SigningRequestWithDetails): 'DRAFT' | 'SENT' | 'IN_PROGRESS' | 'COMPLETED' => {
    if (request.status === 'DRAFT') {
      return 'DRAFT';
    }
    
    if (!request.recipients || request.recipients.length === 0) {
      return request.status as any;
    }
    
    const signedCount = request.recipients.filter(r => r.status === 'SIGNED').length;
    const totalCount = request.recipients.length;
    
    if (signedCount === totalCount) {
      return 'COMPLETED';
    }
    
    if (signedCount > 0) {
      return 'IN_PROGRESS';
    }
    
    // At least one email was sent but no one signed yet
    if (request.status === 'SENT') {
      return 'SENT';
    }
    
    return request.status as any;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold text-gray-900">Documents</h1>
          <p className="mt-1 text-sm text-gray-500">
            {isLoading ? 'Loading...' : `${filteredRequests.length} document${filteredRequests.length !== 1 ? 's' : ''}`}
            {searchQuery.trim() && requests.length !== filteredRequests.length && (
              <span className="text-gray-500"> (filtered from {requests.length})</span>
            )}
          </p>
        </div>
        
        {/* Search Box - Between title and empty space (no button on Documents page) */}
        {!isLoading && requests.length > 0 && (
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
              placeholder="Search by document name or filename..."
              className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg text-sm placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-smooth"
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
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Email Delivery Error Banner */}
      {emailError && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-yellow-800">
                Email delivery failed. Please verify email configuration.
              </p>
              {emailError.failedRecipients.length > 0 && (
                <p className="mt-1 text-xs text-yellow-700">
                  Failed recipients: {emailError.failedRecipients.join(', ')}
                </p>
              )}
            </div>
            <button
              onClick={() => setEmailError(null)}
              className="text-yellow-600 hover:text-yellow-800"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Documents Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="text-center py-16">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="mt-4 text-sm font-medium text-gray-900">
            {searchQuery.trim() ? 'No matching documents' : 'No documents'}
          </h3>
          <p className="mt-2 text-sm text-gray-500">
            {searchQuery.trim()
              ? 'Try a different search term.'
              : 'Your documents will appear here once you create signing requests.'}
          </p>
          {searchQuery.trim() && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="mt-4 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
            >
              Clear search
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden card-shadow">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50/80 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Document
                  </th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {filteredRequests.map((request) => (
                  <tr
                    key={request.id}
                    onClick={(e) => handleRowClick(request.id, e)}
                    className="hover:bg-gray-50/80 cursor-pointer transition-smooth"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center shrink-0 mt-0.5">
                          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {request.title}
                          </p>
                          {/* Recipient Summary - Zoho-style timeline */}
                          {getRecipientSummary(request.recipients)}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={getDocumentStatus(request)} size="sm" />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {formatDate(request.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="relative" data-action-menu>
                        {/* Three-dot menu button */}
                        <button
                          type="button"
                          onClick={(e) => handleMenuToggle(e, request.id)}
                          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          aria-label="Actions"
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                          </svg>
                        </button>

                        {/* Dropdown menu */}
                        {openMenuId === request.id && (
                          <div className="absolute right-0 mt-1 w-48 bg-white rounded-xl dropdown-shadow border border-gray-200 py-1 z-50">
                            {getDocumentStatus(request) === 'DRAFT' && (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenMenuId(null);
                                    handleSend(e, request.id);
                                  }}
                                  disabled={sendingRequestId === request.id}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                  </svg>
                                  {sendingRequestId === request.id ? 'Sending...' : 'Send'}
                                </button>
                                <div className="border-t border-gray-100 my-1"></div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenMenuId(null);
                                    handleDelete(e, request.id);
                                  }}
                                  disabled={deletingRequestId === request.id}
                                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                  Delete
                                </button>
                              </>
                            )}
                            {(getDocumentStatus(request) === 'SENT' || getDocumentStatus(request) === 'IN_PROGRESS') && (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenMenuId(null);
                                    handleView(e, request.id);
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                  View
                                </button>
                                <div className="border-t border-gray-100 my-1"></div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenMenuId(null);
                                    handleDelete(e, request.id);
                                  }}
                                  disabled={deletingRequestId === request.id}
                                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                  Delete
                                </button>
                              </>
                            )}
                            {getDocumentStatus(request) === 'COMPLETED' && (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenMenuId(null);
                                    handleDownload(e, request.id);
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                  </svg>
                                  Download
                                </button>
                                <div className="border-t border-gray-100 my-1"></div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenMenuId(null);
                                    handleDelete(e, request.id);
                                  }}
                                  disabled={deletingRequestId === request.id}
                                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-modal border border-gray-200 p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Document</h3>
            <p className="text-sm text-gray-500 mb-6">
              Are you sure you want to delete this document? This action cannot be undone.
              All signing request data, recipients, and signatures will be permanently deleted.
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={cancelDelete}
                disabled={deletingRequestId === deleteConfirmId}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={confirmDelete}
                disabled={deletingRequestId === deleteConfirmId}
              >
                {deletingRequestId === deleteConfirmId ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
