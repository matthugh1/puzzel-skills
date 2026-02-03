'use client';

import { useState } from 'react';

interface SkillSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SkillSearch({
  value,
  onChange,
  placeholder = 'Search skills...',
}: SkillSearchProps) {
  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input"
        style={{
          padding: 'var(--spacing-md) var(--spacing-lg)',
          paddingLeft: '2.75rem',
        }}
      />
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          position: 'absolute',
          left: 'var(--spacing-md)',
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--color-text-muted)',
        }}
      >
        <path
          d="M9 3C5.686 3 3 5.686 3 9c0 3.314 2.686 6 6 6 1.657 0 3.157-.672 4.243-1.757l3.535 3.536a1 1 0 001.414-1.414l-3.536-3.536A5.954 5.954 0 0015 9c0-3.314-2.686-6-6-6zm0 2a4 4 0 110 8 4 4 0 010-8z"
          fill="currentColor"
        />
      </svg>
    </div>
  );
}
