import { getBackendUrl } from './aiProviders';

export interface EmailItem {
  id: number;
  from: string;
  subject: string;
  date: string | null;
  snippet: string;
}

export function getEmailCredentials(): { email: string; appPassword: string } {
  return {
    email: (localStorage.getItem('modelhub_email_address') || '').trim(),
    appPassword: (localStorage.getItem('modelhub_email_app_password') || '').trim(),
  };
}

export function isEmailConfigured(): boolean {
  const { email, appPassword } = getEmailCredentials();
  return Boolean(email && appPassword);
}

export async function fetchRecentEmails(): Promise<EmailItem[]> {
  const { email, appPassword } = getEmailCredentials();
  if (!email || !appPassword) {
    throw new Error('Please configure your Gmail address and App Password in Settings first.');
  }

  const backendUrl = getBackendUrl();
  const endpoint = `${backendUrl}/api/email/fetch`;

  let resp: globalThis.Response;
  try {
    resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, appPassword }),
    });
  } catch (err: any) {
    throw new Error(`Could not connect to backend server at ${endpoint}. Check your network or Backend Relay setting.`);
  }

  const data = await resp.json().catch(() => null);

  if (!resp.ok || data?.error) {
    throw new Error(data?.error || `Email fetch failed (${resp.status})`);
  }

  return data.emails || [];
}

export async function readEmailBody(uid: number): Promise<string> {
  const { email, appPassword } = getEmailCredentials();
  if (!email || !appPassword) {
    throw new Error('Please configure your Gmail credentials in Settings.');
  }

  const backendUrl = getBackendUrl();
  const endpoint = `${backendUrl}/api/email/read`;

  let resp: globalThis.Response;
  try {
    resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, appPassword, uid }),
    });
  } catch (err: any) {
    throw new Error(`Could not reach backend server at ${endpoint}.`);
  }

  const data = await resp.json().catch(() => null);

  if (!resp.ok || data?.error) {
    throw new Error(data?.error || `Could not read email (${resp.status})`);
  }

  return data.body || '(Empty email body)';
}
