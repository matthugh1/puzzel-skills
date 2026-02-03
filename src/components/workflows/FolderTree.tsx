'use client';

/**
 * Folder Tree Component
 * Displays nested folders with expand/collapse and drag-and-drop support
 */

import { useEffect, useState } from 'react';

interface Folder {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  children?: Folder[];
  _count?: {
    workflows: number;
  };
}

interface FolderTreeProps {
  selectedFolderId?: string | null;
  onFolderSelect?: (folderId: string | null) => void;
  onWorkflowMove?: (workflowId: string, folderId: string | null) => void;
}

export function FolderTree({ selectedFolderId, onFolderSelect, onWorkflowMove }: FolderTreeProps) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draggedWorkflowId, setDraggedWorkflowId] = useState<string | null>(null);

  useEffect(() => {
    loadFolders();
  }, []);

  const loadFolders = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/folders', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to load folders');
      }
      const data = await response.json();
      setFolders(data.folders || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load folders');
      console.error('Error loading folders:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const handleFolderClick = (folderId: string) => {
    onFolderSelect?.(folderId === selectedFolderId ? null : folderId);
  };

  const handleDragOver = (e: React.DragEvent, folderId: string | null) => {
    if (draggedWorkflowId) {
      e.preventDefault();
      e.currentTarget.style.background = 'var(--color-surface-secondary)';
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.style.background = 'transparent';
  };

  const handleDrop = (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    e.currentTarget.style.background = 'transparent';
    if (draggedWorkflowId && onWorkflowMove) {
      onWorkflowMove(draggedWorkflowId, folderId);
      setDraggedWorkflowId(null);
    }
  };

  const renderFolder = (folder: Folder, level: number = 0): React.ReactNode => {
    const isExpanded = expandedFolders.has(folder.id);
    const isSelected = selectedFolderId === folder.id;
    const hasChildren = folder.children && folder.children.length > 0;

    return (
      <div key={folder.id}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: 'var(--spacing-xs) var(--spacing-sm)',
            paddingLeft: `calc(var(--spacing-sm) + ${level} * var(--spacing-md))`,
            cursor: 'pointer',
            background: isSelected ? 'var(--color-surface-secondary)' : 'transparent',
            borderRadius: 'var(--radius-sm)',
            marginBottom: 'var(--spacing-xs)',
            userSelect: 'none',
          }}
          onClick={() => handleFolderClick(folder.id)}
          onDragOver={(e) => handleDragOver(e, folder.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, folder.id)}
        >
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFolder(folder.id);
              }}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: 'var(--spacing-xs)',
                marginRight: 'var(--spacing-xs)',
                display: 'flex',
                alignItems: 'center',
                color: 'var(--color-text-secondary)',
              }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style={{
                  transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s',
                }}
              >
                <path
                  d="M4.5 3L7.5 6L4.5 9"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          ) : (
            <div style={{ width: '20px', marginRight: 'var(--spacing-xs)' }} />
          )}
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ marginRight: 'var(--spacing-xs)', flexShrink: 0 }}
          >
            <path
              d="M2 4C2 3.44772 2.44772 3 3 3H6.58579C6.851 3 7.10536 3.10536 7.29289 3.29289L8.70711 4.70711C8.89464 4.89464 9.149 5 9.41421 5H13C13.5523 5 14 5.44772 14 6V12C14 12.5523 13.5523 13 13 13H3C2.44772 13 2 12.5523 2 12V4Z"
              fill="var(--color-primary)"
              fillOpacity="0.2"
              stroke="var(--color-primary)"
              strokeWidth="1.5"
            />
          </svg>
          <span
            style={{
              flex: 1,
              fontSize: '0.875rem',
              color: isSelected ? 'var(--color-primary)' : 'var(--color-text)',
              fontWeight: isSelected ? 500 : 400,
            }}
          >
            {folder.name}
          </span>
          {folder._count && folder._count.workflows > 0 && (
            <span
              style={{
                fontSize: '0.75rem',
                color: 'var(--color-text-secondary)',
                marginLeft: 'var(--spacing-xs)',
              }}
            >
              {folder._count.workflows}
            </span>
          )}
        </div>
        {hasChildren && isExpanded && (
          <div>
            {folder.children!.map((child) => renderFolder(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div
        style={{
          padding: 'var(--spacing-lg)',
          textAlign: 'center',
          color: 'var(--color-text-secondary)',
          fontSize: '0.875rem',
        }}
      >
        Loading folders...
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: 'var(--spacing-md)',
          background: '#fee2e2',
          color: '#991b1b',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.875rem',
        }}
      >
        {error}
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          padding: 'var(--spacing-sm)',
          borderBottom: '1px solid var(--color-border)',
          marginBottom: 'var(--spacing-sm)',
        }}
      >
        <button
          onClick={() => onFolderSelect?.(null)}
          style={{
            width: '100%',
            padding: 'var(--spacing-xs) var(--spacing-sm)',
            background: selectedFolderId === null ? 'var(--color-surface-secondary)' : 'transparent',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.875rem',
            color: selectedFolderId === null ? 'var(--color-primary)' : 'var(--color-text)',
            fontWeight: selectedFolderId === null ? 500 : 400,
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          All Workflows
        </button>
      </div>
      <div>
        {folders.length === 0 ? (
          <div
            style={{
              padding: 'var(--spacing-lg)',
              textAlign: 'center',
              color: 'var(--color-text-secondary)',
              fontSize: '0.875rem',
            }}
          >
            No folders yet
          </div>
        ) : (
          folders.map((folder) => renderFolder(folder))
        )}
      </div>
    </div>
  );
}

// Export function to set dragged workflow ID (to be called from workflow list)
export function setDraggedWorkflow(folderTreeRef: React.RefObject<{ setDragged: (id: string | null) => void }>, workflowId: string | null) {
  folderTreeRef.current?.setDragged(workflowId);
}
