/**
 * RKB (Rencana Kerja Bulanan) and KPI Service
 * Business logic for parsing employee RKB spreadsheets, calculating metrics,
 * evaluating predikat, and formatting performance trends.
 *
 * Compatible with Node.js and Google Apps Script runtime.
 */

/**
 * Evaluates predikat based on KPI score.
 * Thresholds:
 * - >= 90: Sangat Baik
 * - >= 80: Baik
 * - >= 70: Cukup
 * - >= 60: Kurang
 * - < 60: Sangat Kurang
 *
 * @param {number} score
 * @returns {string}
 */
function evaluatePredikat(score) {
  var num = Number(score);
  if (isNaN(num)) return 'Sangat Kurang';
  if (num >= 90) return 'Sangat Baik';
  if (num >= 80) return 'Baik';
  if (num >= 70) return 'Cukup';
  if (num >= 60) return 'Kurang';
  return 'Sangat Kurang';
}

/**
 * Calculates RKB metrics from a list of activities.
 *
 * @param {Array<Object>} activities
 * @returns {Object} { totalKpi, predikat, statusKegiatan: { selesai, proses, belum, total } }
 */
function calculateRkbMetrics(activities) {
  var emptyResult = {
    totalKpi: 0,
    predikat: 'Sangat Kurang',
    statusKegiatan: { selesai: 0, proses: 0, belum: 0, total: 0 }
  };

  if (!activities || !Array.isArray(activities) || activities.length === 0) {
    return emptyResult;
  }

  var selesaiCount = 0;
  var prosesCount = 0;
  var belumCount = 0;

  var totalWeight = 0;
  var weightedScoreSum = 0;
  var rawScoreSum = 0;

  for (var i = 0; i < activities.length; i++) {
    var item = activities[i];
    var statusRaw = String(item.status || '').trim().toLowerCase();

    var status = 'Belum';
    if (statusRaw === 'selesai' || statusRaw === 'done' || statusRaw === '100%') {
      status = 'Selesai';
      selesaiCount++;
    } else if (statusRaw === 'proses' || statusRaw === 'progress' || statusRaw === 'sedang berjalan' || statusRaw === '50%') {
      status = 'Proses';
      prosesCount++;
    } else {
      status = 'Belum';
      belumCount++;
    }

    // Determine individual activity score
    var itemScore = 0;
    if (item.skor !== undefined && item.skor !== null && item.skor !== '' && !isNaN(Number(item.skor))) {
      itemScore = Number(item.skor);
    } else {
      if (status === 'Selesai') itemScore = 100;
      else if (status === 'Proses') itemScore = 50;
      else itemScore = 0;
    }
    rawScoreSum += itemScore;

    // Parse weight (bobot)
    var bobot = 0;
    if (typeof item.bobot === 'string' && item.bobot.indexOf('%') !== -1) {
      bobot = parseFloat(item.bobot) / 100;
    } else if (item.bobot !== undefined && item.bobot !== null) {
      bobot = parseFloat(item.bobot) || 0;
    }

    totalWeight += bobot;
    weightedScoreSum += bobot * itemScore;
  }

  var totalKpi = 0;
  if (totalWeight > 0) {
    if (totalWeight > 1.5) {
      // Bobot was expressed in percentage points (e.g. sum is ~100)
      totalKpi = weightedScoreSum / 100;
    } else {
      // Bobot was expressed as decimal fractions (e.g. sum is ~1.0)
      totalKpi = weightedScoreSum;
    }
  } else if (activities.length > 0) {
    // Fallback to simple unweighted average
    totalKpi = rawScoreSum / activities.length;
  }

  // Round to two decimal places
  totalKpi = Math.round(totalKpi * 100) / 100;

  return {
    totalKpi: totalKpi,
    predikat: evaluatePredikat(totalKpi),
    statusKegiatan: {
      selesai: selesaiCount,
      proses: prosesCount,
      belum: belumCount,
      total: activities.length
    }
  };
}

/**
 * Formats a 12-month KPI trend array (Jan s.d. Des).
 *
 * @param {Object|Array} monthlyScores
 * @returns {Array<Object>} 12 items with { bulan, month, namaBulan, score }
 */
function parseYearlyKpiTrend(monthlyScores) {
  var MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  var FULL_MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  var trend = [];

  for (var i = 0; i < 12; i++) {
    var shortLabel = MONTH_LABELS[i];
    var fullLabel = FULL_MONTHS[i];
    var monthNum = i + 1;
    var score = 0;

    if (monthlyScores) {
      if (Array.isArray(monthlyScores)) {
        if (i < monthlyScores.length) {
          var arrItem = monthlyScores[i];
          if (typeof arrItem === 'number') {
            score = arrItem;
          } else if (arrItem && typeof arrItem.score === 'number') {
            score = arrItem.score;
          }
        }
      } else if (typeof monthlyScores === 'object') {
        if (monthlyScores[shortLabel] !== undefined) {
          score = Number(monthlyScores[shortLabel]) || 0;
        } else if (monthlyScores[fullLabel] !== undefined) {
          score = Number(monthlyScores[fullLabel]) || 0;
        } else if (monthlyScores[String(monthNum)] !== undefined) {
          score = Number(monthlyScores[String(monthNum)]) || 0;
        } else if (monthlyScores[monthNum] !== undefined) {
          score = Number(monthlyScores[monthNum]) || 0;
        }
      }
    }

    trend.push({
      bulan: shortLabel,
      month: monthNum,
      namaBulan: fullLabel,
      score: Math.round(score * 100) / 100
    });
  }

  return trend;
}

/**
 * Matches an employee RKB file from Google Drive file list.
 *
 * @param {Array} files Array of file objects or filenames
 * @param {string} employeeName Employee name to match
 * @param {string} division Division name to match
 * @returns {Object|string|null}
 */
function matchEmployeeRkbFile(files, employeeName, division) {
  if (!files || !Array.isArray(files) || files.length === 0) return null;
  if (!employeeName) return null;

  var cleanEmp = String(employeeName || '').toUpperCase().trim();
  var empTokens = cleanEmp.split(/[^A-Z0-9]+/).filter(function(t) { return t.length >= 2; });

  var cleanDiv = String(division || '').toUpperCase().trim();
  var divTokens = cleanDiv.split(/[^A-Z0-9]+/).filter(function(t) { return t.length >= 2; });

  var bestMatch = null;
  var bestScore = 0;

  for (var i = 0; i < files.length; i++) {
    var file = files[i];
    var name = '';

    if (typeof file === 'string') {
      name = file;
    } else if (file && typeof file.getName === 'function') {
      name = file.getName();
    } else if (file && file.name) {
      name = file.name;
    } else if (file && file.title) {
      name = file.title;
    }

    if (!name) continue;

    var upperName = name.toUpperCase();
    var matchScore = 0;

    // Check employee tokens
    var empMatchCount = 0;
    for (var e = 0; e < empTokens.length; e++) {
      if (upperName.indexOf(empTokens[e]) !== -1) {
        empMatchCount++;
        matchScore += 50;
      }
    }

    if (empMatchCount === 0) {
      // Must match at least one employee name token
      continue;
    }

    // Check division tokens
    for (var d = 0; d < divTokens.length; d++) {
      if (upperName.indexOf(divTokens[d]) !== -1) {
        matchScore += 20;
      }
    }

    // Bonus for starting with RKB
    if (upperName.indexOf('RKB') === 0) {
      matchScore += 10;
    }

    if (matchScore > bestScore) {
      bestScore = matchScore;
      bestMatch = file;
    }
  }

  return bestMatch;
}

/**
 * Parses 2D array of rows from an RKB sheet.
 *
 * @param {Array<Array>} rows 2D array from sheet.getDataRange().getValues()
 * @param {Array<string>} [headers] Optional explicit headers
 * @returns {Array<Object>} List of activity items
 */
function parseRkbSheetRows(rows, headers) {
  if (!rows || !Array.isArray(rows) || rows.length === 0) return [];

  var headerRowIdx = -1;
  var resolvedHeaders = null;

  if (headers && Array.isArray(headers) && headers.length > 0) {
    resolvedHeaders = headers;
    headerRowIdx = -1;
  } else {
    // Scan up to first 10 rows to detect header row
    var maxScan = Math.min(rows.length, 10);
    for (var r = 0; r < maxScan; r++) {
      var candidate = rows[r];
      if (!Array.isArray(candidate)) continue;

      var lineText = candidate.map(function(c) { return String(c || '').toLowerCase(); }).join(' ');
      var hasKegiatan = lineText.indexOf('kegiatan') !== -1 || lineText.indexOf('rencana') !== -1 || lineText.indexOf('uraian') !== -1 || lineText.indexOf('program') !== -1;
      var hasOther = lineText.indexOf('bobot') !== -1 || lineText.indexOf('status') !== -1 || lineText.indexOf('kode') !== -1 || lineText.indexOf('skor') !== -1;

      if (hasKegiatan && hasOther) {
        headerRowIdx = r;
        resolvedHeaders = candidate;
        break;
      }
    }
  }

  var dataRows = [];
  if (headerRowIdx !== -1) {
    dataRows = rows.slice(headerRowIdx + 1);
  } else if (resolvedHeaders) {
    dataRows = rows;
  } else {
    // Default fallback row 0 as headers
    resolvedHeaders = rows[0];
    dataRows = rows.slice(1);
  }

  // Identify column indices
  var kodeIdx = -1;
  var kegiatanIdx = -1;
  var bobotIdx = -1;
  var statusIdx = -1;
  var skorIdx = -1;

  for (var c = 0; c < resolvedHeaders.length; c++) {
    var h = String(resolvedHeaders[c] || '').trim().toLowerCase();
    if (kodeIdx === -1 && (h === 'kode' || h === 'no kode' || h === 'id' || h === 'kd')) {
      kodeIdx = c;
    } else if (kegiatanIdx === -1 && (h.indexOf('kegiatan') !== -1 || h.indexOf('rencana') !== -1 || h.indexOf('uraian') !== -1 || h.indexOf('program') !== -1)) {
      kegiatanIdx = c;
    } else if (bobotIdx === -1 && (h.indexOf('bobot') !== -1 || h.indexOf('weight') !== -1 || h === '%' || h.indexOf('persen') !== -1)) {
      bobotIdx = c;
    } else if (statusIdx === -1 && (h.indexOf('status') !== -1 || h.indexOf('kondisi') !== -1)) {
      statusIdx = c;
    } else if (skorIdx === -1 && (h.indexOf('skor') !== -1 || h.indexOf('score') !== -1 || h.indexOf('nilai') !== -1 || h.indexOf('capaian') !== -1)) {
      skorIdx = c;
    }
  }

  // Fallback default index positions if columns not explicitly matched
  if (kegiatanIdx === -1) kegiatanIdx = 2;
  if (bobotIdx === -1) bobotIdx = 3;
  if (statusIdx === -1) statusIdx = 4;
  if (skorIdx === -1) skorIdx = 5;

  var activities = [];

  for (var i = 0; i < dataRows.length; i++) {
    var row = dataRows[i];
    if (!Array.isArray(row)) continue;

    var kegiatan = String(row[kegiatanIdx] !== undefined ? row[kegiatanIdx] : '').trim();
    if (!kegiatan) continue;

    var kode = kodeIdx !== -1 && row[kodeIdx] ? String(row[kodeIdx]).trim() : ('ACT-' + (activities.length + 1));

    // Parse bobot
    var rawBobot = row[bobotIdx];
    var bobot = 0;
    if (typeof rawBobot === 'string' && rawBobot.indexOf('%') !== -1) {
      bobot = parseFloat(rawBobot) / 100;
    } else if (rawBobot !== undefined && rawBobot !== null && rawBobot !== '') {
      bobot = parseFloat(rawBobot) || 0;
    }

    // Normalize status
    var rawStatus = String(row[statusIdx] !== undefined ? row[statusIdx] : '').trim().toLowerCase();
    var status = 'Belum';
    if (rawStatus === 'selesai' || rawStatus === 'done' || rawStatus === '100%') {
      status = 'Selesai';
    } else if (rawStatus === 'proses' || rawStatus === 'progress' || rawStatus === '50%') {
      status = 'Proses';
    } else {
      status = 'Belum';
    }

    // Parse skor
    var rawSkor = row[skorIdx];
    var skor = 0;
    if (rawSkor !== undefined && rawSkor !== null && rawSkor !== '' && !isNaN(Number(rawSkor))) {
      skor = Number(rawSkor);
    } else {
      skor = status === 'Selesai' ? 100 : (status === 'Proses' ? 50 : 0);
    }

    activities.push({
      kode: kode,
      kegiatan: kegiatan,
      bobot: bobot,
      status: status,
      skor: skor
    });
  }

  return activities;
}

// Module export for Node.js test environment while remaining global in GAS
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    evaluatePredikat: evaluatePredikat,
    calculateRkbMetrics: calculateRkbMetrics,
    parseYearlyKpiTrend: parseYearlyKpiTrend,
    matchEmployeeRkbFile: matchEmployeeRkbFile,
    parseRkbSheetRows: parseRkbSheetRows
  };
}
