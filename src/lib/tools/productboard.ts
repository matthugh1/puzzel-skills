/**
 * Productboard Tool
 * Reusable tool for interacting with Productboard API
 * Supports multiple Productboard operations (features, components, notes)
 */

import type { Tool } from './types';
import { createProductboardClient, ProductboardError } from '@/lib/productboard';

/**
 * Helper to get Productboard token from args or environment
 */
function getProductboardToken(args: Record<string, unknown>): string {
  // First try to get from args (allows per-skill configuration)
  if (args.token && typeof args.token === 'string' && args.token.trim()) {
    return args.token.trim();
  }

  // Fall back to environment variable
  const envToken = process.env.PRODUCTBOARD_TOKEN;
  if (envToken) {
    return envToken;
  }

  throw new Error(
    'Productboard token is required. Provide it as a "token" parameter or set PRODUCTBOARD_TOKEN environment variable.'
  );
}

/**
 * Productboard Tool - List Features
 */
export const productboardListFeaturesTool: Tool = {
  id: 'productboard-list-features',
  name: 'Productboard: List Features',
  description: 'List all features from Productboard, optionally filtered by component, status, or parent',
  inputSchema: {
    type: 'object',
    properties: {
      token: {
        type: 'string',
        description: 'Productboard API token (optional if PRODUCTBOARD_TOKEN env var is set)',
        required: false,
      },
      componentId: {
        type: 'string',
        description: 'Filter features by component ID (optional)',
        required: false,
      },
      statusId: {
        type: 'string',
        description: 'Filter features by status ID (optional)',
        required: false,
      },
      parentId: {
        type: 'string',
        description: 'Filter features by parent feature ID (optional)',
        required: false,
      },
    },
    required: [],
  },
  executor: async (args, context) => {
    try {
      const token = getProductboardToken(args);
      const client = createProductboardClient({ token });

      const features = await client.listFeatures({
        componentId: typeof args.componentId === 'string' ? args.componentId : undefined,
        statusId: typeof args.statusId === 'string' ? args.statusId : undefined,
        parentId: typeof args.parentId === 'string' ? args.parentId : undefined,
      });

      return {
        success: true,
        output: JSON.stringify(features, null, 2),
        metadata: {
          count: features.length,
          hasFilters: !!(args.componentId || args.statusId || args.parentId),
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof ProductboardError
          ? `Productboard API error (${error.statusCode}): ${error.message}`
          : error instanceof Error
            ? error.message
            : 'Unknown error occurred';

      return {
        success: false,
        output: '',
        error: errorMessage,
      };
    }
  },
};

/**
 * Productboard Tool - Get Feature
 */
export const productboardGetFeatureTool: Tool = {
  id: 'productboard-get-feature',
  name: 'Productboard: Get Feature',
  description: 'Get a single feature by ID from Productboard',
  inputSchema: {
    type: 'object',
    properties: {
      token: {
        type: 'string',
        description: 'Productboard API token (optional if PRODUCTBOARD_TOKEN env var is set)',
        required: false,
      },
      featureId: {
        type: 'string',
        description: 'Feature ID to retrieve',
        required: true,
      },
    },
    required: ['featureId'],
  },
  executor: async (args, context) => {
    try {
      const token = getProductboardToken(args);
      const client = createProductboardClient({ token });

      if (!args.featureId || typeof args.featureId !== 'string') {
        return {
          success: false,
          output: '',
          error: 'featureId is required and must be a string',
        };
      }

      const feature = await client.getFeature(args.featureId);

      return {
        success: true,
        output: JSON.stringify(feature, null, 2),
        metadata: {
          featureId: feature.id,
          featureName: feature.name,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof ProductboardError
          ? `Productboard API error (${error.statusCode}): ${error.message}`
          : error instanceof Error
            ? error.message
            : 'Unknown error occurred';

      return {
        success: false,
        output: '',
        error: errorMessage,
      };
    }
  },
};

/**
 * Productboard Tool - Create Feature
 */
export const productboardCreateFeatureTool: Tool = {
  id: 'productboard-create-feature',
  name: 'Productboard: Create Feature',
  description: 'Create a new feature in Productboard',
  inputSchema: {
    type: 'object',
    properties: {
      token: {
        type: 'string',
        description: 'Productboard API token (optional if PRODUCTBOARD_TOKEN env var is set)',
        required: false,
      },
      name: {
        type: 'string',
        description: 'Feature name',
        required: true,
      },
      description: {
        type: 'string',
        description: 'Feature description (optional)',
        required: false,
      },
      componentId: {
        type: 'string',
        description: 'Component ID to assign feature to (optional)',
        required: false,
      },
      statusId: {
        type: 'string',
        description: 'Status ID to assign to feature (optional)',
        required: false,
      },
      parentId: {
        type: 'string',
        description: 'Parent feature ID if this is a subfeature (optional)',
        required: false,
      },
    },
    required: ['name'],
  },
  executor: async (args, context) => {
    try {
      const token = getProductboardToken(args);
      const client = createProductboardClient({ token });

      if (!args.name || typeof args.name !== 'string') {
        return {
          success: false,
          output: '',
          error: 'name is required and must be a string',
        };
      }

      const feature = await client.createFeature({
        name: args.name,
        description: typeof args.description === 'string' ? args.description : undefined,
        componentId: typeof args.componentId === 'string' ? args.componentId : undefined,
        statusId: typeof args.statusId === 'string' ? args.statusId : undefined,
        parentId: typeof args.parentId === 'string' ? args.parentId : undefined,
      });

      return {
        success: true,
        output: JSON.stringify(feature, null, 2),
        metadata: {
          featureId: feature.id,
          featureName: feature.name,
          created: true,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof ProductboardError
          ? `Productboard API error (${error.statusCode}): ${error.message}`
          : error instanceof Error
            ? error.message
            : 'Unknown error occurred';

      return {
        success: false,
        output: '',
        error: errorMessage,
      };
    }
  },
};

/**
 * Productboard Tool - List Components
 */
export const productboardListComponentsTool: Tool = {
  id: 'productboard-list-components',
  name: 'Productboard: List Components',
  description: 'List all components from Productboard',
  inputSchema: {
    type: 'object',
    properties: {
      token: {
        type: 'string',
        description: 'Productboard API token (optional if PRODUCTBOARD_TOKEN env var is set)',
        required: false,
      },
    },
    required: [],
  },
  executor: async (args, context) => {
    try {
      const token = getProductboardToken(args);
      const client = createProductboardClient({ token });

      const components = await client.listComponents();

      return {
        success: true,
        output: JSON.stringify(components, null, 2),
        metadata: {
          count: components.length,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof ProductboardError
          ? `Productboard API error (${error.statusCode}): ${error.message}`
          : error instanceof Error
            ? error.message
            : 'Unknown error occurred';

      return {
        success: false,
        output: '',
        error: errorMessage,
      };
    }
  },
};
