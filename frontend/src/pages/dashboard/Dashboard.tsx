/**
 * Dashboard Page
 * 
 * Main landing page after login showing:
 * - User stats (Total Documents, Pending Signatures, Completed)
 * - Recent documents
 * - Quick actions
 * 
 * Uses signing requests API for accurate workflow-based stats
 */

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, StatusBadge } from '../../components/ui';
import { listSigningRequests, getSigningRequestStats, SigningRequestListItem, SigningRequestStats } from '../../lib/signingRequestApi';
import { logger } from '../../utils/logger';

export const Dashboard: React.FC = () => {
  const [requests, setRequests] = useState<SigningRequestListItem[]>([]);
  const [stats, setStats] = useState<SigningRequestStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch signing requests and stats on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [requestsData, statsData] = await Promise.all([
          listSigningRequests(),
          getSigningRequestStats(),
        ]);
        setRequests(requestsData);
        setStats(statsData);
        setError(null);
      } catch (err) {
        logger.error('Failed to fetch dashboard data:', err);
        setError('Failed to load dashboard data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Get recent documents (latest 5)
  const recentDocuments = requests.slice(0, 5);

  // Calculate pending (SENT + IN_PROGRESS)
  const pendingCount = (stats?.sent || 0) + (stats?.in_progress || 0);

  return (
    <div className="space-y-8">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Welcome back. Here's what's happening with your documents.
          </p>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Stats Grid – modern card layout */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card padding="none">
            <CardContent>
              <div className="flex items-center justify-between p-5">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Documents</p>
                  <p className="mt-1 text-2xl font-semibold text-gray-900">
                    {isLoading ? '—' : stats?.total ?? 0}
                  </p>
                </div>
                <div className="w-11 h-11 bg-indigo-50 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card padding="none">
            <CardContent>
              <div className="flex items-center justify-between p-5">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Pending</p>
                  <p className="mt-1 text-2xl font-semibold text-amber-600">
                    {isLoading ? '—' : pendingCount}
                  </p>
                </div>
                <div className="w-11 h-11 bg-amber-50 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card padding="none">
            <CardContent>
              <div className="flex items-center justify-between p-5">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Completed</p>
                  <p className="mt-1 text-2xl font-semibold text-green-600">
                    {isLoading ? '—' : stats?.completed ?? 0}
                  </p>
                </div>
                <div className="w-11 h-11 bg-green-50 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {!isLoading && recentDocuments.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Recent Documents</CardTitle>
                  <CardDescription>Your latest signing requests</CardDescription>
                </div>
                <Link to="/documents">
                  <Button variant="outline" size="sm">View All</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recentDocuments.map((doc) => (
                  <Link
                    key={doc.id}
                    to={`/documents/${doc.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-smooth"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate text-sm">{doc.title}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(doc.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={doc.status} size="sm" />
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
            <CardDescription>Common tasks to get you started</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Link to="/upload">
                <Button variant="primary" size="lg" fullWidth className="justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Upload Document
                </Button>
              </Link>
              <Link to="/documents">
                <Button variant="outline" size="lg" fullWidth className="justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  View All Documents
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">How SignFlo Works</CardTitle>
            <CardDescription>A simple guide to getting started</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { step: 1, title: 'Upload Your Document', desc: 'Start by uploading any PDF document you need signed.' },
                { step: 2, title: 'Add Signature Fields', desc: 'Drag and drop signature fields onto your document.' },
                { step: 3, title: 'Assign Signers & Send', desc: 'Assign fields to specific users and send the document for signing.' },
              ].map(({ step, title, desc }) => (
                <div key={step} className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center shrink-0 text-sm font-semibold">
                    {step}
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
