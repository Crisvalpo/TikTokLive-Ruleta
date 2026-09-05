const fs = require('fs');
const file = '/home/ubuntu/wa-bridge-service/src/index.js';
let content = fs.readFileSync(file, 'utf8');
if (!content.includes('/:sessionId/logout')) {
  const target = 'app.get("/:sessionId/status"';
  const logoutRoute = `// ── Desconectar / Desvincular sesión (Logout) ────────────────────
app.post("/:sessionId/logout", requireSession(manager), async (req, res) => {
  const session = req.session;
  try {
    if (session.sock) {
      try { await session.sock.logout(); } catch (e) {}
    }
    if (fs.existsSync(session.authDir)) {
      fs.rmSync(session.authDir, { recursive: true, force: true });
      fs.mkdirSync(session.authDir, { recursive: true });
    }
    session.connectionState = "idle";
    session.latestQr = null;
    session.reconnectAttempt = 0;
    session.touchAndEnsureConnected();
    res.json({ success: true, message: "Sesión desvinculada exitosamente" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

` + target;
  content = content.replace(target, logoutRoute);
  fs.writeFileSync(file, content, 'utf8');
  console.log('✅ Added logout route to wa-bridge!');
} else {
  console.log('Logout route already exists!');
}
