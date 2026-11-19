const AI_SETTINGS_KEY = "quantlab_ai_byok_settings_v1";

function loadAiSettings() {
  try {
    const raw = localStorage.getItem(AI_SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return {
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-flash",
    apiKey: "",
  };
}

function saveAiSettings(settings) {
  try {
    localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(settings));
  } catch (_) {}
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (s) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[s]));
}

export function initAiAssistant({ getContextSnapshot }) {
  let settings = loadAiSettings();
  let messages = [
    {
      role: "assistant",
      content:
        "你好！我是你的量化投研助手（默认预置 `deepseek-flash` 模型）。\n\n" +
        "在上方填入你的 API Key（仅保存在当前浏览器 localStorage，绝不上传 GitHub），然后可以点击下方快捷按钮，一键把**当前回测 / Walk-Forward / 每日行情 / 模拟盘数据**发给我做客观诊断与复盘。",
    },
  ];

  const drawer = document.getElementById("ai-drawer");
  const backdrop = document.getElementById("ai-backdrop");
  const btnOpen = document.getElementById("btn-open-ai");
  const btnClose = document.getElementById("btn-close-ai");
  const baseUrlInput = document.getElementById("ai-base-url");
  const modelInput = document.getElementById("ai-model");
  const keyInput = document.getElementById("ai-api-key");
  const btnSaveCfg = document.getElementById("btn-save-ai-cfg");
  const cfgStatus = document.getElementById("ai-cfg-status");
  const chatBox = document.getElementById("ai-chat-messages");
  const form = document.getElementById("ai-chat-form");
  const promptInput = document.getElementById("ai-prompt-input");
  const sendBtn = document.getElementById("ai-send-btn");
  const clearBtn = document.getElementById("btn-clear-ai-chat");

  baseUrlInput.value = settings.baseUrl || "https://api.deepseek.com/v1";
  modelInput.value = settings.model || "deepseek-flash";
  keyInput.value = settings.apiKey || "";
  updateCfgStatus();

  function updateCfgStatus() {
    if (settings.apiKey) {
      cfgStatus.textContent = `已本地配置 · 模型 ${settings.model}`;
      cfgStatus.style.color = "var(--success)";
    } else {
      cfgStatus.textContent = "未填写 Key（仅存本机浏览器）";
      cfgStatus.style.color = "var(--warning)";
    }
  }

  function openDrawer() {
    drawer.classList.remove("hidden");
    backdrop.classList.remove("hidden");
    renderMessages();
  }

  function closeDrawer() {
    drawer.classList.add("hidden");
    backdrop.classList.add("hidden");
  }

  function renderMessages() {
    chatBox.innerHTML = messages
      .map((m) => {
        const isUser = m.role === "user";
        return `
          <div class="ai-msg ${isUser ? "ai-msg-user" : "ai-msg-bot"}">
            <div class="ai-msg-role">${isUser ? "你" : `AI 量化助手 (${escapeHtml(settings.model)})`}</div>
            <div class="ai-msg-body">${escapeHtml(m.content)}</div>
          </div>`;
      })
      .join("");
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  async function sendQuestion(userText, contextType = "general") {
    const trimmed = userText.trim();
    if (!trimmed) return;
    if (!settings.apiKey) {
      messages.push({
        role: "assistant",
        content: "请先在上方「模型与 API 配置」中粘贴你在 /Users/fiona/Workspace/.env 里的 API Key 并点「保存本地配置」。放心，Key 只保存在你自己的浏览器 localStorage 中，不会提交到任何仓库。",
      });
      renderMessages();
      return;
    }

    messages.push({ role: "user", content: trimmed });
    messages.push({ role: "assistant", content: "正在调用大模型分析量化数据..." });
    renderMessages();
    sendBtn.disabled = true;

    const ctxObj = getContextSnapshot(contextType);
    const systemPrompt =
      "你是一位严谨、客观、偏学术与风控导向的量化投研导师，正在辅导一位从 10 万以内起步的量化学习者。" +
      "绝对禁止承诺收益或盲目预测明日涨跌；请结合提供的客观量化数据，重点分析收益风险比、最大回撤、费用磨损、过拟合风险、未来函数排查和仓位纪律，回答简洁清晰、分点呈现。";

    const apiMessages = [
      { role: "system", content: systemPrompt },
      {
        role: "system",
        content: `当前 QuantLab 工作台实时上下文 JSON：\n${JSON.stringify(ctxObj)}`,
      },
      ...messages
        .slice(0, -1)
        .filter((m) => m.role === "user" || m.role === "assistant")
        .slice(-8),
    ];

    try {
      const endpoint = `${settings.baseUrl.replace(/\/+$/, "")}/chat/completions`;
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${settings.apiKey}`,
        },
        body: JSON.stringify({
          model: settings.model || "deepseek-flash",
          temperature: 0.3,
          messages: apiMessages,
        }),
      });
      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`HTTP ${resp.status}: ${errText.slice(0, 200)}`);
      }
      const data = await resp.json();
      const reply = data?.choices?.[0]?.message?.content?.trim() || "(模型未返回文本内容)";
      messages[messages.length - 1] = { role: "assistant", content: reply };
    } catch (err) {
      messages[messages.length - 1] = {
        role: "assistant",
        content:
          `调用失败：${err.message}\n\n` +
          "排查建议：\n" +
          "1) 检查 Base URL 与模型名（如 deepseek-flash / deepseek-chat）是否与你 .env 中一致；\n" +
          "2) 若该 API 网关禁止浏览器跨域（CORS），建议将 LLM_API_KEY 配置到 GitHub 仓库 Secrets，由每日盘后 GitHub Actions 在服务端自动调用生成简报。",
      };
    } finally {
      sendBtn.disabled = false;
      renderMessages();
    }
  }

  btnOpen.addEventListener("click", openDrawer);
  btnClose.addEventListener("click", closeDrawer);
  backdrop.addEventListener("click", closeDrawer);

  btnSaveCfg.addEventListener("click", () => {
    settings = {
      baseUrl: baseUrlInput.value.trim() || "https://api.deepseek.com/v1",
      model: modelInput.value.trim() || "deepseek-flash",
      apiKey: keyInput.value.trim(),
    };
    saveAiSettings(settings);
    updateCfgStatus();
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = promptInput.value;
    promptInput.value = "";
    sendQuestion(text, "general");
  });

  clearBtn.addEventListener("click", () => {
    messages = messages.slice(0, 1);
    renderMessages();
  });

  document.querySelectorAll("[data-ai-preset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const kind = btn.dataset.aiPreset;
      const prompts = {
        backtest: "请结合当前市场的回测指标与 Walk-Forward 样本外验证结果，诊断哪些地方存在过拟合或手续费磨损风险，并给出 3 条可落地的改进建议。",
        daily: "请点评当前最新盘后 ETF 行情、20 日动量排名和避险信号，指出当前市场结构风险与学习者应注意的纪律。",
        journal: "请复盘我当前市场的模拟盘持仓与交易流水，检查仓位集中度、单笔佣金摩擦与执行纪律。",
        strategy: "基于当前 ETF 池，帮我设计一个低参数、防未来函数的风控改良思路（例如波动率降仓或分批错峰调仓），并列出在 Colab 验证的步骤。",
      };
      sendQuestion(prompts[kind] || prompts.backtest, kind);
    });
  });

  renderMessages();
}
