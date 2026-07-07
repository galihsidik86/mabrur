# Entity Relationship Diagram — Mabrur

```
┌─────────────┐       ┌──────────────┐       ┌──────────────────┐
│   users      │       │   groups     │       │  group_members   │
├─────────────┤       ├──────────────┤       ├──────────────────┤
│ id        PK│◄──┐   │ id        PK│◄──┐   │ id            PK│
│ phone    UNQ│   │   │ name        │   │   │ group_id    FK──┤►groups.id
│ password_   │   │   │ kloter_code │   │   │ user_id     FK──┤►users.id
│  hash       │   │   │ year        │   │   │ role_in_group   │
│ name        │   │   │ created_by  │───┘   │ is_active       │
│ role (enum) │   │   │ created_at  │       │ joined_at       │
│ passport_no │   │   │ updated_at  │       └──────────────────┘
│  (encrypted)│   │   └──────────────┘
│ blood_type  │   │
│ medical_    │   │       ┌──────────────────┐
│  notes(enc) │   │       │  refresh_tokens  │
│ emergency_  │   │       ├──────────────────┤
│  contact    │   │       │ id            PK │
│ push_token  │   ├──────►│ user_id     FK   │
│ is_active   │   │       │ token_hash  UNQ  │
│ onboarded   │   │       │ expires_at       │
│ theme       │   │       └──────────────────┘
│ created_at  │   │
│ updated_at  │   │       ┌──────────────────┐
└─────────────┘   │       │   audit_logs     │
                  │       ├──────────────────┤
                  │       │ id (serial)   PK │
                  ├──────►│ user_id     FK   │
                  │       │ action           │
                  │       │ entity           │
                  │       │ entity_id        │
                  │       │ details (jsonb)  │
                  │       │ created_at       │
                  │       └──────────────────┘
                  │
                  │       ┌──────────────────┐
                  │       │ ibadah_guides    │
                  │       ├──────────────────┤
                  │       │ id            PK │
                  │       │ type (enum)      │
                  │       │ step_number      │
                  │       │ title            │
                  │       │ subtitle         │
                  │       │ steps_text       │
                  │       │ arabic_text      │
                  │       │ latin_text       │
                  ├──────►│ updated_by  FK   │
                  │       └──────────────────┘
                  │
                  │       ┌──────────────────┐
                  │       │     duas         │
                  │       ├──────────────────┤
                  │       │ id            PK │
                  │       │ title            │
                  │       │ context          │
                  │       │ arabic_text      │
                  │       │ latin_text       │
                  │       │ translation      │
                  │       │ sort_order       │
                  ├──────►│ updated_by  FK   │
                  │       └──────────────────┘
                  │
                  │       ┌──────────────────┐
                  │       │   schedules      │
                  │       ├──────────────────┤
                  │       │ id            PK │
                  │       │ group_id    FK──►groups.id
                  │       │ title            │
                  │       │ location_name    │
                  │       │ start_time       │
                  │       │ end_time         │
                  │       │ status (enum)    │
                  │       │ sort_order       │
                  ├──────►│ updated_by  FK   │
                  │       └──────────────────┘
                  │
                  │       ┌──────────────────┐
                  │       │  miqat_zones     │
                  │       ├──────────────────┤
                  │       │ id            PK │
                  │       │ name             │
                  │       │ zone_type        │
                  │       │ center_lat       │
                  │       │ center_lng       │
                  │       │ radius_meters    │
                  │       │ warning_radius   │
                  │       └──────────────────┘
                  │
                  │       ┌──────────────────┐
                  │       │  ihram_status    │
                  │       ├──────────────────┤
                  ├──────►│ user_id  PK,FK   │
                  │       │ is_ihram         │
                  │       │ niat_type        │
                  │       │ changed_at       │
                  │       └──────────────────┘
                  │
                  │       ┌──────────────────┐
                  │       │ user_locations   │
                  │       ├──────────────────┤
                  ├──────►│ user_id  PK,FK   │
                  │       │ lat              │
                  │       │ lng              │
                  │       │ accuracy         │
                  │       │ updated_at       │
                  │       └──────────────────┘
                  │
                  │       ┌──────────────────┐
                  │       │  sos_alerts      │
                  │       ├──────────────────┤
                  │       │ id            PK │
                  ├──────►│ user_id     FK   │
                  │       │ group_id    FK──►groups.id
                  │       │ category         │
                  │       │ lat, lng         │
                  │       │ status           │
                  │       │ photo_url        │
                  ├──────►│ resolved_by FK   │
                  │       │ created_at       │
                  │       │ resolved_at      │
                  │       └──────────────────┘
                  │
                  │       ┌──────────────────┐
                  │       │  ziarah_places   │
                  │       ├──────────────────┤
                  │       │ id            PK │
                  │       │ name             │
                  │       │ description      │
                  │       │ category         │
                  │       │ location_name    │
                  │       │ lat, lng         │
                  │       │ tips             │
                  │       │ sort_order       │
                  │       └──────────────────┘
                  │
                  │       ┌──────────────────┐
                  │       │   messages       │
                  │       ├──────────────────┤
                  │       │ id            PK │
                  │       │ group_id    FK──►groups.id
                  ├──────►│ user_id     FK   │
                  │       │ text             │
                  │       │ created_at       │
                  │       └──────────────────┘
                  │
                  │       ┌──────────────────┐
                  │       │   ratings        │
                  │       ├──────────────────┤
                  │       │ id            PK │
                  └──────►│ user_id     FK   │
                          │ rating (1-5)     │
                          │ feedback         │
                          │ created_at       │
                          └──────────────────┘
```

## Relasi Utama

| Dari | Ke | Tipe | Keterangan |
|------|----|------|------------|
| users | group_members | 1:N | User bisa di beberapa group |
| groups | group_members | 1:N | Group punya banyak member |
| groups | schedules | 1:N | Jadwal per rombongan |
| groups | messages | 1:N | Chat per rombongan |
| users | sos_alerts | 1:N | User bisa kirim banyak SOS |
| users | ihram_status | 1:1 | Satu status ihram per user |
| users | user_locations | 1:1 | Posisi terakhir per user |
| users | refresh_tokens | 1:N | Multiple session |
| users | audit_logs | 1:N | Semua aktivitas tercatat |
| users | ratings | 1:N | User bisa beri rating |
