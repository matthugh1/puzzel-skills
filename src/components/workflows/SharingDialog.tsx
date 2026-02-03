'use client';

/**
 * Workflow Sharing Dialog Component
 * Allows sharing workflows with users and managing permissions
 */

import { useEffect, useState } from 'react';
import { workflowsApi, usersApi } from '@/lib/api-client';

interface Share {
  id: string;
  userId: string;
  permission: 'VIEWER' | 'EDITOR';
  user: {
    id: string;
    name: string | null;
    email: string;
  };
  sharedByUser: {
    id: string;
    name: string | null;
    email: string;
  };
  sharedAt: string;
}

interface User {
  id: string;
  name: string | null;
  email: string;
}

interface SharingDialogProps {
  workflowId: string;
  onClose: () => void;
}

export function SharingDialog({ workflowId, onClose }: SharingDialogProps) {
  const [shares, setShares] = useState<Share[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedPermission, setSelectedPermission] = useState<'VIEWER' | 'EDITOR'>('VIEWER');
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, [workflowId]);

  async function loadData() {
    try {
      setLoading(true);
      const [sharesResponse, usersResponse] = await Promise.all([
        workflowsApi.getSharedWith(workflowId),
        usersApi.list(),
      ]);
      setShares(sharesResponse.shares as Share[]);
      setUsers(usersResponse.users as User[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  async function handleShare() {
    if (!selectedUserId) {
      setError('Please select a user');
      return;
    }

    try {
      setSharing(true);
      setError(null);
      await workflowsApi.share(workflowId, {
        userId: selectedUserId,
        permission: selectedPermission,
      });
      await loadData();
      setSelectedUserId('');
      setSelectedPermission('VIEWER');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to share workflow');
    } finally {
      setSharing(false);
    }
  }

  async function handleUnshare(userId: string) {
    if (!confirm('Remove sharing with this user?')) {
      return;
    }

    try {
      await workflowsApi.unshare(workflowId, userId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove sharing');
    }
  }

  const filteredUsers = users.filter((user) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      user.email.toLowerCase().includes(query) ||
      (user.name && user.name.toLowerCase().includes(query))
    );
  });

  const sharedUserIds = new Set(shares.map((s) => s.userId));

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--spacing-lg)',
          maxWidth: '600px',
          width: '90%',
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 'var(--spacing-lg)',
          }}
        >
          <h2
            style={{
              fontSize: '1.5rem',
              fontWeight: 600,
              margin: 0,
              color: 'var(--color-text)',
              fontFamily: 'var(--font-display)',
            }}
          >
            Share Workflow
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: 'var(--color-text-secondary)',
            }}
          >
            ×
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: 'var(--spacing-sm) var(--spacing-md)',
              background: '#fee2e2',
              color: '#991b1b',
              borderRadius: 'var(--radius-md)',
              marginBottom: 'var(--spacing-md)',
              fontSize: '0.875rem',
            }}
          >
            {error}
          </div>
        )}

        {/* Share with new user */}
        <div
          style={{
            padding: 'var(--spacing-md)',
            background: 'var(--color-surface-secondary)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--spacing-lg)',
          }}
        >
          <h3
            style={{
              fontSize: '1rem',
              fontWeight: 600,
              margin: '0 0 var(--spacing-md) 0',
              color: 'var(--color-text)',
            }}
          >
            Share with User
          </h3>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--spacing-md)',
            }}
          >
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: 'var(--color-text)',
                  marginBottom: 'var(--spacing-xs)',
                }}
              >
                Search Users
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or email"
                style={{
                  width: '100%',
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.875rem',
                }}
              />
            </div>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: 'var(--color-text)',
                  marginBottom: 'var(--spacing-xs)',
                }}
              >
                User
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                style={{
                  width: '100%',
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.875rem',
                }}
              >
                <option value="">Select a user</option>
                {filteredUsers
                  .filter((user) => !sharedUserIds.has(user.id))
                  .map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name || user.email} ({user.email})
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: 'var(--color-text)',
                  marginBottom: 'var(--spacing-xs)',
                }}
              >
                Permission
              </label>
              <select
                value={selectedPermission}
                onChange={(e) => setSelectedPermission(e.target.value as 'VIEWER' | 'EDITOR')}
                style={{
                  width: '100%',
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.875rem',
                }}
              >
                <option value="VIEWER">Viewer (read-only)</option>
                <option value="EDITOR">Editor (can edit)</option>
              </select>
            </div>
            <button
              onClick={handleShare}
              disabled={sharing || !selectedUserId}
              style={{
                padding: 'var(--spacing-sm) var(--spacing-lg)',
                background: 'var(--color-primary)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: sharing || !selectedUserId ? 'not-allowed' : 'pointer',
                opacity: sharing || !selectedUserId ? 0.6 : 1,
              }}
            >
              {sharing ? 'Sharing...' : 'Share'}
            </button>
          </div>
        </div>

        {/* Shared users list */}
        <div>
          <h3
            style={{
              fontSize: '1rem',
              fontWeight: 600,
              margin: '0 0 var(--spacing-md) 0',
              color: 'var(--color-text)',
            }}
          >
            Shared With
          </h3>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 'var(--spacing-lg)', color: 'var(--color-text-secondary)' }}>
              Loading...
            </div>
          ) : shares.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--spacing-lg)', color: 'var(--color-text-secondary)' }}>
              Not shared with anyone yet
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--spacing-sm)',
              }}
            >
              {shares.map((share) => (
                <div
                  key={share.id}
                  style={{
                    padding: 'var(--spacing-md)',
                    background: 'var(--color-surface-secondary)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 500, color: 'var(--color-text)' }}>
                      {share.user.name || share.user.email}
                    </div>
                    <div
                      style={{
                        fontSize: '0.875rem',
                        color: 'var(--color-text-secondary)',
                      }}
                    >
                      {share.permission} • Shared by {share.sharedByUser.name || share.sharedByUser.email} •{' '}
                      {new Date(share.sharedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    onClick={() => handleUnshare(share.userId)}
                    style={{
                      padding: 'var(--spacing-xs) var(--spacing-sm)',
                      background: '#fee2e2',
                      color: '#991b1b',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
