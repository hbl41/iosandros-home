const data = window.IOSANDROS;
const $ = (selector) => document.querySelector(selector);
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

const slugify = (value) =>
  String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const historyStartYear = (item) => {
  const match = String(item.year).match(/\d+/);
  return match ? Number(match[0]) : 0;
};

const historyEraGroups = [
  { range: "0-161 SE", start: 0, end: 161 },
  { range: "323-466 SE", start: 323, end: 466 },
  { range: "544-722 SE", start: 544, end: 722 },
  { range: "833-900 SE", start: 833, end: 900 },
  { range: "920-1224 SE", start: 920, end: 1224 }
];

const groupHistoryEntries = (entries) =>
  historyEraGroups
    .map((era) => ({
      ...era,
      entries: entries.filter((item) => {
        const year = historyStartYear(item);
        return year >= era.start && year <= era.end;
      })
    }))
    .filter((era) => era.entries.length);

let mapScrollY = 0;
let mapReturnFocus = null;
let moveTopFrame = null;
let searchIndex = null;
const FAST_SCROLL_DURATION = 260;

const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const easeOutCubic = (value) => 1 - Math.pow(1 - value, 3);

const scrollMarginTop = (target) => {
  const value = window.getComputedStyle(target).scrollMarginTop;
  return Number.parseFloat(value) || 0;
};

const targetScrollY = (target, block = "start") => {
  const rect = target.getBoundingClientRect();
  if (block === "center") {
    return Math.max(0, window.scrollY + rect.top - ((window.innerHeight - rect.height) / 2));
  }

  return Math.max(0, window.scrollY + rect.top - scrollMarginTop(target));
};

function scrollToY(targetY, duration = FAST_SCROLL_DURATION) {
  const startY = window.scrollY;
  const distance = targetY - startY;

  if (prefersReducedMotion() || Math.abs(distance) < 2) {
    window.scrollTo(0, targetY);
    queueMoveTopUpdate();
    return Promise.resolve();
  }

  const startTime = performance.now();
  return new Promise((resolve) => {
    const step = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      window.scrollTo(0, startY + (distance * easeOutCubic(progress)));
      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        queueMoveTopUpdate();
        resolve();
      }
    };

    window.requestAnimationFrame(step);
  });
}

function fastScrollToTarget(target, { block = "start", updateHash = true } = {}) {
  if (!target) return Promise.resolve();
  if (updateHash && target.id) history.pushState(null, "", `#${target.id}`);
  return scrollToY(targetScrollY(target, block));
}

function openHistoryEntry(target) {
  const details = target?.querySelector(".history-source");
  if (details) details.open = true;
};

const factRow = (label, value) => {
  const row = el("div", "fact-row");
  row.appendChild(el("span", null, label));
  row.appendChild(el("strong", null, value || "-"));
  return row;
};

const sourceDetails = (text) => {
  const details = el("details", "source-entry");
  details.appendChild(el("summary", null, "Open notes"));
  details.appendChild(el("p", null, text));
  return details;
};

const historyDetails = (item) => {
  const details = el("details", "history-source");
  details.appendChild(el("summary", null, "Open record"));
  (item.body || []).forEach((paragraph) => details.appendChild(el("p", null, paragraph)));
  return details;
};

function getSearchIndex() {
  if (!searchIndex) searchIndex = buildSearchIndex();
  return searchIndex;
}

function renderHistorySkim(entries = data.history) {
  const list = $("#historyJumpList");
  list.innerHTML = "";
  const eras = groupHistoryEntries(entries);
  eras.forEach((era) => {
    const group = el("section", "history-era");
    group.setAttribute("aria-label", `${era.range}, ${era.entries.length} ${era.entries.length === 1 ? "record" : "records"}`);
    const marker = el("div", "history-era-marker");
    marker.appendChild(el("span", null, era.range));
    marker.appendChild(el("small", null, `${era.entries.length} ${era.entries.length === 1 ? "record" : "records"}`));
    group.appendChild(marker);

    const events = el("ol", "history-era-events");
    era.entries.forEach((item) => {
      const id = `history-${slugify(`${item.year}-${item.title}`)}`;
      const event = el("li", "history-era-event");
      const link = el("a", null);
      link.href = `#${id}`;
      link.appendChild(el("span", null, item.year));
      link.appendChild(el("strong", null, item.title));
      event.appendChild(link);
      events.appendChild(event);
    });
    group.appendChild(events);
    list.appendChild(group);
  });
}

function renderHistory(query = "") {
  const q = query.trim().toLowerCase();
  const timeline = $("#timeline");
  const expandButton = $("#historyExpandAll");
  if (expandButton) expandButton.textContent = "Expand all";
  timeline.innerHTML = "";
  const entries = data.history.filter((item) =>
    [item.year, item.title, ...(item.body || [])].join(" ").toLowerCase().includes(q)
  );

  if (!entries.length) {
    renderHistorySkim([]);
    timeline.appendChild(el("p", "empty", "No history matches."));
    queueMoveTopUpdate();
    return;
  }

  renderHistorySkim(entries);
  entries.forEach((item) => {
    const article = el("article", "event");
    article.id = `history-${slugify(`${item.year}-${item.title}`)}`;
    article.appendChild(el("div", "event-year", item.year));
    const body = el("div", "event-body");
    body.appendChild(el("h3", null, item.title));
    body.appendChild(historyDetails(item));
    article.appendChild(body);
    timeline.appendChild(article);
  });
  queueMoveTopUpdate();
}

function clearInlineSearchResults() {
  const results = $("#historySearchResults");
  if (!results) return;
  results.classList.remove("open");
  results.innerHTML = "";
}

function renderInlineSearchResults(query = "") {
  const results = $("#historySearchResults");
  if (!results) return;
  const q = query.trim().toLowerCase();
  results.innerHTML = "";
  if (q.length < 2) {
    clearInlineSearchResults();
    return;
  }

  const hits = getSearchIndex()
    .filter((item) => item.text.toLowerCase().includes(q))
    .slice(0, 8);

  if (!hits.length) {
    results.appendChild(el("p", "inline-search-empty", "No world references match."));
  } else {
    hits.forEach((hit) => {
      const button = el("button", "inline-search-result");
      button.type = "button";
      button.addEventListener("click", () => {
        jumpToSearchHit(hit);
        clearInlineSearchResults();
      });
      button.appendChild(el("span", "result-kind", hit.kind));
      button.appendChild(el("strong", null, hit.title));
      if (hit.label) button.appendChild(el("small", null, hit.label));
      results.appendChild(button);
    });
  }

  results.classList.add("open");
}

function renderRegions() {
  const kingdomGrid = $("#kingdomGrid");
  kingdomGrid.innerHTML = "";
  data.kingdoms.forEach((item) => {
    const card = el("article", "world-card");
    card.id = `kingdom-${slugify(item.name)}`;
    card.appendChild(el("span", "meta", "Sovereign Kingdom"));
    card.appendChild(el("h3", null, item.name));
    const facts = el("div", "fact-list");
    facts.appendChild(factRow("Ruling House", item.house));
    facts.appendChild(factRow("Estimated Population", item.population));
    facts.appendChild(factRow("Capital City", item.capital));
    if (item.capitalPopulation) facts.appendChild(factRow("Capital Estimated Population", item.capitalPopulation));
    card.appendChild(facts);
    card.appendChild(sourceDetails(item.detail));
    kingdomGrid.appendChild(card);
  });

  const territoryGrid = $("#territoryGrid");
  territoryGrid.innerHTML = "";
  data.territories.forEach((item) => {
    const card = el("article", "world-card territory");
    card.id = `territory-${slugify(item.name)}`;
    card.appendChild(el("span", "meta", "Territory"));
    card.appendChild(el("h3", null, item.name));
    const facts = el("div", "fact-list");
    facts.appendChild(factRow("Ruling House", item.rule));
    if (item.population) facts.appendChild(factRow("Estimated Population", item.population));
    if (item.capital) facts.appendChild(factRow("Capital City", item.capital));
    card.appendChild(facts);
    card.appendChild(sourceDetails(item.detail));
    territoryGrid.appendChild(card);
  });
}

function renderProphecies() {
  $("#prophecyDoctrine").textContent = data.prophecies.doctrine;
  const list = $("#prophecyList");
  data.prophecies.list.forEach(([title, text], index) => {
    const item = el("article", "prophecy");
    item.id = `prophecy-${slugify(title)}`;
    item.appendChild(el("span", null, String(index + 1).padStart(2, "0")));
    item.appendChild(el("h3", null, title));
    item.appendChild(el("p", null, text));
    list.appendChild(item);
  });
}

function renderReference() {
  const calendar = $("#calendarList");
  calendar.appendChild(el("p", "facts", data.calendarIntro));
  data.calendar.forEach(([month, days, season]) => {
    const row = el("div", "reference-row");
    row.id = `calendar-${slugify(month)}`;
    row.appendChild(el("strong", null, month));
    row.appendChild(el("span", null, season ? `${days} / ${season}` : days));
    calendar.appendChild(row);
  });

}

function buildSearchIndex() {
  const sectionResults = [
    ["Section", "Timeline", "From the Separation to the opening of Campaign 1.", "history"],
    ["Section", "Map", "Map of the Realm.", "map"],
    ["Section", "Kingdoms and Territories", "Ruling houses, capitals, populations, and regional notes.", "kingdoms"],
    ["Section", "The Seven Prophecies", data.prophecies.doctrine, "prophecies"],
    ["Section", "Calendar", data.calendarIntro, "calendar"]
  ].map(([kind, title, text, id]) => ({ kind, title, text, id }));

  const historyResults = data.history.map((item) => ({
    kind: "History",
    title: item.title,
    label: item.year,
    text: [item.year, item.title, ...(item.body || [])].join(" "),
    id: `history-${slugify(`${item.year}-${item.title}`)}`,
    resetHistory: true
  }));

  const kingdomResults = data.kingdoms.map((item) => ({
    kind: "Kingdom",
    title: item.name,
    label: `House ${item.house}`,
    text: [item.name, item.house, item.population, item.capital, item.capitalPopulation, item.detail].join(" "),
    id: `kingdom-${slugify(item.name)}`,
    openSource: true
  }));

  const territoryResults = data.territories.map((item) => ({
    kind: "Territory",
    title: item.name,
    label: item.rule,
    text: [item.name, item.rule, item.population, item.capital, item.detail].join(" "),
    id: `territory-${slugify(item.name)}`,
    openSource: true
  }));

  const prophecyResults = data.prophecies.list.map(([title, text]) => ({
    kind: "Prophecy",
    title,
    text: `${title} ${text}`,
    id: `prophecy-${slugify(title)}`
  }));

  const calendarResults = data.calendar.map(([month, days, season]) => ({
    kind: "Calendar",
    title: month,
    label: days,
    text: [month, days, season].join(" "),
    id: `calendar-${slugify(month)}`
  }));

  return [...sectionResults, ...historyResults, ...kingdomResults, ...territoryResults, ...prophecyResults, ...calendarResults];
}

function jumpToSearchHit(hit) {
  closeExpandedMap({ restoreFocus: false });

  if (hit.resetHistory) {
    $("#historySearch").value = "";
    renderHistory();
    clearInlineSearchResults();
  }

  requestAnimationFrame(() => {
    const target = document.getElementById(hit.id);
    if (!target) return;
    if (hit.openSource) {
      const details = target.querySelector("details");
      if (details) details.open = true;
    }
    if (hit.resetHistory) {
      const details = target.querySelector(".history-source");
      if (details) details.open = true;
    }
    fastScrollToTarget(target, { block: "center", updateHash: false }).then(() => {
      target.classList.add("search-focus");
      setTimeout(() => target.classList.remove("search-focus"), 1800);
    });
  });
}

function setupFastAnchorScroll() {
  document.addEventListener("click", (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;

    const hash = link.getAttribute("href");
    if (!hash || hash === "#") return;

    const target = document.getElementById(hash.slice(1));
    if (!target) return;

    event.preventDefault();
    closeExpandedMap({ restoreFocus: false });
    fastScrollToTarget(target).then(() => {
      if (target.classList.contains("event")) openHistoryEntry(target);
    });
  });
}

function setupGlobalSearch() {
  const input = $("#siteSearch");
  const results = $("#siteSearchResults");

  const closeResults = () => {
    results.classList.remove("open");
    results.innerHTML = "";
  };

  const jumpTo = (hit) => {
    jumpToSearchHit(hit);
    input.value = "";
    closeResults();
  };

  input.addEventListener("input", () => {
    const query = input.value.trim().toLowerCase();
    results.innerHTML = "";
    if (query.length < 2) {
      closeResults();
      return;
    }

    const hits = getSearchIndex()
      .filter((item) => item.text.toLowerCase().includes(query))
      .slice(0, 9);

    if (!hits.length) {
      results.appendChild(el("div", "site-search-empty", "No matches."));
    } else {
      hits.forEach((hit) => {
        const button = el("button", "site-search-result");
        button.type = "button";
        button.addEventListener("click", () => jumpTo(hit));
        button.appendChild(el("span", "result-kind", hit.kind));
        button.appendChild(el("strong", null, hit.title));
        if (hit.label) button.appendChild(el("small", null, hit.label));
        results.appendChild(button);
      });
    }

    results.classList.add("open");
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      input.value = "";
      closeResults();
    }
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".site-search")) closeResults();
  });
}

function openExpandedMap(trigger = document.activeElement) {
  const toggle = $("#mapToggle");
  const stage = $("#expandedMapStage");
  const closeButton = $("#mapClose");
  if (!toggle || !stage || document.body.classList.contains("map-open")) return;

  mapScrollY = window.scrollY;
  mapReturnFocus = trigger instanceof HTMLElement ? trigger : toggle;
  document.body.classList.add("map-open");
  toggle.setAttribute("aria-expanded", "true");
  stage.setAttribute("aria-hidden", "false");
  queueMoveTopUpdate();
  requestAnimationFrame(() => closeButton?.focus({ preventScroll: true }));
}

function closeExpandedMap({ restoreFocus = true } = {}) {
  const toggle = $("#mapToggle");
  const stage = $("#expandedMapStage");
  if (!toggle || !stage || !document.body.classList.contains("map-open")) return;

  document.body.classList.remove("map-open");
  toggle.setAttribute("aria-expanded", "false");
  stage.setAttribute("aria-hidden", "true");
  window.scrollTo(0, mapScrollY);
  if (restoreFocus) (mapReturnFocus || toggle).focus({ preventScroll: true });
  mapReturnFocus = null;
  queueMoveTopUpdate();
}

function setupExpandedMap() {
  const toggle = $("#mapToggle");
  const heroButton = $("#heroMapButton");
  const closeButton = $("#mapClose");

  toggle?.addEventListener("click", () => openExpandedMap(toggle));
  heroButton?.addEventListener("click", () => openExpandedMap(heroButton));
  closeButton?.addEventListener("click", () => closeExpandedMap());
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeExpandedMap();
  });
}

function shouldShowMoveTopButton() {
  const skim = $(".history-skim");
  if (!skim || document.body.classList.contains("map-open")) return false;
  const skimBottom = skim.getBoundingClientRect().bottom + window.scrollY;
  return window.scrollY > skimBottom;
}

function updateMoveTopButton() {
  const button = $("#moveTopButton");
  if (!button) return;
  const isVisible = shouldShowMoveTopButton();
  button.classList.toggle("visible", isVisible);
  button.setAttribute("aria-hidden", String(!isVisible));
  button.tabIndex = isVisible ? 0 : -1;
}

function queueMoveTopUpdate() {
  if (moveTopFrame) return;
  moveTopFrame = window.requestAnimationFrame(() => {
    moveTopFrame = null;
    updateMoveTopButton();
  });
}

function setupMoveTopButton() {
  const button = $("#moveTopButton");
  if (!button) return;
  button.addEventListener("click", () => {
    closeExpandedMap({ restoreFocus: false });
    history.pushState(null, "", "#home");
    scrollToY(0);
  });
  window.addEventListener("scroll", queueMoveTopUpdate, { passive: true });
  window.addEventListener("resize", queueMoveTopUpdate);
  updateMoveTopButton();
}

$("#historySearch").addEventListener("input", (event) => {
  renderHistory(event.target.value);
  renderInlineSearchResults(event.target.value);
});
$("#historySearch").addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.target.value = "";
    renderHistory();
    clearInlineSearchResults();
  }
});
$("#historyExpandAll").addEventListener("click", (event) => {
  const details = Array.from(document.querySelectorAll(".history-source"));
  const shouldOpen = details.some((node) => !node.open);
  details.forEach((node) => { node.open = shouldOpen; });
  event.target.textContent = shouldOpen ? "Collapse all" : "Expand all";
});
renderHistory();
renderRegions();
renderProphecies();
renderReference();
setupGlobalSearch();
setupExpandedMap();
setupFastAnchorScroll();
setupMoveTopButton();
