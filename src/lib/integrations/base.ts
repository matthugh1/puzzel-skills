/**
 * Base Integration Adapter Interface
 * All app integrations must implement this interface
 */

import type {
  IntegrationCredentials,
  ActionInput,
  ActionOutput,
  ActionDefinition,
  IntegrationError,
} from './types';

export abstract class BaseIntegrationAdapter {
  protected credentials: IntegrationCredentials | null = null;

  /**
   * Connect to the integration service
   */
  abstract connect(credentials: IntegrationCredentials): Promise<void>;

  /**
   * Disconnect from the integration service
   */
  abstract disconnect(): Promise<void>;

  /**
   * Get available actions for this integration
   */
  abstract getActions(): Promise<ActionDefinition[]>;

  /**
   * Execute an action
   */
  abstract executeAction(actionName: string, inputs: ActionInput): Promise<ActionOutput>;

  /**
   * Update stored credentials (for token refresh)
   */
  async updateCredentials(credentials: IntegrationCredentials): Promise<void> {
    this.credentials = credentials;
  }

  /**
   * Get current credentials
   */
  getCredentials(): IntegrationCredentials | null {
    return this.credentials;
  }

  /**
   * Check if credentials are valid/not expired
   */
  abstract isConnected(): boolean;

  /**
   * Handle integration-specific errors
   */
  protected handleError(error: unknown): IntegrationError {
    if (error instanceof Error) {
      return {
        message: error.message,
        code: 'INTEGRATION_ERROR',
        retryable: false,
      };
    }
    return {
      message: 'Unknown integration error',
      code: 'UNKNOWN_ERROR',
      retryable: false,
    };
  }
}
