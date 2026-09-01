/* Opt-in demo project — never runs automatically (M00 principle: no fake data
 * presented as user data). Walks M01 through M05 end to end, including one BOQ item
 * left deliberately unmatched by the dictionary so the review-queue path is visible. */
(function (global) {
  "use strict";
  var db = PP.db, gov = PP.gov, util = PP.util, conf = PP.confidence;

  function loadDemo() {
    var existing = db.query("projects", function (p) { return p.code === "DEMO-01"; })[0];
    if (existing) return existing;

    gov.setCurrentActor(gov.currentActor() === "مستخدم غير محدد" ? "زائر تجريبي" : gov.currentActor());

    var start = util.todayIso();
    var weekend = [5];
    var project = db.insert("projects", {
      code: "DEMO-01", name: "مبنى إداري تجريبي — القاهرة الجديدة",
      client: "شركة تجريبية للاستثمار العقاري", consultant: "مكتب استشاري تجريبي", contractor: "شركة مقاولات تجريبية",
      projectType: "تجاري", location: "القاهرة الجديدة", contractType: "Lump Sum",
      contractValue: 45000000, currency: "EGP",
      expectedStartDate: start, workingDaysPerWeek: 6, weekendDays: "5", timezone: "Africa/Cairo",
      contractDurationDays: 180, status: "DRAFT", revisionNumber: 0,
    });
    db.update("projects", project.id, { plannedFinishDate: util.addWorkingDays(start, 180, weekend, []) });
    project = db.get("projects", project.id);
    gov.writeAudit({ entityType: "Project", entityId: project.id, action: "CREATE", newValue: project });
    db.update("projects", project.id, { status: "APPROVED", approvedBy: gov.currentActor(), approvedAt: new Date().toISOString() });
    project = db.get("projects", project.id);
    gov.recordDecision({ projectId: project.id, entityType: "Project", entityId: project.id, title: "اعتماد بيانات المشروع التجريبي", description: "بيانات تجريبية لتوضيح تدفق M01-M05." });

    db.insert("holidays", { projectId: project.id, date: util.addWorkingDays(start, 30, [], []), name: "عطلة رسمية تجريبية" });

    // ---- M04: WBS ----
    var wbs = db.insert("wbsList", { projectId: project.id, name: "WBS الرئيسي" });
    var version = db.insert("wbsVersions", { wbsId: wbs.id, versionNumber: 0, label: "Rev 00", status: "PROPOSED", strategy: "LOCATION" });
    var b01 = db.insert("wbsNodes", { wbsVersionId: version.id, parentId: null, code: "B01", name: "مبنى B01", level: 0, sortOrder: 0, status: "DERIVED" });
    var ss = db.insert("wbsNodes", { wbsVersionId: version.id, parentId: b01.id, code: "B01-SS", name: "الأساسات (Substructure)", level: 1, sortOrder: 0, status: "DERIVED" });
    var gf = db.insert("wbsNodes", { wbsVersionId: version.id, parentId: b01.id, code: "B01-GF", name: "الدور الأرضي", level: 1, sortOrder: 1, status: "DERIVED" });
    var ff = db.insert("wbsNodes", { wbsVersionId: version.id, parentId: b01.id, code: "B01-FF", name: "الدور الأول", level: 1, sortOrder: 2, status: "DERIVED" });
    db.update("wbsVersions", version.id, { status: "APPROVED", rationale: "هيكل موقعي مبسّط لغرض العرض التوضيحي.", approvedBy: gov.currentActor(), approvedAt: new Date().toISOString() });
    db.query("wbsNodes", function (n) { return n.wbsVersionId === version.id; }).forEach(function (n) { db.update("wbsNodes", n.id, { status: "APPROVED" }); });
    gov.recordDecision({ projectId: project.id, entityType: "WBSVersion", entityId: version.id, title: "اعتماد Rev 00", description: "هيكل موقعي مبسّط لغرض العرض التوضيحي." });

    // ---- M05: dictionary (global — usable by any project) ----
    function dict(name, keywords, unit, productivity, discipline) {
      var existingDict = db.query("dictionaryItems", function (d) { return d.name === name; })[0];
      if (existingDict) return existingDict;
      return db.insert("dictionaryItems", { projectId: null, name: name, discipline: discipline, unit: unit, defaultProductivity: productivity, boqKeywords: keywords, isActive: true });
    }
    var dExcavation = dict("أعمال الحفر", "excavation,حفر", "m3", 60, "مدني");
    var dBlinding = dict("خرسانة عادية (بلطة)", "blinding,plain concrete", "m3", 25, "إنشائي");
    var dFooting = dict("خرسانة مسلحة للقواعد", "footing,reinforced concrete", "m3", 20, "إنشائي");
    var dBlockwork = dict("أعمال المباني بالطوب", "block,masonry,blockwork", "m2", 35, "معماري");
    var dCeramic = dict("تركيب بلاط سيراميك", "ceramic,tiling,tile", "m2", 40, "معماري");
    var dPainting = dict("دهانات داخلية", "painting,paint", "m2", 80, "معماري");

    // ---- M08: standard relationship library (global) — real construction logic, not
    // blind sequencing: each entry carries the methodology reason for the link/lag.
    function tpl(predId, succId, type, lag, notes) {
      var dupe = db.query("relationshipTemplates", function (t) { return t.predecessorDictionaryItemId === predId && t.successorDictionaryItemId === succId; })[0];
      if (dupe) return dupe;
      return db.insert("relationshipTemplates", { predecessorDictionaryItemId: predId, successorDictionaryItemId: succId, type: type, lag: lag, notes: notes });
    }
    tpl(dExcavation.id, dBlinding.id, "FS", 0, "لا يمكن صب البلطة قبل اكتمال الحفر بالكامل.");
    tpl(dBlinding.id, dFooting.id, "FS", 1, "يوم تجفيف أدنى لخرسانة البلطة قبل تسليح القواعد.");
    tpl(dFooting.id, dBlockwork.id, "FS", 3, "فترة معالجة الخرسانة (Curing) قبل بدء أعمال المباني فوقها.");
    tpl(dBlockwork.id, dCeramic.id, "FS", 0, "لا يبدأ التبليط قبل اكتمال المباني المحيطة بالمساحة.");
    tpl(dBlockwork.id, dPainting.id, "FS", 7, "فترة جفاف اللياسة/المباني قبل بدء الدهانات.");

    // ---- M03: BOQ ----
    var boq = db.insert("boqs", { projectId: project.id, name: "BOQ الرئيسي" });
    var rev = db.insert("boqRevisions", { boqId: boq.id, label: "Original", status: "DRAFT" });
    var rows = [
      ["1.01", "Excavation for foundations", "m3", 500, 180],
      ["2.01", "Plain concrete blinding", "m3", 40, 2200],
      ["2.02", "Reinforced concrete for footings", "m3", 120, 4800],
      ["3.01", "Blockwork masonry walls 20cm", "m2", 800, 350],
      ["4.01", "Ceramic floor tiling", "m2", 600, 420],
      ["4.02", "Internal wall painting", "m2", 1500, 90],
      ["5.01", "Electrical internal wiring points", "point", 300, 650],
    ];
    rows.forEach(function (r) {
      db.insert("boqItems", {
        boqRevisionId: rev.id, itemNo: r[0], description: r[1], unit: r[2], quantity: r[3], rate: r[4],
        amount: Math.round(r[3] * r[4] * 100) / 100, status: "EXTRACTED",
      });
    });
    db.update("boqRevisions", rev.id, { status: "APPROVED" });
    gov.recordDecision({ projectId: project.id, entityType: "BOQRevision", entityId: rev.id, title: "اعتماد BOQ التجريبي", description: rows.length + " بند." });

    // ---- generate activities (same rule-based engine the UI uses) ----
    var items = db.query("boqItems", function (i) { return i.boqRevisionId === rev.id; });
    var dictionary = db.query("dictionaryItems", function (d) { return d.isActive; });
    var seq = 0;
    var nodeFor = { "Excavation": ss.id, "blinding": ss.id, "footing": ss.id, "Block": gf.id, "Ceramic": gf.id, "painting": gf.id };
    items.forEach(function (item) {
      var scored = dictionary.map(function (d) { return { dict: d, score: conf.keywordMatchScore(item.description, d.boqKeywords) }; })
        .filter(function (s) { return s.score > 0; }).sort(function (a, b) { return b.score - a.score; });
      if (scored.length === 0) {
        gov.raiseReviewItem({ projectId: project.id, kind: "LOW_CONFIDENCE", entityType: "BOQItem", entityId: item.id, reason: 'لم يُعثر على عنصر قاموس مطابق لبند BOQ: "' + item.description + '"' });
        return;
      }
      var best = scored[0], second = scored[1];
      var unitMatch = item.unit && best.dict.unit && item.unit.toLowerCase() === best.dict.unit.toLowerCase() ? 1 : 0.5;
      var ambiguity = second ? Math.max(0, 1 - second.score / best.score) : 1;
      var result = conf.computeConfidence({ keywordMatch: best.score, unitMatch: unitMatch, ambiguity: ambiguity });
      seq++;
      var code = project.code + "-ACT-" + String(seq).padStart(4, "0");
      var duration = item.quantity != null && best.dict.defaultProductivity ? Math.ceil(item.quantity / best.dict.defaultProductivity) : null;
      var wbsNodeId = null;
      Object.keys(nodeFor).forEach(function (kw) { if (item.description.indexOf(kw) !== -1) wbsNodeId = nodeFor[kw]; });
      var activity = db.insert("activities", {
        projectId: project.id, wbsNodeId: wbsNodeId, dictionaryItemId: best.dict.id, code: code, name: best.dict.name,
        discipline: best.dict.discipline, unit: item.unit, quantity: item.quantity, durationDays: duration,
        status: "PROPOSED", confidenceScore: result.score, confidenceFactors: JSON.stringify(result.factors),
        confidenceRationale: JSON.stringify(result.rationale),
      });
      db.insert("boqMappings", { boqItemId: item.id, activityId: activity.id, quantity: item.quantity, source: "AUTO" });
      if (item.description.indexOf("Ceramic") !== -1) {
        // M06 demonstration: split this single BOQ item's quantity across two WBS
        // locations (GF / FF) as two separate, fully-reconciled mappings — the exact
        // "distribute a BOQ quantity across floors" workflow M06 exists for.
        var mapping = db.query("boqMappings", function (m) { return m.boqItemId === item.id; })[0];
        var gfQty = 350, ffQty = item.quantity - gfQty;
        db.update("boqMappings", mapping.id, { quantity: gfQty });
        db.update("activities", activity.id, { quantity: gfQty });
        var ffActivity = db.insert("activities", {
          projectId: project.id, wbsNodeId: ff.id, dictionaryItemId: best.dict.id,
          code: project.code + "-ACT-" + String(++seq).padStart(4, "0"), name: best.dict.name + " (الدور الأول)",
          discipline: best.dict.discipline, unit: item.unit, quantity: ffQty,
          durationDays: Math.ceil(ffQty / best.dict.defaultProductivity), status: "PROPOSED",
          confidenceScore: result.score, confidenceFactors: JSON.stringify(result.factors), confidenceRationale: JSON.stringify(result.rationale),
        });
        db.insert("boqMappings", { boqItemId: item.id, activityId: ffActivity.id, quantity: ffQty, source: "MANUAL_SPLIT" });
      }
    });
    gov.writeAudit({ entityType: "BOQRevision", entityId: rev.id, action: "GENERATE_ACTIVITIES" });

    // ---- M08: propose relationships from the standard library, then approve the
    // straightforward ones so the network diagram has something real to show ----
    PP.views.relationships.generateFromTemplates(project);
    db.query("relationships", function (r) { return r.projectId === project.id; }).forEach(function (r) {
      db.update("relationships", r.id, { status: "APPROVED" });
    });

    return project;
  }

  global.PP = global.PP || {};
  global.PP.seed = { loadDemo: loadDemo };
})(window);
