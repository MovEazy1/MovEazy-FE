/**
 * Client-side policy only: requires Google consumer mail domains.
 * Proving the mailbox exists or sending mail requires a server or Firebase Auth.
 */

const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

export function isGmailAddress(raw) {
  const trimmed = String(raw || "").trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at === trimmed.length - 1) return false;
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  if (!GMAIL_DOMAINS.has(domain)) return false;
  if (!local || local.length > 64) return false;
  if (local.includes("..")) return false;
  if (!/^[a-z0-9][a-z0-9._+-]*$/i.test(local)) return false;
  return true;
}

export function gmailSignupErrorMessage() {
  return "Use a Google Mail address (@gmail.com or @googlemail.com) to sign up.";
}
