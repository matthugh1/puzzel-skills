/**
 * Slack Integration Adapter
 * Handles Slack OAuth and API operations
 */

import { WebClient } from '@slack/web-api';
import { BaseIntegrationAdapter } from './base';
import type {
  IntegrationCredentials,
  ActionInput,
  ActionOutput,
  ActionDefinition,
} from './types';

export class SlackAdapter extends BaseIntegrationAdapter {
  private client: WebClient | null = null;

  async connect(credentials: IntegrationCredentials): Promise<void> {
    const botToken = credentials.botToken as string | undefined;
    const accessToken = credentials.accessToken as string | undefined;

    if (!botToken && !accessToken) {
      throw new Error('Slack token not provided');
    }

    // Use bot token if available, otherwise use access token
    this.client = new WebClient(botToken || accessToken);
    this.credentials = credentials;

    // Test connection
    try {
      await this.client.auth.test();
    } catch (error) {
      throw new Error(`Failed to connect to Slack: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async disconnect(): Promise<void> {
    this.client = null;
    this.credentials = null;
  }

  async getActions(): Promise<ActionDefinition[]> {
    return [
      {
        name: 'send_message',
        description: 'Send a message to a Slack channel',
        inputSchema: {
          type: 'object',
          properties: {
            channel: { type: 'string', description: 'Channel ID or name (e.g., #general)' },
            text: { type: 'string', description: 'Message text' },
            blocks: { type: 'array', description: 'Slack Block Kit blocks (optional)' },
          },
          required: ['channel', 'text'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            ts: { type: 'string', description: 'Message timestamp' },
            channel: { type: 'string', description: 'Channel ID' },
            message: { type: 'object', description: 'Message object' },
          },
        },
        requiresAuth: true,
      },
      {
        name: 'create_channel',
        description: 'Create a new Slack channel',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Channel name' },
            isPrivate: { type: 'boolean', description: 'Whether channel is private', default: false },
          },
          required: ['name'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            channel: { type: 'object', description: 'Created channel object' },
          },
        },
        requiresAuth: true,
      },
      {
        name: 'list_channels',
        description: 'List all Slack channels',
        inputSchema: {
          type: 'object',
          properties: {
            types: { type: 'string', description: 'Comma-separated list of channel types', default: 'public_channel,private_channel' },
          },
        },
        outputSchema: {
          type: 'object',
          properties: {
            channels: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  isPrivate: { type: 'boolean' },
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
    if (!this.client) {
      throw new Error('Slack adapter not connected');
    }

    switch (actionName) {
      case 'send_message':
        return await this.sendMessage(inputs);
      case 'create_channel':
        return await this.createChannel(inputs);
      case 'list_channels':
        return await this.listChannels(inputs);
      default:
        throw new Error(`Unknown Slack action: ${actionName}`);
    }
  }

  isConnected(): boolean {
    return this.client !== null && this.credentials !== null;
  }

  private async sendMessage(inputs: ActionInput): Promise<ActionOutput> {
    const { channel, text, blocks } = inputs as {
      channel: string;
      text: string;
      blocks?: unknown[];
    };

    const response = await this.client!.chat.postMessage({
      channel,
      text,
      blocks: blocks as unknown[] | undefined,
    });

    return {
      ts: response.ts || '',
      channel: response.channel || '',
      message: response.message || {},
    };
  }

  private async createChannel(inputs: ActionInput): Promise<ActionOutput> {
    const { name, isPrivate } = inputs as {
      name: string;
      isPrivate?: boolean;
    };

    const response = await this.client!.conversations.create({
      name,
      is_private: isPrivate || false,
    });

    return {
      channel: response.channel || {},
    };
  }

  private async listChannels(inputs: ActionInput): Promise<ActionOutput> {
    const { types } = inputs as {
      types?: string;
    };

    const response = await this.client!.conversations.list({
      types: types || 'public_channel,private_channel',
    });

    return {
      channels:
        response.channels?.map((ch) => ({
          id: ch.id || '',
          name: ch.name || '',
          isPrivate: ch.is_private || false,
        })) || [],
    };
  }
}
