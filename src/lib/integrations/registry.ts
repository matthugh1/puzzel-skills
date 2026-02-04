/**
 * Integration Registry
 * Manages available integration adapters
 */

import { GmailAdapter } from './gmail';
import { SlackAdapter } from './slack';
import { Office365Adapter } from './office365';
import { BaseIntegrationAdapter } from './base';

export type IntegrationName = 'gmail' | 'slack' | 'office365';

/**
 * Create integration adapter instance
 */
export function createIntegrationAdapter(appName: IntegrationName): BaseIntegrationAdapter {
  switch (appName) {
    case 'gmail':
      return new GmailAdapter();
    case 'slack':
      return new SlackAdapter();
    case 'office365':
      return new Office365Adapter();
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
    {
      name: 'office365',
      displayName: 'Office 365',
      description: 'Send emails, manage calendar, and access Microsoft Graph via Office 365',
    },
  ];
}
