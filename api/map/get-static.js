export default async function handler(req, res) {
  const { address, lat, lng } = req.query;

  console.log('📍 Static Map Request:', { address, lat, lng });

  if (!address && !(lat && lng)) {
    return res.status(400).json({ error: 'Missing address and lat/lng both' });
  }

  try {
    const coords = lat && lng ? { lat, lng } : await getLatLngFromAddress(address);
    if (!coords || !coords.lat || !coords.lng) {
      return res.status(400).json({ staticMapUrl: null });
    }

    // Instead of fetching the image, construct the safe proxied URL
    const encodedAddress = encodeURIComponent(address);
    const staticMapUrl = `https://idx-custom-gpt.vercel.app/api/map/proxy-static?address=${encodedAddress}`;

    return res.status(200).json({ staticMapUrl });

  } catch (err) {
    console.error('❗ Static map error:', err);
    return res.status(500).json({ staticMapUrl: null });
  }
}
