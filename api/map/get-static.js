import { getLatLngFromAddress } from '../../utils/getLatLngFromAddress.js';

export default async function handler(req, res) {
  const { address, lat, lng } = req.body;
  console.log('📍 Static Map Request:', { address, lat, lng });

  if (!address && !(lat && lng)) {
    return res.status(400).json({ error: 'Missing address and lat/lng both' });
  }

  try {
    const coords = lat && lng ? { lat, lng } : await getLatLngFromAddress(address);
    if (!coords || !coords.lat || !coords.lng) {
      return res.status(400).json({ error: 'Could not resolve coordinates' });
    }

    const staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${coords.lat},${coords.lng}&zoom=15&size=600x300&markers=color:red|label:A|${coords.lat},${coords.lng}&key=${process.env.GOOGLE_MAPS_KEY}`;
    
    const response = await fetch(staticMapUrl);
    if (!response.ok) {
      console.warn('❌ Static map not available');
      return res.status(404).json({ staticMapUrl: null });
    }

    res.setHeader('Content-Type', 'image/jpeg');
    const buffer = await response.arrayBuffer();
    return res.send(Buffer.from(buffer));

  } catch (err) {
    console.error('❗ Static map error:', err);
    return res.status(500).json({ error: 'Failed to generate static map' });
  }
}
