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
    <div className="space-y-8 animate-slide-up">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-2 text-gray-600">
            Welcome back! Here's what's happening with your documents.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Total Documents */}
          <Card>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Documents</p>
                  <p className="mt-2 text-3xl font-bold text-gray-900">
                    {isLoading ? '...' : stats?.total || 0}
                  </p>
                </div>
                <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pending Signatures */}
          <Card>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Pending Signatures</p>
                  <p className="mt-2 text-3xl font-bold text-amber-600">
                    {isLoading ? '...' : pendingCount}
                  </p>
                </div>
                <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Completed Documents */}
          <Card>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Completed Documents</p>
                  <p className="mt-2 text-3xl font-bold text-green-600">
                    {isLoading ? '...' : stats?.completed || 0}
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Documents */}
        {!isLoading && recentDocuments.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent Documents</CardTitle>
                  <CardDescription>Your latest signing requests</CardDescription>
                </div>
                <Link to="/documents">
                  <Button variant="outline" size="sm">View All</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentDocuments.map((doc) => (
                  <Link
                    key={doc.id}
                    to={`/documents/${doc.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{doc.title}</p>
                        <p className="text-sm text-gray-500">
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
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks to get you started</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Link to="/upload">
                <Button variant="primary" size="lg" fullWidth>
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Upload Document
                </Button>
              </Link>
              <Link to="/documents">
                <Button variant="outline" size="lg" fullWidth>
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  View All Documents
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* How SignFlo Works */}
        <Card>
          <CardHeader>
            <CardTitle>How SignFlo Works</CardTitle>
            <CardDescription>A simple guide to getting started</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold">
                  1
                </div>
                <div>
                  <p className="font-medium text-gray-900">Upload Your Document</p>
                  <p className="text-sm text-gray-600 mt-0.5">
                    Start by uploading any PDF document you need signed.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold">
                  2
                </div>
                <div>
                  <p className="font-medium text-gray-900">Add Signature Fields</p>
                  <p className="text-sm text-gray-600 mt-0.5">
                    Drag and drop signature fields onto your document.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold">
                  3
                </div>
                <div>
                  <p className="font-medium text-gray-900">Assign Signers & Send</p>
                  <p className="text-sm text-gray-600 mt-0.5">
                    Assign fields to specific users and send the document for signing.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
    </div>
  );
};
