-- Users table (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  company_name TEXT NOT NULL,
  user_type TEXT CHECK (user_type IN ('buyer', 'seller')) NOT NULL,
  contact_email TEXT NOT NULL,
  phone TEXT,
  address JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RFQs (Request for Quotations)
CREATE TABLE rfqs (
  rfq_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID REFERENCES profiles(id) NOT NULL,
  milk_type TEXT NOT NULL,
  quantity_liters DECIMAL NOT NULL,
  needed_by_date DATE NOT NULL,
  budget_max DECIMAL,
  status TEXT CHECK (status IN ('open', 'quoted', 'ordered', 'fulfilled', 'cancelled')) DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quotations from sellers
CREATE TABLE quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id UUID REFERENCES rfqs(rfq_id) NOT NULL,
  seller_id UUID REFERENCES profiles(id) NOT NULL,
  price_per_liter DECIMAL NOT NULL,
  total_price DECIMAL NOT NULL,
  delivery_date DATE NOT NULL,
  notes TEXT,
  status TEXT CHECK (status IN ('pending', 'accepted', 'rejected')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id UUID REFERENCES rfqs(rfq_id) NOT NULL,
  quotation_id UUID REFERENCES quotations(id) NOT NULL,
  buyer_id UUID REFERENCES profiles(id) NOT NULL,
  seller_id UUID REFERENCES profiles(id) NOT NULL,
  status TEXT CHECK (status IN ('confirmed', 'in_transit', 'delivered', 'cancelled')) DEFAULT 'confirmed',
  tracking_info JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email threads
CREATE TABLE email_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id UUID REFERENCES rfqs(rfq_id),
  order_id UUID REFERENCES orders(id),
  subject TEXT NOT NULL,
  participants UUID[] NOT NULL,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES email_threads(id) NOT NULL,
  sender_id UUID REFERENCES profiles(id) NOT NULL,
  content TEXT NOT NULL,
  ai_generated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);