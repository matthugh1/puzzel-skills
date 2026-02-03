'use client';

import { useState } from 'react';

interface ApprovalActionsProps {
  onApprove: (comments?: string) => Promise<void>;
  onReject: (reason: string) => Promise<void>;
  isSubmitting?: boolean;
  canApprove?: boolean;
}

export function ApprovalActions({
  onApprove,
  onReject,
  isSubmitting = false,
  canApprove = true,
}: ApprovalActionsProps) {
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [approveComments, setApproveComments] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleApprove = async () => {
    setErrors({});
    try {
      await onApprove(approveComments.trim() || undefined);
      setShowApproveModal(false);
      setApproveComments('');
    } catch (error) {
      setErrors({ approve: error instanceof Error ? error.message : 'Failed to approve' });
    }
  };

  const handleReject = async () => {
    setErrors({});
    if (!rejectReason.trim()) {
      setErrors({ reject: 'Rejection reason is required' });
      return;
    }
    try {
      await onReject(rejectReason.trim());
      setShowRejectModal(false);
      setRejectReason('');
    } catch (error) {
      setErrors({ reject: error instanceof Error ? error.message : 'Failed to reject' });
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        gap: 'var(--spacing-md)',
        padding: 'var(--spacing-lg)',
        background: 'var(--color-surface-secondary)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-border)',
      }}
    >
      {canApprove && (
        <button
          onClick={() => setShowApproveModal(true)}
          disabled={isSubmitting}
          style={{
            flex: 1,
            padding: 'var(--spacing-md)',
            background: 'var(--color-success)',
            color: 'var(--color-on-primary)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: '1rem',
            fontWeight: 500,
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--font-body)',
            transition: 'opacity 0.2s ease',
            opacity: isSubmitting ? 0.6 : 1,
          }}
        >
          Approve
        </button>
      )}

      <button
        onClick={() => setShowRejectModal(true)}
        disabled={isSubmitting}
        style={{
          flex: 1,
          padding: 'var(--spacing-md)',
          background: 'var(--color-danger)',
          color: 'var(--color-on-primary)',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          fontSize: '1rem',
          fontWeight: 500,
          cursor: isSubmitting ? 'not-allowed' : 'pointer',
          fontFamily: 'var(--font-body)',
          transition: 'opacity 0.2s ease',
          opacity: isSubmitting ? 0.6 : 1,
        }}
      >
        Reject
      </button>

      {/* Approve Modal */}
      {showApproveModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'var(--color-overlay)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => {
            setShowApproveModal(false);
            setApproveComments('');
            setErrors({});
          }}
        >
          <div
            style={{
              background: 'var(--color-surface)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--spacing-xl)',
              maxWidth: '500px',
              width: '90%',
              maxHeight: '90vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                fontSize: '1.5rem',
                fontWeight: 600,
                marginBottom: 'var(--spacing-lg)',
                fontFamily: 'var(--font-display)',
                color: 'var(--color-text)',
              }}
            >
              Approve Version
            </h3>
            <div style={{ marginBottom: 'var(--spacing-lg)' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: 'var(--color-text)',
                  marginBottom: 'var(--spacing-xs)',
                }}
              >
                Comments (optional)
              </label>
              <textarea
                value={approveComments}
                onChange={(e) => setApproveComments(e.target.value)}
                placeholder="Add any comments about this approval..."
                rows={4}
                style={{
                  width: '100%',
                  padding: 'var(--spacing-md)',
                  background: 'var(--color-surface)',
                  border: errors.approve ? '1px solid var(--color-danger)' : '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.875rem',
                  color: 'var(--color-text)',
                  fontFamily: 'var(--font-body)',
                  resize: 'vertical',
                }}
              />
              {errors.approve && (
                <p style={{ marginTop: 'var(--spacing-xs)', fontSize: '0.875rem', color: 'var(--color-danger)' }}>
                  {errors.approve}
                </p>
              )}
            </div>
            <div style={{ display: 'flex', gap: 'var(--spacing-md)', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowApproveModal(false);
                  setApproveComments('');
                  setErrors({});
                }}
                disabled={isSubmitting}
                style={{
                  padding: 'var(--spacing-sm) var(--spacing-lg)',
                  background: 'var(--color-surface-secondary)',
                  color: 'var(--color-text)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-body)',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={isSubmitting}
                style={{
                  padding: 'var(--spacing-sm) var(--spacing-lg)',
                  background: 'var(--color-success)',
                  color: 'var(--color-on-primary)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-body)',
                }}
              >
                {isSubmitting ? 'Approving...' : 'Approve'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'var(--color-overlay)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => {
            setShowRejectModal(false);
            setRejectReason('');
            setErrors({});
          }}
        >
          <div
            style={{
              background: 'var(--color-surface)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--spacing-xl)',
              maxWidth: '500px',
              width: '90%',
              maxHeight: '90vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                fontSize: '1.5rem',
                fontWeight: 600,
                marginBottom: 'var(--spacing-lg)',
                fontFamily: 'var(--font-display)',
                color: 'var(--color-text)',
              }}
            >
              Reject Version
            </h3>
            <div style={{ marginBottom: 'var(--spacing-lg)' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: 'var(--color-text)',
                  marginBottom: 'var(--spacing-xs)',
                }}
              >
                Rejection Reason <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain why this version is being rejected..."
                rows={4}
                style={{
                  width: '100%',
                  padding: 'var(--spacing-md)',
                  background: 'var(--color-surface)',
                  border: errors.reject ? '1px solid var(--color-danger)' : '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.875rem',
                  color: 'var(--color-text)',
                  fontFamily: 'var(--font-body)',
                  resize: 'vertical',
                }}
              />
              {errors.reject && (
                <p style={{ marginTop: 'var(--spacing-xs)', fontSize: '0.875rem', color: 'var(--color-danger)' }}>
                  {errors.reject}
                </p>
              )}
            </div>
            <div style={{ display: 'flex', gap: 'var(--spacing-md)', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                  setErrors({});
                }}
                disabled={isSubmitting}
                style={{
                  padding: 'var(--spacing-sm) var(--spacing-lg)',
                  background: 'var(--color-surface-secondary)',
                  color: 'var(--color-text)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-body)',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={isSubmitting || !rejectReason.trim()}
                style={{
                  padding: 'var(--spacing-sm) var(--spacing-lg)',
                  background: !rejectReason.trim() || isSubmitting ? 'var(--color-surface-secondary)' : 'var(--color-danger)',
                  color: !rejectReason.trim() || isSubmitting ? 'var(--color-text-muted)' : 'var(--color-on-primary)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: isSubmitting || !rejectReason.trim() ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-body)',
                }}
              >
                {isSubmitting ? 'Rejecting...' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
