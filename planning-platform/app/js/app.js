/*
 * Shell + hash router. Routes:
 *   #/projects
 *   #/project/:id/overview
 *   #/project/:id/documents
 *   #/project/:id/boq
 *   #/project/:id/wbs
 *   #/project/:id/activities
 *   #/project/:id/governance
 */
(function () {
  "use strict";
  var db = PP.db, gov = PP.gov, util = PP.util;

  var NAV_ITEMS = [
    { key: "overview", label: "نظرة عامة (M01)" },
    { key: "documents", label: "المستندات (M02)" },
    { key: "boq", label: "BOQ (M03)" },
    { key: "wbs", label: "هيكل الأعمال WBS (M04)" },
    { key: "activities", label: "الأنشطة (M05)" },
    { key: "governance", label: "الحوكمة والتدقيق (M00)" },
  ];

  // ---------- theme ----------
  function initTheme() {
    var saved = localStorage.getItem("pp_theme");
    if (saved) document.documentElement.setAttribute("data-theme", saved);
    document.getElementById("theme-toggle").addEventListener("click", function () {
      var cur = document.documentElement.getAttribute("data-theme");
      var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      var next = cur === "dark" ? "light" : cur === "light" ? "dark" : (prefersDark ? "light" : "dark");
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("pp_theme", next);
    });
  }

  // ---------- actor / role ----------
  function initActor() {
    var actorInput = document.getElementById("actor-input");
    var roleSelect = document.getElementById("role-select");
    actorInput.value = gov.currentActor() === "مستخدم غير محدد" ? "" : gov.currentActor();
    roleSelect.value = gov.currentRole();
    actorInput.addEventListener("change", function () { gov.setCurrentActor(actorInput.value.trim()); });
    roleSelect.addEventListener("change", function () { gov.setCurrentRole(roleSelect.value); });
  }

  // ---------- backup ----------
  function initBackup() {
    document.getElementById("backup-export").addEventListener("click", function () {
      var stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      util.downloadFile("planning-platform-backup-" + stamp + ".json", db.exportJson(), "application/json");
    });
    document.getElementById("backup-import").addEventListener("change", function (e) {
      var file = e.target.files[0];
      if (!file) return;
      if (!confirm("سيستبدل هذا كل البيانات المحلية الحالية بمحتوى الملف المستورد. هل تريد المتابعة؟")) {
        e.target.value = "";
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var data = JSON.parse(reader.result);
          db.replaceAll(data);
          alert("تم استيراد النسخة الاحتياطية بنجاح.");
          render();
        } catch (err) {
          alert("تعذّرت قراءة الملف: " + err.message);
        }
        e.target.value = "";
      };
      reader.readAsText(file);
    });
  }

  // ---------- project switcher ----------
  function renderProjectSwitch(activeProjectId) {
    var wrap = document.getElementById("project-switch");
    var projects = db.all("projects");
    var select = document.createElement("select");
    var optNone = document.createElement("option");
    optNone.value = "";
    optNone.textContent = "— قائمة المشاريع —";
    select.appendChild(optNone);
    projects.forEach(function (p) {
      var opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.code + " · " + p.name;
      if (p.id === activeProjectId) opt.selected = true;
      select.appendChild(opt);
    });
    select.addEventListener("change", function () {
      if (select.value) location.hash = "#/project/" + select.value + "/overview";
      else location.hash = "#/projects";
    });
    wrap.innerHTML = "";
    wrap.appendChild(select);
  }

  // ---------- sidenav ----------
  function renderSidenav(projectId, activeKey) {
    var nav = document.getElementById("sidenav");
    nav.innerHTML = "";
    var topLink = document.createElement("a");
    topLink.href = "#/projects";
    topLink.textContent = "↩ كل المشاريع";
    topLink.style.marginBottom = "10px";
    nav.appendChild(topLink);

    if (!projectId) {
      nav.insertAdjacentHTML("beforeend", '<div class="nav-group-title">لا يوجد مشروع محدد</div>');
      return;
    }
    var title = document.createElement("div");
    title.className = "nav-group-title";
    title.textContent = "موديولات المشروع";
    nav.appendChild(title);

    NAV_ITEMS.forEach(function (item) {
      var a = document.createElement("a");
      a.href = "#/project/" + projectId + "/" + item.key;
      if (item.key === activeKey) a.className = "active";
      var span = document.createElement("span");
      span.textContent = item.label;
      a.appendChild(span);
      if (item.key === "governance") {
        var openCount = gov.openReviewCount(projectId) + gov.openConflictCount(projectId);
        if (openCount > 0) {
          var count = document.createElement("span");
          count.className = "count";
          count.textContent = openCount;
          a.appendChild(count);
        }
      }
      nav.appendChild(a);
    });
  }

  // ---------- router ----------
  function parseHash() {
    var hash = location.hash.replace(/^#\/?/, "");
    var parts = hash.split("/").filter(Boolean);
    if (parts[0] === "project" && parts[1]) {
      return { projectId: parts[1], view: parts[2] || "overview" };
    }
    return { projectId: null, view: "projects" };
  }

  function render() {
    var route = parseHash();
    renderProjectSwitch(route.projectId);
    renderSidenav(route.projectId, route.view);
    var root = document.getElementById("view-root");
    root.innerHTML = "";

    if (!route.projectId) {
      PP.views.projects.render(root, {});
      return;
    }
    var project = db.get("projects", route.projectId);
    if (!project) {
      root.innerHTML = '<div class="empty">المشروع غير موجود. <a href="#/projects">عودة لقائمة المشاريع</a></div>';
      return;
    }
    switch (route.view) {
      case "overview": PP.views.projects.renderDetail(root, project); break;
      case "documents": PP.views.documents.render(root, project); break;
      case "boq": PP.views.boq.render(root, project); break;
      case "wbs": PP.views.wbs.render(root, project); break;
      case "activities": PP.views.activities.render(root, project); break;
      case "governance": PP.views.governance.render(root, project); break;
      default: root.innerHTML = '<div class="empty">شاشة غير معروفة.</div>';
    }
  }
  PP.rerender = render;

  window.addEventListener("hashchange", render);
  document.addEventListener("DOMContentLoaded", function () {
    initTheme();
    initActor();
    initBackup();
    if (!location.hash) location.hash = "#/projects";
    render();
  });
})();
