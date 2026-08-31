/* M02 — Documents & knowledge base.
 * Offline scope: real metadata, revisions, and SHA-256 verification for uploaded
 * files. Text/AI extraction from PDF/DOCX is NOT implemented in this offline build
 * (would require vendoring parser libraries) — every revision is marked honestly as
 * "NOT_AUTOMATED" rather than faking an extraction result. CSV-based structured data
 * (BOQ) goes through M03's real importer instead.
 */
(function () {
  "use strict";
  var db = PP.db, gov = PP.gov, util = PP.util, esc = PP.util.escapeHtml;

  var DOC_TYPES = ["BOQ", "DRAWING", "SPECIFICATION", "CONTRACT", "METHOD_STATEMENT", "OTHER"];

  function render(root, project) {
    var docs = db.query("documents", function (d) { return d.projectId === project.id; });
    var html = '<div class="view-head"><div><h2>المستندات</h2>' +
      "<p>M02 — تسجيل المستندات وإصداراتها مع تحقق SHA-256. لا يوجد استخراج نصوص/AI تلقائي في هذه النسخة غير المتصلة — كل إصدار يُعلَّم صراحة NOT_AUTOMATED بدل ادّعاء استخراج وهمي.</p></div>" +
      '<div class="view-actions"><button class="btn btn-primary" id="btn-new-doc">+ مستند جديد</button></div></div>';

    if (docs.length === 0) {
      html += '<div class="empty">لا توجد مستندات مسجَّلة لهذا المشروع بعد.</div>';
      root.innerHTML = html;
      root.querySelector("#btn-new-doc").addEventListener("click", function () { openDocDialog(project); });
      return;
    }

    docs.forEach(function (doc) {
      html += docCard(doc);
    });
    root.innerHTML = html;
    root.querySelector("#btn-new-doc").addEventListener("click", function () { openDocDialog(project); });
    wireCards(root, project);
  }

  function docCard(doc) {
    var revisions = db.query("documentRevisions", function (r) { return r.documentId === doc.id; });
    var html = '<div class="card" data-doc="' + doc.id + '"><h3>' + esc(doc.fileNameBase) +
      ' <span class="badge badge-accent">' + esc(doc.documentType || "OTHER") + "</span></h3>" +
      '<p style="font-size:12.5px;color:var(--ink-soft);margin:0 0 10px">' +
      [doc.discipline, doc.relatedBuilding, doc.relatedFloor].filter(Boolean).map(esc).join(" · ") + "</p>";

    if (revisions.length === 0) {
      html += '<div class="helper-note">لا توجد إصدارات بعد.</div>';
    } else {
      html += '<div class="table-wrap"><table class="dt"><thead><tr><th>الإصدار</th><th>SHA-256</th><th>الحجم</th><th>النوع</th><th>حالة الاستخراج</th><th>تاريخ الرفع</th><th></th></tr></thead><tbody>';
      revisions.forEach(function (r) {
        html += "<tr><td>" + esc(r.revisionLabel) + '</td><td class="mono">' + esc((r.sha256 || "").slice(0, 12)) + "…</td>" +
          '<td class="num">' + (r.sizeBytes ? (r.sizeBytes / 1024).toFixed(1) + " KB" : "—") + "</td>" +
          "<td>" + esc(r.mimeType || "—") + "</td>" +
          '<td><span class="badge badge-muted">' + esc(r.extractionStatus) + "</span></td>" +
          "<td>" + util.formatDate(r.uploadedAt) + "</td>" +
          '<td><button class="btn btn-sm btn-danger" data-del-rev="' + r.id + '">حذف</button></td></tr>';
      });
      html += "</tbody></table></div>";
    }
    html += '<div class="dialog-actions" style="margin-top:10px">' +
      '<button class="btn btn-sm" data-add-rev="' + doc.id + '">+ إصدار جديد</button>' +
      '<button class="btn btn-sm btn-danger" data-del-doc="' + doc.id + '">حذف المستند</button></div></div>';
    return html;
  }

  function wireCards(root, project) {
    root.querySelectorAll("[data-add-rev]").forEach(function (btn) {
      btn.addEventListener("click", function () { openRevisionDialog(project, btn.getAttribute("data-add-rev")); });
    });
    root.querySelectorAll("[data-del-rev]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (!confirm("حذف هذا الإصدار؟ هذا الإجراء يُسجَّل في سجل التدقيق.")) return;
        var rev = db.get("documentRevisions", btn.getAttribute("data-del-rev"));
        db.remove("documentRevisions", rev.id);
        gov.writeAudit({ entityType: "DocumentRevision", entityId: rev.id, action: "DELETE", oldValue: rev });
        render(root, project);
      });
    });
    root.querySelectorAll("[data-del-doc]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (!confirm("حذف المستند وكل إصداراته؟")) return;
        var id = btn.getAttribute("data-del-doc");
        db.query("documentRevisions", function (r) { return r.documentId === id; }).forEach(function (r) { db.remove("documentRevisions", r.id); });
        var doc = db.get("documents", id);
        db.remove("documents", id);
        gov.writeAudit({ entityType: "Document", entityId: id, action: "DELETE", oldValue: doc });
        render(root, project);
      });
    });
  }

  function openDocDialog(project) {
    var dlg = document.createElement("dialog");
    dlg.innerHTML = '<div class="dialog-inner"><h3>مستند جديد</h3>' +
      '<div class="field"><label>اسم المستند *</label><input id="d-name" placeholder="ARC-101 مخطط الدور الأرضي"/></div>' +
      '<div class="grid-2">' +
      '<div class="field"><label>نوع المستند</label><select id="d-type">' + DOC_TYPES.map(function (t) { return '<option value="' + t + '">' + t + "</option>"; }).join("") + "</select></div>" +
      '<div class="field"><label>التخصص</label><input id="d-discipline" placeholder="معماري / إنشائي / MEP"/></div>' +
      '<div class="field"><label>المبنى</label><input id="d-building"/></div>' +
      '<div class="field"><label>الطابق</label><input id="d-floor"/></div>' +
      "</div>" +
      '<div class="dialog-actions"><button class="btn btn-primary" id="d-save">حفظ</button><button class="btn btn-ghost" id="d-cancel">إلغاء</button></div></div>';
    document.body.appendChild(dlg);
    dlg.showModal();
    dlg.querySelector("#d-cancel").addEventListener("click", function () { dlg.close(); dlg.remove(); });
    dlg.querySelector("#d-save").addEventListener("click", function () {
      var name = dlg.querySelector("#d-name").value.trim();
      if (!name) { alert("اسم المستند مطلوب."); return; }
      var doc = db.insert("documents", {
        projectId: project.id, fileNameBase: name,
        documentType: dlg.querySelector("#d-type").value,
        discipline: dlg.querySelector("#d-discipline").value.trim() || null,
        relatedBuilding: dlg.querySelector("#d-building").value.trim() || null,
        relatedFloor: dlg.querySelector("#d-floor").value.trim() || null,
      });
      gov.writeAudit({ entityType: "Document", entityId: doc.id, action: "CREATE", newValue: doc });
      dlg.close(); dlg.remove();
      PP.rerender();
    });
  }

  async function hashFile(file) {
    try {
      var buffer = await file.arrayBuffer();
      var digest = await crypto.subtle.digest("SHA-256", buffer);
      return Array.from(new Uint8Array(digest)).map(function (b) { return b.toString(16).padStart(2, "0"); }).join("");
    } catch (e) {
      // Fallback if Web Crypto is unavailable in this browser/context: a simple, clearly
      // non-cryptographic checksum, labeled as such rather than pretending it's SHA-256.
      var text = file.name + ":" + file.size + ":" + file.lastModified;
      var h = 0;
      for (var i = 0; i < text.length; i++) { h = (h * 31 + text.charCodeAt(i)) | 0; }
      return "checksum-fallback-" + (h >>> 0).toString(16);
    }
  }

  function openRevisionDialog(project, documentId) {
    var existing = db.query("documentRevisions", function (r) { return r.documentId === documentId; }).length;
    var dlg = document.createElement("dialog");
    dlg.innerHTML = '<div class="dialog-inner"><h3>إصدار جديد</h3>' +
      '<div class="field"><label>تسمية الإصدار *</label><input id="r-label" value="Rev ' + existing + '"/></div>' +
      '<div class="field"><label>الملف (اختياري — يُحسب SHA-256 والحجم فقط، لا يُخزَّن المحتوى في هذه النسخة غير المتصلة)</label><input id="r-file" type="file"/></div>' +
      '<div class="field"><label>ملاحظة / مسار مرجعي</label><input id="r-note" placeholder="مكان الملف الفعلي إن وُجد"/></div>' +
      '<div class="dialog-actions"><button class="btn btn-primary" id="r-save">حفظ</button><button class="btn btn-ghost" id="r-cancel">إلغاء</button></div></div>';
    document.body.appendChild(dlg);
    dlg.showModal();
    dlg.querySelector("#r-cancel").addEventListener("click", function () { dlg.close(); dlg.remove(); });
    dlg.querySelector("#r-save").addEventListener("click", async function () {
      var label = dlg.querySelector("#r-label").value.trim();
      if (!label) { alert("تسمية الإصدار مطلوبة."); return; }
      if (db.query("documentRevisions", function (r) { return r.documentId === documentId && r.revisionLabel === label; }).length > 0) {
        alert("توجد بالفعل تسمية إصدار مطابقة لهذا المستند — الإصدارات لا تُستبدل، استخدم تسمية جديدة.");
        return;
      }
      var file = dlg.querySelector("#r-file").files[0];
      var note = dlg.querySelector("#r-note").value.trim() || null;
      var saveBtn = dlg.querySelector("#r-save");
      saveBtn.disabled = true; saveBtn.textContent = "جارٍ الحساب…";
      var hash = null, size = null, mime = null;
      if (file) { hash = await hashFile(file); size = file.size; mime = file.type || "application/octet-stream"; }
      var rev = db.insert("documentRevisions", {
        documentId: documentId, revisionLabel: label,
        storedPath: note, mimeType: mime, sizeBytes: size, sha256: hash,
        uploadedBy: gov.currentActor(), uploadedAt: new Date().toISOString(),
        extractionStatus: "NOT_AUTOMATED",
      });
      gov.writeAudit({ entityType: "DocumentRevision", entityId: rev.id, action: "CREATE", newValue: rev });
      dlg.close(); dlg.remove();
      PP.rerender();
    });
  }

  PP.views = PP.views || {};
  PP.views.documents = { render: render };
})();
