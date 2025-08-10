#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { config } from 'dotenv';
import { MailTools } from './tools/mail-tools.js';

// Parse command line arguments for custom env file
const args = process.argv.slice(2);
const envFileIndex = args.indexOf('--env-file');
const envFile = envFileIndex !== -1 && envFileIndex + 1 < args.length ? args[envFileIndex + 1] : undefined;

// Load environment variables from custom file or default .env
const envResult = config({ path: envFile });

// Debug logging for startup
console.error(`[DEBUG] Starting MCP Mail Organizer...`);
console.error(`[DEBUG] Environment file: ${envFile || '.env (default)'}`);
console.error(`[DEBUG] Working directory: ${process.cwd()}`);

if (envResult.error) {
  console.error(`[ERROR] Failed to load environment file: ${envResult.error.message}`);
  process.exit(1);
}

// Validate required environment variables
const requiredVars = [
  'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS',
  'IMAP_HOST', 'IMAP_PORT', 'IMAP_USER', 'IMAP_PASS'
];

const missingVars = requiredVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error(`[ERROR] Missing required environment variables: ${missingVars.join(', ')}`);
  console.error(`[ERROR] Please check your environment file: ${envFile || '.env'}`);
  process.exit(1);
}

console.error(`[DEBUG] Environment variables loaded successfully`);
console.error(`[DEBUG] SMTP: ${process.env.SMTP_USER}@${process.env.SMTP_HOST}:${process.env.SMTP_PORT}`);
console.error(`[DEBUG] IMAP: ${process.env.IMAP_USER}@${process.env.IMAP_HOST}:${process.env.IMAP_PORT}`);

async function main() {
  console.error('[DEBUG] Initializing MCP server...');
  
  // Test SMTP connection first
  try {
    console.error('[DEBUG] Testing SMTP connection...');
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 5000,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    
    // Add timeout to verify operation
    const verifyPromise = transporter.verify();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Connection timeout')), 5000)
    );
    
    await Promise.race([verifyPromise, timeoutPromise]);
    console.error('[DEBUG] SMTP connection successful');
  } catch (error: any) {
    console.error('[WARNING] SMTP connection failed:', error?.message || error);
    console.error('[WARNING] Email sending may not work properly');
  }

  // Test IMAP connection
  try {
    console.error('[DEBUG] Testing IMAP connection...');
    const IMAP = (await import('imap')).default;
    const imap = new IMAP({
      user: process.env.IMAP_USER!,
      password: process.env.IMAP_PASS!,
      host: process.env.IMAP_HOST,
      port: parseInt(process.env.IMAP_PORT || '993'),
      tls: process.env.IMAP_SECURE !== 'false',
      connTimeout: 5000,
      authTimeout: 3000,
    });
    
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('IMAP connection timeout'));
      }, 5000);
      
      imap.once('ready', () => {
        clearTimeout(timeout);
        console.error('[DEBUG] IMAP connection successful');
        imap.end();
        resolve(true);
      });
      imap.once('error', (err: any) => {
        clearTimeout(timeout);
        reject(err);
      });
      imap.connect();
    });
  } catch (error: any) {
    console.error('[WARNING] IMAP connection failed:', error?.message || error);
    console.error('[WARNING] Email reading may not work properly');
  }
  const server = new Server(
    {
      name: 'mcp-mail-organizer',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  console.error('[DEBUG] Registering mail tools...');
  const mailTools = new MailTools();
  await mailTools.registerTools(server);
  console.error('[DEBUG] Mail tools registered successfully');

  console.error('[DEBUG] Starting MCP server transport...');
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[DEBUG] MCP server started and ready!');
}

main().catch((error) => {
  console.error('[FATAL] Server startup failed:', error);
  if (error.stack) {
    console.error('[FATAL] Stack trace:', error.stack);
  }
  process.exit(1);
});