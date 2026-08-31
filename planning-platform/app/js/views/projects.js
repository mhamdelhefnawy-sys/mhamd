/* M01 — Projects, versions, approvals. */
(function () {
  "use strict";
  var db = PP.db, gov = PP.gov, util = PP.util, esc = PP.util.escapeHtml;

  var WEEKDAY_LABELS = ["أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];

  function statusBadge(status) {
    var map = {
      DRAFT: ["badge-muted", "مسودة"],
      PENDING_REVIEW: ["badge-warn", "قيد المراجعة"],
      APPROVED: ["badge-good", "معتمد"],
    };
    var m = map[status] || ["badge-muted", status];
    return '<span class="badge ' + m[0] + '">' + m[1] + "</span>";
  }

  // ---------------- list ----------------
  function render(root) {
    var projects = db.all("projects");
    var html = '<div class="view-head"><div><h2>المشاريع</h2>' +
      "<p>M01 — إنشاء المشروع، احتساب المعطى الناقص (بداية/نهاية/مدة)، والاعتماد الذي يقفل النسخة المعتمدة.</p></div>" +
      '<div class="view-actions"><button class="btn btn-primary" id="btn-new-project">+ مشروع جديد</button></div></div>';

    if (projects.length === 0) {
      html += '<div class="empty">لا توجد مشاريع بعد.<br/><br/>' +
        '<button class="btn btn-primary" id="btn-new-project-2">+ إنشاء مشروع جديد</button> ' +
        '<button class="btn btn-ghost" id="btn-load-demo">أو تحميل مشروع تجريبي كامل (M01–M05)</button></div>';
      root.innerHTML = html;
      root.querySelector("#btn-new-project").addEventListener("click", openCreateDialog);
      root.querySelector("#btn-new-project-2").addEventListener("click", openCreateDialog);
      root.querySelector("#btn-load-demo").addEventListener("click", function () {
        var p = PP.seed.loadDemo();
        location.hash = "#/project/" + p.id + "/overview";
      });
      return;
    }

    html += '<div class="table-wrap"><table class="dt"><thead><tr>' +
      "<th>الكود</th><th>الاسم</th><th>العميل</th><th>الحالة</th><th>البداية المتوقعة</th><th>النهاية المخططة</th><th>المدة (يوم)</th><th>قيمة العقد</th><th></th>" +
      "</tr></thead><tbody>";
    projects.forEach(function (p) {
      html += "<tr>" +
        '<td><span class="mono">' + esc(p.code) + "</span></td>" +
        "<td>" + esc(p.name) + "</td>" +
        "<td>" + esc(p.client || "—") + "</td>" +
        "<td>" + statusBadge(p.status) + "</td>" +
        "<td>" + util.formatDate(p.expectedStartDate) + "</td>" +
        "<td>" + util.formatDate(p.plannedFinishDate) + "</td>" +
        '<td class="num">' + (p.contractDurationDays ?? "—") + "</td>" +
        '<td class="num">' + (p.contractValue != null ? p.contractValue.toLocaleString() + " " + p.currency : "—") + "</td>" +
        '<td><a class="btn btn-sm" href="#/project/' + p.id + '/overview">فتح</a></td>' +
        "</tr>";
    });
    html += "</tbody></table></div>";
    root.innerHTML = html;
    root.querySelector("#btn-new-project").addEventListener("click", openCreateDialog);
  }

  // ---------------- create dialog ----------------
  function openCreateDialog() {
    var dlg = document.createElement("dialog");
    dlg.innerHTML =
      '<div class="dialog-inner"><h3>مشروع جديد</h3>' +
      '<div class="grid-2">' +
      '<div class="field"><label>كود المشروع *</label><input id="f-code" placeholder="P-001"/></div>' +
      '<div class="field"><label>اسم المشروع *</label><input id="f-name" placeholder="برج سكني - القاهرة الجديدة"/></div>' +
      "</div>" +
      '<div class="dialog-actions">' +
      '<button class="btn btn-primary" id="f-save">إنشاء</button>' +
      '<button class="btn btn-ghost" id="f-cancel">إلغاء</button></div></div>';
    document.body.appendChild(dlg);
    dlg.showModal();
    dlg.querySelector("#f-cancel").addEventListener("click", function () { dlg.close(); dlg.remove(); });
    dlg.querySelector("#f-save").addEventListener("click", function () {
      var code = dlg.querySelector("#f-code").value.trim();
      var name = dlg.querySelector("#f-name").value.trim();
      if (!code || !name) { alert("كود المشروع واسمه مطلوبان."); return; }
      if (db.query("projects", function (p) { return p.code === code; }).length > 0) {
        alert("يوجد مشروع آخر بنفس الكود بالفعل.");
        return;
      }
      var project = db.insert("projects", {
        code: code, name: name, status: "DRAFT",
        currency: "EGP", workingDaysPerWeek: 6, weekendDays: "5", timezone: "Africa/Cairo",
        revisionNumber: 0,
      });
      gov.writeAudit({ entityType: "Project", entityId: project.id, action: "CREATE", newValue: project });
      dlg.close(); dlg.remove();
      location.hash = "#/project/" + project.id + "/overview";
    });
  }

  // ---------------- detail / edit ----------------
  function computeQualityGates(project) {
    var boqApproved = db.query("boqRevisions", function (r) {
      var boq = db.get("boqs", r.boqId);
      return boq && boq.projectId === project.id && r.status === "APPROVED";
    }).length > 0;
    var docsCount = db.query("documents", function (d) { return d.projectId === project.id; }).length;
    var wbsApproved = db.query("wbsVersions", function (v) {
      var wbs = db.get("wbsList", v.wbsId);
      return wbs && wbs.projectId === project.id && v.status === "APPROVED";
    }).length > 0;
    var approvedActivities = db.query("activities", function (a) { return a.projectId === project.id && a.status === "APPROVED"; }).length;
    var openReview = gov.openReviewCount(project.id);
    var openConflicts = gov.openConflictCount(project.id);
    var mappingRec = PP.views.mapping ? PP.views.mapping.reconciliation(project) : { revision: null, unresolvedCount: 0 };

    return [
      { name: "Document Gate", ok: docsCount > 0, detail: docsCount + " مستند مسجَّل" },
      { name: "BOQ Gate", ok: boqApproved, detail: boqApproved ? "توجد مراجعة BOQ معتمدة" : "لا توجد مراجعة BOQ معتمدة بعد" },
      { name: "Mapping Gate", ok: !mappingRec.revision || mappingRec.unresolvedCount === 0, detail: !mappingRec.revision ? "بانتظار اعتماد BOQ" : mappingRec.unresolvedCount === 0 ? "كل الكميات متزنة" : mappingRec.unresolvedCount + " بند غير متزن" },
      { name: "WBS Gate", ok: wbsApproved, detail: wbsApproved ? "توجد نسخة WBS معتمدة" : "لا توجد نسخة WBS معتمدة بعد" },
      { name: "Activity Gate", ok: approvedActivities > 0, detail: approvedActivities + " نشاط معتمد" },
      { name: "Review Queue", ok: openReview === 0, detail: openReview === 0 ? "لا عناصر مفتوحة" : openReview + " عنصر يحتاج مراجعة" },
      { name: "Conflicts", ok: openConflicts === 0, detail: openConflicts === 0 ? "لا تعارضات مفتوحة" : openConflicts + " تعارض مفتوح" },
    ];
  }

  function renderDetail(root, project) {
    var locked = project.status === "APPROVED";
    var gates = computeQualityGates(project);

    var html = '<div class="view-head"><div><h2>' + esc(project.name) + " " + statusBadge(project.status) + "</h2>" +
      '<p class="mono">' + esc(project.code) + " · مراجعة رقم " + (project.revisionNumber || 0) + "</p></div>" +
      '<div class="view-actions">' +
      (project.status !== "APPROVED"
        ? '<button class="btn btn-primary" id="btn-approve">اعتماد المشروع</button>'
        : '<button class="btn btn-ghost" id="btn-reopen">تعديل بعد الاعتماد</button>') +
      "</div></div>";

    html += '<div class="grid-3">';
    gates.forEach(function (g) {
      html += '<div class="card" style="margin-bottom:0"><h3>' + g.name + " " +
        '<span class="badge ' + (g.ok ? "badge-good" : "badge-warn") + '">' + (g.ok ? "PASS" : "WARN") + "</span></h3>" +
        '<p style="font-size:12.5px;color:var(--ink-soft);margin:0">' + esc(g.detail) + "</p></div>";
    });
    html += "</div>";

    html += '<div class="card"><h3>بيانات المشروع</h3>' + (locked
      ? '<div class="helper-note">المشروع معتمد — الحقول للقراءة فقط. اضغط "تعديل بعد الاعتماد" لفتح التعديل، وسيُنشئ ذلك مراجعة جديدة بدل الكتابة فوق المعتمدة.</div>'
      : "") +
      '<form id="project-form">' + projectFormFields(project, locked) + "</form></div>";

    html += '<div class="card"><h3>العطلات الرسمية</h3><div id="holidays-box"></div></div>';

    var revisions = db.query("projectRevisions", function (r) { return r.projectId === project.id; }).sort(function (a, b) { return b.revisionNumber - a.revisionNumber; });
    if (revisions.length > 0) {
      html += '<div class="card"><h3>سجل مراجعات المشروع</h3><div class="table-wrap"><table class="dt"><thead><tr><th>#</th><th>السبب</th><th>بواسطة</th><th>التاريخ</th></tr></thead><tbody>';
      revisions.forEach(function (r) {
        html += "<tr><td>Rev " + r.revisionNumber + "</td><td>" + esc(r.reason || "—") + "</td><td>" + esc(r.actor) + "</td><td>" + util.formatDate(r.createdAt) + "</td></tr>";
      });
      html += "</tbody></table></div></div>";
    }

    root.innerHTML = html;
    wireDetail(root, project, locked);
  }

  function projectFormFields(p, locked) {
    var dis = locked ? "disabled" : "";
    function val(v) { return v == null ? "" : v; }
    return '<div class="grid-2">' +
      field("العميل", "client", val(p.client), dis) +
      field("الاستشاري", "consultant", val(p.consultant), dis) +
      field("المقاول", "contractor", val(p.contractor), dis) +
      selectField("نوع المشروع", "projectType", val(p.projectType), ["سكني", "تجاري", "بنية تحتية", "صحي", "تعليمي", "صناعي", "أخرى"], dis) +
      field("الموقع", "location", val(p.location), dis) +
      selectField("نوع العقد", "contractType", val(p.contractType), ["Lump Sum", "Unit Price", "Cost Plus", "أخرى"], dis) +
      numField("قيمة العقد", "contractValue", val(p.contractValue), dis) +
      selectField("العملة", "currency", val(p.currency || "EGP"), ["EGP", "USD", "SAR", "AED", "EUR"], dis) +
      "</div>" +
      '<div class="helper-note">أدخل اثنين من الثلاثة (بداية متوقعة / نهاية مخططة / مدة العقد بالأيام) ليُحسب الثالث تلقائيًا وفق أيام العمل والعطلة الأسبوعية بالأسفل.</div>' +
      '<div class="grid-3">' +
      dateField("البداية المتوقعة", "expectedStartDate", val(p.expectedStartDate), dis) +
      dateField("النهاية المخططة", "plannedFinishDate", val(p.plannedFinishDate), dis) +
      numField("مدة العقد (أيام عمل)", "contractDurationDays", val(p.contractDurationDays), dis) +
      "</div>" +
      '<div class="grid-3">' +
      numField("أيام العمل بالأسبوع", "workingDaysPerWeek", val(p.workingDaysPerWeek ?? 6), dis) +
      weekendField(p.weekendDays || "5", dis) +
      dateField("تاريخ البيانات (Data Date)", "dataDate", val(p.dataDate), dis) +
      "</div>" +
      (locked ? "" : '<div class="dialog-actions"><button type="submit" class="btn btn-primary">حفظ</button>' +
        (p.status === "DRAFT" ? "" : "") + "</div>");
  }
  function field(label, name, value, dis) {
    return '<div class="field"><label>' + label + "</label><input name=\"" + name + '" value="' + PP.util.escapeHtml(value) + '" ' + dis + "/></div>";
  }
  function numField(label, name, value, dis) {
    return '<div class="field"><label>' + label + "</label><input type=\"number\" name=\"" + name + '" value="' + PP.util.escapeHtml(value) + '" ' + dis + "/></div>";
  }
  function dateField(label, name, value, dis) {
    return '<div class="field"><label>' + label + "</label><input type=\"date\" name=\"" + name + '" value="' + PP.util.escapeHtml(value ? String(value).slice(0, 10) : "") + '" ' + dis + "/></div>";
  }
  function selectField(label, name, value, options, dis) {
    var html = '<div class="field"><label>' + label + '</label><select name="' + name + '" ' + dis + '><option value="">—</option>';
    options.forEach(function (o) { html += '<option value="' + o + '" ' + (o === value ? "selected" : "") + ">" + o + "</option>"; });
    html += "</select></div>";
    return html;
  }
  function weekendField(csv, dis) {
    var selected = PP.util.parseWeekendDays(csv);
    var html = '<div class="field"><label>أيام العطلة الأسبوعية</label><div class="field-inline" style="flex-wrap:wrap">';
    WEEKDAY_LABELS.forEach(function (label, idx) {
      var checked = selected.indexOf(idx) !== -1 ? "checked" : "";
      html += '<label style="display:flex;align-items:center;gap:4px;font-size:12.5px"><input type="checkbox" name="weekend" value="' + idx + '" ' + checked + " " + dis + "/>" + label + "</label>";
    });
    html += "</div></div>";
    return html;
  }

  function renderHolidays(box, project, locked) {
    var holidays = db.query("holidays", function (h) { return h.projectId === project.id; });
    var html = '<div class="table-wrap"><table class="dt"><thead><tr><th>التاريخ</th><th>الاسم</th><th></th></tr></thead><tbody>';
    holidays.forEach(function (h) {
      html += "<tr><td>" + util.formatDate(h.date) + "</td><td>" + esc(h.name) + "</td><td>" +
        (locked ? "" : '<button class="btn btn-sm btn-danger" data-del-holiday="' + h.id + '">حذف</button>') + "</td></tr>";
    });
    html += "</tbody></table></div>";
    if (!locked) {
      html += '<div class="field-inline" style="margin-top:10px">' +
        '<input type="date" id="new-holiday-date" style="width:150px"/>' +
        '<input type="text" id="new-holiday-name" placeholder="اسم العطلة" style="flex:1"/>' +
        '<button class="btn btn-sm" id="add-holiday">إضافة</button></div>';
    }
    box.innerHTML = html;
    if (!locked) {
      box.querySelector("#add-holiday").addEventListener("click", function () {
        var date = box.querySelector("#new-holiday-date").value;
        var name = box.querySelector("#new-holiday-name").value.trim();
        if (!date || !name) { alert("التاريخ والاسم مطلوبان."); return; }
        db.insert("holidays", { projectId: project.id, date: date, name: name });
        renderHolidays(box, project, locked);
      });
    }
    box.querySelectorAll("[data-del-holiday]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        db.remove("holidays", btn.getAttribute("data-del-holiday"));
        renderHolidays(box, project, locked);
      });
    });
  }

  function wireDetail(root, project, locked) {
    renderHolidays(root.querySelector("#holidays-box"), project, locked);

    if (!locked) {
      var form = root.querySelector("#project-form");
      var start = form.querySelector('[name="expectedStartDate"]');
      var finish = form.querySelector('[name="plannedFinishDate"]');
      var duration = form.querySelector('[name="contractDurationDays"]');

      function weekendArray() {
        return Array.from(form.querySelectorAll('[name="weekend"]:checked')).map(function (c) { return parseInt(c.value, 10); });
      }
      function autoCalc(changed) {
        var s = start.value, f = finish.value, d = duration.value;
        var holidays = db.query("holidays", function (h) { return h.projectId === project.id; });
        var weekend = weekendArray();
        if (s && f && !d && changed !== "duration") {
          duration.value = util.workingDaysBetween(s, f, weekend, holidays);
        } else if (s && d && !f && changed !== "finish") {
          finish.value = util.addWorkingDays(s, parseInt(d, 10), weekend, holidays);
        } else if (f && d && !s && changed !== "start") {
          // Walk backward day by day until working-day count matches — small dataset, fine to brute force.
          var probe = new Date(f);
          var remaining = parseInt(d, 10);
          var holidaySet = new Set(holidays.map(function (h) { return h.date; }));
          while (remaining > 0) {
            probe.setDate(probe.getDate() - 1);
            var dow = probe.getDay();
            if (weekend.indexOf(dow) === -1 && !holidaySet.has(probe.toISOString().slice(0, 10))) remaining--;
          }
          start.value = probe.toISOString().slice(0, 10);
        }
      }
      start.addEventListener("change", function () { autoCalc("start"); });
      finish.addEventListener("change", function () { autoCalc("finish"); });
      duration.addEventListener("change", function () { autoCalc("duration"); });

      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var fd = new FormData(form);
        var patch = {
          client: fd.get("client") || null,
          consultant: fd.get("consultant") || null,
          contractor: fd.get("contractor") || null,
          projectType: fd.get("projectType") || null,
          location: fd.get("location") || null,
          contractType: fd.get("contractType") || null,
          contractValue: fd.get("contractValue") ? parseFloat(fd.get("contractValue")) : null,
          currency: fd.get("currency") || "EGP",
          expectedStartDate: fd.get("expectedStartDate") || null,
          plannedFinishDate: fd.get("plannedFinishDate") || null,
          contractDurationDays: fd.get("contractDurationDays") ? parseInt(fd.get("contractDurationDays"), 10) : null,
          workingDaysPerWeek: fd.get("workingDaysPerWeek") ? parseInt(fd.get("workingDaysPerWeek"), 10) : 6,
          weekendDays: weekendArray().join(","),
          dataDate: fd.get("dataDate") || null,
        };
        var before = Object.assign({}, project);
        db.update("projects", project.id, patch);
        gov.writeAudit({ entityType: "Project", entityId: project.id, action: "UPDATE", oldValue: before, newValue: db.get("projects", project.id) });
        PP.rerender();
      });
    }

    var approveBtn = root.querySelector("#btn-approve");
    if (approveBtn) {
      approveBtn.addEventListener("click", function () {
        if (!project.expectedStartDate || !project.plannedFinishDate) {
          alert("لا يمكن اعتماد المشروع قبل تحديد تاريخي البداية والنهاية.");
          return;
        }
        if (!confirm("اعتماد المشروع يقفل النسخة الحالية. أي تعديل لاحق سينشئ مراجعة جديدة. متابعة؟")) return;
        db.update("projects", project.id, { status: "APPROVED", approvedBy: gov.currentActor(), approvedAt: new Date().toISOString() });
        gov.writeAudit({ entityType: "Project", entityId: project.id, action: "APPROVE" });
        gov.recordDecision({
          projectId: project.id, entityType: "Project", entityId: project.id,
          title: "اعتماد بيانات المشروع", description: "تم اعتماد بيانات المشروع الأساسية وقفل النسخة.",
        });
        PP.rerender();
      });
    }

    var reopenBtn = root.querySelector("#btn-reopen");
    if (reopenBtn) {
      reopenBtn.addEventListener("click", function () {
        var reason = prompt("سبب التعديل بعد الاعتماد (سيُسجَّل في سجل القرارات):");
        if (reason === null) return;
        if (!reason.trim()) { alert("السبب مطلوب."); return; }
        var nextRev = (project.revisionNumber || 0) + 1;
        db.insert("projectRevisions", {
          projectId: project.id, revisionNumber: project.revisionNumber || 0,
          snapshot: JSON.stringify(project), reason: reason, actor: gov.currentActor(),
        });
        db.update("projects", project.id, { status: "DRAFT", revisionNumber: nextRev });
        gov.recordDecision({
          projectId: project.id, entityType: "Project", entityId: project.id,
          title: "إعادة فتح مشروع معتمد للتعديل", description: reason,
          evidence: { previousSnapshot: project },
        });
        gov.writeAudit({ entityType: "Project", entityId: project.id, action: "REOPEN", reason: reason });
        PP.rerender();
      });
    }
  }

  PP.views = PP.views || {};
  PP.views.projects = { render: render, renderDetail: renderDetail, statusBadge: statusBadge, computeQualityGates: computeQualityGates };
})();
