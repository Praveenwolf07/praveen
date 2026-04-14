import React, { useState, useRef } from 'react';
import { createUser } from '../api';
import { Role, UserProfile } from '../types';
import { LOCATIONS } from '../constants';
import { Sprout, ShoppingBag, Truck, MapPin, ChevronRight, Shuffle, Loader2, Navigation } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY || 'AIzaSyCUqaQ8PTzhEBnNYl1VEXaCUiC7myOID8M' });

interface Props {
  uid: string;
  email: string;
  displayName: string | null;
  onComplete: () => void;
}

export default function RoleSelection({ uid, email, displayName, onComplete }: Props) {
  const [role, setRole] = useState<Role | null>(null);
  const [location, setLocation] = useState('');
  const [name, setName] = useState(displayName || localStorage.getItem('pendingName') || '');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'role' | 'details'>('role');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const debounceRef = useRef<any>(null);

  // Use Gemini to get smart location suggestions
  const fetchGeminiLocations = async (query: string) => {
    if (query.length < 2) { setSuggestions([]); return; }
    setSuggestLoading(true);
    try {
      // First try Gemini AI
      const apiKey = process.env.GEMINI_API_KEY;
      if (apiKey && apiKey.length > 10) {
        const result = await genAI.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: `List 5 real Indian cities/towns that match "${query}". Return ONLY a JSON array of strings like ["City, State"]. No markdown, no explanation.`,
        });
        const text = result.text?.trim() || '[]';
        const cleaned = text.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSuggestions(parsed);
          setSuggestLoading(false);
          return;
        }
      }
    } catch (e) { /* fallback below */ }
    // Fallback: filter from static LOCATIONS list
    const filtered = LOCATIONS.filter(l => l.toLowerCase().includes(query.toLowerCase())).slice(0, 6);
    setSuggestions(filtered);
    setSuggestLoading(false);
  };

  const handleLocationInput = (val: string) => {
    setLocation(val);
    clearTimeout(debounceRef.current);
    if (val.length >= 2) {
      debounceRef.current = setTimeout(() => fetchGeminiLocations(val), 600);
    } else {
      setSuggestions([]);
    }
  };

  // Random location from static list
  const randomLocation = () => {
    const rand = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
    setLocation(rand);
    setSuggestions([]);
  };

  // GPS-based current location via browser API + Nominatim
  const detectLocation = () => {
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const resp = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`,
            { headers: { 'Accept-Language': 'en' } }
          );
          const data = await resp.json();
          const city = data.address?.city || data.address?.town || data.address?.village || data.address?.county || '';
          const state = data.address?.state || '';
          setLocation(city && state && city !== state ? `${city}, ${state}` : city || state || 'Unknown Location');
        } catch {
          setLocation(`${pos.coords.latitude.toFixed(2)},${pos.coords.longitude.toFixed(2)}`);
        } finally { setGpsLoading(false); }
      },
      () => { setGpsLoading(false); alert('GPS access denied. Use manual entry or Random.'); }
    );
  };

  const handleSubmit = async () => {
    if (!role || !name.trim() || !location.trim()) return;
    setLoading(true);
    try {
      await createUser({
        uid, email: email || '', name: name.trim(), role,
        location: location.trim(), phone: phone.trim(),
        createdAt: new Date().toISOString(),
      });
      localStorage.removeItem('pendingName');
      onComplete();
    } catch (err: any) {
      alert('Failed to save profile: ' + (err.message || 'Unknown error'));
    } finally { setLoading(false); }
  };

  const roles: { id: Role; icon: any; label: string; desc: string; bg: string; iconColor: string }[] = [
    { id: 'farmer', icon: Sprout, label: '👨‍🌾 Farmer', desc: 'List crops, accept bids, plan harvests', bg: 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200', iconColor: 'text-emerald-700 bg-emerald-100' },
    { id: 'buyer', icon: ShoppingBag, label: '🏪 Institutional Buyer', desc: 'Browse crops, place bids, purchase at scale', bg: 'bg-blue-50 hover:bg-blue-100 border-blue-200', iconColor: 'text-blue-700 bg-blue-100' },
    { id: 'transporter', icon: Truck, label: '🚛 Transporter', desc: 'Offer logistics, book deliveries, earn income', bg: 'bg-amber-50 hover:bg-amber-100 border-amber-200', iconColor: 'text-amber-700 bg-amber-100' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-amber-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-600 rounded-2xl mb-3 shadow-lg shadow-emerald-200">
            <Sprout className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-black text-emerald-950">
            {step === 'role' ? 'Choose Your Role' : 'Complete Profile'}
          </h1>
          <p className="text-emerald-900/50 text-sm mt-1">
            {step === 'role' ? 'How will you use HarvestOptima?' : 'Almost there — fill in your details'}
          </p>
          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 mt-3">
            {[0, 1].map(i => (
              <div key={i} className={`h-1.5 rounded-full transition-all ${i === (step === 'role' ? 0 : 1) ? 'w-8 bg-emerald-600' : 'w-3 bg-emerald-200'}`} />
            ))}
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] p-8 shadow-xl border border-emerald-100">
          {step === 'role' ? (
            <div className="space-y-3">
              {roles.map(r => (
                <button key={r.id} onClick={() => { setRole(r.id); setStep('details'); }}
                  className={`w-full p-5 rounded-2xl border-2 text-left transition-all flex items-center gap-4 hover:shadow-md ${r.bg}`}>
                  <div className={`p-3 rounded-xl ${r.iconColor}`}>
                    <r.icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-emerald-950">{r.label}</h3>
                    <p className="text-xs text-emerald-900/50 mt-0.5">{r.desc}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-emerald-300" />
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <label className="text-xs font-bold text-emerald-900/60 uppercase tracking-wider mb-1.5 block">Full Name *</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Ravi Kumar"
                  className="w-full px-4 py-3 bg-emerald-50/50 rounded-xl border border-emerald-100 focus:ring-2 focus:ring-emerald-500 text-sm" />
              </div>

              {/* Location with Gemini AI suggestions */}
              <div>
                <label className="text-xs font-bold text-emerald-900/60 uppercase tracking-wider mb-1.5 block">
                  Location * {suggestLoading && <span className="text-emerald-400 normal-case font-normal">(AI searching...)</span>}
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
                  <input type="text" value={location} onChange={e => handleLocationInput(e.target.value)}
                    onBlur={() => setTimeout(() => setSuggestions([]), 200)}
                    placeholder="Type your city or district..."
                    className="w-full pl-9 pr-4 py-3 bg-emerald-50/50 rounded-xl border border-emerald-100 focus:ring-2 focus:ring-emerald-500 text-sm" />
                  {suggestLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400 animate-spin" />}

                  {suggestions.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white rounded-xl shadow-xl border border-emerald-100 max-h-44 overflow-y-auto">
                      {suggestions.map((s, i) => (
                        <button key={i} type="button" onMouseDown={() => { setLocation(s); setSuggestions([]); }}
                          className="w-full px-4 py-2.5 text-left text-sm hover:bg-emerald-50 border-b border-emerald-50 last:border-none flex items-center gap-2">
                          <MapPin className="w-3 h-3 text-emerald-400 shrink-0" /> {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* GPS + Random buttons */}
                <div className="flex gap-2 mt-2">
                  <button onClick={detectLocation} disabled={gpsLoading}
                    className="flex-1 py-2.5 bg-blue-50 text-blue-700 rounded-xl text-xs font-bold hover:bg-blue-100 flex items-center justify-center gap-1.5 disabled:opacity-60 border border-blue-200">
                    {gpsLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Navigation className="w-3 h-3" />}
                    {gpsLoading ? 'Detecting...' : '📍 Use GPS'}
                  </button>
                  <button onClick={randomLocation}
                    className="flex-1 py-2.5 bg-amber-50 text-amber-700 rounded-xl text-xs font-bold hover:bg-amber-100 flex items-center justify-center gap-1.5 border border-amber-200">
                    <Shuffle className="w-3 h-3" /> 🎲 Random Location
                  </button>
                </div>
                {location && (
                  <p className="text-xs text-emerald-600 mt-1.5 font-medium">📌 Selected: {location}</p>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-emerald-900/60 uppercase tracking-wider mb-1.5 block">Phone (optional)</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 XXXXX XXXXX"
                  className="w-full px-4 py-3 bg-emerald-50/50 rounded-xl border border-emerald-100 focus:ring-2 focus:ring-emerald-500 text-sm" />
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setStep('role')}
                  className="px-6 py-3 bg-gray-100 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-200">
                  ← Back
                </button>
                <button onClick={handleSubmit} disabled={loading || !name.trim() || !location.trim()}
                  className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-emerald-100">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Get Started <ChevronRight className="w-4 h-4" /></>}
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-emerald-900/30 mt-4">
          🔒 Secured by Firebase • Your data is stored safely
        </p>
      </div>
    </div>
  );
}
