const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.post('/get-comps', async (req, res) => {
  const {
    days_sold = 180,
    min_beds,
    max_beds,
    min_baths,
    max_baths,
    min_price,
    max_price,
    min_sqft,
    max_sqft,
    min_year,
    max_year,
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
      const b = p.BedroomsTotal ?? 0;
      const ba = p.BathroomsFull ?? 0;
      const pr = p.ClosePrice ?? 0;
      const sqft = p.LivingArea ?? 0;
      const year = p.YearBuilt ?? 0;
      const addr = (p.UnparsedAddress || '').toLowerCase();

      return (
        (min_beds ? b >= min_beds : true) &&
        (max_beds ? b <= max_beds : true) &&
        (min_baths ? ba >= min_baths : true) &&
        (max_baths ? ba <= max_baths : true) &&
        (min_price ? pr >= min_price : true) &&
        (max_price ? pr <= max_price : true) &&
        (min_sqft ? sqft >= min_sqft : true) &&
        (max_sqft ? sqft <= max_sqft : true) &&
        (min_year ? year >= min_year : true) &&
        (max_year ? year <= max_year : true) &&
        (address ? addr.includes(address.toLowerCase()) : true)
      );
    });

    // Compute pricePerSqft + ARV
    let comps = listings.map(p => {
      const pricePerSqft = p.LivingArea ? (p.ClosePrice / p.LivingArea) : null;
      const arv = p.ClosePrice ? (p.ClosePrice * 1.1) : null;

      return {
        listingKey: p.ListingKey,
        address: p.UnparsedAddress || 'N/A',
        listPrice: p.ListPrice,
        closePrice: p.ClosePrice,
        closeDate: p.CloseDate,
        beds: p.BedroomsTotal,
        baths: p.BathroomsFull,
        sqft: p.LivingArea,
        yearBuilt: p.YearBuilt,
        pricePerSqft,
        arv
      };
    });

    // Outlier & Fixer-Upper Analysis
    const ppsfArray = comps.map(c => c.pricePerSqft).filter(v => v).sort((a, b) => a - b);
    const median = ppsfArray[Math.floor(ppsfArray.length / 2)];
    const q1 = ppsfArray[Math.floor(ppsfArray.length * 0.25)];
    const q3 = ppsfArray[Math.floor(ppsfArray.length * 0.75)];
    const iqr = q3 - q1;
    const lower = q1 - 1.5 * iqr;
    const upper = q3 + 1.5 * iqr;

    comps = comps.map(c => ({
      ...c,
      pricePerSqft: c.pricePerSqft ? Number(c.pricePerSqft.toFixed(2)) : null,
      arv: c.arv ? Number(c.arv.toFixed(0)) : null,
      isFixer: c.pricePerSqft !== null ? c.pricePerSqft < median * 0.8 : false,
      isOutlier: c.pricePerSqft !== null ? (c.pricePerSqft < lower || c.pricePerSqft > upper) : false
    }));

    res.json({ comps });
  } catch (err) {
    console.error('IDX Replication API error:', err.response?.data || err.message);
    return res.status(500).json({ error: 'Failed to fetch comps' });
  }
});

app.listen(PORT, () => {
  console.log(`✨ /get-comps listening at http://localhost:${PORT}`);
});
