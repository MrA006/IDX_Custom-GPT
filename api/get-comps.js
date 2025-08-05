import axios from 'axios';

const haversineDistance = (a, b) => {
  const toRad = deg => deg * (Math.PI / 180);
  const R = 3958.8; // miles
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const aVal =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  const {
    days_sold = 180,
    min_beds, max_beds,
    min_baths, max_baths,
    min_price, max_price,
    min_sqft, max_sqft,
    min_year, max_year,
    postalCode,
    address,
    status = 'Closed'
  } = req.body;

  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days_sold);
  const isoDate = fromDate.toISOString().split('T')[0];

  const filters = [];

  if (status === 'Closed') filters.push(`CloseDate ge ${isoDate}`);
  filters.push(`MlsStatus eq '${status}'`);
  if (postalCode) filters.push(`PostalCode eq '${postalCode}'`);
  if (min_beds) filters.push(`BedroomsTotal ge ${min_beds}`);
  if (max_beds) filters.push(`BedroomsTotal le ${max_beds}`);
  if (min_baths) filters.push(`BathroomsFull ge ${min_baths}`);
  if (max_baths) filters.push(`BathroomsFull le ${max_baths}`);
  if (min_price) filters.push(`ClosePrice ge ${min_price}`);
  if (max_price) filters.push(`ClosePrice le ${max_price}`);
  if (min_sqft) filters.push(`LivingArea ge ${min_sqft}`);
  if (max_sqft) filters.push(`LivingArea le ${max_sqft}`);
  if (min_year) filters.push(`YearBuilt ge ${min_year}`);
  if (max_year) filters.push(`YearBuilt le ${max_year}`);

  const filterString = filters.join(' and ');
  const url = `${process.env.REPLICATION_BASE}/Property`;

  try {
    const idxRes = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${process.env.SPARK_ACCESS_TOKEN}`,
        Accept: 'application/json'
      },
      params: {
        $filter: filterString,
        $orderby: 'CloseDate desc',
        $top: 100,
        $select: [
          'ListingKey', 'UnparsedAddress', 'StateOrProvince', 'PostalCode',
          'ListPrice', 'ClosePrice', 'CloseDate', 'BedroomsTotal',
          'BathroomsFull', 'LivingArea', 'YearBuilt', 'Latitude', 'Longitude'
        ].join(',')
      }
    });

    let listings = Array.isArray(idxRes.data.value) ? idxRes.data.value : [];
    listings = listings.filter(p => p.Latitude && p.Longitude && p.ClosePrice);

    let comps = [];

    if (address) {
      const geoResp = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
        params: { address, key: process.env.GOOGLE_MAPS_KEY }
      });

      const geoResult = geoResp.data?.results?.[0];
      if (!geoResult) {
        return res.status(400).json({ error: 'Invalid address or not found' });
      }

      const { lat, lng } = geoResult.geometry.location;

      const sorted = listings.map(p => {
        const dist = haversineDistance({ lat, lng }, { lat: p.Latitude, lng: p.Longitude });
        return { ...p, distanceMiles: dist };
      }).sort((a, b) => a.distanceMiles - b.distanceMiles);

      comps = sorted.slice(0, 3).map(p => {
        const pricePerSqft = p.LivingArea ? p.ClosePrice / p.LivingArea : null;
        const arv = p.ClosePrice ? p.ClosePrice * 1.1 : null;
        return {
          listingKey: p.ListingKey,
          address: p.UnparsedAddress || 'N/A',
          state: p.StateOrProvince,
          postalCode: p.PostalCode,
          listPrice: p.ListPrice,
          closePrice: p.ClosePrice,
          closeDate: p.CloseDate,
          beds: p.BedroomsTotal,
          baths: p.BathroomsFull,
          sqft: p.LivingArea,
          yearBuilt: p.YearBuilt,
          distanceMiles: Number(p.distanceMiles.toFixed(2)),
          pricePerSqft: pricePerSqft ? Number(pricePerSqft.toFixed(2)) : null,
          arv: arv ? Number(arv.toFixed(0)) : null,
          imageURL: null,
          staticMap: `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(p.UnparsedAddress)}&zoom=15&size=600x300&key=${process.env.GOOGLE_MAPS_KEY}`
        };
      });
    }

    return res.json({ comps });
  } catch (err) {
    console.error('IDX API error:', err.response?.data || err.message || err);
    return res.status(500).json({ error: 'Failed to fetch comps', detail: err.response?.data || err.message });
  }
}
