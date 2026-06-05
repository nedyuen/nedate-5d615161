
CREATE TABLE public.venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  location TEXT,
  url TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.venues TO anon, authenticated;
GRANT ALL ON public.venues TO service_role;
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open venues" ON public.venues FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE DEFAULT substr(md5(random()::text || clock_timestamp()::text), 1, 10),
  category TEXT NOT NULL,
  requester_name TEXT NOT NULL,
  requester_email TEXT NOT NULL,
  pitch TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  venue_id UUID REFERENCES public.venues(id) ON DELETE SET NULL,
  custom_venue TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.requests TO anon, authenticated;
GRANT ALL ON public.requests TO service_role;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open requests" ON public.requests FOR ALL USING (true) WITH CHECK (true);

-- Seed a few venues across categories
INSERT INTO public.venues (category, name, description, location, image_url) VALUES
('breakfast', 'Sunny Side Café', 'Best pancakes in town with a cozy patio', 'Downtown', 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800'),
('breakfast', 'Morning Glory Bakery', 'Fresh croissants and pour-over coffee', 'Old Town', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800'),
('lunch', 'The Green Bowl', 'Healthy grain bowls and salads', 'Midtown', 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800'),
('lunch', 'Noodle House', 'Hand-pulled noodles and dumplings', 'Chinatown', 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800'),
('dinner', 'Hearth & Vine', 'Wood-fired Italian with great wine list', 'Riverside', 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800'),
('dinner', 'Sumi Omakase', 'Intimate 8-seat sushi counter', 'East Village', 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800'),
('drink', 'The Velvet Owl', 'Speakeasy cocktail bar', 'Hidden alley downtown', 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=800'),
('drink', 'Hop Garden', 'Outdoor beer garden with 40 taps', 'Brewery district', 'https://images.unsplash.com/photo-1436076863939-06870fe779c2?w=800'),
('walk', 'Riverside Trail', 'Scenic 5km loop along the water', 'Riverside Park', 'https://images.unsplash.com/photo-1441260038675-7329ab4cc264?w=800'),
('walk', 'Botanical Gardens', 'Quiet paths through themed gardens', 'North side', 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=800'),
('chat', 'Bluebird Coffee', 'Quiet corners and great espresso', 'Arts district', 'https://images.unsplash.com/photo-1453614512568-c4024d13c247?w=800'),
('chat', 'Library Lounge', 'Cozy armchairs and free refills', 'University area', 'https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=800'),
('day trip', 'Coastal Cliffs', 'Dramatic ocean views, 1.5h drive', 'Coast', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800'),
('day trip', 'Wine Country', 'Tasting rooms among the vineyards', 'Valley', 'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=800'),
('other activity', 'Pottery Studio', 'Drop-in wheel throwing classes', 'Arts district', 'https://images.unsplash.com/photo-1565122256292-b5b3a92e8a3a?w=800'),
('other activity', 'Indoor Climbing Gym', 'Bouldering and top-rope routes', 'Industrial area', 'https://images.unsplash.com/photo-1522163182402-834f871fd851?w=800'),
('ned''s bucket list item', 'Hot Air Balloon Ride', 'Sunrise flight over the valley', 'Valley airfield', 'https://images.unsplash.com/photo-1507608616759-54f48f0af0ee?w=800'),
('ned''s bucket list item', 'Theme Park Marathon', 'Ride every coaster in one day', 'Adventure Park', 'https://images.unsplash.com/photo-1513889961551-628c1e5e2ee9?w=800');
