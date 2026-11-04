-- =====================================================================
--  KejaLink: SCRIPT 3 of 3 (OPTIONAL): demo data for testing and the presentation
--  Run AFTER 01 and 02. All demo accounts use the password: Password@123
--  Re-running it wipes all KejaLink data and loads the demo data again.
--  Dates are relative to the moment of import, so the demo always looks current.
-- =====================================================================
begin;

truncate table listing_reports, notifications, payments, password_resets, audit_logs, admin_actions,
    viewings, inquiries, favourites, property_images, properties, agent_profiles, users restart identity cascade;

INSERT INTO users (user_id, full_name, email, phone, password_hash, role, account_status, created_at, last_login_at) VALUES
(1, 'Joan Mutua', 'superadmin@kejalink.co.ke', '0700100001', '$2a$10$3SVM0aPnxt9TMedOMmuHfuj/SjW8NQQujaYT3deIVz4MMnpfx.dxG', 'super_admin', 'active', now() - interval '200 days', now() - interval '20 days 1 hours'),
(2, 'Daniel Kiptoo', 'admin@kejalink.co.ke', '0700100002', '$2a$10$3SVM0aPnxt9TMedOMmuHfuj/SjW8NQQujaYT3deIVz4MMnpfx.dxG', 'admin', 'active', now() - interval '190 days', now() - interval '19 days 2 hours'),
(3, 'Wanjiru Kamau', 'wanjiru@primehomes.co.ke', '0722410417', '$2a$10$3SVM0aPnxt9TMedOMmuHfuj/SjW8NQQujaYT3deIVz4MMnpfx.dxG', 'agent', 'active', now() - interval '170 days', now() - interval '17 days 3 hours'),
(4, 'Brian Otieno', 'brian@skylinerealty.co.ke', '0733190233', '$2a$10$3SVM0aPnxt9TMedOMmuHfuj/SjW8NQQujaYT3deIVz4MMnpfx.dxG', 'agent', 'active', now() - interval '160 days', now() - interval '16 days 4 hours'),
(5, 'Fatuma Hassan', 'fatuma@coastlineproperties.co.ke', '0711220981', '$2a$10$3SVM0aPnxt9TMedOMmuHfuj/SjW8NQQujaYT3deIVz4MMnpfx.dxG', 'agent', 'active', now() - interval '120 days', now() - interval '12 days 5 hours'),
(6, 'Kevin Mwangi', 'kevin@nyumbanirealty.co.ke', '0745251102', '$2a$10$3SVM0aPnxt9TMedOMmuHfuj/SjW8NQQujaYT3deIVz4MMnpfx.dxG', 'agent', 'active', now() - interval '3 days', now() - interval '0 days 6 hours'),
(7, 'Grace Njeri', 'grace.njeri@gmail.com', '0756251187', '$2a$10$3SVM0aPnxt9TMedOMmuHfuj/SjW8NQQujaYT3deIVz4MMnpfx.dxG', 'agent', 'active', now() - interval '1 days', NULL),
(8, 'Peter Kiprop', 'peter.kiprop@yahoo.com', '0768250077', '$2a$10$3SVM0aPnxt9TMedOMmuHfuj/SjW8NQQujaYT3deIVz4MMnpfx.dxG', 'agent', 'active', now() - interval '20 days', now() - interval '2 days 8 hours'),
(9, 'Amina Yusuf', 'amina@example.com', '0712345678', '$2a$10$3SVM0aPnxt9TMedOMmuHfuj/SjW8NQQujaYT3deIVz4MMnpfx.dxG', 'client', 'active', now() - interval '150 days', now() - interval '15 days 9 hours'),
(10, 'David Ochieng', 'david.ochieng@example.com', '0723456789', '$2a$10$3SVM0aPnxt9TMedOMmuHfuj/SjW8NQQujaYT3deIVz4MMnpfx.dxG', 'client', 'active', now() - interval '110 days', now() - interval '11 days 10 hours'),
(11, 'Mercy Wambui', 'mercy.wambui@example.com', '0734567890', '$2a$10$3SVM0aPnxt9TMedOMmuHfuj/SjW8NQQujaYT3deIVz4MMnpfx.dxG', 'client', 'active', now() - interval '80 days', now() - interval '8 days 11 hours'),
(12, 'John Kariuki', 'john.kariuki@example.com', '0745678901', '$2a$10$3SVM0aPnxt9TMedOMmuHfuj/SjW8NQQujaYT3deIVz4MMnpfx.dxG', 'client', 'suspended', now() - interval '60 days', now() - interval '6 days 12 hours'),
(13, 'Sarah Achieng', 'sarah.achieng@example.com', '0756789012', '$2a$10$3SVM0aPnxt9TMedOMmuHfuj/SjW8NQQujaYT3deIVz4MMnpfx.dxG', 'client', 'active', now() - interval '25 days', now() - interval '2 days 13 hours'),
(14, 'Ali Abdi', 'ali.abdi@example.com', '0767890123', '$2a$10$3SVM0aPnxt9TMedOMmuHfuj/SjW8NQQujaYT3deIVz4MMnpfx.dxG', 'client', 'active', now() - interval '9 days', now() - interval '0 days 14 hours');

INSERT INTO agent_profiles (agent_id, licence_no, agency_name, bio, verification_status, rejection_reason, verified_by, verified_at) VALUES
(3, 'EARB/2021/0417', 'Prime Homes Ltd', 'Ten years letting and selling homes in Kilimani, Kileleshwa and Lavington. Speaks English, Kiswahili and Kikuyu.', 'approved', NULL, 1, now() - interval '165 days'),
(4, 'EARB/2019/0233', 'Skyline Realty', 'Specialist in Westlands apartments, Upper Hill offices and plots on the Nairobi outskirts.', 'approved', NULL, 1, now() - interval '155 days'),
(5, 'EARB/2022/0981', 'Coastline Properties', 'Holiday homes and long-term rentals in Nyali, Bamburi and Diani.', 'approved', NULL, 2, now() - interval '115 days'),
(6, 'EARB/2025/1102', 'Nyumbani Realty', NULL, 'pending', NULL, NULL, NULL),
(7, 'EARB/2025/1187', NULL, NULL, 'pending', NULL, NULL, NULL),
(8, 'EARB/2020/9999', 'Quick Homes', NULL, 'rejected', 'Licence number not found in the EARB register.', 2, now() - interval '18 days');

INSERT INTO properties (property_id, agent_id, title, description, listing_type, property_type, price, bedrooms, bathrooms, location, address, listing_status, featured_until, views_count, created_at, updated_at) VALUES
(1, 3, '2-bedroom apartment with balcony', 'Bright, airy two-bedroom apartment on the 5th floor with a balcony overlooking a quiet garden. Both bedrooms are en-suite; open-plan kitchen with granite tops.

- Borehole water and backup generator
- Lift, 24-hour security and CCTV
- One covered parking bay
- 5 minutes to Yaya Centre

Deposit: one month. Service charge included.', 'rent', 'apartment', 85000, 2, 2, 'Kilimani, Nairobi', 'Argwings Kodhek Road', 'available', now() + interval '6 days', 412, now() - interval '40 days', now() - interval '37 days'),
(2, 3, '3-bedroom townhouse', 'Modern three-bedroom townhouse in a gated community of 12 units. Master en-suite, family bathroom, DSQ and a private garden.

Title deed ready. Close to Lavington Mall and good schools.', 'sale', 'house', 28500000, 3, 3, 'Lavington, Nairobi', 'James Gichuru Road', 'under_offer', NULL, 268, now() - interval '95 days', now() - interval '92 days'),
(3, 4, 'Studio apartment near Sarit', 'Compact, well-finished studio ideal for a young professional. Fitted kitchenette, wardrobes and fast fibre internet ready.

Walking distance to Sarit Centre and the Westlands business district.', 'rent', 'apartment', 45000, 0, 1, 'Westlands, Nairobi', 'Mpesi Lane', 'available', NULL, 305, now() - interval '30 days', now() - interval '27 days'),
(4, 4, '4-bedroom maisonette', 'Spacious four-bedroom maisonette on a half-acre with mature garden, all bedrooms en-suite, study, two living areas and a two-room DSQ.

Quiet, leafy neighbourhood with controlled access.', 'sale', 'house', 65000000, 4, 4, 'Runda, Nairobi', 'Runda Grove', 'available', NULL, 190, now() - interval '120 days', now() - interval '117 days'),
(5, 3, '1-bedroom apartment', 'Affordable one-bedroom apartment in a secure compound. Tiled floors, good natural light, reliable water supply.

Close to Capital Centre and public transport on Mombasa Road.', 'rent', 'apartment', 32000, 1, 1, 'South B, Nairobi', 'Mchumbi Road', 'available', NULL, 221, now() - interval '15 days', now() - interval '12 days'),
(6, 4, '1/8 acre plot, ready title', '1/8 acre (50x100) residential plot in a fast-growing area of Kitengela. Ready title, flat land, electricity and water nearby.

10 minutes from the Namanga Road.', 'sale', 'land', 3200000, 0, 0, 'Kitengela, Kajiado', NULL, 'available', NULL, 143, now() - interval '70 days', now() - interval '67 days'),
(7, 3, '3-bedroom apartment with pool', 'Three-bedroom apartment with a large lounge, separate dining, two balconies and a DSQ. Gym and swimming pool in the compound.

Pets allowed. Two parking bays.', 'rent', 'apartment', 120000, 3, 3, 'Kileleshwa, Nairobi', 'Mandera Road', 'available', NULL, 198, now() - interval '22 days', now() - interval '19 days'),
(8, 4, 'Bedsitter off Thika Road', 'Self-contained bedsitter with a separate kitchen area. Secure building with a caretaker. Near Thika Road and TRM.', 'rent', 'apartment', 12000, 0, 1, 'Roysambu, Nairobi', 'Lumumba Drive', 'available', NULL, 350, now() - interval '8 days', now() - interval '5 days'),
(9, 4, 'Open-plan office space', 'Grade A open-plan office space of 2,500 sq ft on the 8th floor with panoramic views. Fibre, backup power, ample parking and a reception area.

Ideal for a growing company.', 'rent', 'commercial', 250000, 0, 2, 'Upper Hill, Nairobi', 'Upper Hill Road', 'available', NULL, 87, now() - interval '55 days', now() - interval '52 days'),
(10, 3, '2-bedroom bungalow', 'Two-bedroom bungalow on a 40x80 plot in a quiet estate. Master en-suite, spacious living room and room to extend.

Near Ruiru town and the Thika Superhighway.', 'sale', 'house', 7800000, 2, 2, 'Ruiru, Kiambu', 'Membley Estate', 'available', NULL, 164, now() - interval '48 days', now() - interval '45 days'),
(11, 3, '5-bedroom villa on one acre', 'Luxurious five-bedroom villa on one acre in Karen. Heated pool, home cinema, wine cellar, landscaped gardens and a three-car garage.

Viewing by appointment only.', 'sale', 'house', 120000000, 5, 6, 'Karen, Nairobi', 'Bogani Road', 'available', now() + interval '20 days', 256, now() - interval '64 days', now() - interval '61 days'),
(12, 4, 'Ground-floor shop space', 'Ground-floor shop space of 600 sq ft on a busy road with high foot traffic. Suitable for retail, pharmacy or a café.', 'rent', 'commercial', 60000, 0, 1, 'Kasarani, Nairobi', 'Thika Road service lane', 'available', NULL, 61, now() - interval '12 days', now() - interval '9 days'),
(13, 4, '2-bedroom apartment near SGR', 'Two-bedroom apartment in a new development near the SGR terminus. Master en-suite, open kitchen, ample parking.

Mortgage options available through partner banks.', 'sale', 'apartment', 6500000, 2, 2, 'Syokimau, Machakos', 'Katani Road', 'available', NULL, 133, now() - interval '36 days', now() - interval '33 days'),
(14, 3, '1/4 acre plot with hill views', '1/4 acre plot in Ngong with views of the Ngong Hills. Ready title, accessible by murram road.', 'sale', 'land', 4500000, 0, 0, 'Ngong, Kajiado', NULL, 'sold', NULL, 98, now() - interval '140 days', now() - interval '137 days'),
(15, 5, '3-bedroom beach apartment', 'Three-bedroom beachside apartment, fully furnished, sea views from every room. Pool, gym and direct beach access.

Long-term rental.', 'rent', 'apartment', 90000, 3, 3, 'Nyali, Mombasa', 'Links Road', 'available', NULL, 176, now() - interval '28 days', now() - interval '25 days');

INSERT INTO property_images (property_id, image_url, is_cover) VALUES
(1, '/seed/seed-01-1.jpg', true),
(1, '/seed/seed-01-2.jpg', false),
(1, '/seed/seed-01-3.jpg', false),
(2, '/seed/seed-02-1.jpg', true),
(2, '/seed/seed-02-2.jpg', false),
(2, '/seed/seed-02-3.jpg', false),
(3, '/seed/seed-03-1.jpg', true),
(3, '/seed/seed-03-2.jpg', false),
(3, '/seed/seed-03-3.jpg', false),
(4, '/seed/seed-04-1.jpg', true),
(4, '/seed/seed-04-2.jpg', false),
(4, '/seed/seed-04-3.jpg', false),
(5, '/seed/seed-05-1.jpg', true),
(5, '/seed/seed-05-2.jpg', false),
(5, '/seed/seed-05-3.jpg', false),
(6, '/seed/seed-06-1.jpg', true),
(6, '/seed/seed-06-3.jpg', false),
(7, '/seed/seed-07-1.jpg', true),
(7, '/seed/seed-07-2.jpg', false),
(7, '/seed/seed-07-3.jpg', false),
(8, '/seed/seed-08-1.jpg', true),
(8, '/seed/seed-08-2.jpg', false),
(8, '/seed/seed-08-3.jpg', false),
(9, '/seed/seed-09-1.jpg', true),
(9, '/seed/seed-09-2.jpg', false),
(9, '/seed/seed-09-3.jpg', false),
(10, '/seed/seed-10-1.jpg', true),
(10, '/seed/seed-10-2.jpg', false),
(10, '/seed/seed-10-3.jpg', false),
(11, '/seed/seed-11-1.jpg', true),
(11, '/seed/seed-11-2.jpg', false),
(11, '/seed/seed-11-3.jpg', false),
(12, '/seed/seed-12-1.jpg', true),
(12, '/seed/seed-12-2.jpg', false),
(12, '/seed/seed-12-3.jpg', false),
(13, '/seed/seed-13-1.jpg', true),
(13, '/seed/seed-13-2.jpg', false),
(13, '/seed/seed-13-3.jpg', false),
(14, '/seed/seed-14-1.jpg', true),
(14, '/seed/seed-14-3.jpg', false),
(15, '/seed/seed-15-1.jpg', true),
(15, '/seed/seed-15-2.jpg', false),
(15, '/seed/seed-15-3.jpg', false);

INSERT INTO favourites (client_id, property_id, saved_at) VALUES
(9, 1, now() - interval '10 days'),
(9, 3, now() - interval '7 days'),
(9, 11, now() - interval '2 days'),
(10, 4, now() - interval '20 days'),
(10, 13, now() - interval '5 days'),
(11, 7, now() - interval '3 days'),
(13, 1, now() - interval '1 days'),
(13, 8, now() - interval '1 days');

INSERT INTO inquiries (client_id, property_id, message, agent_reply, inquiry_status, created_at, replied_at) VALUES
(9, 1, 'Is the deposit negotiable? I could pay two months upfront.', NULL, 'open', now() - interval '2 days 3 hours', NULL),
(10, 4, 'Does the maisonette come with a borehole, and is the price negotiable?', 'Yes, it has a borehole and a 10,000-litre tank. The owner will consider serious offers above KES 60M.', 'replied', now() - interval '9 days 3 hours', now() - interval '7 days'),
(11, 7, 'Are pets allowed? I have a small dog.', 'Yes, pets are allowed in this compound.', 'closed', now() - interval '6 days 3 hours', now() - interval '5 days'),
(13, 8, 'Is water available throughout the week?', NULL, 'open', now() - interval '1 days 3 hours', NULL),
(9, 3, 'Is the studio furnished?', 'It is unfurnished, but the landlord can add a bed and sofa for KES 5,000 extra per month.', 'replied', now() - interval '12 days 3 hours', now() - interval '11 days'),
(14, 15, 'Is the apartment available from next month?', NULL, 'open', now() - interval '0 days 3 hours', NULL);

INSERT INTO viewings (client_id, property_id, scheduled_at, viewing_status, agent_note, created_at) VALUES
(9, 1, ((current_date + (2)) + time '10:00') at time zone 'Africa/Nairobi', 'requested', NULL, now() - interval '1 days'),
(13, 1, ((current_date + (3)) + time '14:00') at time zone 'Africa/Nairobi', 'requested', NULL, now() - interval '0 days'),
(10, 13, ((current_date + (4)) + time '11:00') at time zone 'Africa/Nairobi', 'requested', NULL, now() - interval '1 days'),
(11, 7, ((current_date + (1)) + time '15:00') at time zone 'Africa/Nairobi', 'confirmed', NULL, now() - interval '4 days'),
(9, 11, ((current_date + (5)) + time '10:00') at time zone 'Africa/Nairobi', 'confirmed', NULL, now() - interval '2 days'),
(10, 4, ((current_date + (6)) + time '12:00') at time zone 'Africa/Nairobi', 'rescheduled', 'The current tenant moves out on Friday; moved to the following week.', now() - interval '8 days'),
(14, 15, ((current_date + (3)) + time '09:00') at time zone 'Africa/Nairobi', 'requested', NULL, now() - interval '0 days'),
(9, 3, ((current_date + (-5)) + time '13:00') at time zone 'Africa/Nairobi', 'completed', NULL, now() - interval '12 days'),
(10, 2, ((current_date + (-12)) + time '10:00') at time zone 'Africa/Nairobi', 'completed', NULL, now() - interval '20 days'),
(11, 5, ((current_date + (-3)) + time '11:00') at time zone 'Africa/Nairobi', 'declined', 'The landlord has accepted another applicant.', now() - interval '7 days'),
(13, 8, ((current_date + (-1)) + time '16:00') at time zone 'Africa/Nairobi', 'cancelled', NULL, now() - interval '4 days'),
(9, 14, ((current_date + (-40)) + time '10:00') at time zone 'Africa/Nairobi', 'completed', NULL, now() - interval '48 days'),
(10, 10, ((current_date + (-55)) + time '15:00') at time zone 'Africa/Nairobi', 'completed', NULL, now() - interval '60 days'),
(11, 6, ((current_date + (-75)) + time '11:00') at time zone 'Africa/Nairobi', 'completed', NULL, now() - interval '80 days'),
(9, 9, ((current_date + (-100)) + time '14:00') at time zone 'Africa/Nairobi', 'declined', 'Office already let.', now() - interval '105 days'),
(10, 11, ((current_date + (-130)) + time '10:00') at time zone 'Africa/Nairobi', 'completed', NULL, now() - interval '135 days'),
(13, 7, ((current_date + (-20)) + time '12:00') at time zone 'Africa/Nairobi', 'completed', NULL, now() - interval '23 days'),
(14, 12, ((current_date + (-6)) + time '10:00') at time zone 'Africa/Nairobi', 'completed', NULL, now() - interval '9 days');

INSERT INTO admin_actions (admin_id, action_type, target_user_id, target_property_id, reason, created_at) VALUES
(1, 'approve_agent', 3, NULL, 'Licence verified with EARB', now() - interval '165 days'),
(1, 'approve_agent', 4, NULL, 'Licence verified with EARB', now() - interval '155 days'),
(2, 'approve_agent', 5, NULL, 'Licence verified with EARB', now() - interval '115 days'),
(2, 'reject_agent', 8, NULL, 'Licence number not found in the EARB register.', now() - interval '18 days'),
(2, 'suspend_user', 12, NULL, 'Repeated abusive messages to agents', now() - interval '30 days');

INSERT INTO payments (agent_id, property_id, phone, amount, feature_days, merchant_request_id, checkout_request_id, mpesa_receipt, payment_status, result_desc, created_at) VALUES
(3, 1, '254722410417', 500, 7, 'SIM-a1', 'ws_CO_SIMseed0001', 'SJK4H7Q2LM', 'success', 'The service request is processed successfully.', now() - interval '1 days'),
(3, 11, '254722410417', 1500, 30, 'SIM-a2', 'ws_CO_SIMseed0002', 'SJA9B3X1PQ', 'success', 'The service request is processed successfully.', now() - interval '10 days'),
(4, 3, '254733190233', 500, 7, 'SIM-a3', 'ws_CO_SIMseed0003', NULL, 'cancelled', 'Request cancelled by user', now() - interval '4 days'),
(4, 9, '254733190233', 1500, 30, 'SIM-a4', 'ws_CO_SIMseed0004', 'SH72KD9W0E', 'success', 'The service request is processed successfully.', now() - interval '70 days');

INSERT INTO listing_reports (property_id, reporter_id, reason, report_status, created_at) VALUES
(12, 13, 'The agent asked me to pay a KES 2,000 viewing fee by M-Pesa before showing the shop.', 'open', now() - interval '1 days');

INSERT INTO notifications (user_id, message, link, is_read, created_at) VALUES
(3, 'New viewing request: 2-bedroom apartment with balcony', '/agent/viewings', false, now() - interval '0 hours'),
(3, 'Amina Yusuf asked about 2-bedroom apartment with balcony', '/agent/inquiries', false, now() - interval '3 hours'),
(4, 'New viewing request: 2-bedroom apartment near SGR', '/agent/viewings', false, now() - interval '6 hours'),
(9, 'Your viewing of 5-bedroom villa on one acre is confirmed.', '/client/viewings', false, now() - interval '9 hours'),
(9, 'The agent replied to your question about Studio apartment near Sarit', '/client/inquiries', true, now() - interval '12 hours'),
(1, 'New agent awaiting verification: Kevin Mwangi', '/admin/agents', false, now() - interval '15 hours'),
(2, 'New agent awaiting verification: Grace Njeri', '/admin/agents', false, now() - interval '18 hours'),
(1, 'Listing reported: Ground-floor shop space', '/admin/listings?reported=1', false, now() - interval '21 hours'),
(2, 'Listing reported: Ground-floor shop space', '/admin/listings?reported=1', false, now() - interval '24 hours');

INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, user_agent, created_at) VALUES
(NULL, 'login_failed', 'user', NULL, 'Unknown email: test@test.com', '41.90.64.12', 'Mozilla/5.0 (seed data)', now() - interval '3 days'),
(9, 'login_success', 'user', 9, NULL, '41.80.12.200', 'Mozilla/5.0 (seed data)', now() - interval '2 days'),
(9, 'viewing_booked', 'viewing', 1, '2-bedroom apartment with balcony', '41.80.12.200', 'Mozilla/5.0 (seed data)', now() - interval '2 days'),
(3, 'login_success', 'user', 3, NULL, '105.163.2.44', 'Mozilla/5.0 (seed data)', now() - interval '2 days'),
(3, 'listing_updated', 'property', 1, '2-bedroom apartment with balcony', '105.163.2.44', 'Mozilla/5.0 (seed data)', now() - interval '2 days'),
(3, 'payment_success', 'payment', 1, 'KES 500 to feature listing for 7 days. Receipt SJK4H7Q2LM', '105.163.2.44', 'Mozilla/5.0 (seed data)', now() - interval '1 days'),
(2, 'login_success', 'user', 2, NULL, '197.232.1.9', 'Mozilla/5.0 (seed data)', now() - interval '1 days'),
(2, 'suspend_user', 'user', 12, 'Repeated abusive messages to agents', '197.232.1.9', 'Mozilla/5.0 (seed data)', now() - interval '30 days'),
(13, 'listing_reported', 'property', 12, 'The agent asked me to pay a viewing fee', '41.89.10.77', 'Mozilla/5.0 (seed data)', now() - interval '1 days'),
(6, 'register', 'user', 6, 'Registered as agent', '102.68.4.20', 'Mozilla/5.0 (seed data)', now() - interval '3 days'),
(7, 'register', 'user', 7, 'Registered as agent', '102.68.4.33', 'Mozilla/5.0 (seed data)', now() - interval '1 days');

-- Identity counters continue after the explicit IDs used above
select setval(pg_get_serial_sequence('users', 'user_id'), (select max(user_id) from users));
select setval(pg_get_serial_sequence('properties', 'property_id'), (select max(property_id) from properties));

commit;

-- Quick check: row counts
select 'users' t, count(*) from users union all select 'properties', count(*) from properties union all select 'viewings', count(*) from viewings union all select 'property_images', count(*) from property_images;
