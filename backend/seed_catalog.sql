DELETE FROM activities;
DELETE FROM hotels;
DELETE FROM destinations;
INSERT INTO destinations (name, city, lat, lng, tags, description, rating, created_at) VALUES
('Hà Nội','Hà Nội',21.0285,105.8542,'phố cổ,ẩm thực,văn hóa','Thủ đô với phố cổ, hồ Gươm và ẩm thực đường phố',4.7,datetime('now')),
('Đà Nẵng','Đà Nẵng',16.0471,108.2068,'biển,nghỉ dưỡng,ẩm thực','Thành phố biển với cầu Rồng, Mỹ Khê, Bà Nà',4.6,datetime('now'));
INSERT INTO hotels (destination_id,name,price_range,address,lat,lng,rating,created_at) VALUES
((SELECT id FROM destinations WHERE name='Hà Nội'),'Hanoi Old Quarter Boutique','600k-1.2tr/đêm','Phố Hàng Bè, Hoàn Kiếm, Hà Nội',21.0339,105.8531,4.4,datetime('now')),
((SELECT id FROM destinations WHERE name='Hà Nội'),'West Lake View Hotel','800k-1.8tr/đêm','Đường Nhật Chiêu, Tây Hồ, Hà Nội',21.0727,105.8097,4.3,datetime('now')),
((SELECT id FROM destinations WHERE name='Đà Nẵng'),'My Khe Beach Hotel','700k-1.5tr/đêm','Võ Nguyên Giáp, Sơn Trà, Đà Nẵng',16.0607,108.2462,4.5,datetime('now')),
((SELECT id FROM destinations WHERE name='Đà Nẵng'),'Han River View Hotel','600k-1.2tr/đêm','Bạch Đằng, Hải Châu, Đà Nẵng',16.0673,108.2193,4.2,datetime('now'));
INSERT INTO activities (destination_id,name,category,price_range,address,lat,lng,rating,created_at) VALUES
((SELECT id FROM destinations WHERE name='Hà Nội'),'Hồ Gươm & đền Ngọc Sơn','attraction','30k-50k','P. Hàng Trống, Hoàn Kiếm, Hà Nội',21.0289,105.8520,4.6,datetime('now')),
((SELECT id FROM destinations WHERE name='Hà Nội'),'Phố cổ Tạ Hiện','attraction','Miễn phí','Tạ Hiện, Hoàn Kiếm, Hà Nội',21.0355,105.8524,4.4,datetime('now')),
((SELECT id FROM destinations WHERE name='Hà Nội'),'Bún chả Hàng Quạt','restaurant','50k-80k','Hàng Quạt, Hoàn Kiếm, Hà Nội',21.0317,105.8527,4.5,datetime('now')),
((SELECT id FROM destinations WHERE name='Hà Nội'),'Cà phê đường tàu','cafe','40k-70k','Ngõ 224 Lê Duẩn, Hà Nội',21.0172,105.8424,4.2,datetime('now')),
((SELECT id FROM destinations WHERE name='Đà Nẵng'),'Bãi biển Mỹ Khê','attraction','Miễn phí','Võ Nguyên Giáp, Sơn Trà, Đà Nẵng',16.0604,108.2459,4.7,datetime('now')),
((SELECT id FROM destinations WHERE name='Đà Nẵng'),'Cầu Rồng','attraction','Miễn phí','Cầu Rồng, Hải Châu, Đà Nẵng',16.0614,108.2286,4.6,datetime('now')),
((SELECT id FROM destinations WHERE name='Đà Nẵng'),'Bún chả cá Bà Lữ','restaurant','40k-70k','Hoàng Diệu, Hải Châu, Đà Nẵng',16.0679,108.2169,4.4,datetime('now')),
((SELECT id FROM destinations WHERE name='Đà Nẵng'),'The Coffee House Bạch Đằng','cafe','35k-60k','Bạch Đằng, Hải Châu, Đà Nẵng',16.0670,108.2191,4.3,datetime('now'));
