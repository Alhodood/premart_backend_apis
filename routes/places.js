const express = require('express');
const router = express.Router();
const axios = require('axios');

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyA-EVOa23quUIZePRRexmvTzI_rvAAFfKc';

// Autocomplete proxy
router.get('/autocomplete', async (req, res) => {
  try {
    const { input } = req.query;
    if (!input) return res.status(400).json({ error: 'input required' });

    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/place/autocomplete/json',
      {
        params: {
          input,
          key: GOOGLE_API_KEY,
          components: 'country:ae|country:in',
          types: 'establishment|geocode',
        },
      }
    );
    res.json(response.data);
  } catch (err) {
    console.error('Places autocomplete error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Place details proxy
router.get('/details', async (req, res) => {
  try {
    const { place_id } = req.query;
    if (!place_id) return res.status(400).json({ error: 'place_id required' });

    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/place/details/json',
      {
        params: {
          place_id,
          fields: 'geometry,formatted_address,name',
          key: GOOGLE_API_KEY,
        },
      }
    );
    res.json(response.data);
  } catch (err) {
    console.error('Place details error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;


// Static Map proxy — add this BEFORE module.exports
router.get('/staticmap', async (req, res) => {
  try {
    const { lat, lng, zoom = 15, w = 600, h = 300 } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });

    const url = `https://maps.googleapis.com/maps/api/staticmap`
      + `?center=${lat},${lng}`
      + `&zoom=${zoom}`
      + `&size=${w}x${h}`
      + `&scale=2`
      + `&maptype=roadmap`
      + `&markers=color:red%7C${lat},${lng}`
      + `&key=${GOOGLE_API_KEY}`;

    const response = await axios.get(url, { responseType: 'arraybuffer' });
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(response.data);
  } catch (err) {
    console.error('Static map error:', err.message);
    res.status(500).json({ error: err.message });
  }
});