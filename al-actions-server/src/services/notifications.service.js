import nodemailer from 'nodemailer';
import { config } from '../config/env.js';

let transporter = null;
let firebaseApp = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure, // true for 465, false for 587 (STARTTLS)
      auth: {
        user: config.smtp.user,
        pass: config.smtp.appPassword // Gmail App Password, not the account password
      }
    });
  }
  return transporter;
}

async function getFirebaseMessaging() {
  if (!config.firebaseServiceAccountPath) return null;
  if (!firebaseApp) {
    const { default: admin } = await import('firebase-admin');
    const { readFileSync } = await import('node:fs');
    const serviceAccount = JSON.parse(readFileSync(config.firebaseServiceAccountPath, 'utf8'));
    firebaseApp = admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    return admin.messaging();
  }
  const { default: admin } = await import('firebase-admin');
  return admin.messaging();
}

/** Sends a plain-text/HTML email. Failures are logged, never thrown — a
 *  notification glitch should never fail the underlying status change. */
export async function sendEmail({ to, subject, text, html }) {
  if (!to || (Array.isArray(to) && to.length === 0)) return;
  try {
    await getTransporter().sendMail({
      from: config.smtp.from,
      to: Array.isArray(to) ? to.join(',') : to,
      subject,
      text,
      html: html || `<p>${text}</p>`
    });
  } catch (err) {
    console.error('Failed to send email notification:', err.message);
  }
}

/** Sends a push notification to a device token via FCM. No-op if Firebase isn't configured. */
export async function sendPush({ token, title, body, data }) {
  if (!token) return;
  try {
    const messaging = await getFirebaseMessaging();
    if (!messaging) return; // Firebase not configured — skip silently in dev
    await messaging.send({
      token,
      notification: { title, body },
      data: data || {}
    });
  } catch (err) {
    console.error('Failed to send push notification:', err.message);
  }
}

// ---- Domain-specific notification helpers, matching the spec's rules ----

export async function notifyEmployeeAssigned(action) {
  await sendEmail({
    to: action.assigned_to_email,
    subject: `New action assigned: ${action.title}`,
    text: `You've been assigned "${action.title}" for ${action.customer_name}, due ${new Date(action.deadline).toLocaleString()}.`
  });
}

// Notify an employee that a task they were working on has been handed over
export async function notifyActionUnassigned(email, actionTitle) {
  await sendEmail({
    to: email,
    subject: `Action Reassigned: ${actionTitle}`,
    text: `The action "${actionTitle}" has been unassigned from you and reassigned to another team member by an administrator.`
  });
}

// Notify an employee that a task they own had metadata modifications
export async function notifyActionUpdated(action) {
  await sendEmail({
    to: action.assignedToEmail,
    subject: `Action Updated: ${action.title}`,
    text: `An administrator has updated details for your assigned action: "${action.title}" for ${action.customerName}. Please review your schedule.`
  });
}

/** Admin edited an action's details without reassigning it. */
export async function notifyEmployeeActionUpdated(action, deviceToken) {
  await sendPush({
    token: deviceToken,
    title: 'Action updated',
    body: `An admin updated the details of "${action.title}".`,
    data: { actionId: action.id }
  });
}

export async function notifyActionDeleted(action) {
  await sendEmail({
    to: action.assigned_to_email,
    subject: `Action Removed: ${action.title}`,
    text: `The action "${action.title}" for ${action.customer_name} has been removed from your list by an administrator.`
  });
}

export async function notifyEmployeeActionRemoved(action, deviceToken) {
  await sendPush({
    token: deviceToken,
    title: 'Action removed',
    body: `"${action.title}" was removed by an admin.`,
    data: { actionId: action.id }
  });
}

export async function notifyAdminsActionFinished(action) {
  await sendEmail({
    to: config.adminNotificationEmails,
    subject: `Action finished: ${action.title}`,
    text: `${action.assigned_to_email} marked "${action.title}" (${action.customer_name}) as finished.`
  });
}

export async function notifyAdminsActionCancelledByEmployee(action) {
  await sendEmail({
    to: config.adminNotificationEmails,
    subject: `Action cancelled: ${action.title}`,
    text: `${action.assigned_to_email} cancelled "${action.title}" (${action.customer_name}).${
      action.cancel_reason ? ` Reason: ${action.cancel_reason}` : ''
    }`
  });
}

export async function notifyEmployeeActionCancelledByAdmin(action, adminEmail, deviceToken) {
  await sendPush({
    token: deviceToken,
    title: 'Action cancelled',
    body: `An admin cancelled "${action.title}".`,
    data: { actionId: action.id }
  });
}

export async function notifyEmployeeActionPostponed(action, deviceToken) {
  await sendPush({
    token: deviceToken,
    title: 'Deadline passed',
    body: `"${action.title}" is now overdue.`,
    data: { actionId: action.id }
  });
}
