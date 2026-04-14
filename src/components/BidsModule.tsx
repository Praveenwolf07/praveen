import React, { useState, useEffect, useCallback } from 'react';
import { getBids, createBid, updateBid, getCrops, createNotification } from '../api';
import { UserProfile } from '../types';
import { DollarSign, CheckCircle, XCircle, Clock, RefreshCw, Plus, X } from 'lucide-react';

interface Props { profile: UserProfile; }

export default function BidsModule({ profile }: Props) {
  const [bids, setBids] = useState<any[]>([]);
  const [crops, setCrops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBidForm, setShowBidForm] = useState(false);
  const [selectedCrop, setSelectedCrop] = useState<any>(null);
  const [bidPrice, setBidPrice] = useState('');
  const [bidQty, setBidQty] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [bidsData, cropsData] = await Promise.all([
        getBids(profile.role === 'farmer' ? { farmerId: profile.uid } : { buyerId: profile.uid }),
        getCrops({ statuses: 'available' }),
      ]);
      setBids(bidsData);
      setCrops(cropsData);
      setError('');
    } catch (e: any) {
      setError('Cannot connect to server.');
    } finally { setLoading(false); }
  }, [profile.uid, profile.role]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handlePlaceBid = async () => {
    if (!selectedCrop || !bidPrice || !bidQty) return;
    setSaving(true);
    try {
      await createBid({
        cropId: selectedCrop.id, cropType: selectedCrop.type,
        farmerId: selectedCrop.farmerId, farmerName: selectedCrop.farmerName,
        buyerId: profile.uid, buyerName: profile.name,
        price: Number(bidPrice), quantity: Number(bidQty), status: 'pending',
      });
      // Notify farmer
      await createNotification({
        userId: selectedCrop.farmerId, type: 'new_bid',
        message: `${profile.name} placed a bid of ₹${bidPrice}/kg for your ${selectedCrop.type}`,
        read: false, relatedId: selectedCrop.id,
      });
      await loadData();
      setShowBidForm(false); setBidPrice(''); setBidQty(''); setSelectedCrop(null);
    } catch (e: any) { alert('Failed: ' + e.message); }
    finally { setSaving(false); }
  };

  const handleStatus = async (bidId: string, status: 'accepted' | 'rejected') => {
    try {
      await updateBid(bidId, { status });
      await loadData();
    } catch (e: any) { alert('Failed: ' + e.message); }
  };

  const statusStyle = (s: string) => ({
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    accepted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rejected: 'bg-red-50 text-red-600 border-red-200',
  }[s] || 'bg-gray-50 text-gray-600 border-gray-200');

  const statusIcon = (s: string) =>
    s === 'accepted' ? <CheckCircle className="w-4 h-4" /> :
    s === 'rejected' ? <XCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />;

  const availableCrops = crops.filter(c => c.farmerId !== profile.uid);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-black text-emerald-950 flex items-center gap-2">
          <DollarSign className="w-6 h-6 text-emerald-600" /> Bids
          <button onClick={loadData} className="p-1.5 hover:bg-emerald-50 rounded-lg ml-1">
            <RefreshCw className="w-4 h-4 text-emerald-400" />
          </button>
        </h2>
        {profile.role === 'buyer' && (
          <button onClick={() => setShowBidForm(true)}
            className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 flex items-center gap-2 shadow-lg shadow-emerald-200">
            <Plus className="w-4 h-4" /> Place New Bid
          </button>
        )}
      </div>

      {error && <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-sm text-red-700">⚠️ {error}</div>}

      {/* Place Bid Modal — Buyer */}
      {showBidForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowBidForm(false)}>
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-emerald-950">Place a Bid</h3>
              <button onClick={() => setShowBidForm(false)} className="p-2 hover:bg-gray-100 rounded-xl"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-emerald-900/60 mb-1 block">Select Crop *</label>
                <select value={selectedCrop?.id || ''} onChange={e => setSelectedCrop(availableCrops.find(c => c.id === e.target.value) || null)}
                  className="w-full px-3 py-3 bg-emerald-50 rounded-xl text-sm border-none">
                  <option value="">Choose a crop listing...</option>
                  {availableCrops.map(c => (
                    <option key={c.id} value={c.id}>{c.type} — ₹{c.price}/kg ({c.quantity}kg) from {c.farmerName}</option>
                  ))}
                </select>
              </div>
              {selectedCrop && (
                <div className="p-3 bg-emerald-50 rounded-xl text-sm">
                  <p className="font-bold text-emerald-800">{selectedCrop.type}</p>
                  <p className="text-emerald-700">Listed at ₹{selectedCrop.price}/kg • {selectedCrop.quantity}kg • Grade {selectedCrop.grade}</p>
                  <p className="text-emerald-600 text-xs">{selectedCrop.location} • by {selectedCrop.farmerName}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-emerald-900/60 mb-1 block">Your Bid (₹/kg) *</label>
                  <input type="number" value={bidPrice} onChange={e => setBidPrice(e.target.value)} placeholder="Enter price"
                    className="w-full px-3 py-3 bg-emerald-50 rounded-xl border-none text-sm" />
                </div>
                <div>
                  <label className="text-xs font-bold text-emerald-900/60 mb-1 block">Quantity (kg) *</label>
                  <input type="number" value={bidQty} onChange={e => setBidQty(e.target.value)}
                    placeholder={selectedCrop ? `max ${selectedCrop.quantity}` : '0'}
                    max={selectedCrop?.quantity}
                    className="w-full px-3 py-3 bg-emerald-50 rounded-xl border-none text-sm" />
                </div>
              </div>
              {bidPrice && selectedCrop && (
                <div className="p-3 bg-blue-50 rounded-xl text-xs text-blue-700">
                  💡 You're bidding {Number(bidPrice) >= selectedCrop.price ? '≥' : '<'} the listed price
                  {Number(bidPrice) >= selectedCrop.price && ' — farmer likely to accept!'}
                </div>
              )}
              <button onClick={handlePlaceBid} disabled={saving || !selectedCrop || !bidPrice || !bidQty}
                className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 disabled:opacity-50">
                {saving ? 'Submitting...' : '📤 Submit Bid'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
      </div>}

      {!loading && bids.length === 0 && (
        <div className="p-12 text-center bg-white rounded-2xl border-2 border-dashed border-emerald-100">
          <DollarSign className="w-10 h-10 text-emerald-200 mx-auto mb-3" />
          <p className="text-emerald-900/40 font-medium">No bids yet</p>
          <p className="text-emerald-900/30 text-sm mt-1">
            {profile.role === 'buyer' ? 'Place a bid on any available crop listing' : 'Buyers will bid on your crop listings'}
          </p>
        </div>
      )}

      {!loading && bids.length > 0 && (
        <div className="space-y-3">
          {bids.map(bid => (
            <div key={bid.id} className={`bg-white rounded-2xl p-5 border-2 ${statusStyle(bid.status)}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-bold text-emerald-950">{bid.cropType}</h4>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase flex items-center gap-1 ${statusStyle(bid.status)}`}>
                      {statusIcon(bid.status)} {bid.status}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-emerald-900/60">
                    <span>💰 <strong className="text-emerald-700">₹{bid.price}/kg</strong></span>
                    <span>📦 {bid.quantity} kg</span>
                    {profile.role === 'farmer' ? <span>👤 by {bid.buyerName}</span> : <span>🌾 from {bid.farmerName}</span>}
                    <span>📅 {new Date(bid.createdAt).toLocaleDateString('en-IN')}</span>
                  </div>
                </div>

                {profile.role === 'farmer' && bid.status === 'pending' && (
                  <div className="flex gap-2">
                    <button onClick={() => handleStatus(bid.id, 'accepted')}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Accept
                    </button>
                    <button onClick={() => handleStatus(bid.id, 'rejected')}
                      className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-bold hover:bg-red-100 flex items-center gap-1">
                      <XCircle className="w-3 h-3" /> Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
