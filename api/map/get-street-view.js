import { getLatLngFromAddress } from '../../utils/getLatLngFromAddress.js';

export default async function handler(req, res) {
  const { address, lat, lng } = req.query;

  console.log('📍 Street View Proxy URL Request:', { address, lat, lng });

  if (!address && !(lat && lng)) {
    return res.status(400).json({ error: 'Missing address and lat/lng both' });
  }

  try {
    const coords = lat && lng ? { lat, lng } : await getLatLngFromAddress(address);
    if (!coords || !coords.lat || !coords.lng) {
      return res.status(400).json({ streetViewUrl: null });
    }

    const encodedAddress = encodeURIComponent(address);
    const streetViewUrl = `https://idx-custom-gpt.vercel.app/api/map/proxy-street-view?address=${encodedAddress}`;

    const streetViewUrlCheck = `https://maps.googleapis.com/maps/api/streetview?location=${coords.lat},${coords.lng}&size=600x300&key=${process.env.GOOGLE_MAPS_KEY}`;
    const imageResp = await fetch(streetViewUrlCheck);

    if (!imageResp.ok) {
      console.warn('❌ Failed to fetch Street View Url (no image)');
      return res.status(404).json({ streetViewUrl: false });
    }

    return res.status(200).json({ streetViewUrl });

  } catch (err) {
    console.error('❗ Street View URL generation error:', err);
    return res.status(500).json({ streetViewUrl: null });
  }
}
