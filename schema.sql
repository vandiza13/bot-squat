-- ==========================================================
-- SQUAT-MS DATABASE SCHEMA (PostgreSQL / Supabase)
-- ==========================================================

-- 1. TABEL FSI (6 Kolom)
CREATE TABLE IF NOT EXISTS fsi (
    id SERIAL PRIMARY KEY,
    id_tenant VARCHAR(100),
    site_name VARCHAR(255),
    lokasi VARCHAR(100),
    sto VARCHAR(100),
    ring VARCHAR(100),
    keterangan TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fsi_id_tenant ON fsi (LOWER(id_tenant));
CREATE INDEX IF NOT EXISTS idx_fsi_site_name ON fsi (LOWER(site_name));

-- 2. TABEL UMT (7 Kolom)
CREATE TABLE IF NOT EXISTS umt (
    id SERIAL PRIMARY KEY,
    site_id VARCHAR(100),
    site_name VARCHAR(255),
    lokasi VARCHAR(100),
    sto VARCHAR(100),
    ring VARCHAR(100),
    link_file TEXT,
    keterangan TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_umt_site_id ON umt (LOWER(site_id));
CREATE INDEX IF NOT EXISTS idx_umt_site_name ON umt (LOWER(site_name));

-- 3. TABEL MTEL (5 Kolom)
CREATE TABLE IF NOT EXISTS mtel (
    id SERIAL PRIMARY KEY,
    id_tenant VARCHAR(100),
    site_name VARCHAR(255),
    lokasi VARCHAR(100),
    sto VARCHAR(100),
    keterangan TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mtel_id_tenant ON mtel (LOWER(id_tenant));
CREATE INDEX IF NOT EXISTS idx_mtel_site_name ON mtel (LOWER(site_name));

-- 4. TABEL TSEL (27 Kolom sesuai Google Sheet TSEL)
CREATE TABLE IF NOT EXISTS tsel (
    id SERIAL PRIMARY KEY,
    site_id VARCHAR(100) UNIQUE,
    site_name VARCHAR(255),
    lokasi VARCHAR(100),          -- longlate
    site_class VARCHAR(100),
    branch VARCHAR(100),          -- district
    sto VARCHAR(100),
    metro VARCHAR(100),
    port_metro VARCHAR(100),
    akses VARCHAR(100),
    port_connection VARCHAR(100),
    ip_olt VARCHAR(100),
    gpon VARCHAR(100),
    port_gpon VARCHAR(100),
    ip_ont VARCHAR(100),
    sn_ont VARCHAR(100),
    ea VARCHAR(100),              -- EA/SUBRACK/CORE
    oa VARCHAR(100),              -- OA/SUBRACK/CORE
    odc VARCHAR(150),             -- SITE NAME ODC
    cap_odc VARCHAR(100),
    feeder_odc VARCHAR(100),
    core_feeder VARCHAR(100),
    bastray_dist VARCHAR(100),
    distribusi VARCHAR(100),
    lokasi_odc VARCHAR(100),      -- LONGLAT ODC
    odp VARCHAR(150),             -- SITE NAME ODP
    lokasi_odp VARCHAR(100),      -- LONGLAT ODP
    keterangan TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tsel_site_id ON tsel (LOWER(site_id));
CREATE INDEX IF NOT EXISTS idx_tsel_site_name ON tsel (LOWER(site_name));
CREATE INDEX IF NOT EXISTS idx_tsel_odc ON tsel (LOWER(odc));

-- 5. TABEL OLO (23 Kolom)
CREATE TABLE IF NOT EXISTS olo (
    id SERIAL PRIMARY KEY,
    sid VARCHAR(100),
    isp_name VARCHAR(255),
    cust_name VARCHAR(255),
    lokasi VARCHAR(100),          -- longlate
    sto VARCHAR(100),
    metro VARCHAR(100),
    port_metro VARCHAR(100),
    ip_gpon_sw VARCHAR(100),
    gpon_sw VARCHAR(100),
    port_gpon VARCHAR(100),
    sn_ont VARCHAR(100),
    vlan VARCHAR(100),
    bw VARCHAR(100),
    layanan VARCHAR(100),
    odc VARCHAR(150),
    odp VARCHAR(150),
    keterangan TEXT,
    extra_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_olo_sid ON olo (LOWER(sid));
CREATE INDEX IF NOT EXISTS idx_olo_isp_name ON olo (LOWER(isp_name));
CREATE INDEX IF NOT EXISTS idx_olo_cust_name ON olo (LOWER(cust_name));
CREATE INDEX IF NOT EXISTS idx_olo_odc ON olo (LOWER(odc));

-- 6. TABEL LOGS (Riwayat Penggunaan Bot)
CREATE TABLE IF NOT EXISTS logs (
    id SERIAL PRIMARY KEY,
    waktu TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    chat_id VARCHAR(50),
    username VARCHAR(100),
    full_name VARCHAR(200),
    pesan TEXT
);
CREATE INDEX IF NOT EXISTS idx_logs_chat_id ON logs (chat_id);
CREATE INDEX IF NOT EXISTS idx_logs_waktu ON logs (waktu DESC);

-- 7. TABEL DATA_CORRECTIONS (Tiket Usulan Koreksi Data Lapangan)
CREATE TABLE IF NOT EXISTS data_corrections (
    id SERIAL PRIMARY KEY,
    ticket_no VARCHAR(50) UNIQUE NOT NULL,
    target_table VARCHAR(50) DEFAULT 'tsel',
    site_id VARCHAR(100) NOT NULL,
    site_name VARCHAR(255),
    reporter_id VARCHAR(50) NOT NULL,
    reporter_username VARCHAR(100),
    reporter_name VARCHAR(200),
    old_data JSONB NOT NULL,
    new_data JSONB NOT NULL,
    notes TEXT,
    status VARCHAR(20) DEFAULT 'PENDING',
    reviewed_by VARCHAR(50),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_corr_status ON data_corrections (status);
CREATE INDEX IF NOT EXISTS idx_corr_site_id ON data_corrections (site_id);
CREATE INDEX IF NOT EXISTS idx_corr_ticket_no ON data_corrections (ticket_no);

