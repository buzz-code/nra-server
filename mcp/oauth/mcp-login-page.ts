import { Response } from 'express';

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * Sign-in page shown when an MCP client (Claude, Codex, Gemini…) asks to connect.
 * The password form posts to `/mcp/oauth/login`. When the browser already has a site login, the page
 * also offers one-click approval (`/mcp/oauth/approve`); it asks `/mcp/oauth/session` from script,
 * because the site's SameSite=Strict cookie isn't sent on the redirect from the AI app but is on same-site requests.
 */
export function renderLoginPage(
  request: string,
  description: string,
  client: { clientName?: string; redirectUri: string },
  error?: string,
): string {
  const name = escapeHtml(client.clientName || 'אפליקציית AI');
  // The name is whatever the client registered; where it sends the user back is what identifies it.
  const returnHost = escapeHtml(new URL(client.redirectUri).host);
  const requestInput = `<input type="hidden" name="request" value="${escapeHtml(request)}">`;
  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>התחברות</title>
<style>
  body { font-family: system-ui, -apple-system, 'Segoe UI', Arial, sans-serif; background: #f4f5f7; margin: 0; display: flex; min-height: 100vh; align-items: center; justify-content: center; }
  main { background: #fff; padding: 32px; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,.08); width: 100%; max-width: 360px; box-sizing: border-box; margin: 16px; }
  h1 { font-size: 20px; margin: 0 0 8px; }
  p { color: #555; margin: 0 0 24px; line-height: 1.5; }
  label { display: block; font-size: 14px; margin-bottom: 4px; }
  input[type=email], input[type=password] { width: 100%; padding: 10px; margin-bottom: 16px; border: 1px solid #ccc; border-radius: 8px; font-size: 16px; box-sizing: border-box; }
  button { width: 100%; padding: 12px; border: 0; border-radius: 8px; background: #1976d2; color: #fff; font-size: 16px; cursor: pointer; }
  .error { color: #c62828; margin-bottom: 16px; }
  #session { margin-bottom: 24px; }
  #session p { margin: 16px 0 0; text-align: center; }
</style>
</head>
<body>
<main>
  <h1>חיבור ${name}</h1>
  <p>${name} ${escapeHtml(
    description,
  )} אחרי האישור תחזרו אל <b dir="ltr">${returnHost}</b>. אשרו רק אם זו האפליקציה שאתם מחברים.</p>
  ${error ? `<div class="error">${escapeHtml(error)}</div>` : ''}
  <div id="session" hidden>
    <form method="post" action="/mcp/oauth/approve">
      ${requestInput}
      <button type="submit">אישור בתור <span id="session-name"></span></button>
    </form>
    <p>או התחברו עם משתמש אחר:</p>
  </div>
  <form method="post" action="/mcp/oauth/login">
    ${requestInput}
    <label for="email">מייל</label>
    <input id="email" name="email" type="email" autocomplete="username" required autofocus>
    <label for="password">סיסמה</label>
    <input id="password" name="password" type="password" autocomplete="current-password" required>
    <button type="submit">התחברות ואישור</button>
  </form>
</main>
<script>
  fetch('/mcp/oauth/session', { method: 'POST', credentials: 'same-origin' })
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(function (session) {
      if (!session) return;
      document.getElementById('session-name').textContent = session.name;
      document.getElementById('session').hidden = false;
    })
    .catch(function () {});
</script>
</body>
</html>`;
}

/** Sends the sign-in page; it must never be framed, since it can approve with one click. */
export function sendLoginPage(res: Response, status: number, html: string) {
  res
    .status(status)
    .setHeader('Content-Security-Policy', "frame-ancestors 'none'")
    .setHeader('X-Frame-Options', 'DENY')
    .setHeader('Cache-Control', 'no-store')
    .type('html')
    .send(html);
}
