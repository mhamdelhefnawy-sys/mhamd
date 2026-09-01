/*
 * Offline data store — everything lives in the browser's localStorage as one JSON
 * document. This is the "local-first" decision taken to its logical end for the
 * offline variant: no server, no build step, no install. Opening index.html is the
 * whole setup.
 *
 * Collections mirror the M00-M05 data model from the module roadmap 1:1 (see the
 * project's planning-platform-modules artifact) so a future server-backed version can
 * reuse the same shapes without a redesign.
 */
(function (global) {
  "use strict";

  var STORAGE_KEY = "pp_offline_db_v1";

  var COLLECTIONS = [
    "projects", "projectRevisions", "holidays",
    "documents", "documentRevisions",
    "boqs", "boqRevisions", "boqItems",
    "wbsList", "wbsVersions", "wbsNodes",
    "dictionaryItems", "activities", "activityVersions", "boqMappings",
    "relationshipTemplates", "relationships",
    "auditLog", "decisionLog", "reviewQueue", "conflicts",
  ];

  function emptyData() {
    var data = { meta: { version: 1, createdAt: new Date().toISOString() } };
    COLLECTIONS.forEach(function (c) { data[c] = []; });
    return data;
  }

  function newId(prefix) {
    return (prefix || "id") + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 9);
  }

  function load() {
    try {
      var raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) return emptyData();
      var parsed = JSON.parse(raw);
      // Fill in any collection missing from an older save (forward-compatible schema growth).
      COLLECTIONS.forEach(function (c) { if (!Array.isArray(parsed[c])) parsed[c] = []; });
      return parsed;
    } catch (e) {
      console.error("Failed to read local database, starting fresh.", e);
      return emptyData();
    }
  }

  var state = load();

  function save() {
    global.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function all(collection) {
    return state[collection] || [];
  }

  function get(collection, id) {
    return all(collection).find(function (r) { return r.id === id; }) || null;
  }

  function query(collection, predicate) {
    return all(collection).filter(predicate);
  }

  function insert(collection, record, idPrefix) {
    if (!record.id) record.id = newId(idPrefix || collection);
    if (!record.createdAt) record.createdAt = new Date().toISOString();
    state[collection].push(record);
    save();
    return record;
  }

  function update(collection, id, patch) {
    var record = get(collection, id);
    if (!record) throw new Error("Record not found: " + collection + "/" + id);
    Object.assign(record, patch, { updatedAt: new Date().toISOString() });
    save();
    return record;
  }

  function remove(collection, id) {
    var idx = state[collection].findIndex(function (r) { return r.id === id; });
    if (idx === -1) return false;
    state[collection].splice(idx, 1);
    save();
    return true;
  }

  function resetAll() {
    state = emptyData();
    save();
  }

  function replaceAll(data) {
    COLLECTIONS.forEach(function (c) { if (!Array.isArray(data[c])) data[c] = []; });
    if (!data.meta) data.meta = { version: 1, createdAt: new Date().toISOString() };
    state = data;
    save();
  }

  function exportJson() {
    return JSON.stringify(state, null, 2);
  }

  global.PP = global.PP || {};
  global.PP.db = {
    COLLECTIONS: COLLECTIONS,
    newId: newId,
    all: all,
    get: get,
    query: query,
    insert: insert,
    update: update,
    remove: remove,
    resetAll: resetAll,
    replaceAll: replaceAll,
    exportJson: exportJson,
    raw: function () { return state; },
  };
})(window);
