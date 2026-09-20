const JSONBIN_BASE = 'https://api.jsonbin.io/v3/b/';
const MASTER_KEY   = process.env.JSONBIN_MASTER_KEY;
const BIN_ID       = process.env.JSONBIN_BIN_ID;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') return res.status(405).json({ error: 'method' });

  const token = req.query.t;
  if (!token || token.length < 16) return res.status(400).json({ error: 'Token yoxdur' });

  const r = await fetch(`${JSONBIN_BASE}${BIN_ID}/latest`, {
    headers: { 'X-Master-Key': MASTER_KEY }
  });
  if (!r.ok) return res.status(500).json({ error: 'Server xətası' });

  const data = await r.json();
  const cars = data.record || [];
  const car  = cars.find(c => c.shareToken === token);

  if (!car) return res.status(404).json({ error: 'Tapılmadı' });

  return res.json({
    car: {
      owner:        car.owner        || '',
      model:        car.model        || '',
      vin:          car.vin          || '',
      status:       car.status       || '',
      udus:         car.udus         || '',
      anbar:        car.anbar        || '',
      poti:         car.poti         || '',
      baki:         car.baki         || '',
      location:     car.location     || '',
      shippingPort: car.shippingPort || '',
      container:    car.container    || '',
      etibarname:   !!car.etibarname,
      shippingPaid: !!car.shippingPaid,
      photos: {
        pikap: car.photos?.pikap || [],
        anbar: car.photos?.anbar || [],
        poti:  car.photos?.poti  || []
      }
    }
  });
}
