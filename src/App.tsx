import React, { useState, useEffect, useRef } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  onSnapshot, 
  query, 
  where,
  addDoc,
  updateDoc,
  Timestamp,
  getDocFromServer
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { 
  Sprout, 
  TrendingUp, 
  Truck, 
  ShoppingBag, 
  LogOut, 
  Plus, 
  Calendar, 
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Mic,
  MicOff,
  Languages,
  Volume2,
  MessageSquare,
  Send,
  Bot,
  X,
  MapPin
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { format, addDays } from 'date-fns';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { cn } from './lib/utils';
import { translations, historicalMandiData, CROP_TYPES, LOCATIONS } from './constants';

// Initialize Gemini AI
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// Fix Leaflet marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// --- Types ---
type Lang = 'en' | 'ta' | 'hi';
type Role = 'farmer' | 'buyer' | 'transporter';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: Role;
  location?: string;
  companyName?: string;
}

interface Crop {
  id: string;
  farmerId: string;
  type: string;
  quantity: number;
  expectedHarvestDate: string;
  status: 'growing' | 'ready' | 'harvested' | 'sold';
  location: string;
  optimalHarvestDate?: string;
  advice?: string;
  priceTrend?: string;
}

interface Bid {
  id: string;
  cropId: string;
  buyerId: string;
  buyerName: string;
  companyName?: string;
  amount: number;
  status: 'pending' | 'accepted' | 'rejected';
  timestamp: any;
}

// --- Components ---

const VoiceVisualizer = ({ isRecording, isSpeaking }: { isRecording: boolean, isSpeaking: boolean }) => {
  return (
    <div className="relative flex items-center justify-center w-12 h-12">
      <AnimatePresence>
        {(isRecording || isSpeaking) && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0.1, 0.3] }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
            className={cn(
              "absolute inset-0 rounded-full",
              isRecording ? "bg-red-500" : "bg-emerald-500"
            )}
          />
        )}
      </AnimatePresence>
      
      <svg viewBox="0 0 24 24" className="w-6 h-6 relative z-10">
        <defs>
          <linearGradient id="voiceGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={isRecording ? "#ef4444" : "#10b981"} />
            <stop offset="100%" stopColor={isRecording ? "#b91c1c" : "#059669"} />
          </linearGradient>
        </defs>
        
        {isRecording || isSpeaking ? (
          <motion.g
            animate={{ y: [0, -2, 0] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
          >
            {/* Animated Sound Waves */}
            {[0, 1, 2].map((i) => (
              <motion.rect
                key={i}
                x={6 + i * 5}
                y={8}
                width={3}
                height={8}
                rx={1.5}
                fill="url(#voiceGradient)"
                animate={{ 
                  height: isRecording ? [8, 16, 8] : [8, 12, 8],
                  y: isRecording ? [8, 4, 8] : [8, 6, 8]
                }}
                transition={{ 
                  repeat: Infinity, 
                  duration: 0.5, 
                  delay: i * 0.1,
                  ease: "easeInOut"
                }}
              />
            ))}
          </motion.g>
        ) : (
          <path
            d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z M19 10v2a7 7 0 0 1-14 0v-2 M12 19v4 M8 23h8"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
    </div>
  );
};

function MarketIntelligence({ location, t, lang }: { location: string, t: any, lang: Lang }) {
  const [mandiData, setMandiData] = useState<any[]>([]);
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const [timeframe, setTimeframe] = useState<'daily' | 'weekly'>('daily');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMarketData = async () => {
      if (!location) return;
      setLoading(true);
      setError(null);
      try {
        const prompt = `Fetch real-time Mandi prices for ${location} for major crops like Tomato, Wheat, Rice, Corn, Potato, Onion. 
        Also provide historical price data for the last 7 days (if daily) or 4 weeks (if weekly).
        Return the data in JSON format:
        {
          "current": [{"crop": "Tomato", "price": 25, "unit": "kg", "market": "Vellore"}],
          "historical": [{"date": "2024-03-27", "Tomato": 24, "Wheat": 30, "Rice": 32, "Corn": 20, "Potato": 18, "Onion": 15}]
        }`;

        const response = await genAI.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: prompt,
          config: {
            tools: [{ googleSearch: {} }],
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                current: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      crop: { type: Type.STRING },
                      price: { type: Type.NUMBER },
                      unit: { type: Type.STRING },
                      market: { type: Type.STRING }
                    }
                  }
                },
                historical: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      date: { type: Type.STRING },
                      Tomato: { type: Type.NUMBER },
                      Wheat: { type: Type.NUMBER },
                      Rice: { type: Type.NUMBER },
                      Corn: { type: Type.NUMBER },
                      Potato: { type: Type.NUMBER },
                      Onion: { type: Type.NUMBER }
                    }
                  }
                }
              }
            }
          }
        });

        const text = response.text || "{}";
        const data = JSON.parse(text);
        setMandiData(data.current || []);
        setHistoricalData(data.historical || []);
      } catch (err: any) {
        console.error("Market data fetch failed:", err);
        setError(err.message || "Failed to fetch market data");
      } finally {
        setLoading(false);
      }
    };

    fetchMarketData();
  }, [location, timeframe]);

  return (
    <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-emerald-50 space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 rounded-xl">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-emerald-950">{t.market_intelligence}</h2>
        </div>
        <div className="flex bg-emerald-50 p-1 rounded-xl">
          {(['daily', 'weekly'] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                timeframe === tf ? "bg-white text-emerald-600 shadow-sm" : "text-emerald-900/40 hover:text-emerald-900"
              )}
            >
              {t[tf]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 border-4 border-emerald-100 rounded-full" />
            <div className="absolute top-0 left-0 w-12 h-12 border-4 border-emerald-600 rounded-full border-t-transparent animate-spin" />
          </div>
          <p className="text-xs font-bold text-emerald-900/40 animate-pulse uppercase tracking-widest">{t.fetching_real_time_data || "Fetching Live Data..."}</p>
        </div>
      ) : error ? (
        <div className="h-64 flex flex-col items-center justify-center gap-4 text-center">
          <AlertCircle className="w-8 h-8 text-red-400" />
          <p className="text-sm text-emerald-900/60 max-w-[200px]">{error}</p>
          <button 
            onClick={() => setTimeframe(timeframe)} // Trigger re-fetch
            className="px-6 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all"
          >
            {t.retry || "Retry"}
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {mandiData.map((item, i) => (
              <div key={i} className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                <p className="text-[10px] font-bold text-emerald-900/40 uppercase tracking-wider mb-1">{item.crop}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold text-emerald-950">${item.price}</span>
                  <span className="text-[10px] text-emerald-900/40">/{item.unit}</span>
                </div>
                <p className="text-[10px] text-emerald-600 font-medium mt-1">{item.market}</p>
              </div>
            ))}
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={historicalData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0fdf4" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#064e3b', opacity: 0.4 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#064e3b', opacity: 0.4 }}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Line type="monotone" dataKey="Tomato" stroke="#10b981" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="Wheat" stroke="#f59e0b" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="Rice" stroke="#3b82f6" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}

function BidsView({ bids, crops, profile, t }: { bids: Bid[], crops: Crop[], profile: UserProfile, t: any }) {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-emerald-950">{t.active_bids}</h2>
        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-full">
          <Clock className="w-4 h-4 text-emerald-600" />
          <span className="text-sm font-bold text-emerald-950">{bids.length} {t.pending_bids}</span>
        </div>
      </div>

      <div className="grid gap-6">
        {bids.map(bid => {
          const crop = crops.find(c => c.id === bid.cropId);
          return (
            <div key={bid.id} className="bg-white p-6 rounded-[2rem] border border-emerald-50 shadow-sm hover:shadow-md transition-all flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="p-4 bg-emerald-50 rounded-2xl">
                  <ShoppingBag className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-emerald-950">{crop?.type || 'Unknown Crop'}</h3>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full uppercase tracking-wider">
                      {bid.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-emerald-900/40">
                    <div className="flex items-center gap-1">
                      <Bot className="w-4 h-4" />
                      <span className="font-medium">{bid.companyName || bid.buyerName}</span>
                      <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[8px] font-bold rounded uppercase tracking-tighter ml-1">
                        {t.sponsor}
                      </span>
                    </div>
                    <span>•</span>
                    <span>{format(bid.timestamp?.toDate() || new Date(), 'MMM d, yyyy')}</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-emerald-600">${bid.amount}/kg</p>
                <p className="text-xs text-emerald-900/40">{t.total_bids}: {bid.amount * (crop?.quantity || 0)}</p>
              </div>
            </div>
          );
        })}
        {bids.length === 0 && (
          <div className="p-12 text-center bg-white rounded-[2rem] border-2 border-dashed border-emerald-100">
            <Clock className="w-12 h-12 text-emerald-200 mx-auto mb-4" />
            <p className="text-emerald-900/40">No active bids yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

const SystemStatus = ({ t }: { t: any }) => {
  const [status, setStatus] = useState<'healthy' | 'degraded'>('healthy');
  const [lastError, setLastError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const checkHealth = async () => {
    setIsChecking(true);
    try {
      const response = await window.fetch('/api/health');
      if (response.ok) {
        setStatus('healthy');
        setLastError(null);
      } else {
        throw new Error(`Health check failed with status: ${response.status}`);
      }
    } catch (e: any) {
      const msg = e.message || String(e);
      if (!msg.includes('fetch') && !msg.includes('only a getter')) {
        setStatus('degraded');
        setLastError(msg);
      }
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    const handleError = (e: any) => {
      const msg = e.message || e.reason?.message || String(e);
      // Suppress known environment-specific errors from degrading the UI status
      if (msg.includes('Cannot set property fetch') || msg.includes('only a getter')) {
        console.warn('SystemStatus suppressed a known environment error:', msg);
        return;
      }
      setStatus('degraded');
      setLastError(msg);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleError);
    
    // Initial health check
    checkHealth();

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleError);
    };
  }, []);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {status === 'degraded' && (
        <motion.button
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={checkHealth}
          disabled={isChecking}
          className="px-4 py-2 bg-emerald-950 text-white rounded-xl text-xs font-bold shadow-lg hover:bg-emerald-900 transition-all flex items-center gap-2"
        >
          {isChecking ? <Clock className="w-3 h-3 animate-spin" /> : <TrendingUp className="w-3 h-3" />}
          {t.retry_check}
        </motion.button>
      )}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "px-4 py-2 rounded-full shadow-lg border flex items-center gap-2 text-xs font-bold uppercase tracking-wider",
          status === 'healthy' 
            ? "bg-emerald-50 border-emerald-100 text-emerald-600" 
            : "bg-orange-50 border-orange-100 text-orange-600"
        )}
      >
        <div className={cn(
          "w-2 h-2 rounded-full animate-pulse",
          status === 'healthy' ? "bg-emerald-500" : "bg-orange-500"
        )} />
        {status === 'healthy' 
          ? t.system_healthy 
          : t.system_degraded}
        {status === 'degraded' && (
          <button 
            onClick={() => alert(`Last Error: ${lastError}`)}
            className="ml-2 underline opacity-50 hover:opacity-100"
          >
            {t.details}
          </button>
        )}
      </motion.div>
    </div>
  );
};

const ErrorBoundary = ({ children, t }: { children: React.ReactNode, t: any }) => {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleError = (e: ErrorEvent) => {
      const msg = e.message || "";
      // Suppress known environment-specific errors from crashing the app
      if (msg.includes('Cannot set property fetch') || msg.includes('only a getter')) {
        console.warn('ErrorBoundary suppressed a known environment error:', msg);
        return;
      }
      console.error("Caught error:", e.error);
      setHasError(true);
      setError(msg);
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-red-100">
          <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {t.something_went_wrong}
          </h2>
          <p className="text-gray-600 mb-6">{error || "An unexpected error occurred."}</p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors"
          >
            {t.reload_app}
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

const LocationAutocomplete = ({ value, onChange, placeholder, t }: { value: string, onChange: (val: string) => void, placeholder: string, t: any }) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const cache = useRef<Record<string, string[]>>({});

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (value.length < 3 || !showSuggestions) {
        setSuggestions([]);
        return;
      }

      if (cache.current[value]) {
        setSuggestions(cache.current[value]);
        return;
      }

      setIsLoading(true);
      try {
        const result = await genAI.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `Provide a list of 5 real location suggestions in India matching the query: "${value}". 
          Return ONLY a JSON array of strings. 
          Example: ["Chennai, Tamil Nadu", "Vellore, Tamil Nadu"]`,
          config: {
            responseMimeType: "application/json",
          }
        });
        const data = JSON.parse(result.text);
        if (Array.isArray(data)) {
          cache.current[value] = data;
          setSuggestions(data);
        }
      } catch (e: any) {
        if (e.message?.includes('429')) {
          console.warn("Rate limit hit for autocomplete");
        } else {
          console.error("Autocomplete failed:", e);
        }
      } finally {
        setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(fetchSuggestions, 800);
    return () => clearTimeout(timeoutId);
  }, [value, showSuggestions]);

  return (
    <div className="relative w-full">
      <div className="relative">
        <input 
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder={placeholder}
          className="w-full px-4 py-3 bg-emerald-50 rounded-xl border-none focus:ring-2 focus:ring-emerald-600 shadow-sm"
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Clock className="w-4 h-4 text-emerald-400 animate-spin" />
          </div>
        )}
      </div>
      <AnimatePresence>
        {showSuggestions && suggestions.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute z-50 w-full mt-2 bg-white rounded-2xl shadow-xl border border-emerald-50 overflow-hidden"
          >
            {suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  onChange(s);
                  setShowSuggestions(false);
                }}
                className="w-full px-4 py-3 text-left hover:bg-emerald-50 transition-colors text-sm text-emerald-950 border-b border-emerald-50 last:border-none"
              >
                {s}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const WeatherWidget = ({ profile, t, lang }: { profile: UserProfile, t: any, lang: Lang }) => {
  const [weather, setWeather] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [newLocation, setNewLocation] = useState(profile.location || '');

  const fetchWeather = async (loc?: string) => {
    const cacheKey = `weather_${loc || 'geo'}_${lang}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < 30 * 60 * 1000) { // 30 mins cache
        setWeather(data);
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    try {
      const langName = lang === 'ta' ? 'Tamil' : lang === 'hi' ? 'Hindi' : 'English';
      let prompt = '';
      if (loc) {
        prompt = `Get the current weather for ${loc}. Respond in ${langName}.`;
      } else {
        // Fallback to geolocation if no location set
        navigator.geolocation.getCurrentPosition(async (pos) => {
          const { latitude, longitude } = pos.coords;
          try {
            const result = await genAI.models.generateContent({ 
              model: "gemini-3-flash-preview",
              contents: `Get the current weather for coordinates ${latitude}, ${longitude}. 
              Respond in ${langName}.
              CRITICAL: Respond ONLY in ${langName}. Translate all content including location names and technical terms to ${langName}.
              Return ONLY JSON with:
              {
                "temperature": "string (e.g. 28°C)",
                "condition": "string (e.g. Sunny)",
                "location": "string (city name)",
                "humidity": "string",
                "windSpeed": "string",
                "forecast": "string (short sentence)"
              }`
            });
            const text = result.text;
            const data = JSON.parse(text.replace(/```json|```/g, ''));
            localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
            setWeather(data);
          } catch (e: any) {
            console.error("Geo weather fetch failed:", e);
            setWeather({ temperature: "N/A", condition: "Error", location: "Unknown", humidity: "N/A", windSpeed: "N/A" });
          } finally {
            setLoading(false);
          }
        }, () => {
          setLoading(false);
          setWeather({ temperature: "N/A", condition: "Unknown", location: "Please set location", humidity: "N/A", windSpeed: "N/A" });
        });
        return;
      }

      const result = await genAI.models.generateContent({ 
        model: "gemini-3-flash-preview",
        contents: `${prompt} 
        Respond in ${langName}.
        CRITICAL: Respond ONLY in ${langName}. Translate all content including location names and technical terms to ${langName}.
        Return ONLY JSON with:
        {
          "temperature": "string (e.g. 28°C)",
          "condition": "string (e.g. Sunny)",
          "location": "string (city name)",
          "humidity": "string",
          "windSpeed": "string",
          "forecast": "string (short sentence)"
        }`
      });
      
      const text = result.text;
      const data = JSON.parse(text.replace(/```json|```/g, ''));
      localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
      setWeather(data);
    } catch (e: any) {
      if (e.message?.includes('429')) {
        console.warn("Rate limit hit for weather");
        // Try to use expired cache if available
        if (cached) {
          const { data } = JSON.parse(cached);
          setWeather(data);
        } else {
          setWeather({ temperature: "N/A", condition: "Limit Hit", location: loc || "Unknown", humidity: "N/A", windSpeed: "N/A" });
        }
      } else {
        console.error("Weather fetch failed:", e);
        setWeather({ temperature: "N/A", condition: "Error", location: loc || "Unknown", humidity: "N/A", windSpeed: "N/A" });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile.location) {
      fetchWeather(profile.location);
    } else {
      fetchWeather();
    }
  }, [profile.location, lang]);

  const handleUseCurrentLocation = () => {
    setLoading(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      const cacheKey = `geo_${latitude.toFixed(3)}_${longitude.toFixed(3)}`;
      const cached = localStorage.getItem(cacheKey);
      
      const processLocation = async (locName: string) => {
        setNewLocation(locName);
        try {
          await updateDoc(doc(db, 'users', profile.uid), {
            location: locName
          });
          setIsEditing(false);
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `users/${profile.uid}`);
        }
      };

      if (cached) {
        await processLocation(cached);
        setLoading(false);
        return;
      }

      try {
        const result = await genAI.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `What is the city and state for coordinates ${latitude}, ${longitude}? 
          Return ONLY the name (e.g. "Chennai, Tamil Nadu").`
        });
        const locName = result.text.trim();
        localStorage.setItem(cacheKey, locName);
        await processLocation(locName);
      } catch (e: any) {
        if (e.message?.includes('429')) {
          console.warn("Rate limit hit for geocoding");
          alert("Location service busy. Please try again in a moment.");
        } else {
          console.error("Failed to get location name:", e);
        }
      } finally {
        setLoading(false);
      }
    }, (err) => {
      console.error("Geolocation failed:", err);
      setLoading(false);
      alert("Could not get your current location. Please enter it manually.");
    });
  };

  const handleUpdateLocation = async () => {
    if (!newLocation.trim()) return;
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        location: newLocation
      });
      setIsEditing(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${profile.uid}`);
    }
  };

  if (loading) return <div className="p-6 bg-white rounded-3xl animate-pulse h-32" />;

  return (
    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-emerald-50 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        {isEditing ? (
          <div className="flex flex-col gap-3 flex-1">
            <div className="flex items-center gap-2">
              <LocationAutocomplete 
                value={newLocation}
                onChange={setNewLocation}
                placeholder={t.enter_location_placeholder}
                t={t}
              />
              <button 
                onClick={handleUpdateLocation}
                className="p-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors shadow-sm"
              >
                <CheckCircle2 className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setIsEditing(false)}
                className="p-3 bg-gray-100 text-gray-500 rounded-xl hover:bg-gray-200 transition-colors shadow-sm"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <button 
              onClick={handleUseCurrentLocation}
              className="flex items-center justify-center gap-2 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-colors"
            >
              <MapPin className="w-3 h-3" />
              {t.use_current_location || "Use My Current Location"}
            </button>
          </div>
        ) : (
          <>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h4 className="text-sm font-bold text-emerald-950">{weather?.location || "Loading..."}</h4>
                <button onClick={() => setIsEditing(true)} className="p-1 hover:bg-emerald-50 rounded-lg transition-colors">
                  <MapPin className="w-3 h-3 text-emerald-600" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-3xl font-bold text-emerald-600">{weather?.temperature}</span>
                <span className="text-emerald-900/40 text-sm">{weather?.condition}</span>
              </div>
            </div>
            <div className="text-right text-xs text-emerald-900/40 space-y-1">
              <p>{t.humidity}: {weather?.humidity}</p>
              <p>{t.wind}: {weather?.windSpeed}</p>
            </div>
          </>
        )}
      </div>
      {weather?.forecast && !isEditing && (
        <p className="text-[10px] text-emerald-900/50 italic border-t border-emerald-50 pt-3">
          {t.ai_forecast}: {weather.forecast}
        </p>
      )}
    </div>
  );
};

const MapWidget = ({ profile, t, lang }: { profile: UserProfile, t: any, lang: Lang }) => {
  const [pos, setPos] = useState<[number, number] | null>(null);

  useEffect(() => {
    const geocode = async () => {
      if (profile.location) {
        const cacheKey = `geocode_${profile.location}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          try {
            const data = JSON.parse(cached);
            if (data.lat && data.lng) {
              setPos([data.lat, data.lng]);
              return;
            }
          } catch (e) {
            localStorage.removeItem(cacheKey);
          }
        }

        try {
          const result = await genAI.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Get the latitude and longitude for ${profile.location}. 
            Return ONLY JSON with:
            {
              "lat": number,
              "lng": number
            }`
          });
          const text = result.text;
          const data = JSON.parse(text.replace(/```json|```/g, ''));
          if (data.lat && data.lng) {
            localStorage.setItem(cacheKey, JSON.stringify(data));
            setPos([data.lat, data.lng]);
          }
        } catch (e: any) {
          if (e.message?.includes('429')) {
            console.warn("Rate limit hit for geocoding in MapWidget");
          } else {
            console.error("Geocoding failed:", e);
          }
          // Fallback to geolocation if geocoding fails
          navigator.geolocation.getCurrentPosition((p) => {
            setPos([p.coords.latitude, p.coords.longitude]);
          }, () => {
            setPos([20.5937, 78.9629]); // India center
          });
        }
      } else {
        navigator.geolocation.getCurrentPosition((p) => {
          setPos([p.coords.latitude, p.coords.longitude]);
        }, () => {
          setPos([20.5937, 78.9629]); // India center
        });
      }
    };
    geocode();
  }, [profile.location]);

  if (!pos) return <div className="h-64 bg-emerald-50 rounded-[2rem] animate-pulse" />;

  return (
    <div className="h-64 bg-white rounded-[2rem] shadow-sm border border-emerald-50 overflow-hidden relative z-0">
      <MapContainer center={pos} zoom={13} style={{ height: '100%', width: '100%' }} key={`${pos[0]}-${pos[1]}`}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Marker position={pos}>
          <Popup>{profile.location || t.location}</Popup>
        </Marker>
      </MapContainer>
    </div>
  );
};

const HarvestPlanModal = ({ crop, location, onClose, t, lang }: { crop: Crop, location: string, onClose: () => void, t: any, lang: Lang }) => {
  const [plan, setPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const generate = async () => {
      const cacheKey = `harvest_plan_${crop.id}_${lang}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 24 * 60 * 60 * 1000) { // 24 hours cache
          setPlan(data);
          setLoading(false);
          return;
        }
      }

      try {
        const langName = lang === 'ta' ? 'Tamil' : lang === 'hi' ? 'Hindi' : 'English';
        const result = await genAI.models.generateContent({ 
          model: "gemini-3-flash-preview",
          contents: `Create a detailed harvest and post-harvest plan for ${crop.type} in ${location}.
          CRITICAL: Respond ONLY in ${langName}. Translate all content including location names and technical terms to ${langName}.
          
          Provide:
          1. Exact harvest window.
          2. Post-harvest storage tips to reduce waste.
          3. Transport recommendations.
          4. Expected market demand.
          
          Return in Markdown format.`
        });
        
        const responseText = result.text;
        localStorage.setItem(cacheKey, JSON.stringify({ data: responseText, timestamp: Date.now() }));
        setPlan(responseText);
      } catch (e: any) {
        if (e.message?.includes('429')) {
          console.warn("Rate limit hit for harvest plan");
          if (cached) {
            const { data } = JSON.parse(cached);
            setPlan(data);
          } else {
            setPlan("AI service is busy. Please try again in a few minutes.");
          }
        } else {
          console.error("Harvest plan generation failed:", e);
          setPlan("Failed to generate plan. Please try again.");
        }
      } finally {
        setLoading(false);
      }
    };
    generate();
  }, [lang]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose} className="absolute inset-0 bg-emerald-950/40 backdrop-blur-sm" />
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="relative bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl p-10 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl font-bold text-emerald-950">{t.ai_plans}: {crop.type}</h2>
          <button onClick={onClose} className="p-2 hover:bg-emerald-50 rounded-full"><X className="w-6 h-6" /></button>
        </div>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}><Sprout className="w-12 h-12 text-emerald-600" /></motion.div>
            <p className="text-emerald-900/50 font-bold">{t.listening_ai}</p>
          </div>
        ) : (
          <div className="markdown-body">
            <Markdown>{plan || ""}</Markdown>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [lang, setLang] = useState<Lang>('en');

  const t = translations[lang];

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const docRef = doc(db, 'users', firebaseUser.uid);
        const unsubscribeProfile = onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
          }
          setLoading(false);
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
          setLoading(false);
        });
        return () => unsubscribeProfile();
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    // Connection test
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('offline')) {
          console.error("Firebase connection error: Client is offline or config is invalid.");
        }
      }
    };
    testConnection();

    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
        console.warn("Login popup was closed or cancelled.");
      } else {
        console.error("Login failed:", error);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleCompleteProfile = async (role: Role, location: string, companyName?: string) => {
    if (!user) return;
    const newProfile: UserProfile = {
      uid: user.uid,
      name: user.displayName || 'Anonymous',
      email: user.email || '',
      role: role,
      location: location,
      companyName: companyName,
    };
    try {
      await setDoc(doc(db, 'users', user.uid), newProfile);
      setProfile(newProfile);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FDFCFB]">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Sprout className="w-12 h-12 text-emerald-600" />
        </motion.div>
      </div>
    );
  }

  return (
    <ErrorBoundary t={t}>
      <SystemStatus t={t} />
      <div className="min-h-screen bg-[#FDFCFB] text-gray-900 font-sans selection:bg-emerald-100">
        <div className="fixed top-4 right-4 z-50 flex gap-2">
          <LanguageToggle current={lang} onSelect={setLang} />
        </div>
        {!user ? (
          <LandingPage onLogin={handleLogin} t={t} isLoggingIn={isLoggingIn} />
        ) : !profile ? (
          <RoleSelection onSelect={handleCompleteProfile} t={t} />
        ) : (
          <Dashboard profile={profile} t={t} lang={lang} />
        )}
      </div>
    </ErrorBoundary>
  );
}

function LanguageToggle({ current, onSelect }: { current: Lang, onSelect: (l: Lang) => void }) {
  return (
    <div className="bg-white/80 backdrop-blur-md p-1 rounded-full shadow-lg border border-emerald-100 flex gap-1">
      {(['en', 'ta', 'hi'] as Lang[]).map(l => (
        <button
          key={l}
          onClick={() => onSelect(l)}
          className={cn(
            "px-3 py-1 rounded-full text-xs font-bold transition-all",
            current === l ? "bg-emerald-600 text-white" : "text-emerald-900/50 hover:bg-emerald-50"
          )}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

// --- Sub-components ---

function LandingPage({ onLogin, t, isLoggingIn }: { onLogin: () => void, t: any, isLoggingIn: boolean }) {
  return (
    <div className="relative overflow-hidden">
      {/* Background Accents */}
      <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-[600px] h-[600px] bg-emerald-50 rounded-full blur-3xl opacity-50" />
      <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/4 w-[600px] h-[600px] bg-orange-50 rounded-full blur-3xl opacity-50" />

      <nav className="relative z-10 max-w-7xl mx-auto px-6 py-8 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-emerald-600 rounded-xl">
            <Sprout className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-emerald-950">HarvestOptima</span>
        </div>
        <button 
          onClick={onLogin}
          disabled={isLoggingIn}
          className="px-6 py-2.5 bg-emerald-950 text-white rounded-full font-medium hover:bg-emerald-900 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoggingIn ? '...' : t.welcome.split(' ')[0]}
        </button>
      </nav>

      <main className="relative z-10 max-w-7xl mx-auto px-6 pt-20 pb-32 grid lg:grid-cols-2 gap-16 items-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-semibold mb-6">
            <TrendingUp className="w-4 h-4" />
            <span>SDG 2 & 12 Aligned</span>
          </div>
          <h1 className="text-6xl lg:text-7xl font-bold text-emerald-950 leading-[1.1] mb-8">
            {t.welcome.split(' ')[0]} <br />
            <span className="text-emerald-600">{t.welcome.split(' ').slice(1).join(' ')}</span>
          </h1>
          <p className="text-xl text-emerald-900/70 mb-10 max-w-lg leading-relaxed">
            {t.tagline}. Empowering small-scale farmers with AI-driven harvest timing and direct access to institutional buyers.
          </p>
          <div className="flex flex-wrap gap-4">
            <button 
              onClick={onLogin}
              disabled={isLoggingIn}
              className="px-8 py-4 bg-emerald-600 text-white rounded-2xl font-bold text-lg hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 flex items-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoggingIn ? '...' : t.farmer}
              {!isLoggingIn && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
            </button>
            <button 
              onClick={onLogin}
              disabled={isLoggingIn}
              className="px-8 py-4 bg-white text-emerald-950 border-2 border-emerald-100 rounded-2xl font-bold text-lg hover:bg-emerald-50 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoggingIn ? '...' : t.buyer}
            </button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="relative"
        >
          <div className="relative z-10 bg-white p-8 rounded-[2rem] shadow-2xl border border-emerald-50">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-lg font-bold text-emerald-950">Market Demand</h3>
                <p className="text-sm text-emerald-900/50">Real-time matching</p>
              </div>
              <div className="p-3 bg-orange-100 rounded-2xl">
                <TrendingUp className="w-6 h-6 text-orange-600" />
              </div>
            </div>
            <div className="space-y-4">
              {[
                { label: 'Tomatoes', demand: 'High', price: '+12%', color: 'bg-red-500' },
                { label: 'Wheat', demand: 'Stable', price: '+2%', color: 'bg-amber-500' },
                { label: 'Potatoes', demand: 'Rising', price: '+8%', color: 'bg-yellow-600' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-4 p-4 bg-emerald-50/50 rounded-2xl">
                  <div className={cn("w-3 h-3 rounded-full", item.color)} />
                  <div className="flex-1">
                    <p className="font-bold text-emerald-950">{item.label}</p>
                    <p className="text-xs text-emerald-900/40">Demand: {item.demand}</p>
                  </div>
                  <span className="font-bold text-emerald-700">{item.price}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Decorative elements */}
          <div className="absolute -top-6 -right-6 w-32 h-32 bg-orange-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob" />
          <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-emerald-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000" />
        </motion.div>
      </main>
    </div>
  );
}

function RoleSelection({ onSelect, t }: { onSelect: (role: Role, location: string, companyName?: string) => void, t: any }) {
  const [selectedLocation, setSelectedLocation] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [activeRole, setActiveRole] = useState<Role | null>(null);

  const handleUseCurrentLocation = () => {
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      const cacheKey = `geo_${latitude.toFixed(3)}_${longitude.toFixed(3)}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        setSelectedLocation(cached);
        setIsLocating(false);
        return;
      }

      try {
        const result = await genAI.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `What is the city and state for coordinates ${latitude}, ${longitude}? 
          Return ONLY the name (e.g. "Chennai, Tamil Nadu").`
        });
        const locName = result.text.trim();
        localStorage.setItem(cacheKey, locName);
        setSelectedLocation(locName);
      } catch (e: any) {
        if (e.message?.includes('429')) {
          console.warn("Rate limit hit for geocoding");
          setSelectedLocation("Location unavailable (Limit)");
        } else {
          console.error("Failed to get location name:", e);
        }
      } finally {
        setIsLocating(false);
      }
    }, (err) => {
      console.error("Geolocation failed:", err);
      setIsLocating(false);
      alert("Could not get your current location. Please enter it manually.");
    });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#FDFCFB]">
      <div className="max-w-4xl w-full text-center mb-12">
        <h2 className="text-4xl font-bold text-emerald-950 mb-4">{t.select_role}</h2>
        <p className="text-emerald-900/60 text-lg mb-8">{t.tagline}</p>
        
        <div className="max-w-md mx-auto mb-12 space-y-6">
          <div>
            <label className="block text-sm font-bold text-emerald-950 mb-2">{t.location}</label>
            <div className="flex gap-2">
              <LocationAutocomplete 
                value={selectedLocation}
                onChange={setSelectedLocation}
                placeholder={t.enter_location_placeholder}
                t={t}
              />
              <button 
                onClick={handleUseCurrentLocation}
                disabled={isLocating}
                className="px-4 py-3 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-all disabled:opacity-50 shadow-sm"
                title="Use Current Location"
              >
                {isLocating ? <Clock className="w-5 h-5 animate-spin" /> : <MapPin className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <AnimatePresence>
            {activeRole === 'buyer' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <label className="block text-sm font-bold text-emerald-950 mb-2">{t.company}</label>
                <input 
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Reliance Fresh, BigBasket"
                  className="w-full px-4 py-3 bg-white border border-emerald-100 rounded-xl focus:ring-2 focus:ring-emerald-600 outline-none"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      
      <div className="grid md:grid-cols-3 gap-8 max-w-5xl w-full">
        {[
          { id: 'farmer', title: t.farmer, icon: Sprout, desc: 'List crops, get AI advice, and sell directly.' },
          { id: 'buyer', title: t.buyer, icon: ShoppingBag, desc: 'Source fresh produce directly from farms.' },
          { id: 'transporter', title: t.logistics, icon: Truck, desc: 'Help transport goods and reduce waste.' },
        ].map((role) => (
          <motion.button
            key={role.id}
            whileHover={{ y: -8 }}
            whileTap={{ scale: 0.98 }}
            disabled={!selectedLocation.trim()}
            onClick={() => {
              if (role.id === 'buyer' && activeRole !== 'buyer') {
                setActiveRole('buyer');
              } else {
                onSelect(role.id as Role, selectedLocation, role.id === 'buyer' ? companyName : undefined);
              }
            }}
            className={cn(
              "bg-white p-8 rounded-[2.5rem] shadow-xl shadow-emerald-900/5 border border-emerald-50 text-left group transition-all",
              !selectedLocation.trim() ? "opacity-50 cursor-not-allowed" : "hover:border-emerald-200",
              activeRole === role.id ? "ring-2 ring-emerald-600" : ""
            )}
          >
            <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-emerald-600 transition-colors">
              <role.icon className="w-8 h-8 text-emerald-600 group-hover:text-white transition-colors" />
            </div>
            <h3 className="text-2xl font-bold text-emerald-950 mb-3">{role.title}</h3>
            <p className="text-emerald-900/50 leading-relaxed">{role.desc}</p>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

// --- Chatbot Component ---

const AIChatbot = ({ profile, crops, t, lang }: { profile: UserProfile, crops: Crop[], t: any, lang: Lang }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', content: string }[]>([
    { role: 'ai', content: t.welcome + "! " + t.ask_me }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    try {
      const langName = lang === 'ta' ? 'Tamil' : lang === 'hi' ? 'Hindi' : 'English';
      const result = await genAI.models.generateContent({ 
        model: "gemini-3-flash-preview",
        contents: [
          {
            role: 'user',
            parts: [{ text: `You are an expert agricultural AI assistant for HarvestOptima. 
            The user is a ${profile.role}. 
            Context about their current crops: ${JSON.stringify(crops.map(c => ({ type: c.type, quantity: c.quantity, status: c.status, location: c.location })))}.
            
            CRITICAL: Respond ONLY in ${langName}. Translate all content including location names and technical terms to ${langName}.
            Provide helpful, practical advice on:
            1. Crop health and pest management.
            2. Optimal harvest timing based on market trends and crop stage.
            3. Sustainable farming ideas and techniques.
            4. Market price trends.
            
            Keep responses concise, professional, and encouraging.
            Use simple language suitable for farmers.` }]
          },
          ...messages.map(m => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.content }]
          })),
          { role: 'user', parts: [{ text: userMsg }] }
        ]
      });

      const response = result.text;
      setMessages(prev => [...prev, { role: 'ai', content: response }]);
    } catch (error: any) {
      console.error("Chat failed:", error);
      if (error.message?.includes('429')) {
        setMessages(prev => [...prev, { role: 'ai', content: "I'm receiving too many requests right now. Please wait a moment and try again." }]);
      } else {
        setMessages(prev => [...prev, { role: 'ai', content: t.something_went_wrong }]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-6 w-14 h-14 bg-emerald-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-emerald-700 transition-all active:scale-95 z-40"
      >
        <MessageSquare className="w-6 h-6" />
      </button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.9 }}
            className="fixed bottom-24 right-6 w-[400px] h-[600px] bg-white rounded-[2rem] shadow-2xl border border-emerald-50 flex flex-col z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="bg-emerald-600 p-6 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  <Bot className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold">{t.voice_assistant}</h3>
                  <p className="text-xs text-white/70">AI Powered Expert</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={cn(
                  "flex",
                  msg.role === 'user' ? "justify-end" : "justify-start"
                )}>
                  <div className={cn(
                    "max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed",
                    msg.role === 'user' 
                      ? "bg-emerald-600 text-white rounded-tr-none" 
                      : "bg-emerald-50 text-emerald-950 rounded-tl-none"
                  )}>
                    <div className="markdown-body">
                      <Markdown>{msg.content}</Markdown>
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-emerald-50 p-4 rounded-2xl rounded-tl-none flex gap-1">
                    <div className="w-1.5 h-1.5 bg-emerald-300 rounded-full animate-bounce" />
                    <div className="w-1.5 h-1.5 bg-emerald-300 rounded-full animate-bounce [animation-delay:0.2s]" />
                    <div className="w-1.5 h-1.5 bg-emerald-300 rounded-full animate-bounce [animation-delay:0.4s]" />
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-6 border-t border-emerald-50">
              <div className="relative">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Ask about your crops..."
                  className="w-full pl-4 pr-12 py-3 bg-emerald-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-emerald-600 hover:bg-emerald-100 rounded-xl disabled:opacity-50"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

function Dashboard({ profile, t, lang }: { profile: UserProfile, t: any, lang: Lang }) {
  const [crops, setCrops] = useState<Crop[]>([]);
  const [marketplaceCrops, setMarketplaceCrops] = useState<Crop[]>([]);
  const [bids, setBids] = useState<Bid[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'marketplace' | 'logistics' | 'bids'>('overview');
  const [isListening, setIsListening] = useState(false);
  const [voiceResponse, setVoiceResponse] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const totalRevenue = React.useMemo(() => {
    return bids
      .filter(b => b.status === 'accepted')
      .reduce((sum, b) => sum + b.amount, 0);
  }, [bids]);

  const [recognition, setRecognition] = useState<any>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);

  const stopVoiceAssistant = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    window.speechSynthesis.cancel();
    setIsRecording(false);
    setIsSpeaking(false);
  };

  const handleAudioQuery = async (base64Audio: string, mimeType: string) => {
    try {
      setIsListening(false);
      setIsSpeaking(true); // Show "Processing" state
      setVoiceResponse("Processing your voice...");

      const langName = lang === 'ta' ? 'Tamil' : lang === 'hi' ? 'Hindi' : 'English';
      const toneInstruction = lang === 'ta' 
        ? "Use natural Tamil slang (like a friendly local conversation) and a helpful tone suitable for a farmer." 
        : lang === 'hi' 
          ? "Use natural Hindi and a friendly, helpful tone." 
          : "Use clear English and a professional yet friendly tone.";

      const result = await genAI.models.generateContent({ 
        model: "gemini-3-flash-preview",
        contents: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Audio
            }
          },
          {
            text: `The user is speaking in ${langName}. 
            1. Transcribe their speech.
            2. Provide a helpful, concise response in ${langName} in the context of an agricultural marketplace.
            3. ${toneInstruction}
            4. If they ask for prices or harvest advice, give a general expert opinion.
            Return ONLY the response text (no transcription prefix).`
          }
        ]
      });
      
      const responseText = result.text;
      setVoiceResponse(responseText);
      
      // Strip markdown for speech synthesis
      const cleanText = responseText.replace(/[*#_`~]/g, '').replace(/\[.*?\]\(.*?\)/g, '');
      
      // Use Gemini TTS for high-quality, reliable speech
      try {
        const ttsResponse = await genAI.models.generateContent({
          model: "gemini-2.5-flash-preview-tts",
          contents: [{ parts: [{ text: `Speak this in ${langName}: ${cleanText}` }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: lang === 'ta' ? 'Kore' : lang === 'hi' ? 'Fenrir' : 'Zephyr' },
                },
            },
          },
        });

        const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
          const audio = new Audio(`data:audio/wav;base64,${base64Audio}`);
          audio.onplay = () => setIsSpeaking(true);
          audio.onended = () => setIsSpeaking(false);
          audio.onerror = () => setIsSpeaking(false);
          await audio.play();
          return;
        }
      } catch (ttsError) {
        console.error("Gemini TTS failed, falling back to browser speech:", ttsError);
      }

      // Fallback to browser speech synthesis
      window.speechSynthesis.cancel(); 
      const utterance = new SpeechSynthesisUtterance(cleanText);
      const langCode = lang === 'en' ? 'en-US' : lang === 'ta' ? 'ta-IN' : 'hi-IN';
      utterance.lang = langCode;
      utterance.rate = 1.0; 
      utterance.pitch = 1.0;
      
      const findVoice = () => {
        const voices = window.speechSynthesis.getVoices();
        return voices.find(v => v.lang === langCode) || 
               voices.find(v => v.lang.startsWith(langCode)) ||
               voices.find(v => v.lang.replace('_', '-').startsWith(langCode.split('-')[0]));
      };

      const speak = () => {
        const voice = findVoice();
        if (voice) utterance.voice = voice;
        window.speechSynthesis.speak(utterance);
      };

      utterance.onstart = () => {
        setIsSpeaking(true);
        setVoiceError(null);
      };
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = (e) => {
        console.error("Speech synthesis error:", e);
        setIsSpeaking(false);
      };

      if (window.speechSynthesis.getVoices().length > 0) {
        speak();
      } else {
        const voicesChangedHandler = () => {
          speak();
          window.speechSynthesis.removeEventListener('voiceschanged', voicesChangedHandler);
        };
        window.speechSynthesis.addEventListener('voiceschanged', voicesChangedHandler);
        setTimeout(() => {
          if (!window.speechSynthesis.speaking) {
            speak();
            window.speechSynthesis.removeEventListener('voiceschanged', voicesChangedHandler);
          }
        }, 1000);
      }
    } catch (error: any) {
      console.error("Voice query failed:", error);
      if (error.message?.includes('429')) {
        setVoiceError("AI service is busy (too many requests). Please wait a moment and try again.");
      } else {
        setVoiceError("AI processing failed. Please try again.");
      }
      setIsSpeaking(false);
      setVoiceResponse(null);
    }
  };

  const startVoiceAssistant = async () => {
    setVoiceError(null);
    setVoiceResponse(null);
    
    if (isRecording || isSpeaking) {
      stopVoiceAssistant();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: recorder.mimeType });
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          const base64data = (reader.result as string).split(',')[1];
          handleAudioQuery(base64data, recorder.mimeType);
        };
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      
      // Auto-stop after 5 seconds of silence or 10 seconds total
      setTimeout(() => {
        if (recorder.state === 'recording') {
          recorder.stop();
          setIsRecording(false);
        }
      }, 8000);

    } catch (err: any) {
      console.error("Microphone access failed:", err);
      if (err.name === 'NotAllowedError') {
        setVoiceError("Microphone access denied. Please check your browser permissions.");
      } else {
        setVoiceError("Could not start microphone. Please try again.");
      }
    }
  };

  useEffect(() => {
    const cropsQuery = profile.role === 'farmer' 
      ? query(collection(db, 'crops'), where('farmerId', '==', profile.uid))
      : collection(db, 'crops');

    const unsubscribeCrops = onSnapshot(cropsQuery, (snapshot) => {
      setCrops(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Crop)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'crops');
    });

    // Marketplace crops (all ready/harvested crops from everyone)
    const marketplaceQuery = query(collection(db, 'crops'), where('status', 'in', ['ready', 'harvested']));
    const unsubscribeMarketplace = onSnapshot(marketplaceQuery, (snapshot) => {
      setMarketplaceCrops(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Crop)));
    });

    const bidsQuery = profile.role === 'farmer'
      ? query(collection(db, 'bids'), where('farmerId', '==', profile.uid))
      : query(collection(db, 'bids'), where('buyerId', '==', profile.uid));
    
    const unsubscribeBids = onSnapshot(bidsQuery, (snapshot) => {
      setBids(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bid)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'bids');
    });

    return () => {
      unsubscribeCrops();
      unsubscribeMarketplace();
      unsubscribeBids();
    };
  }, [profile]);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-72 bg-white border-r border-emerald-50 p-8 flex flex-col">
        <div className="flex items-center gap-3 mb-12">
          <div className="p-2 bg-emerald-600 rounded-xl">
            <Sprout className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-emerald-950">HarvestOptima</span>
        </div>

        <nav className="flex-1 space-y-2">
          {[
            { id: 'overview', label: t.active_crops, icon: TrendingUp },
            { id: 'marketplace', label: t.marketplace, icon: ShoppingBag },
            { id: 'bids', label: t.bids, icon: Clock },
            { id: 'logistics', label: t.logistics, icon: Truck },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={cn(
                "w-full flex items-center gap-4 px-4 py-3 rounded-2xl font-medium transition-all",
                activeTab === item.id 
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-200" 
                  : "text-emerald-900/50 hover:bg-emerald-50 hover:text-emerald-900"
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </button>
          ))}
        </nav>

        {/* Voice Assistant Widget */}
        <div className="mt-4 p-6 bg-white rounded-[2.5rem] border border-emerald-100 shadow-sm hover:shadow-md transition-all duration-300">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="relative">
              <button 
                onClick={startVoiceAssistant}
                className={cn(
                  "p-4 rounded-full shadow-lg transition-all active:scale-95",
                  (isRecording || isSpeaking) 
                    ? "bg-red-50 text-red-600 shadow-red-100" 
                    : "bg-emerald-600 text-white shadow-emerald-100 hover:bg-emerald-700"
                )}
              >
                <VoiceVisualizer isRecording={isRecording} isSpeaking={isSpeaking} />
              </button>
              {(isRecording || isSpeaking) && (
                <button
                  onClick={stopVoiceAssistant}
                  className="absolute -top-2 -right-2 p-1.5 bg-white rounded-full shadow-md border border-emerald-50 text-emerald-900/40 hover:text-red-500 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            
            <div>
              <span className="block text-xs font-bold text-emerald-950 uppercase tracking-widest mb-1">{t.voice_assistant}</span>
              <p className="text-[10px] text-emerald-900/40 font-medium">
                {isRecording ? t.speak_now : isSpeaking ? t.stop_ai : t.start_query}
              </p>
            </div>
          </div>

          <AnimatePresence>
            {voiceError && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 p-3 bg-red-50 rounded-2xl border border-red-100"
              >
                <div className="flex gap-2">
                  <AlertCircle className="w-3 h-3 text-red-500 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-[10px] text-red-600 font-medium leading-tight">
                      {voiceError}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {voiceResponse && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative mt-4 p-4 bg-emerald-50/30 rounded-[1.5rem] border border-emerald-100/30"
              >
                <div className="text-[11px] text-emerald-900/80 leading-relaxed italic pr-8">
                  <Markdown>{voiceResponse}</Markdown>
                </div>
                <div className="absolute top-3 right-3 flex items-center gap-2">
                  <button 
                    onClick={() => {
                      const cleanText = voiceResponse.replace(/[*#_`~]/g, '').replace(/\[.*?\]\(.*?\)/g, '');
                      const utterance = new SpeechSynthesisUtterance(cleanText);
                      const langCode = lang === 'en' ? 'en-US' : lang === 'ta' ? 'ta-IN' : 'hi-IN';
                      utterance.lang = langCode;
                      window.speechSynthesis.cancel();
                      window.speechSynthesis.speak(utterance);
                    }}
                    className="p-1 hover:bg-emerald-100 rounded-full transition-colors"
                    title="Play Audio"
                  >
                    <Volume2 className="w-3 h-3 text-emerald-600" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="mt-auto pt-8 border-t border-emerald-50">
          <div className="flex items-center gap-4 mb-6">
            <img 
              src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.name}`} 
              className="w-10 h-10 rounded-full bg-emerald-50"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-emerald-950 truncate">{profile.name}</p>
              <p className="text-xs text-emerald-900/40 capitalize">{profile.role}</p>
            </div>
          </div>
          <button 
            onClick={() => signOut(auth)}
            className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl font-medium text-red-600 hover:bg-red-50 transition-all"
          >
            <LogOut className="w-5 h-5" />
            {t.logout}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-12 overflow-y-auto">
        <header className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-3xl font-bold text-emerald-950">{t.welcome}</h1>
            <p className="text-emerald-900/50">{t.tagline}</p>
          </div>
          {profile.role === 'farmer' && (
            <AddCropModal profile={profile} t={t} />
          )}
        </header>

        {activeTab === 'overview' && (
          <div className="space-y-12">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-8">
              <StatCard 
                label={t.active_crops} 
                value={crops.length.toString()} 
                icon={Sprout} 
                color="text-emerald-600" 
                bg="bg-emerald-50" 
              />
              <StatCard 
                label={t.pending_bids} 
                value={bids.filter(b => b.status === 'pending').length.toString()} 
                icon={Clock} 
                color="text-orange-600" 
                bg="bg-orange-50" 
              />
              <StatCard 
                label={t.total_revenue} 
                value={`$${totalRevenue.toLocaleString()}`} 
                icon={TrendingUp} 
                color="text-blue-600" 
                bg="bg-blue-50" 
              />
            </div>

            {/* Real-time Data Widgets */}
            <div className="grid lg:grid-cols-2 gap-8">
              <WeatherWidget profile={profile} t={t} lang={lang} />
              <MapWidget profile={profile} t={t} lang={lang} />
            </div>

            {/* Main Grid */}
            <div className="grid lg:grid-cols-3 gap-12">
              <div className="lg:col-span-2 space-y-8">
                <h2 className="text-2xl font-bold text-emerald-950">{t.active_crops}</h2>
                <div className="grid gap-6">
                  {crops.map(crop => (
                    <CropCard key={crop.id} crop={crop} role={profile.role} t={t} lang={lang} />
                  ))}
                  {crops.length === 0 && (
                    <div className="p-12 text-center bg-white rounded-[2rem] border-2 border-dashed border-emerald-100">
                      <Sprout className="w-12 h-12 text-emerald-200 mx-auto mb-4" />
                      <p className="text-emerald-900/40">{t.no_crops}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'marketplace' && (
          <div className="space-y-12">
             <div className="flex items-center justify-between">
               <h2 className="text-2xl font-bold text-emerald-950">{t.marketplace}</h2>
               <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-full">
                 <Bot className="w-4 h-4 text-emerald-600" />
                 <span className="text-sm font-bold text-emerald-950">{t.market_insights} {t.live}</span>
               </div>
             </div>
             
             <div className="grid lg:grid-cols-3 gap-12">
               <div className="lg:col-span-2 grid md:grid-cols-2 gap-6">
                 {marketplaceCrops.map(crop => (
                   <MarketplaceCard key={crop.id} crop={crop} profile={profile} t={t} />
                 ))}
                 {marketplaceCrops.length === 0 && (
                   <div className="col-span-full p-12 text-center bg-white rounded-[2rem] border-2 border-dashed border-emerald-100">
                     <ShoppingBag className="w-12 h-12 text-emerald-200 mx-auto mb-4" />
                     <p className="text-emerald-900/40">{t.marketplace_empty}</p>
                   </div>
                 )}
               </div>
               <div className="space-y-8">
                 <MarketIntelligence location={profile.location || 'Vellore'} t={t} lang={lang} />
               </div>
             </div>
          </div>
        )}

        {activeTab === 'bids' && (
          <BidsView bids={bids} crops={crops} profile={profile} t={t} />
        )}
      </main>
      {profile.role === 'farmer' && <AIChatbot profile={profile} crops={crops} t={t} lang={lang} />}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color, bg }: any) {
  return (
    <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-emerald-50 flex items-center gap-6">
      <div className={cn("p-4 rounded-2xl", bg)}>
        <Icon className={cn("w-8 h-8", color)} />
      </div>
      <div>
        <p className="text-sm font-medium text-emerald-900/40">{label}</p>
        <p className="text-3xl font-bold text-emerald-950">{value}</p>
      </div>
    </div>
  );
}

function CropCard({ crop, role, t, lang }: { crop: Crop, role: Role, t: any, lang: Lang, key?: any }) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [prediction, setPrediction] = useState<any>(null);
  const [showPlan, setShowPlan] = useState(false);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      const langName = lang === 'ta' ? 'Tamil' : lang === 'hi' ? 'Hindi' : 'English';
      const result = await genAI.models.generateContent({ 
        model: "gemini-3-flash-preview",
        contents: `Analyze agricultural data for ${crop.type} in ${crop.location}:
        Historical Prices: ${JSON.stringify(historicalMandiData.filter(d => d.crop === crop.type))}
        
        Respond in ${langName}.
        CRITICAL: Respond ONLY in ${langName}. Translate all content including location names and technical terms to ${langName}.
        Provide:
        1. Predicted price for next 7 days (array of numbers)
        2. Market sentiment (Bullish/Bearish/Neutral)
        3. Harvest recommendation (Harvest Now / Wait X Days / Warning)
        4. Reasoning in 1 sentence.
        
        Return ONLY JSON.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              predictedPrices: { type: Type.ARRAY, items: { type: Type.NUMBER } },
              marketSentiment: { type: Type.STRING },
              harvestRecommendation: { type: Type.STRING },
              reasoning: { type: Type.STRING }
            },
            required: ["marketSentiment", "harvestRecommendation", "reasoning"]
          }
        }
      });
      
      const text = result.text;
      const data = JSON.parse(text || '{}');
      
      try {
        await updateDoc(doc(db, 'crops', crop.id), {
          optimalHarvestDate: data.harvestRecommendation?.includes('Wait') ? addDays(new Date(), 2).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          advice: data.reasoning || "No advice available",
          priceTrend: data.marketSentiment || "Neutral"
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `crops/${crop.id}`);
      }
    } catch (error) {
      console.error("Analysis failed:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <>
      <motion.div 
        layout
        className="bg-white p-8 rounded-[2rem] shadow-sm border border-emerald-50 flex flex-col md:flex-row gap-8 items-start md:items-center"
      >
        <div className="w-20 h-20 bg-emerald-50 rounded-2xl flex items-center justify-center shrink-0">
          <Sprout className="w-10 h-10 text-emerald-600" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-xl font-bold text-emerald-950">
              {t[crop.type?.toLowerCase() as keyof typeof t] || crop.type}
            </h3>
            <span className={cn(
              "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
              crop.status === 'growing' ? "bg-blue-50 text-blue-600" :
              crop.status === 'ready' ? "bg-emerald-50 text-emerald-600" :
              "bg-orange-50 text-orange-600"
            )}>
              {t[crop.status as keyof typeof t] || crop.status}
            </span>
          </div>
            <div className="flex flex-wrap gap-6 text-sm text-emerald-900/50">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4" />
              {crop.quantity} {t.kg_available}
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {t.est_harvest}: {crop.expectedHarvestDate}
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              {t[crop.location?.toLowerCase() as keyof typeof t] || crop.location}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 w-full md:w-auto">
          {role === 'farmer' && !crop.optimalHarvestDate && (
            <button 
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className="px-6 py-3 bg-emerald-950 text-white rounded-xl font-bold hover:bg-emerald-900 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isAnalyzing ? (
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}><Clock className="w-4 h-4" /></motion.div>
              ) : (
                <TrendingUp className="w-4 h-4" />
              )}
              {t.harvest_advice}
            </button>
          )}
          
          {crop.optimalHarvestDate && (
            <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 max-w-xs">
              <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm mb-1">
                <CheckCircle2 className="w-4 h-4" />
                {t.harvest_today}: {crop.optimalHarvestDate}
              </div>
              <p className="text-xs text-emerald-900/60 line-clamp-2">{crop.advice}</p>
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase text-emerald-900/40">{t.market_sentiment}:</span>
                  <span className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded-full",
                    crop.priceTrend === 'Bullish' ? "bg-emerald-200 text-emerald-700" : "bg-orange-200 text-orange-700"
                  )}>{crop.priceTrend}</span>
                </div>
                <button 
                  onClick={() => setShowPlan(true)}
                  className="text-[10px] font-bold text-emerald-600 underline"
                >
                  {t.view_ai_plan}
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
      <AnimatePresence>
        {showPlan && <HarvestPlanModal crop={crop} location={crop.location} onClose={() => setShowPlan(false)} t={t} lang={lang} />}
      </AnimatePresence>
    </>
  );
}

function MarketplaceCard({ crop, profile, t }: { crop: Crop, profile: UserProfile, t: any, key?: any }) {
  const [bidAmount, setBidAmount] = useState('');
  const [isBidding, setIsBidding] = useState(false);
  const [hasBid, setHasBid] = useState(false);
  const [recentBids, setRecentBids] = useState<any[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'bids'), where('cropId', '==', crop.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRecentBids(snapshot.docs.map(doc => doc.data()).slice(0, 2));
    });
    return () => unsubscribe();
  }, [crop.id]);

  const handleBid = async () => {
    if (!bidAmount) return;
    setIsBidding(true);
    try {
      await addDoc(collection(db, 'bids'), {
        cropId: crop.id,
        buyerId: profile.uid,
        farmerId: crop.farmerId,
        buyerName: profile.name,
        companyName: profile.companyName || profile.name,
        amount: parseFloat(bidAmount),
        status: 'pending',
        timestamp: Timestamp.now()
      });
      setHasBid(true);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'bids');
    } finally {
      setIsBidding(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-emerald-50 flex flex-col h-full">
      <div className="w-full aspect-video bg-emerald-50 rounded-2xl mb-6 flex items-center justify-center relative overflow-hidden">
        <ShoppingBag className="w-12 h-12 text-emerald-200" />
        <div className="absolute top-4 right-4 px-3 py-1 bg-white/90 backdrop-blur-sm rounded-full text-[10px] font-bold text-emerald-600 shadow-sm">
          {t.live}
        </div>
      </div>
      
      <div className="flex-1">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xl font-bold text-emerald-950">
            {t[crop.type?.toLowerCase() as keyof typeof t] || crop.type}
          </h3>
          <span className="text-lg font-bold text-emerald-600">${crop.priceTrend === 'Bullish' ? '28' : '24'}/kg</span>
        </div>
        <div className="flex flex-col gap-2 text-sm text-emerald-900/50 mb-6">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4" />
            <span>{crop.quantity} {t.kg_available}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            <span>{t[crop.location?.toLowerCase() as keyof typeof t] || crop.location}</span>
          </div>
        </div>

        {recentBids.length > 0 && (
          <div className="mb-6 p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-2 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              {t.bid_history}
            </p>
            <div className="space-y-2">
              {recentBids.map((bid, i) => (
                <div key={i} className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-emerald-950">{bid.companyName || bid.buyerName}</span>
                  <span className="text-emerald-600 font-bold">${bid.amount}/kg</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {hasBid ? (
          <div className="p-4 bg-emerald-50 text-emerald-700 rounded-2xl font-bold text-center flex items-center justify-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            {t.bid_placed}
          </div>
        ) : (
          <>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-900/40 font-bold">$</span>
              <input 
                type="number" 
                placeholder={t.bid_amount_placeholder}
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                className="w-full pl-8 pr-4 py-3 bg-emerald-50 rounded-xl border-none focus:ring-2 focus:ring-emerald-600 font-medium"
              />
            </div>
            <button 
              onClick={handleBid}
              disabled={isBidding}
              className="w-full py-3 bg-emerald-950 text-white rounded-xl font-bold hover:bg-emerald-900 transition-all"
            >
              {isBidding ? "..." : t.place_bid}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function AddCropModal({ profile, t }: { profile: UserProfile, t: any }) {
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState(CROP_TYPES[0]);
  const [quantity, setQuantity] = useState('');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState(profile.location || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'crops'), {
        farmerId: profile.uid,
        type,
        quantity: parseFloat(quantity),
        expectedHarvestDate: date,
        location,
        status: 'growing'
      });
      setIsOpen(false);
      setType(CROP_TYPES[0]);
      setQuantity('');
      setDate('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'crops');
    }
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 flex items-center gap-2"
      >
        <Plus className="w-5 h-5" />
        {t.list_new_crop}
      </button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-emerald-950/20 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl p-10"
            >
              <h2 className="text-3xl font-bold text-emerald-950 mb-8">{t.list_your_crop}</h2>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-emerald-950 mb-2">{t.crop_type}</label>
                  <select 
                    required
                    value={type}
                    onChange={e => setType(e.target.value)}
                    className="w-full px-4 py-3 bg-emerald-50 rounded-xl border-none focus:ring-2 focus:ring-emerald-600"
                  >
                    {CROP_TYPES.map(crop => (
                      <option key={crop} value={crop}>
                        {t[crop.toLowerCase() as keyof typeof t] || crop}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-emerald-950 mb-2">{t.quantity_kg}</label>
                    <input 
                      required
                      type="number"
                      value={quantity}
                      onChange={e => setQuantity(e.target.value)}
                      placeholder={t.quantity_placeholder}
                      className="w-full px-4 py-3 bg-emerald-50 rounded-xl border-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-emerald-950 mb-2">{t.est_harvest}</label>
                    <input 
                      required
                      type="date"
                      value={date}
                      onChange={e => setDate(e.target.value)}
                      className="w-full px-4 py-3 bg-emerald-50 rounded-xl border-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-emerald-950 mb-2">{t.location}</label>
                  <LocationAutocomplete 
                    value={location}
                    onChange={setLocation}
                    placeholder={t.location_placeholder}
                    t={t}
                  />
                </div>
                <div className="pt-4 flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition-all"
                  >
                    {t.cancel}
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
                  >
                    {t.list_crop}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
