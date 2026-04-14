import React, { useState, useEffect, useCallback } from 'react';
import { getBids, createBid, updateBid, getCrops, createNotification } from '../api';
import { UserProfile, Bid } from '../types';
import {
  DollarSign, CheckCircle, XCircle, Clock, RefreshCw,
  Plus, X, MessageSquare, ArrowRightLeft
} from 'lucide-react';
import ChatThread from './ChatThread';

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
  // F4: messaging
  const [chatBid, setChatBid] = useState<any>(null);
  // F2: counter-offer
  const [counterBid, setCounterBid] = useState<any>(null);
  const [counterPrice, setCounterPrice] = useState('');
  const [counterMsg, setCounterMsg] = useState('');

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

  // F2: Submit counter-offer
  const handleCounterOffer = async () => {
    if (!counterBid || !counterPrice) return;
    const round = (counterBid.counterRound || 0) + 1;
    if (round > 3) { alert('Maximum 3 counter-offers reached.'); return; }
    try {
      await updateBid(counterBid.id, {
        status: 'countered',
        counterPrice: Number(counterPrice),
        counterMessage: counterMsg,
        counterRound: round,
      });
      await createNotification({
        userId: counterBid.buyerId, type: 'counter_offer',
        message: `${profile.name} countered your bid at ₹${counterPrice}/kg for ${counterBid.cropType}`,
        read: false, relatedId: counterBid.cropId,
      });
      setCounterBid(null); setCounterPrice(''); setCounterMsg('');
      await loadData();
    } catch (e: any) { alert('Failed: ' + e.message); }
  };

  // F2: Buyer accepts counter-offer
  const handleAcceptCounter = async (bid: any) => {
    try {
      await updateBid(bid.id, { status: 'accepted', price: bid.counterPrice });
      await createNotification({
        userId: bid.farmerId, type: 'bid_accepted',
        message: `${profile.name} accepted your counter offer of ₹${bid.counterPrice}/kg for ${bid.cropType}`,
        read: false, relatedId: bid.cropId,
      });
      await loadData();
    } catch (e: any) { alert('Failed: ' + e.message); }
  };

  const statusStyle = (s: string) => ({
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    accepted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rejected: 'bg-red-50 text-red-600 border-red-200',
    countered: 'bg-blue-50 text-blue-700 border-blue-200',
  }[s] || 'bg-gray-50 text-gray-600 border-gray-200');

  const statusIcon = (s: string) =>
    s === 'accepted' ? <CheckCircle className="w-4 h-4" /> :
    s === 'rejected' ? <XCircle className="w-4 h-4" /> :
    s === 'countered' ? <ArrowRightLeft className="w-4 h-4" /> : <Clock className="w-4 h-4" />;

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

      {/* Place Bid Modal */}
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
                    className="w-full px-3 py-3 bg-emerald-50 rounded-xl border-none text-sm outline-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-emerald-900/60 mb-1 block">Quantity (kg) *</label>
                  <input type="number" value={bidQty} onChange={e => setBidQty(e.target.value)}
                    placeholder={selectedCrop ? `max ${selectedCrop.quantity}` : '0'}
                    max={selectedCrop?.quantity}
                    className="w-full px-3 py-3 bg-emerald-50 rounded-xl border-none text-sm outline-none" />
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

      {/* F2: Counter-Offer Modal */}
      {counterBid && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setCounterBid(null)}>
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-emerald-950">Counter Offer</h3>
              <button onClick={() => setCounterBid(null)} className="p-2 hover:bg-gray-100 rounded-xl"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-3 bg-emerald-50 rounded-xl text-sm mb-4">
              <p className="font-bold text-emerald-800">{counterBid.cropType}</p>
              <p className="text-emerald-700">Buyer bid: ₹{counterBid.price}/kg • {counterBid.quantity}kg</p>
              <p className="text-xs text-emerald-600 mt-1">Round {(counterBid.counterRound || 0) + 1} of 3</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-emerald-900/60 mb-1 block">Your Counter Price (₹/kg) *</label>
                <input type="number" value={counterPrice} onChange={e => setCounterPrice(e.target.value)}
                  placeholder="Enter your price"
                  className="w-full px-3 py-3 bg-emerald-50 rounded-xl border-none text-sm outline-none" />
              </div>
              <div>
                <label className="text-xs font-bold text-emerald-900/60 mb-1 block">Message (optional)</label>
                <textarea value={counterMsg} onChange={e => setCounterMsg(e.target.value)}
                  placeholder="e.g. Best price for Grade A quality..."
                  className="w-full px-3 py-3 bg-emerald-50 rounded-xl border-none text-sm resize-none outline-none" rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => handleStatus(counterBid.id, 'rejected')}
                  className="py-3 bg-red-50 text-red-600 rounded-xl font-bold text-sm hover:bg-red-100">
                  Reject Bid
                </button>
                <button onClick={handleCounterOffer} disabled={!counterPrice}
                  className="py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 disabled:opacity-50">
                  Send Counter
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* F4: Chat Thread */}
      {chatBid && (
        <ChatThread
          bidId={chatBid.id}
          cropType={chatBid.cropType}
          partnerId={profile.role === 'farmer' ? chatBid.buyerId : chatBid.farmerId}
          partnerName={profile.role === 'farmer' ? chatBid.buyerName : chatBid.farmerName}
          profile={profile}
          onClose={() => setChatBid(null)}
        />
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

                  {/* F2: Show counter offer details */}
                  {bid.status === 'countered' && bid.counterPrice && (
                    <div className="mt-2 p-2 bg-blue-50 rounded-xl text-xs text-blue-800">
                      <p className="font-bold">Counter offer: ₹{bid.counterPrice}/kg</p>
                      {bid.counterMessage && <p className="mt-0.5 text-blue-600">{bid.counterMessage}</p>}
                      <p className="text-blue-400 mt-0.5">Round {bid.counterRound}/3</p>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 items-end shrink-0">
                  {/* Farmer actions on pending bid */}
                  {profile.role === 'farmer' && bid.status === 'pending' && (
                    <div className="flex gap-2">
                      <button onClick={() => handleStatus(bid.id, 'accepted')}
                        className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Accept
                      </button>
                      <button onClick={() => { setCounterBid(bid); setCounterPrice(''); setCounterMsg(''); }}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 flex items-center gap-1">
                        <ArrowRightLeft className="w-3 h-3" /> Counter
                      </button>
                      <button onClick={() => handleStatus(bid.id, 'rejected')}
                        className="px-3 py-1.5 bg-red-50 text-red-600 rounded-xl text-xs font-bold hover:bg-red-100 flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> Reject
                      </button>
                    </div>
                  )}

                  {/* Buyer actions on countered bid */}
                  {profile.role === 'buyer' && bid.status === 'countered' && (
                    <div className="flex gap-2">
                      <button onClick={() => handleAcceptCounter(bid)}
                        className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Accept ₹{bid.counterPrice}
                      </button>
                      <button onClick={() => handleStatus(bid.id, 'rejected')}
                        className="px-3 py-1.5 bg-red-50 text-red-600 rounded-xl text-xs font-bold hover:bg-red-100">
                        <XCircle className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {/* F4: Message button — always visible */}
                  <button onClick={() => setChatBid(bid)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold hover:bg-emerald-100">
                    <MessageSquare className="w-3 h-3" /> Message
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
