/* M00 view — audit log, decision log, review queue, conflicts for the active project.
 * This is what makes the governance principles checkable rather than decorative. */
(function () {
  "use strict";
  var db = PP.db, gov = PP.gov, util = PP.util, esc = PP.util.escapeHtml;

  function render(root, project) {
    var html = '<div class="view-head"><div><h2>الحوكمة والتدقيق</h2>' +
      "<p>M00 — صندوق المراجعة، سجل القرارات، التعارضات، وسجل التدقيق الكامل لهذا المشروع.</p></div></div>" +
      '<div class="tabs" id="gov-tabs">' +
      '<button data-t="review" class="active">صندوق المراجعة (' + gov.openReviewCount(project.id) + ")</button>" +
      '<button data-t="conflicts">التعارضات (' + gov.openConflictCount(project.id) + ")</button>" +
      '<button data-t="decisions">سجل القرارات</button>' +
      '<button data-t="audit">سجل التدقيق</button>' +
      "</div><div id=\"gov-body\"></div>";
    root.innerHTML = html;
    root.querySelectorAll("#gov-tabs button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        root.querySelectorAll("#gov-tabs button").forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        renderTab(root.querySelector("#gov-body"), project, btn.getAttribute("data-t"));
      });
    });
    renderTab(root.querySelector("#gov-body"), project, "review");
  }

  function renderTab(box, project, tab) {
    if (tab === "review") return renderReview(box, project);
    if (tab === "conflicts") return renderConflicts(box, project);
    if (tab === "decisions") return renderDecisions(box, project);
    return renderAudit(box, project);
  }

  function renderReview(box, project) {
    var items = db.query("reviewQueue", function (r) { return r.projectId === project.id; }).sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
    if (items.length === 0) { box.innerHTML = '<div class="empty">لا توجد عناصر في صندوق المراجعة.</div>'; return; }
    var html = '<div class="table-wrap"><table class="dt"><thead><tr><th>النوع</th><th>الكيان</th><th>السبب</th><th>الحالة</th><th></th></tr></thead><tbody>';
    items.forEach(function (r) {
      html += "<tr><td>" + esc(r.kind) + "</td><td>" + esc(r.entityType) + " · " + esc((r.entityId || "").slice(-8)) + "</td><td>" + esc(r.reason) + "</td>" +
        "<td>" + (r.status === "OPEN" ? '<span class="badge badge-warn">مفتوح</span>' : '<span class="badge badge-good">تمت المعالجة</span>') + "</td>" +
        "<td>" + (r.status === "OPEN" ? '<button class="btn btn-sm" data-resolve="' + r.id + '">وضع علامة تمت المعالجة</button>' : esc(r.resolution || "")) + "</td></tr>";
    });
    html += "</tbody></table></div>";
    box.innerHTML = html;
    box.querySelectorAll("[data-resolve]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var note = prompt("ملاحظة الحل (اختياري):", "");
        gov.resolveReviewItem(btn.getAttribute("data-resolve"), note || "تمت المراجعة");
        renderReview(box, project);
        PP.rerender();
      });
    });
  }

  function renderConflicts(box, project) {
    var items = db.query("conflicts", function (r) { return r.projectId === project.id; }).sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
    if (items.length === 0) { box.innerHTML = '<div class="empty">لا توجد تعارضات مسجَّلة.</div>'; return; }
    var html = '<div class="table-wrap"><table class="dt"><thead><tr><th>الوصف</th><th>المصدر أ</th><th>المصدر ب</th><th>الحالة</th><th></th></tr></thead><tbody>';
    items.forEach(function (c) {
      html += "<tr><td>" + esc(c.description) + '</td><td class="mono">' + esc(c.sourceA) + '</td><td class="mono">' + esc(c.sourceB) + "</td>" +
        "<td>" + (c.status === "OPEN" ? '<span class="badge badge-bad">مفتوح</span>' : '<span class="badge badge-good">محلول</span>') + "</td>" +
        "<td>" + (c.status === "OPEN" ? '<button class="btn btn-sm" data-resolve-c="' + c.id + '">حل</button>' : esc(c.resolution || "")) + "</td></tr>";
    });
    html += "</tbody></table></div>";
    box.innerHTML = html;
    box.querySelectorAll("[data-resolve-c]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var res = prompt("كيف تم حل هذا التعارض؟");
        if (!res) return;
        gov.resolveConflict(btn.getAttribute("data-resolve-c"), res);
        renderConflicts(box, project);
        PP.rerender();
      });
    });
  }

  function renderDecisions(box, project) {
    var items = db.query("decisionLog", function (d) { return d.projectId === project.id; }).sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
    if (items.length === 0) { box.innerHTML = '<div class="empty">لا توجد قرارات مسجَّلة بعد.</div>'; return; }
    var html = items.map(function (d) {
      return '<div class="card"><h3>' + esc(d.title) + '</h3><p style="font-size:13px">' + esc(d.description) + "</p>" +
        '<p style="font-size:11.5px;color:var(--ink-faint)" class="mono">' + esc(d.actor) + " · " + util.formatDate(d.createdAt) + "</p></div>";
    }).join("");
    box.innerHTML = html;
  }

  function renderAudit(box, project) {
    // Audit rows aren't project-scoped by entity directly; filter to entities we can trace
    // to this project via a simple heuristic — practical for an MVP single-project view.
    var rows = db.all("auditLog").filter(function (a) {
      return db.query("decisionLog", function (d) { return d.entityId === a.entityId; }).some(function (d) { return d.projectId === project.id; }) ||
        [project.id].indexOf(a.entityId) !== -1 ||
        isProjectEntity(a.entityType, a.entityId, project.id);
    }).sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); }).slice(0, 200);

    if (rows.length === 0) { box.innerHTML = '<div class="empty">لا يوجد سجل تدقيق مرتبط بهذا المشروع بعد.</div>'; return; }
    var html = '<div class="table-wrap"><table class="dt"><thead><tr><th>الوقت</th><th>بواسطة</th><th>الكيان</th><th>الإجراء</th><th>السبب</th></tr></thead><tbody>';
    rows.forEach(function (a) {
      html += "<tr><td class=\"mono\">" + new Date(a.createdAt).toLocaleString("en-GB") + "</td><td>" + esc(a.actor) + "</td>" +
        "<td>" + esc(a.entityType) + "</td><td>" + esc(a.action) + "</td><td>" + esc(a.reason || "—") + "</td></tr>";
    });
    html += "</tbody></table></div>";
    box.innerHTML = html;
  }

  function isProjectEntity(entityType, entityId, projectId) {
    var map = {
      Project: function (id) { return id === projectId; },
      Document: function (id) { var d = db.get("documents", id); return d && d.projectId === projectId; },
      DocumentRevision: function (id) { var r = db.get("documentRevisions", id); var d = r && db.get("documents", r.documentId); return d && d.projectId === projectId; },
      BOQRevision: function (id) { var r = db.get("boqRevisions", id); var b = r && db.get("boqs", r.boqId); return b && b.projectId === projectId; },
      BOQItem: function (id) { var i = db.get("boqItems", id); var r = i && db.get("boqRevisions", i.boqRevisionId); var b = r && db.get("boqs", r.boqId); return b && b.projectId === projectId; },
      WBSVersion: function (id) { var v = db.get("wbsVersions", id); var w = v && db.get("wbsList", v.wbsId); return w && w.projectId === projectId; },
      WBSNode: function (id) { var n = db.get("wbsNodes", id); var v = n && db.get("wbsVersions", n.wbsVersionId); var w = v && db.get("wbsList", v.wbsId); return w && w.projectId === projectId; },
      Activity: function (id) { var a = db.get("activities", id); return a && a.projectId === projectId; },
      ActivityDictionaryItem: function () { return true; },
    };
    return map[entityType] ? !!map[entityType](entityId) : false;
  }

  PP.views = PP.views || {};
  PP.views.governance = { render: render };
})();
