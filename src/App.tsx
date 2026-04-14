import React, { useState, useEffect, useRef } from 'react';
import { auth, onAuthStateChanged, signOut } from './firebase';
import { getUser, getNotifications, getCrops, getBids, markNotificationRead } from './api';
import { UserProfile, Crop, Bid, Notification, Lang } from './types';
import { translations, historicalMandiData, CROP_TYPES } from './constants';
import AuthPage from './components/AuthPage';
import RoleSelection from './components/RoleSelection';
import Marketplace from './components/Marketplace';
import BidsModule from './components/BidsModule';
import LogisticsModule from './components/LogisticsModule';
// GoogleGenAI is no longer used directly in the browser — chatbot calls the backend instead
import {
  Sprout, LogOut, Package, DollarSign, Truck, BarChart3, Bell,
  Languages, Send, Bot, X, MessageSquare, TrendingUp, ShoppingBag, MapPin, Mic, MicOff
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line } from 'recharts';

// API base — chatbot and other calls go through the Express backend on port 5000
const API_BASE = 'http://localhost:5000';

type Tab = 'dashboard' | 'marketplace' | 'bids' | 'logistics';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState<Lang>('en');
  const t = translations[lang];

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const userData = await getUser(firebaseUser.uid);
          setProfile(userData || null);
        } catch { setProfile(null); }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const handleSignOut = async () => {
    await signOut(auth);
    setProfile(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-amber-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-600 rounded-2xl mb-4 shadow-lg shadow-emerald-200">
            <Sprout className="w-8 h-8 text-white animate-pulse" />
          </div>
          <p className="text-emerald-900/50 text-sm font-bold">Loading HarvestOptima...</p>
        </div>
      </div>
    );
  }

  if (!user) return <AuthPage />;
  if (!profile) return <RoleSelection uid={user.uid} email={user.email || ''} displayName={user.displayName} onComplete={() => window.location.reload()} />;

  return <Dashboard profile={profile} lang={lang} setLang={setLang} t={t} onSignOut={handleSignOut} />;
}

// ============ DASHBOARD ============
function Dashboard({ profile, lang, setLang, t, onSignOut }: {
  profile: UserProfile; lang: Lang; setLang: (l: Lang) => void; t: any; onSignOut: () => void;
}) {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [bids, setBids] = useState<Bid[]>([]);
  const [showChat, setShowChat] = useState(false);

  const loadDashboardData = async () => {
    try {
      const [notifData, cropData, bidData] = await Promise.all([
        getNotifications(profile.uid),
        getCrops(profile.role === 'farmer' ? { farmerId: profile.uid } : { statuses: 'available' }),
        getBids(profile.role === 'farmer' ? { farmerId: profile.uid } : { buyerId: profile.uid }),
      ]);
      setNotifications(notifData);
      setCrops(cropData);
      setBids(bidData);
    } catch (e) { /* server may not be ready yet */ }
  };

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 5000);
    return () => clearInterval(interval);
  }, [profile.uid]);

  const markRead = async (id: string) => {
    await markNotificationRead(id);
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'marketplace', label: t.marketplace || 'Marketplace', icon: Package },
    { id: 'bids', label: t.bids || 'Bids', icon: DollarSign },
    { id: 'logistics', label: t.logistics || 'Logistics', icon: Truck },
  ];

  // Market chart data
  const chartData = [
    { name: 'Tomato', price: 22 + Math.floor(Math.random() * 8) },
    { name: 'Wheat', price: 28 + Math.floor(Math.random() * 6) },
    { name: 'Rice', price: 32 + Math.floor(Math.random() * 5) },
    { name: 'Potato', price: 16 + Math.floor(Math.random() * 7) },
    { name: 'Onion', price: 20 + Math.floor(Math.random() * 6) },
    { name: 'Corn', price: 18 + Math.floor(Math.random() * 5) },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50/50 via-white to-amber-50/30">
      {/* Top Nav */}
      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-emerald-100 px-4 md:px-8 py-3">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200">
              <Sprout className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-black text-emerald-950 hidden sm:block">HarvestOptima</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Language */}
            <div className="flex bg-emerald-50 rounded-xl p-1">
              {(['en', 'ta', 'hi'] as Lang[]).map(l => (
                <button key={l} onClick={() => setLang(l)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${lang === l ? 'bg-emerald-600 text-white' : 'text-emerald-900/40'}`}>
                  {l.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Notifications */}
            <div className="relative">
              <button onClick={() => setShowNotifs(!showNotifs)} className="relative p-2 hover:bg-emerald-50 rounded-xl">
                <Bell className="w-5 h-5 text-emerald-700" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{unreadCount}</span>
                )}
              </button>
              {showNotifs && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-emerald-100 max-h-96 overflow-y-auto z-50">
                  <div className="p-4 border-b border-emerald-100">
                    <h3 className="font-bold text-emerald-950">Notifications</h3>
                  </div>
                  {notifications.length === 0 ? (
                    <p className="p-4 text-sm text-emerald-900/40 text-center">No notifications</p>
                  ) : notifications.slice(0, 10).map(n => (
                    <div key={n.id} onClick={() => markRead(n.id)}
                      className={`p-4 border-b border-emerald-50 cursor-pointer hover:bg-emerald-50/50 ${!n.read ? 'bg-emerald-50/30' : ''}`}>
                      <p className="text-sm text-emerald-950">{n.message}</p>
                      <p className="text-[10px] text-emerald-900/40 mt-1">{!n.read && '🔵 '}{n.type.replace(/_/g, ' ')}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Profile */}
            <div className="flex items-center gap-2 pl-2 border-l border-emerald-100 ml-1">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-emerald-950">{profile.name}</p>
                <p className="text-[10px] text-emerald-900/40 capitalize">{profile.role} • {profile.location}</p>
              </div>
              <button onClick={onSignOut} className="p-2 hover:bg-red-50 rounded-xl text-red-400 hover:text-red-600" title="Sign Out">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Tab Nav */}
      <div className="sticky top-[57px] z-30 bg-white/80 backdrop-blur-xl border-b border-emerald-100 px-4 md:px-8">
        <div className="flex gap-1 max-w-7xl mx-auto overflow-x-auto py-2">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 whitespace-nowrap transition-all
                ${activeTab === tab.id ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200' : 'text-emerald-900/50 hover:bg-emerald-50'}`}>
              <tab.icon className="w-4 h-4" /> {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            {/* Welcome */}
            <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-[2rem] p-8 text-white">
              <h2 className="text-2xl font-black mb-1">{t.welcome}, {profile.name}! 👋</h2>
              <p className="text-white/70 text-sm">
                {profile.role === 'farmer' ? 'Manage your crops and respond to buyer bids' :
                 profile.role === 'buyer' ? 'Browse crops and place competitive bids' :
                 'Manage your fleet and transport bookings'}
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={Package} label={profile.role === 'farmer' ? 'My Crops' : 'Available Crops'} value={crops.length} color="emerald" />
              <StatCard icon={DollarSign} label={bids.filter(b => b.status === 'pending').length > 0 ? 'Pending Bids' : 'Total Bids'} value={bids.filter(b => b.status === 'pending').length || bids.length} color="blue" />
              <StatCard icon={TrendingUp} label="Accepted Bids" value={bids.filter(b => b.status === 'accepted').length} color="amber" />
              <StatCard icon={Bell} label="Notifications" value={unreadCount} color="red" />
            </div>

            {/* Weather */}
            <WeatherCard location={profile.location} />

            {/* Market Overview */}
            <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-emerald-100">
              <h3 className="text-lg font-bold text-emerald-950 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-600" /> {t.market_intelligence || 'Market Prices'}
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#d1fae5" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="price" fill="#10b981" radius={[8, 8, 0, 0]} name="₹/kg" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'marketplace' && <Marketplace profile={profile} />}
        {activeTab === 'bids' && <BidsModule profile={profile} />}
        {activeTab === 'logistics' && <LogisticsModule profile={profile} />}
      </main>

      {/* AI Chatbot FAB */}
      <AIChatbot profile={profile} crops={crops} lang={lang} showChat={showChat} setShowChat={setShowChat} />
    </div>
  );
}

// ============ STAT CARD ============
function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-600', blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600', red: 'bg-red-50 text-red-600',
  };
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-emerald-100">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${colors[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl font-black text-emerald-950">{value}</p>
      <p className="text-xs text-emerald-900/50 font-medium">{label}</p>
    </div>
  );
}

// ============ WEATHER CARD ============
function WeatherCard({ location }: { location: string }) {
  const [weather, setWeather] = useState<any>(null);
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const resp = await fetch(`https://wttr.in/${encodeURIComponent(location)}?format=j1`);
        const json = await resp.json();
        const cur = json.current_condition?.[0];
        const area = json.nearest_area?.[0];
        setWeather({
          temp: cur?.temp_C || '?', condition: cur?.weatherDesc?.[0]?.value || 'Clear',
          humidity: cur?.humidity || '?', wind: cur?.windspeedKmph || '?',
          city: area?.areaName?.[0]?.value || location,
        });
      } catch { setWeather(null); }
    };
    fetchWeather();
  }, [location]);

  if (!weather) return null;
  const emoji = weather.condition.toLowerCase().includes('rain') ? '🌧️' :
    weather.condition.toLowerCase().includes('cloud') ? '☁️' :
    weather.condition.toLowerCase().includes('sunny') || weather.condition.toLowerCase().includes('clear') ? '☀️' : '🌤️';

  return (
    <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-[2rem] p-6 text-white flex items-center justify-between">
      <div className="flex items-center gap-4">
        <span className="text-4xl">{emoji}</span>
        <div>
          <p className="text-sm font-medium text-white/70">{weather.city}</p>
          <p className="text-3xl font-black">{weather.temp}°C</p>
          <p className="text-xs text-white/60">{weather.condition}</p>
        </div>
      </div>
      <div className="text-right text-xs text-white/60 space-y-1">
        <p>💧 Humidity: {weather.humidity}%</p>
        <p>💨 Wind: {weather.wind} km/h</p>
      </div>
    </div>
  );
}

// ============ AI CHATBOT ============
function AIChatbot({ profile, crops, lang, showChat, setShowChat }: {
  profile: UserProfile; crops: Crop[]; lang: Lang; showChat: boolean; setShowChat: (v: boolean) => void;
}) {
  const [messages, setMessages] = useState<{ role: 'user' | 'bot'; text: string }[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const msg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: msg }]);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, profile, crops, lang }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Server error');
      setMessages(prev => [...prev, { role: 'bot', text: data.reply }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'bot', text: `❌ ${err.message || 'AI is currently unavailable. Please try again.'}` }]);
    } finally { setLoading(false); }
  };

  return (
    <>
      {/* FAB */}
      <button onClick={() => setShowChat(!showChat)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-emerald-600 text-white rounded-2xl shadow-xl shadow-emerald-200 flex items-center justify-center hover:bg-emerald-700 transition-all">
        {showChat ? <X className="w-6 h-6" /> : <Bot className="w-6 h-6" />}
      </button>

      {/* Chat Window */}
      {showChat && (
        <div className="fixed bottom-24 right-6 z-50 w-[360px] max-h-[500px] bg-white rounded-[2rem] shadow-2xl border border-emerald-100 flex flex-col overflow-hidden">
          <div className="bg-emerald-600 p-4 text-white">
            <h3 className="font-bold flex items-center gap-2"><Bot className="w-5 h-5" /> AI Farm Assistant</h3>
            <p className="text-xs text-white/70">Ask about crops, prices, weather, farming tips</p>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[340px]">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <Bot className="w-10 h-10 text-emerald-200 mx-auto mb-3" />
                <p className="text-sm text-emerald-900/40">Ask me anything about farming!</p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${
                  m.role === 'user' ? 'bg-emerald-600 text-white rounded-br-md' : 'bg-emerald-50 text-emerald-950 rounded-bl-md'}`}>
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="px-4 py-2.5 bg-emerald-50 rounded-2xl rounded-bl-md">
                  <div className="flex gap-1"><span className="w-2 h-2 bg-emerald-300 rounded-full animate-bounce" /><span className="w-2 h-2 bg-emerald-300 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} /><span className="w-2 h-2 bg-emerald-300 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} /></div>
                </div>
              </div>
            )}
          </div>
          <div className="p-3 border-t border-emerald-100">
            <div className="flex gap-2">
              <input type="text" value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()} placeholder="Type a message..."
                className="flex-1 px-4 py-2.5 bg-emerald-50 rounded-xl text-sm border-none focus:ring-2 focus:ring-emerald-500" />
              <button onClick={sendMessage} disabled={loading || !input.trim()}
                className="p-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
