(() => {
  const APP_VERSION = "20260607-field-trip-v1";

  const STORAGE = {
    favorites: "gemApp.favorites.v1",
    settings: "gemApp.settings.v1",
    identifications: "gemApp.identifications.v1",
  };

  const DEFAULT_SETTINGS = {
    apiKey: "",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "openai/gpt-4.1-mini",
    outdoorMode: true,
  };

  const IMAGE_MAP = {
    crystal: "assets/crystal.svg",
    gemstone: "assets/gemstone.svg",
    jade: "assets/jade.svg",
    mineral: "assets/mineral.svg",
    "clear-quartz": "assets/clear-quartz.svg",
    amethyst: "assets/amethyst.svg",
    citrine: "assets/citrine.svg",
    "rose-quartz": "assets/rose-quartz.svg",
    "smoky-quartz": "assets/smoky-quartz.svg",
    "phantom-quartz": "assets/phantom-quartz.svg",
    "rutilated-quartz": "assets/rutilated-quartz.svg",
  };

  const state = {
    data: null,
    imageCredits: null,
    query: "",
    selectedCategory: "全部",
    settings: { ...DEFAULT_SETTINGS },
    isOnline: navigator.onLine,
    selectedImage: "",
    identifying: false,
    lastResult: null,
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    state.settings = loadSettings();
    applyOutdoorMode();
    bindNavigation();
    bindNetworkEvents();
    updateNetworkPill();
    await loadGemData();
    await loadImageCredits();
    renderRoute();
    registerServiceWorker();
  }

  function bindNavigation() {
    $("#bottom-nav").addEventListener("click", (event) => {
      const button = event.target.closest("[data-route]");
      if (!button) return;
      location.hash = button.dataset.route;
    });

    window.addEventListener("hashchange", renderRoute);
  }

  function bindNetworkEvents() {
    window.addEventListener("online", () => {
      state.isOnline = true;
      updateNetworkPill();
      if (currentRoute().name === "identify") renderIdentify();
    });

    window.addEventListener("offline", () => {
      state.isOnline = false;
      updateNetworkPill();
      if (currentRoute().name === "identify") renderIdentify();
    });
  }

  async function loadGemData() {
    if (location.protocol !== "file:") {
      try {
        const response = await fetch(`data/gems.json?v=${APP_VERSION}`, { cache: "no-store" });
        if (response.ok) {
          state.data = await response.json();
          return;
        }
      } catch (error) {
        console.warn("JSON load failed, falling back to embedded data.", error);
      }
    }

    if (window.GEM_DATA) {
      state.data = window.GEM_DATA;
      return;
    }

    $("#app").innerHTML = `<section class="notice danger">数据库加载失败。请用本地服务器打开，或检查 data/gems.json 是否存在。</section>`;
  }

  async function loadImageCredits() {
    if (location.protocol !== "file:") {
      try {
        const response = await fetch(`data/image-credits.json?v=${APP_VERSION}`, { cache: "no-store" });
        if (response.ok) {
          state.imageCredits = await response.json();
          return;
        }
      } catch (error) {
        console.warn("Image credits load failed, falling back to embedded data.", error);
      }
    }

    state.imageCredits = window.GEM_IMAGE_CREDITS || { images: {} };
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    if (location.protocol === "file:") return;

    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    navigator.serviceWorker
      .register("./service-worker.js")
      .then((registration) => registration.update())
      .catch((error) => {
        console.warn("Service worker registration failed.", error);
      });
  }

  function currentRoute() {
    const hash = decodeURIComponent(location.hash.replace(/^#/, ""));
    if (!hash || hash === "encyclopedia") return { name: "encyclopedia" };
    if (hash === "identify") return { name: "identify" };
    if (hash === "favorites") return { name: "favorites" };
    if (hash === "settings") return { name: "settings" };
    if (hash === "field-kit") return { name: "field-kit" };
    if (hash.startsWith("gem/")) return { name: "gem", id: hash.slice(4) };
    if (hash.startsWith("favorite/")) return { name: "favorite", id: hash.slice(9) };
    return { name: "encyclopedia" };
  }

  function renderRoute() {
    if (!state.data) return;
    const route = currentRoute();

    if (route.name === "gem") {
      renderGemDetail(route.id);
      setActiveNav("encyclopedia");
      return;
    }

    if (route.name === "favorite") {
      renderFavoriteDetail(route.id);
      setActiveNav("favorites");
      return;
    }

    if (route.name === "field-kit") {
      renderFieldKit();
      setActiveNav("encyclopedia");
      return;
    }

    setActiveNav(route.name);
    if (route.name === "identify") renderIdentify();
    else if (route.name === "favorites") renderFavorites();
    else if (route.name === "settings") renderSettings();
    else renderEncyclopedia();
  }

  function setHeader(title, subtitle) {
    $("#page-title").textContent = title;
    $("#page-subtitle").textContent = subtitle;
  }

  function setActiveNav(route) {
    $$(".nav-item").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.route === route);
    });
  }

  function updateNetworkPill() {
    const pill = $("#network-pill");
    pill.textContent = state.isOnline ? "在线" : "离线";
    pill.classList.toggle("is-online", state.isOnline);
    pill.classList.toggle("is-offline", !state.isOnline);
  }

  function renderEncyclopedia() {
    setHeader("宝石百科", `${state.data.meta.total} 条本地资料，可离线浏览`);

    const categoryButtons = ["全部", ...state.data.topCategories.map((category) => category.name)]
      .map(
        (category) => `
          <button type="button" class="chip ${category === state.selectedCategory ? "is-active" : ""}" data-category="${escapeHtml(category)}">
            ${escapeHtml(category)}
          </button>
        `,
      )
      .join("");

    $("#app").innerHTML = `
      <section class="search-panel">
        <div class="field-entry">
          <div>
            <p class="section-label">后天现场用</p>
            <h2>东海 / 苏州看货模式</h2>
            <p class="help-text">先做功课，再看实物，再记录报价和风险。完全新手也按这张表走。</p>
          </div>
          <button type="button" class="button primary" id="open-field-kit">打开</button>
        </div>
        <div class="search-row">
          <input id="search-input" class="input" type="search" value="${escapeAttribute(state.query)}" placeholder="搜中文名、英文名、别名、真假要点" autocomplete="off" />
          <button type="button" class="button ghost" id="clear-search">清空</button>
        </div>
        <p class="section-label">按大类浏览</p>
        <div class="chip-row" id="category-row">${categoryButtons}</div>
        <p class="stats-line" id="category-count"></p>
      </section>
      <section class="gem-list" id="gem-list"></section>
    `;

    $("#search-input").addEventListener("input", (event) => {
      state.query = event.target.value;
      renderGemList();
    });

    $("#open-field-kit").addEventListener("click", () => {
      location.hash = "field-kit";
    });

    $("#clear-search").addEventListener("click", () => {
      state.query = "";
      $("#search-input").value = "";
      renderGemList();
    });

    $("#category-row").addEventListener("click", (event) => {
      const button = event.target.closest("[data-category]");
      if (!button) return;
      state.selectedCategory = button.dataset.category;
      $$(".chip", $("#category-row")).forEach((chip) => chip.classList.toggle("is-active", chip === button));
      renderGemList();
    });

    $("#gem-list").addEventListener("click", (event) => {
      const favoriteButton = event.target.closest("[data-favorite-gem]");
      if (favoriteButton) {
        addGemFavorite(favoriteButton.dataset.favoriteGem);
        renderGemList();
        return;
      }

      const card = event.target.closest("[data-gem-id]");
      if (card) location.hash = `gem/${card.dataset.gemId}`;
    });

    $("#gem-list").addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const card = event.target.closest("[data-gem-id]");
      if (card) location.hash = `gem/${card.dataset.gemId}`;
    });

    renderGemList();
  }

  function renderFieldKit() {
    setHeader("看货模式", "东海水晶 / 苏州彩宝玉石现场小抄");

    const quickSearches = [
      ["白水晶", "先看通透、棉裂、玻璃仿品"],
      ["紫水晶", "重点看色带、烤色黄晶风险"],
      ["黄水晶", "天然少，烤色和合成要谨慎"],
      ["粉水晶", "看颜色是否过艳、是否染色"],
      ["绿幽灵水晶", "看包裹体层次和注色风险"],
      ["金发晶", "看发丝立体感和玻璃内嵌金属丝"],
      ["碧玺", "看裂、注胶、颜色名是否夸大"],
      ["海蓝宝", "看颜色、净度、蓝托帕混淆"],
      ["托帕石", "看辐照改色、证书名称"],
      ["翡翠", "先问 A/B/C 货和证书"],
      ["和田玉籽料", "看皮色、毛孔、二上皮和滚筒料"],
      ["绿松石", "看注胶、染色、泡油处理"],
    ];

    const sourceStops = [
      {
        city: "东海",
        name: "中国东海水晶城",
        map: "江苏省东海县牛山街道中华北路1号",
        focus: "水晶原石、手串、雕件、摆件、直播/批发商户集中",
        tip: "适合第一站建立价格感；同品类至少看 5 家再记录最低/中位/最高报价。",
      },
      {
        city: "东海",
        name: "淘晶广场 / 水晶城周边摊位",
        map: "地图搜：中国东海水晶城 淘晶广场",
        focus: "小件、散珠、低价练眼力货",
        tip: "适合练手，不适合一上来买高价件；问清天然、染色、镀膜、合成。",
      },
      {
        city: "东海",
        name: "东海水晶博物馆",
        map: "地图搜：中国东海水晶博物馆",
        focus: "先补晶体形态、产地和工艺背景",
        tip: "不是主要买货点；看完再逛市场，能减少被术语绕晕。",
      },
      {
        city: "苏州",
        name: "相王路 / 十全街玉器集聚区",
        map: "地图搜：苏州相王路 十全街 玉器",
        focus: "和田玉、籽料、玉雕成品、工作室",
        tip: "重点记录白度、细度、油性、皮色、雕工、证书和是否二上皮。",
      },
      {
        city: "苏州",
        name: "相王玉器城",
        map: "十全街与相王路交汇处附近",
        focus: "玉器商户集中，适合集中比价",
        tip: "不懂时先看不买；高价件必须证书、复检和冷静期。",
      },
      {
        city: "苏州",
        name: "光福镇玉雕/工艺品集聚区",
        map: "地图搜：苏州光福镇 玉雕",
        focus: "玉雕加工、工艺摆件、工作室型货源",
        tip: "适合看工艺和加工，不要把雕工故事直接等同于材料价值。",
      },
    ];

    $("#app").innerHTML = `
      <section class="trip-hero">
        <h2>新手现场顺序</h2>
        <div class="route-focus">
          <p><strong>东海主线：</strong>水晶、发晶、幽灵、散珠、手串、低中价彩宝配件，先练眼力和价格感。</p>
          <p><strong>苏州主线：</strong>和田玉、籽料、玉雕、工作室工艺，重点看材料真假和雕工溢价。</p>
        </div>
        <ol class="step-list">
          <li><strong>先拍照</strong><span>整体、近景、侧面、证书/价签各一张。</span></li>
          <li><strong>再查百科</strong><span>重点看价格区间、真假辨别、优化处理。</span></li>
          <li><strong>问五句话</strong><span>天然吗、处理过吗、哪里产、有没有证书、这个价按什么算。</span></li>
          <li><strong>马上记录</strong><span>地点、报价、商家说法、自己判断和照片都留在收藏。</span></li>
          <li><strong>别急付款</strong><span>第一次看货以学习和比价为主，高价件先不冲动。</span></li>
        </ol>
      </section>

      <section class="control-panel">
        <h2>东海 / 苏州货源点</h2>
        <div class="source-list">
          ${sourceStops
            .map(
              (stop) => `
                <article class="source-card">
                  <div class="source-head">
                    <span class="tag">${escapeHtml(stop.city)}</span>
                    <h3>${escapeHtml(stop.name)}</h3>
                  </div>
                  <p><strong>地图搜：</strong>${escapeHtml(stop.map)}</p>
                  <p><strong>适合看：</strong>${escapeHtml(stop.focus)}</p>
                  <p><strong>新手动作：</strong>${escapeHtml(stop.tip)}</p>
                </article>
              `,
            )
            .join("")}
        </div>
        <p class="help-text">看货点根据公开资料和产业集散区整理；出发前用地图再核对营业状态。APP 只帮你记录和比价，不给任何单个商家背书。</p>
      </section>

      <section class="control-panel">
        <h2>现场必查品类</h2>
        <div class="quick-search-grid">
          ${quickSearches
            .map(
              ([name, note]) => `
                <button type="button" class="quick-search" data-kit-search="${escapeAttribute(name)}">
                  <strong>${escapeHtml(name)}</strong>
                  <span>${escapeHtml(note)}</span>
                </button>
              `,
            )
            .join("")}
        </div>
      </section>

      <section class="control-panel">
        <h2>一眼先避开的红线</h2>
        <ul class="danger-list">
          <li>商家只讲故事，不愿意写清材质、处理、价格。</li>
          <li>高价件没有证书，或证书机构/名称说不清。</li>
          <li>颜色过分统一鲜艳，却说纯天然无处理。</li>
          <li>“今天不买就没了”“捡漏”“大师开光”等强催单话术。</li>
          <li>籽料只看皮色不看肉质，或者毛孔、皮色明显不自然。</li>
          <li>翡翠不讲 A/B/C 货，绿松石不讲注胶染色，彩宝不讲加热/充填。</li>
        </ul>
      </section>

      <section class="favorite-editor">
        <h2>新建现场记录</h2>
        <form id="field-note-form" class="form-grid">
          <label class="field">
            <span>地点</span>
            <select id="field-place" class="select">
              <option value="东海">东海</option>
              <option value="苏州">苏州</option>
              <option value="其他">其他</option>
            </select>
          </label>
          <label class="field">
            <span>货源点 / 店铺</span>
            <input id="field-source" class="input" type="text" placeholder="例：中国东海水晶城 2 号馆 / 相王路某店 / 光福工作室" />
          </label>
          <label class="field">
            <span>品类 / 名称</span>
            <input id="field-item" class="input" type="text" placeholder="例：紫水晶手串 / 和田玉籽料 / 碧玺戒面" />
          </label>
          <label class="field">
            <span>商家报价</span>
            <input id="field-price" class="input" type="text" placeholder="例：800 元 / 1200 元一串 / 按克价" />
          </label>
          <label class="field">
            <span>商家说法</span>
            <textarea id="field-claim" class="textarea compact-textarea" placeholder="产地、天然/处理、证书、尺寸、重量、瑕疵、是否可退换"></textarea>
          </label>
          <label class="field">
            <span>我的判断</span>
            <textarea id="field-judgment" class="textarea compact-textarea" placeholder="先写最朴素的感受：好不好看、价格贵不贵、哪里不放心、要不要复看"></textarea>
          </label>
          <label class="field">
            <span>风险等级</span>
            <select id="field-risk" class="select">
              <option value="先不买">先不买</option>
              <option value="低风险，可小额试">低风险，可小额试</option>
              <option value="待复看">待复看</option>
              <option value="高风险">高风险</option>
            </select>
          </label>
          <label class="field">
            <span>现场照片</span>
            <input id="field-photos" class="input" type="file" accept="image/*" capture="environment" multiple />
            <p class="help-text">照片会压缩后保存在本机收藏；高价值样品原图另存在相册。</p>
          </label>
          <button type="submit" class="button success full">保存到收藏</button>
        </form>
      </section>
    `;

    $$(".quick-search").forEach((button) => {
      button.addEventListener("click", () => {
        state.query = button.dataset.kitSearch;
        state.selectedCategory = "全部";
        location.hash = "encyclopedia";
      });
    });

    $("#field-note-form").addEventListener("submit", saveFieldNoteFavorite);
  }

  function renderGemList() {
    const gems = filteredGems();
    $("#category-count").textContent = `${gems.length} 条结果`;

    if (gems.length === 0) {
      $("#gem-list").innerHTML = `<section class="empty-state">没有找到匹配条目。换一个中文名、英文名或真假辨别关键词试试。</section>`;
      return;
    }

    $("#gem-list").innerHTML = gems.map(renderGemCard).join("");
  }

  function filteredGems() {
    const query = state.query.trim().toLowerCase();
    return state.data.gems.filter((gem) => {
      const categoryMatch = state.selectedCategory === "全部" || gem.topCategory === state.selectedCategory;
      if (!categoryMatch) return false;
      if (!query) return true;

      const haystack = [
        gem.name,
        gem.englishName,
        gem.topCategory,
        gem.subCategory,
        gem.appearance,
        gem.quality,
        gem.origins,
        gem.price,
        gem.authenticity,
        gem.treatment,
        ...(gem.professional ? Object.values(gem.professional) : []),
        ...(gem.references || []).flatMap((reference) => [reference.title, reference.author, reference.type, reference.note]),
        ...(gem.aliases || []),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }

  function renderGemCard(gem) {
    const isSaved = favoriteExists(`gem:${gem.id}`);
    return `
      <article class="gem-card" data-gem-id="${escapeAttribute(gem.id)}" role="button" tabindex="0">
        <img class="gem-art" src="${imageSrc(gem.imageKey)}" alt="${escapeAttribute(gem.name)} 照片" loading="lazy" ${imageFallbackAttr()} />
        <div class="gem-card-body">
          <div class="gem-title-row">
            <div>
              <h2 class="gem-name">${escapeHtml(gem.name)}</h2>
              <p class="gem-english">${escapeHtml(gem.englishName)}</p>
            </div>
            <button type="button" class="mini-button ${isSaved ? "is-saved" : ""}" data-favorite-gem="${escapeAttribute(gem.id)}" aria-label="收藏 ${escapeAttribute(gem.name)}">
              ${isSaved ? "已存" : "收藏"}
            </button>
          </div>
          <div class="tag-row">
            <span class="tag">${escapeHtml(gem.topCategory)}</span>
            <span class="tag">${escapeHtml(gem.subCategory)}</span>
          </div>
          <p class="snippet">${escapeHtml(shortText(gem.authenticity, 54))}</p>
        </div>
      </article>
    `;
  }

  function renderGemDetail(id) {
    const gem = state.data.gems.find((item) => item.id === id);
    if (!gem) {
      setHeader("条目不存在", "数据库里没有这个宝石条目");
      $("#app").innerHTML = `<section class="notice danger">没有找到该条目。</section>`;
      return;
    }

    setHeader(gem.name, `${gem.englishName} · ${gem.topCategory}`);
    const sections = [
      ["外观特征", gem.appearance],
      ["品质判断方法", gem.quality],
      ["主要产地", gem.origins],
      ["用途与收藏价值", gem.uses],
      ["常见优化处理及识别", gem.treatment],
      ["风水能量属性说法", gem.fengshui],
    ];

    $("#app").innerHTML = `
      <section class="detail-hero">
        <img class="detail-art" src="${imageSrc(gem.imageKey)}" alt="${escapeAttribute(gem.name)} 照片" ${imageFallbackAttr()} />
        <div class="detail-heading">
          <div class="tag-row">
            <span class="tag">${escapeHtml(gem.topCategory)}</span>
            <span class="tag">${escapeHtml(gem.subCategory)}</span>
          </div>
          <h2>${escapeHtml(gem.name)}</h2>
          <p class="gem-english">${escapeHtml(gem.englishName)}</p>
          ${imageCreditHtml(gem.imageKey)}
          <div class="action-row">
            <button type="button" class="button primary" data-add-gem="${escapeAttribute(gem.id)}">${favoriteExists(`gem:${gem.id}`) ? "已在收藏" : "收藏条目"}</button>
            <button type="button" class="button ghost" data-back>返回</button>
          </div>
        </div>
      </section>

      <section class="quick-facts">
        <div class="fact-box">
          <strong>市场价格参考区间</strong>
          <p>${escapeHtml(gem.price)}</p>
        </div>
        <div class="fact-box">
          <strong>真假辨别要点</strong>
          <p>${escapeHtml(gem.authenticity)}</p>
        </div>
      </section>

      ${renderProfessionalPanel(gem)}

      <section class="control-panel">
        ${sections
          .map(
            ([title, content]) => `
              <article class="info-section">
                <h3>${escapeHtml(title)}</h3>
                <p>${escapeHtml(content)}</p>
              </article>
            `,
          )
          .join("")}
      </section>

      ${renderReferencesPanel(gem)}

      <p class="disclaimer">价格仅作市场参考，风水属性属于民俗说法；现场购买和高价值收藏应以专业鉴定证书为准。</p>
    `;

    $("[data-add-gem]").addEventListener("click", (event) => {
      addGemFavorite(event.target.dataset.addGem);
      renderGemDetail(id);
    });

    $("[data-back]").addEventListener("click", () => {
      if (history.length > 1) history.back();
      else location.hash = "encyclopedia";
    });
  }

  function renderProfessionalPanel(gem) {
    const professional = gem.professional;
    if (!professional) return "";

    const rows = [
      ["矿物种属", professional.mineralSpecies],
      ["化学成分", professional.composition],
      ["晶系/结构", professional.crystalSystem],
      ["莫氏硬度", professional.hardness],
      ["折射率", professional.refractiveIndex],
      ["相对密度", professional.specificGravity],
      ["光性", professional.opticalCharacter],
      ["荧光反应", professional.fluorescence],
    ].filter(([, value]) => Boolean(value));

    const notes = [
      ["常见包裹体", professional.inclusions],
      ["易混品", professional.lookalikes],
      ["现场简易测试", professional.simpleTests],
      ["送检建议", professional.labAdvice],
    ].filter(([, value]) => Boolean(value));

    return `
      <section class="control-panel professional-panel">
        <h2>专业参数</h2>
        <div class="parameter-grid">
          ${rows
            .map(
              ([label, value]) => `
                <div class="parameter-row">
                  <strong>${escapeHtml(label)}</strong>
                  <span>${escapeHtml(value)}</span>
                </div>
              `,
            )
            .join("")}
        </div>
        ${notes
          .map(
            ([label, value]) => `
              <article class="info-section compact">
                <h3>${escapeHtml(label)}</h3>
                <p>${escapeHtml(value)}</p>
              </article>
            `,
          )
          .join("")}
      </section>
    `;
  }

  function renderReferencesPanel(gem) {
    const references = gem.references || [];
    if (references.length === 0) return "";

    return `
      <section class="control-panel reference-panel">
        <h2>参考资料</h2>
        <ul class="reference-list">
          ${references
            .map(
              (reference) => `
                <li>
                  <strong>${escapeHtml(reference.title)}</strong>
                  <span>${escapeHtml([reference.author, reference.type].filter(Boolean).join(" · "))}</span>
                  <p>${escapeHtml(reference.note || "")}</p>
                </li>
              `,
            )
            .join("")}
        </ul>
      </section>
    `;
  }

  function renderIdentify() {
    setHeader("拍照识别", state.isOnline ? "联网调用你设置的大模型" : "当前离线，识别功能已隐藏");

    if (!state.isOnline) {
      $("#app").innerHTML = `
        <section class="notice">
          识别需要联网。现在仍可离线使用百科和收藏，网络恢复后这里会自动显示拍照入口。
        </section>
        ${renderHistorySection()}
      `;
      bindHistoryClicks();
      return;
    }

    const configured = Boolean(state.settings.apiKey && state.settings.baseUrl && state.settings.model);

    $("#app").innerHTML = `
      <section class="control-panel">
        ${configured ? "" : `<div class="notice danger">还没有填写模型配置。先到设置页保存 API Key、Base URL 和模型名。</div>`}
        <div class="upload-box">
          <label class="field">
            <span>拍照或上传矿石图片</span>
            <input id="identify-file" class="input" type="file" accept="image/*" capture="environment" />
          </label>
          ${
            state.selectedImage
              ? `<img class="preview-image" src="${state.selectedImage}" alt="待识别图片预览" />`
              : `<p class="help-text">建议在强光下拍清楚整体外形、颜色、断口、包裹体和光泽。单张图只能做初步判断。</p>`
          }
          <button type="button" id="run-identify" class="button primary full" ${state.identifying ? "disabled" : ""}>
            ${state.identifying ? "识别中..." : "开始识别"}
          </button>
        </div>
      </section>

      ${state.lastResult ? renderResultPanel(state.lastResult, true) : ""}
      ${renderHistorySection()}
    `;

    $("#identify-file").addEventListener("change", handleIdentifyImage);
    $("#run-identify").addEventListener("click", runIdentification);
    bindHistoryClicks();
  }

  async function handleIdentifyImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      state.selectedImage = await compressImageFile(file, 1400, 0.82);
      renderIdentify();
    } catch (error) {
      showToast(error.message || "图片读取失败");
    }
  }

  async function runIdentification() {
    if (!state.selectedImage) {
      showToast("先拍照或上传一张图片");
      return;
    }

    if (!state.settings.apiKey || !state.settings.baseUrl || !state.settings.model) {
      showToast("请先到设置页保存模型配置");
      location.hash = "settings";
      return;
    }

    state.identifying = true;
    renderIdentify();

    try {
      const result = await callModelIdentification(state.selectedImage);
      const record = {
        id: `identify-${Date.now()}`,
        createdAt: new Date().toISOString(),
        imageData: state.selectedImage,
        ...result,
      };
      state.lastResult = record;
      saveIdentificationRecord(record);
      showToast("识别完成");
    } catch (error) {
      showToast(error.message || "识别失败");
    } finally {
      state.identifying = false;
      renderIdentify();
    }
  }

  async function callModelIdentification(imageDataUrl) {
    const endpoint = normalizeEndpoint(state.settings.baseUrl);
    const prompt = [
      "请根据图片做宝石、矿石或玉石的初步现场识别。",
      "只能基于可见外观给概率判断，不要假装做到了实验室鉴定。",
      "请返回严格 JSON，不要 Markdown，不要额外解释。",
      "字段必须包含：mineralName, appearanceAnalysis, qualityJudgment, originGuess, marketPrice, confidence, warnings。",
      "marketPrice 用人民币区间表达；warnings 写真假风险、证书建议或图片不足之处。",
    ].join("\n");

    let response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${state.settings.apiKey}`,
        },
        body: JSON.stringify({
          model: state.settings.model,
          temperature: 0.2,
          max_tokens: 900,
          messages: [
            {
              role: "system",
              content: "你是谨慎的中文宝石与矿物现场识别助手，重点提醒不确定性和鉴定风险。",
            },
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: imageDataUrl } },
              ],
            },
          ],
        }),
      });
    } catch (error) {
      throw new Error("请求失败：可能是网络、CORS，或这个 Base URL 不支持浏览器直连。");
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`识别接口返回 ${response.status}：${shortText(errorText || response.statusText, 120)}`);
    }

    const payload = await response.json();
    let content = payload.choices?.[0]?.message?.content || payload.output_text || "";
    if (Array.isArray(content)) {
      content = content.map((part) => part.text || part.content || "").join("\n");
    }

    const parsed = parseModelJson(content);
    return normalizeIdentificationResult(parsed);
  }

  function normalizeEndpoint(baseUrl) {
    const trimmed = baseUrl.trim().replace(/\/+$/, "");
    if (trimmed.endsWith("/chat/completions")) return trimmed;
    if (trimmed.endsWith("/v1")) return `${trimmed}/chat/completions`;
    return `${trimmed}/v1/chat/completions`;
  }

  function parseModelJson(content) {
    if (!content) throw new Error("模型没有返回可解析内容。");
    try {
      return JSON.parse(content);
    } catch (error) {
      const match = content.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("模型返回不是 JSON。请换一个支持视觉和 JSON 输出的模型。");
      return JSON.parse(match[0]);
    }
  }

  function normalizeIdentificationResult(result) {
    return {
      mineralName: result.mineralName || result.name || result["矿石名称"] || result["宝石名称"] || "未知矿石",
      appearanceAnalysis: result.appearanceAnalysis || result.appearance || result["外观特征分析"] || "未返回",
      qualityJudgment: result.qualityJudgment || result.quality || result["品质初步判断"] || "未返回",
      originGuess: result.originGuess || result.origin || result["产地推测"] || "未返回",
      marketPrice: result.marketPrice || result.price || result["市场价格参考"] || "未返回",
      confidence: result.confidence || result["置信度"] || "中",
      warnings: result.warnings || result.warning || result["风险提示"] || "图片识别只作初筛，建议结合证书和实物检测。",
    };
  }

  function renderResultPanel(result, includeSaveButton) {
    return `
      <section class="result-panel">
        <h2>${escapeHtml(result.mineralName)}</h2>
        ${result.imageData ? `<img class="result-image" src="${result.imageData}" alt="识别图片" />` : ""}
        <div class="result-grid">
          ${renderResultItem("外观特征分析", result.appearanceAnalysis)}
          ${renderResultItem("品质初步判断", result.qualityJudgment)}
          ${renderResultItem("产地推测", result.originGuess)}
          ${renderResultItem("市场价格参考", result.marketPrice)}
          ${renderResultItem("置信度", result.confidence)}
          ${renderResultItem("风险提示", result.warnings)}
        </div>
        ${
          includeSaveButton
            ? `<div class="action-row"><button type="button" class="button success" data-save-identification="${escapeAttribute(result.id)}">保存到收藏</button></div>`
            : ""
        }
      </section>
    `;
  }

  function renderResultItem(label, value) {
    return `
      <article class="result-item">
        <strong>${escapeHtml(label)}</strong>
        <p>${escapeHtml(value || "未返回")}</p>
      </article>
    `;
  }

  function renderHistorySection() {
    const history = loadHistory();
    if (history.length === 0) return "";

    return `
      <section class="control-panel">
        <h2>最近识别</h2>
        <div class="history-list">
          ${history
            .slice(0, 5)
            .map(
              (item) => `
                <article class="history-card" data-history-id="${escapeAttribute(item.id)}" role="button" tabindex="0">
                  <img class="thumb" src="${item.imageData}" alt="识别历史图片" />
                  <div>
                    <h3 class="favorite-title">${escapeHtml(item.mineralName)}</h3>
                    <p class="favorite-subtitle">${formatTime(item.createdAt)}</p>
                    <p class="snippet">${escapeHtml(shortText(item.warnings || item.appearanceAnalysis, 70))}</p>
                  </div>
                </article>
              `,
            )
            .join("")}
        </div>
      </section>
    `;
  }

  function bindHistoryClicks() {
    $$(".history-card").forEach((card) => {
      card.addEventListener("click", () => {
        const record = loadHistory().find((item) => item.id === card.dataset.historyId);
        if (!record) return;
        state.lastResult = record;
        state.selectedImage = record.imageData;
        renderIdentify();
      });
    });

    $$("[data-save-identification]").forEach((button) => {
      button.addEventListener("click", () => {
        const record = loadHistory().find((item) => item.id === button.dataset.saveIdentification) || state.lastResult;
        if (record) saveIdentificationFavorite(record);
      });
    });
  }

  function renderFavorites() {
    const favorites = loadFavorites();
    setHeader("我的收藏", favorites.length ? `${favorites.length} 条本地收藏` : "离线保存条目、识别结果和备注");

    $("#app").innerHTML = `
      ${storageMeterHtml()}
      ${
        favorites.length
          ? `<section class="favorite-list">${favorites.map(renderFavoriteCard).join("")}</section>`
          : `<section class="empty-state">还没有收藏。可以从百科详情收藏宝石，也可以把识别结果保存进来。</section>`
      }
    `;

    $$(".favorite-card").forEach((card) => {
      card.addEventListener("click", (event) => {
        if (event.target.closest("[data-delete-favorite]")) return;
        location.hash = `favorite/${card.dataset.favoriteId}`;
      });
    });

    $$("[data-delete-favorite]").forEach((button) => {
      button.addEventListener("click", () => deleteFavorite(button.dataset.deleteFavorite));
    });
  }

  function renderFavoriteCard(favorite) {
    const thumb = favoriteThumbSrc(favorite);
    const typeLabel = favoriteTypeLabel(favorite);
    return `
      <article class="favorite-card" data-favorite-id="${escapeAttribute(favorite.id)}" role="button" tabindex="0">
        <img class="thumb" src="${thumb}" alt="${escapeAttribute(favorite.title)} 缩略图" ${imageFallbackAttr()} />
        <div class="favorite-card-body">
          <div class="gem-title-row">
            <div>
              <h2 class="favorite-title">${escapeHtml(favorite.title)}</h2>
              <p class="favorite-subtitle">${escapeHtml(favorite.subtitle || typeLabel)}</p>
            </div>
            <button type="button" class="mini-button danger" data-delete-favorite="${escapeAttribute(favorite.id)}">删除</button>
          </div>
          <div class="tag-row">
            <span class="tag">${typeLabel}</span>
            <span class="tag">${formatTime(favorite.updatedAt || favorite.createdAt)}</span>
          </div>
          <p class="snippet">${escapeHtml(favorite.note ? shortText(favorite.note, 78) : "可添加备注和现场照片")}</p>
        </div>
      </article>
    `;
  }

  function renderFavoriteDetail(id) {
    const favorite = loadFavorites().find((item) => item.id === id);
    if (!favorite) {
      setHeader("收藏不存在", "这条收藏可能已经被删除");
      $("#app").innerHTML = `<section class="notice danger">没有找到该收藏。</section>`;
      return;
    }

    setHeader(favorite.title, `${favoriteTypeLabel(favorite)}收藏`);
    const thumb = favoriteThumbSrc(favorite);
    const gem = currentGemForFavorite(favorite);

    $("#app").innerHTML = `
      <section class="favorite-editor">
        <img class="detail-art" src="${thumb}" alt="${escapeAttribute(favorite.title)} 图片" ${imageFallbackAttr()} />
        <h2>${escapeHtml(favorite.title)}</h2>
        <p class="favorite-subtitle">${escapeHtml(favorite.subtitle || "")}</p>
        ${gem ? imageCreditHtml(gem.imageKey) : ""}
        <label class="field">
          <span>我的备注</span>
          <textarea id="favorite-note" class="textarea" placeholder="记录购买地点、价格、实物手感、证书编号或后续判断">${escapeHtml(favorite.note || "")}</textarea>
        </label>
        <label class="field">
          <span>添加现场照片</span>
          <input id="favorite-photo" class="input" type="file" accept="image/*" capture="environment" multiple />
        </label>
        ${renderPhotoGrid(favorite)}
        <div class="action-row">
          <button type="button" class="button primary" data-save-favorite="${escapeAttribute(favorite.id)}">保存编辑</button>
          <button type="button" class="button danger" data-delete-current="${escapeAttribute(favorite.id)}">删除收藏</button>
          <button type="button" class="button ghost" data-back-favorites>返回收藏</button>
        </div>
      </section>
      ${favorite.type === "identification" ? renderResultPanel(favorite.data, false) : ""}
      ${favorite.type === "field-note" ? renderFieldNoteReference(favorite) : ""}
      ${favorite.type === "gem" ? renderGemReference(favorite) : ""}
    `;

    $("#favorite-photo").addEventListener("change", (event) => addFavoritePhotos(favorite.id, event.target.files));
    $("[data-save-favorite]").addEventListener("click", () => saveFavoriteNote(favorite.id));
    $("[data-delete-current]").addEventListener("click", () => deleteFavorite(favorite.id, "favorites"));
    $("[data-back-favorites]").addEventListener("click", () => {
      location.hash = "favorites";
    });

    $$("[data-remove-photo]").forEach((button) => {
      button.addEventListener("click", () => removeFavoritePhoto(favorite.id, Number(button.dataset.removePhoto)));
    });
  }

  function renderGemReference(favorite) {
    const gem = currentGemForFavorite(favorite);
    if (!gem) return "";
    return `
      <section class="control-panel">
        <h2>条目参考</h2>
        <article class="info-section">
          <h3>价格参考</h3>
          <p>${escapeHtml(gem.price)}</p>
        </article>
        <article class="info-section">
          <h3>真假辨别</h3>
          <p>${escapeHtml(gem.authenticity)}</p>
        </article>
      </section>
      ${renderProfessionalPanel(gem)}
      ${renderReferencesPanel(gem)}
    `;
  }

  function renderFieldNoteReference(favorite) {
    const data = favorite.data || {};
    return `
      <section class="control-panel">
        <h2>现场记录</h2>
        <div class="result-grid">
          ${renderResultItem("地点", data.place)}
          ${renderResultItem("货源点 / 店铺", data.source)}
          ${renderResultItem("商家报价", data.price)}
          ${renderResultItem("风险等级", data.risk)}
          ${renderResultItem("商家说法", data.claim)}
          ${renderResultItem("我的判断", data.judgment)}
        </div>
      </section>
    `;
  }

  function renderPhotoGrid(favorite) {
    if (!favorite.photos || favorite.photos.length === 0) {
      return `<p class="help-text">照片会压缩后保存在本机 localStorage，适合少量现场记录。</p>`;
    }

    return `
      <div class="photo-grid">
        ${favorite.photos
          .map(
            (photo, index) => `
              <div class="photo-item">
                <img src="${photo}" alt="收藏照片 ${index + 1}" />
                <button type="button" class="mini-button danger" data-remove-photo="${index}">移除</button>
              </div>
            `,
          )
          .join("")}
      </div>
    `;
  }

  function renderSettings() {
    state.settings = loadSettings();
    setHeader("设置", "模型配置只保存在本机浏览器");

    $("#app").innerHTML = `
      <section class="settings-panel">
        <form id="settings-form" class="form-grid">
          <label class="field">
            <span>API Key</span>
            <input class="input" id="api-key" type="password" value="${escapeAttribute(state.settings.apiKey)}" placeholder="sk-..." autocomplete="off" />
          </label>
          <label class="field">
            <span>Base URL</span>
            <input class="input" id="base-url" type="url" value="${escapeAttribute(state.settings.baseUrl)}" placeholder="https://openrouter.ai/api/v1" />
            <p class="help-text">兼容 OpenAI 风格接口。示例：OpenRouter 用 https://openrouter.ai/api/v1，OpenAI 官方用 https://api.openai.com/v1。</p>
          </label>
          <label class="field">
            <span>模型名</span>
            <input class="input" id="model-name" type="text" value="${escapeAttribute(state.settings.model)}" placeholder="openai/gpt-4.1-mini" />
          </label>
          <label class="toggle-field">
            <input id="outdoor-mode" type="checkbox" ${state.settings.outdoorMode ? "checked" : ""} />
            <span>户外强光模式</span>
          </label>
          <button type="submit" class="button primary full">保存设置</button>
        </form>
      </section>

      <section class="settings-panel">
        <h2>本地存储</h2>
        ${storageMeterHtml()}
        <p class="disclaimer">API Key、收藏、备注和照片都只保存在这台设备的浏览器 localStorage。个人自用可以，公用设备不要保存 Key。</p>
        <div class="action-row">
          <button type="button" class="button ghost" id="clear-key">清空 API Key</button>
        </div>
      </section>

      <section class="notice">
        PWA 离线缓存需要通过 localhost 或 HTTPS 访问。直接打开 file:// 可以预览页面，但不能完整安装和缓存。
      </section>
    `;

    $("#settings-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const next = {
        apiKey: $("#api-key").value.trim(),
        baseUrl: $("#base-url").value.trim() || DEFAULT_SETTINGS.baseUrl,
        model: $("#model-name").value.trim() || DEFAULT_SETTINGS.model,
        outdoorMode: $("#outdoor-mode").checked,
      };
      saveSettings(next);
      state.settings = next;
      applyOutdoorMode();
      showToast("设置已保存");
      renderSettings();
    });

    $("#clear-key").addEventListener("click", () => {
      const next = { ...loadSettings(), apiKey: "" };
      saveSettings(next);
      state.settings = next;
      showToast("API Key 已清空");
      renderSettings();
    });
  }

  async function saveFieldNoteFavorite(event) {
    event.preventDefault();

    const place = $("#field-place").value;
    const source = $("#field-source").value.trim();
    const item = $("#field-item").value.trim();
    const price = $("#field-price").value.trim();
    const claim = $("#field-claim").value.trim();
    const judgment = $("#field-judgment").value.trim();
    const risk = $("#field-risk").value;
    const files = [...($("#field-photos").files || [])];

    if (!item) {
      showToast("先写品类或名称");
      $("#field-item").focus();
      return;
    }

    const photos = [];
    try {
      for (const file of files) {
        photos.push(await compressImageFile(file, 1100, 0.76));
      }
    } catch (error) {
      showToast(error.message || "照片保存失败");
      return;
    }

    const createdAt = new Date().toISOString();
    const data = { place, source, item, price, claim, judgment, risk };
    const note = [
      `地点：${place}`,
      source ? `货源点/店铺：${source}` : "",
      price ? `报价：${price}` : "",
      `风险等级：${risk}`,
      claim ? `商家说法：${claim}` : "",
      judgment ? `我的判断：${judgment}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const favorites = loadFavorites();
    const favorite = {
      id: `field-note:${Date.now()}`,
      type: "field-note",
      sourceId: "",
      title: item,
      subtitle: `${place}现场记录 · ${risk}`,
      imageKey: place === "苏州" ? "jade" : "crystal",
      data,
      note,
      photos,
      createdAt,
      updatedAt: createdAt,
    };

    favorites.unshift(favorite);
    saveFavorites(favorites);
    showToast("现场记录已保存");
    location.hash = `favorite/${favorite.id}`;
  }

  function addGemFavorite(id) {
    const gem = state.data.gems.find((item) => item.id === id);
    if (!gem) return;

    const favoriteId = `gem:${gem.id}`;
    const favorites = loadFavorites();
    if (favorites.some((item) => item.id === favoriteId)) {
      showToast("已经在收藏里");
      return;
    }

    favorites.unshift({
      id: favoriteId,
      type: "gem",
      sourceId: gem.id,
      title: gem.name,
      subtitle: `${gem.englishName} · ${gem.topCategory}`,
      imageKey: gem.imageKey,
      data: gem,
      note: "",
      photos: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    saveFavorites(favorites);
    showToast("已保存到收藏");
  }

  function saveIdentificationFavorite(record) {
    const favoriteId = `identification:${record.id}`;
    const favorites = loadFavorites();
    if (favorites.some((item) => item.id === favoriteId)) {
      showToast("这条识别结果已经收藏过");
      return;
    }

    favorites.unshift({
      id: favoriteId,
      type: "identification",
      sourceId: record.id,
      title: record.mineralName || "识别结果",
      subtitle: `识别于 ${formatTime(record.createdAt)}`,
      imageData: record.imageData,
      data: record,
      note: "",
      photos: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    saveFavorites(favorites);
    showToast("识别结果已保存到收藏");
  }

  function saveFavoriteNote(id) {
    const favorites = loadFavorites();
    const favorite = favorites.find((item) => item.id === id);
    if (!favorite) return;
    favorite.note = $("#favorite-note").value.trim();
    favorite.updatedAt = new Date().toISOString();
    saveFavorites(favorites);
    showToast("收藏已更新");
    renderFavoriteDetail(id);
  }

  async function addFavoritePhotos(id, fileList) {
    const files = [...(fileList || [])];
    if (files.length === 0) return;

    const favorites = loadFavorites();
    const favorite = favorites.find((item) => item.id === id);
    if (!favorite) return;

    const noteField = $("#favorite-note");
    favorite.note = noteField ? noteField.value.trim() : favorite.note;
    favorite.photos = favorite.photos || [];

    try {
      for (const file of files) {
        favorite.photos.push(await compressImageFile(file, 1100, 0.76));
      }
      favorite.updatedAt = new Date().toISOString();
      saveFavorites(favorites);
      showToast("照片已保存");
      renderFavoriteDetail(id);
    } catch (error) {
      showToast(error.message || "照片保存失败");
    }
  }

  function removeFavoritePhoto(id, index) {
    const favorites = loadFavorites();
    const favorite = favorites.find((item) => item.id === id);
    if (!favorite || !favorite.photos) return;
    favorite.photos.splice(index, 1);
    favorite.updatedAt = new Date().toISOString();
    saveFavorites(favorites);
    showToast("照片已移除");
    renderFavoriteDetail(id);
  }

  function deleteFavorite(id, afterRoute) {
    if (!confirm("确认删除这条收藏？")) return;
    saveFavorites(loadFavorites().filter((item) => item.id !== id));
    showToast("收藏已删除");
    location.hash = afterRoute || "favorites";
    if (!afterRoute && currentRoute().name === "favorites") renderFavorites();
  }

  function favoriteExists(id) {
    return loadFavorites().some((item) => item.id === id);
  }

  function loadFavorites() {
    return safeJson(STORAGE.favorites, []);
  }

  function saveFavorites(favorites) {
    localStorage.setItem(STORAGE.favorites, JSON.stringify(favorites));
  }

  function loadHistory() {
    return safeJson(STORAGE.identifications, []);
  }

  function saveIdentificationRecord(record) {
    const history = loadHistory().filter((item) => item.id !== record.id);
    history.unshift(record);
    localStorage.setItem(STORAGE.identifications, JSON.stringify(history.slice(0, 20)));
  }

  function loadSettings() {
    return { ...DEFAULT_SETTINGS, ...safeJson(STORAGE.settings, {}) };
  }

  function saveSettings(settings) {
    localStorage.setItem(STORAGE.settings, JSON.stringify(settings));
  }

  function safeJson(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      console.warn(`Failed to parse ${key}`, error);
      return fallback;
    }
  }

  function storageMeterHtml() {
    const usage = calculateLocalStorageUsage();
    const limit = 5 * 1024 * 1024;
    const percent = Math.min(100, Math.round((usage / limit) * 100));
    return `
      <div class="storage-meter">
        <strong>localStorage 估算占用：${formatBytes(usage)} / 约 ${formatBytes(limit)}</strong>
        <div class="meter-bar"><div class="meter-fill" style="width:${percent}%"></div></div>
        <p class="help-text">照片会明显增加占用。高价值样品建议另存原图和证书。</p>
      </div>
    `;
  }

  function calculateLocalStorageUsage() {
    return Object.values(STORAGE).reduce((total, key) => total + (localStorage.getItem(key) || "").length * 2, 0);
  }

  function applyOutdoorMode() {
    document.body.classList.toggle("soft-mode", !state.settings.outdoorMode);
  }

  function imageSrc(imageKey) {
    const credit = imageCredit(imageKey);
    if (credit?.path) return credit.path;
    return IMAGE_MAP[imageKey] || IMAGE_MAP.crystal;
  }

  function imageCredit(imageKey) {
    return state.imageCredits?.images?.[imageKey] || null;
  }

  function imageCreditHtml(imageKey) {
    const credit = imageCredit(imageKey);
    if (!credit?.pageUrl) return "";
    const artist = credit.artist ? ` · ${shortText(credit.artist, 48)}` : "";
    return `
      <p class="image-credit">
        图片：<a href="${escapeAttribute(credit.pageUrl)}" target="_blank" rel="noreferrer">${escapeHtml(shortText(credit.title || credit.label, 34))}</a>
        · ${escapeHtml(credit.license || "Wikimedia Commons")}${escapeHtml(artist)}
      </p>
    `;
  }

  function favoriteTypeLabel(favorite) {
    if (favorite.type === "identification") return "识别结果";
    if (favorite.type === "field-note") return "现场记录";
    return "百科条目";
  }

  function favoriteThumbSrc(favorite) {
    if (favorite.photos?.[0]) return favorite.photos[0];
    if (favorite.imageData) return favorite.imageData;
    return favoriteGemImageSrc(favorite);
  }

  function favoriteGemImageSrc(favorite) {
    const gem = currentGemForFavorite(favorite);
    return imageSrc(gem?.imageKey || favorite.imageKey || "crystal");
  }

  function currentGemForFavorite(favorite) {
    if (favorite.type !== "gem") return null;
    return state.data?.gems?.find((gem) => gem.id === favorite.sourceId) || favorite.data || null;
  }

  function imageFallbackAttr() {
    return `onerror="this.onerror=null;this.src='assets/crystal.svg'"`;
  }

  function compressImageFile(file, maxSize, quality) {
    if (!file.type.startsWith("image/")) {
      return Promise.reject(new Error("请选择图片文件"));
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("图片读取失败"));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error("图片解析失败"));
        image.onload = () => {
          const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
          const width = Math.max(1, Math.round(image.width * scale));
          const height = Math.max(1, Math.round(image.height * scale));
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext("2d");
          context.drawImage(image, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("is-visible"), 2600);
  }

  function shortText(text, maxLength) {
    if (!text) return "";
    const normalized = String(text).replace(/\s+/g, " ").trim();
    return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
  }

  function formatTime(isoString) {
    if (!isoString) return "未知时间";
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return "未知时间";
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value);
  }
})();
