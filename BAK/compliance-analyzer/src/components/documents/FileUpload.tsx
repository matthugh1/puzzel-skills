'use client';

import { useState, useRef } from 'react';

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
}

export function FileUpload({ onFilesSelected, disabled = false }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    onFilesSelected(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    onFilesSelected(files);
  };

  const handleClick = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
      <label style={{ 
        display: 'block', 
        fontSize: '0.875rem', 
        fontWeight: '500', 
        color: 'var(--color-text)' 
      }}>
        Upload Documents
      </label>
      <div
        style={{
          border: `2px dashed ${isDragging ? 'var(--color-primary)' : 'var(--color-border)'}`,
          borderRadius: 'var(--radius-md)',
          padding: 'var(--spacing-md)',
          textAlign: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          backgroundColor: isDragging ? 'var(--color-surface-secondary)' : 'var(--color-surface-secondary)',
          opacity: disabled ? 0.5 : 1,
          transition: 'all var(--transition-base)',
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.txt,.rtf"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
          disabled={disabled}
        />
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          padding: 'var(--spacing-sm) 0' 
        }}>
          <svg
            style={{ 
              height: '2rem', 
              width: '2rem', 
              color: 'var(--color-text-muted)', 
              marginBottom: 'var(--spacing-sm)' 
            }}
            stroke="currentColor"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>
            {isDragging ? (
              <span style={{ color: 'var(--color-primary)', fontWeight: '500' }}>Drop files here</span>
            ) : (
              <>
                <span style={{ color: 'var(--color-primary)', fontWeight: '500' }}>Click to upload</span>
                {' '}or drag and drop
              </>
            )}
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            PDF, DOCX, DOC, TXT, RTF (Max 10MB per file)
          </p>
        </div>
      </div>
    </div>
  );
}
