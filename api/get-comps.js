const axios = require('axios');

// Required for Vercel to treat this as an async API handler
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST method allowed' });
  }

  const {
    days_sold = 180,
    min_beds,
    max_price,
    address
  } = req.body;

  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days_sold);
  const isoDate = fromDate.toISOString().split('T')[0];

  const url = `${process.env.REPLICATION_BASE}/Property`;
  const odataFilter = `CloseDate ge ${isoDate}`;

  try {
    const { data } = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${process.env.SPARK_ACCESS_TOKEN}`,
        Accept: 'application/json',
      },
      params: {
        $filter: odataFilter,
        $orderby: 'CloseDate desc',
        $top: 50,
        $select: `
          ListingKey,
          UnparsedAddress,
          ListPrice,
          ClosePrice,
          CloseDate,
          BedroomsTotal,
          BathroomsFull,
          LivingArea,
          YearBuilt
        `.replace(/\s+/g, ''),
      },
    });

    let listings = Array.isArray(data.value) ? data.value : [];

    // Apply local filters
    listings = listings.filter(p => {
      const matchesBeds = min_beds ? p.BedroomsTotal >= min_beds : true;
      const matchesPrice = max_price ? p.ClosePrice <= max_price : true;
      const matchesAddress = address
        ? p.UnparsedAddress?.toLowerCase().includes(address.toLowerCase())
        : true;
      return matchesBeds && matchesPrice && matchesAddress;
    });

    const comps = listings.map(p => ({
      listingKey: p.ListingKey,
      address: p.UnparsedAddress || 'N/A',
      listPrice: p.ListPrice,
      closePrice: p.ClosePrice,
      closeDate: p.CloseDate,
      beds: p.BedroomsTotal,
      baths: p.BathroomsFull,
      sqft: p.LivingArea,
      yearBuilt: p.YearBuilt,
    }));

    res.status(200).json({ comps });
  } catch (err) {
    console.error('IDX Replication API error:', err.response?.data || err.message);
    return res.status(500).json({ error: 'Failed to fetch comps' });
  }
};
