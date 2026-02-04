# Office365 Integration Enhancement Plan

## Overview

This document outlines the plan to enhance the Office365 integration with comprehensive email reading, calendar review, and Microsoft To Do task management capabilities that can be used by skills in our application.

## Current State

### Existing Features

- ✅ OAuth connection flow (`/api/integrations/office365/connect` and `/callback`)
- ✅ Basic email sending (`send_email` action)
- ✅ Basic email reading (`read_emails` action) - limited functionality
- ✅ Basic calendar event retrieval (`get_calendar_events` action)
- ✅ Calendar event creation (`create_calendar_event` action)
- ✅ User profile retrieval (`get_user_profile` action)

### Current Scopes

- `Mail.Send` - Send emails
- `Mail.Read` - Read emails
- `Calendars.ReadWrite` - Read and write calendar events
- `User.Read` - Read user profile

## Planned Enhancements

### 1. Enhanced Email Reading

#### Current Limitations

- Only returns basic fields (id, subject, from, receivedDateTime, bodyPreview)
- Limited filtering options
- No support for reading specific email by ID
- No support for attachments
- No support for email folders/labels

#### Enhancements Needed

**New Actions:**

- `get_email` - Get a specific email by ID with full body content
- `list_email_folders` - List available email folders (Inbox, Sent, Drafts, etc.)
- `read_emails_from_folder` - Read emails from a specific folder
- `search_emails` - Advanced email search with multiple criteria
- `get_email_attachments` - List and download email attachments

**Enhanced `read_emails` action:**

- Support for reading from specific folders
- Better filtering (by sender, subject, date range, has attachments)
- Include full body content option
- Pagination support
- Sort options (date, sender, subject, importance)

**Required Scopes:**

- `Mail.Read` (already have)
- `Mail.ReadBasic` (optional, for read-only access)

### 2. Enhanced Calendar Review

#### Current Limitations

- Basic event retrieval only
- Limited filtering
- No support for recurring events details
- No support for event attendees details
- No support for multiple calendars
- No support for free/busy information

#### Enhancements Needed

**New Actions:**

- `get_calendar` - Get calendar details by ID
- `list_calendars` - List all available calendars
- `get_calendar_event` - Get specific event with full details
- `update_calendar_event` - Update existing calendar event
- `delete_calendar_event` - Delete calendar event
- `get_free_busy` - Get free/busy information for time ranges
- `find_meeting_times` - Find available meeting times
- `get_calendar_view` - Get calendar view (day/week/month)

**Enhanced `get_calendar_events` action:**

- Better filtering (by attendees, location, categories)
- Include full event details (attendees, body, attachments)
- Support for recurring event instances
- Timezone handling
- Include cancelled events option

**Required Scopes:**

- `Calendars.ReadWrite` (already have)
- `Calendars.Read` (optional, for read-only access)

### 3. Microsoft To Do Integration (NEW)

#### Overview

Microsoft To Do API allows managing tasks organized in task lists. Tasks sync across Microsoft To Do, Outlook, and Teams.

#### Required Scopes

- `Tasks.ReadWrite` - Read and write tasks (delegated)
- `Tasks.Read` - Read-only access (optional)

#### New Actions

**Task Lists:**

- `list_todo_lists` - List all available task lists
- `get_todo_list` - Get specific task list details
- `create_todo_list` - Create a new task list
- `update_todo_list` - Update task list (name, etc.)
- `delete_todo_list` - Delete a task list

**Tasks:**

- `list_todo_tasks` - List tasks from a task list
- `get_todo_task` - Get specific task details
- `create_todo_task` - Create a new task
- `update_todo_task` - Update task (title, due date, status, etc.)
- `delete_todo_task` - Delete a task
- `complete_todo_task` - Mark task as completed
- `add_todo_task_checklist` - Add checklist items to a task

**Task Properties Supported:**

- Title, notes, due date, reminder date
- Status (notStarted, inProgress, completed, waitingOnOthers, deferred)
- Importance (low, normal, high)
- Categories (tags)
- Checklist items (subtasks)
- File attachments (beta API)

## Implementation Plan

### Phase 1: Enhanced Email Reading (Week 1)

1. **Update Office365Adapter**
   - Enhance `readEmails()` method with better filtering
   - Add `getEmail()` method for single email retrieval
   - Add `listEmailFolders()` method
   - Add `readEmailsFromFolder()` method
   - Add `searchEmails()` method with advanced query support
   - Add `getEmailAttachments()` method

2. **Update Action Definitions**
   - Update `read_emails` action schema with new parameters
   - Add new action definitions for email operations
   - Update input/output schemas

3. **Testing**
   - Test with various email scenarios
   - Test folder navigation
   - Test attachment handling

### Phase 2: Enhanced Calendar Review (Week 1-2)

1. **Update Office365Adapter**
   - Enhance `getCalendarEvents()` with better filtering
   - Add `listCalendars()` method
   - Add `getCalendarEvent()` method for single event
   - Add `updateCalendarEvent()` method
   - Add `deleteCalendarEvent()` method
   - Add `getFreeBusy()` method
   - Add `findMeetingTimes()` method
   - Add `getCalendarView()` method

2. **Update Action Definitions**
   - Update `get_calendar_events` action schema
   - Add new calendar action definitions
   - Update input/output schemas

3. **Testing**
   - Test with various calendar scenarios
   - Test recurring events
   - Test free/busy queries

### Phase 3: Microsoft To Do Integration (Week 2)

1. **Add To Do Scopes**
   - Update OAuth connect flow to include `Tasks.ReadWrite` scope
   - Update callback handler if needed

2. **Implement To Do Methods in Office365Adapter**
   - `listTodoLists()` - GET `/me/todo/lists`
   - `getTodoList()` - GET `/me/todo/lists/{id}`
   - `createTodoList()` - POST `/me/todo/lists`
   - `updateTodoList()` - PATCH `/me/todo/lists/{id}`
   - `deleteTodoList()` - DELETE `/me/todo/lists/{id}`
   - `listTodoTasks()` - GET `/me/todo/lists/{listId}/tasks`
   - `getTodoTask()` - GET `/me/todo/lists/{listId}/tasks/{taskId}`
   - `createTodoTask()` - POST `/me/todo/lists/{listId}/tasks`
   - `updateTodoTask()` - PATCH `/me/todo/lists/{listId}/tasks/{taskId}`
   - `deleteTodoTask()` - DELETE `/me/todo/lists/{listId}/tasks/{taskId}`
   - `completeTodoTask()` - PATCH with status update

3. **Add Action Definitions**
   - Add all To Do action definitions to `getActions()`
   - Define proper input/output schemas

4. **Update executeAction()**
   - Add cases for all To Do actions

5. **Testing**
   - Test task list operations
   - Test task CRUD operations
   - Test task completion
   - Test checklist items

### Phase 4: Skills Integration (Week 2-3)

1. **Create Tools (Optional)**
   - Consider creating tools that wrap Office365 actions for easier skill usage
   - Tools can provide higher-level abstractions

2. **Documentation**
   - Document all new actions
   - Create examples for common use cases
   - Update integration documentation

3. **Example Skills**
   - Create example skills that use these features:
     - "Summarize my inbox" - reads and summarizes emails
     - "Check my calendar" - reviews upcoming events
     - "Add task from email" - extracts action items from emails and creates tasks
     - "Schedule meeting" - finds time and creates calendar event

## Technical Details

### Microsoft Graph API Endpoints

#### Email Endpoints

- `GET /me/messages` - List messages
- `GET /me/messages/{id}` - Get specific message
- `GET /me/mailFolders` - List folders
- `GET /me/mailFolders/{id}/messages` - Messages in folder
- `GET /me/messages/{id}/attachments` - Message attachments
- `GET /me/messages?$search="query"` - Search messages

#### Calendar Endpoints

- `GET /me/calendars` - List calendars
- `GET /me/calendars/{id}` - Get calendar
- `GET /me/calendar/events` - List events
- `GET /me/calendar/events/{id}` - Get event
- `PATCH /me/calendar/events/{id}` - Update event
- `DELETE /me/calendar/events/{id}` - Delete event
- `GET /me/calendar/getSchedule` - Free/busy
- `POST /me/calendar/findMeetingTimes` - Find meeting times
- `GET /me/calendar/calendarView` - Calendar view

#### To Do Endpoints

- `GET /me/todo/lists` - List task lists
- `POST /me/todo/lists` - Create task list
- `GET /me/todo/lists/{id}` - Get task list
- `PATCH /me/todo/lists/{id}` - Update task list
- `DELETE /me/todo/lists/{id}` - Delete task list
- `GET /me/todo/lists/{listId}/tasks` - List tasks
- `POST /me/todo/lists/{listId}/tasks` - Create task
- `GET /me/todo/lists/{listId}/tasks/{taskId}` - Get task
- `PATCH /me/todo/lists/{listId}/tasks/{taskId}` - Update task
- `DELETE /me/todo/lists/{listId}/tasks/{taskId}` - Delete task

### Error Handling

All methods should:

- Handle token expiration and refresh automatically
- Return user-friendly error messages
- Log errors for debugging (without sensitive data)
- Handle rate limiting (429 responses)

### Security Considerations

- All credentials encrypted at rest
- Tokens refreshed automatically
- No sensitive data in logs
- Proper scope validation
- User can only access their own data

## Success Criteria

- [ ] Users can read emails with advanced filtering
- [ ] Users can navigate email folders
- [ ] Users can retrieve full email content and attachments
- [ ] Users can review calendars with detailed event information
- [ ] Users can manage calendar events (create, update, delete)
- [ ] Users can check free/busy status
- [ ] Users can create and manage To Do tasks
- [ ] Users can organize tasks in lists
- [ ] All actions work within workflows
- [ ] All actions are accessible via skills
- [ ] Comprehensive error handling
- [ ] Proper audit logging

## Future Enhancements (Post-MVP)

- Email composition with rich formatting
- Calendar event responses (accept/decline/tentative)
- Task file attachments
- Task assignments to other users
- Email rules and filters
- Calendar sharing
- Integration with other Microsoft services (OneDrive, SharePoint)

## References

- [Microsoft Graph API Documentation](https://learn.microsoft.com/en-us/graph/overview)
- [Mail API Reference](https://learn.microsoft.com/en-us/graph/api/resources/mail-api-overview)
- [Calendar API Reference](https://learn.microsoft.com/en-us/graph/api/resources/calendar)
- [To Do API Reference](https://learn.microsoft.com/en-us/graph/api/resources/todo-overview)
- [OAuth Scopes](https://learn.microsoft.com/en-us/graph/permissions-reference)
