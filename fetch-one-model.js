import 'dotenv/config.js';
import axios from 'axios';
import { MongoClient } from 'mongodb';
import fs from 'fs/promises';

const {
  PARTS_API_KEY,
  PARTS_API_BASE = 'https://api.parts-catalogs.com/v1',
  MONGO_URI,
  DB_NAME = 'premart',
  COLLECTION = 'tradesoft_models'
} = process.env;

if (!PARTS_API_KEY || !MONGO_URI) {
  console.error('Missing PARTS_API_KEY or MONGO_URI in .env'); process.exit(1);
}

const headers = { accept: 'application/json', Authorization: PARTS_API_KEY };

const log = (m) => console.log(`[${new Date().toISOString()}] ${m}`);

(async () => {
  // 0) Free health check (doesn't consume quota)
  try {
    const ip = await axios.get(`${PARTS_API_BASE}/ip/`, { headers });
    log(`API OK, server sees IP: ${ip.data?.ip}`);
  } catch (e) {
    console.error('IP check failed:', e.response?.status, e.response?.data || e.message);
    process.exit(1);
  }

  // DB connect + idempotency index
  const mongo = new MongoClient(MONGO_URI);
  await mongo.connect();
  const col = mongo.db(DB_NAME).collection(COLLECTION);
  await col.createIndex({ catalogId: 1, modelId: 1 }, { unique: true });

  try {
    // 1) CALL #1 — catalogs
    const catalogsRes = await axios.get(`${PARTS_API_BASE}/catalogs/`, { headers, validateStatus: () => true });
    if (catalogsRes.status !== 200) {
      throw new Error(`GET /catalogs failed: ${catalogsRes.status} ${JSON.stringify(catalogsRes.data)}`);
    }
    const catalogs = Array.isArray(catalogsRes.data) ? catalogsRes.data : catalogsRes.data?.catalogs || [];
    if (!catalogs.length) throw new Error('No catalogs returned');

    // choose first with modelsCount > 0 (fallback: first)
    const catalog = catalogs.find(c => (c.modelsCount ?? 0) > 0) || catalogs[0];
    log(`Using catalog: ${catalog?.name || catalog?.id} (id=${catalog?.id}, modelsCount=${catalog?.modelsCount})`);

    // 2) CALL #2 — models for that catalog
    const modelsRes = await axios.get(`${PARTS_API_BASE}/catalogs/${catalog.id}/models/`, { headers, validateStatus: () => true });
    if (modelsRes.status !== 200) {
      throw new Error(`GET /catalogs/${catalog.id}/models failed: ${modelsRes.status} ${JSON.stringify(modelsRes.data)}`);
    }
    const models = Array.isArray(modelsRes.data) ? modelsRes.data : modelsRes.data?.models || [];
    if (!models.length) throw new Error('No models returned for selected catalog');

    const model = models[0];
    log(`Selected model: ${model?.name || model?.id}`);

    // Assemble minimal normalized document
    const doc = {
      catalogId: catalog.id,
      catalogName: catalog.name ?? null,
      modelId: model.id,
      modelName: model.name ?? null,
      modelImg: model.img ?? null,
      source: 'parts-catalogs/v1',
      createdAt: new Date(),
      raw: { catalog, model }, // keep raw for audit
    };

    // Save raw snapshot to disk for your demo
    await fs.mkdir('./.cache', { recursive: true });
    await fs.writeFile(`./.cache/${catalog.id}_${model.id}.json`, JSON.stringify(doc, null, 2));

    // Insert (idempotent)
    const result = await col.updateOne(
      { catalogId: doc.catalogId, modelId: doc.modelId },
      { $setOnInsert: doc },
      { upsert: true }
    );

    if (result.upsertedId) {
      log(`Inserted ✅ with _id=${result.upsertedId}`);
    } else {
      log('Already existed — no duplicate insert (idempotent) ✅');
    }

    log('Success: 2 calls consumed total.');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await mongo.close();
  }
})();