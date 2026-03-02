/**
 * New Signing Request Page
 * 
 * Create a signing request from a template.
 * Maps roles to email addresses and chooses signing order.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import { Button } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { getFileDetail, FileDetail } from '../../lib/fileApi';
import { listSignatureFields, SignatureField, getFileViewUrl } from '../../lib/signatureFieldApi';
import { SignatureFieldOverlay } from '../../components/pdf/SignatureFieldOverlay';
import { createSigningRequest, RecipientCreate } from '../../lib/signingRequestApi';
import { logger } from '../../utils/logger';

// Set up PDF.js worker
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;
}

export const NewSigningRequest: React.FC = () => {
  const { template_id } = useParams<{ template_id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const locationState = location.state as {
    expectedSignerCount?: number;
    recipients?: { role: string; email: string }[];
  };
  const expectedSignerCountFromState = locationState?.expectedSignerCount;
  const recipientsFromState = locationState?.recipients;

  const [fileData, setFileData] = useState<FileDetail | null>(null);
  const [signatureFields, setSignatureFields] = useState<SignatureField[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [recipients, setRecipients] = useState<Record<string, string>>({}); // role -> email
  const [signingOrder, setSigningOrder] = useState<'SEQUENTIAL' | 'PARALLEL'>('SEQUENTIAL');
  const [title, setTitle] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfViewUrl, setPdfViewUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageInfos, setPageInfos] = useState<Map<number, { pageNumber: number; pdfWidth: number; pdfHeight: number; screenWidth: number; screenHeight: number }>>(new Map());
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Fetch template data and signature fields
  useEffect(() => {
      const fetchData = async () => {
        if (!template_id) {
          logger.error('[NewSigningRequest] No template_id provided');
          setError('Template ID not provided');
          setIsLoading(false);
          return;
        }

        try {
        setIsLoading(true);
        setIsLoadingPdf(true);
        const [fileDetail, fields, viewUrlData] = await Promise.all([
          getFileDetail(template_id),
          listSignatureFields(template_id),
          getFileViewUrl(template_id),
        ]);

        setFileData(fileDetail);
        setTitle(fileDetail.filename);
        setSignatureFields(fields);
        setPdfViewUrl(viewUrlData.view_url);

        let rolesArray: string[];
        let initialRecipients: Record<string, string>;

        // STRICT: Always extract roles from template fields first
        const roleSet = new Set<string>();
        const missingRole = fields.some((f) => !(f as SignatureField & { role?: string }).role);
        if (missingRole) {
          throw new Error(
            'This template has fields without a recipient role. Please open Prepare, select a recipient, and place fields again.'
          );
        }

        fields.forEach((field) => {
          const r = (field as SignatureField & { role?: string }).role as string;
          if (r) {
            roleSet.add(r);
          }
        });

        const sortRole = (r: string) => {
          if (r === 'Me') return -1000;
          const m = r.match(/^Signer\s+(\d+)$/i);
          if (m) return parseInt(m[1], 10);
          return 9999;
        };

        // Get all roles from template fields (sorted)
        const templateRoles = Array.from(roleSet).sort((a, b) => sortRole(a) - sortRole(b));
        if (templateRoles.length === 0) {
          throw new Error('No roles found on this template. Add fields in Prepare first.');
        }

        if (recipientsFromState && recipientsFromState.length > 0) {
          // Merge recipientsFromState with template field roles
          // All template field roles MUST be present in the final recipients list
          initialRecipients = {};
          
          // First, add all recipients from state (with their emails)
          recipientsFromState.forEach((r) => {
            // Auto-fill "Me" role with user's email if email is empty and user email is available
            if (r.role === 'Me' && !r.email && user?.email) {
              initialRecipients[r.role] = user.email;
            } else {
              initialRecipients[r.role] = r.email ?? '';
            }
          });
          
          // Then, add any template field roles that weren't in recipientsFromState (with empty email)
          templateRoles.forEach((role) => {
            if (!(role in initialRecipients)) {
              // Auto-fill "Me" role with user's email if available
              if (role === 'Me' && user?.email) {
                initialRecipients[role] = user.email;
              } else {
                initialRecipients[role] = '';
              }
            }
          });
          
          // Final roles array must include ALL template field roles
          rolesArray = templateRoles;
        } else {
          // No recipients from state - use template field roles only
          rolesArray = templateRoles;
          initialRecipients = {};
          rolesArray.forEach((role) => {
            // Auto-fill "Me" role with user's email if available
            if (role === 'Me' && user?.email) {
              initialRecipients[role] = user.email;
            } else {
              initialRecipients[role] = '';
            }
          });
        }

        setRoles(rolesArray);
        setRecipients(initialRecipients);

        setError(null);
      } catch (err: any) {
        logger.error('Failed to fetch template data:', err);
        setError(err.message || 'Failed to load template');
      } finally {
        setIsLoading(false);
        setIsLoadingPdf(false);
      }
    };

    fetchData();
  }, [template_id, user]);

  // Handle PDF document load
  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  }, []);

  // Handle PDF page render
  const onPageRender = useCallback((page: any) => {
    const pageNumber = page.pageNumber;
    const viewport = page.getViewport({ scale: 1.0 });
    
    setPageInfos((prev) => {
      const newMap = new Map(prev);
      newMap.set(pageNumber, {
        pageNumber,
        pdfWidth: viewport.width,
        pdfHeight: viewport.height,
        screenWidth: viewport.width,
        screenHeight: viewport.height,
      });
      return newMap;
    });
  }, []);

  // Get fields for a specific page
  const getFieldsForPage = useCallback((pageNumber: number) => {
    return signatureFields.filter((field) => field.page_number === pageNumber);
  }, [signatureFields]);

  // Handle email input change
  const handleEmailChange = (role: string, email: string) => {
    setRecipients(prev => ({
      ...prev,
      [role]: email,
    }));
  };

  // Roles are fixed by the template; emails are editable only.

  // Validate form
  const validateForm = (): boolean => {
    if (!title.trim()) {
      setError('Title is required');
      return false;
    }

    if (roles.length === 0) {
      setError('No roles found. Please add signature fields to the template first.');
      return false;
    }

    // Check all roles have emails
    for (const role of roles) {
      const email = recipients[role]?.trim();
      if (!email) {
        setError(`Email is required for ${role}`);
        return false;
      }

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        setError(`Invalid email format for ${role}`);
        return false;
      }
    }

    // Check for duplicate emails
    const emails = Object.values(recipients).map(e => e.trim().toLowerCase());
    const uniqueEmails = new Set(emails);
    if (emails.length !== uniqueEmails.size) {
      setError('Duplicate email addresses are not allowed');
      return false;
    }

    return true;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm() || !template_id) {
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      // Prepare recipients data
      const recipientsData: RecipientCreate[] = roles.map((role, index) => ({
        role,
        email: recipients[role].trim(),
        order_index: index,
      }));

      // Create signing request
      const signingRequest = await createSigningRequest({
        file_id: template_id,
        title: title.trim() || fileData?.filename || 'Untitled',
        signing_order: signingOrder,
        recipients: recipientsData,
      });

      // Navigate to documents page
      navigate('/documents');
    } catch (err: any) {
      logger.error('Failed to create signing request:', err);
      setError(err.response?.data?.detail || err.message || 'Failed to create signing request');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error && !fileData) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">{error}</p>
          <Button
            variant="secondary"
            onClick={() => navigate('/templates')}
            className="mt-4"
          >
            Back to Templates
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Send for Signature</h1>
        <p className="mt-1 text-sm text-gray-600">
          Create a signing request from your template
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700 mb-3">{error}</p>
          {error.includes("Repair fields") && template_id && (
            <Link
              to={`/documents/${template_id}/prepare`}
              className="inline-block px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition-colors"
            >
              Go to Prepare Page to Repair Fields
            </Link>
          )}
        </div>
      )}

      {/* PDF Preview Section */}
      {pdfViewUrl && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">PDF Preview with Signature Fields</h2>
          <div className="bg-gray-50 rounded-lg p-4 overflow-auto max-h-[600px]">
            {isLoadingPdf ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-6">
                <Document
                  file={pdfViewUrl}
                  onLoadSuccess={onDocumentLoadSuccess}
                  loading={
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    </div>
                  }
                  className="flex flex-col items-center gap-6"
                >
                  {numPages &&
                    Array.from({ length: numPages }, (_, index) => {
                      const pageNumber = index + 1;
                      const pageInfo = pageInfos.get(pageNumber);
                      const fields = getFieldsForPage(pageNumber);

                      return (
                        <div
                          key={pageNumber}
                          ref={(el) => {
                            if (el) pageRefs.current.set(pageNumber, el);
                          }}
                          className="relative border border-gray-300 shadow-sm bg-white"
                        >
                          <Page
                            pageNumber={pageNumber}
                            scale={1.0}
                            onLoadSuccess={onPageRender}
                            renderTextLayer={true}
                            renderAnnotationLayer={true}
                            className="relative"
                          />

                          {/* Signature Field Overlays - Read-only */}
                          {pageInfo &&
                            fields.map((field) => (
                              <SignatureFieldOverlay
                                key={field.id}
                                field={field}
                                pdfPageWidth={pageInfo.pdfWidth}
                                pdfPageHeight={pageInfo.pdfHeight}
                                screenPageWidth={pageInfo.screenWidth}
                                screenPageHeight={pageInfo.screenHeight}
                                editable={false}
                                role={field.role || 'Signer 1'}
                              />
                            ))}
                        </div>
                      );
                    })}
                </Document>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Template Info */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Template Information</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Template Name
              </label>
              <p className="text-sm text-gray-600">{fileData?.filename}</p>
            </div>
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                Document Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Enter document title"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Signature Fields
              </label>
              <p className="text-sm text-gray-600">
                {signatureFields.length} field{signatureFields.length !== 1 ? 's' : ''} found
              </p>
            </div>
          </div>
        </div>

        {/* Signing Order - only show when more than one signer */}
        {roles.length > 1 && (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Signing Order</h2>
            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="signing_order"
                  value="SEQUENTIAL"
                  checked={signingOrder === 'SEQUENTIAL'}
                  onChange={(e) => setSigningOrder(e.target.value as 'SEQUENTIAL' | 'PARALLEL')}
                  className="mr-3"
                />
                <div>
                  <span className="font-medium text-gray-900">Sequential</span>
                  <p className="text-sm text-gray-600">
                    Signers sign one after another in order
                  </p>
                </div>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="signing_order"
                  value="PARALLEL"
                  checked={signingOrder === 'PARALLEL'}
                  onChange={(e) => setSigningOrder(e.target.value as 'SEQUENTIAL' | 'PARALLEL')}
                  className="mr-3"
                />
                <div>
                  <span className="font-medium text-gray-900">Parallel</span>
                  <p className="text-sm text-gray-600">
                    Signers can sign in any order
                  </p>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* Recipients */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-medium text-gray-900">
                Recipients <span className="text-red-500">*</span>
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Map each template role to an email address. Role names come from Prepare and cannot be changed here.
              </p>
            </div>
          </div>
          <div className="space-y-4">
            {roles.map((role, index) => {
              return (
                <div key={role} className="flex items-start gap-2">
                  <div className="flex-1">
                    <label htmlFor={`email-${role}`} className="block text-sm font-medium text-gray-700 mb-1">
                      {role} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      id={`email-${role}`}
                      value={recipients[role] || ''}
                      onChange={(e) => handleEmailChange(role, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder={`Enter email for ${role}`}
                      required
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/templates')}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating...' : 'Create Signing Request'}
          </Button>
        </div>
      </form>
    </div>
  );
};
