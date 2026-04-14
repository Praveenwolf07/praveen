// HarvestOptima Backend — MongoDB Edition
// All data stored in MongoDB (harvestoptima database)
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 5000;
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/harvestoptima';
const DB_FILE = path.join(__dirname, 'db.json'); // used only for migration

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ─── MONGOOSE MODELS ─────────────────────────────────────────────────────────
// Using loose schemas (strict: false) to accept any fields
const schemaOpts = { strict: false, versionKey: false, timestamps: false };

const User         = mongoose.model('User',         new mongoose.Schema({}, schemaOpts));
const Crop         = mongoose.model('Crop',         new mongoose.Schema({}, schemaOpts));
const Bid          = mongoose.model('Bid',          new mongoose.Schema({}, schemaOpts));
const Logistics    = mongoose.model('Logistics',    new mongoose.Schema({}, schemaOpts));
const Booking      = mongoose.model('Booking',      new mongoose.Schema({}, schemaOpts));
const Notification = mongoose.model('Notification', new mongoose.Schema({}, schemaOpts));
const Message      = mongoose.model('Message',      new mongoose.Schema({}, schemaOpts));
const Rating       = mongoose.model('Rating',       new mongoose.Schema({}, schemaOpts));

const MODELS = { users: User, crops: Crop, bids: Bid, logistics: Logistics,
  bookings: Booking, notifications: Notification, messages: Message, ratings: Rating };

// ─── HELPERS ─────────────────────────────────────────────────────────────────
// Strip MongoDB's internal _id and __v from results
function clean(docs) {
  if (Array.isArray(docs)) return docs.map(d => { const { _id, __v, ...rest } = d; return rest; });
  if (docs) { const { _id, __v, ...rest } = docs; return rest; }
  return null;
}

async function dbFind(model, filter = {}) {
  return clean(await model.find(filter).lean());
}

async function dbInsert(model, data) {
  const doc = { id: uuidv4(), createdAt: new Date().toISOString(), ...data };
  await model.create(doc);
  return doc;
}

async function dbUpdate(model, id, data) {
  const updated = await model.findOneAndUpdate({ id }, { $set: data }, { new: true, lean: true });
  return updated ? clean(updated) : null;
}

async function dbDelete(model, id) {
  return model.deleteOne({ id });
}

// ─── MIGRATE db.json → MongoDB (runs once on first start) ─────────────────────
async function migrateFromJsonFile() {
  if (!fs.existsSync(DB_FILE)) return;
  let db;
  try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch { return; }

  const collections = ['users','crops','bids','logistics','bookings','notifications','messages','ratings'];
  let migrated = false;

  for (const col of collections) {
    if (!db[col] || db[col].length === 0) continue;
    const count = await MODELS[col].countDocuments();
    if (count === 0) {
      await MODELS[col].insertMany(db[col]);
      console.log(`  📦 Migrated ${db[col].length} ${col} → MongoDB`);
      migrated = true;
    }
  }
  if (migrated) console.log('  ✅ Migration complete — all data now in MongoDB\n');
}

// ─── USERS ───────────────────────────────────────────────────────────────────
app.get('/api/users/:uid', async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.params.uid }).lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(clean(user));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/users', async (req, res) => {
  try {
    const existing = await User.findOne({ uid: req.body.uid }).lean();
    if (existing) return res.json(clean(existing));
    const user = await dbInsert(User, req.body);
    res.json(user);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/users/:uid', async (req, res) => {
  try {
    const updated = await User.findOneAndUpdate(
      { uid: req.params.uid }, { $set: req.body }, { new: true, lean: true }
    );
    res.json(updated ? clean(updated) : { error: 'Not found' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── CROPS ───────────────────────────────────────────────────────────────────
app.get('/api/crops/demand', async (req, res) => {
  try {
    const bids = await dbFind(Bid, { status: 'pending' });
    const demandMap = {};
    bids.forEach(b => { demandMap[b.cropType] = (demandMap[b.cropType] || 0) + 1; });
    res.json(demandMap);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/crops', async (req, res) => {
  try {
    const filter = {};
    if (req.query.farmerId) filter.farmerId = req.query.farmerId;
    if (req.query.statuses) {
      filter.status = { $in: req.query.statuses.split(',') };
    }
    const crops = await dbFind(Crop, filter);
    res.json(crops);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/crops', async (req, res) => {
  try { res.json(await dbInsert(Crop, req.body)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/crops/:id', async (req, res) => {
  try {
    const updated = await dbUpdate(Crop, req.params.id, req.body);
    res.json(updated || { error: 'Not found' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/crops/:id', async (req, res) => {
  try { await dbDelete(Crop, req.params.id); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── BIDS ────────────────────────────────────────────────────────────────────
app.get('/api/bids', async (req, res) => {
  try {
    const filter = {};
    if (req.query.farmerId) filter.farmerId = req.query.farmerId;
    if (req.query.buyerId) filter.buyerId = req.query.buyerId;
    if (req.query.cropId) filter.cropId = req.query.cropId;
    res.json(await dbFind(Bid, filter));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/bids', async (req, res) => {
  try { res.json(await dbInsert(Bid, req.body)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/bids/:id', async (req, res) => {
  try {
    const updated = await dbUpdate(Bid, req.params.id, req.body);
    // Auto-update crop status on bid accept
    if (req.body.status === 'accepted') {
      const bid = await Bid.findOne({ id: req.params.id }).lean();
      if (bid) await dbUpdate(Crop, bid.cropId, { status: 'reserved' });
    }
    res.json(updated || { error: 'Not found' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── LOGISTICS ───────────────────────────────────────────────────────────────
app.get('/api/logistics', async (req, res) => {
  try {
    const filter = {};
    if (req.query.available === 'true') filter.available = true;
    if (req.query.userId) filter.userId = req.query.userId;
    res.json(await dbFind(Logistics, filter));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/logistics', async (req, res) => {
  try { res.json(await dbInsert(Logistics, req.body)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/logistics/:id', async (req, res) => {
  try {
    const updated = await dbUpdate(Logistics, req.params.id, req.body);
    res.json(updated || { error: 'Not found' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/logistics/:id', async (req, res) => {
  try { await dbDelete(Logistics, req.params.id); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── BOOKINGS ────────────────────────────────────────────────────────────────
app.get('/api/bookings', async (req, res) => {
  try {
    const filter = {};
    if (req.query.farmerId) filter.farmerId = req.query.farmerId;
    if (req.query.buyerId) filter.buyerId = req.query.buyerId;
    if (req.query.logisticsId) filter.logisticsId = req.query.logisticsId;
    res.json(await dbFind(Booking, filter));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/bookings', async (req, res) => {
  try { res.json(await dbInsert(Booking, req.body)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/bookings/:id', async (req, res) => {
  try {
    const updated = await dbUpdate(Booking, req.params.id, req.body);
    res.json(updated || { error: 'Not found' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
app.get('/api/notifications', async (req, res) => {
  try {
    const filter = {};
    if (req.query.userId) filter.userId = req.query.userId;
    const notifs = await dbFind(Notification, filter);
    notifs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(notifs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/notifications', async (req, res) => {
  try { res.json(await dbInsert(Notification, req.body)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/notifications/:id', async (req, res) => {
  try {
    const updated = await dbUpdate(Notification, req.params.id, req.body);
    res.json(updated || { error: 'Not found' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── MESSAGES (F4: In-App Messaging) ─────────────────────────────────────────
app.get('/api/messages/unread-count', async (req, res) => {
  try {
    const count = await Message.countDocuments({ receiverId: req.query.userId, read: false });
    res.json({ count });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/messages', async (req, res) => {
  try {
    const filter = {};
    if (req.query.bidId) filter.bidId = req.query.bidId;
    if (req.query.userId) {
      filter.$or = [{ senderId: req.query.userId }, { receiverId: req.query.userId }];
    }
    const msgs = await dbFind(Message, filter);
    msgs.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    res.json(msgs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/messages', async (req, res) => {
  try { res.json(await dbInsert(Message, { ...req.body, read: false })); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/messages/:id', async (req, res) => {
  try {
    const updated = await dbUpdate(Message, req.params.id, req.body);
    res.json(updated || { error: 'Not found' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── RATINGS (F5: Reputation System) ─────────────────────────────────────────
app.get('/api/ratings/farmer-score/:farmerId', async (req, res) => {
  try {
    const ratings = await Rating.find({ farmerId: req.params.farmerId }).lean();
    if (ratings.length === 0) return res.json({ score: 0, count: 0 });
    const avg = ratings.reduce((sum, r) => sum + (r.stars || 0), 0) / ratings.length;
    res.json({ score: Math.round(avg * 10) / 10, count: ratings.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/ratings', async (req, res) => {
  try {
    const filter = {};
    if (req.query.farmerId) filter.farmerId = req.query.farmerId;
    if (req.query.buyerId) filter.buyerId = req.query.buyerId;
    res.json(await dbFind(Rating, filter));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/ratings', async (req, res) => {
  try {
    // One rating per buyer per crop
    const existing = await Rating.findOne({ buyerId: req.body.buyerId, cropId: req.body.cropId }).lean();
    if (existing) {
      const updated = await dbUpdate(Rating, existing.id, req.body);
      return res.json(updated);
    }
    res.json(await dbInsert(Rating, req.body));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── STATS (Dashboard) ───────────────────────────────────────────────────────
app.get('/api/stats', async (req, res) => {
  try {
    const [users, crops, bids, bookings, notifications] = await Promise.all([
      User.countDocuments(), Crop.countDocuments(),
      Bid.countDocuments(), Booking.countDocuments(), Notification.countDocuments(),
    ]);
    res.json({ users, crops, bids, bookings, notifications });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── MANDI PRICES (F3) ───────────────────────────────────────────────────────
const FALLBACK_MANDI = [
  { commodity: 'Tomato',    market: 'Vellore',    state: 'Tamil Nadu',   minPrice: 18,  maxPrice: 28,  modalPrice: 22,  date: new Date().toLocaleDateString('en-IN') },
  { commodity: 'Wheat',     market: 'Delhi',       state: 'Delhi',        minPrice: 25,  maxPrice: 32,  modalPrice: 28,  date: new Date().toLocaleDateString('en-IN') },
  { commodity: 'Rice',      market: 'Chennai',     state: 'Tamil Nadu',   minPrice: 28,  maxPrice: 38,  modalPrice: 32,  date: new Date().toLocaleDateString('en-IN') },
  { commodity: 'Potato',    market: 'Agra',        state: 'UP',           minPrice: 12,  maxPrice: 22,  modalPrice: 16,  date: new Date().toLocaleDateString('en-IN') },
  { commodity: 'Onion',     market: 'Nashik',      state: 'Maharashtra',  minPrice: 15,  maxPrice: 28,  modalPrice: 20,  date: new Date().toLocaleDateString('en-IN') },
  { commodity: 'Corn',      market: 'Pune',        state: 'Maharashtra',  minPrice: 14,  maxPrice: 24,  modalPrice: 18,  date: new Date().toLocaleDateString('en-IN') },
  { commodity: 'Sugarcane', market: 'Coimbatore',  state: 'Tamil Nadu',   minPrice: 30,  maxPrice: 42,  modalPrice: 35,  date: new Date().toLocaleDateString('en-IN') },
  { commodity: 'Turmeric',  market: 'Erode',       state: 'Tamil Nadu',   minPrice: 100, maxPrice: 145, modalPrice: 120, date: new Date().toLocaleDateString('en-IN') },
  { commodity: 'Banana',    market: 'Trichy',      state: 'Tamil Nadu',   minPrice: 18,  maxPrice: 35,  modalPrice: 25,  date: new Date().toLocaleDateString('en-IN') },
  { commodity: 'Cotton',    market: 'Nagpur',      state: 'Maharashtra',  minPrice: 55,  maxPrice: 78,  modalPrice: 65,  date: new Date().toLocaleDateString('en-IN') },
  { commodity: 'Groundnut', market: 'Rajkot',      state: 'Gujarat',      minPrice: 55,  maxPrice: 72,  modalPrice: 62,  date: new Date().toLocaleDateString('en-IN') },
  { commodity: 'Mustard',   market: 'Jaipur',      state: 'Rajasthan',    minPrice: 48,  maxPrice: 62,  modalPrice: 54,  date: new Date().toLocaleDateString('en-IN') },
];

app.get('/api/mandi', async (req, res) => {
  let data = FALLBACK_MANDI;
  const { commodity, state } = req.query;
  try {
    const apiKey = '579b464db66ec23d' + '17d7e46dc87d3b6';
    const url = `https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?api-key=${apiKey}&format=json&limit=50`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (resp.ok) {
      const json = await resp.json();
      if (json.records?.length > 0) {
        data = json.records.map(r => ({
          commodity: r.commodity, market: r.market, state: r.state,
          minPrice: Number(r.min_price) || 0, maxPrice: Number(r.max_price) || 0,
          modalPrice: Number(r.modal_price) || 0,
          date: r.arrival_date || new Date().toLocaleDateString('en-IN'),
        }));
      }
    }
  } catch (_) { /* use fallback */ }
  if (commodity) data = data.filter(d => d.commodity.toLowerCase().includes(commodity.toLowerCase()));
  if (state) data = data.filter(d => d.state.toLowerCase().includes(state.toLowerCase()));
  res.json(data);
});

// ─── AI CHATBOT ───────────────────────────────────────────────────────────────
function getFallbackReply(message, profile, crops) {
  const msg = message.toLowerCase();
  const cropList = Array.isArray(crops) && crops.length > 0 ? crops.map(c => c.type).join(', ') : null;

  if (msg.includes('price') || msg.includes('rate') || msg.includes('cost')) {
    const prices = { tomato: 22, wheat: 28, rice: 32, potato: 16, onion: 20, corn: 18, sugarcane: 35, turmeric: 120, banana: 25, cotton: 65 };
    for (const [crop, price] of Object.entries(prices)) {
      if (msg.includes(crop)) return `Current mandi price for ${crop} is approximately ₹${price}/kg. Consider listing on the marketplace to attract competitive bids.`;
    }
    return `Mandi prices today: Tomato ₹22/kg, Wheat ₹28/kg, Rice ₹32/kg, Potato ₹16/kg, Onion ₹20/kg.`;
  }
  if (msg.includes('harvest') || msg.includes('when')) {
    if (cropList) return `For your crops (${cropList}), harvest at peak maturity — firm texture, full color. Early morning is ideal to reduce moisture loss.`;
    return `Harvest crops at peak maturity for best market prices. Early morning is ideal to preserve freshness.`;
  }
  if (msg.includes('weather') || msg.includes('rain')) {
    return `Check the weather card on your dashboard. If rain is expected within 48 hours, prioritize harvesting ripe crops and cover stored produce.`;
  }
  if (msg.includes('fertilizer') || msg.includes('pest') || msg.includes('disease')) {
    return `For organic pest management, use neem oil spray (5ml/litre) every 7-10 days. Apply NPK fertilizer during vegetative stage.`;
  }
  if (msg.includes('sell') || msg.includes('market') || msg.includes('profit')) {
    if (cropList) return `To maximize profit for ${cropList}: list on Marketplace with a competitive base price, wait for buyer bids, and accept the best offer.`;
    return `List your crops on HarvestOptima Marketplace to receive bids from institutional buyers. Quality grading can increase your price by 15-20%.`;
  }
  if (msg.includes('transport') || msg.includes('logistics') || msg.includes('delivery')) {
    return `Use the Logistics tab to find available transport providers. Book 24-48 hours before harvest to secure the best rates.`;
  }
  if (msg.includes('hello') || msg.includes('hi') || msg.includes('hey')) {
    return `Hello ${profile?.name || 'there'}! 👋 I'm your HarvestOptima AI assistant. Ask me about crop prices, harvest timing, pest control, or selling strategies!`;
  }
  if (cropList) return `I can help with your ${cropList} crops! Ask me about pricing, harvest time, pest control, or marketplace tips.`;
  return `I'm your agricultural assistant! I can help with:\n• 💰 Crop prices & market rates\n• 🌾 Harvest timing\n• 🐛 Pest & disease management\n• 🚚 Logistics & transport\n• 📊 Selling strategies`;
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

  const apiKeys = [
    process.env.GEMINI_API_KEY,
    'AIzaSyCUqaQ8PTzhEBnNYl1VEXaCUiC7myOID8M',
  ].filter(Boolean);

  for (const apiKey of apiKeys) {
    try {
      const genAI = new GoogleGenAI({ apiKey });
      const result = await genAI.models.generateContent({ model: 'gemini-2.0-flash-lite', contents: prompt });
      if (result.text) {
        console.log('✅ Gemini responded');
        return res.json({ reply: result.text });
      }
    } catch (err) {
      if (err?.message?.includes('429') || err?.message?.includes('RESOURCE_EXHAUSTED')) {
        console.warn('⚠️  Quota exceeded, trying next key...');
        continue;
      }
      console.error('Gemini error:', err?.message);
      break;
    }
  }
  console.log('🤖 Using offline fallback');
  return res.json({ reply: `${getFallbackReply(message, profile, crops)}\n\n_⚡ Offline mode_` });
});

// ─── CONNECT TO MONGODB & START SERVER ───────────────────────────────────────
async function startServer() {
  let connected = false;
  let mongoUri = MONGO_URI;

  try {
    console.log(`\n🔄 Attempting connection to local MongoDB → ${MONGO_URI}`);
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 3000 });
    connected = true;
    console.log(`🍃 MongoDB connected → ${MONGO_URI}`);
  } catch (err) {
    console.warn(`⚠️  Could not connect to standard MongoDB (is it installed and running?)`);
    console.log(`🚀 Starting Embedded MongoDB automatically...`);

    const dbPath = path.join(__dirname, 'mongo-data');
    if (!fs.existsSync(dbPath)) fs.mkdirSync(dbPath);

    try {
      const mongoServer = await MongoMemoryServer.create({
        instance: { dbPath, port: 27018 }
      });
      mongoUri = mongoServer.getUri();
      await mongoose.connect(mongoUri);
      connected = true;
      console.log(`🍃 Embedded MongoDB connected → ${mongoUri}`);
    } catch (embErr) {
      console.error('❌ Failed to start embedded MongoDB:', embErr.message);
      process.exit(1);
    }
  }

  if (connected) {
    console.log('🔄 Checking for data migration from db.json...');
    await migrateFromJsonFile();
    app.listen(PORT, () => {
      console.log(`🌾 HarvestOptima API running at http://localhost:${PORT}`);
      console.log(`📊 Database: harvestoptima (MongoDB)\n`);
    });
  }
}

startServer();

mongoose.connection.on('disconnected', () => console.warn('⚠️  MongoDB disconnected'));
mongoose.connection.on('reconnected', () => console.log('✅ MongoDB reconnected'));
