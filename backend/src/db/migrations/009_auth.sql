-- 009_auth.sql -- authentication password hash and demo accounts (Step V10).

ALTER TABLE app_user ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Seed additional pilot/reference districts for negative RBAC boundary testing
INSERT INTO district (id, name, state) VALUES ('gangtok', 'Gangtok', 'Sikkim')
ON CONFLICT (id) DO NOTHING;

-- Seed standard accounts for prototype demo and testing
-- Default demo password for all seeded accounts is: prototype2026!
INSERT INTO app_user (email, full_name, role, assigned_districts, password_hash)
VALUES
    ('admin.aizawl@disaster.mz.gov.in', 'Lalrinsanga Sailo', 'DISTRICT_ADMIN', '{aizawl}',
     '0123456789abcdef0123456789abcdef:ab7aecf7c8df6a6969778987fa897c71a43034bd2713e150faaaa1d3b2acadd3eab68ef01818add898fcbe3f204e04bbd09c54cef1769da5c72fe6b61a030078'),
    ('admin.sikkim@disaster.sk.gov.in', 'Tashi Bhutia', 'DISTRICT_ADMIN', '{gangtok}',
     '0123456789abcdef0123456789abcdef:ab7aecf7c8df6a6969778987fa897c71a43034bd2713e150faaaa1d3b2acadd3eab68ef01818add898fcbe3f204e04bbd09c54cef1769da5c72fe6b61a030078'),
    ('superadmin@ndma.gov.in', 'Dr. V. Sharma', 'SUPER_ADMIN', '{*}',
     '0123456789abcdef0123456789abcdef:ab7aecf7c8df6a6969778987fa897c71a43034bd2713e150faaaa1d3b2acadd3eab68ef01818add898fcbe3f204e04bbd09c54cef1769da5c72fe6b61a030078'),
    ('officer.aizawl@disaster.mz.gov.in', 'R. Lalhmachhuana', 'FIELD_OFFICER', '{aizawl}',
     '0123456789abcdef0123456789abcdef:ab7aecf7c8df6a6969778987fa897c71a43034bd2713e150faaaa1d3b2acadd3eab68ef01818add898fcbe3f204e04bbd09c54cef1769da5c72fe6b61a030078'),
    ('citizen@example.com', 'Zonunmawia', 'CITIZEN', '{}',
     '0123456789abcdef0123456789abcdef:ab7aecf7c8df6a6969778987fa897c71a43034bd2713e150faaaa1d3b2acadd3eab68ef01818add898fcbe3f204e04bbd09c54cef1769da5c72fe6b61a030078')
ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    assigned_districts = EXCLUDED.assigned_districts;
