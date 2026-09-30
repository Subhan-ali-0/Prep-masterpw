let supabaseClient = null;
let allBatches = [];

const $ = (id) => document.getElementById(id);

function showPage(pageId) {
  document.querySelectorAll(".page").forEach(page => {
    page.classList.toggle("hidden", page.id !== pageId);
  });

  document.querySelectorAll(".bottom-nav button").forEach(button => {
    button.classList.toggle("active", button.dataset.page === pageId);
  });
}

document.querySelectorAll(".bottom-nav button").forEach(button => {
  button.addEventListener("click", () => showPage(button.dataset.page));
});

$("menuBtn").addEventListener("click", () => {
  $("menu").classList.toggle("hidden");
});

document.addEventListener("click", (event) => {
  if (!event.target.closest("#menu") && !event.target.closest("#menuBtn")) {
    $("menu").classList.add("hidden");
  }
});

function getUsername() {
  return localStorage.getItem("pm_username") || "";
}

$("username").value = getUsername();

$("saveUsername").addEventListener("click", () => {
  const name = $("username").value.trim().slice(0, 24);

  if (!name) {
    $("accountStatus").textContent = "Username enter karo.";
    return;
  }

  localStorage.setItem("pm_username", name);
  $("accountStatus").textContent = "Username saved.";
});

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function batchCard(batch, enrolled = false) {
  const image = batch.image
    ? `<img src="${escapeHtml(batch.image)}" alt="" loading="lazy">`
    : `<div style="height:145px;background:#f1f1f1"></div>`;

  return `
    <article class="batch-card">
      ${image}
      <div class="batch-info">
        <h3>${escapeHtml(batch.title)}</h3>
        <p>${escapeHtml(batch.description || "Prep Master batch")}</p>
        <div class="actions">
          <button data-study="${escapeHtml(batch.id)}">Study</button>
          <button class="secondary" data-enroll="${escapeHtml(batch.id)}">
            ${enrolled ? "Added" : "Enroll"}
          </button>
        </div>
      </div>
    </article>`;
}

function renderBatches(list = allBatches) {
  $("batchList").innerHTML = list.length
    ? list.map(batch => batchCard(
        batch,
        getMyBatches().some(item => item.id === batch.id)
      )).join("")
    : "<p>No batches found.</p>";
}

function getMyBatches() {
  try {
    return JSON.parse(localStorage.getItem("pm_enrolled") || "[]");
  } catch {
    return [];
  }
}

function renderMyBatches() {
  const batches = getMyBatches();
  $("myBatchList").innerHTML = batches.length
    ? batches.map(batch => batchCard(batch, true)).join("")
    : "<p>Abhi koi batch enroll nahi kiya.</p>";
}

document.addEventListener("click", event => {
  const studyId = event.target.dataset.study;
  const enrollId = event.target.dataset.enroll;

  if (studyId) {
    window.location.href = `/api/study?id=${encodeURIComponent(studyId)}`;
  }

  if (enrollId) {
    const batch = allBatches.find(item => item.id === enrollId);
    if (!batch) return;

    const current = getMyBatches();
    if (!current.some(item => item.id === batch.id)) {
      current.push(batch);
      localStorage.setItem("pm_enrolled", JSON.stringify(current));
    }

    renderBatches();
    renderMyBatches();
    event.target.textContent = "Added";
  }
});

$("batchSearch").addEventListener("input", event => {
  const term = event.target.value.toLowerCase();
  renderBatches(allBatches.filter(batch =>
    batch.title.toLowerCase().includes(term) ||
    batch.description.toLowerCase().includes(term)
  ));
});

async function loadBatches() {
  try {
    const response = await fetch("/api/batches");
    const data = await response.json();

    if (!response.ok) throw new Error(data.error || "Batches error");

    allBatches = data.batches || [];
    renderBatches();
    renderMyBatches();
  } catch (error) {
    $("batchList").textContent = error.message;
  }
}

function addChatMessage(item) {
  const row = document.createElement("div");
  row.className = "chat-item";

  const name = document.createElement("strong");
  name.textContent = item.username || "Student";

  const message = document.createElement("div");
  message.textContent = item.message || "";

  const time = document.createElement("small");
  time.textContent = item.created_at
    ? new Date(item.created_at).toLocaleString()
    : "";

  row.append(name, message, time);
  $("chatMessages").appendChild(row);
  $("chatMessages").scrollTop = $("chatMessages").scrollHeight;
}

async function setupCommunity() {
  try {
    const configResponse = await fetch("/api/config");
    const config = await configResponse.json();

    if (!config.supabaseUrl || !config.supabaseKey) {
      $("chatStatus").textContent = "Supabase environment variables configure nahi hain.";
      return;
    }

    supabaseClient = window.supabase.createClient(
      config.supabaseUrl,
      config.supabaseKey
    );

    const { data, error } = await supabaseClient
      .from("community_messages")
      .select("id, username, message, created_at")
      .order("created_at", { ascending: true })
      .limit(100);

    if (error) throw error;

    $("chatMessages").innerHTML = "";
    data.forEach(addChatMessage);

    supabaseClient
      .channel("community-live")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "community_messages"
        },
        payload => addChatMessage(payload.new)
      )
      .subscribe(status => {
        $("chatStatus").textContent =
          status === "SUBSCRIBED" ? "Connected" : "Connecting...";
      });

  } catch (error) {
    console.error(error);
    $("chatStatus").textContent =
      "Community connect nahi hua. Supabase settings check karein.";
  }
}

$("chatForm").addEventListener("submit", async event => {
  event.preventDefault();

  const message = $("chatInput").value.trim();
  const username = getUsername() || "Student";

  if (!message || !supabaseClient) return;

  $("chatInput").value = "";

  const { error } = await supabaseClient
    .from("community_messages")
    .insert({ username, message });

  if (error) {
    $("chatStatus").textContent = "Message send nahi hua.";
    console.error(error);
  }
});

function addAiBubble(text, type) {
  const bubble = document.createElement("div");
  bubble.className = `bubble ${type}`;
  bubble.textContent = text;
  $("aiMessages").appendChild(bubble);
  $("aiMessages").scrollTop = $("aiMessages").scrollHeight;
}

$("aiForm").addEventListener("submit", async event => {
  event.preventDefault();

  const message = $("aiInput").value.trim();
  if (!message) return;

  $("aiInput").value = "";
  addAiBubble(message, "user");

  const loading = document.createElement("div");
  loading.className = "bubble bot";
  loading.textContent = "Thinking...";
  $("aiMessages").appendChild(loading);

  try {
    const response = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message })
    });

    const data = await response.json();
    loading.textContent = data.reply || data.error || "Answer nahi mila.";
  } catch {
    loading.textContent = "AI se connection nahi ho paaya.";
  }
});

loadBatches();
setupCommunity();
