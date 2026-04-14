export type Role = 'farmer' | 'buyer' | 'transporter';
export type Lang = 'en' | 'ta' | 'hi';
export type BidStatus = 'pending' | 'accepted' | 'rejected';
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
  createdAt: any;
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
  createdAt: any;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'new_bid' | 'bid_accepted' | 'bid_rejected' | 'truck_assigned' | 'delivery_update';
  message: string;
  read: boolean;
  relatedId: string;
  createdAt: any;
}
