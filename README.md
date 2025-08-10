# MCP Mail Organizer

A Model Context Protocol (MCP) server that provides unified mail operations with atomic tools for organizing and managing your email efficiently.

## Features

- **Mailbox Management**: List, create mailboxes/folders
- **Email Search**: Search emails with multiple criteria (from, to, subject, date ranges, flags, etc.)
- **Email Operations**: Get detailed email information, move emails, delete emails
- **Flag Management**: Mark emails as read/unread, add/remove custom flags
- **Email Sending**: Send emails with text/HTML content and attachments
- **Safety**: Preview mode for destructive operations (delete, move)

## Installation

### Global Installation (Recommended)

```bash
npm install -g mcp-mail-organizer
```

### Local Installation

1. Clone the repository:
```bash
git clone https://github.com/neomody77/mcp-mail-organizer.git
cd mcp-mail-organizer
npm install
npm run build
```

2. Create environment file:
```bash
cp .env.example .mail.env
```

3. Configure your email credentials in `.mail.env`:
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your.email@gmail.com
SMTP_PASS=your-app-specific-password

IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_SECURE=true
IMAP_USER=your.email@gmail.com
IMAP_PASS=your-app-specific-password
```

## Usage with Claude Code

### Global Installation Usage

Add to your Claude Code `.mcp.json` file:

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

### Local Installation Usage

```json
{
  "mcpServers": {
    "mail-organizer": {
      "command": "node",
      "args": ["./mcp-mail-organizer/dist/index.js", "--env-file", ".mail.env"],
      "cwd": ".",
      "env": {}
    }
  }
}
```

## Available Tools

### Mailbox Management
- `list_mailboxes`: List all available mailboxes/folders
- `create_mailbox`: Create a new mailbox/folder

### Email Search & Retrieval
- `search_emails`: Search emails with criteria (from, to, subject, date ranges, flags)
- `get_email`: Get detailed information about a specific email

### Email Operations
- `move_emails`: Move emails to another mailbox
- `delete_emails`: Delete emails permanently (with preview mode)
- `mark_seen`: Mark emails as read or unread
- `add_flags`: Add flags to emails
- `remove_flags`: Remove flags from emails

### Email Sending
- `send_mail`: Send an email with text/HTML content and optional attachments

## Example Usage

### Search for unread emails
```json
{
  "name": "search_emails",
  "arguments": {
    "unreadOnly": true,
    "sinceDays": 7,
    "limit": 10
  }
}
```

### Move emails to folder
```json
{
  "name": "move_emails", 
  "arguments": {
    "uids": [123, 456],
    "destination": "Archive/2025"
  }
}
```

### Send email
```json
{
  "name": "send_mail",
  "arguments": {
    "to": "recipient@example.com",
    "subject": "Test Subject",
    "text": "Hello from MCP Mail Organizer!"
  }
}
```

## Safety Features

- **Preview Mode**: Destructive operations (delete, bulk move) default to preview mode
- **Batch Limits**: Large operations are recommended to be chunked (≤ 200 messages per batch)
- **Fallback Support**: Automatic fallback from MOVE to COPY+DELETE if server doesn't support MOVE
- **Environment Security**: All credentials stored in `.env` files, not in configuration

## Email Provider Setup

### Gmail
1. Enable 2-factor authentication
2. Generate an app-specific password
3. Use IMAP settings:
   - IMAP: imap.gmail.com:993 (SSL)
   - SMTP: smtp.gmail.com:587 (STARTTLS)

### Outlook/Hotmail
1. Enable IMAP in Outlook settings
2. Use IMAP settings:
   - IMAP: outlook.office365.com:993 (SSL)
   - SMTP: smtp-mail.outlook.com:587 (STARTTLS)

### 139.com (China Mobile)
1. Enable IMAP/SMTP in webmail settings
2. Login to webmail.139.com → Settings → Enable IMAP/SMTP
3. Use IMAP settings:
   - IMAP: imap.139.com:993 (SSL)
   - SMTP: smtp.139.com:587 (STARTTLS)

### QQ Mail
1. Generate authorization code in QQ Mail settings
2. Use IMAP settings:
   - IMAP: imap.qq.com:993 (SSL)
   - SMTP: smtp.qq.com:587 (STARTTLS)

## Troubleshooting

The server includes comprehensive debug logging. If you encounter issues:

1. **Environment Variables**: The server validates all required variables on startup
2. **Connection Testing**: Automatically tests SMTP/IMAP connections
3. **Debug Output**: Detailed logging shows exactly where failures occur
4. **Preview Mode**: Destructive operations show preview by default

## Development

```bash
npm run dev    # Watch mode for development
npm run build  # Build TypeScript
npm start      # Start production server
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Repository

- **GitHub**: [https://github.com/neomody77/mcp-mail-organizer](https://github.com/neomody77/mcp-mail-organizer)
- **NPM**: [mcp-mail-organizer](https://www.npmjs.com/package/mcp-mail-organizer)

## License

MIT