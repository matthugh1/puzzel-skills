/**
 * Office 365 Integration Adapter
 * Handles Office 365 OAuth and Microsoft Graph API operations
 */

import { BaseIntegrationAdapter } from './base';
import type {
  IntegrationCredentials,
  ActionInput,
  ActionOutput,
  ActionDefinition,
} from './types';

interface MicrosoftTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

export class Office365Adapter extends BaseIntegrationAdapter {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiry: number | null = null;
  private tenantId: string | null = null;

  async connect(credentials: IntegrationCredentials): Promise<void> {
    const clientId = process.env.OFFICE365_CLIENT_ID;
    const clientSecret = process.env.OFFICE365_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('Office 365 OAuth credentials not configured');
    }

    // Use tenant ID from credentials if available (supports personal accounts),
    // otherwise fall back to environment variable or 'common'
    this.tenantId = (credentials.tenantId as string | undefined) || 
                     process.env.OFFICE365_TENANT_ID || 
                     'common';
    this.accessToken = credentials.accessToken as string | undefined || null;
    this.refreshToken = credentials.refreshToken as string | undefined || null;
    this.tokenExpiry = credentials.expiryDate as number | undefined || null;

    // Refresh token if expired or missing
    if (!this.accessToken || (this.tokenExpiry && this.tokenExpiry < Date.now())) {
      if (!this.refreshToken) {
        throw new Error('Office 365 access token expired and no refresh token available');
      }
      await this.refreshAccessToken();
    }

    // Test connection by getting user profile
    try {
      await this.makeGraphRequest('/me');
    } catch (error) {
      throw new Error(`Failed to connect to Office 365: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    this.credentials = credentials;
  }

  async disconnect(): Promise<void> {
    // Revoke token if possible
    if (this.accessToken && this.tenantId) {
      try {
        await fetch(`https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        });
      } catch (error) {
        console.error('Error revoking Office 365 credentials:', error);
      }
    }
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
    this.tenantId = null;
    this.credentials = null;
  }

  async getActions(): Promise<ActionDefinition[]> {
    return [
      {
        name: 'send_email',
        description: 'Send an email via Outlook',
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
            id: { type: 'string' },
            createdDateTime: { type: 'string' },
          },
        },
        requiresAuth: true,
      },
      {
        name: 'read_emails',
        description: 'Read emails from inbox or specific folder',
        inputSchema: {
          type: 'object',
          properties: {
            filter: { type: 'string', description: 'OData filter query' },
            top: { type: 'number', description: 'Maximum number of results', default: 10 },
            orderBy: { type: 'string', description: 'Order by field', default: 'receivedDateTime desc' },
            folderId: { type: 'string', description: 'Folder ID to read from (defaults to inbox)' },
            includeBody: { type: 'boolean', description: 'Include full email body', default: false },
            hasAttachments: { type: 'boolean', description: 'Filter emails with attachments' },
            from: { type: 'string', description: 'Filter by sender email address' },
            subjectContains: { type: 'string', description: 'Filter by subject contains text' },
            dateRange: {
              type: 'object',
              description: 'Filter by date range',
              properties: {
                start: { type: 'string', description: 'Start date (ISO 8601)' },
                end: { type: 'string', description: 'End date (ISO 8601)' },
              },
            },
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
                  from: { type: 'object' },
                  receivedDateTime: { type: 'string' },
                  bodyPreview: { type: 'string' },
                  body: { type: 'object' },
                  hasAttachments: { type: 'boolean' },
                },
              },
            },
          },
        },
        requiresAuth: true,
      },
      {
        name: 'get_email',
        description: 'Get a specific email by ID with full content',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Email ID' },
          },
          required: ['id'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            subject: { type: 'string' },
            from: { type: 'object' },
            toRecipients: { type: 'array' },
            ccRecipients: { type: 'array' },
            bccRecipients: { type: 'array' },
            receivedDateTime: { type: 'string' },
            bodyPreview: { type: 'string' },
            body: { type: 'object' },
            hasAttachments: { type: 'boolean' },
            importance: { type: 'string' },
            isRead: { type: 'boolean' },
          },
        },
        requiresAuth: true,
      },
      {
        name: 'list_email_folders',
        description: 'List all email folders',
        inputSchema: {
          type: 'object',
          properties: {},
        },
        outputSchema: {
          type: 'object',
          properties: {
            folders: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  displayName: { type: 'string' },
                  parentFolderId: { type: 'string' },
                  childFolderCount: { type: 'number' },
                  unreadItemCount: { type: 'number' },
                  totalItemCount: { type: 'number' },
                },
              },
            },
          },
        },
        requiresAuth: true,
      },
      {
        name: 'read_emails_from_folder',
        description: 'Read emails from a specific folder',
        inputSchema: {
          type: 'object',
          properties: {
            folderId: { type: 'string', description: 'Folder ID' },
            top: { type: 'number', description: 'Maximum number of results', default: 10 },
            orderBy: { type: 'string', description: 'Order by field', default: 'receivedDateTime desc' },
            includeBody: { type: 'boolean', description: 'Include full email body', default: false },
            filter: { type: 'string', description: 'OData filter query' },
          },
          required: ['folderId'],
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
                  from: { type: 'object' },
                  receivedDateTime: { type: 'string' },
                  bodyPreview: { type: 'string' },
                  body: { type: 'object' },
                },
              },
            },
          },
        },
        requiresAuth: true,
      },
      {
        name: 'search_emails',
        description: 'Search emails using Microsoft Graph search',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            top: { type: 'number', description: 'Maximum number of results', default: 10 },
            includeBody: { type: 'boolean', description: 'Include full email body', default: false },
          },
          required: ['query'],
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
                  from: { type: 'object' },
                  receivedDateTime: { type: 'string' },
                  bodyPreview: { type: 'string' },
                  body: { type: 'object' },
                  hasAttachments: { type: 'boolean' },
                },
              },
            },
          },
        },
        requiresAuth: true,
      },
      {
        name: 'get_email_attachments',
        description: 'Get attachments for a specific email',
        inputSchema: {
          type: 'object',
          properties: {
            emailId: { type: 'string', description: 'Email ID' },
          },
          required: ['emailId'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            attachments: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  contentType: { type: 'string' },
                  size: { type: 'number' },
                  isInline: { type: 'boolean' },
                  contentId: { type: 'string' },
                  contentBytes: { type: 'string' },
                },
              },
            },
          },
        },
        requiresAuth: true,
      },
      {
        name: 'get_calendar_events',
        description: 'Get calendar events',
        inputSchema: {
          type: 'object',
          properties: {
            startDateTime: { type: 'string', description: 'Start date/time (ISO 8601)' },
            endDateTime: { type: 'string', description: 'End date/time (ISO 8601)' },
            filter: { type: 'string', description: 'OData filter query' },
            calendarId: { type: 'string', description: 'Calendar ID (defaults to primary calendar)' },
            includeDetails: { type: 'boolean', description: 'Include full event details', default: false },
            includeCancelled: { type: 'boolean', description: 'Include cancelled events', default: false },
            attendees: { type: 'array', items: { type: 'string' }, description: 'Filter by attendee email addresses' },
            location: { type: 'string', description: 'Filter by location contains text' },
            categories: { type: 'array', items: { type: 'string' }, description: 'Filter by categories' },
          },
        },
        outputSchema: {
          type: 'object',
          properties: {
            events: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  subject: { type: 'string' },
                  start: { type: 'object' },
                  end: { type: 'object' },
                  location: { type: 'object' },
                  body: { type: 'object' },
                  attendees: { type: 'array' },
                  categories: { type: 'array' },
                  isCancelled: { type: 'boolean' },
                  organizer: { type: 'object' },
                  recurrence: { type: 'object' },
                  webLink: { type: 'string' },
                },
              },
            },
          },
        },
        requiresAuth: true,
      },
      {
        name: 'list_calendars',
        description: 'List all calendars',
        inputSchema: {
          type: 'object',
          properties: {},
        },
        outputSchema: {
          type: 'object',
          properties: {
            calendars: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  color: { type: 'string' },
                  canEdit: { type: 'boolean' },
                  canShare: { type: 'boolean' },
                  canViewPrivateItems: { type: 'boolean' },
                  owner: { type: 'object' },
                },
              },
            },
          },
        },
        requiresAuth: true,
      },
      {
        name: 'get_calendar_event',
        description: 'Get a specific calendar event with full details',
        inputSchema: {
          type: 'object',
          properties: {
            eventId: { type: 'string', description: 'Event ID' },
          },
          required: ['eventId'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            subject: { type: 'string' },
            start: { type: 'object' },
            end: { type: 'object' },
            location: { type: 'object' },
            body: { type: 'object' },
            attendees: { type: 'array' },
            categories: { type: 'array' },
            isCancelled: { type: 'boolean' },
            organizer: { type: 'object' },
            recurrence: { type: 'object' },
            webLink: { type: 'string' },
            importance: { type: 'string' },
            sensitivity: { type: 'string' },
          },
        },
        requiresAuth: true,
      },
      {
        name: 'update_calendar_event',
        description: 'Update an existing calendar event',
        inputSchema: {
          type: 'object',
          properties: {
            eventId: { type: 'string', description: 'Event ID' },
            subject: { type: 'string', description: 'Event subject' },
            start: { type: 'object', description: 'Start date/time' },
            end: { type: 'object', description: 'End date/time' },
            body: { type: 'string', description: 'Event body' },
            location: { type: 'object', description: 'Event location' },
            attendees: { type: 'array', items: { type: 'object' }, description: 'Attendees' },
            categories: { type: 'array', items: { type: 'string' }, description: 'Categories' },
          },
          required: ['eventId'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            updatedDateTime: { type: 'string' },
          },
        },
        requiresAuth: true,
      },
      {
        name: 'delete_calendar_event',
        description: 'Delete a calendar event',
        inputSchema: {
          type: 'object',
          properties: {
            eventId: { type: 'string', description: 'Event ID' },
          },
          required: ['eventId'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            deletedEventId: { type: 'string' },
          },
        },
        requiresAuth: true,
      },
      {
        name: 'get_free_busy',
        description: 'Get free/busy status for time ranges',
        inputSchema: {
          type: 'object',
          properties: {
            startTime: { type: 'string', description: 'Start time (ISO 8601)' },
            endTime: { type: 'string', description: 'End time (ISO 8601)' },
            schedules: { type: 'array', items: { type: 'string' }, description: 'Email addresses to check (defaults to current user)' },
            availabilityViewInterval: { type: 'number', description: 'Interval in minutes', default: 15 },
          },
          required: ['startTime', 'endTime'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            schedules: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  scheduleId: { type: 'string' },
                  scheduleItems: { type: 'array' },
                  workingHours: { type: 'object' },
                },
              },
            },
          },
        },
        requiresAuth: true,
      },
      {
        name: 'find_meeting_times',
        description: 'Find available meeting times',
        inputSchema: {
          type: 'object',
          properties: {
            attendees: { type: 'array', items: { type: 'object' }, description: 'Attendees' },
            meetingDuration: { type: 'string', description: 'Meeting duration (e.g., PT30M)' },
            timeConstraint: {
              type: 'object',
              description: 'Time constraints',
              properties: {
                timeslots: { type: 'array', items: { type: 'object' } },
                activityDomain: { type: 'string' },
              },
            },
            isOrganizerOptional: { type: 'boolean', description: 'Organizer optional', default: false },
            returnSuggestionReasons: { type: 'boolean', description: 'Return suggestion reasons', default: false },
          },
        },
        outputSchema: {
          type: 'object',
          properties: {
            emptySuggestionsReason: { type: 'string' },
            meetingTimeSuggestions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  confidence: { type: 'number' },
                  organizerAvailability: { type: 'string' },
                  suggestionReason: { type: 'string' },
                  meetingTimeSlot: { type: 'object' },
                  attendeeAvailability: { type: 'array' },
                },
              },
            },
          },
        },
        requiresAuth: true,
      },
      {
        name: 'get_calendar_view',
        description: 'Get calendar view for a date range',
        inputSchema: {
          type: 'object',
          properties: {
            startDate: { type: 'string', description: 'Start date (ISO 8601)' },
            endDate: { type: 'string', description: 'End date (ISO 8601)' },
            calendarId: { type: 'string', description: 'Calendar ID (defaults to primary calendar)' },
          },
          required: ['startDate', 'endDate'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            events: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  subject: { type: 'string' },
                  start: { type: 'object' },
                  end: { type: 'object' },
                  location: { type: 'object' },
                  isAllDay: { type: 'boolean' },
                  showAs: { type: 'string' },
                },
              },
            },
          },
        },
        requiresAuth: true,
      },
      {
        name: 'create_calendar_event',
        description: 'Create a calendar event',
        inputSchema: {
          type: 'object',
          properties: {
            subject: { type: 'string', description: 'Event subject' },
            start: { 
              type: 'object', 
              description: 'Start date/time object with dateTime (ISO 8601 string) and timeZone (e.g., "UTC", "America/New_York")',
              properties: {
                dateTime: { type: 'string', description: 'ISO 8601 date/time string (e.g., "2026-02-05T14:00:00")' },
                timeZone: { type: 'string', description: 'Time zone (e.g., "UTC", "America/New_York", "Europe/London")' },
              },
              required: ['dateTime', 'timeZone'],
            },
            end: { 
              type: 'object', 
              description: 'End date/time object with dateTime (ISO 8601 string) and timeZone (e.g., "UTC", "America/New_York")',
              properties: {
                dateTime: { type: 'string', description: 'ISO 8601 date/time string (e.g., "2026-02-05T15:00:00")' },
                timeZone: { type: 'string', description: 'Time zone (e.g., "UTC", "America/New_York", "Europe/London")' },
              },
              required: ['dateTime', 'timeZone'],
            },
            body: { type: 'string', description: 'Event body (HTML or plain text)' },
            attendees: { 
              type: 'array', 
              items: { 
                type: 'object',
                properties: {
                  emailAddress: {
                    type: 'object',
                    properties: {
                      address: { type: 'string', description: 'Email address' },
                    },
                    required: ['address'],
                  },
                },
                required: ['emailAddress'],
              }, 
              description: 'Array of attendees with emailAddress.address' 
            },
            location: { 
              type: 'object', 
              properties: {
                displayName: { type: 'string', description: 'Location name' },
              },
              description: 'Event location with displayName' 
            },
          },
          required: ['subject', 'start', 'end'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            createdDateTime: { type: 'string' },
          },
        },
        requiresAuth: true,
      },
      {
        name: 'get_user_profile',
        description: 'Get current user profile',
        inputSchema: {
          type: 'object',
          properties: {},
        },
        outputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            displayName: { type: 'string' },
            mail: { type: 'string' },
            userPrincipalName: { type: 'string' },
          },
        },
        requiresAuth: true,
      },
      // Microsoft To Do Actions
      {
        name: 'list_todo_lists',
        description: 'List all To Do task lists',
        inputSchema: {
          type: 'object',
          properties: {},
        },
        outputSchema: {
          type: 'object',
          properties: {
            lists: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  displayName: { type: 'string' },
                  isOwner: { type: 'boolean' },
                  isShared: { type: 'boolean' },
                  wellknownListName: { type: 'string' },
                },
              },
            },
          },
        },
        requiresAuth: true,
      },
      {
        name: 'get_todo_list',
        description: 'Get a specific To Do task list',
        inputSchema: {
          type: 'object',
          properties: {
            listId: { type: 'string', description: 'Task list ID' },
          },
          required: ['listId'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            displayName: { type: 'string' },
            isOwner: { type: 'boolean' },
            isShared: { type: 'boolean' },
            wellknownListName: { type: 'string' },
          },
        },
        requiresAuth: true,
      },
      {
        name: 'create_todo_list',
        description: 'Create a new To Do task list',
        inputSchema: {
          type: 'object',
          properties: {
            displayName: { type: 'string', description: 'List name' },
          },
          required: ['displayName'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            displayName: { type: 'string' },
          },
        },
        requiresAuth: true,
      },
      {
        name: 'update_todo_list',
        description: 'Update a To Do task list',
        inputSchema: {
          type: 'object',
          properties: {
            listId: { type: 'string', description: 'Task list ID' },
            displayName: { type: 'string', description: 'New list name' },
          },
          required: ['listId'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            displayName: { type: 'string' },
          },
        },
        requiresAuth: true,
      },
      {
        name: 'delete_todo_list',
        description: 'Delete a To Do task list',
        inputSchema: {
          type: 'object',
          properties: {
            listId: { type: 'string', description: 'Task list ID' },
          },
          required: ['listId'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            deletedListId: { type: 'string' },
          },
        },
        requiresAuth: true,
      },
      {
        name: 'list_todo_tasks',
        description: 'List tasks in a To Do list',
        inputSchema: {
          type: 'object',
          properties: {
            listId: { type: 'string', description: 'Task list ID' },
            top: { type: 'number', description: 'Maximum number of results', default: 100 },
            filter: { type: 'string', description: 'OData filter query' },
            orderBy: { type: 'string', description: 'Order by field', default: 'createdDateTime desc' },
          },
          required: ['listId'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            tasks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  title: { type: 'string' },
                  status: { type: 'string' },
                  importance: { type: 'string' },
                  createdDateTime: { type: 'string' },
                  lastModifiedDateTime: { type: 'string' },
                  dueDateTime: { type: 'object' },
                  reminderDateTime: { type: 'object' },
                  body: { type: 'object' },
                  categories: { type: 'array' },
                  checklistItems: { type: 'array' },
                },
              },
            },
          },
        },
        requiresAuth: true,
      },
      {
        name: 'get_todo_task',
        description: 'Get a specific To Do task',
        inputSchema: {
          type: 'object',
          properties: {
            listId: { type: 'string', description: 'Task list ID' },
            taskId: { type: 'string', description: 'Task ID' },
          },
          required: ['listId', 'taskId'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            status: { type: 'string' },
            importance: { type: 'string' },
            createdDateTime: { type: 'string' },
            lastModifiedDateTime: { type: 'string' },
            dueDateTime: { type: 'object' },
            reminderDateTime: { type: 'object' },
            body: { type: 'object' },
            categories: { type: 'array' },
            checklistItems: { type: 'array' },
          },
        },
        requiresAuth: true,
      },
      {
        name: 'create_todo_task',
        description: 'Create a new To Do task',
        inputSchema: {
          type: 'object',
          properties: {
            listId: { type: 'string', description: 'Task list ID' },
            title: { type: 'string', description: 'Task title' },
            body: { type: 'string', description: 'Task notes' },
            dueDateTime: { type: 'object', description: 'Due date/time' },
            reminderDateTime: { type: 'object', description: 'Reminder date/time' },
            importance: { type: 'string', enum: ['low', 'normal', 'high'], description: 'Task importance', default: 'normal' },
            categories: { type: 'array', items: { type: 'string' }, description: 'Task categories/tags' },
            checklistItems: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  displayName: { type: 'string' },
                  isChecked: { type: 'boolean' },
                },
              },
              description: 'Checklist items (subtasks)',
            },
          },
          required: ['listId', 'title'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            createdDateTime: { type: 'string' },
          },
        },
        requiresAuth: true,
      },
      {
        name: 'update_todo_task',
        description: 'Update an existing To Do task',
        inputSchema: {
          type: 'object',
          properties: {
            listId: { type: 'string', description: 'Task list ID' },
            taskId: { type: 'string', description: 'Task ID' },
            title: { type: 'string', description: 'Task title' },
            body: { type: 'string', description: 'Task notes' },
            status: { type: 'string', enum: ['notStarted', 'inProgress', 'completed', 'waitingOnOthers', 'deferred'], description: 'Task status' },
            dueDateTime: { type: 'object', description: 'Due date/time' },
            reminderDateTime: { type: 'object', description: 'Reminder date/time' },
            importance: { type: 'string', enum: ['low', 'normal', 'high'], description: 'Task importance' },
            categories: { type: 'array', items: { type: 'string' }, description: 'Task categories/tags' },
            checklistItems: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  displayName: { type: 'string' },
                  isChecked: { type: 'boolean' },
                },
              },
              description: 'Checklist items (subtasks)',
            },
          },
          required: ['listId', 'taskId'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            lastModifiedDateTime: { type: 'string' },
          },
        },
        requiresAuth: true,
      },
      {
        name: 'delete_todo_task',
        description: 'Delete a To Do task',
        inputSchema: {
          type: 'object',
          properties: {
            listId: { type: 'string', description: 'Task list ID' },
            taskId: { type: 'string', description: 'Task ID' },
          },
          required: ['listId', 'taskId'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            deletedTaskId: { type: 'string' },
          },
        },
        requiresAuth: true,
      },
      {
        name: 'complete_todo_task',
        description: 'Mark a To Do task as completed',
        inputSchema: {
          type: 'object',
          properties: {
            listId: { type: 'string', description: 'Task list ID' },
            taskId: { type: 'string', description: 'Task ID' },
          },
          required: ['listId', 'taskId'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            status: { type: 'string' },
            lastModifiedDateTime: { type: 'string' },
          },
        },
        requiresAuth: true,
      },
      // Microsoft Teams Actions
      {
        name: 'list_teams',
        description: 'List all Microsoft Teams the user is a member of',
        inputSchema: {
          type: 'object',
          properties: {},
        },
        outputSchema: {
          type: 'object',
          properties: {
            teams: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  displayName: { type: 'string' },
                  description: { type: 'string' },
                  visibility: { type: 'string' },
                },
              },
            },
          },
        },
        requiresAuth: true,
      },
      {
        name: 'list_channels',
        description: 'List channels in a Microsoft Team',
        inputSchema: {
          type: 'object',
          properties: {
            teamId: { type: 'string', description: 'Team ID' },
          },
          required: ['teamId'],
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
                  displayName: { type: 'string' },
                  description: { type: 'string' },
                  isFavoriteByDefault: { type: 'boolean' },
                  email: { type: 'string' },
                },
              },
            },
          },
        },
        requiresAuth: true,
      },
      {
        name: 'send_channel_message',
        description: 'Send a message to a Teams channel',
        inputSchema: {
          type: 'object',
          properties: {
            teamId: { type: 'string', description: 'Team ID' },
            channelId: { type: 'string', description: 'Channel ID' },
            content: { type: 'string', description: 'Message content' },
          },
          required: ['teamId', 'channelId', 'content'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            createdDateTime: { type: 'string' },
            messageType: { type: 'string' },
          },
        },
        requiresAuth: true,
      },
      {
        name: 'read_channel_messages',
        description: 'Read messages from a Teams channel',
        inputSchema: {
          type: 'object',
          properties: {
            teamId: { type: 'string', description: 'Team ID' },
            channelId: { type: 'string', description: 'Channel ID' },
            top: { type: 'number', description: 'Maximum number of messages', default: 20 },
          },
          required: ['teamId', 'channelId'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            messages: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  createdDateTime: { type: 'string' },
                  body: { type: 'object' },
                  from: { type: 'object' },
                  messageType: { type: 'string' },
                },
              },
            },
          },
        },
        requiresAuth: true,
      },
      {
        name: 'list_chats',
        description: 'List all chats (1-on-1 and group chats)',
        inputSchema: {
          type: 'object',
          properties: {},
        },
        outputSchema: {
          type: 'object',
          properties: {
            chats: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  topic: { type: 'string' },
                  chatType: { type: 'string' },
                  createdDateTime: { type: 'string' },
                },
              },
            },
          },
        },
        requiresAuth: true,
      },
      {
        name: 'send_chat_message',
        description: 'Send a message to a Teams chat',
        inputSchema: {
          type: 'object',
          properties: {
            chatId: { type: 'string', description: 'Chat ID' },
            content: { type: 'string', description: 'Message content' },
          },
          required: ['chatId', 'content'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            createdDateTime: { type: 'string' },
            messageType: { type: 'string' },
          },
        },
        requiresAuth: true,
      },
      {
        name: 'read_chat_messages',
        description: 'Read messages from a Teams chat',
        inputSchema: {
          type: 'object',
          properties: {
            chatId: { type: 'string', description: 'Chat ID' },
            top: { type: 'number', description: 'Maximum number of messages', default: 20 },
          },
          required: ['chatId'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            messages: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  createdDateTime: { type: 'string' },
                  body: { type: 'object' },
                  from: { type: 'object' },
                  messageType: { type: 'string' },
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
    if (!this.accessToken) {
      throw new Error('Office 365 adapter not connected');
    }

    // Ensure token is fresh
    if (this.tokenExpiry && this.tokenExpiry < Date.now()) {
      if (!this.refreshToken) {
        throw new Error('Access token expired and no refresh token available');
      }
      await this.refreshAccessToken();
    }

    switch (actionName) {
      case 'send_email':
        return await this.sendEmail(inputs);
      case 'read_emails':
        return await this.readEmails(inputs);
      case 'get_email':
        return await this.getEmail(inputs.id as string);
      case 'list_email_folders':
        return await this.listEmailFolders();
      case 'read_emails_from_folder':
        return await this.readEmailsFromFolder(inputs);
      case 'search_emails':
        return await this.searchEmails(inputs);
      case 'get_email_attachments':
        return await this.getEmailAttachments(inputs.emailId as string);
      case 'get_calendar_events':
        return await this.getCalendarEvents(inputs);
      case 'list_calendars':
        return await this.listCalendars();
      case 'get_calendar_event':
        return await this.getCalendarEvent(inputs.eventId as string);
      case 'update_calendar_event':
        return await this.updateCalendarEvent(inputs);
      case 'delete_calendar_event':
        return await this.deleteCalendarEvent(inputs.eventId as string);
      case 'get_free_busy':
        return await this.getFreeBusy(inputs);
      case 'find_meeting_times':
        return await this.findMeetingTimes(inputs);
      case 'get_calendar_view':
        return await this.getCalendarView(inputs);
      case 'create_calendar_event':
        return await this.createCalendarEvent(inputs);
      case 'get_user_profile':
        return await this.getUserProfile();
      // To Do List actions
      case 'list_todo_lists':
        return await this.listTodoLists();
      case 'get_todo_list':
        return await this.getTodoList(inputs.listId as string);
      case 'create_todo_list':
        return await this.createTodoList(inputs);
      case 'update_todo_list':
        return await this.updateTodoList(inputs);
      case 'delete_todo_list':
        return await this.deleteTodoList(inputs.listId as string);
      // To Do Task actions
      case 'list_todo_tasks':
        return await this.listTodoTasks(inputs);
      case 'get_todo_task':
        return await this.getTodoTask(inputs);
      case 'create_todo_task':
        return await this.createTodoTask(inputs);
      case 'update_todo_task':
        return await this.updateTodoTask(inputs);
      case 'delete_todo_task':
        return await this.deleteTodoTask(inputs);
      case 'complete_todo_task':
        return await this.completeTodoTask(inputs);
      // Teams actions
      case 'list_teams':
        return await this.listTeams();
      case 'list_channels':
        return await this.listChannels(inputs);
      case 'send_channel_message':
        return await this.sendChannelMessage(inputs);
      case 'read_channel_messages':
        return await this.readChannelMessages(inputs);
      case 'list_chats':
        return await this.listChats();
      case 'send_chat_message':
        return await this.sendChatMessage(inputs);
      case 'read_chat_messages':
        return await this.readChatMessages(inputs);
      default:
        throw new Error(`Unknown Office 365 action: ${actionName}`);
    }
  }

  isConnected(): boolean {
    return this.accessToken !== null && this.credentials !== null;
  }

  /**
   * Make a request to Microsoft Graph API
   */
  private async makeGraphRequest(endpoint: string, options: RequestInit = {}, retryCount = 0): Promise<unknown> {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    const url = `https://graph.microsoft.com/v1.0${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    // Handle rate limiting (429) with exponential backoff
    if (response.status === 429 && retryCount < 3) {
      const retryAfter = response.headers.get('Retry-After');
      const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : Math.pow(2, retryCount) * 1000;
      
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return this.makeGraphRequest(endpoint, options, retryCount + 1);
    }

    if (!response.ok) {
      let errorMessage = 'Unknown error';
      let errorCode = 'UNKNOWN_ERROR';

      try {
        const errorData = await response.json() as {
          error?: {
            code?: string;
            message?: string;
            innerError?: {
              'request-id'?: string;
            };
          };
        };

        if (errorData.error) {
          errorCode = errorData.error.code || response.status.toString();
          errorMessage = errorData.error.message || response.statusText;
          
          // Provide more specific error messages for common scenarios
          if (response.status === 401) {
            errorMessage = 'Authentication failed. Token may be expired.';
          } else if (response.status === 403) {
            errorMessage = 'Permission denied. Required scopes may be missing.';
          } else if (response.status === 404) {
            errorMessage = 'Resource not found.';
          } else if (response.status === 429) {
            errorMessage = 'Rate limit exceeded. Please try again later.';
          } else if (response.status >= 500) {
            errorMessage = 'Microsoft Graph API server error. Please try again later.';
          }
        }
      } catch {
        // If JSON parsing fails, use status text
        if (response.status === 401) {
          errorMessage = 'Authentication failed. Token may be expired.';
        } else if (response.status === 403) {
          errorMessage = 'Permission denied.';
        } else if (response.status === 404) {
          errorMessage = 'Resource not found.';
        } else if (response.status === 429) {
          errorMessage = 'Rate limit exceeded.';
        } else {
          errorMessage = response.statusText || 'Unknown error';
        }
      }

      const error = new Error(`Graph API error (${errorCode}): ${errorMessage}`);
      (error as { statusCode?: number }).statusCode = response.status;
      throw error;
    }

    // Handle empty responses (e.g., 202 Accepted for sendMail)
    const contentType = response.headers.get('content-type') || '';
    const contentLength = response.headers.get('content-length');
    
    // If content-length is 0 or response is 202/204, return empty object
    if (response.status === 202 || response.status === 204 || contentLength === '0') {
      return {};
    }
    
    // Check if response has content before parsing
    const text = await response.text();
    if (!text || text.trim().length === 0) {
      return {};
    }
    
    // Try to parse as JSON
    try {
      return JSON.parse(text);
    } catch {
      // If parsing fails, return the text as-is
      return { raw: text };
    }
  }

  /**
   * Refresh access token using refresh token
   * Works for both personal Microsoft accounts and organizational accounts
   * when tenantId is 'common' (default)
   */
  private async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken || !this.tenantId) {
      throw new Error('Refresh token or tenant ID not available');
    }

    const clientId = process.env.OFFICE365_CLIENT_ID;
    const clientSecret = process.env.OFFICE365_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('Office 365 OAuth credentials not configured');
    }

    // Use stored tenantId (supports 'common' for both personal and org accounts)
    const tokenUrl = `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`;
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: this.refreshToken,
      grant_type: 'refresh_token',
      scope: 'https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Calendars.ReadWrite https://graph.microsoft.com/Tasks.ReadWrite https://graph.microsoft.com/User.Read https://graph.microsoft.com/Chat.ReadWrite https://graph.microsoft.com/ChannelMessage.Read.All https://graph.microsoft.com/ChannelMessage.Send https://graph.microsoft.com/Team.ReadBasic.All offline_access',
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    if (!response.ok) {
      throw new Error('Failed to refresh access token');
    }

    const tokenData = await response.json() as MicrosoftTokenResponse;
    this.accessToken = tokenData.access_token;
    if (tokenData.refresh_token) {
      this.refreshToken = tokenData.refresh_token;
    }
    this.tokenExpiry = Date.now() + (tokenData.expires_in * 1000);

    // Update stored credentials
    await this.updateCredentials({
      accessToken: this.accessToken,
      refreshToken: this.refreshToken,
      expiryDate: this.tokenExpiry,
      tenantId: this.tenantId,
    });
  }

  private async sendEmail(inputs: ActionInput): Promise<ActionOutput> {
    const { to, subject, body, cc, bcc } = inputs as {
      to: string;
      subject: string;
      body: string;
      cc?: string[];
      bcc?: string[];
    };

    const message = {
      message: {
        subject,
        body: {
          contentType: 'HTML',
          content: body,
        },
        toRecipients: [{ emailAddress: { address: to } }],
        ...(cc && cc.length > 0 && {
          ccRecipients: cc.map(email => ({ emailAddress: { address: email } })),
        }),
        ...(bcc && bcc.length > 0 && {
          bccRecipients: bcc.map(email => ({ emailAddress: { address: email } })),
        }),
      },
    };

    // sendMail endpoint returns 202 Accepted with empty body on success
    await this.makeGraphRequest('/me/sendMail', {
      method: 'POST',
      body: JSON.stringify(message),
    });

    // Return success response (sendMail doesn't return message details)
    return {
      id: 'sent',
      createdDateTime: new Date().toISOString(),
      status: 'sent',
    };
  }

  private async readEmails(inputs: ActionInput): Promise<ActionOutput> {
    const {
      filter,
      top = 10,
      orderBy = 'receivedDateTime desc',
      folderId,
      includeBody = false,
      hasAttachments,
      from,
      subjectContains,
      dateRange,
    } = inputs as {
      filter?: string;
      top?: number;
      orderBy?: string;
      folderId?: string;
      includeBody?: boolean;
      hasAttachments?: boolean;
      from?: string;
      subjectContains?: string;
      dateRange?: { start?: string; end?: string };
    };

    // Build filter conditions
    const filterParts: string[] = [];
    if (filter) {
      filterParts.push(filter);
    }
    if (hasAttachments) {
      filterParts.push('hasAttachments eq true');
    }
    if (from) {
      filterParts.push(`from/emailAddress/address eq '${from.replace(/'/g, "''")}'`);
    }
    if (subjectContains) {
      filterParts.push(`contains(subject, '${subjectContains.replace(/'/g, "''")}')`);
    }
    if (dateRange?.start) {
      filterParts.push(`receivedDateTime ge ${dateRange.start}`);
    }
    if (dateRange?.end) {
      filterParts.push(`receivedDateTime le ${dateRange.end}`);
    }

    const combinedFilter = filterParts.length > 0 ? filterParts.join(' and ') : undefined;

    // Build endpoint
    let endpoint = folderId
      ? `/me/mailFolders/${folderId}/messages`
      : '/me/messages';
    
    const params = new URLSearchParams();
    params.append('$top', top.toString());
    params.append('$orderby', orderBy);
    
    if (combinedFilter) {
      params.append('$filter', combinedFilter);
    }
    
    if (includeBody) {
      params.append('$select', 'id,subject,from,receivedDateTime,bodyPreview,body,hasAttachments');
    }

    endpoint += `?${params.toString()}`;

    const result = await this.makeGraphRequest(endpoint) as {
      value?: Array<{
        id: string;
        subject: string;
        from: { emailAddress: { address: string; name: string } };
        receivedDateTime: string;
        bodyPreview: string;
        body?: { content: string; contentType: string };
        hasAttachments?: boolean;
      }>;
    };

    return {
      emails: (result.value || []).map(email => ({
        id: email.id,
        subject: email.subject,
        from: email.from,
        receivedDateTime: email.receivedDateTime,
        bodyPreview: email.bodyPreview,
        ...(includeBody && email.body && { body: email.body }),
        ...(email.hasAttachments !== undefined && { hasAttachments: email.hasAttachments }),
      })),
    };
  }

  private async getEmail(id: string): Promise<ActionOutput> {
    const result = await this.makeGraphRequest(`/me/messages/${id}?$select=id,subject,from,toRecipients,ccRecipients,bccRecipients,receivedDateTime,bodyPreview,body,hasAttachments,importance,isRead`) as {
      id: string;
      subject: string;
      from: { emailAddress: { address: string; name: string } };
      toRecipients?: Array<{ emailAddress: { address: string; name: string } }>;
      ccRecipients?: Array<{ emailAddress: { address: string; name: string } }>;
      bccRecipients?: Array<{ emailAddress: { address: string; name: string } }>;
      receivedDateTime: string;
      bodyPreview: string;
      body: { content: string; contentType: string };
      hasAttachments: boolean;
      importance: string;
      isRead: boolean;
    };

    return {
      id: result.id,
      subject: result.subject,
      from: result.from,
      toRecipients: result.toRecipients || [],
      ccRecipients: result.ccRecipients || [],
      bccRecipients: result.bccRecipients || [],
      receivedDateTime: result.receivedDateTime,
      bodyPreview: result.bodyPreview,
      body: result.body,
      hasAttachments: result.hasAttachments,
      importance: result.importance,
      isRead: result.isRead,
    };
  }

  private async listEmailFolders(): Promise<ActionOutput> {
    const result = await this.makeGraphRequest('/me/mailFolders') as {
      value?: Array<{
        id: string;
        displayName: string;
        parentFolderId: string;
        childFolderCount: number;
        unreadItemCount: number;
        totalItemCount: number;
      }>;
    };

    return {
      folders: (result.value || []).map(folder => ({
        id: folder.id,
        displayName: folder.displayName,
        parentFolderId: folder.parentFolderId,
        childFolderCount: folder.childFolderCount,
        unreadItemCount: folder.unreadItemCount,
        totalItemCount: folder.totalItemCount,
      })),
    };
  }

  private async readEmailsFromFolder(inputs: ActionInput): Promise<ActionOutput> {
    const { folderId, ...emailParams } = inputs as {
      folderId: string;
      top?: number;
      orderBy?: string;
      includeBody?: boolean;
      filter?: string;
    };

    return await this.readEmails({ ...emailParams, folderId });
  }

  private async searchEmails(inputs: ActionInput): Promise<ActionOutput> {
    const {
      query,
      top = 10,
      includeBody = false,
    } = inputs as {
      query: string;
      top?: number;
      includeBody?: boolean;
    };

    const params = new URLSearchParams();
    params.append('$search', `"${query}"`);
    params.append('$top', top.toString());
    
    if (includeBody) {
      params.append('$select', 'id,subject,from,receivedDateTime,bodyPreview,body,hasAttachments');
    }

    const endpoint = `/me/messages?${params.toString()}`;
    const result = await this.makeGraphRequest(endpoint) as {
      value?: Array<{
        id: string;
        subject: string;
        from: { emailAddress: { address: string; name: string } };
        receivedDateTime: string;
        bodyPreview: string;
        body?: { content: string; contentType: string };
        hasAttachments?: boolean;
      }>;
    };

    return {
      emails: (result.value || []).map(email => ({
        id: email.id,
        subject: email.subject,
        from: email.from,
        receivedDateTime: email.receivedDateTime,
        bodyPreview: email.bodyPreview,
        ...(includeBody && email.body && { body: email.body }),
        ...(email.hasAttachments !== undefined && { hasAttachments: email.hasAttachments }),
      })),
    };
  }

  private async getEmailAttachments(emailId: string): Promise<ActionOutput> {
    const result = await this.makeGraphRequest(`/me/messages/${emailId}/attachments`) as {
      value?: Array<{
        id: string;
        name: string;
        contentType: string;
        size: number;
        isInline: boolean;
        contentId?: string;
        contentBytes?: string;
      }>;
    };

    return {
      attachments: (result.value || []).map(attachment => ({
        id: attachment.id,
        name: attachment.name,
        contentType: attachment.contentType,
        size: attachment.size,
        isInline: attachment.isInline,
        ...(attachment.contentId && { contentId: attachment.contentId }),
        ...(attachment.contentBytes && { contentBytes: attachment.contentBytes }),
      })),
    };
  }

  private async getCalendarEvents(inputs: ActionInput): Promise<ActionOutput> {
    const {
      startDateTime,
      endDateTime,
      filter,
      calendarId,
      includeDetails = false,
      includeCancelled = false,
      attendees,
      location,
      categories,
    } = inputs as {
      startDateTime?: string;
      endDateTime?: string;
      filter?: string;
      calendarId?: string;
      includeDetails?: boolean;
      includeCancelled?: boolean;
      attendees?: string[];
      location?: string;
      categories?: string[];
    };

    const calendarPath = calendarId ? `/me/calendars/${calendarId}` : '/me/calendar';
    let endpoint = `${calendarPath}/events?$orderby=start/dateTime`;

    // Build filter conditions
    const filterParts: string[] = [];
    if (startDateTime && endDateTime) {
      filterParts.push(`start/dateTime ge '${startDateTime}' and end/dateTime le '${endDateTime}'`);
    }
    if (filter) {
      filterParts.push(filter);
    }
    if (!includeCancelled) {
      filterParts.push("isCancelled eq false");
    }
    if (attendees && attendees.length > 0) {
      filterParts.push(`attendees/any(a: a/emailAddress/address eq '${attendees[0]}')`);
    }
    if (location) {
      filterParts.push(`contains(location/displayName, '${location.replace(/'/g, "''")}')`);
    }
    if (categories && categories.length > 0) {
      filterParts.push(`categories/any(c: c eq '${categories[0]}')`);
    }

    if (filterParts.length > 0) {
      endpoint += `&$filter=${encodeURIComponent(filterParts.join(' and '))}`;
    }

    if (includeDetails) {
      endpoint += '&$select=id,subject,start,end,location,body,attendees,categories,isCancelled,organizer,recurrence,webLink';
    }

    const result = await this.makeGraphRequest(endpoint) as {
      value?: Array<{
        id: string;
        subject: string;
        start: { dateTime: string; timeZone: string };
        end: { dateTime: string; timeZone: string };
        location?: { displayName: string };
        body?: { content: string; contentType: string };
        attendees?: Array<{ emailAddress: { address: string; name: string }; type: string }>;
        categories?: string[];
        isCancelled?: boolean;
        organizer?: { emailAddress: { address: string; name: string } };
        recurrence?: unknown;
        webLink?: string;
      }>;
    };

    return {
      events: (result.value || []).map(event => ({
        id: event.id,
        subject: event.subject,
        start: event.start,
        end: event.end,
        ...(event.location && { location: event.location }),
        ...(includeDetails && event.body && { body: event.body }),
        ...(includeDetails && event.attendees && { attendees: event.attendees }),
        ...(includeDetails && event.categories && { categories: event.categories }),
        ...(includeDetails && event.isCancelled !== undefined && { isCancelled: event.isCancelled }),
        ...(includeDetails && event.organizer && { organizer: event.organizer }),
        ...(includeDetails && event.recurrence && { recurrence: event.recurrence }),
        ...(includeDetails && event.webLink && { webLink: event.webLink }),
      })),
    };
  }

  private async listCalendars(): Promise<ActionOutput> {
    const result = await this.makeGraphRequest('/me/calendars') as {
      value?: Array<{
        id: string;
        name: string;
        color: string;
        canEdit: boolean;
        canShare: boolean;
        canViewPrivateItems: boolean;
        owner?: { name: string; address: string };
      }>;
    };

    return {
      calendars: (result.value || []).map(calendar => ({
        id: calendar.id,
        name: calendar.name,
        color: calendar.color,
        canEdit: calendar.canEdit,
        canShare: calendar.canShare,
        canViewPrivateItems: calendar.canViewPrivateItems,
        ...(calendar.owner && { owner: calendar.owner }),
      })),
    };
  }

  private async getCalendarEvent(eventId: string): Promise<ActionOutput> {
    const result = await this.makeGraphRequest(`/me/calendar/events/${eventId}`) as {
      id: string;
      subject: string;
      start: { dateTime: string; timeZone: string };
      end: { dateTime: string; timeZone: string };
      location?: { displayName: string };
      body?: { content: string; contentType: string };
      attendees?: Array<{ emailAddress: { address: string; name: string }; type: string; status: { response: string } }>;
      categories?: string[];
      isCancelled: boolean;
      organizer: { emailAddress: { address: string; name: string } };
      recurrence?: unknown;
      webLink?: string;
      importance?: string;
      sensitivity?: string;
    };

    return {
      id: result.id,
      subject: result.subject,
      start: result.start,
      end: result.end,
      ...(result.location && { location: result.location }),
      ...(result.body && { body: result.body }),
      ...(result.attendees && { attendees: result.attendees }),
      ...(result.categories && { categories: result.categories }),
      isCancelled: result.isCancelled,
      organizer: result.organizer,
      ...(result.recurrence && { recurrence: result.recurrence }),
      ...(result.webLink && { webLink: result.webLink }),
      ...(result.importance && { importance: result.importance }),
      ...(result.sensitivity && { sensitivity: result.sensitivity }),
    };
  }

  private async updateCalendarEvent(inputs: ActionInput): Promise<ActionOutput> {
    const { eventId, ...updates } = inputs as {
      eventId: string;
      subject?: string;
      start?: { dateTime: string; timeZone: string };
      end?: { dateTime: string; timeZone: string };
      body?: string;
      location?: { displayName: string };
      attendees?: Array<{ emailAddress: { address: string } }>;
      categories?: string[];
    };

    const eventUpdates: Record<string, unknown> = {};
    if (updates.subject) eventUpdates.subject = updates.subject;
    if (updates.start) eventUpdates.start = updates.start;
    if (updates.end) eventUpdates.end = updates.end;
    if (updates.body) {
      eventUpdates.body = {
        contentType: 'HTML',
        content: updates.body,
      };
    }
    if (updates.location) eventUpdates.location = updates.location;
    if (updates.attendees) {
      eventUpdates.attendees = updates.attendees.map(attendee => ({
        emailAddress: attendee.emailAddress,
        type: 'required',
      }));
    }
    if (updates.categories) eventUpdates.categories = updates.categories;

    const result = await this.makeGraphRequest(`/me/calendar/events/${eventId}`, {
      method: 'PATCH',
      body: JSON.stringify(eventUpdates),
    }) as { id?: string; updatedDateTime?: string };

    return {
      id: result.id || eventId,
      updatedDateTime: result.updatedDateTime || new Date().toISOString(),
    };
  }

  private async deleteCalendarEvent(eventId: string): Promise<ActionOutput> {
    await this.makeGraphRequest(`/me/calendar/events/${eventId}`, {
      method: 'DELETE',
    });

    return {
      success: true,
      deletedEventId: eventId,
    };
  }

  private async getFreeBusy(inputs: ActionInput): Promise<ActionOutput> {
    const {
      startTime,
      endTime,
      schedules = [],
      availabilityViewInterval = 15,
    } = inputs as {
      startTime: string;
      endTime: string;
      schedules?: string[];
      availabilityViewInterval?: number;
    };

    const requestBody = {
      schedules: schedules.length > 0 ? schedules : ['me'],
      startTime: {
        dateTime: startTime,
        timeZone: 'UTC',
      },
      endTime: {
        dateTime: endTime,
        timeZone: 'UTC',
      },
      availabilityViewInterval,
    };

    const result = await this.makeGraphRequest('/me/calendar/getSchedule', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    }) as {
      value?: Array<{
        scheduleId: string;
        scheduleItems?: Array<{
          start: { dateTime: string; timeZone: string };
          end: { dateTime: string; timeZone: string };
          status: string;
          subject?: string;
        }>;
        workingHours?: {
          daysOfWeek: string[];
          startTime: string;
          endTime: string;
          timeZone: { name: string };
        };
      }>;
    };

    return {
      schedules: result.value || [],
    };
  }

  private async findMeetingTimes(inputs: ActionInput): Promise<ActionOutput> {
    const {
      attendees,
      meetingDuration,
      timeConstraint,
      isOrganizerOptional = false,
      returnSuggestionReasons = false,
    } = inputs as {
      attendees?: Array<{ emailAddress: { address: string } }>;
      meetingDuration?: string;
      timeConstraint?: {
        timeslots?: Array<{ start: { dateTime: string; timeZone: string }; end: { dateTime: string; timeZone: string } }>;
        activityDomain?: string;
      };
      isOrganizerOptional?: boolean;
      returnSuggestionReasons?: boolean;
    };

    const requestBody: Record<string, unknown> = {
      isOrganizerOptional,
      returnSuggestionReasons,
    };

    if (attendees) {
      requestBody.attendees = attendees.map(attendee => ({
        emailAddress: attendee.emailAddress,
        type: 'required',
      }));
    }

    if (meetingDuration) {
      requestBody.meetingDuration = meetingDuration;
    }

    if (timeConstraint) {
      requestBody.timeConstraint = timeConstraint;
    }

    const result = await this.makeGraphRequest('/me/calendar/findMeetingTimes', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    }) as {
      emptySuggestionsReason?: string;
      meetingTimeSuggestions?: Array<{
        confidence: number;
        organizerAvailability: string;
        suggestionReason: string;
        meetingTimeSlot: {
          start: { dateTime: string; timeZone: string };
          end: { dateTime: string; timeZone: string };
        };
        attendeeAvailability?: Array<{
          attendee: { emailAddress: { address: string } };
          availability: string;
        }>;
      }>;
    };

    return {
      emptySuggestionsReason: result.emptySuggestionsReason,
      meetingTimeSuggestions: result.meetingTimeSuggestions || [],
    };
  }

  private async getCalendarView(inputs: ActionInput): Promise<ActionOutput> {
    const {
      startDate,
      endDate,
      calendarId,
    } = inputs as {
      startDate: string;
      endDate: string;
      calendarId?: string;
    };

    const calendarPath = calendarId ? `/me/calendars/${calendarId}` : '/me/calendar';
    const endpoint = `${calendarPath}/calendarView?startDateTime=${encodeURIComponent(startDate)}&endDateTime=${encodeURIComponent(endDate)}&$orderby=start/dateTime`;

    const result = await this.makeGraphRequest(endpoint) as {
      value?: Array<{
        id: string;
        subject: string;
        start: { dateTime: string; timeZone: string };
        end: { dateTime: string; timeZone: string };
        location?: { displayName: string };
        isAllDay?: boolean;
        showAs?: string;
      }>;
    };

    return {
      events: (result.value || []).map(event => ({
        id: event.id,
        subject: event.subject,
        start: event.start,
        end: event.end,
        ...(event.location && { location: event.location }),
        ...(event.isAllDay !== undefined && { isAllDay: event.isAllDay }),
        ...(event.showAs && { showAs: event.showAs }),
      })),
    };
  }

  private async createCalendarEvent(inputs: ActionInput): Promise<ActionOutput> {
    const { subject, start, end, body, attendees, location } = inputs as {
      subject: string;
      start: { dateTime: string; timeZone: string } | string;
      end: { dateTime: string; timeZone: string } | string;
      body?: string;
      attendees?: Array<{ emailAddress: { address: string } }>;
      location?: { displayName: string };
    };

    // Normalize start and end to the correct format
    // Handle both object format and ISO string format
    let startDateTime: { dateTime: string; timeZone: string };
    let endDateTime: { dateTime: string; timeZone: string };

    if (typeof start === 'string') {
      // If it's a string, parse it and use UTC timezone
      const startDate = new Date(start);
      startDateTime = {
        dateTime: startDate.toISOString(),
        timeZone: 'UTC',
      };
    } else if (start && typeof start === 'object' && 'dateTime' in start && 'timeZone' in start) {
      startDateTime = start as { dateTime: string; timeZone: string };
    } else {
      throw new Error('Invalid start format. Expected object with dateTime and timeZone, or ISO 8601 string.');
    }

    if (typeof end === 'string') {
      // If it's a string, parse it and use UTC timezone
      const endDate = new Date(end);
      endDateTime = {
        dateTime: endDate.toISOString(),
        timeZone: 'UTC',
      };
    } else if (end && typeof end === 'object' && 'dateTime' in end && 'timeZone' in end) {
      endDateTime = end as { dateTime: string; timeZone: string };
    } else {
      throw new Error('Invalid end format. Expected object with dateTime and timeZone, or ISO 8601 string.');
    }

    const event = {
      subject,
      start: startDateTime,
      end: endDateTime,
      ...(body && {
        body: {
          contentType: 'HTML',
          content: body,
        },
      }),
      ...(attendees && attendees.length > 0 && {
        attendees: attendees.map(attendee => ({
          emailAddress: attendee.emailAddress,
          type: 'required',
        })),
      }),
      ...(location && {
        location: {
          displayName: location.displayName,
        },
      }),
    };

    console.log('[Office365] Creating calendar event:', JSON.stringify(event, null, 2));
    
    try {
      const result = await this.makeGraphRequest('/me/calendar/events', {
        method: 'POST',
        body: JSON.stringify(event),
      }) as { id?: string; createdDateTime?: string; subject?: string; start?: { dateTime: string; timeZone: string }; end?: { dateTime: string; timeZone: string } };

      console.log('[Office365] Calendar event creation response:', JSON.stringify(result, null, 2));

      // Validate that the event was actually created
      // Check if result is empty object (which means empty response)
      if (!result || (typeof result === 'object' && Object.keys(result).length === 0)) {
        throw new Error('Failed to create calendar event: Empty response from API. This may indicate a permissions issue or invalid request.');
      }

      if (!result.id) {
        const errorDetails = result ? JSON.stringify(result) : 'No response from API';
        throw new Error(`Failed to create calendar event: No event ID returned. Response: ${errorDetails}`);
      }

      return {
        id: result.id,
        createdDateTime: result.createdDateTime || new Date().toISOString(),
        subject: result.subject || subject,
        start: result.start || startDateTime,
        end: result.end || endDateTime,
        success: true,
      };
    } catch (error) {
      console.error('[Office365] Error creating calendar event:', error);
      // Re-throw with more context
      if (error instanceof Error) {
        throw new Error(`Failed to create calendar event: ${error.message}`);
      }
      throw error;
    }

    return {
      id: result.id,
      createdDateTime: result.createdDateTime || new Date().toISOString(),
      subject: result.subject || subject,
      start: result.start || startDateTime,
      end: result.end || endDateTime,
      success: true,
    };
  }

  private async getUserProfile(): Promise<ActionOutput> {
    const result = await this.makeGraphRequest('/me') as {
      id?: string;
      displayName?: string;
      mail?: string;
      userPrincipalName?: string;
    };

    return {
      id: result.id || '',
      displayName: result.displayName || '',
      mail: result.mail || '',
      userPrincipalName: result.userPrincipalName || '',
    };
  }

  // ============================================================================
  // Microsoft To Do Methods
  // ============================================================================

  private async listTodoLists(): Promise<ActionOutput> {
    const result = await this.makeGraphRequest('/me/todo/lists') as {
      value?: Array<{
        id: string;
        displayName: string;
        isOwner: boolean;
        isShared: boolean;
        wellknownListName?: string;
      }>;
    };

    return {
      lists: (result.value || []).map(list => ({
        id: list.id,
        displayName: list.displayName,
        isOwner: list.isOwner,
        isShared: list.isShared,
        ...(list.wellknownListName && { wellknownListName: list.wellknownListName }),
      })),
    };
  }

  private async getTodoList(listId: string): Promise<ActionOutput> {
    const result = await this.makeGraphRequest(`/me/todo/lists/${listId}`) as {
      id: string;
      displayName: string;
      isOwner: boolean;
      isShared: boolean;
      wellknownListName?: string;
    };

    return {
      id: result.id,
      displayName: result.displayName,
      isOwner: result.isOwner,
      isShared: result.isShared,
      ...(result.wellknownListName && { wellknownListName: result.wellknownListName }),
    };
  }

  private async createTodoList(inputs: ActionInput): Promise<ActionOutput> {
    const { displayName } = inputs as {
      displayName: string;
    };

    const result = await this.makeGraphRequest('/me/todo/lists', {
      method: 'POST',
      body: JSON.stringify({ displayName }),
    }) as { id?: string; displayName?: string };

    return {
      id: result.id || '',
      displayName: result.displayName || displayName,
    };
  }

  private async updateTodoList(inputs: ActionInput): Promise<ActionOutput> {
    const { listId, displayName } = inputs as {
      listId: string;
      displayName?: string;
    };

    const updates: Record<string, unknown> = {};
    if (displayName) updates.displayName = displayName;

    const result = await this.makeGraphRequest(`/me/todo/lists/${listId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }) as { id?: string; displayName?: string };

    return {
      id: result.id || listId,
      displayName: result.displayName || displayName || '',
    };
  }

  private async deleteTodoList(listId: string): Promise<ActionOutput> {
    await this.makeGraphRequest(`/me/todo/lists/${listId}`, {
      method: 'DELETE',
    });

    return {
      success: true,
      deletedListId: listId,
    };
  }

  private async listTodoTasks(inputs: ActionInput): Promise<ActionOutput> {
    const {
      listId,
      top = 100,
      filter,
      orderBy = 'createdDateTime desc',
    } = inputs as {
      listId: string;
      top?: number;
      filter?: string;
      orderBy?: string;
    };

    let endpoint = `/me/todo/lists/${listId}/tasks?$top=${top}&$orderby=${encodeURIComponent(orderBy)}`;
    if (filter) {
      endpoint += `&$filter=${encodeURIComponent(filter)}`;
    }

    const result = await this.makeGraphRequest(endpoint) as {
      value?: Array<{
        id: string;
        title: string;
        status: string;
        importance: string;
        createdDateTime: string;
        lastModifiedDateTime: string;
        dueDateTime?: { dateTime: string; timeZone: string };
        reminderDateTime?: { dateTime: string; timeZone: string };
        body?: { content: string; contentType: string };
        categories?: string[];
        checklistItems?: Array<{
          id: string;
          displayName: string;
          isChecked: boolean;
        }>;
      }>;
    };

    return {
      tasks: (result.value || []).map(task => ({
        id: task.id,
        title: task.title,
        status: task.status,
        importance: task.importance,
        createdDateTime: task.createdDateTime,
        lastModifiedDateTime: task.lastModifiedDateTime,
        ...(task.dueDateTime && { dueDateTime: task.dueDateTime }),
        ...(task.reminderDateTime && { reminderDateTime: task.reminderDateTime }),
        ...(task.body && { body: task.body }),
        ...(task.categories && { categories: task.categories }),
        ...(task.checklistItems && { checklistItems: task.checklistItems }),
      })),
    };
  }

  private async getTodoTask(inputs: ActionInput): Promise<ActionOutput> {
    const { listId, taskId } = inputs as {
      listId: string;
      taskId: string;
    };

    const result = await this.makeGraphRequest(`/me/todo/lists/${listId}/tasks/${taskId}`) as {
      id: string;
      title: string;
      status: string;
      importance: string;
      createdDateTime: string;
      lastModifiedDateTime: string;
      dueDateTime?: { dateTime: string; timeZone: string };
      reminderDateTime?: { dateTime: string; timeZone: string };
      body?: { content: string; contentType: string };
      categories?: string[];
      checklistItems?: Array<{
        id: string;
        displayName: string;
        isChecked: boolean;
      }>;
    };

    return {
      id: result.id,
      title: result.title,
      status: result.status,
      importance: result.importance,
      createdDateTime: result.createdDateTime,
      lastModifiedDateTime: result.lastModifiedDateTime,
      ...(result.dueDateTime && { dueDateTime: result.dueDateTime }),
      ...(result.reminderDateTime && { reminderDateTime: result.reminderDateTime }),
      ...(result.body && { body: result.body }),
      ...(result.categories && { categories: result.categories }),
      ...(result.checklistItems && { checklistItems: result.checklistItems }),
    };
  }

  private async createTodoTask(inputs: ActionInput): Promise<ActionOutput> {
    const {
      listId,
      title,
      body,
      dueDateTime,
      reminderDateTime,
      importance = 'normal',
      categories,
      checklistItems,
    } = inputs as {
      listId: string;
      title: string;
      body?: string;
      dueDateTime?: { dateTime: string; timeZone: string };
      reminderDateTime?: { dateTime: string; timeZone: string };
      importance?: 'low' | 'normal' | 'high';
      categories?: string[];
      checklistItems?: Array<{ displayName: string; isChecked?: boolean }>;
    };

    const task: Record<string, unknown> = {
      title,
      importance,
    };

    if (body) {
      task.body = {
        contentType: 'text',
        content: body,
      };
    }

    if (dueDateTime) {
      task.dueDateTime = dueDateTime;
    }

    if (reminderDateTime) {
      task.reminderDateTime = reminderDateTime;
    }

    if (categories) {
      task.categories = categories;
    }

    if (checklistItems) {
      task.checklistItems = checklistItems.map(item => ({
        displayName: item.displayName,
        isChecked: item.isChecked || false,
      }));
    }

    const result = await this.makeGraphRequest(`/me/todo/lists/${listId}/tasks`, {
      method: 'POST',
      body: JSON.stringify(task),
    }) as { id?: string; title?: string; createdDateTime?: string };

    return {
      id: result.id || '',
      title: result.title || title,
      createdDateTime: result.createdDateTime || new Date().toISOString(),
    };
  }

  private async updateTodoTask(inputs: ActionInput): Promise<ActionOutput> {
    const {
      listId,
      taskId,
      title,
      body,
      status,
      dueDateTime,
      reminderDateTime,
      importance,
      categories,
      checklistItems,
    } = inputs as {
      listId: string;
      taskId: string;
      title?: string;
      body?: string;
      status?: 'notStarted' | 'inProgress' | 'completed' | 'waitingOnOthers' | 'deferred';
      dueDateTime?: { dateTime: string; timeZone: string };
      reminderDateTime?: { dateTime: string; timeZone: string };
      importance?: 'low' | 'normal' | 'high';
      categories?: string[];
      checklistItems?: Array<{ id?: string; displayName?: string; isChecked?: boolean }>;
    };

    const updates: Record<string, unknown> = {};

    if (title) updates.title = title;
    if (status) updates.status = status;
    if (importance) updates.importance = importance;
    if (dueDateTime) updates.dueDateTime = dueDateTime;
    if (reminderDateTime) updates.reminderDateTime = reminderDateTime;
    if (categories) updates.categories = categories;

    if (body) {
      updates.body = {
        contentType: 'text',
        content: body,
      };
    }

    if (checklistItems) {
      updates.checklistItems = checklistItems.map(item => ({
        ...(item.id && { id: item.id }),
        ...(item.displayName && { displayName: item.displayName }),
        isChecked: item.isChecked !== undefined ? item.isChecked : false,
      }));
    }

    const result = await this.makeGraphRequest(`/me/todo/lists/${listId}/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }) as { id?: string; lastModifiedDateTime?: string };

    return {
      id: result.id || taskId,
      lastModifiedDateTime: result.lastModifiedDateTime || new Date().toISOString(),
    };
  }

  private async deleteTodoTask(inputs: ActionInput): Promise<ActionOutput> {
    const { listId, taskId } = inputs as {
      listId: string;
      taskId: string;
    };

    await this.makeGraphRequest(`/me/todo/lists/${listId}/tasks/${taskId}`, {
      method: 'DELETE',
    });

    return {
      success: true,
      deletedTaskId: taskId,
    };
  }

  private async completeTodoTask(inputs: ActionInput): Promise<ActionOutput> {
    const { listId, taskId } = inputs as {
      listId: string;
      taskId: string;
    };

    const result = await this.makeGraphRequest(`/me/todo/lists/${listId}/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'completed' }),
    }) as { id?: string; status?: string; lastModifiedDateTime?: string };

    return {
      id: result.id || taskId,
      status: result.status || 'completed',
      lastModifiedDateTime: result.lastModifiedDateTime || new Date().toISOString(),
    };
  }

  // Microsoft Teams Methods

  private async listTeams(): Promise<ActionOutput> {
    const result = await this.makeGraphRequest('/me/joinedTeams') as {
      value?: Array<{
        id: string;
        displayName: string;
        description?: string;
        visibility?: string;
      }>;
    };

    return {
      teams: (result.value || []).map(team => ({
        id: team.id,
        displayName: team.displayName,
        description: team.description || '',
        visibility: team.visibility || 'private',
      })),
    };
  }

  private async listChannels(inputs: ActionInput): Promise<ActionOutput> {
    const { teamId } = inputs as { teamId: string };

    const result = await this.makeGraphRequest(`/teams/${teamId}/channels`) as {
      value?: Array<{
        id: string;
        displayName: string;
        description?: string;
        isFavoriteByDefault?: boolean;
        email?: string;
      }>;
    };

    return {
      channels: (result.value || []).map(channel => ({
        id: channel.id,
        displayName: channel.displayName,
        description: channel.description || '',
        isFavoriteByDefault: channel.isFavoriteByDefault || false,
        email: channel.email || '',
      })),
    };
  }

  private async sendChannelMessage(inputs: ActionInput): Promise<ActionOutput> {
    const { teamId, channelId, content } = inputs as {
      teamId: string;
      channelId: string;
      content: string;
    };

    const message = {
      body: {
        contentType: 'html',
        content: content,
      },
    };

    const result = await this.makeGraphRequest(`/teams/${teamId}/channels/${channelId}/messages`, {
      method: 'POST',
      body: JSON.stringify(message),
    }) as {
      id?: string;
      createdDateTime?: string;
      messageType?: string;
    };

    return {
      id: result.id || '',
      createdDateTime: result.createdDateTime || new Date().toISOString(),
      messageType: result.messageType || 'message',
    };
  }

  private async readChannelMessages(inputs: ActionInput): Promise<ActionOutput> {
    const { teamId, channelId, top = 20 } = inputs as {
      teamId: string;
      channelId: string;
      top?: number;
    };

    const endpoint = `/teams/${teamId}/channels/${channelId}/messages?$top=${top}&$orderby=createdDateTime desc`;
    const result = await this.makeGraphRequest(endpoint) as {
      value?: Array<{
        id: string;
        createdDateTime: string;
        body: { contentType: string; content: string };
        from: { user?: { displayName: string; id: string } };
        messageType: string;
      }>;
    };

    return {
      messages: (result.value || []).map(message => ({
        id: message.id,
        createdDateTime: message.createdDateTime,
        body: message.body,
        from: message.from,
        messageType: message.messageType,
      })),
    };
  }

  private async listChats(): Promise<ActionOutput> {
    const result = await this.makeGraphRequest('/me/chats') as {
      value?: Array<{
        id: string;
        topic?: string;
        chatType: string;
        createdDateTime?: string;
      }>;
    };

    return {
      chats: (result.value || []).map(chat => ({
        id: chat.id,
        topic: chat.topic || '',
        chatType: chat.chatType,
        createdDateTime: chat.createdDateTime || '',
      })),
    };
  }

  private async sendChatMessage(inputs: ActionInput): Promise<ActionOutput> {
    const { chatId, content } = inputs as {
      chatId: string;
      content: string;
    };

    const message = {
      body: {
        contentType: 'html',
        content: content,
      },
    };

    const result = await this.makeGraphRequest(`/me/chats/${chatId}/messages`, {
      method: 'POST',
      body: JSON.stringify(message),
    }) as {
      id?: string;
      createdDateTime?: string;
      messageType?: string;
    };

    return {
      id: result.id || '',
      createdDateTime: result.createdDateTime || new Date().toISOString(),
      messageType: result.messageType || 'message',
    };
  }

  private async readChatMessages(inputs: ActionInput): Promise<ActionOutput> {
    const { chatId, top = 20 } = inputs as {
      chatId: string;
      top?: number;
    };

    const endpoint = `/me/chats/${chatId}/messages?$top=${top}&$orderby=createdDateTime desc`;
    const result = await this.makeGraphRequest(endpoint) as {
      value?: Array<{
        id: string;
        createdDateTime: string;
        body: { contentType: string; content: string };
        from: { user?: { displayName: string; id: string } };
        messageType: string;
      }>;
    };

    return {
      messages: (result.value || []).map(message => ({
        id: message.id,
        createdDateTime: message.createdDateTime,
        body: message.body,
        from: message.from,
        messageType: message.messageType,
      })),
    };
  }
}
