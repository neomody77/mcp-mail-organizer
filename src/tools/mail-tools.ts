import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { 
  CallToolRequestSchema,
  ListToolsRequestSchema 
} from '@modelcontextprotocol/sdk/types.js';
import { MailService, MailConfig } from '../services/mail-service.js';

// Strong typing for send_mail parameters - single recipient only
interface SendMailParams {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    contentType?: string;
  }>;
}

interface ValidationError {
  field: string;
  message: string;
  receivedType: string;
  receivedValue: any;
}

export class MailTools {
  private mailService: MailService;

  private validateSendMailParams(args: any): { isValid: boolean; errors: ValidationError[]; params?: SendMailParams } {
    const errors: ValidationError[] = [];
    
    // Check required 'to' field
    if (!args.to || typeof args.to !== 'string') {
      errors.push({
        field: 'to',
        message: 'Recipient email address is required and must be a string',
        receivedType: typeof args.to,
        receivedValue: args.to
      });
    } else if (args.to.trim() === '') {
      errors.push({
        field: 'to',
        message: 'Recipient email address cannot be empty',
        receivedType: 'string',
        receivedValue: args.to
      });
    }
    
    // Reject array formats explicitly
    if (Array.isArray(args.to)) {
      errors.push({
        field: 'to',
        message: 'Multiple recipients not supported. Use single email address only.',
        receivedType: 'array',
        receivedValue: args.to
      });
    }
    
    // Check for serialized array strings (common MCP issue)
    if (typeof args.to === 'string' && args.to.startsWith('[') && args.to.endsWith(']')) {
      errors.push({
        field: 'to',
        message: 'Array format detected but not supported. Please send to one recipient at a time.',
        receivedType: 'string (array-like)',
        receivedValue: args.to
      });
    }
    
    // Check required subject field
    if (!args.subject || typeof args.subject !== 'string') {
      errors.push({
        field: 'subject',
        message: 'Subject is required and must be a string',
        receivedType: typeof args.subject,
        receivedValue: args.subject
      });
    }
    
    // Check content requirement
    if (!args.text && !args.html) {
      errors.push({
        field: 'content',
        message: 'Either text or html content is required',
        receivedType: 'undefined',
        receivedValue: { text: args.text, html: args.html }
      });
    }
    
    if (errors.length > 0) {
      return { isValid: false, errors };
    }
    
    return { 
      isValid: true, 
      errors: [],
      params: args as SendMailParams 
    };
  }

  constructor() {
    this.validateEnvironment();
    
    const config: MailConfig = {
      smtp: {
        host: process.env.SMTP_HOST!,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER!,
          pass: process.env.SMTP_PASS!,
        },
      },
      imap: {
        host: process.env.IMAP_HOST!,
        port: parseInt(process.env.IMAP_PORT || '993'),
        tls: process.env.IMAP_SECURE !== 'false',
        user: process.env.IMAP_USER!,
        password: process.env.IMAP_PASS!,
      },
    };

    this.mailService = new MailService(config);
  }

  private validateEnvironment(): void {
    const required = [
      'SMTP_HOST',
      'SMTP_USER',
      'SMTP_PASS',
      'IMAP_HOST',
      'IMAP_USER',
      'IMAP_PASS',
    ];

    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      console.error(`Missing required environment variables: ${missing.join(', ')}`);
      console.error('\nPlease create a .env file with:');
      console.error('SMTP_HOST=smtp.example.com');
      console.error('SMTP_PORT=587');
      console.error('SMTP_SECURE=true');
      console.error('SMTP_USER=your@email.com');
      console.error('SMTP_PASS=your_password');
      console.error('IMAP_HOST=imap.example.com');
      console.error('IMAP_PORT=993');
      console.error('IMAP_SECURE=true');
      console.error('IMAP_USER=your@email.com');
      console.error('IMAP_PASS=your_password');
      process.exit(1);
    }
  }

  async registerTools(server: Server): Promise<void> {
    // Register tool list handler
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'list_mailboxes',
          description: 'List all available mailboxes/folders',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'create_mailbox',
          description: 'Create a new mailbox/folder',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Mailbox name' },
            },
            required: ['name'],
          },
        },
        {
          name: 'search_emails',
          description: 'Search emails with various criteria',
          inputSchema: {
            type: 'object',
            properties: {
              mailbox: { type: 'string', default: 'INBOX' },
              from: { type: 'string' },
              to: { type: 'string' },
              subject: { type: 'string' },
              body: { type: 'string' },
              unreadOnly: { type: 'boolean' },
              sinceDays: { type: 'number' },
              beforeDays: { type: 'number' },
              hasAttachments: { type: 'boolean' },
              limit: { type: 'number', default: 50 },
            },
          },
        },
        {
          name: 'get_email',
          description: 'Get detailed information about a specific email',
          inputSchema: {
            type: 'object',
            properties: {
              mailbox: { type: 'string', default: 'INBOX' },
              uid: { type: 'number' },
            },
            required: ['uid'],
          },
        },
        {
          name: 'move_emails',
          description: 'Move emails to another mailbox',
          inputSchema: {
            type: 'object',
            properties: {
              mailbox: { type: 'string', default: 'INBOX' },
              uids: {
                type: 'array',
                items: { type: 'number' },
              },
              destination: { type: 'string' },
            },
            required: ['uids', 'destination'],
          },
        },
        {
          name: 'delete_emails',
          description: 'Delete emails permanently',
          inputSchema: {
            type: 'object',
            properties: {
              mailbox: { type: 'string', default: 'INBOX' },
              uids: {
                type: 'array',
                items: { type: 'number' },
              },
              preview: { type: 'boolean', default: true },
            },
            required: ['uids'],
          },
        },
        {
          name: 'mark_seen',
          description: 'Mark emails as read or unread',
          inputSchema: {
            type: 'object',
            properties: {
              mailbox: { type: 'string', default: 'INBOX' },
              uids: {
                type: 'array',
                items: { type: 'number' },
              },
              seen: { type: 'boolean' },
            },
            required: ['uids', 'seen'],
          },
        },
        {
          name: 'add_flags',
          description: 'Add flags to emails',
          inputSchema: {
            type: 'object',
            properties: {
              mailbox: { type: 'string', default: 'INBOX' },
              uids: {
                type: 'array',
                items: { type: 'number' },
              },
              flags: {
                type: 'array',
                items: { type: 'string' },
              },
            },
            required: ['uids', 'flags'],
          },
        },
        {
          name: 'remove_flags',
          description: 'Remove flags from emails',
          inputSchema: {
            type: 'object',
            properties: {
              mailbox: { type: 'string', default: 'INBOX' },
              uids: {
                type: 'array',
                items: { type: 'number' },
              },
              flags: {
                type: 'array',
                items: { type: 'string' },
              },
            },
            required: ['uids', 'flags'],
          },
        },
        {
          name: 'delete_mailbox',
          description: 'Delete an empty mailbox/folder (only works when mailbox is empty)',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Mailbox name to delete' },
            },
            required: ['name'],
          },
        },
        {
          name: 'list_all_emails',
          description: 'List all emails with pagination',
          inputSchema: {
            type: 'object',
            properties: {
              mailbox: { type: 'string', default: 'INBOX' },
              page: { type: 'number', default: 1, description: 'Page number (1-based)' },
              page_size: { type: 'number', default: 50, description: 'Number of emails per page' },
            },
          },
        },
        {
          name: 'send_mail',
          description: 'Send an email to a single recipient',
          inputSchema: {
            type: 'object',
            properties: {
              to: { 
                type: 'string',
                description: 'Single recipient email address'
              },
              subject: { type: 'string' },
              text: { type: 'string' },
              html: { type: 'string' },
              attachments: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    filename: { type: 'string' },
                    content: { type: 'string' },
                    contentType: { type: 'string' },
                  },
                  required: ['filename', 'content'],
                },
              },
            },
            required: ['to', 'subject'],
          },
        },
      ],
    }));

    // Register tool call handler
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'list_mailboxes':
          return await this.listMailboxes();
        
        case 'create_mailbox':
          return await this.createMailbox(args as any);
        
        case 'search_emails':
          return await this.searchEmails(args as any);
        
        case 'get_email':
          return await this.getEmail(args as any);
        
        case 'move_emails':
          return await this.moveEmails(args as any);
        
        case 'delete_emails':
          return await this.deleteEmails(args as any);
        
        case 'mark_seen':
          return await this.markSeen(args as any);
        
        case 'add_flags':
          return await this.addFlags(args as any);
        
        case 'remove_flags':
          return await this.removeFlags(args as any);
        
        case 'delete_mailbox':
          return await this.deleteMailbox(args as any);
        
        case 'list_all_emails':
          return await this.listAllEmails(args as any);
        
        case 'send_mail':
          return await this.sendMail(args as any);
        
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  private async listMailboxes() {
    try {
      const mailboxes = await this.mailService.listMailboxes();
      return {
        content: [
          {
            type: 'text',
            text: `Found ${mailboxes.length} mailboxes:\n${mailboxes.join('\n')}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error listing mailboxes: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }

  private async createMailbox(args: { name: string }) {
    try {
      await this.mailService.createMailbox(args.name);
      return {
        content: [
          {
            type: 'text',
            text: `Mailbox "${args.name}" created successfully`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error creating mailbox: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }

  private async searchEmails(args: any) {
    try {
      const emails = await this.mailService.searchEmails(args);
      
      if (emails.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: 'No emails found matching the criteria',
            },
          ],
        };
      }

      const limit = args.limit || 50;
      const limited = emails.slice(0, limit);
      
      const summary = limited.map(email => 
        `UID: ${email.uid}\n` +
        `From: ${email.from}\n` +
        `Subject: ${email.subject}\n` +
        `Date: ${email.date.toISOString()}\n` +
        `Flags: ${email.flags.join(', ')}\n` +
        `Attachments: ${email.hasAttachments ? 'Yes' : 'No'}\n`
      ).join('\n---\n');

      return {
        content: [
          {
            type: 'text',
            text: `Found ${emails.length} emails (showing ${limited.length}):\n\n${summary}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error searching emails: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }

  private async getEmail(args: { mailbox?: string; uid: number }) {
    try {
      const email = await this.mailService.getEmailDetails(
        args.mailbox || 'INBOX',
        args.uid
      );
      
      if (!email) {
        return {
          content: [
            {
              type: 'text',
              text: `Email with UID ${args.uid} not found`,
            },
          ],
        };
      }

      const details = 
        `UID: ${email.uid}\n` +
        `From: ${email.from}\n` +
        `To: ${email.to}\n` +
        `Subject: ${email.subject}\n` +
        `Date: ${email.date.toISOString()}\n` +
        `Flags: ${email.flags.join(', ')}\n` +
        `Attachments: ${email.attachments.length}\n\n` +
        `Text Content:\n${email.textContent || '(No text content)'}\n`;

      return {
        content: [
          {
            type: 'text',
            text: details,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error getting email: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }

  private async moveEmails(args: { mailbox?: string; uids: number[]; destination: string }) {
    try {
      await this.mailService.moveEmails(
        args.mailbox || 'INBOX',
        args.uids,
        args.destination
      );
      
      return {
        content: [
          {
            type: 'text',
            text: `Moved ${args.uids.length} emails to "${args.destination}"`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error moving emails: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }

  private async deleteEmails(args: { mailbox?: string; uids: number[]; preview?: boolean }) {
    try {
      if (args.preview !== false) {
        return {
          content: [
            {
              type: 'text',
              text: `PREVIEW: Would delete ${args.uids.length} emails with UIDs: ${args.uids.join(', ')}\n\nTo confirm deletion, set preview: false`,
            },
          ],
        };
      }

      await this.mailService.deleteEmails(
        args.mailbox || 'INBOX',
        args.uids
      );
      
      return {
        content: [
          {
            type: 'text',
            text: `Deleted ${args.uids.length} emails`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error deleting emails: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }

  private async markSeen(args: { mailbox?: string; uids: number[]; seen: boolean }) {
    try {
      await this.mailService.markSeen(
        args.mailbox || 'INBOX',
        args.uids,
        args.seen
      );
      
      return {
        content: [
          {
            type: 'text',
            text: `Marked ${args.uids.length} emails as ${args.seen ? 'read' : 'unread'}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error marking emails: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }

  private async addFlags(args: { mailbox?: string; uids: number[]; flags: string[] }) {
    try {
      await this.mailService.addFlags(
        args.mailbox || 'INBOX',
        args.uids,
        args.flags
      );
      
      return {
        content: [
          {
            type: 'text',
            text: `Added flags ${args.flags.join(', ')} to ${args.uids.length} emails`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error adding flags: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }

  private async removeFlags(args: { mailbox?: string; uids: number[]; flags: string[] }) {
    try {
      await this.mailService.removeFlags(
        args.mailbox || 'INBOX',
        args.uids,
        args.flags
      );
      
      return {
        content: [
          {
            type: 'text',
            text: `Removed flags ${args.flags.join(', ')} from ${args.uids.length} emails`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error removing flags: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }

  private async deleteMailbox(args: { name: string }) {
    try {
      // First check if mailbox is empty
      const emails = await this.mailService.searchEmails({
        mailbox: args.name,
        limit: 1
      });
      
      if (emails.length > 0) {
        return {
          content: [
            {
              type: 'text',
              text: `Cannot delete mailbox "${args.name}": mailbox is not empty (contains ${emails.length}+ emails)`,
            },
          ],
        };
      }

      await this.mailService.deleteMailbox(args.name);
      return {
        content: [
          {
            type: 'text',
            text: `Mailbox "${args.name}" deleted successfully`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error deleting mailbox: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }

  private async listAllEmails(args: { mailbox?: string; page?: number; page_size?: number }) {
    try {
      const mailbox = args.mailbox || 'INBOX';
      const page = args.page || 1;
      const page_size = Math.min(args.page_size || 50, 100); // Cap at 100 for performance
      
      // Get all emails (without limit first to get total count)
      const allEmails = await this.mailService.searchEmails({
        mailbox: mailbox,
        limit: 10000 // Large number to get all
      });
      
      const totalEmails = allEmails.length;
      const totalPages = Math.ceil(totalEmails / page_size);
      const startIndex = (page - 1) * page_size;
      const endIndex = Math.min(startIndex + page_size, totalEmails);
      const pageEmails = allEmails.slice(startIndex, endIndex);

      if (pageEmails.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No emails found on page ${page} of mailbox "${mailbox}"`,
            },
          ],
        };
      }

      const summary = pageEmails.map(email => 
        `UID: ${email.uid}\n` +
        `From: ${email.from}\n` +
        `Subject: ${email.subject}\n` +
        `Date: ${email.date.toISOString()}\n` +
        `Flags: ${email.flags.join(', ')}\n` +
        `Attachments: ${email.hasAttachments ? 'Yes' : 'No'}\n`
      ).join('\n---\n');

      return {
        content: [
          {
            type: 'text',
            text: `Page ${page} of ${totalPages} (${startIndex + 1}-${endIndex} of ${totalEmails} emails in "${mailbox}"):\n\n${summary}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error listing emails: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }

  private async sendMail(args: any) {
    try {
      // Validate parameters - single recipient only
      const validation = this.validateSendMailParams(args);
      
      if (!validation.isValid) {
        const errorMessages = validation.errors.map(error => 
          `❌ Field "${error.field}": ${error.message}\n   Received: ${error.receivedType} = ${JSON.stringify(error.receivedValue)}`
        ).join('\n\n');
        
        return {
          content: [
            {
              type: 'text',
              text: `❌ SEND_MAIL VALIDATION ERRORS:\n\n${errorMessages}\n\n💡 Expected format (single recipient only):\n- to: "email@domain.com" (required - single string only)\n- subject: "subject text" (required)\n- text: "message content" (optional)\n- html: "<html>content</html>" (optional)\n- attachments: array (optional)\n\n⚠️ Note: Arrays not supported. Send to one recipient at a time.`,
            },
          ],
        };
      }

      const result = await this.mailService.sendMail(validation.params!);
      
      if (result.success) {
        return {
          content: [
            {
              type: 'text',
              text: `Email sent successfully!\nMessage ID: ${result.messageId}`,
            },
          ],
        };
      } else {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to send email: ${result.error}`,
            },
          ],
        };
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error sending email: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
}