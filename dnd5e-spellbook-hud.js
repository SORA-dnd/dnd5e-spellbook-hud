// ================================================= //
//         DnD5E Spellbook HUD by Gemini AI          //
// (Version 20.3 - The Quality of Life Update)     //
// ================================================= //

const MODULE_ID = 'dnd5e-spellbook-hud';

class SpellbookHUD extends Application {

  static {
    // ** 模板更新：支持过渡页自定义背景图 **
    const templateHTML = `
      <div class="spellbook-container">
        <div class="drag-handle"></div>
        <a class="home-button" style="display: {{#if showHomeButton}}block{{else}}none{{/if}};"><i class="fas fa-home"></i></a>
        <div class="book-page left-page">
          <div class="page-content">
            {{#if page.isTransition}}
              {{#with page.left}}<div class="transition-page" {{#if this.image}}style="background-image: url('{{this.image}}');"{{/if}}><h1>{{this.title}}</h1></div>{{/with}}
            {{else if page.isToc}}
              {{#with page.left}}<h3>{{this.title}}</h3><ul class="toc-list">{{#each items}}{{{this.html}}}{{/each}}</ul>{{/with}}
            {{else}}
              {{#with page.left}}<h4 class="spell-title">{{#if this.img}}<img src="{{this.img}}" class="spell-icon-title" alt="{{this.name}} icon">{{/if}}{{this.name}} ({{this.levelName}}){{#if this.isPrepared}}<i class="fas fa-magic use-spell-icon" data-spell-name="{{this.name}}" title="使用法术"></i>{{/if}}</h4><div class="spell-description">{{{this.description}}}</div>{{/with}}
            {{/if}}
          </div>
          <a class="prev-page" style="display: {{#if hasPrevPage}}block{{else}}none{{/if}};"><i class="fas fa-chevron-left"></i></a>
        </div>
        <div class="book-page right-page">
           <div class="page-content">
            {{#if page.isTransition}}
              {{#with page.right}}<div class="transition-page" {{#if this.image}}style="background-image: url('{{this.image}}');"{{/if}}><h1>{{this.title}}</h1></div>{{/with}}
            {{else if page.isToc}}
              {{#with page.right}}<h3>{{this.title}}</h3><ul class="toc-list">{{#each items}}{{{this.html}}}{{/each}}</ul>{{/with}}
            {{else}}
              {{#with page.right}}<h4 class="spell-title">{{#if this.img}}<img src="{{this.img}}" class="spell-icon-title" alt="{{this.name}} icon">{{/if}}{{this.name}} ({{this.levelName}}){{#if this.isPrepared}}<i class="fas fa-magic use-spell-icon" data-spell-name="{{this.name}}" title="使用法术"></i>{{/if}}</h4><div class="spell-description">{{{this.description}}}</div>{{/with}}
            {{/if}}
           </div>
           <a class="next-page" style="display: {{#if hasNextPage}}block{{else}}none{{/if}};"><i class="fas fa-chevron-right"></i></a>
        </div>
      </div>
    `;
    this._compiledTemplate = Handlebars.compile(templateHTML);
    this._leftPageTemplate = Handlebars.compile(`
      {{#if page.isTransition}}
        {{#with page.left}}<div class="transition-page" {{#if this.image}}style="background-image: url('{{this.image}}');"{{/if}}><h1>{{this.title}}</h1></div>{{/with}}
      {{else if page.isToc}}
        {{#with page.left}}<h3>{{this.title}}</h3><ul class="toc-list">{{#each items}}{{{this.html}}}{{/each}}</ul>{{/with}}
      {{else}}
        {{#with page.left}}<h4 class="spell-title">{{#if this.img}}<img src="{{this.img}}" class="spell-icon-title" alt="{{this.name}} icon">{{/if}}{{this.name}} ({{this.levelName}}){{#if this.isPrepared}}<i class="fas fa-magic use-spell-icon" data-spell-name="{{this.name}}" title="使用法术"></i>{{/if}}</h4><div class="spell-description">{{{this.description}}}</div>{{/with}}
      {{/if}}
    `);
    this._rightPageTemplate = Handlebars.compile(`
      {{#if page.isTransition}}
        {{#with page.right}}<div class="transition-page" {{#if this.image}}style="background-image: url('{{this.image}}');"{{/if}}><h1>{{this.title}}</h1></div>{{/with}}
      {{else if page.isToc}}
        {{#with page.right}}<h3>{{this.title}}</h3><ul class="toc-list">{{#each items}}{{{this.html}}}{{/each}}</ul>{{/with}}
      {{else}}
        {{#with page.right}}<h4 class="spell-title">{{#if this.img}}<img src="{{this.img}}" class="spell-icon-title" alt="{{this.name}} icon">{{/if}}{{this.name}} ({{this.levelName}}){{#if this.isPrepared}}<i class="fas fa-magic use-spell-icon" data-spell-name="{{this.name}}" title="使用法术"></i>{{/if}}</h4><div class="spell-description">{{{this.description}}}</div>{{/with}}
      {{/if}}
    `);
  }

  constructor(actor, options = {}) {
    super(options);
    this.actor = actor;
    this.pages = [];
    this.currentPageIndex = 0;
    this.spellPageMap = new Map();
    this._isScrolling = false; // ** 新增：用于滚轮翻页节流 **
    this._dataReady = this._preparePageData();
  }

  static get defaultOptions() {
    return { ...super.defaultOptions, id: "spellbook-hud", classes: ["dnd5e", "spellbook-hud"], width: game.settings.get(MODULE_ID, 'windowWidth') || 800, height: game.settings.get(MODULE_ID, 'windowHeight') || 600, resizable: false, title: "法术书" };
  }
  
  async _renderInner(data) {
    return SpellbookHUD._compiledTemplate(data);
  }
  
  // ** 功能优化：重写目录分页逻辑，避免标题截断 **
  async _paginateDirectory(spells, title, isPreparedList) {
    const TOC_ITEMS_PER_PANE = 12; let directoryPages = [];
    const showIcons = game.settings.get(MODULE_ID, 'showSpellIcons');
    const spellsByLevel = spells.reduce((acc, spell) => {
      const level = spell.system.level;
      if (!acc[level]) { acc[level] = { levelName: `${level}环法术`, spells: [] }; }
      acc[level].spells.push({ name: spell.name, id: spell.id, img: spell.img });
      return acc;
    }, {});
    let tocEntries = [];
    Object.values(spellsByLevel).forEach(group => {
      tocEntries.push({ html: `<li class="toc-level-header">${group.levelName}</li>`, cost: 2 });
      group.spells.forEach(spell => {
        let cssClass = isPreparedList ? 'toc-spell-name prepared-spell-entry' : 'toc-spell-name';
        const iconHtml = showIcons ? `<img src="${spell.img}" class="spell-icon-toc">` : '';
        const spellHtml = `<li class="${cssClass}" data-spell-id="${spell.id}" data-spell-name="${spell.name}">${iconHtml}${spell.name}</li>`;
        tocEntries.push({ html: spellHtml, cost: 1 });
      });
    });
    if (tocEntries.length === 0) return [];
    
    let paginatedPanes = [], currentPaneItems = [], currentPaneWeight = 0;
    for (const entry of tocEntries) {
      // ** 核心修复逻辑 **
      // 如果当前项是标题(cost=2)，并且加入它之后，剩余空间不足以再放下一个条目(cost=1)，
      // 那么就在加入这个标题前强制分页，以避免标题被单独留在页面底部。
      const isHeader = entry.cost === 2;
      if (isHeader && (currentPaneWeight + entry.cost >= TOC_ITEMS_PER_PANE) && currentPaneItems.length > 0) {
        paginatedPanes.push(currentPaneItems);
        currentPaneItems = [];
        currentPaneWeight = 0;
      }
      // 原有逻辑：如果加上当前条目会超重，则分页
      else if ((currentPaneWeight + entry.cost > TOC_ITEMS_PER_PANE) && (currentPaneItems.length > 0)) {
        paginatedPanes.push(currentPaneItems);
        currentPaneItems = [];
        currentPaneWeight = 0;
      }

      currentPaneItems.push(entry);
      currentPaneWeight += entry.cost;
    }
    if (currentPaneItems.length > 0) { paginatedPanes.push(currentPaneItems); }

    for (let i = 0; i < paginatedPanes.length; i += 2) {
      directoryPages.push({ isToc: true, left: { items: paginatedPanes[i], title: (i === 0) ? title : "" }, right: { items: paginatedPanes[i+1] || [], title: "" } });
    }
    return directoryPages;
  }

  async _preparePageData() {
    this.pages = [];
    this.spellPageMap.clear();

    const allSpells = this.actor.items
      .filter(item => item.type === 'spell' && item.system.level > 0)
      .sort((a, b) => a.system.level - b.system.level || a.name.localeCompare(b.name));
      
    const preparedSpells = allSpells.filter(spell => spell.system.preparation?.prepared === true);
    const preparedSpellIds = new Set(preparedSpells.map(s => s.id));
    const showIcons = game.settings.get(MODULE_ID, 'showSpellIcons');

    this.pages.push(...(await this._paginateDirectory(preparedSpells, "已准备法术", true)));
    this.pages.push(...(await this._paginateDirectory(allSpells, "法术总览", false)));

    if (allSpells.length > 0) {
        let currentLevel = -1;
        let pageBuffer = [];
        let nextPageIndex = this.pages.length;

        for (const spell of allSpells) {
            if (spell.system.level > currentLevel) {
                currentLevel = spell.system.level;
                if (pageBuffer.length > 0) {
                    this.pages.push({ isToc: false, left: pageBuffer[0], right: null });
                    pageBuffer = [];
                    nextPageIndex++;
                }
                
                // ** 新功能：从设置中读取自定义过渡页信息 **
                const customText = game.settings.get(MODULE_ID, `transitionText${currentLevel}`) || `${currentLevel}环法术`;
                const customImage = game.settings.get(MODULE_ID, `transitionImage${currentLevel}`) || "";
                this.pages.push({ isTransition: true, left: null, right: { title: customText, image: customImage } });
                nextPageIndex++;
            }

            const description = await TextEditor.enrichHTML(spell.system.description.value, { async: true, rollData: this.actor.getRollData() });
            
            const spellPane = {
                name: spell.name,
                levelName: `${spell.system.level}环`,
                description: description,
                isPrepared: preparedSpellIds.has(spell.id),
                img: showIcons ? spell.img : null
            };
            
            this.spellPageMap.set(spell.id, nextPageIndex);
            pageBuffer.push(spellPane);

            if (pageBuffer.length === 2) {
                this.pages.push({ isToc: false, left: pageBuffer[0], right: pageBuffer[1] });
                pageBuffer = [];
                nextPageIndex++;
            }
        }
        if (pageBuffer.length > 0) {
            this.pages.push({ isToc: false, left: pageBuffer[0], right: null });
        }
    }
  }

  async getData(options) {
    await this._dataReady;
    return { page: this.pages[this.currentPageIndex] || {}, hasPrevPage: this.currentPageIndex > 0, hasNextPage: this.currentPageIndex < this.pages.length - 1, showHomeButton: this.currentPageIndex > 0 };
  }

  async _render(force, options) { await super._render(force, options); this._applyCustomStyles(); }

  _applyCustomStyles() {
    const appElement = this.element[0]; if (!appElement) return;
    appElement.style.width = `${game.settings.get(MODULE_ID, 'windowWidth')}px`; appElement.style.height = `${game.settings.get(MODULE_ID, 'windowHeight')}px`;
    const windowContent = appElement.querySelector('.window-content'); if (!windowContent) return;
    const bgImage = game.settings.get(MODULE_ID, 'backgroundImage');
    if (bgImage && bgImage.trim() !== "") { appElement.classList.add('frameless'); windowContent.style.backgroundSize = 'cover'; windowContent.style.backgroundImage = `url("${bgImage}")`; } 
    else { appElement.classList.remove('frameless'); windowContent.style.backgroundImage = 'none'; }
  }
  
  _updatePage(newIndex) {
    if (newIndex < 0 || newIndex >= this.pages.length) return;
    this.currentPageIndex = newIndex;
    const pageData = this.pages[this.currentPageIndex]; if (!pageData) return;
    const leftPane = this.element.find('.left-page .page-content');
    const rightPane = this.element.find('.right-page .page-content');
    leftPane.addClass('page-exit');
    rightPane.addClass('page-exit');
    setTimeout(() => {
      const leftContent = SpellbookHUD._leftPageTemplate({ page: pageData });
      const rightContent = SpellbookHUD._rightPageTemplate({ page: pageData });
      leftPane.html(leftContent).removeClass('page-exit');
      rightPane.html(rightContent).removeClass('page-exit');
      this.element.find('.prev-page').toggle(this.currentPageIndex > 0);
      this.element.find('.next-page').toggle(this.currentPageIndex < this.pages.length - 1);
      this.element.find('.home-button').toggle(this.currentPageIndex > 0);
    }, 150);
  }

  activateListeners(html) {
    super.activateListeners(html);
    const appElement = this.element;
    appElement.off('.spellbook');
    
    // ** 新功能：滚轮翻页 **
    appElement.on('wheel.spellbook', (e) => {
        if (this._isScrolling) return; // 节流，防止连续翻页
        
        const delta = Math.sign(e.originalEvent.deltaY);
        if (delta > 0 && this.currentPageIndex < this.pages.length - 1) {
            this._isScrolling = true;
            this._updatePage(this.currentPageIndex + 1);
        } else if (delta < 0 && this.currentPageIndex > 0) {
            this._isScrolling = true;
            this._updatePage(this.currentPageIndex - 1);
        }

        setTimeout(() => { this._isScrolling = false; }, 200); // 200毫秒冷却时间
    });

    appElement.on('click.spellbook', '.prev-page', (e) => { this._updatePage(this.currentPageIndex - 1); });
    appElement.on('contextmenu.spellbook', '.prev-page', (e) => { e.preventDefault(); this._updatePage(0); });
    appElement.on('click.spellbook', '.next-page', (e) => { this._updatePage(this.currentPageIndex + 1); });
    appElement.on('click.spellbook', '.home-button', (e) => { this._updatePage(0); });
    appElement.on('click.spellbook', '.toc-spell-name', (e) => { const spellId = e.currentTarget.dataset.spellId; if (spellId && this.spellPageMap.has(spellId)) { this._updatePage(this.spellPageMap.get(spellId)); } });
    const rollHandler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const spellName = e.currentTarget.dataset.spellName;
        if (spellName && dnd5e?.documents?.macro?.rollItem) {
            dnd5e.documents.macro.rollItem(spellName, { event: e });
        } else { ui.notifications.error("无法找到施法宏！请确保dnd5e系统已正确加载。"); }
    };
    appElement.on('click.spellbook', '.use-spell-icon', rollHandler);
    appElement.on('contextmenu.spellbook', '.prepared-spell-entry', rollHandler);
    appElement.on('mousedown.spellbook', '.drag-handle', (e) => {
        e.preventDefault(); let isDragging = true;
        const appElemNode = appElement[0];
        const initial = { x: e.clientX, y: e.clientY, left: appElemNode.offsetLeft, top: appElemNode.offsetTop };
        appElement.addClass('dragging');
        $(document).on('mousemove.spellbookDrag', (e) => { if (isDragging) { const dx = e.clientX - initial.x; const dy = e.clientY - initial.y; appElemNode.style.left = `${initial.left + dx}px`; appElemNode.style.top = `${initial.top + dy}px`; } });
        $(document).on('mouseup.spellbookDrag', () => { isDragging = false; appElement.removeClass('dragging'); $(document).off('mousemove.spellbookDrag').off('mouseup.spellbookDrag'); });
    });
  }
}

Hooks.once('init', () => {
    game.settings.register(MODULE_ID, 'windowWidth', { name: "法术书宽度", scope: 'client', config: true, type: Number, default: 800 });
    game.settings.register(MODULE_ID, 'windowHeight', { name: "法术书高度", scope: 'client', config: true, type: Number, default: 600 });
    game.settings.register(MODULE_ID, 'backgroundImage', { name: "自定义背景图", scope: 'client', config: true, type: String, filePicker: 'image', default: "" });
    game.settings.register(MODULE_ID, 'fontFamily', { name: "法术书字体", scope: 'client', config: true, type: String, default: "Verdana" });
    game.settings.register(MODULE_ID, 'showSpellIcons', { name: "显示法术图标", hint: "在目录和详情页的法术名称旁显示法术图标。", scope: 'client', config: true, type: Boolean, default: false });
    game.settings.register(MODULE_ID, 'bookmarkPosition', { name: "书签垂直位置", scope: 'client', config: true, type: Number, range: { min: 50, max: 800, step: 10 }, default: 200, onChange: value => { const bookmark = document.getElementById('spellbook-bookmark-button'); if (bookmark) { bookmark.style.top = `${value}px`; } } });

    // ** 新功能：为1-9环法术添加过渡页自定义设置 **
    for (let i = 1; i <= 9; i++) {
        game.settings.register(MODULE_ID, `transitionText${i}`, {
            name: `${i}环法术过渡页 - 自定义文字`,
            scope: 'world',
            config: true,
            type: String,
            default: `${i}环法术`
        });
        game.settings.register(MODULE_ID, `transitionImage${i}`, {
            name: `${i}环法术过渡页 - 自定义图片`,
            scope: 'world',
            config: true,
            type: String,
            filePicker: 'image',
            default: ""
        });
    }
});

Hooks.once('ready', () => {
  // ** CSS更新：添加竖排文字和过渡页背景样式 **
  const ALL_STYLES = `
    #spellbook-bookmark-button{position:fixed;left:0;width:35px;height:60px;background-color:#8B4513;border:2px solid #5a2d0c;border-left:none;border-radius:0 10px 10px 0;box-shadow:2px 2px 5px rgba(0,0,0,0.5);cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:50;transition:all .2s ease-in-out}
    #spellbook-bookmark-button:hover{background-color:#A0522D;width:40px} #spellbook-bookmark-button i{color:#ffebcd;font-size:20px} .spellbook-hud .window-content{padding:0;background-position:center;overflow:hidden !important;}
    .spellbook-hud.frameless{background:transparent!important;border:none!important;box-shadow:none!important} .spellbook-hud.frameless .window-header{display:none} 
    .spellbook-container{position: relative; display:flex;width:100%;height:100%;font-family:var(--font-primary); padding: 50px; box-sizing: border-box;} 
    .book-page{width:50%;height:100%;box-sizing:border-box; display: flex; flex-direction: column; position: relative;}
    .book-page.left-page{border-right:1px solid rgba(0,0,0,0.2); padding-right: 25px;}
    .book-page.right-page{padding-left: 25px;}
    .prev-page, .next-page, .home-button { position: absolute; color: #6D4C41; font-size: 24px; cursor: pointer; padding: 10px; transition: transform 0.2s; z-index: 20;}
    .prev-page:hover, .next-page:hover, .home-button:hover { transform: scale(1.2); color: #8D6E63; }
    .home-button { top: -35px; left: -35px; }
    .prev-page { bottom: -35px; left: -35px; }
    .next-page { bottom: -35px; right: -35px; }
    .book-page .page-content { height: 100%; overflow-y: auto; transition: opacity 0.15s ease-in-out; }
    .book-page .page-content.page-exit { opacity: 0; }
    .drag-handle { position: absolute; top: 0; left: 25%; width: 50%; height: 40px; cursor: move; z-index: 10; }
    #spellbook-hud.dragging { opacity: 0.7; }
    .page-content h3 { text-align: center; margin-bottom: 1em; font-size: 2em; font-weight: bold; color: #6D4C41; }
    .spell-title { display: flex; align-items: center; justify-content: center; text-align: center; flex-shrink: 0; font-size: 1.5em; font-weight: bold; color: #6D4C41;}
    .toc-list { list-style: none; padding: 0; margin: 0; }
    .toc-level-header { font-weight: bold; font-size: 1.1em; color: #5a2d0c; border-bottom: 1px solid #8B4513; margin-top: 10px; padding-bottom: 2px; }
    .toc-spell-name { padding-left: 15px; font-size: 0.9em; line-height: 1.6; cursor: pointer; transition: color 0.2s; display: flex; align-items: center; }
    .toc-spell-name:hover { color: #8B4513; }
    .spell-description { overflow-y: auto; }
    .use-spell-icon { margin-left: 15px; color: #8B4513; cursor: pointer; font-size: 0.7em; }
    .use-spell-icon:hover { color: #A0522D; transform: scale(1.2); }
    .spell-icon-toc { width: 18px; height: 18px; margin-right: 8px; border-radius: 3px; border: 1px solid #ccc; }
    .spell-icon-title { width: 28px; height: 28px; margin-right: 12px; border-radius: 4px; border: 1px solid #ccc; vertical-align: middle; }
    .transition-page { display: flex; align-items: center; justify-content: center; height: 100%; background-size: cover; background-position: center; background-repeat: no-repeat; }
    .transition-page h1 { font-size: 3em; color: #795548; font-weight: bold; writing-mode: vertical-rl; text-orientation: mixed; }
  `;
  const style = document.createElement('style'); style.id = 'spellbook-hud-styles'; style.innerHTML = ALL_STYLES; document.head.appendChild(style);
  if (document.getElementById('spellbook-bookmark-button')) return;
  const bookmark = document.createElement('a');
  bookmark.id = 'spellbook-bookmark-button'; bookmark.innerHTML = '<i class="fas fa-book-open"></i>'; bookmark.style.top = `${game.settings.get(MODULE_ID, 'bookmarkPosition')}px`;
  bookmark.addEventListener('click', () => { const controlledActor = canvas.tokens.controlled[0]?.actor ?? game.user.character; if (controlledActor) { const existingWindow = Object.values(ui.windows).find(w => w.id === 'spellbook-hud'); if (existingWindow) existingWindow.close(); else new SpellbookHUD(controlledActor).render(true); } else { ui.notifications.warn("请先选择一个你拥有的角色！"); } });
  document.body.appendChild(bookmark);
});

Hooks.on('renderSettingsConfig', (app, html) => {
  const bgInput = html.querySelector(`input[name="${MODULE_ID}.backgroundImage"]`);
  const filePicker = bgInput?.nextElementSibling;
  if (filePicker?.tagName === 'BUTTON') {
    filePicker.addEventListener('click', async () => { await new Promise(resolve => setTimeout(resolve, 500)); const windowInstance = Object.values(ui.windows).find(w => w.id === 'spellbook-hud'); if (windowInstance) windowInstance.render(true); });
  }
});