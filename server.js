// HarvestOptima Backend API Server
// MongoDB-style JSON file database — no external DB required
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 5000;
const DB_FILE = path.join(__dirname, 'db.json');

app.use(cors());
app.use(express.json());

// ─── DB HELPERS ──────────────────────────────────────────────────────────────
function readDB() {
  if (!fs.existsSync(DB_FILE)) {
    const empty = { users: [], crops: [], bids: [], logistics: [], bookings: [], notifications: [] };
    fs.writeFileSync(DB_FILE, JSON.stringify(empty, null, 2));
    return empty;
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function col(name) {
  return { name, db: readDB() };
}

function find(collection, filter = {}) {
  const db = readDB();
  let docs = db[collection] || [];
  for (const [key, val] of Object.entries(filter)) {
    if (Array.isArray(val)) {
      docs = docs.filter(d => val.includes(d[key]));
    } else {
      docs = docs.filter(d => d[key] === val);
    }
  }
  return docs;
}

function findById(collection, id) {
  const db = readDB();
  return (db[collection] || []).find(d => d.id === id) || null;
}

function insert(collection, doc) {
  const db = readDB();
  const newDoc = { id: uuidv4(), createdAt: new Date().toISOString(), ...doc };
  db[collection] = db[collection] || [];
  db[collection].push(newDoc);
  writeDB(db);
  return newDoc;
}

function updateById(collection, id, updates) {
  const db = readDB();
  const idx = (db[collection] || []).findIndex(d => d.id === id);
  if (idx === -1) return null;
  db[collection][idx] = { ...db[collection][idx], ...updates };
  writeDB(db);
  return db[collection][idx];
}

function removeById(collection, id) {
  const db = readDB();
  const before = (db[collection] || []).length;
  db[collection] = (db[collection] || []).filter(d => d.id !== id);
  writeDB(db);
  return (db[collection] || []).length < before;
}

// ─── USERS ───────────────────────────────────────────────────────────────────
app.get('/api/users/:uid', (req, res) => {
  const user = find('users', { uid: req.params.uid })[0] || null;
  res.json(user);
});

app.post('/api/users', (req, res) => {
  const existing = find('users', { uid: req.body.uid })[0];
  if (existing) return res.json(existing);
  res.json(insert('users', req.body));
});

app.put('/api/users/:uid', (req, res) => {
  const db = readDB();
  const idx = db.users.findIndex(u => u.uid === req.params.uid);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  db.users[idx] = { ...db.users[idx], ...req.body };
  writeDB(db);
  res.json(db.users[idx]);
});

// ─── CROPS (Marketplace) ─────────────────────────────────────────────────────
app.get('/api/crops', (req, res) => {
  let crops = find('crops');
  const { farmerId, status, statuses } = req.query;
  if (farmerId) crops = crops.filter(c => c.farmerId === farmerId);
  if (status) crops = crops.filter(c => c.status === status);
  if (statuses) {
    const s = statuses.split(',');
    crops = crops.filter(c => s.includes(c.status));
  }
  crops.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(crops);
});

app.get('/api/crops/:id', (req, res) => {
  const crop = findById('crops', req.params.id);
  if (!crop) return res.status(404).json({ error: 'Not found' });
  res.json(crop);
});

app.post('/api/crops', (req, res) => {
  res.json(insert('crops', req.body));
});

app.put('/api/crops/:id', (req, res) => {
  const updated = updateById('crops', req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Not found' });
  res.json(updated);
});

app.delete('/api/crops/:id', (req, res) => {
  removeById('crops', req.params.id);
  res.json({ ok: true });
});

// ─── BIDS ─────────────────────────────────────────────────────────────────────
app.get('/api/bids', (req, res) => {
  let bids = find('bids');
  const { farmerId, buyerId, cropId } = req.query;
  if (farmerId) bids = bids.filter(b => b.farmerId === farmerId);
  if (buyerId) bids = bids.filter(b => b.buyerId === buyerId);
  if (cropId) bids = bids.filter(b => b.cropId === cropId);
  bids.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(bids);
});

app.post('/api/bids', (req, res) => {
  res.json(insert('bids', req.body));
});

app.put('/api/bids/:id', (req, res) => {
  const updated = updateById('bids', req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Not found' });
  // If bid accepted, update crop status and reject other bids
  if (req.body.status === 'accepted') {
    const db = readDB();
    const bid = updated;
    const cropIdx = db.crops.findIndex(c => c.id === bid.cropId);
    if (cropIdx !== -1) db.crops[cropIdx].status = 'reserved';
    // Reject other pending bids for same crop
    db.bids = db.bids.map(b => {
      if (b.cropId === bid.cropId && b.id !== bid.id && b.status === 'pending') {
        return { ...b, status: 'rejected' };
      }
      return b;
    });
    writeDB(db);
    // Notify buyer
    insert('notifications', {
      userId: bid.buyerId, type: 'bid_accepted',
      message: `Your bid of ₹${bid.price}/kg for ${bid.cropType} was accepted!`,
      read: false, relatedId: bid.cropId,
    });
  } else if (req.body.status === 'rejected') {
    insert('notifications', {
      userId: updated.buyerId, type: 'bid_rejected',
      message: `Your bid for ${updated.cropType} was rejected`,
      read: false, relatedId: updated.cropId,
    });
  }
  res.json(updated);
});

// ─── LOGISTICS ────────────────────────────────────────────────────────────────
app.get('/api/logistics', (req, res) => {
  let providers = find('logistics');
  if (req.query.available === 'true') providers = providers.filter(p => p.available);
  if (req.query.userId) providers = providers.filter(p => p.userId === req.query.userId);
  res.json(providers);
});

app.post('/api/logistics', (req, res) => {
  res.json(insert('logistics', req.body));
});

app.put('/api/logistics/:id', (req, res) => {
  const updated = updateById('logistics', req.params.id, req.body);
  res.json(updated || { error: 'Not found' });
});

app.delete('/api/logistics/:id', (req, res) => {
  removeById('logistics', req.params.id);
  res.json({ ok: true });
});

// ─── BOOKINGS ─────────────────────────────────────────────────────────────────
app.get('/api/bookings', (req, res) => {
  let bookings = find('bookings');
  const { farmerId, buyerId, logisticsId } = req.query;
  if (farmerId || buyerId || logisticsId) {
    bookings = bookings.filter(b =>
      (farmerId && b.farmerId === farmerId) ||
      (buyerId && b.buyerId === buyerId) ||
      (logisticsId && b.logisticsId === logisticsId)
    );
  }
  bookings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(bookings);
});

app.post('/api/bookings', (req, res) => {
  res.json(insert('bookings', req.body));
});

app.put('/api/bookings/:id', (req, res) => {
  const updated = updateById('bookings', req.params.id, req.body);
  res.json(updated || { error: 'Not found' });
});

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
app.get('/api/notifications', (req, res) => {
  let notifs = find('notifications');
  if (req.query.userId) notifs = notifs.filter(n => n.userId === req.query.userId);
  notifs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(notifs);
});

app.post('/api/notifications', (req, res) => {
  res.json(insert('notifications', req.body));
});

app.put('/api/notifications/:id', (req, res) => {
  const updated = updateById('notifications', req.params.id, req.body);
  res.json(updated || { error: 'Not found' });
});

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  const db = readDB();
  res.json({
    status: 'ok',
    collections: {
      users: db.users.length,
      crops: db.crops.length,
      bids: db.bids.length,
      logistics: db.logistics.length,
      bookings: db.bookings.length,
      notifications: db.notifications.length,
    }
  });
});

// ─── AI CHATBOT ───────────────────────────────────────────────────────────────

// Rule-based fallback when Gemini quota is exhausted
function getFallbackReply(message, profile, crops) {
  const msg = message.toLowerCase();
  const role = profile?.role || 'farmer';
  const cropList = Array.isArray(crops) && crops.length > 0
    ? crops.map(c => c.type).join(', ')
    : null;

  // Price queries
  if (msg.includes('price') || msg.includes('rate') || msg.includes('cost') || msg.includes('विलை') || msg.includes('விலை')) {
    const prices = { tomato: 22, wheat: 28, rice: 32, potato: 16, onion: 20, corn: 18, sugarcane: 35, turmeric: 120, banana: 25, cotton: 65 };
    for (const [crop, price] of Object.entries(prices)) {
      if (msg.includes(crop)) return `Current mandi price for ${crop} is approximately ₹${price}/kg. Prices vary by location and quality — check your local mandi for exact rates. Consider listing on the marketplace to attract competitive bids.`;
    }
    return `Mandi prices vary daily. Tomato: ₹22/kg, Wheat: ₹28/kg, Rice: ₹32/kg, Potato: ₹16/kg, Onion: ₹20/kg. For live pricing, visit your nearest mandi or check the Market Intelligence tab.`;
  }

  // Harvest timing
  if (msg.includes('harvest') || msg.includes('when') || msg.includes('time') || msg.includes('அறுவடை') || msg.includes('कटाई')) {
    if (cropList) return `For your crops (${cropList}), harvest when the produce reaches full maturity — firm texture, full color, and appropriate size. Early morning harvesting reduces moisture loss. Avoid harvesting after rain to prevent spoilage.`;
    return `Harvest crops at peak maturity for best market prices. Early morning is ideal to preserve freshness. Check soil moisture and weather forecast before harvesting — avoid harvesting 2 days before predicted rain.`;
  }

  // Weather / rain
  if (msg.includes('weather') || msg.includes('rain') || msg.includes('மழை') || msg.includes('बारिश')) {
    return `Check the weather card on your dashboard for real-time conditions at ${profile?.location || 'your location'}. If rain is expected within 48 hours, prioritize harvesting ripe crops and cover stored produce. Waterlogged soil should rest 3-4 days before any field work.`;
  }

  // Fertilizer / pest
  if (msg.includes('fertilizer') || msg.includes('pest') || msg.includes('disease') || msg.includes('spray') || msg.includes('கீட') || msg.includes('खाद')) {
    return `For organic pest management, use neem oil spray (5ml/litre) every 7-10 days. Apply NPK fertilizer (19-19-19) during vegetative stage and switch to potassium-rich fertilizer before flowering. Always follow the recommended dosage on the label to avoid soil damage.`;
  }

  // Selling / marketplace (buyer questions)
  if (msg.includes('buy') || msg.includes('bid') || msg.includes('purchase') || msg.includes('supplier')) {
    return `Use the Marketplace tab to browse available crops from verified farmers. Place competitive bids — farmers can accept or reject within 24 hours. Accepted bids move to the Logistics tab where you can arrange transport.`;
  }

  // Selling advice (farmer questions)
  if (msg.includes('sell') || msg.includes('market') || msg.includes('profit') || msg.includes('income') || msg.includes('விற்')) {
    if (cropList) return `To maximize profit for ${cropList}: list on the Marketplace with a competitive base price, wait for buyer bids, and accept the best offer. Consider timing your sale 2-3 days after nearby market price peaks.`;
    return `List your crops on the HarvestOptima Marketplace to receive bids from institutional buyers. Set your price slightly above mandi rate to leave room for negotiation. Quality grading and proper packaging can increase your selling price by 15-20%.`;
  }

  // Logistics / transport
  if (msg.includes('transport') || msg.includes('logistics') || msg.includes('delivery') || msg.includes('truck')) {
    return `Use the Logistics tab to find available transport providers near you. Book early — 24-48 hours before harvest — to secure the best rates. Cold-chain vehicles are recommended for perishables like tomatoes, onions, and leafy vegetables.`;
  }

  // Greeting
  if (msg.includes('hello') || msg.includes('hi') || msg.includes('hey') || msg.includes('நல்') || msg.includes('नमस्')) {
    return `Hello ${profile?.name || 'there'}! 👋 I'm your HarvestOptima AI assistant. I can help you with crop prices, harvest timing, pest control, selling strategies, and logistics. What would you like to know?`;
  }

  // Generic helpful fallback
  if (cropList) {
    return `I can help you with your ${cropList} crops! Ask me about pricing, best harvest time, pest control, or how to get the best bids on the marketplace. What specifically would you like advice on?`;
  }
  return `I'm your agricultural assistant for HarvestOptima! I can help with: \n• 💰 Crop prices & market rates\n• 🌾 Harvest timing advice\n• 🐛 Pest & disease management\n• 🚚 Logistics & transport\n• 📊 Selling strategies\n\nWhat would you like to know?`;
}

app.post('/api/chat', async (req, res) => {
  const { message, profile, crops, lang } = req.body;
  if (!message) return res.status(400).json({ error: 'message is required' });

  const langName = lang === 'ta' ? 'Tamil' : lang === 'hi' ? 'Hindi' : 'English';
  const cropSummary = Array.isArray(crops)
    ? JSON.stringify(crops.map(c => ({ type: c.type, qty: c.quantity, price: c.price })))
    : '[]';

  const prompt = `You are an expert agricultural AI assistant for HarvestOptima, an Indian farm marketplace.
User: ${profile?.name || 'Farmer'} (${profile?.role || 'farmer'}) from ${profile?.location || 'India'}.
Their crops: ${cropSummary}.
Respond in ${langName}. Be concise (2-4 sentences max), practical and helpful.
User says: ${message}`;

  // Try all available API keys
  const apiKeys = [
    process.env.GEMINI_API_KEY,
    'AIzaSyCUqaQ8PTzhEBnNYl1VEXaCUiC7myOID8M',
  ].filter(Boolean);

  for (const apiKey of apiKeys) {
    try {
      const genAI = new GoogleGenAI({ apiKey });
      const result = await genAI.models.generateContent({
        model: 'gemini-2.0-flash-lite',
        contents: prompt,
      });
      const reply = result.text;
      if (reply) {
        console.log('✅ Gemini responded successfully');
        return res.json({ reply });
      }
    } catch (err) {
      const status = err?.message?.includes('429') || err?.message?.includes('RESOURCE_EXHAUSTED');
      if (status) {
        console.warn(`⚠️  Key quota exceeded, trying next key...`);
        continue; // try next key
      }
      console.error('Gemini error:', err?.message);
      break;
    }
  }

  // All keys exhausted — use intelligent fallback
  console.log('🤖 Using offline fallback assistant');
  const fallback = getFallbackReply(message, profile, crops);
  return res.json({ reply: `${fallback}\n\n_⚡ Offline mode — AI quota reset daily at midnight_` });
});

app.listen(PORT, () => {
  console.log(`\n🌾 HarvestOptima API Server running at http://localhost:${PORT}`);
  console.log(`📦 Database: ${DB_FILE}`);
  console.log(`✅ Ready — MongoDB-style JSON database\n`);
});
