const vscode = require('vscode');
const fetch = require('node-fetch');

let panel; // simpan panel global supaya gak hilang

function activate(context) {
  const disposable = vscode.commands.registerCommand('miniPostman.open', () => {
    if (panel) {
      panel.reveal(vscode.ViewColumn.One);
      return;
    }

    panel = vscode.window.createWebviewPanel(
      'miniPostman',
      'QPostMan',
      vscode.ViewColumn.One,
      { enableScripts: true }
    );

    panel.webview.html = getWebviewContent();

    // Terima pesan dari webview untuk kirim request
    panel.webview.onDidReceiveMessage(async (message) => {
      if (message.command === 'sendRequest') {
        try {
          const options = {
            method: message.method,
            headers: message.headers || {},
          };

          if (message.method !== 'GET' && message.body) {
            options.body = message.body;
            if (!options.headers['Content-Type']) {
              options.headers['Content-Type'] = 'application/json';
            }
          }

          const start = Date.now();
          const response = await fetch(message.url, options);
          const elapsed = Date.now() - start;

          const text = await response.text();
          let data;
          try {
            data = JSON.stringify(JSON.parse(text), null, 2);
          } catch {
            data = text;
          }

          panel.webview.postMessage({
            command: 'response',
            status: response.status,
            time: elapsed,
            data,
          });
        } catch (error) {
          panel.webview.postMessage({
            command: 'error',
            error: error.message,
          });
        }
      }
    });

    panel.onDidDispose(() => {
      panel = undefined; // reset saat panel ditutup
    });
  });

  context.subscriptions.push(disposable);
}

function deactivate() {}

function getWebviewContent() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>QPostMan</title>
<style>
  body {
    font-family: var(--vscode-font-family, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif);
    background-color: var(--vscode-editor-background, #1e1e1e);
    color: var(--vscode-editor-foreground, #d4d4d4);
    margin: 0; padding: 16px;
  }
  .container {
    max-width: 800px; margin: auto;
  }
  .input-group {
    display: flex; gap: 8px; margin-bottom: 12px;
  }
  select, input, textarea, button {
    background-color: var(--vscode-input-background, #252526);
    color: var(--vscode-editor-foreground, #d4d4d4);
    border: 1px solid var(--vscode-input-border, #333);
    border-radius: 3px;
    padding: 6px 8px;
    font-size: 13px;
    font-family: inherit;
  }
  select#method {
    width: 120px;
    flex-shrink: 0;
  }
  input#url {
    flex-grow: 1;
  }
  textarea {
    width: 100%;
    min-height: 100px;
    resize: vertical;
    font-family: var(--vscode-editor-font-family, 'Consolas', 'Courier New', monospace);
  }
  button {
    cursor: pointer;
    transition: background-color 0.2s;
  }
  button:hover {
    background-color: var(--vscode-button-hoverBackground, #1177bb);
  }
  button.remove-field {
    background: #f44336;
    color: white;
    border: none;
    font-weight: bold;
    width: 28px;
    height: 28px;
    border-radius: 3px;
    padding: 0;
    line-height: 1;
    text-align: center;
  }
  button.remove-field:hover {
    background: #d32f2f;
  }
  .tabs {
    display: flex;
    border-bottom: 1px solid var(--vscode-sideBar-border, #00000050);
    margin-bottom: 8px;
  }
  .tab {
    padding: 6px 12px;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
  }
  .tab.active {
    font-weight: bold;
    border-bottom-color: var(--vscode-textLink-foreground, #3794ff);
  }
  .hidden { display: none; }
  #response {
    background-color: var(--vscode-sideBar-background, #252526);
    padding: 12px;
    border-radius: 3px;
    max-height: 400px;
    overflow: auto;
    white-space: pre-wrap;
    font-family: var(--vscode-editor-font-family, 'Consolas', 'Courier New', monospace);
  }
  .status {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 3px;
    font-weight: bold;
    margin-right: 8px;
  }
  .status.success {
    background-color: var(--vscode-terminal-ansiGreen, #4ec9b0);
    color: black;
  }
  .status.error {
    background-color: var(--vscode-errorForeground, #f48771);
    color: black;
  }
  .meta {
    margin-bottom: 8px;
    color: var(--vscode-descriptionForeground, #989898);
    font-size: 0.9em;
  }
</style>
</head>
<body>
<div class="container">
  <h2>QPostMan</h2>
  <div class="input-group">
    <select id="method">
      <option>GET</option>
      <option>POST</option>
      <option>PUT</option>
      <option>PATCH</option>
      <option>DELETE</option>
      <option>HEAD</option>
      <option>OPTIONS</option>
    </select>
    <input id="url" type="text" placeholder="https://api.example.com/endpoint" />
  </div>

  <div id="body-section">
    <div class="tabs">
      <div class="tab active" data-tab="json">JSON</div>
      <div class="tab" data-tab="raw">Raw</div>
      <div class="tab" data-tab="params">Params</div>
      <div class="tab" data-tab="headers">Headers</div>
    </div>

    <div id="json-editor">
      <textarea id="body" placeholder='{\n  "key": "value"\n}'></textarea>
      <button id="formatJson" style="margin-top:8px;">Format JSON</button>
    </div>
    <div id="raw-editor" class="hidden">
      <textarea id="rawBody" placeholder="Raw body"></textarea>
    </div>
    <div id="params-editor" class="hidden">
      <div id="params-fields"></div>
      <button id="add-param" type="button">+ Add Param</button>
    </div>
    <div id="headers-editor" class="hidden">
      <div id="headers-fields"></div>
      <button id="add-header" type="button">+ Add Header</button>
    </div>
  </div>

  <div style="margin-top:12px;">
    <button id="sendBtn" type="button">Send Request</button>
    <button id="clearBtn" type="button">Clear</button>
  </div>

  <h3>Response</h3>
  <div id="response-meta" class="meta"></div>
  <pre id="response">Ready to send requests...</pre>
</div>

<footer style="text-align:center; padding:12px 0; color:#888; font-size:12px; border-top:1px solid #444; margin-top:20px;">
  <a href="https://github.com/Baihaqi34">© 2025 Ahmad Baihaqi</a>
</footer>


<script>
  const vscode = acquireVsCodeApi();

  

  // Terima pesan dari extension (node side)
  window.addEventListener('message', event => {
    const msg = event.data;
    if (msg.command === 'response') {
      const statusClass = msg.status >= 200 && msg.status < 300 ? 'success' : 'error';
      elements.responseMeta.innerHTML =
        '<span class="status ' + statusClass + '">' + msg.status + '</span>' +
        '<span>' + msg.time + ' ms</span>' +
        '<span>' + new Date().toLocaleTimeString() + '</span>';
      elements.response.textContent = msg.data;
    } else if (msg.command === 'error') {
      elements.responseMeta.innerHTML = '<span class="status error">Error</span> <span>' + new Date().toLocaleTimeString() + '</span>';
      elements.response.textContent = msg.error;
    }
  });

  // Load saved state atau default
  const savedState = vscode.getState() || {
    currentTab: "json",
    method: "GET",
    url: "",
    body: "",
    rawBody: "",
    params: [],
    headers: []
  };

  const elements = {
    method: document.getElementById("method"),
    url: document.getElementById("url"),
    body: document.getElementById("body"),
    rawBody: document.getElementById("rawBody"),
    jsonEditor: document.getElementById("json-editor"),
    rawEditor: document.getElementById("raw-editor"),
    paramsEditor: document.getElementById("params-editor"),
    headersEditor: document.getElementById("headers-editor"),
    sendBtn: document.getElementById("sendBtn"),
    clearBtn: document.getElementById("clearBtn"),
    formatJson: document.getElementById("formatJson"),
    response: document.getElementById("response"),
    responseMeta: document.getElementById("response-meta"),
    tabs: document.querySelectorAll(".tab"),
    paramsFields: document.getElementById("params-fields"),
    headersFields: document.getElementById("headers-fields"),
    addParam: document.getElementById("add-param"),
    addHeader: document.getElementById("add-header"),
  };

  // Fungsi bikin input param/header
  function createField(type, key = "", value = "") {
    const container = type === "param" ? elements.paramsFields : elements.headersFields;
    const div = document.createElement("div");
    div.className = "input-group " + type + "-field";
    div.innerHTML =
      '<input type="text" placeholder="' + (type === "param" ? "Key" : "Header") + '" class="' + type + '-key" value="' + key + '">' +
      '<input type="text" placeholder="Value" class="' + type + '-value" value="' + value + '">' +
      '<button type="button" class="remove-field">×</button>';
    container.appendChild(div);

    // Remove field event
    div.querySelector(".remove-field").addEventListener("click", () => {
      div.remove();
      saveState();
    });

    // Simpan state otomatis saat inputan berubah
    div.querySelector("." + type + "-key").addEventListener("input", saveState);
    div.querySelector("." + type + "-value").addEventListener("input", saveState);
  }

  // Toggle editor sesuai tab aktif
  function toggleEditors(tab) {
    elements.jsonEditor.classList.toggle("hidden", tab !== "json");
    elements.rawEditor.classList.toggle("hidden", tab !== "raw");
    elements.paramsEditor.classList.toggle("hidden", tab !== "params");
    elements.headersEditor.classList.toggle("hidden", tab !== "headers");
  }

  // Kumpulkan param/header jadi array object
  function collectFields(type) {
    const fields = document.querySelectorAll("." + type + "-field");
    const arr = [];
    fields.forEach(field => {
      const key = field.querySelector("." + type + "-key").value.trim();
      const value = field.querySelector("." + type + "-value").value.trim();
      if (key) arr.push({ key, value });
    });
    return arr;
  }

  // Simpan semua state ke vscode
  function saveState() {
    const activeTab = Array.from(elements.tabs).find(t => t.classList.contains("active")).dataset.tab;
    vscode.setState({
      currentTab: activeTab,
      method: elements.method.value,
      url: elements.url.value,
      body: elements.body.value,
      rawBody: elements.rawBody.value,
      params: collectFields("param"),
      headers: collectFields("header"),
    });
  }

  // Restore UI dari state yang disimpan
  function restoreState() {
    elements.method.value = savedState.method;
    elements.url.value = savedState.url;
    elements.body.value = savedState.body;
    elements.rawBody.value = savedState.rawBody;

    elements.tabs.forEach(tab => {
      tab.classList.toggle("active", tab.dataset.tab === savedState.currentTab);
    });
    toggleEditors(savedState.currentTab);

    // Isi param dan header fields
    elements.paramsFields.innerHTML = "";
    elements.headersFields.innerHTML = "";
    if (savedState.params.length) {
      savedState.params.forEach(({ key, value }) => createField("param", key, value));
    } else {
      createField("param");
    }
    if (savedState.headers.length) {
      savedState.headers.forEach(({ key, value }) => createField("header", key, value));
    } else {
      createField("header");
    }
  }

  // Event listeners

  // Tab klik
  elements.tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      elements.tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      toggleEditors(tab.dataset.tab);
      saveState();
    });
  });

  // Inputan simpan state
  elements.method.addEventListener("change", saveState);
  elements.url.addEventListener("input", saveState);
  elements.body.addEventListener("input", saveState);
  elements.rawBody.addEventListener("input", saveState);

  // Tambah param/header
  elements.addParam.addEventListener("click", e => {
    e.preventDefault();
    createField("param");
    saveState();
  });
  elements.addHeader.addEventListener("click", e => {
    e.preventDefault();
    createField("header");
    saveState();
  });

  // Format JSON tombol
  elements.formatJson.addEventListener("click", () => {
    try {
      const parsed = JSON.parse(elements.body.value);
      elements.body.value = JSON.stringify(parsed, null, 2);
      saveState();
    } catch (e) {
      alert("Invalid JSON: " + e.message);
    }
  });

  // Kirim request tombol
  elements.sendBtn.addEventListener("click", () => {
    const method = elements.method.value;
    const url = elements.url.value.trim();

    if (!url) {
      alert("URL tidak boleh kosong!");
      return;
    }

    let fullUrl = url;
    const params = collectFields("param").reduce((obj, { key, value }) => {
      obj[key] = value;
      return obj;
    }, {});
    const headers = collectFields("header").reduce((obj, { key, value }) => {
      obj[key] = value;
      return obj;
    }, {});

    if (method === "GET" && Object.keys(params).length) {
      const query = new URLSearchParams(params).toString();
      fullUrl += (url.includes("?") ? "&" : "?") + query;
    }

    const activeTab = Array.from(elements.tabs).find(t => t.classList.contains("active")).dataset.tab;
    let body = "";
    if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
      body = activeTab === "json" ? elements.body.value : activeTab === "raw" ? elements.rawBody.value : "";
    }

    vscode.postMessage({
      command: "sendRequest",
      method,
      url: fullUrl,
      headers,
      body,
    });

    elements.response.textContent = "⏳ Sending request...";
    elements.responseMeta.textContent = "";
  });

  // Clear tombol
  elements.clearBtn.addEventListener("click", e => {
    e.preventDefault();
    elements.url.value = "";
    elements.body.value = "";
    elements.rawBody.value = "";
    elements.paramsFields.innerHTML = "";
    elements.headersFields.innerHTML = "";
    createField("param");
    createField("header");
    elements.response.textContent = "Ready to send requests...";
    elements.responseMeta.textContent = "";
    saveState();
  });

  // Restore state saat load
  restoreState();
</script>
</body>
</html>`;
}

module.exports = { activate, deactivate };
