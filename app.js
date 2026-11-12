"use strict";

const paths = {
  book:'<path d="M12 6c-3-2.5-6-3-9-2v15c3-1 6-.5 9 2 3-2.5 6-3 9-2V4c-3-1-6-.5-9 2v15"/>',
  home:'<path d="m3 10 9-7 9 7v10h-6v-6H9v6H3Z"/>',
  shelf:'<path d="M3 4h5v16H3zM8 4h5v16H8zM13 6l4-1 4 14-4 1zM3 8h10"/>',
  pen:'<path d="m4 20 4.5-1 11-11-3.5-3.5-11 11L4 20zm10.5-14 3.5 3.5M11 20h9"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  chart:'<path d="M4 4v16h16M8 15l4-5 3 2 5-6"/>',
  archive:'<path d="M3 4h18v5H3zM5 9v11h14V9m-9 4h4"/>',
  search:'<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  chevron:'<path d="m9 5 7 7-7 7"/>',
  arrow:'<path d="M4 12h15m-6-6 6 6-6 6"/>',
  calendar:'<rect x="4" y="6" width="16" height="14" rx="2"/><path d="M8 4v4m8-4v4M4 10h16"/>',
  play:'<path d="m8 4 12 8-12 8Z"/>',
  stop:'<rect x="6" y="6" width="12" height="12" rx="1"/>'
};
const titles = {home:"阅读总览",books:"我的书架",notes:"读书笔记",timer:"阅读计时",progress:"阅读进度",book:"书籍详情"};
const bookStatuses = ["想读","在读","已读"];
const noteTypes = ["摘抄","感想","书评"];
const coverPalettes = [
  ["#e5e9dc","#46654f","#f2ead1"],
  ["#f2e6d7","#b78361","#fff3d8"],
  ["#ebe8e1","#ddd2b7","#5b513b"],
  ["#e3e9e9","#3e5860","#edf2e5"],
  ["#eee4e3","#90636b","#f8ebda"]
];
const storageKey = "yejian.journal.v1";
const main = document.querySelector("#main");
const dialog = document.querySelector("#dialog");
const toast = document.querySelector("#toast");
const fmt = new Intl.DateTimeFormat("zh-CN",{month:"numeric",day:"numeric"});
const fullDate = new Intl.DateTimeFormat("zh-CN",{year:"numeric",month:"long",day:"numeric",weekday:"long"});
const weekday = new Intl.DateTimeFormat("zh-CN",{weekday:"short"});
const icon = name => `<i data-icon="${name}" aria-hidden="true"></i>`;
const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[ch]);
const uid = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const day = offset => { const date = new Date(); date.setDate(date.getDate()+offset); return date; };
const dayKey = date => `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`;
const dateLabel = time => fmt.format(new Date(time));
const percentage = book => Math.round(book.page/book.pages*100);
const minutes = seconds => Math.round(seconds/60);
const lookup = id => data.books.find(book=>book.id===id);
const timerSeconds = () => data.timer ? Math.max(0,Math.floor((Date.now()-data.timer.started)/1000)) : 0;
const timerText = seconds => [Math.floor(seconds/3600),Math.floor(seconds%3600/60),seconds%60].map(value=>String(value).padStart(2,"0")).join(":");

function demo() {
  const at = (offset,hour,minute) => day(offset).setHours(hour,minute,0,0);
  return {
    books:[
      {id:"vegetarian",title:"素食者",author:"韩江",status:"在读",page:82,pages:192,color:0},
      {id:"walden",title:"瓦尔登湖",author:"亨利·戴维·梭罗",status:"在读",page:57,pages:318,color:1},
      {id:"room",title:"一间自己的房间",author:"弗吉尼亚·伍尔夫",status:"想读",page:0,pages:164,color:2}
    ],
    notes:[
      {id:"sample-1",book:"vegetarian",type:"感想",title:"沉默的边界",position:"第 82 页",body:"在几个人的叙述中，最难被听见的恰恰是英惠的声音。读到这里，想记下每一次她开口的时刻。",time:+day(0)},
      {id:"sample-2",book:"walden",type:"感想",title:"慢下来，留意日常",position:"第 57 页",body:"读完这一节，想试试把早晨的半小时留给散步，观察同一条路每天有哪些变化。",time:+day(-1)},
      {id:"sample-3",book:"vegetarian",type:"感想",title:"重新理解她的选择",position:"第一章",body:"同一个选择，在不同人的眼中有截然不同的含义。我想在读完全书后回看这一章。",time:+day(-3)}
    ],
    sessions:[
      {id:"sample-s1",book:"vegetarian",seconds:1680,time:at(0,7,30),hourKnown:true},
      {id:"sample-s2",book:"walden",seconds:1320,time:at(-1,20,15),hourKnown:true},
      {id:"sample-s3",book:"vegetarian",seconds:2100,time:at(-3,16,15),hourKnown:true}
    ],
    timer:null
  };
}

function validData(value) {
  const stringFields = (record, keys) => record && keys.every(key => typeof record[key] === "string");
  const timeOK = value => Number.isFinite(value) && Math.abs(value) <= 8.64e15;
  if (!value || !Array.isArray(value.books) || !Array.isArray(value.notes) || !Array.isArray(value.sessions)) return false;
  const ids = new Set(value.books.map(book => book?.id));
  const unique = list => new Set(list.map(record=>record?.id)).size === list.length;
  return unique(value.books) && unique(value.notes) && unique(value.sessions)
    && value.books.every(book => stringFields(book,["id","title","author","status"]) && bookStatuses.includes(book.status)
      && Number.isInteger(book.pages) && book.pages > 0 && Number.isInteger(book.page) && book.page >= 0 && book.page <= book.pages
      && Number.isInteger(book.color) && book.color >= 0 && book.color < coverPalettes.length)
    && value.notes.every(note => stringFields(note,["id","book","type","title","position","body"]) && ids.has(note.book) && noteTypes.includes(note.type) && timeOK(note.time))
    && value.sessions.every(session => stringFields(session,["id","book"]) && ids.has(session.book) && Number.isSafeInteger(session.seconds) && session.seconds > 0 && timeOK(session.time)
      && (session.hourKnown === undefined || typeof session.hourKnown === "boolean")
      && (session.started === undefined || timeOK(session.started)))
    && (value.timer === null || (ids.has(value.timer?.book) && timeOK(value.timer.started)));
}

let data;
try {
  const previous = JSON.parse(localStorage.getItem(storageKey));
  data = validData(previous) ? previous : demo();
} catch { data = demo(); }

let bookFilter = "";
let noteFilter = "";
let selectedBook = "";
const statsNow = new Date();
let statsYear = statsNow.getFullYear(), statsMonth = statsNow.getMonth(), statsDay = null;
function statsMarkup() {
  return readingStats.render(data.sessions,statsYear,statsMonth,statsDay,lookup,esc,bookHash);
}
function redrawStats(focus) {
  document.querySelector(".reading-stats").outerHTML=statsMarkup();
  document.querySelector(focus)?.focus({preventScroll:true});
}
let toastTimeout;
function say(message) {
  const feedback = dialog.open && dialog.querySelector(".feedback");
  if (feedback) feedback.textContent = message;
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(()=>toast.classList.remove("visible"),3000);
}
function save(next, message) {
  try { localStorage.setItem(storageKey,JSON.stringify(next)); }
  catch { say("浏览器无法保存数据，请检查存储权限或剩余空间。"); return false; }
  data = next;
  render();
  if (message) say(message);
  return true;
}
function paintIcons(root) {
  root.querySelectorAll("[data-icon]:empty").forEach(node=>{
    const path = paths[node.dataset.icon];
    if (path) node.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
  });
}
function route() {
  const hash = location.hash.slice(1);
  if (hash.startsWith("book/")) {
    try {
      const book = lookup(decodeURIComponent(hash.slice(5)));
      if (book) return {view:"book",book};
    } catch {}
    return {view:"books"};
  }
  return {view:Object.hasOwn(titles,hash) && hash!=="book" ? hash : "home"};
}
function action(name,label,options={}) {
  const {id="",symbol="",classes="button",extra=""} = options;
  return `<button type="button" class="${classes}" data-action="${name}" data-id="${esc(id)}" ${extra}>${symbol ? icon(symbol) : ""}${label}</button>`;
}
const link = (hash,label) => `<a class="text-button" href="#${hash}">${label}${icon("arrow")}</a>`;
const bookHash = id => `book/${esc(encodeURIComponent(id))}`;
const head = (title,subtitle="",right="") => `<div class="page-head"><div><h1>${title}</h1>${subtitle ? `<p class="subtitle">${subtitle}</p>` : ""}</div>${right}</div>`;
const section = (title,right="") => `<div class="section-head"><h2>${title}</h2>${right}</div>`;
const empty = (message,button="") => `<div class="empty">${message}${button}</div>`;
const track = book => `<div class="track" role="progressbar" aria-label="${esc(book.title)}阅读进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percentage(book)}"><span style="width:${percentage(book)}%"></span></div>`;
const tag = type => `<span class="tag ${type==="感想"?"thought":type==="书评"?"review":""}">${esc(type)}</span>`;
const sorted = list => [...list].sort((a,b)=>b.time-a.time);
function cover(book) {
  const [background,color,ink] = coverPalettes[book.color];
  return `<div class="cover-wrap" aria-hidden="true" style="--cover-bg:${background};--cover:${color};--cover-ink:${ink}"><div class="cover"><b>${esc(book.title)}</b><span>${esc(book.author)}</span></div></div>`;
}
function bookCard(book) {
  return `<a href="#${bookHash(book.id)}" class="book-card">${cover(book)}<strong class="book-title">${esc(book.title)}</strong><span class="meta">${esc(book.author || "作者未填写")}</span>${track(book)}<span class="book-status"><span>${esc(book.status)}</span><span>${percentage(book)}%</span></span></a>`;
}
function noteRow(note) {
  const book = lookup(note.book);
  return `<button type="button" class="note-row" data-action="note-edit" data-id="${esc(note.id)}"><span class="row-top"><strong>${esc(note.title)}</strong>${tag(note.type)}</span><span class="excerpt">${esc(note.body)}</span><span class="meta">${esc(book.title)}${note.position ? ` · ${esc(note.position)}` : ""} · ${dateLabel(note.time)}</span></button>`;
}
function noteStack(notes,message="这里还没有笔记") {
  return `<div class="panel note-stack">${notes.length ? notes.map(noteRow).join("") : empty(message)}</div>`;
}
function weekData() {
  const days = Array.from({length:7},(_,i)=>({date:day(i-6),seconds:0}));
  const byDay = new Map(days.map(entry=>[dayKey(entry.date),entry]));
  for (const session of data.sessions) {
    const entry = byDay.get(dayKey(new Date(session.time)));
    if (entry) entry.seconds += session.seconds;
  }
  return days;
}
function metric(symbol,title,value,unit,theme="") {
  return `<div class="metric"><span class="metric-icon ${theme}">${icon(symbol)}</span><div><div class="meta">${title}</div><strong>${value}</strong><small>${unit}</small></div></div>`;
}
function home() {
  const latest = sorted(data.sessions).map(session=>lookup(session.book)).find(book=>book?.status==="在读");
  const book = lookup(data.timer?.book) || latest || data.books.find(book=>book.status==="在读");
  const date = `<span class="today">${icon("calendar")}${fullDate.format(new Date())}</span>`;
  const hero = book
    ? `<div class="hero-label">${icon("book")}继续阅读</div><h2>${esc(book.title)}</h2><p>${esc(book.author || "作者未填写")}</p><div class="hero-meter">${track(book)}<div class="reading-meta"><span>第 ${book.page} / ${book.pages} 页</span><span>${percentage(book)}%</span></div></div><div class="inline-actions">${action("start",data.timer ? "查看计时" : "开始阅读",{id:book.id,symbol:"play"})}<a class="button alt" href="#${bookHash(book.id)}">查看书籍</a></div>`
    : `<div class="hero-label">${icon("book")}阅读计划</div><h2>开始下一本书</h2><p>添加书籍，记录阅读进度和笔记。</p><div class="inline-actions">${action("book-add","添加书籍",{symbol:"plus"})}<a class="button alt" href="#books">查看书架</a></div>`;
  return `${head("阅读总览","查看当前在读的书、近七天的阅读时长与最近的笔记。",date)}
    <section class="hero"><div class="hero-inner">${hero}</div></section>
    <div class="metric-grid">${metric("clock","近七天阅读",minutes(weekData().reduce((sum,entry)=>sum+entry.seconds,0)),"分钟")}${metric("shelf","在读书籍",data.books.filter(book=>book.status==="在读").length,"本","pale")}${metric("pen","累计笔记",data.notes.length,"条","warm")}</div>
    <div class="dashboard-grid">
      <section>${section("我的书架",link("books","查看全部"))}${data.books.length ? `<div class="shelf-grid">${data.books.slice(0,3).map(bookCard).join("")}</div>` : `<div class="panel">${empty("书架还没有书",action("book-add","添加书籍",{symbol:"plus"}))}</div>`}</section>
      <section>${section("最近笔记",link("notes","全部笔记"))}${noteStack(sorted(data.notes).slice(0,3))}</section>
    </div>`;
}
function filters(kind,options,current) {
  return `<div class="filters" aria-label="筛选">${["",...options].map(value=>action(kind,esc(value||"全部"),{id:value,classes:"pill",extra:`aria-pressed="${current===value}"`})).join("")}</div>`;
}
function books() {
  const list = data.books.filter(book=>!bookFilter || book.status===bookFilter);
  return `${head("我的书架",`共 ${data.books.length} 本书`,action("book-add","添加书籍",{symbol:"plus",classes:"button primary"}))}
    ${filters("books-filter",bookStatuses,bookFilter)}
    ${list.length ? `<div class="shelf-grid full-shelf">${list.map(bookCard).join("")}</div>` : `<div class="panel">${empty("这个书架分类还没有书")}</div>`}`;
}
function notes() {
  const list = sorted(data.notes).filter(note=>!noteFilter || note.type===noteFilter);
  return `${head("读书笔记",`共 ${data.notes.length} 条笔记`,action("search","搜索",{symbol:"search"}))}
    ${filters("notes-filter",noteTypes,noteFilter)}${noteStack(list)}`;
}
function logRows(list) {
  if (!list.length) return empty("还没有阅读记录");
  return sorted(list).map(entry=>`<div class="log"><div><strong>${esc(lookup(entry.book).title)}</strong><div class="meta">${dateLabel(entry.time)}</div></div><div class="inline-actions"><span>${entry.seconds < 60 ? `${entry.seconds} 秒` : `${minutes(entry.seconds)} 分钟`}</span>${action("log-delete","删除",{id:entry.id,classes:"text-button"})}</div></div>`).join("");
}
function bookDetail(book) {
  const notes = sorted(data.notes).filter(note=>note.book===book.id);
  const logs = data.sessions.filter(entry=>entry.book===book.id);
  return `${link("books","返回书架")}
  <div class="detail-top block-gap">${cover(book)}<div><h1>${esc(book.title)}</h1><p class="subtitle">${esc(book.author || "作者未填写")} · ${esc(book.status)}</p><div class="inline-actions">${action("start","开始阅读",{id:book.id,symbol:"play",classes:"button primary"})}${action("note","新建笔记",{id:book.id,symbol:"pen"})}${action("book-edit","编辑书籍",{id:book.id})}</div></div></div>
  <div class="metric-grid">${metric("chart","阅读进度",percentage(book),"%")}${metric("clock","累计阅读",minutes(logs.reduce((sum,entry)=>sum+entry.seconds,0)),"分钟","pale")}${metric("pen","笔记数量",notes.length,"条","warm")}</div>
  <div class="detail-grid"><div><div class="panel pad">${section("页码进度",action("page","更新进度",{id:book.id,classes:"text-button"}))}<p class="meta">第 ${book.page} / ${book.pages} 页</p><div class="block-gap">${track(book)}</div></div>
    <div class="panel pad block-gap">${section("阅读记录",action("manual","补记时长",{id:book.id,classes:"text-button"}))}${logRows(logs)}</div></div>
    <div>${section("笔记与书评",action("review","启发式书评",{id:book.id,classes:"text-button"}))}${noteStack(notes)}</div>
  </div>`;
}
function bookOptions(current) {
  return data.books.map(book=>`<option value="${esc(book.id)}" ${book.id===current?"selected":""}>${esc(book.title)}</option>`).join("");
}
function timer() {
  const running = data.timer;
  const selected = running?.book || selectedBook || data.books.find(book=>book.status==="在读")?.id || data.books[0]?.id;
  return `${head("阅读计时","选择一本书，开始计时或补记已经读过的时间。",action("manual","补记时长",{id:selected,symbol:"plus"}))}
    <div class="panel timer-panel">${data.books.length ? `<label for="timer-book">正在读哪本书？</label><select id="timer-book" ${running?"disabled":""}>${bookOptions(selected)}</select>` : `<p class="meta">添加一本书后即可开始计时。</p>`}
    <div class="timer-display" id="timer-display">${timerText(timerSeconds())}</div>
    <div class="inline-actions">${running ? action("stop","结束并保存",{symbol:"stop",classes:"button primary"}) : data.books.length ? action("start-now","开始计时",{symbol:"play",classes:"button primary"}) : action("book-add","添加书籍",{symbol:"plus",classes:"button primary"})}</div></div>
    <div class="panel pad block-gap">${section("阅读记录")}${logRows(data.sessions)}</div>`;
}
function progress() {
  const days = weekData();
  const max = Math.max(...days.map(entry=>entry.seconds),60);
  const active = data.books.filter(book=>book.status!=="想读");
  return `${head("阅读进度","回顾每月的阅读习惯，也看看每本书读到了哪里。")}
    <div class="metric-grid">${metric("clock","累计阅读",minutes(data.sessions.reduce((sum,entry)=>sum+entry.seconds,0)),"分钟")}${metric("shelf","已读完",data.books.filter(book=>book.status==="已读").length,"本","pale")}${metric("calendar","近七天有阅读",days.filter(entry=>entry.seconds>0).length,"天","warm")}</div>
    ${statsMarkup()}
    <div class="detail-grid"><section class="panel pad">${section("近七天阅读")}<p class="meta">每日阅读分钟数</p><div class="bar-chart">${days.map(entry=>`<div class="bar-col" title="${dateLabel(+entry.date)} · ${minutes(entry.seconds)} 分钟"><span>${minutes(entry.seconds)}</span><div class="bar-slot"><span class="bar" style="height:${Math.round(entry.seconds/max*100)}%"></span></div><span>${weekday.format(entry.date)}</span></div>`).join("")}</div></section>
    <section class="panel pad">${section("书籍进度")}${active.length ? active.map(book=>`<div class="progress-row"><div><a href="#${bookHash(book.id)}"><strong>${esc(book.title)}</strong></a>${action("page","更新进度",{id:book.id,classes:"text-button"})}</div><p class="meta">${book.page} / ${book.pages} 页 · ${percentage(book)}%</p>${track(book)}</div>`).join("") : empty("开始阅读后可在这里更新进度")}</section></div>`;
}

function render() {
  const {view,book} = route();
  document.querySelector("#breadcrumb").textContent = view==="book" ? book.title : titles[view];
  document.querySelectorAll("[data-view]").forEach(node=>{
    if (node.dataset.view === (view==="book" ? "books" : view)) node.setAttribute("aria-current","page");
    else node.removeAttribute("aria-current");
  });
  main.innerHTML = view==="book" ? bookDetail(book) : {home,books,notes,timer,progress}[view]();
  paintIcons(document);
  updateClock();
}
function updateClock() {
  const text = timerText(timerSeconds());
  const display = document.querySelector("#timer-display");
  const nav = document.querySelector("#nav-timer");
  if (display) display.textContent=text;
  nav.hidden = !data.timer;
  if (data.timer) nav.textContent=text.slice(0,2)==="00" ? text.slice(3) : text;
}

function modal(title,content) {
  dialog.innerHTML = `<div class="dialog-body"><div class="dialog-head"><h2 id="dialog-title">${title}</h2><button class="close" type="button" data-action="close" aria-label="关闭">×</button></div><p class="feedback" role="alert"></p>${content}</div>`;
  paintIcons(dialog);
  if (!dialog.open) dialog.showModal();
  (dialog.querySelector("[data-focus]") ?? dialog.querySelector("input,textarea,select,button"))?.focus();
}
const field = (label,name,value="",options="") => `<label>${label}<input name="${name}" value="${esc(value)}" ${options}></label>`;
const formEnd = (label,remove="") => `<div class="form-actions">${remove}${action("close","取消")}<button class="button primary" type="submit">${label}</button></div>`;
const optionList = (list,selected) => list.map(value=>`<option ${value===selected?"selected":""}>${esc(value)}</option>`).join("");
function bookForm(book) {
  modal(book ? "编辑书籍" : "添加书籍",`<form data-form="book" data-id="${esc(book?.id)}">
    ${field("书名","title",book?.title,"required maxlength=80 data-focus")}${field("作者（选填）","author",book?.author,"maxlength=80")}
    <div class="form-row">${field("总页数","pages",book?.pages,'type="number" required min="1" max="100000"')}${field("当前页码","page",book?.page ?? 0,'type="number" required min="0" max="100000"')}</div>
    <label>阅读状态<select name="status">${optionList(bookStatuses,book?.status || "想读")}</select></label>
    ${formEnd("保存书籍",book ? action("book-delete","删除书籍",{id:book.id,classes:"text-button danger"}) : "")}</form>`);
}
function noteForm(bookId,note,guided=false) {
  if (!data.books.length) {
    modal("新建笔记",empty("先添加一本书，再为它写笔记。",action("book-add","添加书籍",{symbol:"plus"})));
    return;
  }
  const template = "哪一幕或哪个观点最让我印象深刻？\n\n这本书改变了我对什么的看法？\n\n我会把这本书推荐给谁？为什么？";
  modal(note ? "编辑笔记" : guided ? "启发式书评" : "新建笔记",`<form data-form="note" data-id="${esc(note?.id)}">
    <div class="form-row"><label>所属书籍<select name="book">${bookOptions(note?.book || bookId)}</select></label><label>笔记类型<select name="type">${optionList(noteTypes,note?.type || (guided ? "书评" : "摘抄"))}</select></label></div>
    ${field("标题","title",note?.title,"required maxlength=100 data-focus")}
    ${field("页码或章节（选填）","position",note?.position,'maxlength=60 placeholder="例如 第 82 页"')}
    <label>正文<textarea name="body" required maxlength="30000">${esc(note?.body || (guided ? template : ""))}</textarea></label>
    ${formEnd("保存笔记",note ? action("note-delete","删除笔记",{id:note.id,classes:"text-button danger"}) : "")}</form>`);
}
function manualForm(bookId) {
  if (!data.books.length) {
    modal("补记时长",empty("先添加一本书，再记录阅读时长。",action("book-add","添加书籍",{symbol:"plus"})));
    return;
  }
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  modal("补记时长",`<form data-form="manual"><label>所属书籍<select name="book">${bookOptions(bookId)}</select></label>
    <div class="form-row">${field("阅读分钟数","minutes","",'type="number" required min="1" max="1440" data-focus')}${field("阅读日期","date",date,`type="date" required max="${date}"`)}</div>
    ${field("阅读时刻（选填）","clock","",'type="time"')}
    ${formEnd("保存记录")}</form>`);
}
function pageForm(book) {
  modal("更新进度",`<form data-form="page" data-id="${esc(book.id)}"><p class="meta">${esc(book.title)} · 共 ${book.pages} 页</p>${field("当前页码","page",book.page,`type="number" required min="0" max="${book.pages}" data-focus`)}${formEnd("保存进度")}</form>`);
}
function search() {
  modal("搜索书籍和笔记",`<label>关键词<input id="query" type="search" placeholder="书名、作者、章节或笔记内容" autocomplete="off" data-focus></label><div id="search-results" class="result-list">${empty("输入关键词开始搜索")}</div>`);
}
function backup() {
  modal("数据备份",`<p class="meta">书籍、笔记和阅读记录保存在当前浏览器。导出的 JSON 可用于恢复数据。初次打开时看到的书籍和笔记是示例。</p><div class="inline-actions block-gap">${action("export","导出备份",{symbol:"archive",classes:"button primary"})}${action("import","恢复备份")}</div><input type="file" id="import-file" accept=".json,application/json" hidden>`);
}
function start(id) {
  const book = lookup(id);
  if (book && !data.timer) {
    const books = data.books.map(entry=>entry.id===id && entry.status==="想读" ? {...entry,status:"在读"} : entry);
    if (!save({...data,books,timer:{book:id,started:Date.now()}},"计时已开始")) return;
  }
  if (data.timer) location.hash="timer";
}
function statusFor(page,pages,previous) {
  if (page===pages) return "已读";
  if (page>0 || previous==="在读") return "在读";
  return "想读";
}
function confirmRemoval(id,type,label) {
  const text = type==="book" ? "这本书及其笔记、阅读记录和进行中的计时将一并删除。" : `确定删除这条${label}吗？`;
  modal(`删除${label}`,`<p class="meta">${text}</p><div class="form-actions block-gap">${action("close","取消")}${action("delete-confirm","确认删除",{id,classes:"button primary",extra:`data-kind="${type}"`})}</div>`);
}
function remove(id,type) {
  const next = type==="book" ? {
    books:data.books.filter(book=>book.id!==id),
    notes:data.notes.filter(note=>note.book!==id),
    sessions:data.sessions.filter(session=>session.book!==id),
    timer:data.timer?.book===id ? null : data.timer
  } : type==="note" ? {...data,notes:data.notes.filter(note=>note.id!==id)}
    : {...data,sessions:data.sessions.filter(session=>session.id!==id)};
  if (save(next,"已删除")) {
    if (type==="book" && selectedBook===id) selectedBook="";
    dialog.close();
  }
}

document.addEventListener("click",event=>{
  const button = event.target.closest("[data-action]");
  if (!button) {
    if (event.target.closest("#search-results a")) dialog.close();
    return;
  }
  const {action:name,id,kind} = button.dataset;
  const book = lookup(id);
  const current = route().book;
  switch (name) {
    case "close": dialog.close(); break;
    case "search": search(); break;
    case "book-add": bookForm(); break;
    case "book-edit": if (book) bookForm(book); break;
    case "note": noteForm(id || current?.id); break;
    case "review": noteForm(id,null,true); break;
    case "note-edit": {
      const note=data.notes.find(entry=>entry.id===id);
      if (note) noteForm(note.book,note);
      break;
    }
    case "page": if (book) pageForm(book); break;
    case "manual": manualForm(id); break;
    case "stats-month":
      statsMonth=Number(id); statsDay=null;
      redrawStats(`[data-action="stats-month"][data-id="${statsMonth}"]`);
      break;
    case "stats-day":
      statsDay=Number(id);
      redrawStats(`[data-action="stats-day"][data-id="${statsDay}"]`);
      break;
    case "start": start(id); break;
    case "start-now": start(document.querySelector("#timer-book").value); break;
    case "stop": {
      if (!data.timer) break;
      const entry={id:uid(),book:data.timer.book,seconds:Math.max(1,timerSeconds()),time:Date.now(),started:data.timer.started,hourKnown:true};
      selectedBook=data.timer.book;
      if (save({...data,sessions:[entry,...data.sessions],timer:null},"阅读时长已保存")) {
        const book = lookup(entry.book);
        if (book && book.status!=="已读") pageForm(book);
      }
      break;
    }
    case "books-filter": bookFilter=id; render(); main.querySelector('[aria-pressed="true"]')?.focus(); break;
    case "notes-filter": noteFilter=id; render(); main.querySelector('[aria-pressed="true"]')?.focus(); break;
    case "book-delete": confirmRemoval(id,"book","书籍"); break;
    case "note-delete": confirmRemoval(id,"note","笔记"); break;
    case "log-delete": confirmRemoval(id,"log","阅读记录"); break;
    case "delete-confirm": remove(id,kind); break;
    case "backup": backup(); break;
    case "export": {
      const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
      const url=URL.createObjectURL(blob);
      const anchor=document.createElement("a");
      anchor.href=url;
      anchor.download="页间-阅读备份.json";
      anchor.click();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
      break;
    }
    case "import": document.querySelector("#import-file").click(); break;
    case "import-confirm":
      if (pendingImport && save(pendingImport,"备份已恢复")) { selectedBook=""; pendingImport=null; dialog.close(); render(); }
      break;
  }
});

document.addEventListener("submit",event=>{
  const form=event.target;
  if (!form.matches("[data-form]")) return;
  event.preventDefault();
  const fields=Object.fromEntries(new FormData(form));
  const {form:type,id}=form.dataset;
  let next;
  if (type==="book") {
    const old=lookup(id);
    const pages=Number(fields.pages);
    const page=Number(fields.page);
    if (!fields.title.trim()) { say("请填写书名"); return; }
    if (page>pages) { say("当前页码不能超过总页数"); return; }
    const status=fields.status==="已读" ? "已读" : statusFor(page,pages,fields.status);
    const book={id:old?.id||uid(),title:fields.title.trim(),author:fields.author.trim(),pages,page:status==="已读"?pages:page,status,color:old?.color??data.books.length%coverPalettes.length};
    next={...data,books:old ? data.books.map(entry=>entry.id===id?book:entry) : [...data.books,book]};
    if (save(next,"书籍已保存")) { dialog.close(); location.hash=bookHash(book.id); }
    return;
  }
  if (type==="note") {
    if (!fields.title.trim() || !fields.body.trim()) { say("请填写笔记标题和正文"); return; }
    const old=data.notes.find(note=>note.id===id);
    const note={id:old?.id||uid(),book:fields.book,type:fields.type,title:fields.title.trim(),body:fields.body.trim(),position:fields.position.trim(),time:Date.now()};
    next={...data,notes:[note,...data.notes.filter(entry=>entry.id!==id)]};
  }
  if (type==="manual") {
    const time=+new Date(`${fields.date}T${fields.clock || "12:00"}:00`);
    if (!Number.isFinite(time)) { say("请选择有效的阅读日期"); return; }
    const session={id:uid(),book:fields.book,time,seconds:Number(fields.minutes)*60,hourKnown:Boolean(fields.clock)};
    next={...data,sessions:[session,...data.sessions]};
  }
  if (type==="page") {
    const book=lookup(id);
    if (!book) return;
    const page=Number(fields.page);
    next={...data,books:data.books.map(entry=>entry.id===id ? {...entry,page,status:statusFor(page,book.pages,book.status)} : entry)};
  }
  if (next && save(next,{note:"笔记已保存",manual:"时长已保存",page:"进度已更新"}[type])) dialog.close();
});

let pendingImport;
document.addEventListener("change",async event=>{
  if (event.target.id==="stats-year") {
    statsYear=Number(event.target.value); statsDay=null;
    redrawStats("#stats-year");
    return;
  }
  if (event.target.id==="timer-book") { selectedBook=event.target.value; return; }
  if (event.target.id!=="import-file") return;
  const file=event.target.files[0];
  if (!file) return;
  try {
    const content=JSON.parse(await file.text());
    if (!validData(content)) throw new Error("invalid");
    pendingImport=content;
    modal("恢复备份",`<p class="meta">备份内有 ${content.books.length} 本书和 ${content.notes.length} 条笔记。恢复会替换当前浏览器中的阅读数据。</p><div class="form-actions block-gap">${action("close","取消")}${action("import-confirm","确认恢复",{classes:"button primary"})}</div>`);
  } catch { say("无法读取备份，请选择页间导出的 JSON 文件。"); }
});
document.addEventListener("input",event=>{
  if (event.target.id!=="query") return;
  const q=event.target.value.trim().toLocaleLowerCase();
  const matches=(...values)=>values.some(value=>value?.toLocaleLowerCase().includes(q));
  const books=data.books.filter(book=>matches(book.title,book.author));
  const notes=sorted(data.notes).filter(note=>matches(note.title,note.body,note.position,lookup(note.book)?.title));
  document.querySelector("#search-results").innerHTML=!q ? empty("输入关键词开始搜索")
    : books.length || notes.length ? `<div class="panel note-stack">${books.map(book=>`<a href="#${bookHash(book.id)}" class="note-row"><span class="row-top"><strong>${esc(book.title)}</strong>${tag("书籍")}</span><span class="meta">${esc(book.author)}</span></a>`).join("")}${notes.map(noteRow).join("")}</div>` : empty("没有匹配的书籍或笔记");
});
document.addEventListener("keydown",event=>{
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase()==="k") { event.preventDefault(); search(); }
});
window.addEventListener("hashchange",()=>{render();main.focus();});
window.addEventListener("storage",event=>{
  if (event.key!==storageKey) return;
  try {
    const value=JSON.parse(event.newValue);
    if (validData(value)) { data=value; if(dialog.open) dialog.close(); render(); }
  } catch {}
});
render();
setInterval(updateClock,1000);
