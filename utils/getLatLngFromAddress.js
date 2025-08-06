// /lib/getLatLngFromAddress.js (optional helper)
import axios from 'axios';

export async function getLatLngFromAddress(address) {
  const resp = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
    params: {
      address,
      key: process.env.GOOGLE_MAPS_KEY
    }
  });

  const result = resp.data?.results?.[0];
  if (!result) throw new Error('Address not found');

  return result.geometry.location; // { lat, lng }
}
