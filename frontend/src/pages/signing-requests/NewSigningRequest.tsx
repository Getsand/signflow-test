/**
 * New Signing Request Page
 * 
 * Create a signing request from a template.
 * Maps roles to email addresses and chooses signing order.
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../../components/ui';
import { getFileDetail, FileDetail } from '../../lib/fileApi';
import { listSignatureFields, SignatureField } from '../../lib/signatureFieldApi';
import { createSigningRequest, RecipientCreate } from '../../lib/signingRequestApi';

export const NewSigningRequest: React.FC = () => {
  const { template_id } = useParams<{ template_id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  console.log('[NewSigningRequest] Component rendered, template_id:', template_id);

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

  // Fetch template data and signature fields
  useEffect(() => {
    console.log('[NewSigningRequest] useEffect triggered, template_id:', template_id);
    const fetchData = async () => {
      if (!template_id) {
        console.error('[NewSigningRequest] No template_id provided');
        setError('Template ID not provided');
        setIsLoading(false);
        return;
      }

      try {
        console.log('[NewSigningRequest] Fetching data for template_id:', template_id);
        setIsLoading(true);
        const [fileDetail, fields] = await Promise.all([
          getFileDetail(template_id),
          listSignatureFields(template_id),
        ]);

        setFileData(fileDetail);
        setTitle(fileDetail.filename);
        setSignatureFields(fields);

        let rolesArray: string[];
        let initialRecipients: Record<string, string>;

        if (recipientsFromState && recipientsFromState.length > 0) {
          // Use recipients from Add Recipients step (role + email)
          rolesArray = recipientsFromState.map((r) => r.role);
          initialRecipients = {};
          recipientsFromState.forEach((r) => {
            initialRecipients[r.role] = r.email ?? '';
          });
        } else {
          // Derive roles from template fields: prefer field.role, else unique assigned_to
          const roleSet = new Set<string>();
          fields.forEach((field) => {
            const r = (field as SignatureField & { role?: string }).role;
            if (r) roleSet.add(r);
            else roleSet.add(field.assigned_to);
          });
          let roleIndex = 1;
          rolesArray = [];
          roleSet.forEach(() => {
            rolesArray.push(`Signer ${roleIndex}`);
            roleIndex++;
          });
          if (rolesArray.length === 0) rolesArray.push('Signer 1');
          if (expectedSignerCountFromState && expectedSignerCountFromState > rolesArray.length) {
            for (let i = rolesArray.length; i < expectedSignerCountFromState; i++) {
              rolesArray.push(`Signer ${rolesArray.length + 1}`);
            }
          }
          initialRecipients = {};
          rolesArray.forEach((role) => {
            initialRecipients[role] = '';
          });
        }

        setRoles(rolesArray);
        setRecipients(initialRecipients);

        setError(null);
      } catch (err: any) {
        console.error('Failed to fetch template data:', err);
        setError(err.message || 'Failed to load template');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [template_id]);

  // Handle email input change
  const handleEmailChange = (role: string, email: string) => {
    setRecipients(prev => ({
      ...prev,
      [role]: email,
    }));
  };

  // Add a new signer row
  const handleAddSigner = () => {
    const newRole = `Signer ${roles.length + 1}`;
    setRoles(prev => [...prev, newRole]);
    setRecipients(prev => ({
      ...prev,
      [newRole]: '',
    }));
  };

  // Remove a signer row (only if no email is entered)
  const handleRemoveSigner = (role: string) => {
    const email = recipients[role]?.trim();
    if (email) {
      // Don't allow removal if email is entered
      return;
    }
    setRoles(prev => prev.filter(r => r !== role));
    setRecipients(prev => {
      const updated = { ...prev };
      delete updated[role];
      return updated;
    });
  };

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
      console.error('Failed to create signing request:', err);
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
    console.log('[NewSigningRequest] Rendering error state:', error);
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

  console.log('[NewSigningRequest] Rendering main form');
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
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
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

        {/* Signing Order */}
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

        {/* Recipients */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-medium text-gray-900">
                Recipients <span className="text-red-500">*</span>
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Map each role to an email address. You can add multiple signers or assign multiple roles to one signer.
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleAddSigner}
            >
              + Add Signer
            </Button>
          </div>
          <div className="space-y-4">
            {roles.map((role, index) => {
              const hasEmail = recipients[role]?.trim();
              const canRemove = !hasEmail && roles.length > 1;
              
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
                  {canRemove && (
                    <button
                      type="button"
                      onClick={() => handleRemoveSigner(role)}
                      className="mt-6 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Remove signer"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
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
