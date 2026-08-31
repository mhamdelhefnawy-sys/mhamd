/* M06 — BOQ <-> Activity mapping and quantity reconciliation.
 * Core rule from the roadmap: distributed quantity must equal the original, or the
 * variance is shown as a critical warning and pushed to the review queue — never
 * silently accepted. An explicit, justified override is the only way past it.
 */
(function () {
  "use strict";
  var db = PP.db, gov = PP.gov, util = PP.util, esc = PP.util.escapeHtml;
  var EPS = 0.005;

  function reconciliation(project) {
    var boq = db.query("boqs", function (b) { return b.projectId === project.id; })[0];
    var revision = boq ? db.query("boqRevisions", function (r) { return r.boqId === boq.id && r.status === "APPROVED"; })[0] : null;
    if (!revision) return { revision: null, rows: [], unresolvedCount: 0 };

    var items = db.query("boqItems", function (i) { return i.boqRevisionId === revision.id; });
    var rows = items.map(function (item) {
      var mappings = db.query("boqMappings", function (m) { return m.boqItemId === item.id; });
      var distributed = Math.round(mappings.reduce(function (s, m) { return s + (m.quantity || 0); }, 0) * 1000) / 1000;
      var remaining = item.quantity != null ? Math.round((item.quantity - distributed) * 1000) / 1000 : null;
      var balanced = item.quantity == null ? true : Math.abs(remaining) < EPS;
      var overridden = !!item.varianceOverrideReason;
      return { item: item, mappings: mappings, distributed: distributed, remaining: remaining, balanced: balanced, overridden: overridden };
    });
    var unresolvedCount = rows.filter(function (r) { return !r.balanced && !r.overridden; }).length;
    return { revision: revision, rows: rows, unresolvedCount: unresolvedCount };
  }

  // Keeps the review queue in sync with live reconciliation state instead of spamming
  // a new entry on every render: raises one OPEN item per unresolved BOQItem, and
  // auto-resolves it the moment the item becomes balanced or is explicitly overridden.
  function syncReviewForItem(project, row) {
    if (!row.balanced && !row.overridden) {
      gov.raiseReviewItemOnce({
        projectId: project.id, kind: "UNRESOLVED_VARIANCE", entityType: "BOQItem", entityId: row.item.id,
        reason: 'الكمية الموزَّعة (' + row.distributed + ') لا تساوي الكمية الأصلية (' + row.item.quantity + ') للبند "' + row.item.description + '"',
      });
    } else {
      db.query("reviewQueue", function (r) { return r.status === "OPEN" && r.kind === "UNRESOLVED_VARIANCE" && r.entityId === row.item.id; })
        .forEach(function (r) { gov.resolveReviewItem(r.id, row.overridden ? "قُبل الفارق مع تبرير" : "أصبحت الكمية متزنة"); });
    }
  }

  function render(root, project) {
    var rec = reconciliation(project);
    var html = '<div class="view-head"><div><h2>الربط وتوزيع الكميات</h2>' +
      "<p>M06 — تتبع ثنائي الاتجاه بين بنود BOQ والأنشطة، مع تسوية إلزامية: الأصل = الموزَّع + المتبقي.</p></div></div>";

    if (!rec.revision) {
      html += '<div class="helper-note warn">يلزم اعتماد مراجعة BOQ أولًا — <a href="#/project/' + project.id + '/boq">اذهب إلى BOQ</a>.</div>';
      root.innerHTML = html;
      return;
    }

    rec.rows.forEach(function (row) { syncReviewForItem(project, row); });

    if (rec.unresolvedCount > 0) {
      html += '<div class="helper-note warn"><b>تحذير حرج:</b> ' + rec.unresolvedCount + ' بند BOQ غير متزن (الكمية الموزَّعة ≠ الأصلية). لن تُعتبر بوابة الربط ناجحة حتى تتم التسوية أو قبول الاستثناء.</div>';
    }

    html += '<div class="table-wrap"><table class="dt"><thead><tr><th>رقم البند</th><th>الوصف</th><th>الوحدة</th><th class="num">الأصلية</th><th class="num">الموزَّعة</th><th class="num">المتبقي</th><th>الحالة</th><th></th></tr></thead><tbody>';
    rec.rows.forEach(function (row) {
      var statusBadge = row.balanced
        ? '<span class="badge badge-good">متزن</span>'
        : row.overridden
          ? '<span class="badge badge-warn">استثناء مقبول</span>'
          : '<span class="badge badge-bad">غير متزن</span>';
      html += "<tr>" +
        "<td>" + esc(row.item.itemNo || "—") + "</td>" +
        "<td>" + esc(row.item.description) + "</td>" +
        "<td>" + esc(row.item.unit || "—") + "</td>" +
        '<td class="num">' + (row.item.quantity != null ? row.item.quantity.toLocaleString() : "—") + "</td>" +
        '<td class="num">' + row.distributed.toLocaleString() + "</td>" +
        '<td class="num">' + (row.remaining != null ? row.remaining.toLocaleString() : "—") + "</td>" +
        "<td>" + statusBadge + " <span class=\"badge badge-muted\">" + row.mappings.length + " ربط</span></td>" +
        '<td><button class="btn btn-sm" data-detail="' + row.item.id + '">تفاصيل الربط</button></td>' +
        "</tr>";
    });
    html += "</tbody></table></div>";
    root.innerHTML = html;
    root.querySelectorAll("[data-detail]").forEach(function (btn) {
      btn.addEventListener("click", function () { openItemDialog(project, btn.getAttribute("data-detail")); });
    });
  }

  function openItemDialog(project, itemId) {
    var dlg = document.createElement("dialog");
    dlg.style.width = "min(700px, 94vw)";
    document.body.appendChild(dlg);
    renderDialogBody(dlg, project, itemId);
    dlg.showModal();
  }

  function renderDialogBody(dlg, project, itemId) {
    var rec = reconciliation(project);
    var row = rec.rows.find(function (r) { return r.item.id === itemId; });
    var item = row.item;

    var html = '<div class="dialog-inner"><h3>ربط: ' + esc(item.description) + "</h3>" +
      '<div class="helper-note">الأصلية: ' + (item.quantity != null ? item.quantity.toLocaleString() : "—") +
      " " + esc(item.unit || "") + " · الموزَّعة: " + row.distributed.toLocaleString() +
      " · المتبقي: " + (row.remaining != null ? row.remaining.toLocaleString() : "—") + "</div>";

    if (!row.balanced) {
      html += row.overridden
        ? '<div class="helper-note warn">استثناء مقبول: ' + esc(item.varianceOverrideReason) + " — بواسطة " + esc(item.varianceOverrideBy || "") +
          '. <button class="btn btn-sm" id="clear-override" style="margin-inline-start:8px">إزالة القبول</button></div>'
        : '<div class="helper-note warn"><b>تحذير حرج — الكمية غير متزنة.</b> <button class="btn btn-sm" id="btn-override" style="margin-inline-start:8px">قبول الفارق مع تبرير</button></div>';
    }

    html += '<div class="table-wrap"><table class="dt"><thead><tr><th>النشاط</th><th>WBS</th><th class="num">الكمية</th><th></th></tr></thead><tbody>';
    if (row.mappings.length === 0) {
      html += '<tr><td colspan="4" style="text-align:center;color:var(--ink-faint)">لا توجد روابط بعد</td></tr>';
    }
    row.mappings.forEach(function (m) {
      var act = db.get("activities", m.activityId);
      var node = act && act.wbsNodeId ? db.get("wbsNodes", act.wbsNodeId) : null;
      html += "<tr><td>" + (act ? esc(act.code) + " — " + esc(act.name) : "<em>نشاط محذوف</em>") + "</td>" +
        "<td>" + (node ? '<span class="badge badge-accent">' + esc(node.code) + "</span>" : "—") + "</td>" +
        '<td class="num"><input type="number" step="any" style="width:90px" data-qty="' + m.id + '" value="' + m.quantity + '"/></td>' +
        '<td><button class="btn btn-sm" data-save-qty="' + m.id + '">حفظ</button> <button class="btn btn-sm btn-danger" data-del-map="' + m.id + '">حذف</button></td></tr>';
    });
    html += "</tbody></table></div>";

    var projectActivities = db.query("activities", function (a) { return a.projectId === project.id; });
    var alreadyLinked = new Set(row.mappings.map(function (m) { return m.activityId; }));
    var candidates = projectActivities.filter(function (a) { return !alreadyLinked.has(a.id); });
    var approvedWbs = db.query("wbsVersions", function (v) {
      var wbs = db.get("wbsList", v.wbsId);
      return wbs && wbs.projectId === project.id && v.status === "APPROVED";
    })[0];
    var nodes = approvedWbs ? db.query("wbsNodes", function (n) { return n.wbsVersionId === approvedWbs.id; }) : [];
    var suggestedQty = row.remaining != null ? Math.max(row.remaining, 0) : "";

    html += '<h4 style="margin:16px 0 8px">إضافة ربط</h4><div class="grid-2">' +
      '<div class="field"><label>ربط بنشاط موجود</label><select id="map-existing"><option value="">— اختر —</option>' +
      candidates.map(function (a) { return '<option value="' + a.id + '">' + esc(a.code) + " — " + esc(a.name) + "</option>"; }).join("") + "</select></div>" +
      '<div class="field"><label>الكمية</label><input id="map-qty" type="number" step="any" value="' + suggestedQty + '"/></div>' +
      "</div><button class=\"btn btn-sm\" id=\"btn-link-existing\">ربط</button>" +
      '<hr style="border-color:var(--border);margin:16px 0"/>' +
      "<div class=\"grid-2\">" +
      '<div class="field"><label>أو إنشاء نشاط جديد بهذا الربط</label><input id="new-act-name" value="' + esc(item.description) + '"/></div>' +
      '<div class="field"><label>عقدة WBS' + (nodes.length === 0 ? " (لا توجد نسخة معتمدة)" : "") + '</label><select id="new-act-wbs" ' + (nodes.length === 0 ? "disabled" : "") + '><option value="">— غير مربوط —</option>' +
      nodes.map(function (n) { return '<option value="' + n.id + '">' + esc(n.code) + " · " + esc(n.name) + "</option>"; }).join("") + "</select></div>" +
      '<div class="field"><label>الكمية</label><input id="new-act-qty" type="number" step="any" value="' + suggestedQty + '"/></div>' +
      "</div><button class=\"btn btn-sm btn-primary\" id=\"btn-create-link\">إنشاء وربط</button>" +
      '<div class="dialog-actions"><button class="btn btn-ghost" id="dlg-close">إغلاق</button></div></div>';

    dlg.innerHTML = html;
    wireDialog(dlg, project, itemId);
  }

  function wireDialog(dlg, project, itemId) {
    dlg.querySelector("#dlg-close").addEventListener("click", function () { dlg.close(); dlg.remove(); PP.rerender(); });

    dlg.querySelectorAll("[data-save-qty]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-save-qty");
        var input = dlg.querySelector('[data-qty="' + id + '"]');
        var qty = parseFloat(input.value);
        if (isNaN(qty) || qty < 0) { alert("كمية غير صالحة."); return; }
        var mapping = db.get("boqMappings", id);
        db.update("boqMappings", id, { quantity: qty, source: "MANUAL" });
        var act = db.get("activities", mapping.activityId);
        if (act) db.update("activities", act.id, { quantity: qty });
        gov.writeAudit({ entityType: "BOQMapping", entityId: id, action: "UPDATE_QUANTITY", newValue: { quantity: qty } });
        renderDialogBody(dlg, project, itemId);
      });
    });
    dlg.querySelectorAll("[data-del-map]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (!confirm("حذف هذا الربط؟ الكمية سترجع للمتبقي غير الموزَّع.")) return;
        var id = btn.getAttribute("data-del-map");
        var mapping = db.get("boqMappings", id);
        db.remove("boqMappings", id);
        gov.writeAudit({ entityType: "BOQMapping", entityId: id, action: "DELETE", oldValue: mapping });
        renderDialogBody(dlg, project, itemId);
      });
    });

    var overrideBtn = dlg.querySelector("#btn-override");
    if (overrideBtn) overrideBtn.addEventListener("click", function () {
      var reason = prompt("سبب قبول الفارق (سيُسجَّل في سجل القرارات):");
      if (!reason) return;
      db.update("boqItems", itemId, { varianceOverrideReason: reason, varianceOverrideBy: gov.currentActor(), varianceOverrideAt: new Date().toISOString() });
      gov.recordDecision({ projectId: project.id, entityType: "BOQItem", entityId: itemId, title: "قبول فارق كمية غير متزنة", description: reason });
      gov.writeAudit({ entityType: "BOQItem", entityId: itemId, action: "OVERRIDE_VARIANCE", reason: reason });
      renderDialogBody(dlg, project, itemId);
    });
    var clearBtn = dlg.querySelector("#clear-override");
    if (clearBtn) clearBtn.addEventListener("click", function () {
      db.update("boqItems", itemId, { varianceOverrideReason: null, varianceOverrideBy: null, varianceOverrideAt: null });
      renderDialogBody(dlg, project, itemId);
    });

    dlg.querySelector("#btn-link-existing").addEventListener("click", function () {
      var activityId = dlg.querySelector("#map-existing").value;
      var qty = parseFloat(dlg.querySelector("#map-qty").value);
      if (!activityId) { alert("اختر نشاطًا."); return; }
      if (isNaN(qty) || qty < 0) { alert("كمية غير صالحة."); return; }
      var mapping = db.insert("boqMappings", { boqItemId: itemId, activityId: activityId, quantity: qty, source: "MANUAL" });
      gov.writeAudit({ entityType: "BOQMapping", entityId: mapping.id, action: "CREATE", newValue: mapping });
      renderDialogBody(dlg, project, itemId);
    });

    dlg.querySelector("#btn-create-link").addEventListener("click", function () {
      var name = dlg.querySelector("#new-act-name").value.trim();
      var wbsNodeId = dlg.querySelector("#new-act-wbs").value || null;
      var qty = parseFloat(dlg.querySelector("#new-act-qty").value);
      if (!name) { alert("اسم النشاط مطلوب."); return; }
      if (isNaN(qty) || qty < 0) { alert("كمية غير صالحة."); return; }
      var item = db.get("boqItems", itemId);
      var seq = db.query("activities", function (a) { return a.projectId === project.id; }).length + 1;
      var activity = db.insert("activities", {
        projectId: project.id, wbsNodeId: wbsNodeId, dictionaryItemId: null,
        code: project.code + "-ACT-" + String(seq).padStart(4, "0"), name: name,
        unit: item.unit, quantity: qty, durationDays: null, status: "USER_EDITED",
        confidenceScore: null, confidenceFactors: null, confidenceRationale: null,
      });
      var mapping = db.insert("boqMappings", { boqItemId: itemId, activityId: activity.id, quantity: qty, source: "MANUAL_SPLIT" });
      gov.writeAudit({ entityType: "Activity", entityId: activity.id, action: "CREATE_FROM_MAPPING" });
      gov.writeAudit({ entityType: "BOQMapping", entityId: mapping.id, action: "CREATE", newValue: mapping });
      renderDialogBody(dlg, project, itemId);
    });
  }

  PP.views = PP.views || {};
  PP.views.mapping = { render: render, reconciliation: reconciliation };
})();
