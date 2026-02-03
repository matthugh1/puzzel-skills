'use client';

/**
 * Integrations Management Page
 * Lists available integrations and user's connected apps
 */

import { useEffect, useState } from 'react';
import { integrationsApi } from '@/lib/api-client';
import Link from 'next/link';

interface Integration {
  name: string;
  displayName: string;
  description: string;
  icon?: string;
}

interface ConnectedIntegration {
  id: string;
  appName: string;
  status: string;
  lastSyncAt: string | null;
  createdAt: string;
}

export default function IntegrationsPage() {
  const [availableIntegrations, setAvailableIntegrations] = useState<Integration[]>([]);
  const [connectedIntegrations, setConnectedIntegrations] = useState<ConnectedIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);

  useEffect(() => {
    loadIntegrations();
  }, []);

  async function loadIntegrations() {
    try {
      setLoading(true);
      const data = await integrationsApi.list();
      setAvailableIntegrations(data.available as Integration[]);
      setConnectedIntegrations(data.connected as ConnectedIntegration[]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load integrations');
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect(app: string) {
    try {
      setConnecting(app);
      const response = await integrationsApi.connect(app);
      // Redirect to OAuth URL
      window.location.href = response.authUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initiate connection');
      setConnecting(null);
    }
  }

  async function handleDisconnect(app: string) {
    if (!confirm(`Are you sure you want to disconnect ${app}?`)) {
      return;
    }

    try {
      await integrationsApi.disconnect(app);
      await loadIntegrations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    }
  }

  function isConnected(appName: string): boolean {
    return connectedIntegrations.some((int) => int.appName === appName && int.status === 'CONNECTED');
  }

  function getConnectedIntegration(appName: string): ConnectedIntegration | undefined {
    return connectedIntegrations.find((int) => int.appName === appName && int.status === 'CONNECTED');
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading integrations...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Integrations</h1>
        <p className="text-gray-600">Connect external apps to use in your workflows</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Available Integrations */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Available Integrations</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {availableIntegrations.map((integration) => {
            const connected = isConnected(integration.name);
            const connectedData = getConnectedIntegration(integration.name);

            return (
              <div
                key={integration.name}
                className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{integration.displayName}</h3>
                    <p className="text-sm text-gray-600 mt-1">{integration.description}</p>
                  </div>
                  {connected && (
                    <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
                      Connected
                    </span>
                  )}
                </div>

                {connected && connectedData && (
                  <div className="mb-4 text-sm text-gray-600">
                    <p>Connected: {new Date(connectedData.createdAt).toLocaleDateString()}</p>
                    {connectedData.lastSyncAt && (
                      <p>Last sync: {new Date(connectedData.lastSyncAt).toLocaleDateString()}</p>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  {!connected ? (
                    <button
                      onClick={() => handleConnect(integration.name)}
                      disabled={connecting === integration.name}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {connecting === integration.name ? 'Connecting...' : 'Connect'}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleDisconnect(integration.name)}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                      Disconnect
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Back to Workflows */}
      <div className="mt-8">
        <Link
          href="/workflows"
          className="text-blue-600 hover:text-blue-700 font-medium"
        >
          ← Back to Workflows
        </Link>
      </div>
    </div>
  );
}
