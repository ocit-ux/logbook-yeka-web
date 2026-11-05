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
function calculateRkbMetrics(activities, precalculatedKpi) {
  var emptyResult = {
    totalKpi: 0,
    predikat: 'Sangat Kurang',
    statusKegiatan: { selesai: 0, proses: 0, belum: 0, total: 0 }
  };

  if (!activities || !Array.isArray(activities) || activities.length === 0) {
    if (precalculatedKpi && precalculatedKpi.totalKpi !== undefined) {
      return {
        totalKpi: precalculatedKpi.totalKpi,
        predikat: precalculatedKpi.predikat || evaluatePredikat(precalculatedKpi.totalKpi),
        statusKegiatan: { selesai: 0, proses: 0, belum: 0, total: 0 }
      };
    }
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
    if (statusRaw === 'selesai' || statusRaw === 'terlaksana' || statusRaw === 'done' || statusRaw === '100%') {
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
  if (precalculatedKpi && precalculatedKpi.totalKpi !== undefined && !isNaN(Number(precalculatedKpi.totalKpi))) {
    totalKpi = Number(precalculatedKpi.totalKpi);
  } else if (totalWeight > 0) {
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

  var finalPredikat = (precalculatedKpi && precalculatedKpi.predikat)
    ? precalculatedKpi.predikat
    : evaluatePredikat(totalKpi);

  return {
    totalKpi: totalKpi,
    predikat: finalPredikat,
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

  function norm(str) {
    return String(str || '').toUpperCase()
      .replace(/DD/g, 'D')
      .replace(/LL/g, 'L')
      .replace(/MM/g, 'M')
      .replace(/SS/g, 'S');
  }

  var cleanEmp = String(employeeName || '').toUpperCase().trim();
  var empTokens = cleanEmp.split(/[^A-Z0-9]+/).filter(function(t) { return t.length >= 2; });
  var normEmpTokens = empTokens.map(norm);

  var cleanDiv = String(division || '').toUpperCase().trim();
  var divTokens = cleanDiv.split(/[^A-Z0-9]+/).filter(function(t) { return t.length >= 2; });

  var genericTokens = ['NUR', 'AHMAD', 'MUHAMMAD', 'ADI', 'AL'];

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
    var fileTokens = upperName.split(/[^A-Z0-9]+/).filter(function(t) { return t.length >= 2; });
    var normFileTokens = fileTokens.map(norm);

    var matchScore = 0;
    var exactEmpTokenMatches = 0;
    var distinctiveMatch = false;

    for (var e = 0; e < empTokens.length; e++) {
      var token = empTokens[e];
      var nToken = normEmpTokens[e];

      var idx = fileTokens.indexOf(token);
      if (idx === -1) idx = normFileTokens.indexOf(nToken);

      if (idx !== -1) {
        exactEmpTokenMatches++;
        var isGeneric = genericTokens.indexOf(token) !== -1;
        if (!isGeneric) {
          distinctiveMatch = true;
          matchScore += 100 + (token.length * 5);
        } else {
          matchScore += 30;
        }
      }
    }

    if (exactEmpTokenMatches === 0) {
      continue;
    }

    if (!distinctiveMatch && exactEmpTokenMatches < 2 && empTokens.length > 1) {
      continue;
    }

    for (var d = 0; d < divTokens.length; d++) {
      if (fileTokens.indexOf(divTokens[d]) !== -1) {
        matchScore += 40;
      }
    }

    if (upperName.indexOf('RKB') === 0) {
      matchScore += 10;
    }

    if (fileTokens.indexOf('AINUR') !== -1 && empTokens.indexOf('AINUR') === -1) {
      matchScore -= 150;
    }
    if ((fileTokens.indexOf('SIROJUDIN') !== -1 || normFileTokens.indexOf('SIROJUDIN') !== -1) &&
        normEmpTokens.indexOf('SIROJUDIN') === -1) {
      matchScore -= 150;
    }
    if (fileTokens.indexOf('VYAS') !== -1 && empTokens.indexOf('VYAS') === -1) {
      matchScore -= 150;
    }
    if (fileTokens.indexOf('ADIYAKSA') !== -1 && empTokens.indexOf('ADIYAKSA') === -1) {
      matchScore -= 150;
    }

    if (matchScore > bestScore && matchScore >= 40) {
      bestScore = matchScore;
      bestMatch = file;
    }
  }

  return bestMatch;
}

function extractRkbRekapKpi(rows) {
  if (!rows || !Array.isArray(rows) || rows.length === 0) return null;
  var totalKpi = null;
  var predikat = null;

  for (var r = 0; r < rows.length; r++) {
    var row = rows[r];
    if (!Array.isArray(row)) continue;
    var firstCol = String(row[0] || '').trim().toUpperCase();

    if (firstCol.indexOf('TOTAL KPI') !== -1) {
      for (var c = row.length - 1; c >= 1; c--) {
        var val = String(row[c] || '').replace(/["%]/g, '').replace(',', '.').trim();
        var num = parseFloat(val);
        if (!isNaN(num) && num > 0) {
          totalKpi = num;
          break;
        }
      }
    }

    if (firstCol.indexOf('PREDIKAT') !== -1) {
      for (var c = row.length - 1; c >= 1; c--) {
        var str = String(row[c] || '').replace(/"/g, '').trim();
        if (str && str.length >= 4 && isNaN(Number(str))) {
          predikat = str;
          break;
        }
      }
    }
  }

  if (totalKpi !== null) {
    return {
      totalKpi: totalKpi,
      predikat: predikat || evaluatePredikat(totalKpi)
    };
  }
  return null;
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
    // Scan up to first 30 rows to detect exact header row
    var maxScan = Math.min(rows.length, 30);
    for (var r = 0; r < maxScan; r++) {
      var candidate = rows[r];
      if (!Array.isArray(candidate)) continue;

      var lineTokens = candidate.map(function(c) { return String(c || '').toLowerCase().trim(); });
      var hasExactKode = lineTokens.some(function(c) { return c === 'kode' || c === 'no kode'; });
      var hasExactKegiatan = lineTokens.some(function(c) { return c === 'kegiatan'; });
      var hasExactBobot = lineTokens.some(function(c) { return c.indexOf('bobot') !== -1; });
      var hasExactStatus = lineTokens.some(function(c) { return c.indexOf('status') !== -1; });

      if (hasExactKode && hasExactKegiatan && (hasExactBobot || hasExactStatus)) {
        headerRowIdx = r;
        resolvedHeaders = candidate;
        break;
      }

      var lineText = lineTokens.join(' ');
      var hasKegiatan = lineText.indexOf('kegiatan') !== -1 || lineText.indexOf('rencana') !== -1 || lineText.indexOf('uraian') !== -1 || lineText.indexOf('program') !== -1;
      var hasOther = lineText.indexOf('bobot') !== -1 || lineText.indexOf('status') !== -1 || lineText.indexOf('kode') !== -1 || lineText.indexOf('skor') !== -1;

      if (hasKegiatan && hasOther && headerRowIdx === -1) {
        headerRowIdx = r;
        resolvedHeaders = candidate;
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
  var outputIdx = -1;
  var bobotIdx = -1;
  var statusIdx = -1;
  var skorIdx = -1;

  for (var c = 0; c < resolvedHeaders.length; c++) {
    var h = String(resolvedHeaders[c] || '').trim().toLowerCase();
    if (kodeIdx === -1 && (h === 'kode' || h === 'no kode' || h === 'id' || h === 'kd')) {
      kodeIdx = c;
    } else if (kegiatanIdx === -1 && (h === 'kegiatan' || h.indexOf('kegiatan') !== -1 || h.indexOf('rencana') !== -1 || h.indexOf('uraian') !== -1 || h.indexOf('program') !== -1)) {
      kegiatanIdx = c;
    } else if (outputIdx === -1 && (h.indexOf('output') !== -1 || h.indexOf('indikator') !== -1 || h.indexOf('hasil') !== -1)) {
      outputIdx = c;
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

    var rawKode = kodeIdx !== -1 && row[kodeIdx] ? String(row[kodeIdx]).trim() : '';
    // Skip section headers and summary rows
    if (/^(subtotal|total|a\.|b\.|c\.|d\.|e\.)/i.test(kegiatan)) continue;
    if (/^(subtotal|total|a\.|b\.|c\.|d\.|e\.)/i.test(rawKode)) continue;
    if (!rawKode && (row[bobotIdx] === undefined || row[bobotIdx] === '')) continue;

    var kode = rawKode || ('ACT-' + (activities.length + 1));
    var output = outputIdx !== -1 && row[outputIdx] ? String(row[outputIdx]).replace(/"/g, '').trim() : '';

    // Parse bobot
    var rawBobot = row[bobotIdx];
    var bobot = 0;
    if (typeof rawBobot === 'string' && rawBobot.indexOf('%') !== -1) {
      bobot = parseFloat(rawBobot.replace(/,/g, '.')) / 100;
    } else if (rawBobot !== undefined && rawBobot !== null && rawBobot !== '') {
      var parsedNum = parseFloat(String(rawBobot).replace(/,/g, '.'));
      bobot = isNaN(parsedNum) ? 0 : parsedNum;
    }

    // Normalize status
    var rawStatus = String(row[statusIdx] !== undefined ? row[statusIdx] : '').trim().toLowerCase();
    var status = 'Belum';
    if (rawStatus === 'selesai' || rawStatus === 'terlaksana' || rawStatus === 'done' || rawStatus === '100%') {
      status = 'Selesai';
    } else if (rawStatus === 'proses' || rawStatus === 'progress' || rawStatus === '50%') {
      status = 'Proses';
    } else {
      status = 'Belum';
    }

    // Parse skor
    var rawSkor = row[skorIdx];
    var skor = 0;
    if (rawSkor !== undefined && rawSkor !== null && rawSkor !== '' && !isNaN(Number(String(rawSkor).replace(/,/g, '.')))) {
      skor = Number(String(rawSkor).replace(/,/g, '.'));
    } else {
      skor = status === 'Selesai' ? 100 : (status === 'Proses' ? 50 : 0);
    }

    activities.push({
      kode: kode,
      kegiatan: kegiatan,
      output: output,
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
    parseRkbSheetRows: parseRkbSheetRows,
    extractRkbRekapKpi: extractRkbRekapKpi
  };
}
