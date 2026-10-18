import nodemailer from 'nodemailer';
import { config } from '../config/env.js';

/** Email service abstraction — controllers never talk to a mail provider directly. */
const outbox = []; // dev/test inspection
let transporter;

const drivers = {
  async log(msg) {
    outbox.push({ ...msg, at: new Date().toISOString() });
    if (outbox.length > 200) outbox.shift();
    if (config.env !== 'test') console.log(`[email] → ${msg.to} | ${msg.subject}`);
  },
  async smtp(msg) {
    transporter ??= nodemailer.createTransport({
      host: config.email.smtp.host,
      port: config.email.smtp.port,
      secure: config.email.smtp.secure,
      auth: config.email.smtp.user ? { user: config.email.smtp.user, pass: config.email.smtp.pass } : undefined,
    });
    await transporter.sendMail({ from: config.email.from, ...msg });
  },
};

export const emailService = {
  async send(msg) {
    try {
      await (drivers[config.email.driver] || drivers.log)(msg);
    } catch (err) {
      // Email failure must never break a business flow.
      console.error('[email] failed:', err.message);
    }
  },
  outbox: () => outbox,
};
