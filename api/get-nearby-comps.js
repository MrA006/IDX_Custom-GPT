// /api/get-nearby-comps.js

import axios from 'axios';
import { getLatLngFromAddress } from '../utils/getLatLngFromAddress.js';

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
    let subjectData = null;
    let subjectCoords = { lat, lng };

    // If address is given, fetch subject property details
    if (address) {
      // Fetch subject property by address (flexible match)
      const subjectUrl = `${process.env.REPLICATION_BASE}/Property`;
      const subjectFilter = `contains(UnparsedAddress, '${address.replace(/'/g, "''")}') and PropertyType eq '${propertyType}'`;
      const subjectSelect = [
        'ListingKey', 'UnparsedAddress', 'City', 'StateOrProvince', 'PostalCode',
        'ListPrice', 'ClosePrice', 'CloseDate',
        'BedroomsTotal', 'BathroomsFull', 'LivingArea',
        'YearBuilt', 'LotSizeSquareFeet',
        'PropertySubType', 'PropertyType',
        'SubdivisionName', 'MlsStatus', 'Latitude', 'Longitude',
        'BathroomsTotalInteger', 'Stories', 'ArchitecturalStyle',
        'PropertyCondition', 'Flooring', 'InteriorFeatures',
        'ExteriorFeatures', 'PublicRemarks'
      ];
      console.log('Subject property filter:', subjectFilter);
      const subjectRes = await axios.get(subjectUrl, {
        headers: {
          Authorization: `Bearer ${process.env.SPARK_ACCESS_TOKEN}`,
          Accept: 'application/json'
        },
        params: {
          $filter: subjectFilter,
          $top: 1,
          $select: subjectSelect.join(',')
        }
      });
      subjectData = Array.isArray(subjectRes.data.value) && subjectRes.data.value.length > 0 ? subjectRes.data.value[0] : null;
      // If subjectData is found but missing lat/lng, get from Google API
      if (subjectData && (!subjectData.Latitude || !subjectData.Longitude)) {
        const coordsFromGoogle = await getLatLngFromAddress(subjectData.UnparsedAddress || address);
        subjectData.Latitude = coordsFromGoogle.lat;
        subjectData.Longitude = coordsFromGoogle.lng;
      }
      // Use subjectData's lat/lng for nearby search if available
      if (subjectData && subjectData.Latitude && subjectData.Longitude) {
        subjectCoords = { lat: subjectData.Latitude, lng: subjectData.Longitude };
      } else if (!subjectCoords.lat || !subjectCoords.lng) {
        // If still missing, try Google API from address
        const coordsFromGoogle = await getLatLngFromAddress(address);
        subjectCoords = { lat: coordsFromGoogle.lat, lng: coordsFromGoogle.lng };
      }
      console.log('Subject coordinates used for nearby search:', subjectCoords);
    }

    // If no coordinates, error
    if (!subjectCoords.lat || !subjectCoords.lng) {
      return res.status(400).json({ error: 'Invalid or missing coordinates' });
    }

    // Build filters for nearby comps
    const filters = [];
    filters.push(`geo.distance(Location, geography'POINT(${subjectCoords.lng} ${subjectCoords.lat})') le ${radius}`);
    if (!includeActivePending) {
      filters.push(`MlsStatus eq 'Closed'`);
      if (days_sold) {
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - days_sold);
        const isoDate = fromDate.toISOString().split('T')[0];
        filters.push(`CloseDate ge ${isoDate}`);
      }
    } else {
      filters.push(`(MlsStatus eq 'Closed' or MlsStatus eq 'Active' or MlsStatus eq 'Pending')`);
    }
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
    const topFilter = top;
    const select = [
      'ListingKey', 'UnparsedAddress', 'City', 'StateOrProvince', 'PostalCode',
      'ListPrice', 'ClosePrice', 'CloseDate',
      'BedroomsTotal', 'BathroomsFull', 'LivingArea',
      'YearBuilt', 'LotSizeSquareFeet',
      'PropertySubType', 'PropertyType',
      'SubdivisionName', 'MlsStatus', 'Latitude', 'Longitude',
      'BathroomsTotalInteger', 'Stories', 'ArchitecturalStyle',
      'PropertyCondition', 'Flooring', 'InteriorFeatures',
      'ExteriorFeatures', 'PublicRemarks'
    ];

    console.log('Nearby comps filter:', filterString);
    console.log('Spark API request:', url);
    console.log('Params:', { $filter: filterString, $orderby: orderby, $top: topFilter, $select: select.join(',') });
    const idxRes = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${process.env.SPARK_ACCESS_TOKEN}`,
        Accept: 'application/json'
      },
      params: {
        $filter: filterString,
        $orderby: orderby,
        $top: topFilter,
        $select: select.join(',')
      }
    });
    const listings = Array.isArray(idxRes.data.value) ? idxRes.data.value : [];

    // Response structure
    if (address) {
      return res.json({ subjectData, nearbyData: listings });
    } else {
      return res.json({ comps: listings });
    }
  } catch (err) {
    console.error('❗ Comps API error:', err);
    return res.status(500).json({ error: 'Failed to fetch comps', detail: err.message });
  }
}
