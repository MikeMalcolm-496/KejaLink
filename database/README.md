# KejaLink database (Supabase / PostgreSQL)

## Tables

| # | Table | Purpose | Relationships |
|---|---|---|---|
| 1 | `users` | Every account: client, agent, admin, super admin | Parent of almost everything |
| 2 | `agent_profiles` | Licence number, agency, bio, verification status | 1:1 with `users` (shares its ID); verified_by → `users` |
| 3 | `properties` | Listings | N:1 `agent_profiles` |
| 4 | `property_images` | Photos (one cover per property) | N:1 `properties`, deleted with it |
| 5 | `favourites` | Saved listings: junction table | M:N `users` ↔ `properties`, composite PK |
| 6 | `inquiries` | Client questions and agent replies | N:1 `users`, N:1 `properties` |
| 7 | `viewings` | **Main transaction:** bookings | N:1 `users`, N:1 `properties`; partial unique indexes stop double-booking |
| 8 | `admin_actions` | Formal record of moderation decisions | N:1 `users` (admin + target), N:1 `properties` |
| 9 | `audit_logs` | Audit trail: who, what, when, IP | N:1 `users` (null for anonymous) |
| 10 | `password_resets` | Single-use reset tokens (only the hash) | N:1 `users` |
| 11 | `payments` | M-Pesa payments for featured listings | N:1 `agent_profiles`, N:1 `properties` |
| 12 | `notifications` | In-app alerts | N:1 `users` |
| 13 | `listing_reports` | Clients flag suspicious listings | N:1 `properties`, N:1 `users` |

```
users ─1:1─ agent_profiles ─1:N─ properties ─1:N─ property_images
  │                │                  │
  │                └─1:N─ payments ─N:1┤
  ├─1:N─ favourites ─N:1──────────────┤
  ├─1:N─ inquiries ─N:1───────────────┤
  ├─1:N─ viewings ─N:1────────────────┤
  ├─1:N─ listing_reports ─N:1─────────┘
  ├─1:N─ admin_actions, audit_logs, password_resets, notifications
```

## Run order (Supabase > SQL Editor > New query > paste > Run)

1. `01_schema.sql`: creates the 13 tables, constraints, indexes and the updated_at trigger.
2. `02_security_and_storage.sql`: turns on Row Level Security and creates the `property-images` storage bucket.
3. `03_demo_data.sql` (optional): demo accounts and listings. Every demo password is `Password@123`.

All three are safe to run again; 01 and 03 wipe KejaLink's data when re-run.
