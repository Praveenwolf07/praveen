import React, { useState, useEffect, useCallback } from 'react';
import { getCrops, createCrop, updateCrop, deleteCrop } from '../api';
import { Crop, UserProfile, Grade, CropStatus } from '../types';
import { CROP_TYPES } from '../constants';
import { Plus, Search, MapPin, X, Edit2, Trash2, Filter, Package, ChevronDown, RefreshCw } from 'lucide-react';

interface Props { profile: UserProfile; }

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

  // Form
  const [formType, setFormType] = useState('');
  const [formQty, setFormQty] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formGrade, setFormGrade] = useState<Grade>('A');
  const [formDesc, setFormDesc] = useState('');
  const [formLocation, setFormLocation] = useState(profile.location || '');

  const loadCrops = useCallback(async () => {
    try {
      const data = await getCrops({ statuses: 'available,reserved' });
      setCrops(data);
      setError('');
    } catch (e: any) {
      setError('Cannot connect to server. Make sure the API server is running.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    loadCrops();
    const interval = setInterval(loadCrops, 5000); // poll every 5s
    return () => clearInterval(interval);
  }, [loadCrops]);

  const filtered = crops.filter(c => {
    if (searchTerm && !c.type.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !c.location.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (filterType && c.type !== filterType) return false;
    if (filterLocation && !c.location.toLowerCase().includes(filterLocation.toLowerCase())) return false;
    if (c.price > maxPrice) return false;
    if (c.status === 'sold' && c.farmerId !== profile.uid) return false;
    return true;
  });

  const myCrops = filtered.filter(c => c.farmerId === profile.uid);
  const otherCrops = filtered.filter(c => c.farmerId !== profile.uid);

  const resetForm = () => {
    setFormType(''); setFormQty(''); setFormPrice(''); setFormGrade('A');
    setFormDesc(''); setFormLocation(profile.location || '');
    setEditCrop(null); setShowAdd(false);
  };

  const openEdit = (crop: Crop) => {
    setFormType(crop.type); setFormQty(String(crop.quantity));
    setFormPrice(String(crop.price)); setFormGrade(crop.grade);
    setFormDesc(crop.description || ''); setFormLocation(crop.location);
    setEditCrop(crop); setShowAdd(true);
  };

  const handleSave = async () => {
    if (!formType || !formQty || !formPrice || !formLocation) return;
    setSaving(true);
    try {
      const data = {
        type: formType, quantity: Number(formQty), price: Number(formPrice),
        grade: formGrade, location: formLocation, description: formDesc,
        farmerId: profile.uid, farmerName: profile.name, status: 'available' as CropStatus,
      };
      if (editCrop) {
        await updateCrop(editCrop.id, { ...data, status: editCrop.status });
      } else {
        await createCrop(data);
      }
      await loadCrops();
      resetForm();
    } catch (err: any) {
      alert('Save failed: ' + err.message);
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this listing?')) return;
    try { await deleteCrop(id); await loadCrops(); }
    catch (err: any) { alert('Delete failed: ' + err.message); }
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
          <button onClick={loadCrops} className="p-1.5 hover:bg-emerald-50 rounded-lg ml-1" title="Refresh">
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
        <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-sm text-red-700 flex items-center gap-2">
          ⚠️ {error}
        </div>
      )}

      {/* Search & Filter */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
          <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search crops by name or location..."
            className="w-full pl-10 pr-4 py-3 bg-white rounded-xl border border-emerald-100 text-sm focus:ring-2 focus:ring-emerald-500" />
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
              className="w-full px-3 py-2 bg-emerald-50 rounded-xl text-sm border-none" />
          </div>
          <div>
            <label className="text-xs font-bold text-emerald-900/60 mb-1 block">Max Price (₹/kg)</label>
            <input type="number" value={maxPrice} onChange={e => setMaxPrice(Number(e.target.value))}
              className="w-full px-3 py-2 bg-emerald-50 rounded-xl text-sm border-none" />
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAdd && profile.role === 'farmer' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={resetForm}>
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
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
                    className="w-full px-3 py-3 bg-emerald-50 rounded-xl border-none text-sm" />
                </div>
                <div>
                  <label className="text-xs font-bold text-emerald-900/60 mb-1 block">Price (₹/kg) *</label>
                  <input type="number" value={formPrice} onChange={e => setFormPrice(e.target.value)} placeholder="25"
                    className="w-full px-3 py-3 bg-emerald-50 rounded-xl border-none text-sm" />
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
                  className="w-full px-3 py-3 bg-emerald-50 rounded-xl border-none text-sm" />
              </div>
              <div>
                <label className="text-xs font-bold text-emerald-900/60 mb-1 block">Description</label>
                <textarea value={formDesc} onChange={e => setFormDesc(e.target.value)} rows={2}
                  placeholder="Freshly harvested, organic..."
                  className="w-full px-3 py-3 bg-emerald-50 rounded-xl border-none text-sm resize-none" />
              </div>
              <button onClick={handleSave} disabled={saving || !formType || !formQty || !formPrice || !formLocation}
                className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 disabled:opacity-50">
                {saving ? 'Saving...' : editCrop ? 'Update Listing' : 'Create Listing'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
      </div>}

      {!loading && <>
        {profile.role === 'farmer' && myCrops.length > 0 && (
          <div>
            <h3 className="font-bold text-emerald-950 mb-3">My Listings ({myCrops.length})</h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myCrops.map(crop => (
                <div key={crop.id} className="bg-white rounded-2xl p-5 border border-emerald-100 shadow-sm hover:shadow-md transition-all">
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

        <div>
          <h3 className="font-bold text-emerald-950 mb-3">
            {profile.role === 'farmer' ? `Other Listings (${otherCrops.length})` : `Available Crops (${filtered.length})`}
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(profile.role === 'farmer' ? otherCrops : filtered).map(crop => (
              <div key={crop.id} className="bg-white rounded-2xl p-5 border border-emerald-100 shadow-sm hover:shadow-md transition-all group">
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
                <p className="text-xs text-emerald-900/50 mb-1">{crop.quantity} kg • by {crop.farmerName}</p>
                {crop.description && <p className="text-xs text-emerald-900/40 line-clamp-2 mt-1">{crop.description}</p>}
                {profile.role === 'buyer' && crop.status === 'available' && (
                  <p className="text-[10px] text-emerald-500 font-bold mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    → Go to Bids tab to place a bid
                  </p>
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
