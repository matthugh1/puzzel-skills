'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FileUpload } from '@/components/documents/FileUpload';
import { SkillSelector } from '@/components/documents/SkillSelector';

const PLATFORM_CORE_URL = process.env.NEXT_PUBLIC_PLATFORM_CORE_URL || 'http://localhost:3000';

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [selectedSkillId, setSelectedSkillId] = useState<string>('');
  const [selectedSkillName, setSelectedSkillName] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);


  const handleFilesSelected = (selectedFiles: File[]) => {
    setFiles(selectedFiles);
    setUploadError(null);
    setUploadSuccess(false);
  };

  const handleSkillSelect = (skillId: string, skillName: string) => {
    setSelectedSkillId(skillId);
    setSelectedSkillName(skillName);
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      setUploadError('Please select at least one file');
      return;
    }

    if (!selectedSkillId) {
      setUploadError('Please select a compliance skill');
      return;
    }

    setUploading(true);
    setUploadError(null);
    setUploadSuccess(false);

    try {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append('files', file);
      });
      formData.append('skillId', selectedSkillId);
      formData.append('skillName', selectedSkillName);

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setUploadSuccess(true);
        setFiles([]);
        setSelectedSkillId('');
        setSelectedSkillName('');
        // Reset file input
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        if (fileInput) {
          fileInput.value = '';
        }
      } else {
        setUploadError(data.error || 'Failed to upload files');
      }
    } catch (error: any) {
      setUploadError(error.message || 'Failed to upload files');
    } finally {
      setUploading(false);
    }
  };

  // Show loading while checking authentication
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-background)' }}>
        <div style={{ color: 'var(--color-text-secondary)' }}>Loading...</div>
      </div>
    );
  }

  // If not authenticated, show a message with login link
  if (status === 'unauthenticated') {
    return (
      <main className="container mx-auto px-4 py-8 max-w-4xl" style={{ backgroundColor: 'var(--color-background)' }}>
        <div style={{ 
          backgroundColor: 'var(--color-surface)', 
          borderRadius: 'var(--radius-lg)', 
          boxShadow: 'var(--shadow-md)', 
          padding: 'var(--spacing-xl)',
          textAlign: 'center',
          border: '1px solid var(--color-border)'
        }}>
          <h1 style={{ 
            fontSize: '1.875rem', 
            fontWeight: '700', 
            color: 'var(--color-text)', 
            marginBottom: 'var(--spacing-md)',
            fontFamily: 'Space Grotesk, sans-serif'
          }}>
            Compliance Analyzer
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-lg)' }}>
            Please sign in to access the Compliance Analyzer.
          </p>
          <a
            href={`${PLATFORM_CORE_URL}/auth/login?callbackUrl=${encodeURIComponent(window.location.href)}`}
            style={{
              display: 'inline-block',
              backgroundColor: 'var(--color-primary)',
              color: 'white',
              padding: 'var(--spacing-sm) var(--spacing-md)',
              borderRadius: 'var(--radius-md)',
              transition: 'background-color var(--transition-fast)',
              textDecoration: 'none',
              fontWeight: '500'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-primary-dark)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-primary)'}
          >
            Sign in via Platform Core
          </a>
        </div>
      </main>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-background)' }}>
      <div style={{ maxWidth: '896px', margin: '0 auto', padding: 'var(--spacing-xl) var(--spacing-md)' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: 'var(--spacing-xl)' 
        }}>
          <h1 style={{ 
            fontSize: '1.875rem', 
            fontWeight: '700', 
            color: 'var(--color-text)',
            fontFamily: 'Space Grotesk, sans-serif'
          }}>
            Compliance Analyzer
          </h1>
          <Link
            href="/documents"
            style={{ 
              color: 'var(--color-primary)', 
              fontWeight: '500', 
              fontSize: '0.875rem', 
              textDecoration: 'none',
              transition: 'color var(--transition-fast)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-primary-dark)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-primary)'}
          >
            View Documents →
          </Link>
        </div>

        <div style={{ 
          backgroundColor: 'var(--color-surface)', 
          borderRadius: 'var(--radius-lg)', 
          boxShadow: 'var(--shadow-md)', 
          border: '1px solid var(--color-border)', 
          padding: 'var(--spacing-xl)' 
        }}>
          <div style={{ marginBottom: 'var(--spacing-lg)' }}>
            <h2 style={{ 
              fontSize: '1.25rem', 
              fontWeight: '600', 
              color: 'var(--color-text)', 
              marginBottom: 'var(--spacing-sm)',
              fontFamily: 'Space Grotesk, sans-serif'
            }}>
              Upload Documents for Analysis
            </h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
              Upload one or more documents and select a compliance skill to analyze
              them against specific standards or requirements.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
            {/* Skill Selector */}
            <SkillSelector
              onSkillSelect={handleSkillSelect}
              selectedSkillId={selectedSkillId}
              disabled={uploading}
            />

            {/* File Upload */}
            <FileUpload
              onFilesSelected={handleFilesSelected}
              disabled={uploading || !selectedSkillId}
            />
          </div>

          {/* Selected Files List */}
          {files.length > 0 && (
            <div style={{ 
              paddingTop: 'var(--spacing-md)', 
              borderTop: '1px solid var(--color-border)', 
              marginTop: 'var(--spacing-md)' 
            }}>
              <h3 style={{ 
                fontSize: '0.875rem', 
                fontWeight: '500', 
                color: 'var(--color-text)', 
                marginBottom: 'var(--spacing-sm)' 
              }}>
                Selected Files ({files.length})
              </h3>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                {files.map((file, index) => (
                  <li
                    key={index}
                    style={{ 
                      fontSize: '0.875rem', 
                      color: 'var(--color-text)', 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      backgroundColor: 'var(--color-surface-secondary)', 
                      padding: '0.75rem', 
                      borderRadius: 'var(--radius-md)', 
                      border: '1px solid var(--color-border)' 
                    }}
                  >
                    <span style={{ 
                      fontWeight: '500', 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis', 
                      whiteSpace: 'nowrap', 
                      flex: 1, 
                      marginRight: 'var(--spacing-sm)' 
                    }}>
                      {file.name}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Error Message */}
          {uploadError && (
            <div style={{ 
              backgroundColor: '#fef2f2', 
              border: '1px solid #fecaca', 
              borderRadius: 'var(--radius-md)', 
              padding: 'var(--spacing-md)',
              marginTop: 'var(--spacing-md)'
            }}>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-danger)', fontWeight: '500' }}>
                {uploadError}
              </p>
            </div>
          )}

          {/* Success Message */}
          {uploadSuccess && (
            <div style={{ 
              backgroundColor: '#f0fdf4', 
              border: '1px solid #bbf7d0', 
              borderRadius: 'var(--radius-md)', 
              padding: 'var(--spacing-md)',
              marginTop: 'var(--spacing-md)'
            }}>
              <p style={{ 
                fontSize: '0.875rem', 
                color: 'var(--color-success)', 
                fontWeight: '500', 
                marginBottom: 'var(--spacing-sm)' 
              }}>
                Files uploaded successfully! You can now analyze them.
              </p>
              <Link
                href="/documents"
                style={{ 
                  fontSize: '0.875rem', 
                  color: 'var(--color-success)', 
                  textDecoration: 'underline', 
                  fontWeight: '500' 
                }}
              >
                View all documents →
              </Link>
            </div>
          )}

          {/* Upload Button */}
          <div style={{ 
            paddingTop: 'var(--spacing-md)', 
            borderTop: '1px solid var(--color-border)', 
            marginTop: 'var(--spacing-md)' 
          }}>
            <button
              onClick={handleUpload}
              disabled={uploading || files.length === 0 || !selectedSkillId}
              style={{
                width: '100%',
                backgroundColor: uploading || files.length === 0 || !selectedSkillId 
                  ? 'var(--color-border)' 
                  : 'var(--color-primary)',
                color: 'white',
                padding: '0.75rem var(--spacing-md)',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                fontWeight: '500',
                cursor: uploading || files.length === 0 || !selectedSkillId ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                transition: 'background-color var(--transition-fast)'
              }}
              onMouseEnter={(e) => {
                if (!uploading && files.length > 0 && selectedSkillId) {
                  e.currentTarget.style.backgroundColor = 'var(--color-primary-dark)';
                }
              }}
              onMouseLeave={(e) => {
                if (!uploading && files.length > 0 && selectedSkillId) {
                  e.currentTarget.style.backgroundColor = 'var(--color-primary)';
                }
              }}
            >
              {uploading ? 'Uploading...' : 'Upload Documents'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
