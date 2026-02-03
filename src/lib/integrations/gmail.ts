/**
 * Gmail Integration Adapter
 * Handles Gmail OAuth and API operations
 */

import { google } from 'googleapis';
import { BaseIntegrationAdapter } from './base';
import type {
  IntegrationCredentials,
  ActionInput,
  ActionOutput,
  ActionDefinition,
} from './types';

export class GmailAdapter extends BaseIntegrationAdapter {
  private oauth2Client: ReturnType<typeof google.auth.OAuth2> | null = null;

  async connect(credentials: IntegrationCredentials): Promise<void> {
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    const redirectUri = process.env.GMAIL_REDIRECT_URI || `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/integrations/gmail/callback`;

    if (!clientId || !clientSecret) {
      throw new Error('Gmail OAuth credentials not configured');
    }

    this.oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

    // Set credentials
    this.oauth2Client.setCredentials({
      access_token: credentials.accessToken,
      refresh_token: credentials.refreshToken,
      expiry_date: credentials.expiryDate,
    });

    // Refresh token if expired
    if (credentials.expiryDate && credentials.expiryDate < Date.now()) {
      const { credentials: newCredentials } = await this.oauth2Client.refreshAccessToken();
      // Update stored credentials
      await this.updateCredentials({
        accessToken: newCredentials.access_token,
        refreshToken: newCredentials.refresh_token,
        expiryDate: newCredentials.expiry_date,
      });
    }

    this.credentials = credentials;
  }

  async disconnect(): Promise<void> {
    if (this.oauth2Client) {
      try {
        await this.oauth2Client.revokeCredentials();
      } catch (error) {
        console.error('Error revoking Gmail credentials:', error);
      }
    }
    this.oauth2Client = null;
    this.credentials = null;
  }

  async getActions(): Promise<ActionDefinition[]> {
    return [
      {
        name: 'send_email',
        description: 'Send an email via Gmail',
        inputSchema: {
          type: 'object',
          properties: {
            to: { type: 'string', description: 'Recipient email address' },
            subject: { type: 'string', description: 'Email subject' },
            body: { type: 'string', description: 'Email body (HTML or plain text)' },
            cc: { type: 'array', items: { type: 'string' }, description: 'CC recipients' },
            bcc: { type: 'array', items: { type: 'string' }, description: 'BCC recipients' },
          },
          required: ['to', 'subject', 'body'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            messageId: { type: 'string' },
            threadId: { type: 'string' },
          },
        },
        requiresAuth: true,
      },
      {
        name: 'read_emails',
        description: 'Read emails from inbox',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Gmail search query' },
            maxResults: { type: 'number', description: 'Maximum number of results', default: 10 },
          },
        },
        outputSchema: {
          type: 'object',
          properties: {
            emails: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  subject: { type: 'string' },
                  from: { type: 'string' },
                  snippet: { type: 'string' },
                  date: { type: 'string' },
                },
              },
            },
          },
        },
        requiresAuth: true,
      },
    ];
  }

  async executeAction(actionName: string, inputs: ActionInput): Promise<ActionOutput> {
    if (!this.oauth2Client) {
      throw new Error('Gmail adapter not connected');
    }

    const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

    switch (actionName) {
      case 'send_email':
        return await this.sendEmail(gmail, inputs);
      case 'read_emails':
        return await this.readEmails(gmail, inputs);
      default:
        throw new Error(`Unknown Gmail action: ${actionName}`);
    }
  }

  isConnected(): boolean {
    return this.oauth2Client !== null && this.credentials !== null;
  }

  private async sendEmail(gmail: ReturnType<typeof google.gmail>, inputs: ActionInput): Promise<ActionOutput> {
    const { to, subject, body, cc, bcc } = inputs as {
      to: string;
      subject: string;
      body: string;
      cc?: string[];
      bcc?: string[];
    };

    // Create email message
    const message = [
      `To: ${to}`,
      cc && cc.length > 0 ? `Cc: ${cc.join(', ')}` : '',
      bcc && bcc.length > 0 ? `Bcc: ${bcc.join(', ')}` : '',
      `Subject: ${subject}`,
      '',
      body,
    ]
      .filter(Boolean)
      .join('\n');

    // Encode message
    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Send email
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
      },
    });

    return {
      messageId: response.data.id || '',
      threadId: response.data.threadId || '',
    };
  }

  private async readEmails(gmail: ReturnType<typeof google.gmail>, inputs: ActionInput): Promise<ActionOutput> {
    const { query = '', maxResults = 10 } = inputs as {
      query?: string;
      maxResults?: number;
    };

    // List messages
    const listResponse = await gmail.users.messages.list({
      userId: 'me',
      q: query as string,
      maxResults: maxResults as number,
    });

    const messageIds = listResponse.data.messages?.map((m) => m.id!).slice(0, maxResults) || [];

    // Get message details
    const emails = await Promise.all(
      messageIds.map(async (id) => {
        const message = await gmail.users.messages.get({
          userId: 'me',
          id,
          format: 'metadata',
          metadataHeaders: ['Subject', 'From', 'Date'],
        });

        const headers = message.data.payload?.headers || [];
        const getHeader = (name: string) =>
          headers.find((h: { name?: string; value?: string }) => h.name === name)?.value || '';

        return {
          id: message.data.id,
          subject: getHeader('Subject'),
          from: getHeader('From'),
          date: getHeader('Date'),
          snippet: message.data.snippet || '',
        };
      })
    );

    return { emails };
  }
}
