// Shared type definitions across the application

export interface RFQ {
  id: string;
  rfq_id?: string; // For database queries
  milkType: string;
  quantityLiters: number;
  neededByDate: string;
  budgetMax?: number;
  status: 'open' | 'quoted' | 'ordered' | 'fulfilled' | 'cancelled';
  quotesCount: number;
  createdAt: string;
  buyerName?: string;
}

export interface Quote {
  id: string;
  rfqId: string;
  milkType: string;
  pricePerLiter: number;
  totalPrice: number;
  deliveryDate: string;
  notes?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  sellerName?: string;
  buyerName?: string;
}

export type RFQStatus = 'open' | 'quoted' | 'ordered' | 'fulfilled' | 'cancelled';
export type QuoteStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';
export type UserType = 'buyer' | 'seller';

