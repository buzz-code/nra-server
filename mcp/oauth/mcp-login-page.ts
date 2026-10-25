const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Sign-in page shown when an MCP client (Claude, Codex, Gemini…) asks to connect. Posts to `/mcp/oauth/login`. */
export function renderLoginPage(request: string, clientName?: string, error?: string): string {
  const client = escapeHtml(clientName || 'אפליקציית AI');
  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>התחברות</title>
<style>
  body { font-family: system-ui, -apple-system, 'Segoe UI', Arial, sans-serif; background: #f4f5f7; margin: 0; display: flex; min-height: 100vh; align-items: center; justify-content: center; }
  form { background: #fff; padding: 32px; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,.08); width: 100%; max-width: 360px; box-sizing: border-box; margin: 16px; }
  h1 { font-size: 20px; margin: 0 0 8px; }
  p { color: #555; margin: 0 0 24px; line-height: 1.5; }
  label { display: block; font-size: 14px; margin-bottom: 4px; }
  input[type=email], input[type=password] { width: 100%; padding: 10px; margin-bottom: 16px; border: 1px solid #ccc; border-radius: 8px; font-size: 16px; box-sizing: border-box; }
  button { width: 100%; padding: 12px; border: 0; border-radius: 8px; background: #1976d2; color: #fff; font-size: 16px; cursor: pointer; }
  .error { color: #c62828; margin-bottom: 16px; }
</style>
</head>
<body>
<form method="post" action="/mcp/oauth/login">
  <h1>חיבור ${client}</h1>
  <p>${client} מבקש גישת קריאה לסטטיסטיקות השימוש שלך. התחברו עם המייל והסיסמה של המערכת כדי לאשר.</p>
  ${error ? `<div class="error">${escapeHtml(error)}</div>` : ''}
  <input type="hidden" name="request" value="${escapeHtml(request)}">
  <label for="email">מייל</label>
  <input id="email" name="email" type="email" autocomplete="username" required autofocus>
  <label for="password">סיסמה</label>
  <input id="password" name="password" type="password" autocomplete="current-password" required>
  <button type="submit">התחברות ואישור</button>
</form>
</body>
</html>`;
}
