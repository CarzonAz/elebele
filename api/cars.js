const JSONBIN_BASE = 'https://api.jsonbin.io/v3/b/';
const MASTER_KEY   = process.env.JSONBIN_MASTER_KEY;
const BIN_ID       = process.env.JSONBIN_BIN_ID;
const SECRET_PIN   = process.env.SECRET_PIN;

function isAuthed(req) {
  const token = req.headers['x-auth-token'] || '';
  try {
    const decoded = Buffer.from(token, 'base64').toString();
    return decoded.startsWith(SECRET_PIN + ':');
  } catch { return false; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Auth-Token');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!isAuthed(req)) return res.status(401).json({ error: 'İcazəsiz' });

  if (req.method === 'GET') {
    const r = await fetch(`${JSONBIN_BASE}${BIN_ID}/latest`, { headers: { 'X-Master-Key': MASTER_KEY } });
    if (!r.ok) return res.status(r.status).json({ error: 'Oxuma xətası' });
    const data = await r.json();
    const record = data.record || {};
    return res.json({
      cars: Array.isArray(record) ? record : (record.cars || []),
      trash: Array.isArray(record) ? [] : (record.trash || [])
    });
  }

  if (req.method === 'PUT') {
    const { cars, trash } = req.body || {};
    if (!Array.isArray(cars)) return res.status(400).json({ error: 'Format' });
    const r = await fetch(`${JSONBIN_BASE}${BIN_ID}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Master-Key': MASTER_KEY },
      body: JSON.stringify({ cars, trash: trash || [] })
    });
    if (!r.ok) return res.status(r.status).json({ error: 'Yazma xətası' });
    return res.json({ ok: true });
  }
  return res.status(405).json({ error: 'method' });
}