/* Petey trainer intake. Bind this script to exactly one form per environment.
 * No response values, email addresses, edit URLs or photo bytes are logged or
 * retained in Script Properties. See docs/trainer-application-operations.md.
 */
var PETEY_MAPPING_VERSION = 1;
var PETEY_MAX_PHOTO_BYTES = 10 * 1024 * 1024;
var PETEY_RUN_BUDGET_MS = 240000;
var PETEY_ACK_LIMIT = 1000;
var PETEY_STATE_VERSION = 2;
var PETEY_FIELDS = [
  ['fullName', 'Full name', 'TEXT'],
  ['email', 'Email address', 'TEXT'],
  ['gender', 'How do you describe your gender?', 'MULTIPLE_CHOICE'],
  ['professionalUrl', 'Website or professional social profile', 'TEXT'],
  ['experience', 'How long have you worked as a personal trainer?', 'MULTIPLE_CHOICE'],
  ['specialties', 'What do you specialise in?', 'CHECKBOX'],
  ['coachingStyle', 'What is your coaching style like?', 'PARAGRAPH_TEXT'],
  ['bio', 'Write a short introduction for your trainer profile', 'PARAGRAPH_TEXT'],
  ['venues', 'Where can clients train with you?', 'CHECKBOX'],
  ['serviceAreas', 'Which areas and venues do you cover?', 'PARAGRAPH_TEXT'],
  ['availability', 'What times can you usually take new clients?', 'PARAGRAPH_TEXT'],
  ['acceptingClients', 'Are you accepting new clients?', 'MULTIPLE_CHOICE'],
  ['capacity', 'Anything we should know about your capacity or start date?', 'TEXT'],
  ['sessionPrice', 'What is your standard price for one session in GBP?', 'TEXT'],
  ['sessionDuration', 'How long is that session?', 'MULTIPLE_CHOICE'],
  ['packages', 'Do you offer packages or different prices by training format?', 'PARAGRAPH_TEXT'],
  ['qualification', 'What is your personal training qualification?', 'TEXT'],
  ['insurance', 'Who provides your current professional insurance and when does it expire?', 'TEXT'],
  ['otherQualifications', 'First aid and other relevant qualifications', 'PARAGRAPH_TEXT'],
  ['photo', 'Upload a clear photo for your trainer profile', 'FILE_UPLOAD'],
  ['confirmations', 'Confirm your application', 'CHECKBOX']
];

// Run once manually after setting Script Properties. Re-running validates the
// original IDs, so a deleted/recreated question cannot silently change meaning.
function setupPeteyTrainerBridge() {
  return peteyWithLock_(function () {
    var config = peteyConfig_();
    var form = peteyForm_(config);
    var props = PropertiesService.getScriptProperties();
    var stored = props.getProperty('PETEY_MAPPING_V1');
    var mapping = stored ? JSON.parse(stored) : peteySeedMapping_(form);
    peteyValidateMapping_(form, mapping);
    if (!stored) props.setProperty('PETEY_MAPPING_V1', JSON.stringify(mapping));
    // Only replace this bridge's own triggers, never unrelated form automation.
    ScriptApp.getProjectTriggers().forEach(function (trigger) {
      if (['peteyOnFormSubmit', 'reconcilePeteyTrainerApplications'].indexOf(trigger.getHandlerFunction()) !== -1) {
        ScriptApp.deleteTrigger(trigger);
      }
    });
    ScriptApp.newTrigger('peteyOnFormSubmit').forForm(form).onFormSubmit().create();
    ScriptApp.newTrigger('reconcilePeteyTrainerApplications').timeBased().everyMinutes(15).create();
    return { mappingVersion: mapping.version, questionCount: Object.keys(mapping.fields).length };
  });
}

function peteyOnFormSubmit(event) {
  if (!event || !event.response || !event.response.getId()) throw new Error('PETEY_MISSING_SUBMISSION_EVENT');
  return peteyRun_([String(event.response.getId())]);
}

function reconcilePeteyTrainerApplications() {
  return peteyRun_(null);
}

function peteyRun_(responseIds) {
  return peteyWithLock_(function () {
    var config = peteyConfig_();
    if (!config.enabled) return { disabled: true };
    var props = PropertiesService.getScriptProperties();
    var errorCount = 0;
    var processed = 0;
    var message = '';
    var completed = true;
    var start = Date.now();
    try {
      var acknowledgements = peteyAcknowledgements_(props);
      var form = peteyForm_(config);
      var mapping = JSON.parse(props.getProperty('PETEY_MAPPING_V1') || 'null');
      peteyValidateMapping_(form, mapping);
      // A complete sweep may span several trigger runs. Keep its progress and
      // error count, without retaining response IDs or answers in properties.
      var ids = responseIds || form.getResponses().map(function (r) { return String(r.getId()); });
      var sweep = responseIds ? { nextIndex: 0, total: ids.length, errorCount: 0 }
        : peteyReadState_(props.getProperty('PETEY_SCAN_STATE'));
      if (!responseIds && (sweep.version !== PETEY_STATE_VERSION || !Number.isInteger(sweep.nextIndex)
        || !Number.isInteger(sweep.total) || sweep.nextIndex < 0 || sweep.total > ids.length
        || sweep.nextIndex >= sweep.total || sweep.orderHash !== peteySha256_(JSON.stringify(ids.slice(0, sweep.total))))) {
        sweep = { version: PETEY_STATE_VERSION, nextIndex: 0, total: ids.length, errorCount: 0,
          orderHash: peteySha256_(JSON.stringify(ids)) };
      }
      errorCount = Number.isInteger(sweep.errorCount) && sweep.errorCount >= 0 ? sweep.errorCount : 0;
      while (sweep.nextIndex < sweep.total) {
        if (Date.now() - start >= PETEY_RUN_BUDGET_MS) {
          completed = false;
          message = 'SCAN_INCOMPLETE_NEXT_RUN_WILL_CONTINUE';
          break;
        }
        try {
          var result = peteySyncResponse_(config, form, mapping, ids[sweep.nextIndex], acknowledgements);
          if (result.pending) { errorCount += 1; message = 'SUBMISSIONS_REQUIRE_RETRY_OR_REVIEW'; }
          processed += 1;
        } catch (error) {
          errorCount += 1;
          message = 'SUBMISSIONS_REQUIRE_RETRY_OR_REVIEW';
          // Intentionally do not log Google/HTTP exception bodies: they may
          // include an answer, Drive file name or response-edit link.
        }
        sweep.nextIndex += 1;
        sweep.errorCount = errorCount;
        if (!responseIds) props.setProperty('PETEY_SCAN_STATE', JSON.stringify(sweep));
      }
    } catch (error) {
      errorCount += 1;
      message = 'BRIDGE_STATE_CONFIGURATION_OR_FORM_MAPPING_INVALID';
    }
    // A successful single submission says nothing about other pending responses.
    // Only a completed reconciliation sweep can advance lastSuccessfulSyncAt.
    if (!responseIds || errorCount) {
      peteySend_(config, 'sync', {
        formId: config.formId, success: errorCount === 0 && completed,
        errorCount: Math.min(errorCount, 100000), message: message
      });
    }
    return { processed: processed, errorCount: errorCount, completed: completed };
  });
}

function peteySyncResponse_(config, form, mapping, responseId, props) {
  var key = 'PETEY_ACK_' + peteySha256_(config.formId + '\n' + responseId);
  var state = peteyReadState_(props.getProperty(key));
  if (state.version !== PETEY_STATE_VERSION) state = {};
  var response = form.getResponse(responseId);
  if (!response || !response.getTimestamp()) throw new Error('PETEY_RESPONSE_UNAVAILABLE');
  var payload = peteyResponsePayload_(config.formId, response, mapping);
  var photoFile = null;
  var photoIssue = '';
  var photoIds = payload.answers.photo;
  if (typeof photoIds === 'string') photoIds = photoIds ? [photoIds] : [];
  if (photoIds.length === 1) {
    try {
      photoFile = DriveApp.getFileById(photoIds[0]);
      payload.photo = {
        fileId: String(photoFile.getId()), modifiedAt: photoFile.getLastUpdated().toISOString(),
        size: photoFile.getSize(), mimeType: photoFile.getMimeType()
      };
      if (payload.photo.size <= 0 || payload.photo.size > PETEY_MAX_PHOTO_BYTES) photoIssue = 'PHOTO_SIZE_UNSUPPORTED';
      if (['image/jpeg', 'image/png', 'image/webp'].indexOf(payload.photo.mimeType) === -1) photoIssue = 'PHOTO_TYPE_UNSUPPORTED';
    } catch (error) { photoIssue = 'PHOTO_UNAVAILABLE'; }
  } else { photoIssue = photoIds.length ? 'PHOTO_COUNT_UNSUPPORTED' : 'PHOTO_MISSING'; }
  var content = { schemaVersion: payload.schemaVersion, formId: payload.formId,
    responseId: payload.responseId, submittedAt: payload.submittedAt, editUrl: payload.editUrl,
    answers: payload.answers, items: payload.items, photo: payload.photo };
  var localHash = peteySha256_(JSON.stringify(content));
  if (state.hash === localHash && state.complete) return { unchanged: true };
  if (state.hash === localHash && state.retryAfter > Date.now()) return { pending: true };
  try {
    // observedAt is captured after canonical reads, not from an old trigger.
    payload.observedAt = new Date().toISOString();
    var result = peteySend_(config, 'import', payload);
    if (!result || typeof result.applicationId !== 'string' || !Number.isInteger(result.revision)
      || typeof result.contentHash !== 'string' || typeof result.photoNeeded !== 'boolean') {
      throw new Error('PETEY_INVALID_IMPORT_ACK');
    }
    if (result.superseded === true) throw new Error('PETEY_RESPONSE_SUPERSEDED');
    // Metadata validation is an exported application issue, not a broken sync.
    // Only acknowledge it when the backend confirms no binary transfer is
    // needed. Transient Drive/network failures and image decode errors retain
    // retries. Canonical metadata is still read before the next cache check.
    var exportedValidationIssue = ['PHOTO_MISSING', 'PHOTO_COUNT_UNSUPPORTED',
      'PHOTO_SIZE_UNSUPPORTED', 'PHOTO_TYPE_UNSUPPORTED'].indexOf(photoIssue) !== -1
      && result.photoNeeded === false;
    if (photoIssue && !exportedValidationIssue) throw new Error(photoIssue);
    if (result.photoNeeded) {
      // Re-check metadata before sending so a concurrent Drive replacement is
      // never attached to the wrong imported revision. Next run imports it anew.
      if (photoFile.getLastUpdated().toISOString() !== payload.photo.modifiedAt
        || photoFile.getSize() !== payload.photo.size) throw new Error('PHOTO_CHANGED_DURING_TRANSFER');
      var blob = photoFile.getBlob();
      if (blob.getBytes().length !== payload.photo.size
        || photoFile.getLastUpdated().toISOString() !== payload.photo.modifiedAt
        || photoFile.getSize() !== payload.photo.size) throw new Error('PHOTO_CHANGED_DURING_TRANSFER');
      var photoResult = peteySend_(config, 'photo', blob, {
        applicationId: result.applicationId, revision: result.revision, fileId: payload.photo.fileId
      });
      if (!photoResult || photoResult.ready !== true) throw new Error('PETEY_INVALID_PHOTO_ACK');
    }
    props.setProperty(key, JSON.stringify({ version: PETEY_STATE_VERSION, hash: localHash, serverHash: result.contentHash,
      complete: true, attempts: 0, acknowledgedAt: Date.now(),
      issue: exportedValidationIssue ? photoIssue : null }));
    return { imported: true };
  } catch (error) {
    var attempts = state.hash === localHash ? (state.attempts || 0) + 1 : 1;
    props.setProperty(key, JSON.stringify({ version: PETEY_STATE_VERSION, hash: localHash, complete: false, attempts: attempts,
      lastAttemptAt: Date.now(),
      retryAfter: Date.now() + Math.min(3600000, 60000 * Math.pow(2, Math.min(attempts - 1, 6))),
      issue: photoIssue || 'DELIVERY_FAILED' }));
    throw new Error('PETEY_DELIVERY_REQUIRES_RETRY');
  }
}

function peteyResponsePayload_(formId, response, mapping) {
  var byId = {};
  response.getItemResponses().forEach(function (answer) {
    byId[String(answer.getItem().getId())] = answer;
  });
  var answers = {};
  var items = [];
  PETEY_FIELDS.forEach(function (definition) {
    var field = mapping.fields[definition[0]];
    var answer = byId[field.itemId];
    var empty = field.type === 'CHECKBOX' || field.type === 'FILE_UPLOAD' ? [] : '';
    var raw = answer ? answer.getResponse() : empty;
    var value = Array.isArray(raw) ? raw.map(String) : String(raw == null ? '' : raw);
    answers[definition[0]] = value;
    items.push({ itemId: field.itemId, title: field.title, type: field.type, value: value });
  });
  return { schemaVersion: 1, formId: formId, responseId: String(response.getId()),
    observedAt: '', submittedAt: response.getTimestamp().toISOString(),
    editUrl: response.getEditResponseUrl(), answers: answers, items: items, photo: null };
}

function peteySeedMapping_(form) {
  var items = form.getItems();
  var fields = {};
  PETEY_FIELDS.forEach(function (definition) {
    var found = items.filter(function (item) { return item.getTitle() === definition[1]; });
    if (found.length !== 1 || String(found[0].getType()) !== definition[2]) {
      throw new Error('PETEY_FORM_QUESTION_MISSING_AMBIGUOUS_OR_WRONG_TYPE: ' + definition[0]);
    }
    fields[definition[0]] = { itemId: String(found[0].getId()), title: definition[1], type: definition[2] };
  });
  return { version: PETEY_MAPPING_VERSION, formId: String(form.getId()), fields: fields };
}

function peteyValidateMapping_(form, mapping) {
  if (!mapping || mapping.version !== PETEY_MAPPING_VERSION || mapping.formId !== String(form.getId())
    || !mapping.fields || Object.keys(mapping.fields).length !== PETEY_FIELDS.length) {
    throw new Error('PETEY_FORM_MAPPING_INVALID');
  }
  var questionTypes = ['TEXT', 'PARAGRAPH_TEXT', 'MULTIPLE_CHOICE', 'CHECKBOX', 'FILE_UPLOAD',
    'LIST', 'SCALE', 'GRID', 'CHECKBOX_GRID', 'DATE', 'DATETIME', 'TIME', 'DURATION', 'RATING'];
  var actual = form.getItems().filter(function (item) { return questionTypes.indexOf(String(item.getType())) !== -1; });
  if (actual.length !== PETEY_FIELDS.length) throw new Error('PETEY_FORM_QUESTION_COUNT_CHANGED');
  var mappedIds = [];
  PETEY_FIELDS.forEach(function (definition) {
    var entry = mapping.fields[definition[0]];
    if (!entry || entry.type !== definition[2] || entry.title !== definition[1]) throw new Error('PETEY_FORM_MAPPING_INVALID');
    var item = actual.filter(function (candidate) { return String(candidate.getId()) === entry.itemId; })[0];
    if (!item || String(item.getType()) !== entry.type || item.getTitle() !== entry.title
      || mappedIds.indexOf(entry.itemId) !== -1) throw new Error('PETEY_FORM_MAPPING_DRIFT: ' + definition[0]);
    mappedIds.push(entry.itemId);
  });
}

function peteyConfig_() {
  var props = PropertiesService.getScriptProperties();
  var formId = props.getProperty('PETEY_FORM_ID');
  var baseUrl = props.getProperty('PETEY_FUNCTION_BASE_URL');
  var secret = props.getProperty('PETEY_IMPORT_SECRET');
  // Restrict secret-bearing requests to the explicitly selected Petey project.
  if (!formId || !/^https:\/\/europe-west2-petey-(dev|prod)-getcass\.cloudfunctions\.net$/.test(baseUrl || '')
    || !secret || secret.length < 32) throw new Error('PETEY_BRIDGE_CONFIGURATION_INVALID');
  return { formId: formId, baseUrl: baseUrl, secret: secret,
    enabled: props.getProperty('PETEY_BRIDGE_ENABLED') === 'true' };
}

function peteyForm_(config) {
  var form = FormApp.getActiveForm();
  if (!form || String(form.getId()) !== config.formId) throw new Error('PETEY_WRONG_BOUND_FORM');
  return form;
}

function peteySend_(config, kind, data, identity) {
  identity = identity || {};
  var timestamp = String(Date.now());
  var isPhoto = kind === 'photo';
  var body = isPhoto ? data.getBytes() : JSON.stringify(data);
  var revision = identity.revision == null ? '' : String(identity.revision);
  var signed = [timestamp, kind, identity.applicationId || '', revision, identity.fileId || '', peteySha256_(body)].join('\n');
  var signature = peteyHex_(Utilities.computeHmacSha256Signature(signed, config.secret, Utilities.Charset.UTF_8));
  var endpoints = { import: 'importWebTrainerApplicationV1', photo: 'uploadWebTrainerApplicationPhotoV1', sync: 'recordWebTrainerFormSyncV1' };
  var headers = { 'X-Petey-Timestamp': timestamp, 'X-Petey-Signature': signature };
  if (isPhoto) {
    headers['X-Petey-Application'] = identity.applicationId;
    headers['X-Petey-Revision'] = revision;
    headers['X-Petey-File'] = identity.fileId;
  }
  var response;
  try {
    response = UrlFetchApp.fetch(config.baseUrl + '/' + endpoints[kind], {
      method: 'post', contentType: isPhoto ? data.getContentType() : 'application/json; charset=utf-8',
      payload: isPhoto ? data : body, headers: headers, followRedirects: false, muteHttpExceptions: true
    });
  } catch (error) { throw new Error('PETEY_NETWORK_FAILED'); }
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    throw new Error('PETEY_ENDPOINT_HTTP_' + response.getResponseCode());
  }
  try { return JSON.parse(response.getContentText() || '{}'); }
  catch (error) { throw new Error('PETEY_ENDPOINT_INVALID_JSON'); }
}

function peteyWithLock_(callback) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return { busy: true }; // Reconciliation recovers it.
  try { return callback(); } finally { lock.releaseLock(); }
}

function peteyReadState_(value) {
  try { var parsed = JSON.parse(value || '{}'); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}; }
  catch (error) { return {}; }
}

// Script Properties has a finite store. This is only an acknowledgement cache;
// evicting an entry is safe because the canonical response is re-read and the
// backend deduplicates it. A single run reads the property set only once.
function peteyAcknowledgements_(props) {
  var entries = props.getProperties();
  var keys = Object.keys(entries).filter(function (key) { return key.indexOf('PETEY_ACK_') === 0; });
  function evict() {
    keys.sort(function (left, right) {
      var a = peteyReadState_(entries[left]); var b = peteyReadState_(entries[right]);
      // Prefer dropping successful old acknowledgements; retry state survives
      // longer, but is bounded too if every application currently needs retry.
      if (Boolean(a.complete) !== Boolean(b.complete)) return a.complete ? -1 : 1;
      return Number(a.acknowledgedAt || a.lastAttemptAt || 0) - Number(b.acknowledgedAt || b.lastAttemptAt || 0);
    });
    var key = keys.shift();
    props.deleteProperty(key); delete entries[key];
  }
  while (keys.length > PETEY_ACK_LIMIT) evict();
  return {
    getProperty: function (key) { return entries[key] || null; },
    setProperty: function (key, value) {
      if (!Object.prototype.hasOwnProperty.call(entries, key)) {
        while (keys.length >= PETEY_ACK_LIMIT) evict();
        keys.push(key);
      }
      props.setProperty(key, value); entries[key] = value;
    }
  };
}

function peteySha256_(value) {
  return peteyHex_(typeof value === 'string'
    ? Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8)
    : Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value));
}

function peteyHex_(bytes) {
  return bytes.map(function (byte) { return ('0' + ((byte + 256) % 256).toString(16)).slice(-2); }).join('');
}
