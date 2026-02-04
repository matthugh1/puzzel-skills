# Office 365 Integration Setup Guide

This guide walks you through setting up the Office 365 integration step by step.

## Prerequisites

- An Office 365 business account (or personal Microsoft account)
- Access to Azure Portal (https://portal.azure.com)
- Admin permissions to register apps (or ask your IT admin)

## Step 1: Register Your Application in Azure Portal

1. **Go to Azure Portal**
   - Navigate to: https://portal.azure.com
   - Sign in with your Office 365 business account

2. **Open App Registrations**
   - In the search bar at the top, type "App registrations"
   - Click on "App registrations" from the results
   - Or go directly to: https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade

3. **Create New Registration**
   - Click the "+ New registration" button at the top
   - Fill in the form:
     - **Name**: `Skills Library Office 365 Integration` (or any name you prefer)
     - **Supported account types**:
       - For business accounts only: Select "Accounts in this organizational directory only"
       - For both business + personal accounts: Select "Accounts in any organizational directory and personal Microsoft accounts" (recommended)
     - **Redirect URI**: Leave blank for now (we'll add it next)
   - Click "Register"

4. **Copy Your Application (Client) ID**
   - After registration, you'll see the Overview page
   - Copy the **Application (client) ID** - you'll need this for `OFFICE365_CLIENT_ID`
   - Keep this page open or note down the ID

## Step 2: Configure Authentication (Redirect URI)

1. **Go to Authentication Settings**
   - In the left sidebar, click "Authentication"
   - Scroll down to "Platform configurations"

2. **Add a Web Platform**
   - Click "+ Add a platform"
   - Select "Web"

3. **Configure Redirect URI**
   - **Redirect URIs**: Add your callback URL
     - For local development: `http://localhost:3000/api/integrations/office365/callback`
     - For production: `https://yourdomain.com/api/integrations/office365/callback`
   - **Front-channel logout URL**: Leave blank (optional)
   - Click "Configure"

4. **Save Changes**
   - The redirect URI should now appear in your platform configurations

## Step 3: Configure API Permissions

1. **Go to API Permissions**
   - In the left sidebar, click "API permissions"

2. **Add Microsoft Graph Permissions**
   - Click "+ Add a permission"
   - Select "Microsoft Graph"
   - Choose "Delegated permissions" (not Application permissions)

3. **Select Required Permissions**
   - Search for and select each of these permissions:
     - `Mail.Send` - Send email
     - `Mail.Read` - Read email
     - `Calendars.ReadWrite` - Read and write calendar events
     - `User.Read` - Read user profile
   - Click "Add permissions"

4. **Grant Admin Consent (if required)**
   - If you see a yellow warning banner, your organization requires admin consent
   - Click "Grant admin consent for [Your Organization]"
   - Confirm the action
   - If you don't have admin rights, contact your IT administrator

## Step 4: Create Client Secret

1. **Go to Certificates & Secrets**
   - In the left sidebar, click "Certificates & secrets"

2. **Create New Client Secret**
   - Click "+ New client secret"
   - Fill in:
     - **Description**: `Skills Library Integration Secret` (or any description)
     - **Expires**: Choose an expiration (6 months, 12 months, or 24 months)
   - Click "Add"

3. **Copy the Secret Value Immediately**
   - ⚠️ **IMPORTANT**: Copy the **Value** (not the Secret ID) right away
   - The value will only be shown once and cannot be retrieved later
   - This is your `OFFICE365_CLIENT_SECRET`
   - Store it securely (you'll add it to `.env.local` next)

## Step 5: Find Your Tenant ID (Optional)

1. **Go to Microsoft Entra ID**
   - In the Azure Portal search bar, type "Microsoft Entra ID"
   - Click on it from the results

2. **Copy Tenant ID**
   - On the Overview page, find "Tenant ID"
   - Copy the GUID (looks like: `12345678-1234-1234-1234-123456789abc`)
   - This is your `OFFICE365_TENANT_ID`
   - **Note**: You can also use `"common"` to support all account types

## Step 6: Configure Environment Variables

1. **Open Your `.env.local` File**
   - In your project root, open or create `.env.local`

2. **Add Office 365 Configuration**

   ```bash
   # Office 365 Integration
   OFFICE365_CLIENT_ID="your-application-client-id-here"
   OFFICE365_CLIENT_SECRET="your-client-secret-value-here"
   OFFICE365_TENANT_ID="common"
   # Or use your specific tenant ID: OFFICE365_TENANT_ID="12345678-1234-1234-1234-123456789abc"
   OFFICE365_REDIRECT_URI="http://localhost:3000/api/integrations/office365/callback"
   ```

3. **Fill in the Values**
   - `OFFICE365_CLIENT_ID`: Paste the Application (client) ID from Step 1
   - `OFFICE365_CLIENT_SECRET`: Paste the secret Value from Step 4
   - `OFFICE365_TENANT_ID`: Use `"common"` (recommended) or your specific tenant ID
   - `OFFICE365_REDIRECT_URI`: Match exactly what you configured in Step 2

4. **Save the File**
   - Make sure `.env.local` is in your `.gitignore` (it should be by default)
   - Never commit this file to version control!

## Step 7: Restart Your Development Server

1. **Stop Your Server**
   - If your Next.js dev server is running, stop it (Ctrl+C or Cmd+C)

2. **Restart the Server**

   ```bash
   pnpm dev
   # or
   npm run dev
   ```

3. **Verify Environment Variables Loaded**
   - Check the console for any errors
   - The server should start normally

## Step 8: Test the Integration

1. **Initiate OAuth Flow**
   - In your application, navigate to the integrations page
   - Click "Connect Office 365" or similar button
   - This will call `/api/integrations/office365/connect`

2. **Authorize the Application**
   - You'll be redirected to Microsoft's login page
   - Sign in with your Office 365 account
   - Review the permissions requested
   - Click "Accept" or "Consent"

3. **Verify Connection**
   - You should be redirected back to your app
   - Check that the integration status shows "Connected"
   - Try using one of the Office 365 actions (send email, read calendar, etc.)

## Troubleshooting

### Error: "Office 365 OAuth not configured"

- **Solution**: Check that all environment variables are set in `.env.local`
- Make sure you copied the **Value** (not Secret ID) for `OFFICE365_CLIENT_SECRET`
- Restart your development server after adding environment variables

### Error: "invalid_client" or "invalid_client_credentials"

- **Solution**:
  - Verify `OFFICE365_CLIENT_ID` matches the Application (client) ID exactly
  - Verify `OFFICE365_CLIENT_SECRET` is the secret **Value** (not the Secret ID)
  - Check if the client secret has expired (create a new one if needed)

### Error: "redirect_uri_mismatch"

- **Solution**:
  - Ensure the redirect URI in Azure Portal exactly matches `OFFICE365_REDIRECT_URI`
  - Check for trailing slashes, http vs https, and port numbers
  - The redirect URI must match character-for-character

### Error: "insufficient_privileges" or Admin Consent Required

- **Solution**:
  - Go to Azure Portal > Your App > API Permissions
  - Click "Grant admin consent for [Your Organization]"
  - If you don't have admin rights, contact your IT administrator

### Error: "AADSTS50020: User account not found"

- **Solution**:
  - Verify you're using the correct account type
  - If using `OFFICE365_TENANT_ID="common"`, make sure your app registration supports the account type you're trying to use
  - Check "Supported account types" in Authentication settings

### Can't Register Apps in Azure Portal

- **Solution**:
  - You may need admin permissions
  - Contact your IT administrator to:
    - Register the app for you, OR
    - Grant you "Cloud Application Administrator" role

## Security Best Practices

1. **Never Commit Secrets**
   - Always use `.env.local` for local development
   - Use environment variables in production (Vercel, AWS, etc.)
   - Never commit `.env.local` to git

2. **Rotate Secrets Regularly**
   - Set client secrets to expire (6-12 months recommended)
   - Create new secrets before old ones expire
   - Update `OFFICE365_CLIENT_SECRET` in your environment

3. **Use Least Privilege**
   - Only request the permissions you actually need
   - Review permissions periodically

4. **Monitor Usage**
   - Check Azure Portal > Your App > Sign-in logs
   - Monitor for suspicious activity

## Next Steps

Once the integration is set up, you can:

- Use Office 365 actions in workflows:
  - `send_email` - Send emails via Outlook
  - `read_emails` - Read emails from inbox
  - `get_calendar_events` - Get calendar events
  - `create_calendar_event` - Create calendar events
  - `get_user_profile` - Get user profile information

- Test the integration by creating a workflow that uses Office 365 actions

## Additional Resources

- [Microsoft Graph API Documentation](https://docs.microsoft.com/en-us/graph/overview)
- [Azure Portal App Registrations](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
- [Microsoft Identity Platform Documentation](https://learn.microsoft.com/en-us/entra/identity-platform/)
