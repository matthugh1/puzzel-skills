'use client';

import { useState } from 'react';

interface AgentFormProps {
    initialData?: {
        id?: string;
        name: string;
        description: string;
        goal: string;
        workflowId?: string;
    };
    onSubmit: (data: any) => Promise<void>;
    onCancel: () => void;
    isLoading?: boolean;
}

export function AgentForm({ initialData, onSubmit, onCancel, isLoading }: AgentFormProps) {
    const [formData, setFormData] = useState({
        name: initialData?.name || '',
        description: initialData?.description || '',
        goal: initialData?.goal || '',
        workflowId: initialData?.workflowId || '',
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(formData);
    };

    return (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            <div>
                <label
                    htmlFor="name"
                    style={{
                        display: 'block',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        marginBottom: 'var(--spacing-xs)',
                        color: 'var(--color-text)',
                    }}
                >
                    Agent Name
                </label>
                <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    placeholder="e.g. Research Assistant"
                    style={{
                        width: '100%',
                        padding: 'var(--spacing-sm)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        background: 'var(--color-surface)',
                        color: 'var(--color-text)',
                        fontSize: '0.875rem',
                    }}
                />
            </div>

            <div>
                <label
                    htmlFor="description"
                    style={{
                        display: 'block',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        marginBottom: 'var(--spacing-xs)',
                        color: 'var(--color-text)',
                    }}
                >
                    Description
                </label>
                <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="What does this agent do?"
                    rows={2}
                    style={{
                        width: '100%',
                        padding: 'var(--spacing-sm)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        background: 'var(--color-surface)',
                        color: 'var(--color-text)',
                        fontSize: '0.875rem',
                        resize: 'vertical',
                    }}
                />
            </div>

            <div>
                <label
                    htmlFor="goal"
                    style={{
                        display: 'block',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        marginBottom: 'var(--spacing-xs)',
                        color: 'var(--color-text)',
                    }}
                >
                    Primary Goal
                </label>
                <textarea
                    id="goal"
                    name="goal"
                    value={formData.goal}
                    onChange={handleChange}
                    required
                    placeholder="Define the specific objective for this agent..."
                    rows={3}
                    style={{
                        width: '100%',
                        padding: 'var(--spacing-sm)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        background: 'var(--color-surface)',
                        color: 'var(--color-text)',
                        fontSize: '0.875rem',
                        resize: 'vertical',
                    }}
                />
            </div>

            <div style={{ display: 'flex', gap: 'var(--spacing-md)', marginTop: 'var(--spacing-sm)' }}>
                <button
                    type="submit"
                    disabled={isLoading}
                    style={{
                        flex: 1,
                        padding: 'var(--spacing-sm)',
                        background: 'var(--color-primary)',
                        color: 'var(--color-on-primary)',
                        border: 'none',
                        borderRadius: 'var(--radius-md)',
                        fontWeight: 500,
                        cursor: isLoading ? 'not-allowed' : 'pointer',
                        opacity: isLoading ? 0.7 : 1,
                    }}
                >
                    {isLoading ? 'Saving...' : initialData?.id ? 'Update Agent' : 'Create Agent'}
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={isLoading}
                    style={{
                        padding: 'var(--spacing-sm) var(--spacing-lg)',
                        background: 'transparent',
                        color: 'var(--color-text-secondary)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        fontWeight: 500,
                        cursor: isLoading ? 'not-allowed' : 'pointer',
                    }}
                >
                    Cancel
                </button>
            </div>
        </form>
    );
}
