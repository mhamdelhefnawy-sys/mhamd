/* M03 — BOQ engine.
 * Offline scope: CSV import (no xlsx parser vendored — see README) with column mapping
 * and per-row validation, manual entry, revisions, and an approval lock per revision.
 */
(function () {
  "use strict";
  var db = PP.db, gov = PP.gov, util = PP.util, esc = PP.util.escapeHtml;

  var SYSTEM_FIELDS = [
    { key: "itemNo", label: "رقم البند", required: false },
    { key: "description", label: "الوصف", required: true },
    { key: "unit", label: "الوحدة", required: true },
    { key: "quantity", label: "الكمية", required: false },
    { key: "rate", label: "سعر الوحدة", required: false },
    { key: "section", label: "القسم/التصنيف", required: false },
  ];

  function ensureBoq(project) {
    var boq = db.query("boqs", function (b) { return b.projectId === project.id; })[0];
    if (!boq) boq = db.insert("boqs", { projectId: project.id, name: "BOQ الرئيسي" });
    return boq;
  }

  function render(root, project) {
    var boq = ensureBoq(project);
    var revisions = db.query("boqRevisions", function (r) { return r.boqId === boq.id; }).sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });

    var html = '<div class="view-head"><div><h2>BOQ</h2>' +
      "<p>M03 — استيراد CSV مع مطابقة أعمدة وتحقق لكل صف، إدخال يدوي، ومراجعات معتمدة.</p></div>" +
      '<div class="view-actions"><button class="btn btn-primary" id="btn-import">استيراد CSV</button>' +
      '<button class="btn btn-ghost" id="btn-new-rev">مراجعة فارغة جديدة</button></div></div>';

    if (revisions.length === 0) {
      html += '<div class="empty">لا توجد مراجعات BOQ بعد.</div>';
      root.innerHTML = html;
    } else {
      html += '<div class="tabs" id="rev-tabs">' + revisions.map(function (r, i) {
        return '<button data-rev="' + r.id + '" class="' + (i === 0 ? "active" : "") + '">' + esc(r.label) + " " + revBadge(r.status) + "</button>";
      }).join("") + "</div><div id=\"rev-body\"></div>";
      root.innerHTML = html;
      wireTabs(root, project, revisions);
      renderRevisionBody(root.querySelector("#rev-body"), project, revisions[0]);
    }

    root.querySelector("#btn-import").addEventListener("click", function () { openImportDialog(project, boq); });
    root.querySelector("#btn-new-rev").addEventListener("click", function () {
      var label = prompt("تسمية المراجعة:", "مراجعة " + (revisions.length + 1));
      if (!label) return;
      var rev = db.insert("boqRevisions", { boqId: boq.id, label: label, status: "DRAFT" });
      gov.writeAudit({ entityType: "BOQRevision", entityId: rev.id, action: "CREATE", newValue: rev });
      PP.rerender();
    });
  }

  function revBadge(status) {
    var map = { DRAFT: ["badge-muted", "مسودة"], REVIEWED: ["badge-warn", "مراجَعة"], APPROVED: ["badge-good", "معتمدة"] };
    var m = map[status] || ["badge-muted", status];
    return '<span class="badge ' + m[0] + '">' + m[1] + "</span>";
  }

  function wireTabs(root, project, revisions) {
    root.querySelectorAll("#rev-tabs button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        root.querySelectorAll("#rev-tabs button").forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        var rev = revisions.find(function (r) { return r.id === btn.getAttribute("data-rev"); });
        renderRevisionBody(root.querySelector("#rev-body"), project, rev);
      });
    });
  }

  function renderRevisionBody(box, project, rev) {
    var items = db.query("boqItems", function (i) { return i.boqRevisionId === rev.id; });
    var locked = rev.status === "APPROVED";
    var totalAmount = items.reduce(function (s, i) { return s + (i.amount || 0); }, 0);

    var html = '<div class="helper-note">إجمالي عدد البنود: ' + items.length + " · إجمالي القيمة (حيث توفرت الكمية والسعر): " +
      totalAmount.toLocaleString() + "</div>";

    if (!locked) {
      html += '<div class="dialog-actions" style="margin-bottom:10px">' +
        '<button class="btn btn-sm" id="btn-add-item">+ بند يدوي</button>' +
        (items.length > 0 ? '<button class="btn btn-sm btn-primary" id="btn-approve-rev">اعتماد المراجعة</button>' : "") +
        "</div>";
    }

    if (items.length === 0) {
      html += '<div class="empty">لا توجد بنود في هذه المراجعة.</div>';
      box.innerHTML = html;
    } else {
      html += '<div class="table-wrap"><table class="dt"><thead><tr><th>رقم</th><th>الوصف</th><th>الوحدة</th><th class="num">الكمية</th><th class="num">السعر</th><th class="num">القيمة</th><th>القسم</th><th>الحالة</th>' + (locked ? "" : "<th></th>") + "</tr></thead><tbody>";
      items.forEach(function (it) {
        html += "<tr>" +
          "<td>" + esc(it.itemNo || "—") + "</td>" +
          "<td>" + esc(it.description) + "</td>" +
          "<td>" + esc(it.unit || "—") + "</td>" +
          '<td class="num">' + (it.quantity != null ? it.quantity.toLocaleString() : "—") + "</td>" +
          '<td class="num">' + (it.rate != null ? it.rate.toLocaleString() : "—") + "</td>" +
          '<td class="num">' + (it.amount != null ? it.amount.toLocaleString() : "—") + "</td>" +
          "<td>" + esc(it.section || "—") + "</td>" +
          '<td><span class="badge badge-muted">' + esc(it.status) + "</span></td>" +
          (locked ? "" : '<td><button class="btn btn-sm btn-danger" data-del-item="' + it.id + '">حذف</button></td>') +
          "</tr>";
      });
      html += "</tbody></table></div>";
      box.innerHTML = html;
    }

    if (!locked) {
      var addBtn = box.querySelector("#btn-add-item");
      if (addBtn) addBtn.addEventListener("click", function () { openItemDialog(project, rev); });
      var approveBtn = box.querySelector("#btn-approve-rev");
      if (approveBtn) approveBtn.addEventListener("click", function () {
        if (!confirm("اعتماد المراجعة يقفلها من التعديل ويجعلها متاحة للربط في الموديولات التالية. متابعة؟")) return;
        db.update("boqRevisions", rev.id, { status: "APPROVED" });
        gov.writeAudit({ entityType: "BOQRevision", entityId: rev.id, action: "APPROVE" });
        gov.recordDecision({ projectId: project.id, entityType: "BOQRevision", entityId: rev.id, title: "اعتماد مراجعة BOQ", description: "اعتماد " + rev.label + " بعدد " + items.length + " بند." });
        PP.rerender();
      });
      box.querySelectorAll("[data-del-item]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var item = db.get("boqItems", btn.getAttribute("data-del-item"));
          db.remove("boqItems", item.id);
          gov.writeAudit({ entityType: "BOQItem", entityId: item.id, action: "DELETE", oldValue: item });
          renderRevisionBody(box, project, rev);
        });
      });
    }
  }

  function openItemDialog(project, rev) {
    var dlg = document.createElement("dialog");
    dlg.innerHTML = '<div class="dialog-inner"><h3>بند BOQ يدوي</h3>' +
      '<div class="grid-2">' +
      '<div class="field"><label>رقم البند</label><input id="i-no"/></div>' +
      '<div class="field"><label>الوحدة *</label><input id="i-unit" placeholder="m2 / m3 / no"/></div>' +
      "</div>" +
      '<div class="field"><label>الوصف *</label><textarea id="i-desc"></textarea></div>' +
      '<div class="grid-2">' +
      '<div class="field"><label>الكمية</label><input id="i-qty" type="number" step="any"/></div>' +
      '<div class="field"><label>سعر الوحدة</label><input id="i-rate" type="number" step="any"/></div>' +
      "</div>" +
      '<div class="field"><label>القسم/التصنيف</label><input id="i-section"/></div>' +
      '<div class="dialog-actions"><button class="btn btn-primary" id="i-save">حفظ</button><button class="btn btn-ghost" id="i-cancel">إلغاء</button></div></div>';
    document.body.appendChild(dlg);
    dlg.showModal();
    dlg.querySelector("#i-cancel").addEventListener("click", function () { dlg.close(); dlg.remove(); });
    dlg.querySelector("#i-save").addEventListener("click", function () {
      var description = dlg.querySelector("#i-desc").value.trim();
      var unit = dlg.querySelector("#i-unit").value.trim();
      if (!description || !unit) { alert("الوصف والوحدة مطلوبان — لا يُسمح ببند بلا وحدة."); return; }
      var qty = dlg.querySelector("#i-qty").value ? parseFloat(dlg.querySelector("#i-qty").value) : null;
      if (qty !== null && qty < 0) { alert("الكمية لا يمكن أن تكون سالبة."); return; }
      var rate = dlg.querySelector("#i-rate").value ? parseFloat(dlg.querySelector("#i-rate").value) : null;
      var item = db.insert("boqItems", {
        boqRevisionId: rev.id, itemNo: dlg.querySelector("#i-no").value.trim() || null,
        description: description, unit: unit, quantity: qty, rate: rate,
        amount: qty != null && rate != null ? Math.round(qty * rate * 100) / 100 : null,
        section: dlg.querySelector("#i-section").value.trim() || null, status: "DERIVED",
      });
      gov.writeAudit({ entityType: "BOQItem", entityId: item.id, action: "CREATE", newValue: item });
      dlg.close(); dlg.remove();
      PP.rerender();
    });
  }

  function guessMapping(headers) {
    var guesses = {};
    var patterns = {
      itemNo: /item|no\.?$|رقم/i, description: /desc|item description|وصف/i,
      unit: /unit|وحدة/i, quantity: /qty|quantity|كمية/i, rate: /rate|price|سعر/i, section: /section|division|قسم/i,
    };
    SYSTEM_FIELDS.forEach(function (f) {
      var match = headers.find(function (h) { return patterns[f.key] && patterns[f.key].test(h); });
      guesses[f.key] = match || "";
    });
    return guesses;
  }

  function openImportDialog(project, boq) {
    var dlg = document.createElement("dialog");
    dlg.style.width = "min(760px, 94vw)";
    dlg.innerHTML = '<div class="dialog-inner"><h3>استيراد BOQ من CSV</h3>' +
      '<div class="helper-note">هذه النسخة غير المتصلة تدعم CSV مباشرة (بلا اعتمادات خارجية). لو الملف Excel، احفظه كـ CSV UTF-8 أولًا من برنامج الجداول.</div>' +
      '<div class="field"><label>اختر ملف CSV أو الصق المحتوى</label><input id="csv-file" type="file" accept=".csv,text/csv"/></div>' +
      '<div class="field"><textarea id="csv-text" placeholder="أو الصق محتوى CSV هنا" rows="4"></textarea></div>' +
      '<div id="mapping-box"></div>' +
      '<div id="preview-box"></div>' +
      '<div class="dialog-actions"><button class="btn btn-ghost" id="csv-cancel">إغلاق</button></div></div>';
    document.body.appendChild(dlg);
    dlg.showModal();
    dlg.querySelector("#csv-cancel").addEventListener("click", function () { dlg.close(); dlg.remove(); });

    var sheet = null;

    function handleText(text) {
      sheet = util.parseCsv(text);
      renderMapping();
    }

    dlg.querySelector("#csv-file").addEventListener("change", function (e) {
      var file = e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () { handleText(reader.result); };
      reader.readAsText(file);
    });
    dlg.querySelector("#csv-text").addEventListener("change", function (e) {
      if (e.target.value.trim()) handleText(e.target.value);
    });

    function renderMapping() {
      var mapBox = dlg.querySelector("#mapping-box");
      if (!sheet || sheet.headers.length === 0) {
        mapBox.innerHTML = '<div class="helper-note warn">تعذّر التعرف على أعمدة الملف.</div>';
        return;
      }
      var guesses = guessMapping(sheet.headers);
      var html = '<h4 style="margin:14px 0 8px">مطابقة الأعمدة (' + sheet.rows.length + " صف مكتشَف)</h4><div class=\"grid-2\">";
      SYSTEM_FIELDS.forEach(function (f) {
        html += '<div class="field"><label>' + f.label + (f.required ? " *" : "") + '</label><select data-map="' + f.key + '"><option value="">— لا يوجد —</option>' +
          sheet.headers.map(function (h) { return '<option value="' + esc(h) + '" ' + (guesses[f.key] === h ? "selected" : "") + ">" + esc(h) + "</option>"; }).join("") +
          "</select></div>";
      });
      html += "</div><button class=\"btn btn-sm\" id=\"btn-validate\">فحص ومعاينة</button>";
      mapBox.innerHTML = html;
      mapBox.querySelector("#btn-validate").addEventListener("click", runValidation);
    }

    function runValidation() {
      var mapping = {};
      dlg.querySelectorAll("[data-map]").forEach(function (sel) { if (sel.value) mapping[sel.getAttribute("data-map")] = sel.value; });
      if (!mapping.description || !mapping.unit) {
        alert("لا بد من مطابقة عمودي الوصف والوحدة على الأقل.");
        return;
      }
      var result = util.mapAndValidateRows(sheet, mapping, function (mapped, rowIndex) {
        var errors = [];
        var description = (mapped.description || "").toString().trim();
        var unit = (mapped.unit || "").toString().trim();
        var qty = mapped.quantity !== undefined && mapped.quantity !== "" ? parseFloat(mapped.quantity) : null;
        var rate = mapped.rate !== undefined && mapped.rate !== "" ? parseFloat(mapped.rate) : null;
        if (!description) errors.push({ row: rowIndex, field: "description", message: "الوصف مفقود" });
        if (!unit) errors.push({ row: rowIndex, field: "unit", message: "الوحدة مفقودة" });
        if (qty !== null && isNaN(qty)) errors.push({ row: rowIndex, field: "quantity", message: "كمية غير رقمية" });
        if (qty !== null && !isNaN(qty) && qty < 0) errors.push({ row: rowIndex, field: "quantity", message: "كمية سالبة" });
        if (errors.length > 0) return { errors: errors };
        return {
          errors: [],
          value: {
            itemNo: mapped.itemNo || null, description: description, unit: unit,
            quantity: qty, rate: rate,
            amount: qty != null && rate != null && !isNaN(qty) && !isNaN(rate) ? Math.round(qty * rate * 100) / 100 : null,
            section: mapped.section || null, sourceRow: rowIndex, status: "EXTRACTED",
          },
        };
      });

      var box = dlg.querySelector("#preview-box");
      var html = '<div class="helper-note' + (result.errors.length > 0 ? " warn" : "") + '">' +
        "إجمالي: " + result.summary.totalRows + " · صالح: " + result.summary.validRows + " · به أخطاء: " + result.summary.failedRows + "</div>";
      if (result.errors.length > 0) {
        html += '<div class="table-wrap" style="max-height:160px;overflow-y:auto"><table class="dt"><thead><tr><th>الصف</th><th>الحقل</th><th>الخطأ</th></tr></thead><tbody>' +
          result.errors.map(function (e) { return "<tr><td>" + e.row + "</td><td>" + e.field + "</td><td>" + esc(e.message) + "</td></tr>"; }).join("") + "</tbody></table></div>";
      }
      html += '<div class="dialog-actions"><button class="btn btn-primary" id="btn-commit" ' + (result.summary.validRows === 0 ? "disabled" : "") + ">استيراد " + result.summary.validRows + " صف صالح إلى مراجعة جديدة</button></div>";
      box.innerHTML = html;
      var commitBtn = box.querySelector("#btn-commit");
      if (commitBtn) commitBtn.addEventListener("click", function () {
        var label = prompt("تسمية المراجعة الجديدة:", "استيراد CSV " + new Date().toLocaleDateString("en-GB"));
        if (!label) return;
        var rev = db.insert("boqRevisions", { boqId: boq.id, label: label, status: "DRAFT" });
        result.valid.forEach(function (v) { db.insert("boqItems", Object.assign({ boqRevisionId: rev.id }, v)); });
        gov.writeAudit({ entityType: "BOQRevision", entityId: rev.id, action: "IMPORT", newValue: { count: result.valid.length } });
        if (result.errors.length > 0) {
          gov.raiseReviewItem({
            projectId: project.id, kind: "EXTRACTION_FAILED", entityType: "BOQRevision", entityId: rev.id,
            reason: result.errors.length + " صف فشل التحقق أثناء الاستيراد ولم يُدرَج — راجع الملف المصدر.",
          });
        }
        dlg.close(); dlg.remove();
        PP.rerender();
      });
    }
  }

  PP.views = PP.views || {};
  PP.views.boq = { render: render, ensureBoq: ensureBoq };
})();
