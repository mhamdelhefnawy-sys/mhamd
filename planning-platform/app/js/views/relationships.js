/* M08 — Relationship engine: a standard-relations library drives rule-based proposals
 * (not blind chaining), plus manual logic, a simplified layered network diagram, and
 * cycle/open-end detection via js/graph.js — the exact "check the graph before any
 * calculation" step the roadmap calls for, ahead of a future CPM engine (M11).
 */
(function () {
  "use strict";
  var db = PP.db, gov = PP.gov, util = PP.util, esc = PP.util.escapeHtml, graph = PP.graph;

  var TYPES = ["FS", "SS", "FF", "SF"];

  function projectActivities(project) {
    return db.query("activities", function (a) { return a.projectId === project.id; });
  }
  function projectRelationships(project) {
    var ids = new Set(projectActivities(project).map(function (a) { return a.id; }));
    return db.query("relationships", function (r) { return ids.has(r.predecessorActivityId) && ids.has(r.successorActivityId); });
  }
  function graphSummary(project) {
    var activities = projectActivities(project);
    var rels = projectRelationships(project);
    var g = graph.computeGraph(activities.map(function (a) { return a.id; }), rels);
    return { cycleCount: g.cycleIds.length, relCount: rels.length, activityCount: activities.length };
  }

  function statusBadge(status) {
    var map = { PROPOSED: ["badge-accent", "مقترحة"], USER_EDITED: ["badge-warn", "معدَّلة"], APPROVED: ["badge-good", "معتمدة"] };
    var m = map[status] || ["badge-muted", status];
    return '<span class="badge ' + m[0] + '">' + m[1] + "</span>";
  }

  function render(root, project) {
    var html = '<div class="tabs" id="rel-tabs">' +
      '<button data-t="relationships" class="active">العلاقات</button>' +
      '<button data-t="templates">مكتبة العلاقات القياسية</button>' +
      "</div><div id=\"rel-body\"></div>";
    root.innerHTML = html;
    root.querySelectorAll("#rel-tabs button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        root.querySelectorAll("#rel-tabs button").forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        if (btn.getAttribute("data-t") === "relationships") renderRelationships(root.querySelector("#rel-body"), project);
        else renderTemplates(root.querySelector("#rel-body"), project);
      });
    });
    renderRelationships(root.querySelector("#rel-body"), project);
  }

  // ---------------- relationships tab ----------------
  function renderRelationships(box, project) {
    var activities = projectActivities(project);
    var rels = projectRelationships(project);
    var g = graph.computeGraph(activities.map(function (a) { return a.id; }), rels);

    var html = '<div class="view-head"><div><h2>العلاقات المنطقية</h2>' +
      "<p>M08 — علاقات مبنية على مكتبة قياسية (منهجية إنشائية)، لا تسلسل أعمى. Lag سالب ممنوع إلا باستثناء موثَّق.</p></div>" +
      '<div class="view-actions"><button class="btn btn-primary" id="btn-generate-rel">توليد من المكتبة</button>' +
      '<button class="btn btn-ghost" id="btn-new-rel">+ علاقة يدوية</button></div></div>';

    if (activities.length < 2) {
      html += '<div class="helper-note warn">يلزم وجود نشاطين على الأقل لبناء علاقات.</div>';
      box.innerHTML = html;
      wireHeaderActions(box, project);
      return;
    }

    if (g.cycleIds.length > 0) {
      html += '<div class="cycle-box"><b>دورة منطقية مكتشَفة (' + g.cycleIds.length + ' نشاط) — يجب حلها قبل اعتماد أي علاقة ضمنها:</b><br/><br/>' +
        g.cycleIds.map(function (id) {
          var a = db.get("activities", id);
          return '<span class="net-node-cycle"><span class="mono">' + esc(a.code) + "</span> " + esc(a.name) + "</span>";
        }).join("") + "</div>";
    }

    html += '<div id="net-container"></div>';

    if (g.noPredecessor.length > 0 || g.noSuccessor.length > 0) {
      html += '<div class="helper-note">أطراف مفتوحة (سيُعاد فحصها لاحقًا ضمن تدقيق DCMA): ' +
        g.noPredecessor.length + " نشاط بلا سابق، " + g.noSuccessor.length + " نشاط بلا لاحق.</div>";
    }

    if (rels.length === 0) {
      html += '<div class="empty">لا توجد علاقات بعد.</div>';
      box.innerHTML = html;
      wireHeaderActions(box, project);
      renderNetwork(box.querySelector("#net-container"), g, rels);
      return;
    }

    html += '<div class="dialog-actions" style="margin:10px 0"><button class="btn btn-sm" id="btn-approve-selected-rel">اعتماد المحدد</button>' +
      '<button class="btn btn-sm btn-danger" id="btn-delete-selected-rel">حذف المحدد</button></div>';
    html += '<div class="table-wrap"><table class="dt"><thead><tr><th></th><th>السابق</th><th>النوع</th><th class="num">Lag</th><th>اللاحق</th><th>الحالة</th><th>المسوّغ</th><th></th></tr></thead><tbody>';
    rels.forEach(function (r) {
      var p = db.get("activities", r.predecessorActivityId), s = db.get("activities", r.successorActivityId);
      html += "<tr>" +
        '<td><input type="checkbox" class="rel-select" value="' + r.id + '"/></td>' +
        '<td class="mono">' + esc(p ? p.code : "؟") + "</td>" +
        '<td><span class="badge badge-accent">' + esc(r.type) + "</span></td>" +
        '<td class="num">' + (r.lag < 0 ? '<span class="badge badge-warn">' + r.lag + "</span>" : r.lag) + "</td>" +
        '<td class="mono">' + esc(s ? s.code : "؟") + "</td>" +
        "<td>" + statusBadge(r.status) + "</td>" +
        '<td style="max-width:220px;font-size:12px;color:var(--ink-soft)">' + esc(r.rationale || "—") + "</td>" +
        '<td><button class="btn btn-sm" data-del-rel="' + r.id + '">حذف</button></td>' +
        "</tr>";
    });
    html += "</tbody></table></div>";
    box.innerHTML = html;
    renderNetwork(box.querySelector("#net-container"), g, rels);
    wireHeaderActions(box, project);

    box.querySelector("#btn-approve-selected-rel").addEventListener("click", function () {
      selectedRel(box).forEach(function (id) {
        db.update("relationships", id, { status: "APPROVED" });
        gov.writeAudit({ entityType: "Relationship", entityId: id, action: "APPROVE" });
      });
      renderRelationships(box, project);
    });
    box.querySelector("#btn-delete-selected-rel").addEventListener("click", function () {
      var ids = selectedRel(box);
      if (ids.length === 0) return;
      if (!confirm("حذف " + ids.length + " علاقة؟")) return;
      ids.forEach(function (id) {
        var r = db.get("relationships", id);
        db.remove("relationships", id);
        gov.writeAudit({ entityType: "Relationship", entityId: id, action: "DELETE", oldValue: r });
      });
      renderRelationships(box, project);
    });
    box.querySelectorAll("[data-del-rel]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-del-rel");
        var r = db.get("relationships", id);
        db.remove("relationships", id);
        gov.writeAudit({ entityType: "Relationship", entityId: id, action: "DELETE", oldValue: r });
        renderRelationships(box, project);
      });
    });
  }
  function selectedRel(box) {
    return Array.from(box.querySelectorAll(".rel-select:checked")).map(function (c) { return c.value; });
  }

  function wireHeaderActions(box, project) {
    box.querySelector("#btn-generate-rel").addEventListener("click", function () {
      var result = generateFromTemplates(project);
      alert("تم توليد " + result.created + " علاقة من المكتبة (تم تجاهل الروابط المكررة).");
      renderRelationships(box, project);
    });
    box.querySelector("#btn-new-rel").addEventListener("click", function () { openRelDialog(project); });
  }

  function generateFromTemplates(project) {
    var activities = projectActivities(project).filter(function (a) { return a.dictionaryItemId; });
    var templates = db.all("relationshipTemplates");
    var existing = projectRelationships(project);
    var existingPairs = new Set(existing.map(function (r) { return r.predecessorActivityId + "::" + r.successorActivityId; }));
    var created = 0;
    templates.forEach(function (t) {
      var preds = activities.filter(function (a) { return a.dictionaryItemId === t.predecessorDictionaryItemId; });
      var succs = activities.filter(function (a) { return a.dictionaryItemId === t.successorDictionaryItemId; });
      preds.forEach(function (p) {
        succs.forEach(function (s) {
          if (p.id === s.id) return;
          var key = p.id + "::" + s.id;
          if (existingPairs.has(key)) return;
          var rel = db.insert("relationships", {
            projectId: project.id, predecessorActivityId: p.id, successorActivityId: s.id,
            type: t.type, lag: t.lag || 0, status: "PROPOSED",
            rationale: t.notes || ("علاقة قياسية من المكتبة: " + t.type + (t.lag ? " +" + t.lag + " يوم" : "")),
            templateId: t.id,
          });
          gov.writeAudit({ entityType: "Relationship", entityId: rel.id, action: "PROPOSE_FROM_TEMPLATE" });
          existingPairs.add(key);
          created++;
        });
      });
    });
    return { created: created };
  }

  function openRelDialog(project) {
    var activities = projectActivities(project);
    var dlg = document.createElement("dialog");
    dlg.innerHTML = '<div class="dialog-inner"><h3>علاقة يدوية</h3>' +
      '<div class="grid-2">' +
      '<div class="field"><label>السابق *</label><select id="r-pred">' + activities.map(function (a) { return '<option value="' + a.id + '">' + esc(a.code) + " — " + esc(a.name) + "</option>"; }).join("") + "</select></div>" +
      '<div class="field"><label>اللاحق *</label><select id="r-succ">' + activities.map(function (a) { return '<option value="' + a.id + '">' + esc(a.code) + " — " + esc(a.name) + "</option>"; }).join("") + "</select></div>" +
      '<div class="field"><label>النوع</label><select id="r-type">' + TYPES.map(function (t) { return '<option value="' + t + '">' + t + "</option>"; }).join("") + "</select></div>" +
      '<div class="field"><label>Lag (أيام)</label><input id="r-lag" type="number" value="0"/></div>' +
      "</div>" +
      '<div class="field field-inline"><input type="checkbox" id="r-allow-neg"/><label for="r-allow-neg">السماح بـ Lag سالب (يتطلب مسوّغًا ويُسجَّل كاستثناء)</label></div>' +
      '<div class="field"><label>المسوّغ / المنهجية الإنشائية *</label><textarea id="r-rationale" placeholder="مثال: يجب اكتمال المباني قبل بدء أعمال البياض"></textarea></div>' +
      '<div class="dialog-actions"><button class="btn btn-primary" id="r-save">حفظ</button><button class="btn btn-ghost" id="r-cancel">إلغاء</button></div></div>';
    document.body.appendChild(dlg);
    dlg.showModal();
    dlg.querySelector("#r-cancel").addEventListener("click", function () { dlg.close(); dlg.remove(); });
    dlg.querySelector("#r-save").addEventListener("click", function () {
      var predId = dlg.querySelector("#r-pred").value, succId = dlg.querySelector("#r-succ").value;
      if (predId === succId) { alert("لا يمكن ربط نشاط بنفسه."); return; }
      var lag = parseInt(dlg.querySelector("#r-lag").value, 10) || 0;
      var rationale = dlg.querySelector("#r-rationale").value.trim();
      if (!rationale) { alert("المسوّغ مطلوب — لا رابط بلا تفسير منهجية."); return; }
      var allowNeg = dlg.querySelector("#r-allow-neg").checked;
      if (lag < 0 && !allowNeg) { alert('Lag سالب يتطلب تفعيل "السماح بـ Lag سالب".'); return; }
      var existing = db.query("relationships", function (r) { return r.predecessorActivityId === predId && r.successorActivityId === succId; });
      if (existing.length > 0) { alert("توجد علاقة بالفعل بين هذين النشاطين."); return; }
      var rel = db.insert("relationships", {
        projectId: project.id, predecessorActivityId: predId, successorActivityId: succId,
        type: dlg.querySelector("#r-type").value, lag: lag, status: "USER_EDITED", rationale: rationale,
        negativeLagOverride: lag < 0,
      });
      gov.writeAudit({ entityType: "Relationship", entityId: rel.id, action: "CREATE", newValue: rel });
      if (lag < 0) {
        gov.recordDecision({
          projectId: project.id, entityType: "Relationship", entityId: rel.id,
          title: "قبول Lag سالب", description: rationale, evidence: { lag: lag, type: rel.type },
        });
      }
      dlg.close(); dlg.remove();
      PP.rerender();
    });
  }

  // ---------------- network diagram ----------------
  function renderNetwork(container, g, rels) {
    if (!container) return;
    if (g.nodesByLevel.every(function (level) { return level.length === 0; })) {
      container.innerHTML = '<div class="empty">لا يوجد رسم بياني بعد — أضف علاقات أولًا.</div>';
      return;
    }
    var html = '<div class="net-wrap" dir="ltr"><div class="net-cols">';
    g.nodesByLevel.forEach(function (levelIds) {
      if (levelIds.length === 0) return;
      html += '<div class="net-col">';
      levelIds.forEach(function (id) {
        var a = db.get("activities", id);
        var flags = "";
        if (g.noPredecessor.indexOf(id) !== -1) flags += '<span class="badge badge-warn" style="font-size:9px">بلا سابق</span>';
        if (g.noSuccessor.indexOf(id) !== -1) flags += '<span class="badge badge-warn" style="font-size:9px">بلا لاحق</span>';
        html += '<div class="net-node" id="net-node-' + id + '"><span class="mono">' + esc(a.code) + "</span><span>" + esc(a.name) + "</span>" + (flags ? '<span>' + flags + "</span>" : "") + "</div>";
      });
      html += "</div>";
    });
    html += '</div><svg class="net-svg" id="net-svg"></svg></div>';
    container.innerHTML = html;

    var wrap = container.querySelector(".net-wrap");
    var svg = container.querySelector("#net-svg");
    var wrapRect = wrap.getBoundingClientRect();
    svg.setAttribute("width", wrap.scrollWidth);
    svg.setAttribute("height", wrap.scrollHeight);
    var edgesSvg = "";
    var cycleSet = new Set(g.cycleIds);
    rels.forEach(function (r) {
      if (cycleSet.has(r.predecessorActivityId) || cycleSet.has(r.successorActivityId)) return;
      var a = document.getElementById("net-node-" + r.predecessorActivityId);
      var b = document.getElementById("net-node-" + r.successorActivityId);
      if (!a || !b) return;
      var ar = a.getBoundingClientRect(), br = b.getBoundingClientRect();
      var x1 = ar.right - wrapRect.left + wrap.scrollLeft, y1 = ar.top + ar.height / 2 - wrapRect.top + wrap.scrollTop;
      var x2 = br.left - wrapRect.left + wrap.scrollLeft, y2 = br.top + br.height / 2 - wrapRect.top + wrap.scrollTop;
      var mx = (x1 + x2) / 2;
      var cls = r.status === "APPROVED" ? "net-edge-approved" : "net-edge-proposed";
      edgesSvg += '<path class="' + cls + '" d="M' + x1 + ',' + y1 + ' C' + mx + ',' + y1 + ' ' + mx + ',' + y2 + ' ' + x2 + ',' + y2 + '" marker-end="url(#net-arrow)"/>';
      if (r.lag) edgesSvg += '<text class="net-lag-label" x="' + mx + '" y="' + ((y1 + y2) / 2 - 4) + '">' + (r.lag > 0 ? "+" : "") + r.lag + "</text>";
    });
    svg.innerHTML = '<defs><marker id="net-arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path class="net-arrow" d="M0,0 L0,6 L7,3 z"/></marker></defs>' + edgesSvg;
  }

  // ---------------- templates tab ----------------
  function renderTemplates(box, project) {
    var templates = db.all("relationshipTemplates");
    var dict = db.all("dictionaryItems");
    function dictName(id) { var d = dict.find(function (x) { return x.id === id; }); return d ? d.name : "؟"; }

    var html = '<div class="view-head"><div><h2>مكتبة العلاقات القياسية</h2>' +
      "<p>علاقات بين أنواع الأنشطة (عبر القاموس) تعكس منهجية إنشائية حقيقية — تُستخدم لتوليد العلاقات تلقائيًا.</p></div>" +
      '<div class="view-actions"><button class="btn btn-primary" id="btn-new-tpl">+ علاقة قياسية</button></div></div>';
    if (templates.length === 0) {
      html += '<div class="empty">المكتبة فارغة.</div>';
    } else {
      html += '<div class="table-wrap"><table class="dt"><thead><tr><th>من (سابق)</th><th>النوع</th><th class="num">Lag</th><th>إلى (لاحق)</th><th>المسوّغ</th><th></th></tr></thead><tbody>';
      templates.forEach(function (t) {
        html += "<tr><td>" + esc(dictName(t.predecessorDictionaryItemId)) + "</td>" +
          '<td><span class="badge badge-accent">' + esc(t.type) + "</span></td>" +
          '<td class="num">' + t.lag + "</td>" +
          "<td>" + esc(dictName(t.successorDictionaryItemId)) + "</td>" +
          '<td style="font-size:12px;color:var(--ink-soft)">' + esc(t.notes || "—") + "</td>" +
          '<td><button class="btn btn-sm btn-danger" data-del-tpl="' + t.id + '">حذف</button></td></tr>';
      });
      html += "</tbody></table></div>";
    }
    box.innerHTML = html;
    box.querySelector("#btn-new-tpl").addEventListener("click", function () { openTemplateDialog(project, dict); });
    box.querySelectorAll("[data-del-tpl]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        db.remove("relationshipTemplates", btn.getAttribute("data-del-tpl"));
        renderTemplates(box, project);
      });
    });
  }

  function openTemplateDialog(project, dict) {
    var dlg = document.createElement("dialog");
    dlg.innerHTML = '<div class="dialog-inner"><h3>علاقة قياسية جديدة</h3>' +
      '<div class="grid-2">' +
      '<div class="field"><label>من (سابق) *</label><select id="t-pred">' + dict.map(function (d) { return '<option value="' + d.id + '">' + esc(d.name) + "</option>"; }).join("") + "</select></div>" +
      '<div class="field"><label>إلى (لاحق) *</label><select id="t-succ">' + dict.map(function (d) { return '<option value="' + d.id + '">' + esc(d.name) + "</option>"; }).join("") + "</select></div>" +
      '<div class="field"><label>النوع</label><select id="t-type">' + TYPES.map(function (t) { return '<option value="' + t + '">' + t + "</option>"; }).join("") + "</select></div>" +
      '<div class="field"><label>Lag (أيام، ≥0)</label><input id="t-lag" type="number" min="0" value="0"/></div>' +
      "</div>" +
      '<div class="field"><label>المسوّغ / سبب المنهجية</label><textarea id="t-notes" placeholder="مثال: فترة معالجة الخرسانة قبل بدء أعمال المباني"></textarea></div>' +
      '<div class="dialog-actions"><button class="btn btn-primary" id="t-save">حفظ</button><button class="btn btn-ghost" id="t-cancel">إلغاء</button></div></div>';
    document.body.appendChild(dlg);
    dlg.showModal();
    dlg.querySelector("#t-cancel").addEventListener("click", function () { dlg.close(); dlg.remove(); });
    dlg.querySelector("#t-save").addEventListener("click", function () {
      var predId = dlg.querySelector("#t-pred").value, succId = dlg.querySelector("#t-succ").value;
      if (predId === succId) { alert("لا يمكن أن يكون السابق واللاحق نفس العنصر."); return; }
      var lag = Math.max(0, parseInt(dlg.querySelector("#t-lag").value, 10) || 0);
      var tpl = db.insert("relationshipTemplates", {
        predecessorDictionaryItemId: predId, successorDictionaryItemId: succId,
        type: dlg.querySelector("#t-type").value, lag: lag, notes: dlg.querySelector("#t-notes").value.trim() || null,
      });
      gov.writeAudit({ entityType: "RelationshipTemplate", entityId: tpl.id, action: "CREATE", newValue: tpl });
      dlg.close(); dlg.remove();
      PP.rerender();
    });
  }

  PP.views = PP.views || {};
  PP.views.relationships = { render: render, graphSummary: graphSummary, generateFromTemplates: generateFromTemplates };
})();
