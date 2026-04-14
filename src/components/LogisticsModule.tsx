import React, { useState, useEffect, useCallback } from 'react';
import { getLogistics, createLogistics, updateLogistics, deleteLogistics, createBooking, getBookings } from '../api';
import { UserProfile } from '../types';
import { Truck, Plus, X, CheckCircle, RefreshCw, MapPin, Calendar } from 'lucide-react';

interface Props { profile: UserProfile; }

export default function LogisticsModule({ profile }: Props) {
  const [providers, setProviders] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Transporter form
  const [vType, setVType] = useState('');
  const [cap, setCap] = useState('');
  const [rate, setRate] = useState('');
  const [fromLoc, setFromLoc] = useState(profile.location || '');
  const [toLoc, setToLoc] = useState('');
  const [editId, setEditId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [pData, bData] = await Promise.all([
        getLogistics({ available: true }),
        getBookings(
          profile.role === 'farmer' ? { farmerId: profile.uid } :
          profile.role === 'buyer' ? { buyerId: profile.uid } :
          { logisticsId: profile.uid }
        ),
      ]);
      setProviders(pData);
      setBookings(bData);
      setError('');
    } catch (e: any) { setError('Cannot connect to server.'); }
    finally { setLoading(false); }
  }, [profile.uid, profile.role]);

  useEffect(() => { loadData(); const i = setInterval(loadData, 5000); return () => clearInterval(i); }, [loadData]);

  const handleRegister = async () => {
    if (!vType || !cap || !rate || !fromLoc) return;
    setSaving(true);
    try {
      const data = {
        vehicleType: vType, capacity: Number(cap), ratePerKm: Number(rate),
        fromLocation: fromLoc, toLocation: toLoc, available: true,
        userId: profile.uid, transporterName: profile.name, phone: profile.phone || '',
      };
      if (editId) await updateLogistics(editId, data);
      else await createLogistics(data);
      await loadData();
      resetForm();
    } catch (e: any) { alert('Save failed: ' + e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this vehicle?')) return;
    try { await deleteLogistics(id); await loadData(); }
    catch (e: any) { alert('Failed: ' + e.message); }
  };

  const handleBook = async (provider: any) => {
    setSaving(true);
    try {
      await createBooking({
        logisticsId: provider.id, transporterId: provider.userId,
        transporterName: provider.transporterName,
        buyerId: profile.uid, buyerName: profile.name,
        vehicleType: provider.vehicleType, capacity: provider.capacity,
        ratePerKm: provider.ratePerKm, fromLocation: provider.fromLocation,
        toLocation: provider.toLocation || '', status: 'booked',
      });
      // Mark vehicle as unavailable
      await updateLogistics(provider.id, { available: false });
      await loadData();
    } catch (e: any) { alert('Booking failed: ' + e.message); }
    finally { setSaving(false); }
  };

  const resetForm = () => {
    setVType(''); setCap(''); setRate(''); setFromLoc(profile.location || ''); setToLoc('');
    setEditId(null); setShowForm(false);
  };

  const myVehicles = providers.filter(p => p.userId === profile.uid);
  const otherVehicles = providers.filter(p => p.userId !== profile.uid);

  const vehicleTypes = ['Mini Truck (1T)', 'Pickup Van (500kg)', 'Lorry (5T)', 'Tractor-Trailer (3T)', 'Refrigerated Van (2T)'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-black text-emerald-950 flex items-center gap-2">
          <Truck className="w-6 h-6 text-emerald-600" /> Logistics
          <button onClick={loadData} className="p-1.5 hover:bg-emerald-50 rounded-lg ml-1">
            <RefreshCw className="w-4 h-4 text-emerald-400" />
          </button>
        </h2>
        {profile.role === 'transporter' && (
          <button onClick={() => setShowForm(true)}
            className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 flex items-center gap-2 shadow-lg shadow-emerald-200">
            <Plus className="w-4 h-4" /> Add Vehicle
          </button>
        )}
      </div>

      {error && <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-sm text-red-700">⚠️ {error}</div>}

      {/* Register/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={resetForm}>
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold">{editId ? 'Edit Vehicle' : 'Register Vehicle'}</h3>
              <button onClick={resetForm} className="p-2 hover:bg-gray-100 rounded-xl"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-emerald-900/60 mb-1 block">Vehicle Type *</label>
                <select value={vType} onChange={e => setVType(e.target.value)}
                  className="w-full px-3 py-3 bg-emerald-50 rounded-xl text-sm border-none">
                  <option value="">Select type</option>
                  {vehicleTypes.map(v => <option key={v}>{v}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-emerald-900/60 mb-1 block">Capacity (kg) *</label>
                  <input type="number" value={cap} onChange={e => setCap(e.target.value)} placeholder="1000"
                    className="w-full px-3 py-3 bg-emerald-50 rounded-xl border-none text-sm" />
                </div>
                <div>
                  <label className="text-xs font-bold text-emerald-900/60 mb-1 block">Rate (₹/km) *</label>
                  <input type="number" value={rate} onChange={e => setRate(e.target.value)} placeholder="15"
                    className="w-full px-3 py-3 bg-emerald-50 rounded-xl border-none text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-emerald-900/60 mb-1 block">From Location *</label>
                <input value={fromLoc} onChange={e => setFromLoc(e.target.value)}
                  className="w-full px-3 py-3 bg-emerald-50 rounded-xl border-none text-sm" />
              </div>
              <div>
                <label className="text-xs font-bold text-emerald-900/60 mb-1 block">To Location (optional)</label>
                <input value={toLoc} onChange={e => setToLoc(e.target.value)} placeholder="Any"
                  className="w-full px-3 py-3 bg-emerald-50 rounded-xl border-none text-sm" />
              </div>
              <button onClick={handleRegister} disabled={saving || !vType || !cap || !rate || !fromLoc}
                className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 disabled:opacity-50">
                {saving ? 'Saving...' : editId ? 'Update' : '🚛 Register Vehicle'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
      </div>}

      {!loading && <>
        {/* Transporter's own vehicles */}
        {profile.role === 'transporter' && myVehicles.length > 0 && (
          <div>
            <h3 className="font-bold text-emerald-950 mb-3">My Vehicles ({myVehicles.length})</h3>
            <div className="grid md:grid-cols-2 gap-4">
              {myVehicles.map(p => (
                <div key={p.id} className="bg-white rounded-2xl p-5 border border-emerald-100">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-emerald-950">🚛 {p.vehicleType}</h4>
                      <p className="text-sm text-emerald-700 mt-1">{p.capacity}kg capacity • ₹{p.ratePerKm}/km</p>
                      <p className="text-xs text-emerald-900/50 flex items-center gap-1 mt-1"><MapPin className="w-3 h-3" />{p.fromLocation}</p>
                    </div>
                    <div className="flex gap-2">
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${p.available ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                        {p.available ? '✅ Available' : '🔒 Booked'}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => handleDelete(p.id)}
                      className="px-3 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-bold hover:bg-red-100">
                      Remove
                    </button>
                    <button onClick={() => updateLogistics(p.id, { available: !p.available }).then(loadData)}
                      className="px-3 py-2 bg-amber-50 text-amber-700 rounded-xl text-xs font-bold hover:bg-amber-100">
                      Toggle Available
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Available vehicles for farmers/buyers */}
        {profile.role !== 'transporter' && (
          <div>
            <h3 className="font-bold text-emerald-950 mb-3">Available Vehicles ({otherVehicles.length})</h3>
            {otherVehicles.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-2xl border-2 border-dashed border-emerald-100">
                <Truck className="w-10 h-10 text-emerald-200 mx-auto mb-3" />
                <p className="text-emerald-900/40">No vehicles available. Transporters will register here.</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {otherVehicles.map(p => (
                  <div key={p.id} className="bg-white rounded-2xl p-5 border border-emerald-100 hover:shadow-md transition-all">
                    <h4 className="font-bold text-emerald-950 mb-1">🚛 {p.vehicleType}</h4>
                    <div className="space-y-1 text-sm text-emerald-900/60 mb-3">
                      <p>📦 {p.capacity}kg • ₹{p.ratePerKm}/km</p>
                      <p className="flex items-center gap-1"><MapPin className="w-3 h-3" />{p.fromLocation}{p.toLocation ? ` → ${p.toLocation}` : ''}</p>
                      <p>👤 {p.transporterName}</p>
                    </div>
                    <button onClick={() => handleBook(p)} disabled={saving}
                      className="w-full py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2">
                      <CheckCircle className="w-4 h-4" /> Book This Vehicle
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* My Bookings */}
        {bookings.length > 0 && (
          <div>
            <h3 className="font-bold text-emerald-950 mb-3 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-600" /> My Bookings ({bookings.length})
            </h3>
            <div className="space-y-3">
              {bookings.map(b => (
                <div key={b.id} className="bg-white rounded-2xl p-5 border border-emerald-100">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-emerald-950">🚛 {b.vehicleType}</h4>
                      <p className="text-sm text-emerald-700">{b.capacity}kg • ₹{b.ratePerKm}/km</p>
                      <p className="text-xs text-emerald-900/50 mt-1">
                        {b.fromLocation}{b.toLocation ? ` → ${b.toLocation}` : ''}
                      </p>
                      <p className="text-xs text-emerald-900/40 mt-1">
                        {profile.role !== 'transporter' ? `Transporter: ${b.transporterName}` : `Booked by: ${b.buyerName}`}
                        {' • '}{new Date(b.createdAt).toLocaleDateString('en-IN')}
                      </p>
                    </div>
                    <span className="text-xs font-bold px-2 py-1 rounded-full bg-blue-100 text-blue-700">{b.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </>}
    </div>
  );
}
