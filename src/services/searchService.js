const db = require('../db');
const {
  formatFSI,
  formatUMT,
  formatMTEL,
  formatTSEL,
  formatOLO,
  formatODC,
  getLokasiString,
  escapeHtml,
} = require('../formatters/messageFormatter');

function getLokasiOdcString(row) {
  if (row.latitude_odc && row.longitude_odc) {
    return `${String(row.latitude_odc).trim()}, ${String(row.longitude_odc).trim()}`;
  }
  return row.lokasi_odc || null;
}

/**
 * Fetch detail lengkap satu site berdasarkan target DB dan row ID
 */
async function fetchSiteById(target, id) {
  const t = (target || '').toUpperCase();
  try {
    if (t === 'TSEL') {
      let res = await db.query('SELECT * FROM tsel_sites WHERE id::text = $1 LIMIT 1', [id]);
      if (res.rows.length === 0) {
        res = await db.query('SELECT * FROM tsel WHERE id::text = $1 LIMIT 1', [id]);
      }
      if (res.rows.length > 0) {
        const row = res.rows[0];
        return {
          found: true,
          type: 'SINGLE',
          dbTarget: 'TSEL',
          siteId: row.site_id,
          message: formatTSEL(row),
          lokasi: getLokasiString(row),
          lokasiOdc: getLokasiOdcString(row),
          odcName: row.site_name_odc || row.odc || null,
        };
      }
    } else if (t === 'FSI') {
      let res = await db.query(
        'SELECT site_id, site_name, latitude, longitude, sto, ring, keterangan FROM fsi_sites WHERE id::text = $1 LIMIT 1',
        [id]
      );
      if (res.rows.length === 0) {
        res = await db.query(
          'SELECT id_tenant as site_id, site_name, lokasi, sto, ring, keterangan FROM fsi WHERE id::text = $1 LIMIT 1',
          [id]
        );
      }
      if (res.rows.length > 0) {
        const row = res.rows[0];
        return {
          found: true,
          type: 'SINGLE',
          dbTarget: 'FSI',
          message: formatFSI(row),
          lokasi: getLokasiString(row),
          lokasiOdc: null,
          odcName: null,
        };
      }
    } else if (t === 'UMT') {
      let res = await db.query(
        'SELECT site_id, site_name, latitude, longitude, sto, ring, keterangan FROM umt_sites WHERE id::text = $1 LIMIT 1',
        [id]
      );
      if (res.rows.length === 0) {
        res = await db.query(
          'SELECT site_id, site_name, lokasi, sto, ring, link_file, keterangan FROM umt WHERE id::text = $1 LIMIT 1',
          [id]
        );
      }
      if (res.rows.length > 0) {
        const row = res.rows[0];
        return {
          found: true,
          type: 'SINGLE',
          dbTarget: 'UMT',
          message: formatUMT(row),
          lokasi: getLokasiString(row),
          lokasiOdc: null,
          odcName: null,
        };
      }
    } else if (t === 'MTEL') {
      let res = await db.query(
        'SELECT site_id, site_name, latitude, longitude, sto, keterangan FROM mtel_sites WHERE id::text = $1 LIMIT 1',
        [id]
      );
      if (res.rows.length === 0) {
        res = await db.query(
          'SELECT id_tenant as site_id, site_name, lokasi, sto, keterangan FROM mtel WHERE id::text = $1 LIMIT 1',
          [id]
        );
      }
      if (res.rows.length > 0) {
        const row = res.rows[0];
        return {
          found: true,
          type: 'SINGLE',
          dbTarget: 'MTEL',
          message: formatMTEL(row),
          lokasi: getLokasiString(row),
          lokasiOdc: null,
          odcName: null,
        };
      }
    } else if (t === 'OLO') {
      const res = await db.query('SELECT * FROM olo WHERE id::text = $1 LIMIT 1', [id]);
      if (res.rows.length > 0) {
        const row = res.rows[0];
        return {
          found: true,
          type: 'SINGLE',
          dbTarget: 'OLO',
          message: formatOLO(row),
          lokasi: getLokasiString(row),
          lokasiOdc: getLokasiOdcString(row),
          odcName: row.site_name_odc || row.odc || null,
        };
      }
    }
  } catch (err) {
    console.error(`Error fetchSiteById(${target}, ${id}):`, err);
  }

  return {
    found: false,
    message: 'Data site tidak ditemukan.',
    lokasi: null,
    lokasiOdc: null,
    odcName: null,
  };
}

/**
 * Mesin Pencarian Universal Terpadu:
 * 1. Cek Exact Match pada SITE_ID / SID (Kode unik seperti BKX253, BKS077, 03BKS058, 1537791948)
 * 2. Jika bukan ID persis, lakukan Pencarian Parsial / Fuzzy Search di seluruh database
 * 3. Jika hanya 1 hasil -> Buka detail site langsung
 * 4. Jika >1 hasil -> Kembalikan daftar untuk tombol Inline Keyboard
 */
async function searchUniversal(rawQuery, preferredTarget = null) {
  const query = (rawQuery || '').trim();
  if (!query) {
    return {
      found: false,
      message: 'Silakan masukkan kata kunci ID atau Nama Site.',
      lokasi: null,
      lokasiOdc: null,
      odcName: null,
    };
  }

  // 1. FAST PATH: Cek apakah query persis sama dengan Kode SITE_ID / SID unik
  try {
    const idSql = `
      SELECT 'TSEL' as target, id::text, site_id, site_name FROM tsel_sites WHERE LOWER(TRIM(site_id)) = LOWER($1)
      UNION ALL
      SELECT 'FSI' as target, id::text, site_id, site_name FROM fsi_sites WHERE LOWER(TRIM(site_id)) = LOWER($1)
      UNION ALL
      SELECT 'UMT' as target, id::text, site_id, site_name FROM umt_sites WHERE LOWER(TRIM(site_id)) = LOWER($1)
      UNION ALL
      SELECT 'MTEL' as target, id::text, site_id, site_name FROM mtel_sites WHERE LOWER(TRIM(site_id)) = LOWER($1)
      UNION ALL
      SELECT 'OLO' as target, id::text, sid as site_id, COALESCE(isp_name || ' - ' || cust_name, cust_name, isp_name, sid) as site_name FROM olo WHERE LOWER(TRIM(sid)) = LOWER($1)
      LIMIT 2;
    `;
    const idRes = await db.query(idSql, [query]);
    if (idRes.rows.length === 1) {
      // Jika tepat 1 kode site_id unik cocok persis, langsung tampilkan kartunya
      return await fetchSiteById(idRes.rows[0].target, idRes.rows[0].id);
    }
  } catch (err) {
    console.error('Error on exact site_id search:', err);
  }

  // 2. PARTIAL / FUZZY SEARCH (Kueri dicari sebagai substring di site_id maupun site_name)
  try {
    const partialSql = `
      SELECT 'TSEL' as target, id::text, site_id, site_name FROM tsel_sites WHERE site_id ILIKE $1 OR site_name ILIKE $1
      UNION ALL
      SELECT 'FSI' as target, id::text, site_id, site_name FROM fsi_sites WHERE site_id ILIKE $1 OR site_name ILIKE $1
      UNION ALL
      SELECT 'UMT' as target, id::text, site_id, site_name FROM umt_sites WHERE site_id ILIKE $1 OR site_name ILIKE $1
      UNION ALL
      SELECT 'MTEL' as target, id::text, site_id, site_name FROM mtel_sites WHERE site_id ILIKE $1 OR site_name ILIKE $1
      UNION ALL
      SELECT 'OLO' as target, id::text, sid as site_id, COALESCE(isp_name || ' - ' || cust_name, cust_name, isp_name, sid) as site_name FROM olo WHERE sid ILIKE $1 OR isp_name ILIKE $1 OR cust_name ILIKE $1
      LIMIT 10;
    `;
    const partialRes = await db.query(partialSql, [`%${query}%`]);

    if (partialRes.rows.length === 1) {
      // Tepat 1 match -> buka detail langsung
      return await fetchSiteById(partialRes.rows[0].target, partialRes.rows[0].id);
    }

    if (partialRes.rows.length > 1) {
      let items = partialRes.rows;
      // Jika ada target yang dipilih oleh user (misal lewat /tsel), tempatkan di posisi teratas
      if (preferredTarget) {
        items.sort((a, b) => {
          if (a.target === preferredTarget && b.target !== preferredTarget) return -1;
          if (b.target === preferredTarget && a.target !== preferredTarget) return 1;
          return 0;
        });
      }

      return {
        found: true,
        type: 'MULTIPLE',
        keyword: query,
        items,
      };
    }
  } catch (err) {
    console.error('Error on partial universal search:', err);
  }

  // 3. Not Found
  return {
    found: false,
    message:
      `❌ <b>Data tidak ditemukan:</b>\n` +
      `Kata kunci '<code>${escapeHtml(query)}</code>' tidak cocok dengan ID Tenant, Site ID, ataupun Site Name di database.\n\n` +
      `💡 <i>Tips: Gunakan sebagian nama (contoh: <code>DADANG</code> atau <code>HARAPAN</code>) atau hubungi admin @Vandiza.</i>`,
    lokasi: null,
    lokasiOdc: null,
    odcName: null,
  };
}

async function searchFSI(rawQuery) {
  return searchUniversal(rawQuery, 'FSI');
}

async function searchUMT(rawQuery) {
  return searchUniversal(rawQuery, 'UMT');
}

async function searchMTEL(rawQuery) {
  return searchUniversal(rawQuery, 'MTEL');
}

async function searchTSEL(rawQuery) {
  return searchUniversal(rawQuery, 'TSEL');
}

async function searchOLO(rawQuery) {
  return searchUniversal(rawQuery, 'OLO');
}

async function searchGlobal(rawQuery) {
  return searchUniversal(rawQuery, null);
}

/**
 * Pencarian Topologi ODC
 */
async function searchODC(rawQuery) {
  const query = (rawQuery || '').trim();
  if (!query) return 'Harap masukkan nama ODC yang ingin dicari.';

  let tselRows = [];
  try {
    const resSites = await db.query(
      `SELECT site_id, site_name FROM tsel_sites WHERE LOWER(TRIM(site_name_odc)) = LOWER($1) ORDER BY site_id ASC LIMIT 100`,
      [query]
    );
    tselRows = resSites.rows;

    if (tselRows.length === 0) {
      const resTsel = await db.query(
        `SELECT site_id, site_name FROM tsel WHERE LOWER(TRIM(odc)) = LOWER($1) ORDER BY site_id ASC LIMIT 100`,
        [query]
      );
      tselRows = resTsel.rows;
    }
  } catch (e) {}

  let oloRows = [];
  try {
    const resOLO = await db.query(
      `SELECT sid, isp_name, cust_name FROM olo WHERE LOWER(TRIM(odc)) = LOWER($1) ORDER BY sid ASC LIMIT 100`,
      [query]
    );
    oloRows = resOLO.rows;
  } catch (e) {}

  return formatODC(query, tselRows, oloRows);
}

/**
 * Radar Spasial GPS: Mencari Site & ODC terdekat berdasarkan koordinat pengguna
 */
async function searchNearby(lat, lon, limitSites = 5, limitOdc = 3) {
  const latitude = parseFloat(lat);
  const longitude = parseFloat(lon);

  if (isNaN(latitude) || isNaN(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return {
      success: false,
      message: 'Koordinat GPS tidak valid. Pastikan format: <code>-6.2919, 107.0540</code>',
      sites: [],
      odcs: [],
    };
  }

  const siteSql = `
    WITH all_sites AS (
      SELECT 'TSEL' as target, id::text, site_id, site_name, latitude::float as lat, longitude::float as lon, sto, site_name_odc as odc
      FROM tsel_sites WHERE latitude IS NOT NULL AND longitude IS NOT NULL
      UNION ALL
      SELECT 'FSI' as target, id::text, site_id, site_name, latitude::float as lat, longitude::float as lon, sto, '-' as odc
      FROM fsi_sites WHERE latitude IS NOT NULL AND longitude IS NOT NULL
      UNION ALL
      SELECT 'UMT' as target, id::text, site_id, site_name, latitude::float as lat, longitude::float as lon, sto, '-' as odc
      FROM umt_sites WHERE latitude IS NOT NULL AND longitude IS NOT NULL
      UNION ALL
      SELECT 'MTEL' as target, id::text, site_id, site_name, latitude::float as lat, longitude::float as lon, sto, '-' as odc
      FROM mtel_sites WHERE latitude IS NOT NULL AND longitude IS NOT NULL
      UNION ALL
      SELECT 
        'OLO' as target, id::text, sid as site_id, COALESCE(cust_name, isp_name, sid) as site_name,
        split_part(lokasi, ',', 1)::float as lat, split_part(lokasi, ',', 2)::float as lon, sto, odc
      FROM olo
      WHERE lokasi IS NOT NULL 
        AND lokasi LIKE '%,%'
        AND TRIM(split_part(lokasi, ',', 1)) ~ '^-?[0-9]+(\\.[0-9]+)?$'
        AND TRIM(split_part(lokasi, ',', 2)) ~ '^-?[0-9]+(\\.[0-9]+)?$'
    )
    SELECT 
      target,
      id,
      site_id,
      site_name,
      lat,
      lon,
      sto,
      odc,
      ROUND((
        6371000 * acos(
          least(1.0, greatest(-1.0,
            cos(radians($1)) * cos(radians(lat)) *
            cos(radians(lon) - radians($2)) +
            sin(radians($1)) * sin(radians(lat))
          ))
        )
      )::numeric, 1) AS distance_m
    FROM all_sites
    ORDER BY distance_m ASC
    LIMIT $3;
  `;

  const odcSql = `
    SELECT 
      site_name_odc as odc_name,
      sto,
      latitude_odc::float as lat,
      longitude_odc::float as lon,
      COUNT(site_id) as total_sites,
      ROUND((
        6371000 * acos(
          least(1.0, greatest(-1.0,
            cos(radians($1)) * cos(radians(latitude_odc::float)) *
            cos(radians(longitude_odc::float) - radians($2)) +
            sin(radians($1)) * sin(radians(latitude_odc::float))
          ))
        )
      )::numeric, 1) AS distance_m
    FROM tsel_sites
    WHERE latitude_odc IS NOT NULL 
      AND longitude_odc IS NOT NULL
      AND site_name_odc IS NOT NULL
      AND site_name_odc != '-'
    GROUP BY site_name_odc, sto, latitude_odc, longitude_odc
    ORDER BY distance_m ASC
    LIMIT $3;
  `;

  try {
    const [sitesRes, odcsRes] = await Promise.all([
      db.query(siteSql, [latitude, longitude, limitSites]),
      db.query(odcSql, [latitude, longitude, limitOdc]),
    ]);

    return {
      success: true,
      lat: latitude,
      lon: longitude,
      sites: sitesRes.rows,
      odcs: odcsRes.rows,
    };
  } catch (err) {
    console.error('Error in searchNearby:', err);
    return {
      success: false,
      message: 'Gagal memproses kueri radar spasial.',
      sites: [],
      odcs: [],
    };
  }
}

/**
 * Mengambil baris data mentah satu site (untuk template koreksi data)
 */
async function getSiteRawData(siteId, target = 'TSEL') {
  const cleanId = (siteId || '').trim();
  if (!cleanId) return null;

  try {
    let res = await db.query(
      'SELECT * FROM tsel_sites WHERE LOWER(site_id) = LOWER($1) LIMIT 1',
      [cleanId]
    );
    if (res.rows.length === 0) {
      res = await db.query(
        'SELECT * FROM tsel WHERE LOWER(site_id) = LOWER($1) LIMIT 1',
        [cleanId]
      );
    }
    return res.rows[0] || null;
  } catch (err) {
    console.error('Error getSiteRawData:', err);
    return null;
  }
}

module.exports = {
  fetchSiteById,
  getSiteRawData,
  searchUniversal,
  searchFSI,
  searchUMT,
  searchMTEL,
  searchTSEL,
  searchOLO,
  searchODC,
  searchGlobal,
  searchNearby,
};
