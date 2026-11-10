/* Baton engine: plain, deterministic code. No model calls, no network.
 * Everything trust-critical (quote check, token guard, labels, permissions,
 * leak tests) lives here so it can be unit-tested in Node and reused by the UI.
 */
(function (root) {
  'use strict';

  // ---------------------------------------------------------------------------
  // Access tags and readers
  // ---------------------------------------------------------------------------
  const ACCESS_TAGS = {
    all_members: 'All members',
    core_team: 'Core team',
    treasurer_only: 'Treasurer only'
  };

  // A tag is stricter when fewer readers hold it. Used when a claim rests on
  // several sources: it takes the strictest tag.
  const TAG_RANK = { all_members: 0, core_team: 1, treasurer_only: 2 };

  function strictestTag(tags) {
    return tags.slice().sort((a, b) => (TAG_RANK[b] || 0) - (TAG_RANK[a] || 0))[0];
  }

  // The single permission check. Every view goes through this.
  function canSee(reader, item) {
    if (!reader || !item) return false;
    if (reader.allAccess) return true;
    return (reader.tags || []).includes(item.access);
  }

  // ---------------------------------------------------------------------------
  // Text helpers
  // ---------------------------------------------------------------------------
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Normalise for matching while keeping a map back to original offsets.
  // Only whitespace, case, quote and dash styles are normalised.
  function normalizeWithMap(text) {
    let norm = '';
    const map = [];
    let lastSpace = true;
    for (let i = 0; i < text.length; i++) {
      let ch = text[i];
      if (/[‘’‛′]/.test(ch)) ch = "'";
      else if (/[“”‟″]/.test(ch)) ch = '"';
      else if (/[‐-―−]/.test(ch)) ch = '-';
      if (/\s/.test(ch)) {
        if (lastSpace) continue;
        norm += ' ';
        map.push(i);
        lastSpace = true;
        continue;
      }
      norm += ch.toLowerCase();
      map.push(i);
      lastSpace = false;
    }
    if (norm.endsWith(' ')) { norm = norm.slice(0, -1); map.pop(); }
    return { norm, map };
  }

  function stripEdgePunct(s) {
    return s.replace(/^[\s"'([{]+/, '').replace(/[\s"'.,;:!?)\]}]+$/, '');
  }

  // ---------------------------------------------------------------------------
  // 1. Secrets and personal data masking (heuristic; outputs are scanned too)
  // ---------------------------------------------------------------------------
  const SECRET_RULES = [
    { type: 'API_KEY', re: /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{6,}\b/g },
    { type: 'GITHUB_TOKEN', re: /\b(?:ghp|gho|ghs|github_pat)_[A-Za-z0-9_]{16,}\b/g },
    { type: 'AWS_KEY', re: /\bAKIA[0-9A-Z]{16}\b/g },
    { type: 'CANARY', re: /\bCANARY-[A-Z0-9-]{4,}\b/g },
    { type: 'PRIVATE_KEY', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g },
    // "password is X", "token: X", "secret = X"
    { type: 'PASSWORD', re: /\b(password|passwd|pwd|secret|token|api key|apikey)(\s*(?:is|=|:)\s*)([^\s,;]+)/gi, group: 3 },
    { type: 'EMAIL', re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
    { type: 'PHONE', re: /(?:\+91[\s-]?)?\b[6-9]\d{4}[\s-]?\d{5}\b/g }
  ];

  function maskSecrets(text) {
    const findings = [];
    let out = String(text || '');
    for (const rule of SECRET_RULES) {
      out = out.replace(rule.re, function () {
        const args = Array.prototype.slice.call(arguments);
        const match = args[0];
        if (rule.group) {
          const value = args[rule.group];
          if (/^\[MASKED/.test(value)) return match;
          findings.push({ type: rule.type, original: value });
          return args[1] + args[2] + '[MASKED:' + rule.type + ']';
        }
        if (/^\[MASKED/.test(match)) return match;
        findings.push({ type: rule.type, original: match });
        return '[MASKED:' + rule.type + ']';
      });
    }
    return { text: out, findings };
  }

  // Remove links, images and HTML from anything shown as a statement.
  function sanitizeStatement(s) {
    return String(s || '')
      .replace(/<[^>]*>/g, '')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '[image removed]')
      .replace(/\[([^\]]+)\]\((?:https?:)?\/\/[^)]*\)/g, '$1')
      .replace(/\bhttps?:\/\/\S+/gi, '[link removed]')
      .replace(/\bwww\.\S+/gi, '[link removed]');
  }

  const INJECTION_RE = /\b(ignore (?:all |any )?(?:previous|prior|above) instructions|disregard (?:the )?(?:rules|instructions)|system prompt|you are now|act as (?:an? )?(?:admin|system)|mark (?:every|all|each) claims? as (?:approved|sourced|verified)|approve (?:everything|all claims))\b/i;

  function looksLikeInjection(text) {
    return INJECTION_RE.test(text || '');
  }

  // ---------------------------------------------------------------------------
  // 2. Parsing sources into passages
  // ---------------------------------------------------------------------------
  const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11 };

  function parseDate(s, fallbackYear) {
    if (!s) return null;
    let m = String(s).match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toISOString().slice(0, 10);
    m = String(s).match(/\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?(?:,?\s+(\d{4}))?/i);
    if (m) {
      const y = m[3] ? +m[3] : (fallbackYear || 2026);
      return new Date(Date.UTC(y, MONTHS[m[2].toLowerCase()], +m[1])).toISOString().slice(0, 10);
    }
    return null;
  }

  // Minimal RFC-4180-ish CSV parser.
  function parseCsv(text) {
    const rows = [];
    let row = [], cell = '', inQ = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQ) {
        if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (ch === '"') inQ = false;
        else cell += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); cell = '';
        if (row.some(c => c.trim() !== '')) rows.push(row);
        row = [];
      } else cell += ch;
    }
    row.push(cell);
    if (row.some(c => c.trim() !== '')) rows.push(row);
    return rows;
  }

  const CSV_FIELDS = {
    title: /^(task|title|task[_ ]?title|name|item|summary|card)$/i,
    owner: /^(owner|assignee|assignee[_ ]?handle|assigned[_ ]?to|responsible|lead|who)$/i,
    status: /^(status|state|stage|column|lane)$/i,
    due: /^(due|due[_ ]?date|deadline|eta)$/i,
    notes: /^(notes?|description|details|comment|comments)$/i
  };

  function guessCsvMapping(headers) {
    const mapping = {};
    headers.forEach((h, idx) => {
      const clean = h.trim();
      for (const field in CSV_FIELDS) {
        if (mapping[field] == null && CSV_FIELDS[field].test(clean)) mapping[field] = idx;
      }
    });
    return mapping;
  }

  // Turn a CSV into readable lines. The stored text is these lines, so
  // quotes can be matched against it exactly.
  function csvToText(text, mapping) {
    const rows = parseCsv(text);
    if (!rows.length) return { text: '', mapping: {}, headers: [] };
    const headers = rows[0];
    const map = mapping || guessCsvMapping(headers);
    const lines = rows.slice(1).map(r => {
      const get = f => (map[f] != null ? (r[map[f]] || '').trim() : '');
      const parts = [];
      const title = get('title') || r[0];
      parts.push('Task: ' + title);
      if (get('owner')) parts.push('Owner: ' + get('owner'));
      if (get('status')) parts.push('Status: ' + get('status'));
      if (get('due')) parts.push('Due: ' + get('due'));
      if (get('notes')) parts.push('Notes: ' + get('notes'));
      return parts.join(' | ');
    });
    return { text: lines.join('\n'), mapping: map, headers };
  }

  // Chat JSON exports become "[date] Name: message" lines.
  function chatJsonToText(text) {
    let data;
    try { data = JSON.parse(text); } catch (e) { return null; }
    const arr = Array.isArray(data) ? data : (data.messages || data.data || []);
    if (!Array.isArray(arr)) return null;
    return arr.map(m => {
      const who = m.author || m.from || m.user || m.sender || m.name || 'Unknown';
      const msg = m.text || m.message || m.content || m.body || '';
      const when = m.date || m.ts || m.time || m.timestamp || '';
      return (when ? '[' + when + '] ' : '') + (typeof who === 'object' ? (who.name || 'Unknown') : who) + ': ' + (typeof msg === 'string' ? msg : JSON.stringify(msg));
    }).join('\n');
  }

  const CHAT_LINE = /^\s*(?:\[([^\]]+)\]\s*)?([A-Z][A-Za-z.' -]{0,30}?)\s*(?:\(([^)]+)\))?\s*:\s+(.+)$/;
  const SPEAKER_LINE = /^\s*([A-Z][A-Za-z.' -]{0,30}?):\s+(.+)$/;

  // Split a block of text into sentences, returning offsets inside the block.
  function splitSentences(block, blockStart) {
    const out = [];
    // Protect common abbreviations from splitting (same length, so offsets hold).
    const prot = block.replace(/\b(e\.g|i\.e|etc|vs|Prof|Dr|Mr|Ms|No)\./g, s => s.replace(/\./g, '\u0000'));
    // A sentence ends at . ! ? followed by whitespace or the end of the block,
    // so "reconcile.py" and "v2.3" stay whole.
    const re = /[.!?]+(?=\s|$)/g;
    let last = 0, m;
    const push = (from, to) => {
      const raw = block.slice(from, to);
      const lead = raw.length - raw.replace(/^\s+/, '').length;
      const text = raw.trim();
      if (text.replace(/[^A-Za-z0-9]/g, '').length < 4) return;
      out.push({ text, start: blockStart + from + lead });
    };
    while ((m = re.exec(prot)) !== null) {
      push(last, m.index + m[0].length);
      last = m.index + m[0].length;
    }
    if (last < block.length) push(last, block.length);
    return out;
  }

  /**
   * Split a stored source into passages. Each passage keeps its exact offset
   * in source.text, its author and its date.
   */
  function toPassages(source) {
    const passages = [];
    const text = source.text || '';
    const year = source.date ? +source.date.slice(0, 4) : 2026;
    let currentDate = source.date || null;
    let currentContext = '';
    let offset = 0;
    const lines = text.split('\n');
    lines.forEach(line => {
      const lineStart = offset;
      offset += line.length + 1;
      if (!line.trim()) return;
      const heading = line.match(/^\s*#{1,6}\s+(.*)$/);
      if (heading) {
        currentContext = heading[1].trim();
        const d = parseDate(heading[1], year);
        if (d) currentDate = d;
        return;
      }
      let author = source.author || null;
      let body = line;
      let bodyStart = lineStart;
      let date = currentDate;
      if (source.kind === 'chat') {
        const m = line.match(CHAT_LINE);
        if (m) {
          author = m[2].trim();
          date = parseDate(m[1] || m[3], year) || date;
          body = m[4];
          bodyStart = lineStart + line.lastIndexOf(m[4]);
        }
      } else if (source.kind === 'github' || source.kind === 'notes') {
        const prHead = line.match(/^\s*(PR|Issue|Pull request)\s*#(\d+)\b.*$/i);
        if (prHead) {
          currentContext = line.trim();
          const d = parseDate(line, year);
          if (d) currentDate = d;
          return;
        }
        const m = line.match(SPEAKER_LINE);
        if (m && source.kind === 'github') {
          author = m[1].trim();
          body = m[2];
          bodyStart = lineStart + line.indexOf(m[2], m[1].length);
        }
      }
      // Strip bullets / checkboxes from the body but keep exact offsets.
      const bullet = body.match(/^(\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?)/);
      if (bullet) { bodyStart += bullet[1].length; body = body.slice(bullet[1].length); }

      const sentences = source.kind === 'tasks' || source.kind === 'commits'
        ? [{ text: body.trim(), start: bodyStart + (body.length - body.trimStart().length) }]
        : splitSentences(body, bodyStart);
      sentences.forEach(s => {
        passages.push({
          id: source.id + ':p' + passages.length,
          sourceId: source.id,
          text: s.text,
          start: s.start,
          end: s.start + s.text.length,
          author,
          date,
          context: currentContext,
          access: source.access
        });
      });
    });
    return passages;
  }

  // ---------------------------------------------------------------------------
  // 3. Rule-based claim extraction
  // ---------------------------------------------------------------------------
  const STOP = new Set('a an the and or but if then so of to in on at for from by with as is are was were be been being it its this that these those we our you your i me my he she they them their there here do does did have has had will would can could should must may might just also very really about into over under than up down out off again only own same too not no never nor any each few more most other some such what which who whom why how all both per via'.split(' '));
  const NEGATIONS = new Set(['not', 'no', 'never', 'none', 'nobody', 'nothing', 'without', 'cannot', "n't", 'neither', 'nor']);

  function tokens(s) {
    const t = String(s || '').toLowerCase()
      .replace(/[‘’]/g, "'")
      .replace(/\b(can)'t\b/g, '$1 not').replace(/\bwon't\b/g, 'will not').replace(/\b(\w+)n't\b/g, '$1 not')
      .match(/#?\d+(?:[.,:]\d+)*%?|v\d+(?:\.\d+)+|[a-z0-9_./-]*[a-z0-9_]+(?:\.[a-z0-9]+)?|[a-z]+/g);
    return t || [];
  }

  function stem(w) {
    return w.replace(/(ies)$/, 'y').replace(/(ing|ed|es|s)$/, '').replace(/e$/, '').replace(/(.)\1$/, '$1');
  }

  function contentStems(s) {
    return tokens(s).filter(w => !STOP.has(w) && !NEGATIONS.has(w) && w.length > 1).map(stem);
  }

  const AREA_ALIASES = [
    [/^(deploy|deploys|deployment|deployments|release|releases|release pipeline|the release pipeline)$/, 'deployments'],
    [/^(billing|billing module|the billing module|billing service)$/, 'billing'],
    [/^(vendor payments?|payments to vendors)$/, 'vendor payments'],
    [/^(the )?(events account|club account|club funds)$/, 'events account']
  ];

  function normalizeArea(a) {
    let s = String(a || '').toLowerCase().trim().replace(/^(the|our)\s+/, '').replace(/[.,;:!?]+$/, '');
    for (const [re, name] of AREA_ALIASES) if (re.test(s)) return name;
    return s;
  }

  const NAME = "([A-Z][a-z]+(?:\\s[A-Z][a-z]+)?)";
  const OWNER_PATTERNS = [
    new RegExp('\\b' + NAME + '\\s+(?:now\\s+)?(?:owns|handles|manages|maintains|runs|is responsible for|takes care of|looks after)\\s+(?:the\\s+)?([a-z][a-z0-9 -]{2,40}?)(?=\\s+(?:now|since|because|from|until|for)\\b|[.,;!]|$)'),
    new RegExp('\\b(?:I|we)\\s+(?:now\\s+)?(?:own|handle|manage|maintain|run|take care of|look after)\\s+(?:the\\s+)?([a-z][a-z0-9 -]{2,40}?)(?=\\s+(?:now|since|because|from|until|for)\\b|[.,;!]|$)', 'i'),
    new RegExp('^Task:\\s*([^|]+?)\\s*\\|\\s*Owner:\\s*' + NAME)
  ];

  const TYPE_RULES = [
    { type: 'open_question', re: /\?\s*$|\b(open question|tbd|not sure|unclear|undecided)\b/i },
    { type: 'blocker', re: /\b(blocked|blocking|waiting on|stuck on|can't proceed|cannot proceed)\b/i },
    { type: 'decision', re: /\b(we decided|decided to|we agreed|agreed to|we will keep|we chose|chose to|going with|switched to|we moved|move [a-z ]+ to|will stay|stay switched off|must stay|is final)\b/i },
    { type: 'risk', re: /\b(risk|risky|fragile|might break|can fail|could fail|may fail|careful|warning|rate-limit|rate limits?|fails? on|fails because|outage|data loss)\b/i },
    { type: 'recurring_problem', re: /\b(keeps|again and again|recurring|repeatedly|by hand)\b/i },
    { type: 'process', re: /\b(runs at|runs on|runs every|nightly|cron|scheduled|port \d+|deploys? go(?:es)? out|is deployed|lives in|stored in|flag is)\b/i },
    { type: 'dependency', re: /\b(depends on|dependent on|requires|relies on|needs the)\b/i },
    { type: 'contact', re: /\b(point of contact|contact person|reach out to|ask [A-Z][a-z]+ (?:about|for)|is the contact|vendor contact)\b/ },
    { type: 'next_action', re: /\b(next step|todo|to-do|need to|needs to|has to|must|should|before \d{1,2}\s+[A-Z][a-z]{2}|by (?:monday|tuesday|wednesday|thursday|friday|\d))\b/i }
  ];

  const FILLER = /^(?:(?:just\s+)?(?:a\s+)?heads up,?\s*|fyi,?\s*|note:\s*|honestly,?\s*|ok(?:ay)?,?\s*|so,?\s*|thanks\.?\s*|yes,\s*|yeah,?\s*|also,?\s*|btw,?\s*|i think\s+|risk:\s*|open question:\s*|next step:\s*|decision:\s*)+/i;

  // Light, deterministic rewrite of a sentence into a statement.
  function toStatement(sentence, author) {
    let s = sentence.trim().replace(FILLER, '');
    if (author) {
      s = s.replace(/^I\s+am\b/, author + ' is')
        .replace(/^I'm\b/, author + ' is')
        .replace(/^I'll\b/, author + ' will')
        .replace(/^I\s+(\w+)/, (m, v) => author + ' ' + thirdPerson(v))
        .replace(/\bI\s+(handle|own|run|manage|clear|do|take|maintain)\b/g, (m, v) => author + ' ' + thirdPerson(v));
    }
    s = sanitizeStatement(s);
    s = s.charAt(0).toUpperCase() + s.slice(1);
    if (!/[.!?]$/.test(s)) s += '.';
    return s;
  }

  function thirdPerson(v) {
    const irregular = { have: 'has', do: 'does', go: 'goes', am: 'is' };
    if (irregular[v]) return irregular[v];
    if (/(s|sh|ch|x|z)$/.test(v)) return v + 'es';
    if (/[^aeiou]y$/.test(v)) return v.slice(0, -1) + 'ies';
    return v + 's';
  }

  function classify(text) {
    for (const rule of TYPE_RULES) if (rule.re.test(text)) return rule.type;
    return null;
  }

  // Detect a comparable "slot" (subject + value) for conflict checks.
  function detectSlot(type, text, author) {
    for (let i = 0; i < OWNER_PATTERNS.length; i++) {
      const m = text.match(OWNER_PATTERNS[i]);
      if (!m) continue;
      if (i === 0) return { kind: 'owner', subject: normalizeArea(m[2]), value: m[1] };
      if (i === 1 && author) return { kind: 'owner', subject: normalizeArea(m[1]), value: author };
      if (i === 2) return { kind: 'owner', subject: normalizeArea(m[1]), value: m[2] };
    }
    if (type === 'decision') {
      let m = text.match(/\b(?:use|keep|store)\s+([A-Z]?[a-z0-9]+)\s+for\s+([a-z ]{3,30}?)(?=[.,;!]|$)/i);
      if (m) return { kind: 'decision', subject: normalizeArea(m[2]), value: m[1].toLowerCase() };
      m = text.match(/\bmove\s+([a-z ]{3,30}?)\s+(?:from\s+[A-Za-z0-9]+\s+)?to\s+([A-Za-z0-9]+)/i);
      if (m) return { kind: 'decision', subject: normalizeArea(m[1]), value: m[2].toLowerCase() };
    }
    return null;
  }

  /**
   * Propose claims from passages. Each candidate carries the exact sentence
   * as its quote; the verifier still checks it independently.
   */
  function extractClaims(passages, source) {
    const out = [];
    passages.forEach(p => {
      if (/^\s*attendees?:/i.test(p.text)) return;
      // Instruction-like text is quarantined, never turned into a claim.
      if (looksLikeInjection(p.text)) return;
      let type = classify(p.text);
      const slot = detectSlot(type, p.text, p.author);
      if (slot && slot.kind === 'owner') type = 'owner';
      if (!type && source.kind === 'tasks') type = 'next_action';
      if (!type) return;
      let statement;
      if (source.kind === 'tasks') {
        const m = p.text.match(/^Task:\s*([^|]+?)\s*(?:\|\s*Owner:\s*([^|]+?))?\s*(?:\|\s*Status:\s*([^|]+?))?\s*(?:\||$)/);
        if (m && m[2]) statement = m[2].trim() + ' owns "' + m[1].trim() + '"' + (m[3] ? ' (status: ' + m[3].trim() + ').' : '.');
        else statement = toStatement(p.text, p.author);
      } else {
        statement = toStatement(p.text, p.author);
      }
      out.push({
        type,
        statement,
        quote: p.text,
        passageId: p.id,
        sourceId: p.sourceId,
        author: p.author,
        date: p.date,
        context: p.context,
        slot,
        flags: []
      });
    });
    return out;
  }

  // Ownership inferred from commit activity: "<sha> <Author> <area>: msg".
  function inferOwnership(source) {
    const counts = {};
    const lines = (source.text || '').split('\n');
    lines.forEach(l => {
      const m = l.match(/^\s*[0-9a-f]{6,40}\s+([A-Z][a-z]+)\s+([a-z][a-z0-9-]*):/);
      if (!m) return;
      counts[m[2]] = counts[m[2]] || {};
      counts[m[2]][m[1]] = (counts[m[2]][m[1]] || 0) + 1;
    });
    const claims = [];
    Object.keys(counts).forEach(area => {
      const byAuthor = counts[area];
      const total = Object.values(byAuthor).reduce((a, b) => a + b, 0);
      const [top, n] = Object.entries(byAuthor).sort((a, b) => b[1] - a[1])[0];
      if (total >= 3 && n / total >= 0.6) {
        const pct = Math.round((n / total) * 100);
        claims.push({
          type: 'owner',
          statement: top + ' made most commits in ' + area + ' (' + n + ' of ' + total + ', ' + pct + '%).',
          quote: null,
          derived: { area, author: top, n, total, pct },
          sourceId: source.id,
          author: null,
          date: source.date,
          slot: null,
          flags: []
        });
      }
    });
    return claims;
  }

  // ---------------------------------------------------------------------------
  // 4. Verification: quote match, exact-token guard, support check
  // ---------------------------------------------------------------------------
  function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    let prev = new Array(b.length + 1);
    let cur = new Array(b.length + 1);
    for (let j = 0; j <= b.length; j++) prev[j] = j;
    for (let i = 1; i <= a.length; i++) {
      cur[0] = i;
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      [prev, cur] = [cur, prev];
    }
    return prev[b.length];
  }

  function ratio(a, b) {
    const len = Math.max(a.length, b.length);
    return len ? 1 - levenshtein(a, b) / len : 1;
  }

  const FUZZY_THRESHOLD = 0.9;

  /**
   * Find a quote inside a passage. Exact (normalised) match first; then a
   * fuzzy match over sliding windows of words, so long quotes are aligned
   * window by window instead of relying on a single partial score.
   */
  function matchQuote(quote, passageText) {
    if (!quote || !passageText) return { found: false, method: null, score: 0 };
    const q = normalizeWithMap(stripEdgePunct(quote));
    const p = normalizeWithMap(passageText);
    if (!q.norm) return { found: false, method: null, score: 0 };
    const idx = p.norm.indexOf(q.norm);
    if (idx !== -1) {
      return { found: true, method: 'exact', score: 1, start: p.map[idx], end: p.map[idx + q.norm.length - 1] + 1 };
    }
    // Fuzzy: compare against word windows of similar length.
    const words = [];
    const wre = /\S+/g;
    let m;
    while ((m = wre.exec(p.norm)) !== null) words.push({ w: m[0], i: m.index });
    const qWords = q.norm.split(' ').length;
    let best = { score: 0 };
    for (let size = Math.max(1, qWords - 2); size <= qWords + 2; size++) {
      for (let s = 0; s + size <= words.length; s++) {
        const startI = words[s].i;
        const last = words[s + size - 1];
        const endI = last.i + last.w.length;
        const cand = p.norm.slice(startI, endI);
        const sc = ratio(q.norm, cand);
        if (sc > best.score) best = { score: sc, startI, endI };
      }
    }
    if (best.score >= FUZZY_THRESHOLD) {
      return { found: true, method: 'fuzzy', score: +best.score.toFixed(3), start: p.map[best.startI], end: p.map[best.endI - 1] + 1 };
    }
    return { found: false, method: null, score: +(best.score || 0).toFixed(3) };
  }

  // Tokens that must appear exactly: numbers, versions, ports, paths,
  // identifiers and negations. Fuzzy scores treat "8080"/"8081" or a dropped
  // "not" as almost identical, so these are checked one by one.
  function criticalTokens(s) {
    const text = String(s || '');
    const found = new Set();
    const add = t => found.add(t.toLowerCase().replace(/[.,;:!?]+$/, ''));
    (text.match(/#\d+\b/g) || []).forEach(add);
    (text.match(/\bv?\d+(?:[.,:]\d+)*%?/gi) || []).forEach(add);
    (text.match(/(?:^|\s)((?:\.{0,2}\/)?[\w-]+(?:\/[\w.-]+)+)/g) || []).forEach(t => add(t.trim()));
    (text.match(/\b[\w-]+\.(?:py|js|ts|tsx|json|yml|yaml|md|sql|sh|env|csv|txt|toml|cfg|ini)\b/gi) || []).forEach(add);
    (text.match(/\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b/g) || []).forEach(add);
    (text.match(/\b[a-z]+_[a-z0-9_]+\b/g) || []).forEach(add);
    (text.match(/\b[a-z]+[A-Z][A-Za-z0-9]*\b/g) || []).forEach(add);
    return Array.from(found).filter(Boolean);
  }

  function negationCount(s) {
    return tokens(s).filter(t => NEGATIONS.has(t)).length;
  }

  function tokenGuard(statement, quote) {
    // Whole-token comparison only: "WEBHOOK_RETRY_ENABLE" must not match
    // inside "WEBHOOK_RETRY_ENABLED", nor "8080" inside "18080".
    const qTokens = new Set();
    tokens(quote).concat(criticalTokens(quote)).forEach(t => {
      const clean = t.toLowerCase().replace(/[.,;:!?]+$/, '');
      qTokens.add(clean);
      if (clean.startsWith('#')) qTokens.add(clean.slice(1));
    });
    const missing = [];
    criticalTokens(statement).forEach(t => {
      if (!qTokens.has(t)) missing.push(t);
    });
    const negS = negationCount(statement) > 0;
    const negQ = negationCount(quote) > 0;
    let negation = null;
    if (negS && !negQ) negation = 'statement has a negation the quote does not';
    if (!negS && negQ) negation = 'quote has a negation the statement drops';
    return { pass: missing.length === 0 && !negation, missing, negation };
  }

  // Rule-based stand-in for the separate support check: does the quote
  // support the statement? Sees only the two strings.
  function supportCheck(statement, quote, author) {
    const s = contentStems(statement);
    if (!s.length) return { verdict: 'no', score: 0 };
    // The speaker of the quote counts as present ("I handle" -> "Aarav handles").
    const q = new Set(contentStems(quote + (author ? ' ' + author : '')));
    const hit = s.filter(w => q.has(w)).length;
    const score = hit / s.length;
    const verdict = score >= 0.75 ? 'yes' : score >= 0.45 ? 'partly' : 'no';
    return { verdict, score: +score.toFixed(2) };
  }

  /**
   * Full verification of one candidate against its passage.
   * Returns { stored, label, reason, checks }.
   */
  function verifyClaim(candidate, passage, opts) {
    opts = opts || {};
    if (candidate.derived) {
      return { stored: true, label: 'Inferred', reason: 'Derived from commit counts; numbers shown.', checks: { match: { method: 'derived' } } };
    }
    if (!passage) return { stored: false, label: null, reason: 'Source passage not found.', checks: {} };
    const match = matchQuote(candidate.quote, passage.text);
    if (!match.found) return { stored: false, label: null, reason: 'Quote not found in source (best similarity ' + match.score + ').', checks: { match } };
    const guard = tokenGuard(candidate.statement, candidate.quote);
    if (!guard.pass) {
      return { stored: false, label: null, reason: 'Exact-token guard failed: ' + (guard.missing.length ? 'missing ' + guard.missing.join(', ') : guard.negation), checks: { match, guard } };
    }
    if (opts.supportUnavailable) return { stored: true, label: 'Quote-only', reason: 'Support check unavailable.', checks: { match, guard } };
    const support = supportCheck(candidate.statement, candidate.quote, candidate.author);
    if (support.verdict === 'no') return { stored: false, label: null, reason: 'Support check: quote does not support the statement (' + support.score + ').', checks: { match, guard, support } };
    return {
      stored: true,
      label: support.verdict === 'yes' ? 'Sourced' : 'Inferred',
      reason: support.verdict === 'yes' ? 'Quote found, tokens guarded, support check agrees.' : 'Support check says partly.',
      checks: { match, guard, support }
    };
  }

  // ---------------------------------------------------------------------------
  // 5. Pipeline: sources -> passages -> candidates -> verified claims
  // ---------------------------------------------------------------------------
  function runPipeline(sources) {
    const passages = [];
    const claims = [];
    const dropped = [];
    const quarantined = [];
    let n = 0;
    sources.forEach(src => {
      const ps = toPassages(src);
      passages.push.apply(passages, ps);
      ps.forEach(p => { if (looksLikeInjection(p.text)) quarantined.push({ sourceId: src.id, passageId: p.id, text: p.text, author: p.author }); });
      const byId = {};
      ps.forEach(p => { byId[p.id] = p; });
      const candidates = src.kind === 'commits' ? inferOwnership(src) : extractClaims(ps, src);
      candidates.forEach(c => {
        const passage = c.passageId ? byId[c.passageId] : null;
        const v = verifyClaim(c, passage);
        if (!v.stored) { dropped.push({ statement: c.statement, sourceId: src.id, reason: v.reason }); return; }
        n++;
        const match = v.checks.match || {};
        claims.push({
          id: 'CLM-' + String(100 + n),
          type: c.type,
          statement: c.statement,
          quote: c.quote,
          quoteStart: passage && match.start != null ? passage.start + match.start : null,
          quoteEnd: passage && match.end != null ? passage.start + match.end : null,
          sourceId: src.id,
          passageId: c.passageId || null,
          matchMethod: match.method,
          checks: v.checks,
          label: v.label,
          reason: v.reason,
          access: src.access,
          origin: c.derived ? 'derived' : 'extracted',
          derived: c.derived || null,
          author: c.author,
          date: c.date || src.date,
          slot: c.slot,
          flags: c.flags || [],
          reviewState: 'proposed',
          version: 1
        });
      });
    });
    return { passages, claims, dropped, quarantined };
  }

  // ---------------------------------------------------------------------------
  // 6. Per-reader view: visibility, conflicts, superseded, gaps
  // ---------------------------------------------------------------------------
  const GAP_TEXT = 'No answer found in your view. It may be undocumented or restricted';

  const CHECKLIST = [
    { key: 'owner', title: 'Who owns what', test: c => c.type === 'owner' },
    { key: 'run_deploy', title: 'How to run and deploy', test: c => /\b(deploy|deploys|deployment|release|port \d+|runs on|start the|docker|npm run)\b/i.test(c.statement) },
    { key: 'credentials', title: 'Where credentials live', test: c => /\b(credential|credentials|vault|\.env|secrets? (?:are|is) (?:kept|stored)|password manager|keys? (?:live|are stored))\b/i.test(c.statement) },
    { key: 'scheduled_jobs', title: 'Scheduled jobs', test: c => /\b(cron|nightly|scheduled|runs at|every (?:night|day|monday|week))\b/i.test(c.statement) },
    { key: 'work_in_flight', title: 'Work in flight', test: c => /\b(in progress|blocked|draft|open pr|pending|wip|unfinished|not started)\b/i.test(c.statement) },
    { key: 'who_to_ask', title: 'Who to ask (contacts)', test: c => c.type === 'contact' }
  ];
  CHECKLIST.forEach(item => {
    const base = item.test;
    // An interview answer given for a checklist item fills that item.
    item.test = c => c.gapKey === item.key || base(c);
  });

  function claimDateValue(c) { return c.date ? Date.parse(c.date) : 0; }

  /**
   * Build one reader's view. Labels for conflict / superseded / missing are
   * computed only over claims this reader may see.
   */
  function computeView(claims, reader, opts) {
    opts = opts || {};
    const includeRejected = !!opts.includeRejected;
    const visible = claims.filter(c => canSee(reader, c) && (includeRejected || c.reviewState !== 'rejected') && !(c.withheldFrom || []).includes(reader.id));
    const bySlot = {};
    visible.forEach(c => {
      if (!c.slot || c.resolution === 'kept') return;
      const key = c.slot.kind + '|' + c.slot.subject;
      (bySlot[key] = bySlot[key] || []).push(c);
    });
    const status = {}; // claimId -> {conflictWith:[], supersededBy}
    Object.keys(bySlot).forEach(key => {
      const group = bySlot[key].slice().sort((a, b) => claimDateValue(a) - claimDateValue(b));
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const a = group[i], b = group[j];
          if (String(a.slot.value).toLowerCase() === String(b.slot.value).toLowerCase()) continue;
          // Same author restating later, or a later recorded decision, supersedes.
          const sameAuthorLater = a.author && b.author && a.author === b.author && claimDateValue(b) > claimDateValue(a);
          const laterDecision = a.slot.kind === 'decision' && a.type === 'decision' && b.type === 'decision' && claimDateValue(b) > claimDateValue(a);
          if (sameAuthorLater || laterDecision) {
            status[a.id] = Object.assign(status[a.id] || {}, { supersededBy: b.id });
          } else {
            (status[a.id] = status[a.id] || {}).conflictWith = ((status[a.id] || {}).conflictWith || []).concat(b.id);
            (status[b.id] = status[b.id] || {}).conflictWith = ((status[b.id] || {}).conflictWith || []).concat(a.id);
          }
        }
      }
    });
    const items = visible.map(c => {
      const st = status[c.id] || {};
      let displayLabel = c.confirmedBy ? 'Confirmed by ' + c.confirmedBy : c.label;
      if (st.supersededBy) displayLabel = 'Superseded';
      else if (st.conflictWith && st.conflictWith.length && !c.resolution) displayLabel = 'Possible conflict';
      return Object.assign({}, c, { displayLabel, conflictWith: st.conflictWith || [], supersededBy: st.supersededBy || null });
    });
    const gaps = CHECKLIST.filter(item => !items.some(c => c.displayLabel !== 'Superseded' && item.test(c)))
      .map(item => ({ key: item.key, title: item.title, text: GAP_TEXT }));
    return { reader, items, gaps };
  }

  // Stale-fact hazard: a reader would hold a fact whose newer version is
  // restricted from them.
  function staleHazards(claims, readers) {
    const all = computeView(claims, { id: '__all__', allAccess: true });
    const hazards = [];
    all.items.forEach(c => {
      if (!c.supersededBy) return;
      const newer = claims.find(x => x.id === c.supersededBy);
      readers.forEach(r => {
        if (canSee(r, c) && !canSee(r, newer) && !(c.withheldFrom || []).includes(r.id) && c.reviewState !== 'rejected') {
          hazards.push({ claimId: c.id, newerId: newer.id, readerId: r.id });
        }
      });
    });
    return hazards;
  }

  // ---------------------------------------------------------------------------
  // 7. Handover composition (rendered by code from claims only)
  // ---------------------------------------------------------------------------
  const SECTION_OF = {
    owner: 'ownership', contact: 'ownership',
    next_action: 'actions',
    risk: 'risks', blocker: 'risks', recurring_problem: 'risks', dependency: 'risks', open_question: 'risks',
    decision: 'decisions', process: 'decisions'
  };

  function composeHandover(claims, reader, opts) {
    opts = opts || {};
    const approved = claims.filter(c => c.reviewState === 'accepted' || c.reviewState === 'edited');
    const view = computeView(approved, reader);
    const sections = { ownership: [], actions: [], risks: [], decisions: [] };
    view.items.forEach(c => {
      if (c.displayLabel === 'Superseded') return;
      const sec = SECTION_OF[c.type] || 'decisions';
      sections[sec].push({ claimId: c.id, statement: c.statement, label: c.displayLabel, date: c.date, type: c.type });
    });
    Object.keys(sections).forEach(k => sections[k].sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.claimId.localeCompare(b.claimId)));
    return { readerId: reader.id, sections, gaps: view.gaps };
  }

  // Deterministic text rendering; used for leak and differential tests.
  function renderHandoverText(h) {
    const lines = [];
    ['ownership', 'actions', 'risks', 'decisions'].forEach(k => {
      lines.push('## ' + k);
      h.sections[k].forEach(i => lines.push('- [' + i.claimId + '] (' + i.label + ') ' + i.statement));
    });
    lines.push('## gaps');
    h.gaps.forEach(g => lines.push('- ' + g.title + ': ' + g.text));
    return lines.join('\n');
  }

  // Every sentence of a narrative must cite a claim id like [CLM-101].
  function uncitedSentences(text) {
    return String(text || '').split(/(?<=[.!?])\s+/).filter(s => s.trim() && !/\[CLM-\d+\]/.test(s));
  }

  // ---------------------------------------------------------------------------
  // 8. Leak tests
  // ---------------------------------------------------------------------------
  function canaryScan(text, canaries) {
    const lower = String(text || '').toLowerCase();
    return canaries.filter(c => c && lower.indexOf(String(c).toLowerCase()) !== -1);
  }

  /**
   * Differential test: removing a claim the reader cannot see (and its source)
   * must leave that reader's rendered handover byte-identical.
   */
  function differentialTest(claims, reader) {
    const hidden = claims.filter(c => !canSee(reader, c));
    if (!hidden.length) return { ran: false, identical: true, removed: null };
    const target = hidden[0];
    const before = renderHandoverText(composeHandover(claims, reader));
    const after = renderHandoverText(composeHandover(claims.filter(c => c.sourceId !== target.sourceId), reader));
    return { ran: true, identical: before === after, removed: target.id };
  }

  // Mutation test for the quote checker: change a digit, flip a negation,
  // change an identifier. Every mutation must be rejected.
  function mutate(statement) {
    const muts = [];
    const digit = statement.match(/\d/);
    if (digit) {
      const i = digit.index;
      const d = String((+statement[i] + 1) % 10);
      muts.push({ kind: 'digit', text: statement.slice(0, i) + d + statement.slice(i + 1) });
    }
    if (/\b(not|never|no)\b/i.test(statement)) {
      muts.push({ kind: 'negation-removed', text: statement.replace(/\s*\b(not|never)\b/i, '') });
    } else {
      const m = statement.match(/\b(is|are|was|were|will|must|should|can|does|do|stay|stays)\b/i);
      if (m) muts.push({ kind: 'negation-added', text: statement.slice(0, m.index + m[0].length) + ' not' + statement.slice(m.index + m[0].length) });
    }
    const ident = statement.match(/#\d+|\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b|\b[\w-]+\.(?:py|js|md|sql|sh)\b|\bv\d+(?:\.\d+)+/);
    if (ident) {
      const t = ident[0];
      const changed = /\d/.test(t) ? t.replace(/\d(?!.*\d)/, x => String((+x + 1) % 10)) : t.replace(/[A-Za-z](?=[^A-Za-z]*$)/, x => (x === 'Z' ? 'Y' : x === 'z' ? 'y' : String.fromCharCode(x.charCodeAt(0) + 1)));
      muts.push({ kind: 'identifier', text: statement.replace(t, changed) });
    }
    return muts;
  }

  function mutationTest(claims, passagesById) {
    let total = 0, falseAccepts = 0;
    const details = [];
    claims.filter(c => c.origin === 'extracted' && c.quote).forEach(c => {
      const passage = passagesById[c.passageId];
      mutate(c.statement).forEach(mu => {
        total++;
        const v = verifyClaim({ statement: mu.text, quote: c.quote }, passage);
        const accepted = v.stored && v.label === 'Sourced';
        if (accepted) falseAccepts++;
        details.push({ claimId: c.id, kind: mu.kind, text: mu.text, accepted, reason: v.reason });
      });
      // Wrong source: the quote checked against an unrelated passage.
      const other = Object.values(passagesById).find(p => p.sourceId !== c.sourceId && p.text.length > 20);
      if (other) {
        total++;
        const v = verifyClaim({ statement: c.statement, quote: c.quote }, other);
        if (v.stored) falseAccepts++;
        details.push({ claimId: c.id, kind: 'wrong-source', text: c.statement, accepted: v.stored, reason: v.reason });
      }
    });
    return { total, falseAccepts, details };
  }

  // Bulk approval covers only a narrow, low-risk class.
  function bulkEligible(c, now) {
    const ageDays = c.date && now ? (Date.parse(now) - Date.parse(c.date)) / 86400000 : 0;
    return c.label === 'Sourced' && c.origin === 'extracted' && c.type !== 'next_action' &&
      !(c.flags || []).length && !c.slot && ageDays < 90 &&
      !/\b(password|token|secret|credential|key|run |paste|execute|\[MASKED)/i.test(c.statement + ' ' + c.quote);
  }

  function sampleSize(n) { return Math.min(n, Math.max(5, Math.ceil(n * 0.1))); }

  async function sha256(text) {
    if (root.crypto && root.crypto.subtle) {
      const buf = await root.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    if (typeof require === 'function') return require('crypto').createHash('sha256').update(text).digest('hex');
    return 'unavailable';
  }

  const api = {
    ACCESS_TAGS, TAG_RANK, GAP_TEXT, CHECKLIST,
    strictestTag, canSee, escapeHtml, normalizeWithMap,
    maskSecrets, sanitizeStatement, looksLikeInjection,
    parseCsv, guessCsvMapping, csvToText, chatJsonToText, parseDate,
    toPassages, extractClaims, inferOwnership, toStatement, detectSlot, classify,
    matchQuote, criticalTokens, tokenGuard, supportCheck, verifyClaim,
    runPipeline, computeView, staleHazards, composeHandover, renderHandoverText, uncitedSentences,
    canaryScan, differentialTest, mutate, mutationTest, bulkEligible, sampleSize, sha256
  };

  root.BatonEngine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
