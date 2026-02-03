/**
 * Integration Registry
 * Manages available integration adapters
 */

import { GmailAdapter } from './gmail';
import { SlackAdapter } from './slack';
import { BaseIntegrationAdapter } from './base';

export type IntegrationName = 'gmail' | 'slack';

/**
 * Create integration adapter instance
 */
export function createIntegrationAdapter(appName: IntegrationName): BaseIntegrationAdapter {
  switch (appName) {
    case 'gmail':
      return new GmailAdapter();
    case 'slack':
      return new SlackAdapter();
    default:
      throw new Error(`Unknown integration: ${appName}`);
  }
}

/**
 * Get list of available integrations
 */
export function getAvailableIntegrations(): Array<{
  name: IntegrationName;
  displayName: string;
  description: string;
  icon?: string;
}> {
  return [
    {
      name: 'gmail',
      displayName: 'Gmail',
      description: 'Send and read emails via Gmail',
    },
    {
      name: 'slack',
      displayName: 'Slack',
      description: 'Send messages and manage channels in Slack',
    },
  ];
}
