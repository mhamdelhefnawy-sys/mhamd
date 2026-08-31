/*
 * Small dependency-free helpers: HTML escaping, CSV parsing (RFC4180-ish, no library —
 * this is why BOQ import in the offline build is CSV-first; see README), file download,
 * and calendar math for M01's "enter two of three, compute the third" rule.
 */
(function (global) {
  "use strict";

  function escapeHtml(value) {
    if (value === null || value === undefined) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatDate(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-GB"); // dd/mm/yyyy, unambiguous regardless of locale
  }

  function todayIso() {
    return new Date().toISOString().slice(0, 10);
  }

  function downloadFile(filename, content, mime) {
    var blob = new Blob([content], { type: mime || "application/octet-stream" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  // Minimal RFC4180 parser: handles quoted fields, embedded commas/newlines, doubled quotes.
  function parseCsv(text) {
    var rows = [];
    var row = [];
    var field = "";
    var inQuotes = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
        } else {
          field += c;
        }
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field); field = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field); field = "";
        rows.push(row); row = [];
      } else {
        field += c;
      }
    }
    if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
    rows = rows.filter(function (r) { return !(r.length === 1 && r[0] === ""); });
    if (rows.length === 0) return { headers: [], rows: [] };
    var headers = rows[0].map(function (h) { return h.trim(); });
    var dataRows = rows.slice(1).map(function (r) {
      var obj = {};
      headers.forEach(function (h, idx) { if (h) obj[h] = r[idx] !== undefined ? r[idx].trim() : ""; });
      return obj;
    }).filter(function (obj) { return Object.values(obj).some(function (v) { return v !== ""; }); });
    return { headers: headers, rows: dataRows };
  }

  // Generic row mapper + validator (same shape as the server-side importEngine design in
  // the roadmap doc) — every failed row is reported, none silently dropped.
  function mapAndValidateRows(sheet, mapping, validateRow) {
    var valid = [];
    var errors = [];
    sheet.rows.forEach(function (row, idx) {
      var mapped = {};
      Object.keys(mapping).forEach(function (systemField) {
        mapped[systemField] = row[mapping[systemField]];
      });
      var result = validateRow(mapped, idx + 2);
      if (result.errors && result.errors.length > 0) {
        errors.push.apply(errors, result.errors);
      } else if (result.value !== undefined) {
        valid.push(result.value);
      }
    });
    return {
      valid: valid,
      errors: errors,
      summary: { totalRows: sheet.rows.length, validRows: valid.length, failedRows: sheet.rows.length - valid.length },
    };
  }

  // ---- calendar math for M01 (start / finish / duration — supply two, compute the third) ----

  function isWorkingDay(date, weekendDays, holidaySet) {
    var dow = date.getDay(); // 0=Sunday..6=Saturday
    if (weekendDays.indexOf(dow) !== -1) return false;
    var iso = date.toISOString().slice(0, 10);
    if (holidaySet && holidaySet.has(iso)) return false;
    return true;
  }

  // Working days strictly between two dates (exclusive of start, inclusive of finish),
  // i.e. the duration a schedule would show for start -> finish on this calendar.
  function workingDaysBetween(startIso, finishIso, weekendDays, holidays) {
    var start = new Date(startIso);
    var finish = new Date(finishIso);
    var holidaySet = new Set((holidays || []).map(function (h) { return h.date; }));
    var count = 0;
    var d = new Date(start);
    d.setDate(d.getDate() + 1);
    while (d <= finish) {
      if (isWorkingDay(d, weekendDays, holidaySet)) count++;
      d.setDate(d.getDate() + 1);
    }
    return count;
  }

  function addWorkingDays(startIso, durationDays, weekendDays, holidays) {
    var holidaySet = new Set((holidays || []).map(function (h) { return h.date; }));
    var d = new Date(startIso);
    var remaining = durationDays;
    while (remaining > 0) {
      d.setDate(d.getDate() + 1);
      if (isWorkingDay(d, weekendDays, holidaySet)) remaining--;
    }
    return d.toISOString().slice(0, 10);
  }

  function parseWeekendDays(csv) {
    return (csv || "5").split(",").map(function (s) { return parseInt(s, 10); }).filter(function (n) { return !isNaN(n); });
  }

  global.PP = global.PP || {};
  global.PP.util = {
    escapeHtml: escapeHtml,
    formatDate: formatDate,
    todayIso: todayIso,
    downloadFile: downloadFile,
    parseCsv: parseCsv,
    mapAndValidateRows: mapAndValidateRows,
    workingDaysBetween: workingDaysBetween,
    addWorkingDays: addWorkingDays,
    parseWeekendDays: parseWeekendDays,
  };
})(window);
