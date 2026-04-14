import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getCrops, createCrop, updateCrop, deleteCrop, getCropDemand, getRatings, createRating } from '../api';
import { Crop, UserProfile, Grade, CropStatus, Rating } from '../types';
import { CROP_TYPES } from '../constants';
import {
  Plus, Search, MapPin, X, Edit2, Trash2, Filter, Package,
  ChevronDown, RefreshCw, Star, Zap, TrendingUp, Camera, Image as ImageIcon
} from 'lucide-react';

interface Props { profile: UserProfile; }

// ─── F1: Smart Choice Score ───────────────────────────────────────────────────
function computeSmartScore(
  crop: Crop,
  allCrops: Crop[],
  demandMap: Record<string, number>,
  allRatings: Rating[],
  userLocation: string
): number {
  let score = 0;

  // Price competitiveness (30 pts) — lower price = higher score
  const sameCrops = allCrops.filter(c => c.type === crop.type && c.status === 'available');
  if (sameCrops.length > 0) {
    const minPrice = Math.min(...sameCrops.map(c => c.price));
    const maxPrice = Math.max(...sameCrops.map(c => c.price));
    const priceRange = maxPrice - minPrice || 1;
    score += Math.round(((maxPrice - crop.price) / priceRange) * 30);
  } else {
    score += 20; // only listing = good
  }

  // Grade quality (20 pts)
  score += crop.grade === 'A' ? 20 : crop.grade === 'B' ? 12 : 5;

  // Location proximity (20 pts) — simple string match
  const ul = userLocation.toLowerCase();
  const cl = crop.location.toLowerCase();
  if (cl.includes(ul) || ul.includes(cl)) score += 20;
  else if (cl.split(',').pop()?.trim() === ul.split(',').pop()?.trim()) score += 10;
  else score += 5;

  // Farmer reputation (15 pts)
  const farmerRatings = allRatings.filter(r => r.farmerId === crop.farmerId);
  if (farmerRatings.length > 0) {
    const avg = farmerRatings.reduce((s, r) => s + r.stars, 0) / farmerRatings.length;
    score += Math.round((avg / 5) * 15);
  } else {
    score += 8; // neutral
  }

  // Freshness (15 pts)
  const ageHours = (Date.now() - new Date(crop.createdAt).getTime()) / 3600000;
  score += ageHours < 24 ? 15 : ageHours < 72 ? 10 : 5;

  return Math.min(100, score);
}

function StarRating({ stars, count, size = 'sm' }: { stars: number; count: number; size?: 'sm' | 'md' }) {
  const s = size === 'md' ? 'w-4 h-4' : 'w-3 h-3';
  return (
    <div className="flex items-center gap-1">
      {[1,2,3,4,5].map(i => (
        <Star key={i} className={`${s} ${i <= Math.round(stars) ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'}`} />
      ))}
      {count > 0 && <span className="text-[10px] text-emerald-900/40 ml-1">({count})</span>}
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-amber-400' : 'bg-gray-400';
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-[10px] font-bold ${score >= 80 ? 'text-emerald-600' : score >= 60 ? 'text-amber-600' : 'text-gray-500'}`}>
        {score}%
      </span>
    </div>
  );
}

export default function Marketplace({ profile }: Props) {
  const [crops, setCrops] = useState<Crop[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editCrop, setEditCrop] = useState<Crop | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [maxPrice, setMaxPrice] = useState(10000);
  const [showFilters, setShowFilters] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [demandMap, setDemandMap] = useState<Record<string, number>>({});
  const [allRatings, setAllRatings] = useState<Rating[]>([]);
  const [showTopPicks, setShowTopPicks] = useState(true);
  const [ratingModal, setRatingModal] = useState<Crop | null>(null);
  const [ratingStars, setRatingStars] = useState(0);

  // Form state
  const [formType, setFormType] = useState('');
  const [formQty, setFormQty] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formGrade, setFormGrade] = useState<Grade>('A');
  const [formDesc, setFormDesc] = useState('');
  const [formLocation, setFormLocation] = useState(profile.location || '');
  const [formImages, setFormImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    try {
      const [data, demand, ratings] = await Promise.all([
        getCrops({ statuses: 'available,reserved' }),
        getCropDemand().catch(() => ({})),
        getRatings('').catch(() => []),
      ]);
      setCrops(data);
      setDemandMap(demand);
      setAllRatings(ratings);
      setError('');
    } catch (e: any) {
      setError('Cannot connect to server. Make sure the API server is running.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 8000);
    return () => clearInterval(interval);
  }, [loadData]);

  // ── F1: Compute scores and sort ─────────────────────────────────────────────
  const cropsWithScores = crops.map(c => ({
    ...c,
    smartScore: computeSmartScore(c, crops, demandMap, allRatings, profile.location),
    reputationScore: (() => {
      const r = allRatings.filter(rt => rt.farmerId === c.farmerId);
      return r.length ? r.reduce((s, rt) => s + rt.stars, 0) / r.length : 0;
    })(),
  }));

  const filtered = cropsWithScores.filter(c => {
    if (searchTerm && !c.type.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !c.location.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (filterType && c.type !== filterType) return false;
    if (filterLocation && !c.location.toLowerCase().includes(filterLocation.toLowerCase())) return false;
    if (c.price > maxPrice) return false;
    if (c.status === 'sold' && c.farmerId !== profile.uid) return false;
    return true;
  });

  const myCrops = filtered.filter(c => c.farmerId === profile.uid);
  const otherCrops = filtered
    .filter(c => c.farmerId !== profile.uid)
    .sort((a, b) => (b.smartScore || 0) - (a.smartScore || 0));

  const topPicks = otherCrops.filter(c => (c.smartScore || 0) >= 65).slice(0, 3);

  const resetForm = () => {
    setFormType(''); setFormQty(''); setFormPrice(''); setFormGrade('A');
    setFormDesc(''); setFormLocation(profile.location || '');
    setFormImages([]); setEditCrop(null); setShowAdd(false);
  };

  const openEdit = (crop: Crop) => {
    setFormType(crop.type); setFormQty(String(crop.quantity));
    setFormPrice(String(crop.price)); setFormGrade(crop.grade);
    setFormDesc(crop.description || ''); setFormLocation(crop.location);
    setFormImages(crop.images || []); setEditCrop(crop); setShowAdd(true);
  };

  const handleSave = async () => {
    if (!formType || !formQty || !formPrice || !formLocation) return;
    setSaving(true);
    try {
      const data = {
        type: formType, quantity: Number(formQty), price: Number(formPrice),
        grade: formGrade, location: formLocation, description: formDesc,
        farmerId: profile.uid, farmerName: profile.name,
        status: 'available' as CropStatus,
        images: formImages,
      };
      if (editCrop) await updateCrop(editCrop.id, { ...data, status: editCrop.status });
      else await createCrop(data);
      await loadData();
      resetForm();
    } catch (err: any) {
      alert('Save failed: ' + err.message);
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this listing?')) return;
    try { await deleteCrop(id); await loadData(); }
    catch (err: any) { alert('Delete failed: ' + err.message); }
  };

  // F7: Photo upload — convert to base64
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 3 - formImages.length);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => {
        setFormImages(prev => [...prev, ev.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  // F5: Submit rating
  const handleRating = async (crop: Crop) => {
    if (!ratingStars) return;
    try {
      await createRating({
        farmerId: crop.farmerId,
        buyerId: profile.uid,
        buyerName: profile.name,
        cropId: crop.id,
        stars: ratingStars,
      });
      setRatingModal(null);
      setRatingStars(0);
      await loadData();
    } catch {}
  };

  const gradeColor = (g: Grade) =>
    g === 'A' ? 'text-emerald-600 bg-emerald-50' : g === 'B' ? 'text-blue-600 bg-blue-50' : 'text-orange-600 bg-orange-50';
  const statusColor = (s: string) =>
    s === 'available' ? 'bg-emerald-100 text-emerald-700' : s === 'reserved' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-black text-emerald-950 flex items-center gap-2">
          <Package className="w-6 h-6 text-emerald-600" /> Marketplace
          <button onClick={loadData} className="p-1.5 hover:bg-emerald-50 rounded-lg ml-1" title="Refresh">
            <RefreshCw className="w-4 h-4 text-emerald-400" />
          </button>
        </h2>
        {profile.role === 'farmer' && (
          <button onClick={() => { resetForm(); setShowAdd(true); }}
            className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 flex items-center gap-2 shadow-lg shadow-emerald-200">
            <Plus className="w-4 h-4" /> Add Crop
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-sm text-red-700">⚠️ {error}</div>
      )}

      {/* F1: Smart Choice Top Picks Banner */}
      {profile.role === 'buyer' && topPicks.length > 0 && showTopPicks && (
        <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-2xl p-5 text-white">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-300 fill-amber-300" />
              <h3 className="font-bold">Smart Choice — Top {topPicks.length} Picks For You</h3>
            </div>
            <button onClick={() => setShowTopPicks(false)} className="p-1 hover:bg-white/20 rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {topPicks.map((crop, idx) => (
              <div key={crop.id} className="bg-white/10 backdrop-blur-sm rounded-xl p-3 hover:bg-white/20 transition-all">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-black text-amber-300">#{idx + 1}</span>
                  <span className="font-bold text-sm">{crop.type}</span>
                  <span className="ml-auto text-xs bg-white/20 px-2 py-0.5 rounded-full font-bold">{crop.smartScore}%</span>
                </div>
                <p className="text-xs text-white/70">₹{crop.price}/kg • Grade {crop.grade}</p>
                <p className="text-xs text-white/50 flex items-center gap-1 mt-1"><MapPin className="w-2.5 h-2.5" />{crop.location}</p>
                {demandMap[crop.type] > 0 && (
                  <p className="text-xs text-amber-300 mt-1">🔥 {demandMap[crop.type]} active bids</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* F1: Farmer demand signal */}
      {profile.role === 'farmer' && Object.keys(demandMap).length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-amber-600" />
            <span className="font-bold text-amber-800 text-sm">Live Buyer Demand</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(demandMap).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([type, count]) => (
              <span key={type} className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-bold">
                {type} — {count} buyer{count > 1 ? 's' : ''} looking
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Search & Filter */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
          <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search crops by name or location..."
            className="w-full pl-10 pr-4 py-3 bg-white rounded-xl border border-emerald-100 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
        </div>
        <button onClick={() => setShowFilters(!showFilters)}
          className="px-4 py-3 bg-white border border-emerald-100 rounded-xl text-sm font-bold text-emerald-700 hover:bg-emerald-50 flex items-center gap-2">
          <Filter className="w-4 h-4" /> Filters <ChevronDown className={`w-3 h-3 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {showFilters && (
        <div className="bg-white p-5 rounded-2xl border border-emerald-100 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-bold text-emerald-900/60 mb-1 block">Crop Type</label>
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              className="w-full px-3 py-2 bg-emerald-50 rounded-xl text-sm border-none">
              <option value="">All Types</option>
              {CROP_TYPES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-emerald-900/60 mb-1 block">Location</label>
            <input value={filterLocation} onChange={e => setFilterLocation(e.target.value)} placeholder="Any location"
              className="w-full px-3 py-2 bg-emerald-50 rounded-xl text-sm border-none outline-none" />
          </div>
          <div>
            <label className="text-xs font-bold text-emerald-900/60 mb-1 block">Max Price (₹/kg)</label>
            <input type="number" value={maxPrice} onChange={e => setMaxPrice(Number(e.target.value))}
              className="w-full px-3 py-2 bg-emerald-50 rounded-xl text-sm border-none outline-none" />
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAdd && profile.role === 'farmer' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={resetForm}>
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-md shadow-2xl overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-emerald-950">{editCrop ? 'Edit Listing' : 'Add Crop Listing'}</h3>
              <button onClick={resetForm} className="p-2 hover:bg-gray-100 rounded-xl"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-emerald-900/60 mb-1 block">Crop Type *</label>
                <select value={formType} onChange={e => setFormType(e.target.value)}
                  className="w-full px-3 py-3 bg-emerald-50 rounded-xl border-none text-sm">
                  <option value="">Select crop</option>
                  {CROP_TYPES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-emerald-900/60 mb-1 block">Quantity (kg) *</label>
                  <input type="number" value={formQty} onChange={e => setFormQty(e.target.value)} placeholder="100"
                    className="w-full px-3 py-3 bg-emerald-50 rounded-xl border-none text-sm outline-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-emerald-900/60 mb-1 block">Price (₹/kg) *</label>
                  <input type="number" value={formPrice} onChange={e => setFormPrice(e.target.value)} placeholder="25"
                    className="w-full px-3 py-3 bg-emerald-50 rounded-xl border-none text-sm outline-none" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-emerald-900/60 mb-1 block">Grade *</label>
                <div className="flex gap-2">
                  {(['A', 'B', 'C'] as Grade[]).map(g => (
                    <button key={g} onClick={() => setFormGrade(g)}
                      className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all ${formGrade === g ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700'}`}>
                      Grade {g}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-emerald-900/60 mb-1 block">Location *</label>
                <input value={formLocation} onChange={e => setFormLocation(e.target.value)}
                  className="w-full px-3 py-3 bg-emerald-50 rounded-xl border-none text-sm outline-none" />
              </div>
              <div>
                <label className="text-xs font-bold text-emerald-900/60 mb-1 block">Description</label>
                <textarea value={formDesc} onChange={e => setFormDesc(e.target.value)} rows={2}
                  placeholder="Freshly harvested, organic..."
                  className="w-full px-3 py-3 bg-emerald-50 rounded-xl border-none text-sm resize-none outline-none" />
              </div>

              {/* F7: Photo Upload */}
              <div>
                <label className="text-xs font-bold text-emerald-900/60 mb-2 block flex items-center gap-1">
                  <Camera className="w-3 h-3" /> Crop Photos (max 3)
                </label>
                <div className="flex gap-2 flex-wrap">
                  {formImages.map((img, i) => (
                    <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-emerald-200">
                      <img src={img} alt="" className="w-full h-full object-cover" />
                      <button onClick={() => setFormImages(prev => prev.filter((_, j) => j !== i))}
                        className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs">×</button>
                    </div>
                  ))}
                  {formImages.length < 3 && (
                    <button onClick={() => fileInputRef.current?.click()}
                      className="w-20 h-20 rounded-xl border-2 border-dashed border-emerald-200 flex flex-col items-center justify-center gap-1 text-emerald-400 hover:border-emerald-400 hover:text-emerald-600 transition-all">
                      <ImageIcon className="w-5 h-5" />
                      <span className="text-[10px]">Add</span>
                    </button>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
                </div>
              </div>

              <button onClick={handleSave} disabled={saving || !formType || !formQty || !formPrice || !formLocation}
                className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 disabled:opacity-50">
                {saving ? 'Saving...' : editCrop ? 'Update Listing' : 'Create Listing'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rating Modal (F5) */}
      {ratingModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => { setRatingModal(null); setRatingStars(0); }}>
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-emerald-950 mb-1">Rate Farmer</h3>
            <p className="text-sm text-emerald-900/50 mb-6">How would you rate {ratingModal.farmerName}?</p>
            <div className="flex justify-center gap-3 mb-6">
              {[1,2,3,4,5].map(s => (
                <button key={s} onClick={() => setRatingStars(s)}>
                  <Star className={`w-9 h-9 transition-all ${s <= ratingStars ? 'text-amber-400 fill-amber-400 scale-110' : 'text-gray-200'}`} />
                </button>
              ))}
            </div>
            <button onClick={() => handleRating(ratingModal)} disabled={!ratingStars}
              className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold disabled:opacity-50">
              Submit Rating
            </button>
          </div>
        </div>
      )}

      {loading && <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
      </div>}

      {!loading && <>
        {/* My Listings */}
        {profile.role === 'farmer' && myCrops.length > 0 && (
          <div>
            <h3 className="font-bold text-emerald-950 mb-3">My Listings ({myCrops.length})</h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myCrops.map(crop => (
                <div key={crop.id} className="bg-white rounded-2xl p-5 border border-emerald-100 shadow-sm hover:shadow-md transition-all">
                  {/* Photos */}
                  {crop.images && crop.images.length > 0 && (
                    <div className="flex gap-1 mb-3 overflow-hidden rounded-xl">
                      {crop.images.slice(0, 3).map((img, i) => (
                        <img key={i} src={img} alt="" className="h-20 flex-1 object-cover" />
                      ))}
                    </div>
                  )}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-bold text-emerald-950">{crop.type}</h4>
                      <p className="text-xs text-emerald-900/50 flex items-center gap-1"><MapPin className="w-3 h-3" />{crop.location}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${statusColor(crop.status)}`}>{crop.status}</span>
                  </div>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-2xl font-black text-emerald-600">₹{crop.price}</span>
                    <span className="text-xs text-emerald-900/40">/kg</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ml-auto ${gradeColor(crop.grade)}`}>Grade {crop.grade}</span>
                  </div>
                  <p className="text-xs text-emerald-900/50 mb-3">{crop.quantity} kg available</p>
                  {/* Demand signal */}
                  {demandMap[crop.type] > 0 && (
                    <p className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-lg mb-2 font-medium">
                      🔥 {demandMap[crop.type]} buyer{demandMap[crop.type] > 1 ? 's' : ''} looking for this
                    </p>
                  )}
                  {crop.description && <p className="text-xs text-emerald-900/40 mb-3 line-clamp-2">{crop.description}</p>}
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(crop)} className="flex-1 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold hover:bg-emerald-100 flex items-center justify-center gap-1">
                      <Edit2 className="w-3 h-3" /> Edit
                    </button>
                    <button onClick={() => handleDelete(crop.id)} className="py-2 px-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold hover:bg-red-100">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Available Crops */}
        <div>
          <h3 className="font-bold text-emerald-950 mb-3">
            {profile.role === 'farmer' ? `Other Listings (${otherCrops.length})` : `Available Crops (${filtered.length})`}
            {profile.role === 'buyer' && <span className="text-xs font-normal text-emerald-900/40 ml-2">— sorted by Smart Score</span>}
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(profile.role === 'farmer' ? otherCrops : filtered).map(crop => (
              <div key={crop.id} className={`bg-white rounded-2xl p-5 border shadow-sm hover:shadow-md transition-all group ${
                (crop.smartScore || 0) >= 80 ? 'border-emerald-300 ring-1 ring-emerald-200' : 'border-emerald-100'
              }`}>
                {/* Photos */}
                {crop.images && crop.images.length > 0 && (
                  <div className="flex gap-1 mb-3 rounded-xl overflow-hidden h-24">
                    {crop.images.slice(0, 3).map((img, i) => (
                      <img key={i} src={img} alt="" className="flex-1 object-cover" />
                    ))}
                  </div>
                )}
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-bold text-emerald-950">{crop.type}</h4>
                    <p className="text-xs text-emerald-900/50 flex items-center gap-1"><MapPin className="w-3 h-3" />{crop.location}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${statusColor(crop.status)}`}>{crop.status}</span>
                </div>

                {/* F5: Reputation stars */}
                {(crop.reputationScore || 0) > 0 && (
                  <StarRating stars={crop.reputationScore || 0} count={allRatings.filter(r => r.farmerId === crop.farmerId).length} />
                )}

                <div className="flex items-baseline gap-2 my-2">
                  <span className="text-2xl font-black text-emerald-600">₹{crop.price}</span>
                  <span className="text-xs text-emerald-900/40">/kg</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ml-auto ${gradeColor(crop.grade)}`}>Grade {crop.grade}</span>
                </div>
                <p className="text-xs text-emerald-900/50 mb-1">{crop.quantity} kg • by {crop.farmerName}</p>

                {/* F1: Smart Score */}
                {profile.role === 'buyer' && (crop.smartScore || 0) > 0 && (
                  <div className="mt-2 mb-1">
                    <ScoreBadge score={crop.smartScore || 0} />
                  </div>
                )}

                {crop.description && <p className="text-xs text-emerald-900/40 line-clamp-2 mt-1">{crop.description}</p>}

                {/* Rate farmer button for buyers */}
                {profile.role === 'buyer' && (
                  <button onClick={() => setRatingModal(crop)}
                    className="mt-3 w-full py-1.5 bg-amber-50 text-amber-700 rounded-xl text-xs font-bold hover:bg-amber-100 flex items-center justify-center gap-1">
                    <Star className="w-3 h-3" /> Rate Farmer
                  </button>
                )}
              </div>
            ))}
            {filtered.length === 0 && !loading && (
              <div className="col-span-full p-12 text-center bg-white rounded-2xl border-2 border-dashed border-emerald-100">
                <Package className="w-10 h-10 text-emerald-200 mx-auto mb-3" />
                <p className="text-emerald-900/40">{profile.role === 'farmer' ? 'Add your first crop listing!' : 'No crops available yet.'}</p>
              </div>
            )}
          </div>
        </div>
      </>}
    </div>
  );
}
