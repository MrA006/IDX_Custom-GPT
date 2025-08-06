// /api/get-comps-basic.js

import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  const {
    min_beds, max_beds,
    min_baths, max_baths,
    min_price, max_price,
    min_sqft, max_sqft,
    min_year, max_year,
    postalCode,
    address,
    status,
    state,
    orderby = 'ListPrice desc',
    days_sold,
    beds, // for exact match
    baths,
    sqft,
    year
  } = req.body;

  const filters = [];
  if (status) filters.push(`MlsStatus eq '${status}'`);
  if (postalCode) filters.push(`PostalCode eq '${postalCode}'`);
  else if (state) filters.push(`StateOrProvince eq '${state}'`);
  if (min_beds) filters.push(`BedroomsTotal ge ${min_beds}`);
  if (max_beds) filters.push(`BedroomsTotal le ${max_beds}`);
  if (min_baths) filters.push(`BathroomsFull ge ${min_baths}`);
  if (max_baths) filters.push(`BathroomsFull le ${max_baths}`);
  if (min_price) filters.push(`ListPrice ge ${min_price}`);
  if (max_price) filters.push(`ListPrice le ${max_price}`);
  if (min_sqft) filters.push(`LivingArea ge ${min_sqft}`);
  if (max_sqft) filters.push(`LivingArea le ${max_sqft}`);
  if (min_year) filters.push(`YearBuilt ge ${min_year}`);
  if (max_year) filters.push(`YearBuilt le ${max_year}`);
  if(beds)  filters.push(`BedroomsTotal eq ${beds}`);
  if(baths) filters.push(`BathroomsFull eq ${baths}`);
  if(sqft)  filters.push(`LivingArea eq ${sqft}`);
  if(year)  filters.push(`YearBuilt eq ${year}`);

  if (status === 'Closed' && days_sold) {
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days_sold);
  const isoDate = fromDate.toISOString().split('T')[0];
  filters.push(`CloseDate ge ${isoDate}`);
}


  const filterString = filters.join(' and ');
  const url = `${process.env.REPLICATION_BASE}/Property`;

  console.log('Fetching comps with filters:', filterString);

  try {
    const idxRes = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${process.env.SPARK_ACCESS_TOKEN}`,
        Accept: 'application/json'
      },
      params: {
        $filter: filterString,
        $top: 50,
        $orderby: orderby,
        $select: [
          'ListingKey', 'UnparsedAddress', 'City', 'StateOrProvince', 'PostalCode',
          'ListPrice', 'ClosePrice', 'CloseDate',
          'BedroomsTotal', 'BathroomsFull', 'LivingArea',
          'YearBuilt', 'LotSizeSquareFeet',
          'PropertySubType', 'PropertyType',
          'SubdivisionName', 'PropertyCondition', 'ParkingFeatures', 'GarageSpaces', 
          'MlsStatus', 'DaysOnMarket',
          'Latitude', 'Longitude'
        ].join(',')
      }
    });

    const listings = Array.isArray(idxRes.data.value) ? idxRes.data.value : [];
    return res.json({ comps: listings });

  } catch (err) {
    console.error('IDX API error:', err.response?.data || err.message || err);
    return res.status(500).json({ error: 'Failed to fetch comps', detail: err.response?.data || err.message });
  }
}
