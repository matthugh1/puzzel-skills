# Office365 Enhancement Implementation Checklist

## Quick Start

This checklist provides step-by-step implementation guidance for enhancing the Office365 integration.

## Phase 1: Enhanced Email Reading

### Step 1.1: Update OAuth Scopes (if needed)

- [ ] Verify current scopes include `Mail.Read`
- [ ] Test OAuth flow still works

### Step 1.2: Enhance Email Methods

- [ ] Update `readEmails()` in `src/lib/integrations/office365.ts`
  - [ ] Add folder parameter support
  - [ ] Add better filtering options
  - [ ] Add pagination support
  - [ ] Add full body content option
- [ ] Add `getEmail(id: string)` method
  - [ ] GET `/me/messages/{id}`
  - [ ] Return full email with body
- [ ] Add `listEmailFolders()` method
  - [ ] GET `/me/mailFolders`
  - [ ] Return folder list with IDs
- [ ] Add `readEmailsFromFolder(folderId: string, ...)` method
  - [ ] GET `/me/mailFolders/{folderId}/messages`
- [ ] Add `searchEmails(query: string, ...)` method
  - [ ] GET `/me/messages?$search="{query}"`
- [ ] Add `getEmailAttachments(emailId: string)` method
  - [ ] GET `/me/messages/{emailId}/attachments`

### Step 1.3: Update Action Definitions

- [ ] Update `read_emails` action in `getActions()`
  - [ ] Add folderId parameter
  - [ ] Add includeBody parameter
  - [ ] Add better filter options
- [ ] Add `get_email` action definition
- [ ] Add `list_email_folders` action definition
- [ ] Add `read_emails_from_folder` action definition
- [ ] Add `search_emails` action definition
- [ ] Add `get_email_attachments` action definition

### Step 1.4: Update executeAction()

- [ ] Add cases for new email actions
- [ ] Test each action

### Step 1.5: Testing

- [ ] Test reading emails from inbox
- [ ] Test reading emails from specific folder
- [ ] Test getting single email
- [ ] Test searching emails
- [ ] Test getting attachments
- [ ] Test error handling

## Phase 2: Enhanced Calendar Review

### Step 2.1: Enhance Calendar Methods

- [ ] Update `getCalendarEvents()` method
  - [ ] Add better filtering
  - [ ] Add include details option
  - [ ] Add timezone support
- [ ] Add `listCalendars()` method
  - [ ] GET `/me/calendars`
- [ ] Add `getCalendarEvent(eventId: string)` method
  - [ ] GET `/me/calendar/events/{eventId}`
- [ ] Add `updateCalendarEvent(eventId: string, updates: object)` method
  - [ ] PATCH `/me/calendar/events/{eventId}`
- [ ] Add `deleteCalendarEvent(eventId: string)` method
  - [ ] DELETE `/me/calendar/events/{eventId}`
- [ ] Add `getFreeBusy(startTime: string, endTime: string, ...)` method
  - [ ] POST `/me/calendar/getSchedule`
- [ ] Add `findMeetingTimes(...)` method
  - [ ] POST `/me/calendar/findMeetingTimes`
- [ ] Add `getCalendarView(startDate: string, endDate: string)` method
  - [ ] GET `/me/calendar/calendarView`

### Step 2.2: Update Action Definitions

- [ ] Update `get_calendar_events` action schema
- [ ] Add `list_calendars` action definition
- [ ] Add `get_calendar_event` action definition
- [ ] Add `update_calendar_event` action definition
- [ ] Add `delete_calendar_event` action definition
- [ ] Add `get_free_busy` action definition
- [ ] Add `find_meeting_times` action definition
- [ ] Add `get_calendar_view` action definition

### Step 2.3: Update executeAction()

- [ ] Add cases for new calendar actions
- [ ] Test each action

### Step 2.4: Testing

- [ ] Test listing calendars
- [ ] Test getting calendar events
- [ ] Test updating events
- [ ] Test deleting events
- [ ] Test free/busy queries
- [ ] Test finding meeting times
- [ ] Test calendar view

## Phase 3: Microsoft To Do Integration

### Step 3.1: Update OAuth Scopes

- [ ] Add `Tasks.ReadWrite` scope to connect route
  - [ ] Update `src/app/api/integrations/office365/connect/route.ts`
  - [ ] Add scope to scopes array
- [ ] Test OAuth flow with new scope

### Step 3.2: Implement To Do Methods

- [ ] Add `listTodoLists()` method
  - [ ] GET `/me/todo/lists`
- [ ] Add `getTodoList(listId: string)` method
  - [ ] GET `/me/todo/lists/{listId}`
- [ ] Add `createTodoList(name: string)` method
  - [ ] POST `/me/todo/lists`
- [ ] Add `updateTodoList(listId: string, updates: object)` method
  - [ ] PATCH `/me/todo/lists/{listId}`
- [ ] Add `deleteTodoList(listId: string)` method
  - [ ] DELETE `/me/todo/lists/{listId}`
- [ ] Add `listTodoTasks(listId: string, ...)` method
  - [ ] GET `/me/todo/lists/{listId}/tasks`
- [ ] Add `getTodoTask(listId: string, taskId: string)` method
  - [ ] GET `/me/todo/lists/{listId}/tasks/{taskId}`
- [ ] Add `createTodoTask(listId: string, task: object)` method
  - [ ] POST `/me/todo/lists/{listId}/tasks`
- [ ] Add `updateTodoTask(listId: string, taskId: string, updates: object)` method
  - [ ] PATCH `/me/todo/lists/{listId}/tasks/{taskId}`
- [ ] Add `deleteTodoTask(listId: string, taskId: string)` method
  - [ ] DELETE `/me/todo/lists/{listId}/tasks/{taskId}`
- [ ] Add `completeTodoTask(listId: string, taskId: string)` method
  - [ ] PATCH with status: 'completed'

### Step 3.3: Add Action Definitions

- [ ] Add `list_todo_lists` action definition
- [ ] Add `get_todo_list` action definition
- [ ] Add `create_todo_list` action definition
- [ ] Add `update_todo_list` action definition
- [ ] Add `delete_todo_list` action definition
- [ ] Add `list_todo_tasks` action definition
- [ ] Add `get_todo_task` action definition
- [ ] Add `create_todo_task` action definition
- [ ] Add `update_todo_task` action definition
- [ ] Add `delete_todo_task` action definition
- [ ] Add `complete_todo_task` action definition

### Step 3.4: Update executeAction()

- [ ] Add cases for all To Do actions
- [ ] Test each action

### Step 3.5: Testing

- [ ] Test listing task lists
- [ ] Test creating task list
- [ ] Test updating task list
- [ ] Test deleting task list
- [ ] Test listing tasks
- [ ] Test creating task
- [ ] Test updating task (title, due date, status)
- [ ] Test completing task
- [ ] Test deleting task
- [ ] Test error handling

## Phase 4: Integration & Documentation

### Step 4.1: Update Integration Registry

- [ ] Verify `office365` is properly registered
- [ ] Update integration description if needed

### Step 4.2: API Route Updates

- [ ] Verify `/api/integrations/[app]/actions` route includes office365
  - [ ] Update `src/app/api/integrations/[app]/actions/route.ts` if needed
  - [ ] Add 'office365' to allowed apps

### Step 4.3: Create Example Skills (Optional)

- [ ] Create "Summarize Inbox" skill
- [ ] Create "Check Calendar" skill
- [ ] Create "Add Task from Email" skill
- [ ] Create "Schedule Meeting" skill

### Step 4.4: Documentation

- [ ] Update integration documentation
- [ ] Document all new actions
- [ ] Create usage examples
- [ ] Document OAuth scopes required

### Step 4.5: Final Testing

- [ ] Test complete OAuth flow
- [ ] Test all actions in workflows
- [ ] Test error scenarios
- [ ] Test token refresh
- [ ] Performance testing

## Code Locations Reference

### Main Files to Modify

- `src/lib/integrations/office365.ts` - Main adapter implementation
- `src/app/api/integrations/office365/connect/route.ts` - OAuth connect
- `src/app/api/integrations/office365/callback/route.ts` - OAuth callback
- `src/app/api/integrations/[app]/actions/route.ts` - List actions API

### Testing Files

- Create test files in `test/` directory for integration tests

## Notes

- Always test OAuth flow after adding new scopes
- Ensure token refresh works for all new endpoints
- Handle rate limiting (429 responses) gracefully
- Never log sensitive data (tokens, email content in logs)
- Use proper TypeScript types for all inputs/outputs
- Follow existing code patterns in the adapter
