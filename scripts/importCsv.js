const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const db = require('../src/db');
const { standarisasiNamaODC } = require('../src/formatters/messageFormatter');

async function importCsv(tableName, filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File ${filePath} tidak ditemukan.`);
    process.exit(1);
  }

  const rows = [];
  console.log(`⏳ Membaca file CSV: ${filePath}...`);

  await new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => rows.push(data))
      .on('end', resolve)
      .on('error', reject);
  });

  console.log(`📦 Ditemukan ${rows.length} baris data. Memulai import ke tabel '${tableName}'...`);

  let count = 0;
  for (const row of rows) {
    const keys = Object.keys(row);

    if (tableName === 'fsi') {
      const idTenant = row[keys[0]] || row['ID Tenant'] || row['id_tenant'] || '-';
      const siteName = row[keys[1]] || row['Site Name'] || row['site_name'] || '-';
      const lokasi = row[keys[2]] || row['Lokasi'] || row['lokasi'] || '-';
      const sto = row[keys[3]] || row['STO'] || row['sto'] || '-';
      const ring = row[keys[4]] || row['RING'] || row['ring'] || '-';
      const ket = row[keys[5]] || row['Keterangan'] || row['keterangan'] || '-';

      await db.query(
        `INSERT INTO fsi (id_tenant, site_name, lokasi, sto, ring, keterangan)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [idTenant, siteName, lokasi, sto, ring, ket]
      );
      count++;
    } else if (tableName === 'umt') {
      const siteId = row[keys[0]] || row['Site ID'] || row['site_id'] || '-';
      const siteName = row[keys[1]] || row['Site Name'] || row['site_name'] || '-';
      const lokasi = row[keys[2]] || row['Lokasi'] || row['lokasi'] || '-';
      const sto = row[keys[3]] || row['STO'] || row['sto'] || '-';
      const ring = row[keys[4]] || row['Ring'] || row['ring'] || '-';
      const link = row[keys[5]] || row['Link File'] || row['link_file'] || '';
      const ket = row[keys[6]] || row['Keterangan'] || row['keterangan'] || '-';

      await db.query(
        `INSERT INTO umt (site_id, site_name, lokasi, sto, ring, link_file, keterangan)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [siteId, siteName, lokasi, sto, ring, link, ket]
      );
      count++;
    } else if (tableName === 'mtel') {
      const idTenant = row[keys[0]] || row['ID Tenant'] || row['id_tenant'] || '-';
      const siteName = row[keys[1]] || row['Site Name'] || row['site_name'] || '-';
      const lokasi = row[keys[2]] || row['Lokasi'] || row['lokasi'] || '-';
      const sto = row[keys[3]] || row['STO'] || row['sto'] || '-';
      const ket = row[keys[4]] || row['Keterangan'] || row['keterangan'] || '-';

      await db.query(
        `INSERT INTO mtel (id_tenant, site_name, lokasi, sto, keterangan)
         VALUES ($1, $2, $3, $4, $5)`,
        [idTenant, siteName, lokasi, sto, ket]
      );
      count++;
    } else if (tableName === 'tsel') {
      const siteId = (row[keys[0]] || row['SITE ID'] || row['site_id'] || '').trim().toUpperCase();
      if (!siteId) continue;

      const rawSTO = row[keys[5]] || row['STO'] || '-';
      const rawOdc = row[keys[17]] || row['SITE NAME ODC'] || row['odc'] || '-';
      const rawOdp = row[keys[24]] || row['SITE NAME ODP'] || row['odp'] || '-';

      await db.query(
        `INSERT INTO tsel (
          site_id, site_name, lokasi, site_class, branch, sto, metro, port_metro,
          akses, port_connection, ip_olt, gpon, port_gpon, ip_ont, sn_ont,
          ea, oa, odc, cap_odc, feeder_odc, core_feeder, bastray_dist,
          distribusi, lokasi_odc, odp, lokasi_odp, keterangan
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20, $21, $22,
          $23, $24, $25, $26, $27
        ) ON CONFLICT (site_id) DO UPDATE SET
          site_name = EXCLUDED.site_name,
          lokasi = EXCLUDED.lokasi,
          site_class = EXCLUDED.site_class,
          branch = EXCLUDED.branch,
          sto = EXCLUDED.sto,
          metro = EXCLUDED.metro,
          port_metro = EXCLUDED.port_metro,
          akses = EXCLUDED.akses,
          port_connection = EXCLUDED.port_connection,
          ip_olt = EXCLUDED.ip_olt,
          gpon = EXCLUDED.gpon,
          port_gpon = EXCLUDED.port_gpon,
          ip_ont = EXCLUDED.ip_ont,
          sn_ont = EXCLUDED.sn_ont,
          ea = EXCLUDED.ea,
          oa = EXCLUDED.oa,
          odc = EXCLUDED.odc,
          cap_odc = EXCLUDED.cap_odc,
          feeder_odc = EXCLUDED.feeder_odc,
          core_feeder = EXCLUDED.core_feeder,
          bastray_dist = EXCLUDED.bastray_dist,
          distribusi = EXCLUDED.distribusi,
          lokasi_odc = EXCLUDED.lokasi_odc,
          odp = EXCLUDED.odp,
          lokasi_odp = EXCLUDED.lokasi_odp,
          keterangan = EXCLUDED.keterangan,
          updated_at = NOW()`,
        [
          siteId,
          row[keys[1]] || '-',
          row[keys[2]] || '-',
          row[keys[3]] || '-',
          row[keys[4]] || '-',
          rawSTO,
          row[keys[6]] || '-',
          row[keys[7]] || '-',
          row[keys[8]] || '-',
          row[keys[9]] || '-',
          row[keys[10]] || '-',
          row[keys[11]] || '-',
          row[keys[12]] || '-',
          row[keys[13]] || '-',
          row[keys[14]] || '-',
          row[keys[15]] || '-',
          row[keys[16]] || '-',
          standarisasiNamaODC(rawOdc, rawSTO),
          row[keys[18]] || '-',
          row[keys[19]] || '-',
          row[keys[20]] || '-',
          row[keys[21]] || '-',
          row[keys[22]] || '-',
          row[keys[23]] || '-',
          standarisasiNamaODC(rawOdp, rawSTO),
          row[keys[25]] || '-',
          row[keys[26]] || '-',
        ]
      );
      count++;
    } else if (tableName === 'olo') {
      await db.query(
        `INSERT INTO olo (
          sid, isp_name, cust_name, lokasi, sto, metro, port_metro,
          ip_gpon_sw, gpon_sw, port_gpon, sn_ont, vlan, bw, layanan,
          odc, odp, keterangan
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, $13, $14,
          $15, $16, $17
        )`,
        [
          row[keys[0]] || '-',
          row[keys[1]] || '-',
          row[keys[2]] || '-',
          row[keys[3]] || '-',
          row[keys[4]] || '-',
          row[keys[5]] || '-',
          row[keys[6]] || '-',
          row[keys[7]] || '-',
          row[keys[8]] || '-',
          row[keys[9]] || '-',
          row[keys[10]] || '-',
          row[keys[11]] || '-',
          row[keys[12]] || '-',
          row[keys[13]] || '-',
          row[keys[14]] || '-',
          row[keys[21]] || '-',
          row[keys[22]] || '-',
        ]
      );
      count++;
    }
  }

  console.log(`✅ Berhasil mengimport ${count} baris ke tabel '${tableName}'!`);
}

async function main() {
  const args = process.argv.slice(2);
  const tableArg = args.find((a) => a.startsWith('--table=') || a === '-t');
  const fileArg = args.find((a) => a.startsWith('--file=') || a === '-f');

  let table = tableArg ? (tableArg.includes('=') ? tableArg.split('=')[1] : args[args.indexOf(tableArg) + 1]) : null;
  let file = fileArg ? (fileArg.includes('=') ? fileArg.split('=')[1] : args[args.indexOf(fileArg) + 1]) : null;

  if (!table || !file) {
    console.log('Penggunaan:');
    console.log('  node scripts/importCsv.js --table=tsel --file=./data/tsel.csv');
    console.log('  Tabel yang tersedia: fsi, umt, mtel, tsel, olo');
    process.exit(1);
  }

  try {
    await importCsv(table.toLowerCase(), path.resolve(file));
  } catch (e) {
    console.error('❌ Terjadi kesalahan saat import:', e.message);
  } finally {
    await db.pool.end();
  }
}

if (require.main === module) {
  main();
}

module.exports = importCsv;
