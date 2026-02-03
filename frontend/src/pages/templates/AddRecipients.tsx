/**
 * Add Recipients Page (Use Template flow)
 *
 * Step 1 when using a template: add recipients/signers with role and email.
 * Then go to Prepare to place fields for each role.
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Button } from '../../components/ui';
import { getFileDetail, FileDetail } from '../../lib/fileApi';
import { useAuth } from '../../lib/auth';

export interface RecipientEntry {
  role: string;
  email: string;
}

const DEFAULT_RECIPIENTS: RecipientEntry[] = [
  { role: 'Signer 1', email: '' },
];

function ensureUniqueRoles(entries: RecipientEntry[]): RecipientEntry[] {
  const seen = new Set<string>();
  return entries.map((entry, index) => {
    let role = entry.role;
    if (seen.has(role)) {
      const n = entries.filter((r) => r.role.startsWith('Signer ')).length;
      role = `Signer ${n + 1}`;
    }
    seen.add(role);
    return { ...entry, role };
  });
}

export const AddRecipients: React.FC = () => {
  const { file_id } = useParams<{ file_id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [fileData, setFileData] = useState<FileDetail | null>(null);
  const [recipients, setRecipients] = useState<RecipientEntry[]>(DEFAULT_RECIPIENTS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFile = async () => {
      if (!file_id) {
        setError('Template ID missing');
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        const detail = await getFileDetail(file_id);
        setFileData(detail);
        setError(null);
      } catch (err: any) {
        setError(err.message || 'Failed to load template');
      } finally {
        setIsLoading(false);
      }
    };
    fetchFile();
  }, [file_id]);

  const handleAddRecipient = () => {
    const nextNum = recipients.filter((r) => r.role.startsWith('Signer ')).length + 1;
    setRecipients((prev) => ensureUniqueRoles([...prev, { role: `Signer ${nextNum}`, email: '' }]));
  };

  const handleAddMe = () => {
    if (recipients.some((r) => r.role === 'Me')) return;
    setRecipients((prev) => [{ role: 'Me', email: user?.email ?? '' }, ...prev]);
  };

  const handleRemoveRecipient = (index: number) => {
    if (recipients.length <= 1) return;
    setRecipients((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEmailChange = (index: number, email: string) => {
    setRecipients((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], email };
      return next;
    });
  };

  const handleNextToPrepare = () => {
    if (!file_id) return;
    navigate(`/templates/${file_id}/prepare`, {
      state: {
        recipients: recipients.map((r) => ({ role: r.role, email: r.email })),
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (error || !fileData) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <p className="text-red-600">{error || 'Template not found'}</p>
        <Link to="/templates">
          <Button variant="outline" className="mt-4">Back to Templates</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Add Recipients</h1>
        <p className="text-sm text-gray-600 mt-1">
          Add signers and their emails. You can add &quot;Me&quot; and assign your email later. Then you&apos;ll place fields for each recipient on the next step.
        </p>
        <p className="text-sm text-gray-500 mt-1">{fileData.filename}</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">Recipients / Signers</h2>
          <div className="flex gap-2">
            {!recipients.some((r) => r.role === 'Me') && (
              <Button type="button" variant="secondary" size="sm" onClick={handleAddMe}>
                + Add Me
              </Button>
            )}
            <Button type="button" variant="secondary" size="sm" onClick={handleAddRecipient}>
              + Add Signer
            </Button>
          </div>
        </div>
        <div className="space-y-4">
          {recipients.map((entry, index) => (
            <div key={`${entry.role}-${index}`} className="flex items-start gap-2">
              <div className="flex-1 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <div className="px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-gray-700">
                    {entry.role}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={entry.email}
                    onChange={(e) => handleEmailChange(index, e.target.value)}
                    placeholder={entry.role === 'Me' && user?.email ? user.email : 'email@example.com'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              {recipients.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveRecipient(index)}
                  className="mt-8 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                  title="Remove"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between mt-6">
        <Link to="/templates">
          <Button variant="outline">Cancel</Button>
        </Link>
        <Button variant="primary" onClick={handleNextToPrepare}>
          Next: Prepare Document
        </Button>
      </div>
    </div>
  );
};
