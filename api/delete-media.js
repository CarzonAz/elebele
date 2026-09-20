import crypto from 'crypto';

const CLOUD_NAME = 'u29az1iv';
const API_KEY    = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;
const SECRET_PIN = process.env.SECRET_PIN;

function isAuthed(req) {
  const token = req.headers['x-auth-token'] || '';
  try {
    const decoded = Buffer.from(token, 'base64').toString();
    return decoded.startsWith(SECRET_PIN + ':');
  } catch { return false; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Auth-Token');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  if (!isAuthed(req)) return res.status(401).json({ error: 'İcazəsiz' });

  const { publicId, resourceType = 'image' } = req.body || {};
  if (!publicId) return res.status(400).json({ error: 'publicId yoxdur' });

  /* Cloudinary imzası */
  const timestamp = Math.floor(Date.now() / 1000);
  const toSign = `public_id=${publicId}&timestamp=${timestamp}${API_SECRET}`;
  const signature = crypto.createHash('sha1').update(toSign).digest('hex');

  const formData = new URLSearchParams();
  formData.append('public_id', publicId);
  formData.append('timestamp', timestamp);
  formData.append('api_key', API_KEY);
  formData.append('signature', signature);

  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/destroy`;

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString()
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json(data);
    return res.json(data);
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
