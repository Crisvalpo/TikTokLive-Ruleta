const { spawn } = require('child_process');

const sql = `
ALTER TABLE subastas.buyer_bags 
  ADD COLUMN IF NOT EXISTS recipient_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS recipient_rut VARCHAR(20),
  ADD COLUMN IF NOT EXISTS recipient_phone VARCHAR(30),
  ADD COLUMN IF NOT EXISTS recipient_email VARCHAR(150),
  ADD COLUMN IF NOT EXISTS recipient_address TEXT,
  ADD COLUMN IF NOT EXISTS recipient_commune VARCHAR(100),
  ADD COLUMN IF NOT EXISTS recipient_region VARCHAR(100),
  ADD COLUMN IF NOT EXISTS tracking_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS courier VARCHAR(50) DEFAULT 'blue_express',
  ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_buyer_bags_tracking ON subastas.buyer_bags(tracking_number);
`;

const proc = spawn('ssh', ['oracle-ssh', 'docker exec -i supabase-db psql -U postgres -d postgres'], { stdio: ['pipe', 'inherit', 'inherit'] });
proc.stdin.write(sql);
proc.stdin.end();

proc.on('close', (code) => {
  console.log('Shipping columns migration finished with exit code:', code);
});
