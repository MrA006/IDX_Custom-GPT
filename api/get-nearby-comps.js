// /api/get-nearby-comps.js

import axios from 'axios';
import { getLatLngFromAddress } from '../utils/getLatLngFromAddress.js';

const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 3958.8; // Earth radius in miles
  const toRad = deg => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST method is allowed' });
  }

  const {
    address,
    lat,
    lng,
    radius = 10,        // miles
    days_sold = 365,    // for Closed listings
    includeActivePending = false,
    beds,
    baths,
    sqft,
    year,
    min_price,
    max_price,
    min_sqft,
    max_sqft,
    propertyType = "Residential",
    top = 10 // default to 200 results
  } = req.body;


  try {
    const coords = lat && lng ? { lat, lng } : await getLatLngFromAddress(address);
    if (!coords?.lat || !coords?.lng) {
      return res.status(400).json({ error: 'Invalid or missing coordinates' });
    }

    console.log('Using coordinates:', coords);

    const filters = [];

    // Status logic
    if (!includeActivePending) {
      filters.push(`MlsStatus eq 'Closed'`);
    } else {
      filters.push(`(MlsStatus eq 'Closed' or MlsStatus eq 'Active' or MlsStatus eq 'Pending')`);
    }

    // Date logic
    if (days_sold && !includeActivePending) {
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - days_sold);
      const isoDate = fromDate.toISOString().split('T')[0];
      filters.push(`CloseDate ge ${isoDate}`);
    }

    // Apply all other filters based on new destructured variables
    if (min_price) filters.push(`ListPrice ge ${min_price}`);
    if (max_price) filters.push(`ListPrice le ${max_price}`);
    if (min_sqft) filters.push(`LivingArea ge ${min_sqft}`);
    if (max_sqft) filters.push(`LivingArea le ${max_sqft}`);
    if (beds) filters.push(`BedroomsTotal eq ${beds}`);
    if (baths) filters.push(`BathroomsFull eq ${baths}`);
    if (sqft) filters.push(`LivingArea eq ${sqft}`);
    if (year) filters.push(`YearBuilt eq ${year}`);
    filters.push(`PropertyType eq '${propertyType}'`);
    

    const url = `${process.env.REPLICATION_BASE}/Property`;
    const filterString = filters.join(' and ');
    const orderby = 'CloseDate desc';


    console.log('Fetching comps with filters:', filterString);
    console.log('Fetching comps with orderby :', orderby, 'and top:', top);
    console.log('Fetching comps with radius :', radius);

    const topFilter = top < 40 ? 120 : 200; // Spark API limit is 200

    const idxRes = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${process.env.SPARK_ACCESS_TOKEN}`,
        Accept: 'application/json'
      },
      params: {
        $filter: filterString,
        $orderby: orderby,
        $top: topFilter,
        $select: [
          'ListingKey', 'UnparsedAddress', 'City', 'StateOrProvince', 'PostalCode',
          'ListPrice', 'ClosePrice', 'CloseDate',
          'BedroomsTotal', 'BathroomsFull', 'LivingArea',
          'YearBuilt', 'LotSizeSquareFeet',
          'PropertySubType', 'PropertyType',
          'SubdivisionName', 'MlsStatus', 'Latitude', 'Longitude'
        ].join(',')
      }
    });

    const listings = Array.isArray(idxRes.data.value) ? idxRes.data.value : [];

    // Filter by radius, sort by distance, and return top N using haversineDistance
    const compsWithDistance = listings
      .filter((comp) => comp.Latitude && comp.Longitude)
      .map((comp) => ({
        ...comp,
        _distance: haversineDistance(
          coords.lat,
          coords.lng,
          comp.Latitude,
          comp.Longitude
        )
      }))
      .filter((comp) => comp._distance <= radius)
      .sort((a, b) => a._distance - b._distance)
      .slice(0, top)
      .map(({ _distance, ...rest }) => rest); // remove _distance from output

    return res.json({ comps: compsWithDistance });
  } catch (err) {
    console.error('❗ Nearby comps error:', err);
    return res.status(500).json({ error: 'Failed to fetch nearby comps', detail: err.message });
  }
}
