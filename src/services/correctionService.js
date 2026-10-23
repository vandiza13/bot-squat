const db = require('../db');

// Pemetaan Field yang diizinkan untuk dikoreksi (23 parameter teknis)
const EDITABLE_FIELDS = {
  branch: { column: 'branch', label: 'BRANCH' },
  sto: { column: 'sto', label: 'STO' },
  metro: { column: 'metro', label: 'METRO' },
  port_metro: { column: 'port_metro', label: 'Port METRO' },
  akses: { column: 'akses', label: 'Akses' },
  port_connection: { column: 'port_connection', label: 'Port Connection' },
  ip_olt: { column: 'ip_olt', label: 'IP OLT' },
  gpon: { column: 'gpon', label: 'GPON' },
  port_gpon: { column: 'port_gpon', label: 'Port GPON' },
  ip_ont: { column: 'ip_ont', label: 'Ip ONT' },
  sn_ont: { column: 'sn_ont', label: 'SN ONT' },
  ea: { column: 'ea', label: 'EA/SUB/CORE' },
  oa: { column: 'oa', label: 'OA/SUB/CORE' },
  odc: { column: 'odc', label: 'ODC' },
  cap_odc: { column: 'cap_odc', label: 'Cap ODC' },
  feeder_odc: { column: 'feeder_odc', label: 'Feeder ODC' },
  core_feeder: { column: 'core_feeder', label: 'Core Feeder' },
  bastray_dist: { column: 'bastray_dist', label: 'Bastray Dist' },
  distribusi: { column: 'distribusi', label: 'Distribusi' },
  lokasi_odc: { column: 'lokasi_odc', label: 'Longlate ODC' },
  odp: { column: 'odp', label: 'ODP' },
  lokasi_odp: { column: 'lokasi_odp', label: 'Longlate ODP' },
  keterangan: { column: 'keterangan', label: 'KETERANGAN' },
};

// Pemetaan nama kolom fisik tabel tsel_sites
const TSEL_SITES_COLUMN_MAP = {
  branch: 'branch',
  sto: 'sto',
  metro: 'metro',
  port_metro: 'port_metro',
  akses: 'akses',
  port_connection: 'port_connection',
  ip_olt: 'ip_olt',
  gpon: 'gpon',
  port_gpon: 'port_gpon',
  ip_ont: 'ip_ont',
  sn_ont: 'sn_ont',
  ea: 'ea_subrack_core',
  oa: 'oa_subrack_core',
  odc: 'site_name_odc',
  cap_odc: 'capacity_odc',
  feeder_odc: 'bastray_feeder_odc',
  core_feeder: 'core_feeder_odc',
  bastray_dist: 'bastray_distribusi',
  distribusi: 'distribusi_core',
  odp: 'site_name_odp',
  keterangan: 'keterangan',
};

// Aliases agar parser fleksibel menerima variasi penulisan dari pengguna
const KEY_ALIASES = {
  branch: 'branch',
  sto: 'sto',
  metro: 'metro',
  'port metro': 'port_metro',
  port_metro: 'port_metro',
  portmetro: 'port_metro',
  akses: 'akses',
  'port connection': 'port_connection',
  port_connection: 'port_connection',
  portconnection: 'port_connection',
  'ip olt': 'ip_olt',
  ip_olt: 'ip_olt',
  ipolt: 'ip_olt',
  gpon: 'gpon',
  'port gpon': 'port_gpon',
  port_gpon: 'port_gpon',
  portgpon: 'port_gpon',
  'ip ont': 'ip_ont',
  ip_ont: 'ip_ont',
  ipont: 'ip_ont',
  'sn ont': 'sn_ont',
  sn_ont: 'sn_ont',
  snont: 'sn_ont',
  'ea/sub/core': 'ea',
  ea: 'ea',
  'oa/sub/core': 'oa',
  oa: 'oa',
  odc: 'odc',
  'cap odc': 'cap_odc',
  cap_odc: 'cap_odc',
  kapasitas_odc: 'cap_odc',
  'feeder odc': 'feeder_odc',
  feeder_odc: 'feeder_odc',
  feeder: 'feeder_odc',
  'core feeder': 'core_feeder',
  core_feeder: 'core_feeder',
  'bastray dist': 'bastray_dist',
  bastray_dist: 'bastray_dist',
  distribusi: 'distribusi',
  'longlate odc': 'lokasi_odc',
  lokasi_odc: 'lokasi_odc',
  'lokasi odc': 'lokasi_odc',
  'koordinat odc': 'lokasi_odc',
  odp: 'odp',
  'longlate odp': 'lokasi_odp',
  lokasi_odp: 'lokasi_odp',
  'lokasi odp': 'lokasi_odp',
  'koordinat odp': 'lokasi_odp',
  keterangan: 'keterangan',
  ket: 'keterangan',
  catatan: 'notes',
  alasan: 'notes',
  notes: 'notes',
};

/**
 * Menghasilkan template teks prefilled sesuai format yang diminta
 */
function generateCorrectionTemplate(siteData) {
  const ea = siteData.ea_subrack_core || siteData.ea || '-';
  const oa = siteData.oa_subrack_core || siteData.oa || '-';
  const odc = siteData.site_name_odc || siteData.odc || '-';
  const capOdc = siteData.capacity_odc != null ? String(siteData.capacity_odc) : (siteData.cap_odc || '-');
  const fdOdc = siteData.bastray_feeder_odc || siteData.feeder_odc || '-';
  const crFd = siteData.core_feeder_odc || siteData.core_feeder || '-';
  const bsDist = siteData.bastray_distribusi || siteData.bastray_dist || '-';
  const dsCore = siteData.distribusi_core || siteData.distribusi || '-';
  const locOdc = (siteData.latitude_odc && siteData.longitude_odc)
    ? `${siteData.latitude_odc}, ${siteData.longitude_odc}`
    : (siteData.lokasi_odc || '-');
  const odp = siteData.site_name_odp || siteData.odp || '-';
  const locOdp = (siteData.latitude_odp && siteData.longitude_odp)
    ? `${siteData.latitude_odp}, ${siteData.longitude_odp}`
    : (siteData.lokasi_odp || '-');

  return `⚙️ [ KONEKTIVITAS & PERANGKAT ]
========================
BRANCH = ${siteData.branch || '-'}
STO = ${siteData.sto || '-'}
METRO = ${siteData.metro || '-'}
Port METRO = ${siteData.port_metro || '-'}
Akses = ${siteData.akses || '-'}
Port Connection = ${siteData.port_connection || '-'}
IP OLT = ${siteData.ip_olt || '-'}
GPON = ${siteData.gpon || '-'}
Port GPON = ${siteData.port_gpon || '-'}
Ip ONT = ${siteData.ip_ont || '-'}
SN ONT = ${siteData.sn_ont || '-'}

🗄️ [ CORE STO / RACK ]
========================
EA/SUB/CORE = ${ea}
OA/SUB/CORE = ${oa}

🎛️ [ JARINGAN ODC ]
========================
ODC = ${odc}
Cap ODC = ${capOdc}
Feeder ODC = ${fdOdc}
Core Feeder = ${crFd}
Bastray Dist = ${bsDist}
Distribusi = ${dsCore}
Longlate ODC = ${locOdc}

📍 [ JARINGAN ODP ]
========================
ODP = ${odp}
Longlate ODP = ${locOdp}

📝 [ KETERANGAN ]
========================
KETERANGAN = ${siteData.keterangan || '-'}
ALASAN = [Tuliskan alasan perubahan data di sini]`;
}

/**
 * Parser teks input teknisi / admin (mendukung format tanda = atau :)
 */
function parseCorrectionInput(rawText, currentSiteData = {}) {
  const lines = rawText.split('\n');
  const parsedData = {};
  let notes = '';

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('⚙️') || line.startsWith('🗄️') || line.startsWith('🎛️') || line.startsWith('📍') || line.startsWith('📝') || line.startsWith('===') || line.startsWith('---')) {
      continue;
    }

    // Split dengan tanda = atau : pertama
    let sepIndex = line.indexOf('=');
    if (sepIndex === -1) {
      sepIndex = line.indexOf(':');
    }
    if (sepIndex === -1) continue;

    const rawKey = line.substring(0, sepIndex).trim().toLowerCase();
    const rawVal = line.substring(sepIndex + 1).trim();

    const normalizedKey = KEY_ALIASES[rawKey];
    if (!normalizedKey) continue;

    if (normalizedKey === 'notes') {
      if (rawVal && rawVal !== '-' && !rawVal.includes('[Tuliskan alasan')) {
        notes = rawVal;
      }
      continue;
    }

    if (EDITABLE_FIELDS[normalizedKey]) {
      parsedData[normalizedKey] = rawVal;
    }
  }

  // Bandingkan dengan data saat ini di database untuk mendapatkan diff murni
  const changes = [];
  const oldDataSnapshot = {};
  const newDataSnapshot = {};

  for (const [key, newVal] of Object.entries(parsedData)) {
    const fieldMeta = EDITABLE_FIELDS[key];
    if (!fieldMeta) continue;

    // Ambil oldVal dengan fallback column name di tsel_sites
    let oldVal = currentSiteData[fieldMeta.column];
    if (oldVal === undefined) {
      const altCol = TSEL_SITES_COLUMN_MAP[fieldMeta.column];
      if (altCol && currentSiteData[altCol] !== undefined) {
        oldVal = currentSiteData[altCol];
      }
    }
    if (key === 'lokasi_odc' && currentSiteData.latitude_odc && currentSiteData.longitude_odc) {
      oldVal = `${currentSiteData.latitude_odc}, ${currentSiteData.longitude_odc}`;
    }
    if (key === 'lokasi_odp' && currentSiteData.latitude_odp && currentSiteData.longitude_odp) {
      oldVal = `${currentSiteData.latitude_odp}, ${currentSiteData.longitude_odp}`;
    }

    const cleanOldVal = (oldVal != null ? String(oldVal) : '-').trim();
    const cleanNewVal = newVal.trim();

    // Abaikan jika tidak ada perubahan nilai
    if (cleanNewVal !== cleanOldVal) {
      changes.push({
        field: key,
        column: fieldMeta.column,
        label: fieldMeta.label,
        oldValue: cleanOldVal,
        newValue: cleanNewVal,
      });
      oldDataSnapshot[fieldMeta.column] = cleanOldVal;
      newDataSnapshot[fieldMeta.column] = cleanNewVal;
    }
  }

  return {
    hasChanges: changes.length > 0,
    changes,
    oldData: oldDataSnapshot,
    newData: newDataSnapshot,
    notes,
  };
}

/**
 * Membuat tiket koreksi baru di database (status: PENDING)
 */
async function createCorrectionTicket({
  targetTable = 'tsel_sites',
  siteId,
  siteName = '-',
  reporterId,
  reporterUsername = '',
  reporterName = '',
  oldData,
  newData,
  notes = '',
}) {
  const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const ticketNo = `KOR-${dateStr}-${randomSuffix}`;

  const query = `
    INSERT INTO data_corrections (
      ticket_no, target_table, site_id, site_name,
      reporter_id, reporter_username, reporter_name,
      old_data, new_data, notes, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'PENDING')
    RETURNING *;
  `;

  const values = [
    ticketNo,
    targetTable,
    siteId,
    siteName,
    reporterId.toString(),
    reporterUsername,
    reporterName,
    JSON.stringify(oldData),
    JSON.stringify(newData),
    notes,
  ];

  const res = await db.query(query, values);
  return res.rows[0];
}

/**
 * Ambil tiket berdasarkan ID atau Ticket No
 */
async function getCorrectionTicket(ticketId) {
  const query = `SELECT * FROM data_corrections WHERE id::text = $1 OR ticket_no = $1;`;
  const res = await db.query(query, [ticketId.toString()]);
  return res.rows[0] || null;
}

/**
 * Update nilai usulan baru pada tiket (digunakan saat Admin mengedit data sebelum disetujui)
 */
async function updateTicketNewData(ticketId, updatedNewData, notes = null) {
  let query;
  let values;

  if (notes !== null) {
    query = `
      UPDATE data_corrections 
      SET new_data = $1, notes = $2, updated_at = NOW() 
      WHERE id::text = $3 
      RETURNING *;
    `;
    values = [JSON.stringify(updatedNewData), notes, ticketId.toString()];
  } else {
    query = `
      UPDATE data_corrections 
      SET new_data = $1, updated_at = NOW() 
      WHERE id::text = $2 
      RETURNING *;
    `;
    values = [JSON.stringify(updatedNewData), ticketId.toString()];
  }

  const res = await db.query(query, values);
  return res.rows[0];
}

/**
 * Setujui tiket koreksi dan lakukan UPDATE atomic ke tabel tsel_sites / tsel
 */
async function approveCorrection(ticketId, adminId, finalData = null) {
  const ticket = await getCorrectionTicket(ticketId);
  if (!ticket) {
    throw new Error('Tiket koreksi tidak ditemukan');
  }

  if (ticket.status !== 'PENDING') {
    return {
      success: false,
      alreadyProcessed: true,
      status: ticket.status,
      ticket,
    };
  }

  const dataToApply = finalData || ticket.new_data;
  const entries = Object.entries(dataToApply);

  if (entries.length === 0) {
    throw new Error('Tidak ada data yang akan diupdate');
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Tentukan apakah site ada di tsel_sites atau tsel
    let actualTable = 'tsel_sites';
    const checkSites = await client.query('SELECT site_id FROM tsel_sites WHERE LOWER(site_id) = LOWER($1) LIMIT 1', [ticket.site_id]);
    if (checkSites.rows.length === 0) {
      const checkTsel = await client.query('SELECT site_id FROM tsel WHERE LOWER(site_id) = LOWER($1) LIMIT 1', [ticket.site_id]);
      if (checkTsel.rows.length > 0) {
        actualTable = 'tsel';
      }
    }

    // Bangun query update dinamis dan aman
    const setClauses = [];
    const queryParams = [];
    let paramIndex = 1;

    for (const [col, val] of entries) {
      const isAllowed = Object.values(EDITABLE_FIELDS).some((f) => f.column === col);
      if (!isAllowed) continue;

      if (actualTable === 'tsel_sites') {
        if (col === 'lokasi_odc') {
          const parts = val.split(',').map((s) => s.trim());
          if (parts.length === 2 && !isNaN(parseFloat(parts[0])) && !isNaN(parseFloat(parts[1]))) {
            setClauses.push(`latitude_odc = $${paramIndex++}`);
            queryParams.push(parseFloat(parts[0]));
            setClauses.push(`longitude_odc = $${paramIndex++}`);
            queryParams.push(parseFloat(parts[1]));
          }
          continue;
        }
        if (col === 'lokasi_odp') {
          const parts = val.split(',').map((s) => s.trim());
          if (parts.length === 2 && !isNaN(parseFloat(parts[0])) && !isNaN(parseFloat(parts[1]))) {
            setClauses.push(`latitude_odp = $${paramIndex++}`);
            queryParams.push(parseFloat(parts[0]));
            setClauses.push(`longitude_odp = $${paramIndex++}`);
            queryParams.push(parseFloat(parts[1]));
          }
          continue;
        }

        const mappedCol = TSEL_SITES_COLUMN_MAP[col] || col;
        setClauses.push(`${mappedCol} = $${paramIndex++}`);
        queryParams.push(val);
      } else {
        setClauses.push(`${col} = $${paramIndex++}`);
        queryParams.push(val);
        setClauses.push(`updated_at = NOW()`);
      }
    }

    if (setClauses.length === 0) {
      throw new Error('Tidak ada kolom valid yang dapat diupdate');
    }

    queryParams.push(ticket.site_id);

    const updateTableQuery = `
      UPDATE ${actualTable}
      SET ${setClauses.join(', ')}
      WHERE LOWER(site_id) = LOWER($${paramIndex})
      RETURNING *;
    `;

    // 1. Update tabel site
    const siteUpdateRes = await client.query(updateTableQuery, queryParams);

    // 2. Update status tiket
    const updateTicketQuery = `
      UPDATE data_corrections
      SET status = 'APPROVED', target_table = $1, new_data = $2, reviewed_by = $3, reviewed_at = NOW(), updated_at = NOW()
      WHERE id = $4
      RETURNING *;
    `;
    const ticketUpdateRes = await client.query(updateTicketQuery, [
      actualTable,
      JSON.stringify(dataToApply),
      adminId.toString(),
      ticket.id,
    ]);

    await client.query('COMMIT');

    return {
      success: true,
      ticket: ticketUpdateRes.rows[0],
      updatedSite: siteUpdateRes.rows[0],
      appliedData: dataToApply,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Tolak tiket koreksi
 */
async function rejectCorrection(ticketId, adminId, reason = '') {
  const ticket = await getCorrectionTicket(ticketId);
  if (!ticket) {
    throw new Error('Tiket koreksi tidak ditemukan');
  }

  if (ticket.status !== 'PENDING') {
    return {
      success: false,
      alreadyProcessed: true,
      status: ticket.status,
      ticket,
    };
  }

  const query = `
    UPDATE data_corrections
    SET status = 'REJECTED', reviewed_by = $1, reviewed_at = NOW(), updated_at = NOW()
    WHERE id = $2
    RETURNING *;
  `;

  const res = await db.query(query, [adminId.toString(), ticket.id]);
  return {
    success: true,
    ticket: res.rows[0],
  };
}

module.exports = {
  EDITABLE_FIELDS,
  TSEL_SITES_COLUMN_MAP,
  KEY_ALIASES,
  generateCorrectionTemplate,
  parseCorrectionInput,
  createCorrectionTicket,
  getCorrectionTicket,
  updateTicketNewData,
  approveCorrection,
  rejectCorrection,
};
