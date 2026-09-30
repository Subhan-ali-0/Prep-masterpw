
/* =========================================
   PREP MASTER - MAIN JAVASCRIPT
========================================= */

const $ = selector => document.querySelector(selector);

let batches = [];

const enrolledKey = "pm_enrolled_v1";
const usernameKey = "pm_username";

/* =========================================
   LOCAL STORAGE
========================================= */

function getEnrolled() {
  try {
    return JSON.parse(
      localStorage.getItem(enrolledKey) || "[]"
    );
  } catch {
    return [];
  }
}

function saveEnrolled(list) {
  localStorage.setItem(
    enrolledKey,
    JSON.stringify(list)
  );
}

function getUsername() {
  return localStorage.getItem(usernameKey) || "Student";
}

/* =========================================
   HTML SECURITY
========================================= */

function safe(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]
  );
}

/* =========================================
   PAGE NAVIGATION
========================================= */

function showPage(name) {

  document
    .querySelectorAll(".page")
    .forEach(page => {
      page.classList.add("hidden");
    });

  const page = $(`#${name}Page`);

  if (page) {
    page.classList.remove("hidden");
  }

  document
    .querySelectorAll(".bottom-nav button")
    .forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.page === name
      );
    });

  $("#menu").classList.add("hidden");

  if (name === "mybatches") {
    renderMyBatches();
  }
}

document
  .querySelectorAll("[data-page]")
  .forEach(button => {

    button.addEventListener("click", () => {
      showPage(button.dataset.page);
    });

  });

/* =========================================
   THREE DOT MENU
========================================= */

$("#menuBtn").addEventListener("click", () => {

  $("#menu").classList.toggle("hidden");

});

document.addEventListener("click", event => {

  if (
    !event.target.closest("#menu") &&
    !event.target.closest("#menuBtn")
  ) {
    $("#menu").classList.add("hidden");
  }

});

/* =========================================
   BATCH CARD
========================================= */

function cardHTML(batch) {

  const enrolled = getEnrolled().includes(
    String(batch.id)
  );

  const image = batch.image
    ? `
      <img
        class="batch-image"
        src="${safe(batch.image)}"
        alt="${safe(batch.title)}"
        loading="lazy"
        onerror="this.style.display='none'"
      >
    `
    : `
      <div class="batch-image placeholder">
        Prep Master
      </div>
    `;

  return `
    <article class="batch-card">

      ${image}

      <div class="batch-info">

        <h3>
          ${safe(batch.title)}
        </h3>

        ${
          batch.description
            ? `<p class="muted">${safe(batch.description)}</p>`
            : ""
        }

        <div class="actions">

          <button
            data-study="${safe(batch.id)}"
          >
            Study
          </button>

          <button
            class="enroll"
            data-enroll="${safe(batch.id)}"
          >
            ${enrolled ? "Enrolled ✓" : "Enroll"}
          </button>

        </div>

      </div>

    </article>
  `;
}

/* =========================================
   RENDER BATCHES
========================================= */

function renderList(target, list) {

  const container = $(target);

  if (!list.length) {

    container.innerHTML = `
      <p class="muted">
        Abhi koi batch nahi mila.
      </p>
    `;

    return;
  }

  container.innerHTML = list
    .map(batch => cardHTML(batch))
    .join("");

}

function renderBatches() {

  const query = $("#search")
    .value
    .trim()
    .toLowerCase();

  const filtered = batches.filter(batch => {

    return batch.title
      .toLowerCase()
      .includes(query);

  });

  renderList("#batchList", filtered);

}

function renderMyBatches() {

  const enrolled = getEnrolled();

  const myBatches = batches.filter(batch => {

    return enrolled.includes(String(batch.id));

  });

  renderList("#myBatchList", myBatches);

}

/* =========================================
   BATCH BUTTONS
========================================= */

document.addEventListener("click", event => {

  const study = event.target.closest("[data-study]");

  const enroll = event.target.closest("[data-enroll]");

  /* STUDY BUTTON */

  if (study) {

    const id = study.dataset.study;

    if (!id) {

      alert("Batch ID nahi mili.");

      return;
    }

    window.location.href =
      `/api/study/${encodeURIComponent(id)}`;

  }

  /* ENROLL BUTTON */

  if (enroll) {

    const id = String(enroll.dataset.enroll);

    const list = getEnrolled();

    if (!list.includes(id)) {

      list.push(id);

    }

    saveEnrolled(list);

    renderBatches();

    renderMyBatches();

  }

});

/* =========================================
   SEARCH
========================================= */

$("#search").addEventListener(
  "input",
  renderBatches
);

/* =========================================
   LOAD BATCHES FROM API
========================================= */

async function loadBatches() {

  try {

    $("#batchList").innerHTML = `
      <p class="muted">
        Loading batches...
      </p>
    `;

    const response = await fetch("/api/batches");

    const data = await response.json();

    if (!response.ok) {

      throw new Error(
        data.error || "Batches load nahi hue."
      );

    }

    batches = data.batches || [];

    renderBatches();

  } catch (error) {

    console.error(error);

    $("#batchList").innerHTML = `
      <p class="muted">
        ${safe(error.message)}
      </p>
    `;

  }

}

loadBatches();

/* =========================================
   ACCOUNT / USERNAME
========================================= */

$("#username").value = localStorage.getItem(
  usernameKey
) || "";

$("#saveAccount").addEventListener("click", () => {

  const username = $("#username")
    .value
    .trim()
    .slice(0, 24);

  if (!username) {

    $("#accountStatus").textContent =
      "Pehle username likhein.";

    return;
  }

  localStorage.setItem(
    usernameKey,
    username
  );

  $("#accountStatus").textContent =
    `Username saved: ${username}`;

});

/* =========================================
   COMMUNITY CHAT
========================================= */

const socket = io();

function addMessage(item) {

  const div = document.createElement("div");

  div.className = "bubble";

  const username = document.createElement("span");

  username.className = "who";

  username.textContent =
    item.username || "Student";

  const message = document.createElement("span");

  message.textContent =
    item.message || "";

  const time = document.createElement("span");

  time.className = "when";

  time.textContent = item.time
    ? new Date(item.time).toLocaleString()
    : "";

  div.append(
    username,
    message,
    time
  );

  $("#messages").append(div);

  $("#messages").scrollTop =
    $("#messages").scrollHeight;

}

/* Previous messages */

socket.on("chat-history", items => {

  $("#messages").innerHTML = "";

  (items || []).forEach(addMessage);

});

/* New messages */

socket.on("chat-message", item => {

  addMessage(item);

});

/* Send message */

$("#chatForm").addEventListener("submit", event => {

  event.preventDefault();

  const message = $("#chatInput")
    .value
    .trim();

  if (!message) return;

  const username = getUsername();

  socket.emit("chat-message", {
    username,
    message
  });

  $("#chatInput").value = "";

});

/* =========================================
   AI DOUBTS CHAT
========================================= */

function addAI(message, type = "bot") {

  const div = document.createElement("div");

  div.className = `bubble ${type}`;

  div.textContent = message;

  $("#aiMessages").append(div);

  $("#aiMessages").scrollTop =
    $("#aiMessages").scrollHeight;

}

$("#aiForm").addEventListener(
  "submit",
  async event => {

    event.preventDefault();

    const message = $("#aiInput")
      .value
      .trim();

    if (!message) return;

    addAI(message, "user");

    $("#aiInput").value = "";

    const loading = document.createElement("div");

    loading.className = "bubble bot";

    loading.textContent = "Thinking...";

    $("#aiMessages").append(loading);

    try {

      const response = await fetch("/api/ai", {

        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          message
        })

      });

      const data = await response.json();

      loading.remove();

      addAI(
        data.reply ||
        data.error ||
        "Response nahi mila."
      );

    } catch (error) {

      loading.remove();

      addAI(
        "Connection error. Thodi der baad try karein."
      );

    }

  }
);

