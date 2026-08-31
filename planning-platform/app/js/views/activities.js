/* M05 — Activity dictionary + rule-based (NOT AI) generation engine, with bulk review. */
(function () {
  "use strict";
  var db = PP.db, gov = PP.gov, util = PP.util, esc = PP.util.escapeHtml;
  var conf = PP.confidence;

  function statusBadge(status) {
    var map = {
      PROPOSED: ["badge-accent", "مقترح"], USER_EDITED: ["badge-warn", "معدَّل يدويًا"],
      APPROVED: ["badge-good", "معتمد"], OVERRIDDEN: ["badge-warn", "استثناء مقبول"],
    };
    var m = map[status] || ["badge-muted", status];
    return '<span class="badge ' + m[0] + '">' + m[1] + "</span>";
  }

  function render(root, project) {
    var html = '<div class="tabs" id="act-tabs">' +
      '<button data-tab="activities" class="active">الأنشطة</button>' +
      '<button data-tab="dictionary">قاموس الأنشطة</button>' +
      "</div><div id=\"act-body\"></div>";
    root.innerHTML = html;
    root.querySelectorAll("#act-tabs button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        root.querySelectorAll("#act-tabs button").forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        if (btn.getAttribute("data-tab") === "activities") renderActivities(root.querySelector("#act-body"), project);
        else renderDictionary(root.querySelector("#act-body"), project);
      });
    });
    renderActivities(root.querySelector("#act-body"), project);
  }

  // ---------------- activities tab ----------------
  function renderActivities(box, project) {
    var activities = db.query("activities", function (a) { return a.projectId === project.id; });
    var approvedBoqRevs = db.query("boqRevisions", function (r) {
      var boq = db.get("boqs", r.boqId);
      return boq && boq.projectId === project.id && r.status === "APPROVED";
    });

    var html = '<div class="view-head"><div><h2>الأنشطة</h2>' +
      "<p>M05 — توليد قائم على قواعد حتمية (مطابقة كلمات مفتاحية) لا ذكاء اصطناعي، مع ثقة متعددة العوامل ومراجعة قبل الاعتماد.</p></div>" +
      '<div class="view-actions"><button class="btn btn-primary" id="btn-generate" ' + (approvedBoqRevs.length === 0 ? "disabled title=\"يلزم اعتماد مراجعة BOQ أولًا\"" : "") + ">توليد من BOQ معتمد</button></div></div>";

    if (approvedBoqRevs.length === 0) {
      html += '<div class="helper-note warn">لا توجد مراجعة BOQ معتمدة بعد — اعتمد مراجعة من موديول BOQ أولًا (Mapping Gate).</div>';
    }

    if (activities.length === 0) {
      html += '<div class="empty">لا توجد أنشطة بعد.</div>';
      box.innerHTML = html;
    } else {
      var wbsNodes = {};
      db.all("wbsNodes").forEach(function (n) { wbsNodes[n.id] = n; });
      html += '<div class="dialog-actions" style="margin-bottom:10px">' +
        '<button class="btn btn-sm" id="btn-approve-selected">اعتماد المحدد</button>' +
        '<button class="btn btn-sm btn-danger" id="btn-delete-selected">حذف المحدد</button></div>';
      html += '<div class="table-wrap"><table class="dt"><thead><tr><th></th><th>الكود</th><th>الاسم</th><th>WBS</th><th>الوحدة</th><th class="num">الكمية</th><th class="num">المدة</th><th>الثقة</th><th>الحالة</th><th></th></tr></thead><tbody>';
      activities.forEach(function (a) {
        var node = a.wbsNodeId ? wbsNodes[a.wbsNodeId] : null;
        var confBadge = a.confidenceScore == null ? "—" :
          '<span class="badge ' + (a.confidenceScore < conf.LOW_CONFIDENCE_THRESHOLD ? "badge-warn" : "badge-good") + '">' + Math.round(a.confidenceScore * 100) + "%</span>";
        html += "<tr>" +
          '<td><input type="checkbox" class="act-select" value="' + a.id + '"/></td>' +
          '<td class="mono">' + esc(a.code) + "</td>" +
          "<td>" + esc(a.name) + "</td>" +
          "<td>" + (node ? '<span class="badge badge-accent">' + esc(node.code) + "</span>" : '<span class="badge badge-warn">غير مربوط</span>') + "</td>" +
          "<td>" + esc(a.unit || "—") + "</td>" +
          '<td class="num">' + (a.quantity != null ? a.quantity.toLocaleString() : "—") + "</td>" +
          '<td class="num">' + (a.durationDays != null ? a.durationDays : "—") + "</td>" +
          "<td>" + confBadge + "</td>" +
          "<td>" + statusBadge(a.status) + "</td>" +
          '<td><button class="btn btn-sm" data-edit-act="' + a.id + '">تعديل</button></td>' +
          "</tr>";
      });
      html += "</tbody></table></div>";
      box.innerHTML = html;

      box.querySelector("#btn-approve-selected").addEventListener("click", function () {
        selected(box).forEach(function (id) { approveActivity(project, id); });
        renderActivities(box, project);
      });
      box.querySelector("#btn-delete-selected").addEventListener("click", function () {
        var ids = selected(box);
        if (ids.length === 0) return;
        if (!confirm("حذف " + ids.length + " نشاط؟")) return;
        ids.forEach(function (id) {
          var a = db.get("activities", id);
          db.remove("activities", id);
          gov.writeAudit({ entityType: "Activity", entityId: id, action: "DELETE", oldValue: a });
        });
        renderActivities(box, project);
      });
      box.querySelectorAll("[data-edit-act]").forEach(function (btn) {
        btn.addEventListener("click", function () { openActivityDialog(project, db.get("activities", btn.getAttribute("data-edit-act"))); });
      });
    }
    box.querySelector("#btn-generate")?.addEventListener("click", function () { openGenerateDialog(project, approvedBoqRevs); });
  }

  function selected(box) {
    return Array.from(box.querySelectorAll(".act-select:checked")).map(function (c) { return c.value; });
  }

  function snapshotVersion(activity, reason) {
    var count = db.query("activityVersions", function (v) { return v.activityId === activity.id; }).length;
    db.insert("activityVersions", {
      activityId: activity.id, versionNumber: count, snapshot: JSON.stringify(activity),
      changedBy: gov.currentActor(), changeReason: reason || null,
    });
  }

  function approveActivity(project, id) {
    var a = db.get("activities", id);
    if (!a.wbsNodeId) { alert('النشاط "' + a.name + '" غير مربوط بعقدة WBS — اربطه أولًا (زر تعديل).'); return; }
    snapshotVersion(a, "APPROVE");
    var lowConf = a.confidenceScore != null && a.confidenceScore < conf.LOW_CONFIDENCE_THRESHOLD;
    db.update("activities", id, { status: lowConf ? "OVERRIDDEN" : "APPROVED" });
    gov.writeAudit({ entityType: "Activity", entityId: id, action: "APPROVE" });
    if (lowConf) {
      gov.recordDecision({
        projectId: project.id, entityType: "Activity", entityId: id,
        title: "اعتماد نشاط بثقة منخفضة", description: 'اعتماد "' + a.name + '" رغم ثقة ' + Math.round(a.confidenceScore * 100) + "%",
        evidence: JSON.parse(a.confidenceFactors || "{}"),
      });
    }
  }

  function openActivityDialog(project, activity) {
    var approvedWbs = db.query("wbsVersions", function (v) {
      var wbs = db.get("wbsList", v.wbsId);
      return wbs && wbs.projectId === project.id && v.status === "APPROVED";
    })[0];
    var nodes = approvedWbs ? db.query("wbsNodes", function (n) { return n.wbsVersionId === approvedWbs.id; }) : [];

    var dlg = document.createElement("dialog");
    dlg.style.width = "min(620px, 94vw)";
    var factorsHtml = "";
    if (activity.confidenceFactors) {
      var f = JSON.parse(activity.confidenceFactors);
      var rationale = JSON.parse(activity.confidenceRationale || "[]");
      factorsHtml = '<div class="helper-note"><b>أساس الثقة (' + Math.round((activity.confidenceScore || 0) * 100) + '%):</b><br/>' + rationale.map(esc).join("<br/>") + "</div>";
    }
    dlg.innerHTML = '<div class="dialog-inner"><h3>' + esc(activity.name) + " " + statusBadge(activity.status) + "</h3>" +
      factorsHtml +
      '<div class="field"><label>الاسم *</label><input id="a-name" value="' + esc(activity.name) + '"/></div>' +
      '<div class="grid-2">' +
      '<div class="field"><label>عقدة WBS' + (nodes.length === 0 ? " (لا توجد نسخة WBS معتمدة)" : "") + '</label><select id="a-wbs" ' + (nodes.length === 0 ? "disabled" : "") + '><option value="">— غير مربوط —</option>' +
      nodes.map(function (n) { return '<option value="' + n.id + '" ' + (activity.wbsNodeId === n.id ? "selected" : "") + ">" + esc(n.code) + " · " + esc(n.name) + "</option>"; }).join("") + "</select></div>" +
      '<div class="field"><label>الوحدة</label><input id="a-unit" value="' + esc(activity.unit || "") + '"/></div>' +
      '<div class="field"><label>الكمية</label><input id="a-qty" type="number" step="any" value="' + (activity.quantity ?? "") + '"/></div>' +
      '<div class="field"><label>المدة (أيام)</label><input id="a-dur" type="number" step="any" value="' + (activity.durationDays ?? "") + '"/></div>' +
      "</div>" +
      '<div class="dialog-actions"><button class="btn btn-primary" id="a-save">حفظ</button>' +
      '<button class="btn btn-ghost" id="a-approve">اعتماد</button>' +
      '<button class="btn btn-ghost" id="a-cancel">إغلاق</button></div></div>';
    document.body.appendChild(dlg);
    dlg.showModal();
    dlg.querySelector("#a-cancel").addEventListener("click", function () { dlg.close(); dlg.remove(); });
    function collectPatch() {
      return {
        name: dlg.querySelector("#a-name").value.trim(),
        wbsNodeId: dlg.querySelector("#a-wbs").value || null,
        unit: dlg.querySelector("#a-unit").value.trim() || null,
        quantity: dlg.querySelector("#a-qty").value ? parseFloat(dlg.querySelector("#a-qty").value) : null,
        durationDays: dlg.querySelector("#a-dur").value ? parseFloat(dlg.querySelector("#a-dur").value) : null,
      };
    }
    function applyPatch(extraStatus) {
      var before = Object.assign({}, activity);
      var patch = collectPatch();
      patch.status = extraStatus || (activity.status === "PROPOSED" ? "USER_EDITED" : activity.status);
      db.update("activities", activity.id, patch);
      snapshotVersion(Object.assign({}, activity, patch), extraStatus ? "EDIT+" + extraStatus : "EDIT");
      gov.writeAudit({ entityType: "Activity", entityId: activity.id, action: "UPDATE", oldValue: before, newValue: patch });
      return db.get("activities", activity.id);
    }
    dlg.querySelector("#a-save").addEventListener("click", function () {
      applyPatch();
      dlg.close(); dlg.remove();
      PP.rerender();
    });
    dlg.querySelector("#a-approve").addEventListener("click", function () {
      // Approving from the edit dialog must first persist whatever is on the form
      // (e.g. a WBS assignment just picked) — approving stale saved state would silently
      // discard the edit, which is exactly the "no silent choice" principle applied here.
      applyPatch();
      approveActivity(project, activity.id);
      dlg.close(); dlg.remove();
      PP.rerender();
    });
  }

  function openGenerateDialog(project, approvedBoqRevs) {
    var dlg = document.createElement("dialog");
    dlg.innerHTML = '<div class="dialog-inner"><h3>توليد الأنشطة</h3>' +
      '<div class="field"><label>مراجعة BOQ المصدر</label><select id="g-rev">' +
      approvedBoqRevs.map(function (r) { return '<option value="' + r.id + '">' + esc(r.label) + "</option>"; }).join("") + "</select></div>" +
      '<div class="helper-note">كل بند BOQ يُطابَق مع أفضل عنصر في القاموس بناءً على الكلمات المفتاحية والوحدة. البنود بلا تطابق تُرسَل لصندوق المراجعة بدل توليد نشاط وهمي.</div>' +
      '<div class="dialog-actions"><button class="btn btn-primary" id="g-run">تشغيل</button><button class="btn btn-ghost" id="g-cancel">إلغاء</button></div></div>';
    document.body.appendChild(dlg);
    dlg.showModal();
    dlg.querySelector("#g-cancel").addEventListener("click", function () { dlg.close(); dlg.remove(); });
    dlg.querySelector("#g-run").addEventListener("click", function () {
      var revId = dlg.querySelector("#g-rev").value;
      var result = generateActivities(project, revId);
      dlg.close(); dlg.remove();
      alert("تم توليد " + result.created + " نشاط. أُرسل " + result.flagged + " بند بلا تطابق واضح إلى صندوق المراجعة.");
      PP.rerender();
    });
  }

  function generateActivities(project, boqRevisionId) {
    var items = db.query("boqItems", function (i) { return i.boqRevisionId === boqRevisionId; });
    var dictionary = db.query("dictionaryItems", function (d) { return d.isActive && (d.projectId === project.id || d.projectId == null); });
    var existingCodes = db.query("activities", function (a) { return a.projectId === project.id; }).map(function (a) { return a.code; });
    var seq = existingCodes.length;
    var created = 0, flagged = 0;

    items.forEach(function (item) {
      var scored = dictionary.map(function (d) {
        return { dict: d, score: conf.keywordMatchScore(item.description, d.boqKeywords) };
      }).filter(function (s) { return s.score > 0; }).sort(function (a, b) { return b.score - a.score; });

      if (scored.length === 0) {
        gov.raiseReviewItem({
          projectId: project.id, kind: "LOW_CONFIDENCE", entityType: "BOQItem", entityId: item.id,
          reason: 'لم يُعثر على عنصر قاموس مطابق لبند BOQ: "' + item.description + '"',
        });
        flagged++;
        return;
      }
      var best = scored[0], second = scored[1];
      var unitMatch = !item.unit || !best.dict.unit ? 0.5 : item.unit.toLowerCase() === best.dict.unit.toLowerCase() ? 1 : 0;
      var ambiguity = second ? Math.max(0, 1 - second.score / best.score) : 1;
      var result = conf.computeConfidence({ keywordMatch: best.score, unitMatch: unitMatch, ambiguity: ambiguity });

      seq++;
      var code = project.code + "-ACT-" + String(seq).padStart(4, "0");
      var duration = item.quantity != null && best.dict.defaultProductivity ? Math.ceil(item.quantity / best.dict.defaultProductivity) : best.dict.defaultDurationDays || null;

      var activity = db.insert("activities", {
        projectId: project.id, wbsNodeId: null, dictionaryItemId: best.dict.id,
        code: code, name: best.dict.name, discipline: best.dict.discipline || null,
        unit: item.unit || best.dict.unit || null, quantity: item.quantity,
        durationDays: duration, status: "PROPOSED",
        confidenceScore: result.score, confidenceFactors: JSON.stringify(result.factors),
        confidenceRationale: JSON.stringify(result.rationale),
      });
      created++;
      if (result.score < conf.LOW_CONFIDENCE_THRESHOLD) {
        gov.raiseReviewItem({
          projectId: project.id, kind: "LOW_CONFIDENCE", entityType: "Activity", entityId: activity.id,
          reason: "ثقة توليد منخفضة (" + Math.round(result.score * 100) + "%) لمطابقة بند BOQ: \"" + item.description + '"',
        });
      }
    });

    gov.writeAudit({ entityType: "BOQRevision", entityId: boqRevisionId, action: "GENERATE_ACTIVITIES", newValue: { created: created, flagged: flagged } });
    return { created: created, flagged: flagged };
  }

  // ---------------- dictionary tab ----------------
  function renderDictionary(box, project) {
    var items = db.query("dictionaryItems", function (d) { return d.projectId === project.id || d.projectId == null; });
    var html = '<div class="view-head"><div><h2>قاموس الأنشطة</h2><p>عناصر عامة قابلة لإعادة الاستخدام عبر المشاريع (يمكن أيضًا إضافة عناصر خاصة بهذا المشروع).</p></div>' +
      '<div class="view-actions"><button class="btn btn-primary" id="btn-new-dict">+ عنصر قاموس</button></div></div>';
    if (items.length === 0) {
      html += '<div class="empty">القاموس فارغ — أضف عناصر قبل توليد الأنشطة.</div>';
    } else {
      html += '<div class="table-wrap"><table class="dt"><thead><tr><th>الاسم</th><th>التخصص</th><th>الوحدة</th><th>الإنتاجية الافتراضية</th><th>كلمات BOQ المفتاحية</th><th>نشط</th><th></th></tr></thead><tbody>';
      items.forEach(function (d) {
        html += "<tr><td>" + esc(d.name) + "</td><td>" + esc(d.discipline || "—") + "</td><td>" + esc(d.unit || "—") + "</td>" +
          '<td class="num">' + (d.defaultProductivity ?? "—") + "</td><td class=\"mono\">" + esc(d.boqKeywords) + "</td>" +
          "<td>" + (d.isActive ? '<span class="badge badge-good">نشط</span>' : '<span class="badge badge-muted">معطَّل</span>') + "</td>" +
          '<td><button class="btn btn-sm" data-edit-dict="' + d.id + '">تعديل</button></td></tr>';
      });
      html += "</tbody></table></div>";
    }
    box.innerHTML = html;
    box.querySelector("#btn-new-dict").addEventListener("click", function () { openDictDialog(project); });
    box.querySelectorAll("[data-edit-dict]").forEach(function (btn) {
      btn.addEventListener("click", function () { openDictDialog(project, db.get("dictionaryItems", btn.getAttribute("data-edit-dict"))); });
    });
  }

  function openDictDialog(project, existing) {
    var d = existing || {};
    var dlg = document.createElement("dialog");
    dlg.style.width = "min(640px, 94vw)";
    dlg.innerHTML = '<div class="dialog-inner"><h3>' + (existing ? "تعديل عنصر قاموس" : "عنصر قاموس جديد") + "</h3>" +
      '<div class="grid-2">' +
      '<div class="field"><label>الاسم *</label><input id="dd-name" value="' + esc(d.name || "") + '"/></div>' +
      '<div class="field"><label>التخصص</label><input id="dd-discipline" value="' + esc(d.discipline || "") + '"/></div>' +
      '<div class="field"><label>الوحدة</label><input id="dd-unit" value="' + esc(d.unit || "") + '"/></div>' +
      '<div class="field"><label>الإنتاجية الافتراضية (وحدة/يوم)</label><input id="dd-prod" type="number" step="any" value="' + (d.defaultProductivity ?? "") + '"/></div>' +
      '<div class="field"><label>المدة الافتراضية (أيام، بديل الإنتاجية)</label><input id="dd-dur" type="number" step="any" value="' + (d.defaultDurationDays ?? "") + '"/></div>' +
      '<div class="field"><label class="field-inline"><input type="checkbox" id="dd-active" ' + (d.isActive !== false ? "checked" : "") + "/> نشط</label></div>" +
      "</div>" +
      '<div class="field"><label>كلمات BOQ المفتاحية (مفصولة بفواصل) *</label><input id="dd-keywords" value="' + esc(d.boqKeywords || "") + '" placeholder="ceramic,tile,بلاط"/></div>' +
      '<div class="dialog-actions"><button class="btn btn-primary" id="dd-save">حفظ</button><button class="btn btn-ghost" id="dd-cancel">إلغاء</button></div></div>';
    document.body.appendChild(dlg);
    dlg.showModal();
    dlg.querySelector("#dd-cancel").addEventListener("click", function () { dlg.close(); dlg.remove(); });
    dlg.querySelector("#dd-save").addEventListener("click", function () {
      var name = dlg.querySelector("#dd-name").value.trim();
      var keywords = dlg.querySelector("#dd-keywords").value.trim();
      if (!name || !keywords) { alert("الاسم وكلمات BOQ المفتاحية مطلوبة."); return; }
      var patch = {
        name: name, discipline: dlg.querySelector("#dd-discipline").value.trim() || null,
        unit: dlg.querySelector("#dd-unit").value.trim() || null,
        defaultProductivity: dlg.querySelector("#dd-prod").value ? parseFloat(dlg.querySelector("#dd-prod").value) : null,
        defaultDurationDays: dlg.querySelector("#dd-dur").value ? parseFloat(dlg.querySelector("#dd-dur").value) : null,
        boqKeywords: keywords, isActive: dlg.querySelector("#dd-active").checked,
      };
      if (existing) {
        db.update("dictionaryItems", existing.id, patch);
        gov.writeAudit({ entityType: "ActivityDictionaryItem", entityId: existing.id, action: "UPDATE" });
      } else {
        patch.projectId = null;
        var item = db.insert("dictionaryItems", patch);
        gov.writeAudit({ entityType: "ActivityDictionaryItem", entityId: item.id, action: "CREATE", newValue: item });
      }
      dlg.close(); dlg.remove();
      PP.rerender();
    });
  }

  PP.views = PP.views || {};
  PP.views.activities = { render: render };
})();
