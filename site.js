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

const factRow = (label, value) => {
  const row = el("div", "fact-row");
  row.appendChild(el("span", null, label));
  row.appendChild(el("strong", null, value || "-"));
  return row;
};

const sourceDetails = (text) => {
  const details = el("details", "source-entry");
  details.appendChild(el("summary", null, "Full source entry"));
  details.appendChild(el("p", null, text));
  return details;
};

const historyDetails = (item) => {
  const details = el("details", "history-source");
  details.appendChild(el("summary", null, "Read source text"));
  (item.body || []).forEach((paragraph) => details.appendChild(el("p", null, paragraph)));
  return details;
};

function renderHistorySkim(entries = data.history) {
  const list = $("#historyJumpList");
  list.innerHTML = "";
  entries.forEach((item) => {
    const id = `history-${slugify(`${item.year}-${item.title}`)}`;
    const link = el("a", "history-jump");
    link.href = `#${id}`;
    link.appendChild(el("span", null, item.year));
    link.appendChild(el("strong", null, item.title));
    list.appendChild(link);
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
    timeline.appendChild(el("p", "empty", "No matching history entries."));
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
    ["Section", "History", "A general historical timeline covering the larger historical events of the Realm of Iosandros.", "history"],
    ["Section", "Map", "Map of the Realm.", "map"],
    ["Section", "The 13 Kingdoms and The Territories", "A comprehensive list of each of the 13 Kingdoms.", "kingdoms"],
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

function setupGlobalSearch() {
  const input = $("#siteSearch");
  const results = $("#siteSearchResults");
  const index = buildSearchIndex();

  const closeResults = () => {
    results.classList.remove("open");
    results.innerHTML = "";
  };

  const jumpTo = (hit) => {
    if (hit.resetHistory) {
      $("#historySearch").value = "";
      renderHistory();
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
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.classList.add("search-focus");
      setTimeout(() => target.classList.remove("search-focus"), 1800);
    });

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

    const hits = index
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

$("#historySearch").addEventListener("input", (event) => renderHistory(event.target.value));
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
