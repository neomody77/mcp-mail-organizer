# MCP Mail Organizer Setup Guide

## ✅ Current Status
- **Project Structure**: Complete
- **Dependencies**: Installed and built 
- **Environment**: Configured for 139.com email service
- **Credentials**: Copied from existing project

## Configuration Summary
```
SMTP: smtp.139.com:587 (STARTTLS)
IMAP: imap.139.com:993 (SSL/TLS) 
User: your-email@139.com
```

## Claude Code Integration

### Option 1: Global Installation (Recommended)
Install globally and use in your `~/.config/claude-code/.mcp.json`:

```bash
npm install -g mcp-mail-organizer
```

```json
{
  "mcpServers": {
    "mail-organizer": {
      "command": "mcp-mail-organizer",
      "args": ["--env-file", ".mail.env"],
      "cwd": ".",
      "env": {}
    }
  }
}
```

### Option 2: Local Installation
For local development, use:

```json
{
  "mcpServers": {
    "mail-organizer": {
      "command": "node",
      "args": ["dist/index.js", "--env-file", ".mail.env"],
      "cwd": "/Users/mira/net/Assistant/mcp-mail-organizer",
      "env": {}
    }
  }
}
```

### Option 3: Project-Specific Configuration
Use the local `.mcp.json` file already created in the project directory.

## Available Tools

Once integrated, you can use natural language commands like:

- **"List my mailbox folders"** → `list_mailboxes`
- **"Find unread emails from the past week"** → `search_emails`
- **"Show me email details for UID 123"** → `get_email` 
- **"Move these emails to Archive folder"** → `move_emails`
- **"Mark emails as read"** → `mark_seen`
- **"Send an email to someone"** → `send_mail`

## Testing

To verify everything works:

1. **Start the server manually**:
   ```bash
   npm start
   ```
   Should run without errors about missing environment variables.

2. **Test with Claude Code**:
   After adding the MCP configuration, restart Claude Code and try:
   ```
   "List all my email folders"
   ```

## Security Notes

- ✅ Credentials are stored in `.env` (not in version control)
- ✅ Preview mode enabled for destructive operations
- ✅ Environment validation on startup
- ✅ Proper error handling and logging

## Troubleshooting

If you get connection errors:
1. Verify 139.com IMAP/SMTP is enabled in webmail settings
2. Check firewall/network connectivity
3. Try the old project to confirm credentials still work
4. Check the service logs: `npm start` and look for specific error messages

The server is ready to use! 🚀