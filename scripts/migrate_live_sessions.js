const { spawn } = require('child_process');

const sql = `
CREATE TABLE IF NOT EXISTS subastas.live_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(150) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVA',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  total_sales_count INTEGER DEFAULT 0,
  total_revenue INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE subastas.sales 
  ADD COLUMN IF NOT EXISTS live_session_id UUID REFERENCES subastas.live_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sales_live_session ON subastas.sales(live_session_id);
CREATE INDEX IF NOT EXISTS idx_live_sessions_status ON subastas.live_sessions(status);
`;

const proc = spawn('ssh', ['oracle-ssh', 'docker exec -i supabase-db psql -U postgres -d postgres'], { stdio: ['pipe', 'inherit', 'inherit'] });
proc.stdin.write(sql);
proc.stdin.end();

proc.on('close', (code) => {
  console.log('Migration finished with exit code:', code);
});
