import nodemailer from 'nodemailer';
import Imap from 'imap';
import { simpleParser } from 'mailparser';

export interface MailConfig {
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
  imap: {
    host: string;
    port: number;
    tls: boolean;
    user: string;
    password: string;
  };
}

export interface EmailSummary {
  uid: number;
  subject: string;
  from: string;
  to: string;
  date: Date;
  flags: string[];
  hasAttachments?: boolean;
  size?: number;
}

export interface EmailDetails extends EmailSummary {
  textContent?: string;
  htmlContent?: string;
  attachments: AttachmentInfo[];
  headers: Record<string, string>;
}

export interface AttachmentInfo {
  filename: string;
  contentType: string;
  size: number;
  contentId?: string;
}

export interface SearchCriteria {
  mailbox?: string;
  from?: string;
  to?: string;
  subject?: string;
  body?: string;
  unreadOnly?: boolean;
  sinceDays?: number;
  beforeDays?: number;
  hasAttachments?: boolean;
  flags?: string[];
  limit?: number;
}

export class MailService {
  private transporter: nodemailer.Transporter;
  private imap: Imap;
  private config: MailConfig;
  private isConnected = false;

  constructor(config: MailConfig) {
    this.config = config;
    
    this.transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: config.smtp.auth,
    });

    this.imap = new Imap({
      host: config.imap.host,
      port: config.imap.port,
      tls: config.imap.tls,
      user: config.imap.user,
      password: config.imap.password,
      tlsOptions: { rejectUnauthorized: false },
    });

    this.setupImapHandlers();
  }

  private setupImapHandlers(): void {
    this.imap.once('ready', () => {
      this.isConnected = true;
    });

    this.imap.once('error', (err: Error) => {
      console.error('IMAP error:', err);
      this.isConnected = false;
    });

    this.imap.once('end', () => {
      this.isConnected = false;
    });
  }

  async connect(): Promise<void> {
    if (this.isConnected) return;

    return new Promise((resolve, reject) => {
      this.imap.once('ready', () => {
        this.isConnected = true;
        resolve();
      });

      this.imap.once('error', reject);
      this.imap.connect();
    });
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected) return;

    return new Promise((resolve) => {
      this.imap.once('end', resolve);
      this.imap.end();
    });
  }

  async sendMail(options: {
    to: string | string[];
    cc?: string | string[];
    bcc?: string | string[];
    subject: string;
    text?: string;
    html?: string;
    attachments?: Array<{
      filename: string;
      content: string | Buffer;
      contentType?: string;
    }>;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const info = await this.transporter.sendMail({
        from: this.config.smtp.auth.user,
        ...options,
      });

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async listMailboxes(): Promise<string[]> {
    await this.connect();

    return new Promise((resolve, reject) => {
      this.imap.getBoxes((err, boxes) => {
        if (err) reject(err);
        else {
          const boxNames: string[] = [];
          const extractBoxNames = (obj: any, prefix = '') => {
            for (const key in obj) {
              const fullName = prefix ? `${prefix}${obj[key].delimiter}${key}` : key;
              boxNames.push(fullName);
              if (obj[key].children) {
                extractBoxNames(obj[key].children, fullName);
              }
            }
          };
          extractBoxNames(boxes);
          resolve(boxNames);
        }
      });
    });
  }

  async createMailbox(name: string): Promise<void> {
    await this.connect();
    
    return new Promise((resolve, reject) => {
      this.imap.addBox(name, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async deleteMailbox(name: string): Promise<void> {
    await this.connect();
    
    return new Promise((resolve, reject) => {
      this.imap.delBox(name, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async searchEmails(criteria: SearchCriteria): Promise<EmailSummary[]> {
    await this.connect();
    
    const mailbox = criteria.mailbox || 'INBOX';
    
    return new Promise((resolve, reject) => {
      this.imap.openBox(mailbox, false, (err) => {
        if (err) return reject(err);

        const searchCriteria: any[] = [];
        
        if (criteria.unreadOnly) searchCriteria.push('UNSEEN');
        if (criteria.from) searchCriteria.push(['FROM', criteria.from]);
        if (criteria.to) searchCriteria.push(['TO', criteria.to]);
        if (criteria.subject) searchCriteria.push(['SUBJECT', criteria.subject]);
        if (criteria.body) searchCriteria.push(['BODY', criteria.body]);
        
        if (criteria.sinceDays) {
          const date = new Date();
          date.setDate(date.getDate() - criteria.sinceDays);
          searchCriteria.push(['SINCE', date.toISOString().split('T')[0]]);
        }
        
        if (criteria.beforeDays) {
          const date = new Date();
          date.setDate(date.getDate() - criteria.beforeDays);
          searchCriteria.push(['BEFORE', date.toISOString().split('T')[0]]);
        }

        if (searchCriteria.length === 0) {
          searchCriteria.push('ALL');
        }

        this.imap.search(searchCriteria, (err, uids) => {
          if (err) return reject(err);
          if (!uids || uids.length === 0) return resolve([]);

          const emails: EmailSummary[] = [];
          const fetch = this.imap.fetch(uids, {
            bodies: 'HEADER.FIELDS (FROM TO SUBJECT DATE)',
            struct: true,
          });

          fetch.on('message', (msg, seqno) => {
            const email: Partial<EmailSummary> = { uid: seqno };
            
            msg.on('body', (stream) => {
              let buffer = '';
              stream.on('data', (chunk) => buffer += chunk.toString('utf8'));
              stream.once('end', () => {
                const headers = Imap.parseHeader(buffer);
                email.subject = headers.subject?.[0] || '(No Subject)';
                email.from = headers.from?.[0] || '';
                email.to = headers.to?.[0] || '';
                const dateString = headers.date?.[0];
                if (dateString) {
                  const parsedDate = new Date(dateString);
                  email.date = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
                } else {
                  email.date = new Date();
                }
              });
            });

            msg.once('attributes', (attrs) => {
              email.uid = attrs.uid;
              email.flags = attrs.flags;
              email.size = attrs.size;
              
              if (attrs.struct) {
                email.hasAttachments = this.hasAttachments(attrs.struct);
              }
            });

            msg.once('end', () => {
              emails.push(email as EmailSummary);
            });
          });

          fetch.once('error', reject);
          fetch.once('end', () => resolve(emails));
        });
      });
    });
  }

  private hasAttachments(struct: any): boolean {
    if (Array.isArray(struct)) {
      return struct.some(part => this.hasAttachments(part));
    }
    
    if (struct.disposition && struct.disposition.type === 'attachment') {
      return true;
    }
    
    if (struct.type && struct.type !== 'text' && struct.type !== 'multipart') {
      return true;
    }
    
    return false;
  }

  async getEmailDetails(mailbox: string, uid: number): Promise<EmailDetails | null> {
    await this.connect();

    return new Promise((resolve, reject) => {
      this.imap.openBox(mailbox, false, (err) => {
        if (err) return reject(err);

        const fetch = this.imap.fetch(uid, {
          bodies: '',
          struct: true,
        });

        fetch.on('message', (msg) => {
          let rawEmail = '';
          const details: Partial<EmailDetails> = { uid };

          msg.on('body', (stream) => {
            stream.on('data', (chunk) => rawEmail += chunk.toString('utf8'));
          });

          msg.once('attributes', (attrs) => {
            details.uid = attrs.uid;
            details.flags = attrs.flags;
            details.size = attrs.size;
          });

          msg.once('end', async () => {
            try {
              const parsed = await simpleParser(rawEmail);
              
              details.subject = parsed.subject || '(No Subject)';
              if (parsed.from) {
                details.from = typeof parsed.from === 'string' 
                  ? parsed.from 
                  : Array.isArray(parsed.from) 
                    ? parsed.from.map(a => a.text || '').join(', ')
                    : parsed.from.text || '';
              } else {
                details.from = '';
              }
              if (parsed.to) {
                details.to = typeof parsed.to === 'string' 
                  ? parsed.to 
                  : Array.isArray(parsed.to) 
                    ? parsed.to.map(a => a.text || '').join(', ')
                    : parsed.to.text || '';
              } else {
                details.to = '';
              }
              details.date = parsed.date && !isNaN(parsed.date.getTime()) ? parsed.date : new Date();
              details.textContent = parsed.text;
              details.htmlContent = parsed.html || undefined;
              
              details.headers = {};
              if (parsed.headers) {
                parsed.headers.forEach((value, key) => {
                  details.headers![key] = Array.isArray(value) ? value.join(', ') : String(value);
                });
              }

              details.attachments = (parsed.attachments || []).map(att => ({
                filename: att.filename || 'unnamed',
                contentType: att.contentType || 'application/octet-stream',
                size: att.size || 0,
                contentId: att.contentId,
              }));

              resolve(details as EmailDetails);
            } catch (parseError) {
              reject(parseError);
            }
          });
        });

        fetch.once('error', reject);
        fetch.once('end', () => {
          // If no message was processed, resolve null
        });
      });
    });
  }

  async moveEmails(mailbox: string, uids: number[], destination: string): Promise<void> {
    await this.connect();

    return new Promise((resolve, reject) => {
      this.imap.openBox(mailbox, false, (err) => {
        if (err) return reject(err);

        this.imap.move(uids, destination, (err) => {
          if (err) {
            // Fallback: copy then delete
            this.imap.copy(uids, destination, (copyErr) => {
              if (copyErr) return reject(copyErr);
              
              this.imap.addFlags(uids, '\\Deleted', (flagErr) => {
                if (flagErr) return reject(flagErr);
                
                this.imap.expunge((expungeErr) => {
                  if (expungeErr) return reject(expungeErr);
                  resolve();
                });
              });
            });
          } else {
            // Move successful, but still need to expunge to ensure clean removal
            this.imap.expunge((expungeErr) => {
              if (expungeErr) {
                console.warn('Move succeeded but expunge failed:', expungeErr);
              }
              resolve();
            });
          }
        });
      });
    });
  }

  async deleteEmails(mailbox: string, uids: number[]): Promise<void> {
    await this.connect();

    return new Promise((resolve, reject) => {
      this.imap.openBox(mailbox, false, (err) => {
        if (err) return reject(err);

        this.imap.addFlags(uids, '\\Deleted', (err) => {
          if (err) return reject(err);
          
          this.imap.expunge((err) => {
            if (err) return reject(err);
            resolve();
          });
        });
      });
    });
  }

  async markSeen(mailbox: string, uids: number[], seen: boolean): Promise<void> {
    await this.connect();

    return new Promise((resolve, reject) => {
      this.imap.openBox(mailbox, false, (err) => {
        if (err) return reject(err);

        const operation = seen ? 'addFlags' : 'delFlags';
        this.imap[operation](uids, '\\Seen', (err) => {
          if (err) return reject(err);
          resolve();
        });
      });
    });
  }

  async addFlags(mailbox: string, uids: number[], flags: string[]): Promise<void> {
    await this.connect();

    return new Promise((resolve, reject) => {
      this.imap.openBox(mailbox, false, (err) => {
        if (err) return reject(err);

        this.imap.addFlags(uids, flags, (err) => {
          if (err) return reject(err);
          resolve();
        });
      });
    });
  }

  async removeFlags(mailbox: string, uids: number[], flags: string[]): Promise<void> {
    await this.connect();

    return new Promise((resolve, reject) => {
      this.imap.openBox(mailbox, false, (err) => {
        if (err) return reject(err);

        this.imap.delFlags(uids, flags, (err) => {
          if (err) return reject(err);
          resolve();
        });
      });
    });
  }

  async saveAttachments(
    mailbox: string,
    uid: number
  ): Promise<{ saved: string[]; skipped: string[] }> {
    const email = await this.getEmailDetails(mailbox, uid);
    if (!email) throw new Error('Email not found');

    const saved: string[] = [];
    const skipped: string[] = [];

    // Attachment saving implementation would go here
    // For now, returning empty arrays

    return { saved, skipped };
  }
}