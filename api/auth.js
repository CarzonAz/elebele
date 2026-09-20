export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });

  const { pin } = req.body || {};
  const correctPin = process.env.SECRET_PIN;

  if (!pin || pin !== correctPin) {
    return new Promise(resolve =>
      setTimeout(() => resolve(res.status(401).json({ ok: false })), 800)
    );
  }

  const sessionToken = Buffer.from(correctPin + ':' + Date.now()).toString('base64');
  return res.json({ ok: true, token: sessionToken });
}
