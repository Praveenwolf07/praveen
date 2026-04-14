export type Role = 'farmer' | 'buyer' | 'transporter';
export type Lang = 'en' | 'ta' | 'hi';
export type BidStatus = 'pending' | 'accepted' | 'rejected' | 'countered';
export type CropStatus = 'available' | 'reserved' | 'sold';
export type BookingStatus = 'pending' | 'confirmed' | 'in-transit' | 'delivered';
export type Grade = 'A' | 'B' | 'C';

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: Role;
  location: string;
  phone: string;
  createdAt: any;
}

export interface Crop {
  id: string;
  farmerId: string;
  farmerName: string;
  type: string;
  quantity: number;
  price: number;
  grade: Grade;
  location: string;
  status: CropStatus;
  description: string;
  images?: string[];           // F7: base64 photo array
  createdAt: any;
  // Computed client-side (Smart Choice Engine)
  smartScore?: number;
  priceRank?: 'best' | 'good' | 'fair';
  reputationScore?: number;    // F5: farmer reputation 0-5
}

export interface Bid {
  id: string;
  cropId: string;
  cropType: string;
  buyerId: string;
  buyerName: string;
  farmerId: string;
  farmerName: string;
  price: number;
  quantity: number;
  status: BidStatus;
  message: string;
  // F2: Counter-offer fields
  counterPrice?: number;
  counterMessage?: string;
  counterRound?: number;       // 1, 2 or 3 max
  createdAt: any;
}

export interface LogisticsProvider {
  id: string;
  userId: string;
  name: string;
  vehicleType: string;
  capacity: number;
  location: string;
  available: boolean;
  phone: string;
  ratePerKm?: number;
  fromLocation?: string;
  toLocation?: string;
  transporterName?: string;
}

export interface Booking {
  id: string;
  cropId: string;
  bidId: string;
  farmerId: string;
  buyerId: string;
  logisticsId: string;
  logisticsName: string;
  pickupLocation: string;
  dropLocation: string;
  status: BookingStatus;
  vehicleType?: string;
  capacity?: number;
  ratePerKm?: number;
  fromLocation?: string;
  toLocation?: string;
  transporterName?: string;
  buyerName?: string;
  createdAt: any;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'new_bid' | 'bid_accepted' | 'bid_rejected' | 'truck_assigned' | 'delivery_update' | 'counter_offer' | 'new_message';
  message: string;
  read: boolean;
  relatedId: string;
  createdAt: any;
}

// F4: In-App Messaging
export interface Message {
  id: string;
  bidId: string;
  cropId: string;
  senderId: string;
  senderName: string;
  senderRole: Role;
  receiverId: string;
  text: string;
  read: boolean;
  createdAt: any;
}

// F3: Mandi Price
export interface MandiPrice {
  commodity: string;
  market: string;
  state: string;
  minPrice: number;
  maxPrice: number;
  modalPrice: number;
  date: string;
}

// F5: Farmer Rating
export interface Rating {
  id: string;
  farmerId: string;
  buyerId: string;
  buyerName: string;
  cropId: string;
  stars: number;        // 1-5
  comment?: string;
  createdAt: any;
}
