/* M04 — WBS: versioned tree editor with an approval lock. Editing an APPROVED version
 * is never allowed in place — the only way forward is cloning into a new version, which
 * is the literal "editing an approved version never destroys the previous one" rule.
 */
(function () {
  "use strict";
  var db = PP.db, gov = PP.gov, util = PP.util, esc = PP.util.escapeHtml;

  function ensureWbs(project) {
    var wbs = db.query("wbsList", function (w) { return w.projectId === project.id; })[0];
    if (!wbs) wbs = db.insert("wbsList", { projectId: project.id, name: "WBS الرئيسي" });
    return wbs;
  }

  function versionBadge(status) {
    var map = {
      PROPOSED: ["badge-accent", "مقترحة"], MODIFIED: ["badge-warn", "معدَّلة"],
      APPROVED: ["badge-good", "معتمدة"], SUPERSEDED: ["badge-muted", "مستبدَلة"],
    };
    var m = map[status] || ["badge-muted", status];
    return '<span class="badge ' + m[0] + '">' + m[1] + "</span>";
  }

  function render(root, project) {
    var wbs = ensureWbs(project);
    var versions = db.query("wbsVersions", function (v) { return v.wbsId === wbs.id; }).sort(function (a, b) { return b.versionNumber - a.versionNumber; });

    var html = '<div class="view-head"><div><h2>هيكل تجزئة الأعمال (WBS)</h2>' +
      "<p>M04 — محرر شجري، تعدد نسخ، وقفل عند الاعتماد. لا يوجد اقتراح ذكاء اصطناعي هنا — فقط قالب أولي حتمي مبني على المباني/الطوابق التي تُدخلها.</p></div>" +
      '<div class="view-actions"><button class="btn btn-primary" id="btn-new-version">+ نسخة WBS جديدة</button></div></div>';

    if (versions.length === 0) {
      html += '<div class="empty">لا توجد نسخ WBS بعد.</div>';
      root.innerHTML = html;
    } else {
      html += '<div class="tabs" id="ver-tabs">' + versions.map(function (v, i) {
        return '<button data-ver="' + v.id + '" class="' + (i === 0 ? "active" : "") + '">' + esc(v.label) + " " + versionBadge(v.status) + "</button>";
      }).join("") + "</div><div id=\"ver-body\"></div>";
      root.innerHTML = html;
      root.querySelectorAll("#ver-tabs button").forEach(function (btn) {
        btn.addEventListener("click", function () {
          root.querySelectorAll("#ver-tabs button").forEach(function (b) { b.classList.remove("active"); });
          btn.classList.add("active");
          renderVersionBody(root.querySelector("#ver-body"), project, wbs, versions.find(function (v) { return v.id === btn.getAttribute("data-ver"); }));
        });
      });
      renderVersionBody(root.querySelector("#ver-body"), project, wbs, versions[0]);
    }

    root.querySelector("#btn-new-version").addEventListener("click", function () { openNewVersionDialog(project, wbs, versions); });
  }

  function openNewVersionDialog(project, wbs, versions) {
    var dlg = document.createElement("dialog");
    dlg.innerHTML = '<div class="dialog-inner"><h3>نسخة WBS جديدة</h3>' +
      '<div class="field"><label>استراتيجية</label><select id="v-strategy">' +
      ["LOCATION", "DISCIPLINE", "HYBRID", "MANUAL"].map(function (s) { return "<option value=\"" + s + "\">" + s + "</option>"; }).join("") +
      "</select></div>" +
      '<div class="field"><label>تبدأ من</label><select id="v-clone"><option value="">فارغة</option>' +
      versions.map(function (v) { return '<option value="' + v.id + '">استنساخ من ' + esc(v.label) + "</option>"; }).join("") + "</select></div>" +
      '<div class="dialog-actions"><button class="btn btn-primary" id="v-save">إنشاء</button><button class="btn btn-ghost" id="v-cancel">إلغاء</button></div></div>';
    document.body.appendChild(dlg);
    dlg.showModal();
    dlg.querySelector("#v-cancel").addEventListener("click", function () { dlg.close(); dlg.remove(); });
    dlg.querySelector("#v-save").addEventListener("click", function () {
      var nextNumber = versions.length > 0 ? Math.max.apply(null, versions.map(function (v) { return v.versionNumber; })) + 1 : 0;
      var version = db.insert("wbsVersions", {
        wbsId: wbs.id, versionNumber: nextNumber, label: "Rev " + String(nextNumber).padStart(2, "0"),
        status: "PROPOSED", strategy: dlg.querySelector("#v-strategy").value,
      });
      var cloneFromId = dlg.querySelector("#v-clone").value;
      if (cloneFromId) {
        var sourceNodes = db.query("wbsNodes", function (n) { return n.wbsVersionId === cloneFromId; });
        var idMap = {};
        sourceNodes.forEach(function (n) { idMap[n.id] = db.newId("wbsnode"); });
        sourceNodes.forEach(function (n) {
          db.insert("wbsNodes", {
            id: idMap[n.id], wbsVersionId: version.id, parentId: n.parentId ? idMap[n.parentId] : null,
            code: n.code, name: n.name, level: n.level, sortOrder: n.sortOrder, status: "USER_EDITED",
          });
        });
      }
      gov.writeAudit({ entityType: "WBSVersion", entityId: version.id, action: "CREATE", newValue: version });
      dlg.close(); dlg.remove();
      PP.rerender();
    });
  }

  function buildTree(nodes) {
    var byParent = {};
    nodes.forEach(function (n) { var key = n.parentId || "root"; (byParent[key] = byParent[key] || []).push(n); });
    Object.values(byParent).forEach(function (list) { list.sort(function (a, b) { return a.sortOrder - b.sortOrder; }); });
    return byParent;
  }

  function renderVersionBody(box, project, wbs, version) {
    var editable = version.status === "PROPOSED" || version.status === "MODIFIED";
    var nodes = db.query("wbsNodes", function (n) { return n.wbsVersionId === version.id; });
    var byParent = buildTree(nodes);

    var html = "";
    if (!editable && version.status !== "APPROVED") {
      html += '<div class="helper-note">نسخة مستبدَلة — للاطلاع فقط.</div>';
    }
    if (version.status === "APPROVED") {
      html += '<div class="helper-note">نسخة معتمدة ومقفلة. لتعديلها أنشئ نسخة جديدة واستنسخ منها.</div>';
    }
    if (editable) {
      html += '<div class="card" style="margin-bottom:14px"><h3>قالب أولي حتمي (اختياري)</h3>' +
        '<p style="font-size:12.5px;color:var(--ink-soft)">يبني هيكلًا موقعيًا مبنيًا فقط على قوائم المباني/الطوابق التي تكتبها — بلا أي استنتاج ذكاء اصطناعي.</p>' +
        '<div class="grid-2"><div class="field"><label>المباني (مفصولة بفواصل)</label><input id="tpl-buildings" placeholder="B01,B02"/></div>' +
        '<div class="field"><label>الطوابق (مفصولة بفواصل)</label><input id="tpl-floors" placeholder="SS,GF,1,2,Roof"/></div></div>' +
        '<button class="btn btn-sm" id="btn-build-template">توليد الهيكل</button></div>';
    }

    html += '<div class="dialog-actions" style="margin-bottom:10px">' +
      (editable ? '<button class="btn btn-sm" id="btn-add-root">+ عقدة جذر</button>' : "") +
      (editable && nodes.length > 0 ? '<button class="btn btn-sm btn-primary" id="btn-approve-ver">اعتماد هذه النسخة</button>' : "") +
      "</div>";

    if (nodes.length === 0) {
      html += '<div class="empty">لا توجد عقد بعد.</div>';
    } else {
      html += '<div class="tree" id="tree-root"></div>';
    }
    box.innerHTML = html;

    if (nodes.length > 0) {
      renderTreeLevel(box.querySelector("#tree-root"), byParent, "root", 0, project, version, editable);
    }
    if (editable) {
      box.querySelector("#btn-add-root").addEventListener("click", function () { openNodeDialog(project, version, null, nodes); });
      var appr = box.querySelector("#btn-approve-ver");
      if (appr) appr.addEventListener("click", function () { approveVersion(project, wbs, version); });
      box.querySelector("#btn-build-template").addEventListener("click", function () {
        var buildings = box.querySelector("#tpl-buildings").value.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
        var floors = box.querySelector("#tpl-floors").value.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
        if (buildings.length === 0) { alert("أدخل مبنى واحدًا على الأقل."); return; }
        buildings.forEach(function (bcode, bi) {
          var root = db.insert("wbsNodes", { wbsVersionId: version.id, parentId: null, code: bcode, name: "مبنى " + bcode, level: 0, sortOrder: bi, status: "DERIVED" });
          floors.forEach(function (fcode, fi) {
            db.insert("wbsNodes", { wbsVersionId: version.id, parentId: root.id, code: bcode + "-" + fcode, name: fcode, level: 1, sortOrder: fi, status: "DERIVED" });
          });
        });
        markModified(version);
        gov.writeAudit({ entityType: "WBSVersion", entityId: version.id, action: "TEMPLATE_BUILD", reason: buildings.length + " مبنى × " + floors.length + " طابق" });
        PP.rerender();
      });
    }
  }

  function markModified(version) {
    if (version.status === "PROPOSED") db.update("wbsVersions", version.id, { status: "MODIFIED" });
  }

  function renderTreeLevel(container, byParent, parentKey, depth, project, version, editable) {
    var children = byParent[parentKey] || [];
    children.forEach(function (node, idx) {
      var row = document.createElement("div");
      row.className = "tree-row";
      row.innerHTML =
        '<span class="indent" style="width:' + depth * 20 + 'px"></span>' +
        '<span class="code">' + esc(node.code) + "</span>" +
        '<span class="name">' + esc(node.name) + "</span>" +
        '<span class="badge badge-muted">' + esc(node.status) + "</span>" +
        (editable ? '<span class="row-actions">' +
          '<button class="btn btn-sm" data-up="' + node.id + '" ' + (idx === 0 ? "disabled" : "") + '>↑</button>' +
          '<button class="btn btn-sm" data-down="' + node.id + '" ' + (idx === children.length - 1 ? "disabled" : "") + '>↓</button>' +
          '<button class="btn btn-sm" data-add-child="' + node.id + '">+ فرع</button>' +
          '<button class="btn btn-sm" data-edit="' + node.id + '">تعديل</button>' +
          '<button class="btn btn-sm" data-move="' + node.id + '">نقل</button>' +
          '<button class="btn btn-sm btn-danger" data-del="' + node.id + '">حذف</button></span>' : "");
      container.appendChild(row);
      renderTreeLevel(container, byParent, node.id, depth + 1, project, version, editable);
    });

    if (editable) wireRowActions(container, byParent, project, version);
  }

  function wireRowActions(container, byParent, project, version) {
    var allNodes = db.query("wbsNodes", function (n) { return n.wbsVersionId === version.id; });
    container.querySelectorAll("[data-add-child]").forEach(function (btn) {
      btn.onclick = function () { openNodeDialog(project, version, btn.getAttribute("data-add-child"), allNodes); };
    });
    container.querySelectorAll("[data-edit]").forEach(function (btn) {
      btn.onclick = function () { openNodeDialog(project, version, undefined, allNodes, db.get("wbsNodes", btn.getAttribute("data-edit"))); };
    });
    container.querySelectorAll("[data-del]").forEach(function (btn) {
      btn.onclick = function () {
        var id = btn.getAttribute("data-del");
        if (allNodes.some(function (n) { return n.parentId === id; })) { alert("لا يمكن حذف عقدة لها فروع — احذف الفروع أولًا."); return; }
        var node = db.get("wbsNodes", id);
        db.remove("wbsNodes", id);
        gov.writeAudit({ entityType: "WBSNode", entityId: id, action: "DELETE", oldValue: node });
        markModified(version);
        PP.rerender();
      };
    });
    container.querySelectorAll("[data-up], [data-down]").forEach(function (btn) {
      btn.onclick = function () {
        var id = btn.getAttribute("data-up") || btn.getAttribute("data-down");
        var dir = btn.hasAttribute("data-up") ? -1 : 1;
        var node = db.get("wbsNodes", id);
        var siblings = allNodes.filter(function (n) { return n.parentId === node.parentId; }).sort(function (a, b) { return a.sortOrder - b.sortOrder; });
        var idx = siblings.findIndex(function (n) { return n.id === id; });
        var swapWith = siblings[idx + dir];
        if (!swapWith) return;
        var a = node.sortOrder, b = swapWith.sortOrder;
        db.update("wbsNodes", node.id, { sortOrder: b });
        db.update("wbsNodes", swapWith.id, { sortOrder: a });
        markModified(version);
        PP.rerender();
      };
    });
    container.querySelectorAll("[data-move]").forEach(function (btn) {
      btn.onclick = function () { openMoveDialog(version, allNodes, btn.getAttribute("data-move")); };
    });
  }

  function descendantIds(nodes, id) {
    var result = [];
    var stack = [id];
    while (stack.length) {
      var cur = stack.pop();
      nodes.filter(function (n) { return n.parentId === cur; }).forEach(function (n) { result.push(n.id); stack.push(n.id); });
    }
    return result;
  }

  function openMoveDialog(version, allNodes, nodeId) {
    var node = db.get("wbsNodes", nodeId);
    var forbidden = descendantIds(allNodes, nodeId).concat([nodeId]);
    var options = allNodes.filter(function (n) { return forbidden.indexOf(n.id) === -1; });
    var dlg = document.createElement("dialog");
    dlg.innerHTML = '<div class="dialog-inner"><h3>نقل "' + esc(node.name) + '"</h3>' +
      '<div class="field"><label>الأب الجديد</label><select id="m-parent"><option value="">— جذر —</option>' +
      options.map(function (o) { return '<option value="' + o.id + '">' + esc(o.code) + " · " + esc(o.name) + "</option>"; }).join("") + "</select></div>" +
      '<div class="dialog-actions"><button class="btn btn-primary" id="m-save">نقل</button><button class="btn btn-ghost" id="m-cancel">إلغاء</button></div></div>';
    document.body.appendChild(dlg);
    dlg.showModal();
    dlg.querySelector("#m-cancel").addEventListener("click", function () { dlg.close(); dlg.remove(); });
    dlg.querySelector("#m-save").addEventListener("click", function () {
      var newParentId = dlg.querySelector("#m-parent").value || null;
      db.update("wbsNodes", nodeId, { parentId: newParentId, status: "USER_EDITED" });
      markModified(db.get("wbsVersions", version.id));
      gov.writeAudit({ entityType: "WBSNode", entityId: nodeId, action: "MOVE", newValue: { parentId: newParentId } });
      dlg.close(); dlg.remove();
      PP.rerender();
    });
  }

  function openNodeDialog(project, version, parentId, allNodes, existing) {
    var dlg = document.createElement("dialog");
    dlg.innerHTML = '<div class="dialog-inner"><h3>' + (existing ? "تعديل عقدة" : "عقدة جديدة") + "</h3>" +
      '<div class="field"><label>الكود *</label><input id="n-code" value="' + (existing ? esc(existing.code) : "") + '"/></div>' +
      '<div class="field"><label>الاسم *</label><input id="n-name" value="' + (existing ? esc(existing.name) : "") + '"/></div>' +
      '<div class="dialog-actions"><button class="btn btn-primary" id="n-save">حفظ</button><button class="btn btn-ghost" id="n-cancel">إلغاء</button></div></div>';
    document.body.appendChild(dlg);
    dlg.showModal();
    dlg.querySelector("#n-cancel").addEventListener("click", function () { dlg.close(); dlg.remove(); });
    dlg.querySelector("#n-save").addEventListener("click", function () {
      var code = dlg.querySelector("#n-code").value.trim();
      var name = dlg.querySelector("#n-name").value.trim();
      if (!code || !name) { alert("الكود والاسم مطلوبان."); return; }
      var dupe = allNodes.some(function (n) { return n.code === code && (!existing || n.id !== existing.id); });
      if (dupe) { alert("يوجد بالفعل عقدة بنفس الكود في هذه النسخة."); return; }

      if (existing) {
        db.update("wbsNodes", existing.id, { code: code, name: name, status: "USER_EDITED" });
        gov.writeAudit({ entityType: "WBSNode", entityId: existing.id, action: "UPDATE" });
      } else {
        var parent = parentId ? db.get("wbsNodes", parentId) : null;
        var siblings = allNodes.filter(function (n) { return n.parentId === (parentId || null); });
        var node = db.insert("wbsNodes", {
          wbsVersionId: version.id, parentId: parentId || null, code: code, name: name,
          level: parent ? parent.level + 1 : 0, sortOrder: siblings.length, status: "USER_EDITED",
        });
        gov.writeAudit({ entityType: "WBSNode", entityId: node.id, action: "CREATE", newValue: node });
      }
      markModified(version);
      dlg.close(); dlg.remove();
      PP.rerender();
    });
  }

  function approveVersion(project, wbs, version) {
    var rationale = prompt("سبب/أساس اعتماد هذه النسخة (سيُسجَّل في سجل القرارات):", "");
    if (rationale === null) return;
    var others = db.query("wbsVersions", function (v) { return v.wbsId === wbs.id && v.status === "APPROVED"; });
    others.forEach(function (v) { db.update("wbsVersions", v.id, { status: "SUPERSEDED" }); });
    db.update("wbsVersions", version.id, { status: "APPROVED", rationale: rationale, approvedBy: gov.currentActor(), approvedAt: new Date().toISOString() });
    // Lock every node's status forward to APPROVED so the record-status trail is honest.
    db.query("wbsNodes", function (n) { return n.wbsVersionId === version.id; }).forEach(function (n) { db.update("wbsNodes", n.id, { status: "APPROVED" }); });
    gov.writeAudit({ entityType: "WBSVersion", entityId: version.id, action: "APPROVE" });
    gov.recordDecision({
      projectId: project.id, entityType: "WBSVersion", entityId: version.id,
      title: "اعتماد " + version.label, description: rationale || "بدون سبب مُدخَل",
      alternativesRejected: others.map(function (v) { return v.label; }),
    });
    PP.rerender();
  }

  PP.views = PP.views || {};
  PP.views.wbs = { render: render, ensureWbs: ensureWbs };
})();
