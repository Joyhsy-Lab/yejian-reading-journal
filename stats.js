"use strict";

const readingStats = (() => {
  const weekdays = ["日","一","二","三","四","五","六"];
  const colors = ["#40654e","#a56843","#6d6596","#397488","#9a5867","#667b38","#685d52","#566d9b"];
  const goal = 1800;
  const sum = values => values.reduce((a,b)=>a+b,0);
  const duration = seconds => {
    if (!seconds) return "0 分钟";
    if (seconds < 60) return "不足 1 分钟";
    const mins = Math.round(seconds/60);
    const hours = Math.floor(mins/60);
    return hours ? `${hours} 小时${mins%60 ? ` ${mins%60} 分钟` : ""}` : `${mins} 分钟`;
  };
  const isDemo = s => /^sample-s[123]$/.test(s.id);
  function summarize(sessions, year, month, now = new Date()) {
    const length = new Date(year,month+1,0).getDate();
    const first = new Date(year,month,1).getDay();
    const today = now.getFullYear()===year && now.getMonth()===month ? now.getDate() : null;
    const elapsed = today ?? (new Date(year,month,1)>now ? 0 : length);
    const days = Array.from({length},(_,i)=>({number:i+1,seconds:0,books:new Map()}));
    const books = new Map();
    const hours = Array(24).fill(0);
    const byWeekday = Array(7).fill(0);
    const weekdayCount = Array(7).fill(0);
    let count=0, datedOnly=0, examples=0;
    for (const session of sessions) {
      const date=new Date(session.time);
      if (date.getFullYear()!==year || date.getMonth()!==month) continue;
      const day=days[date.getDate()-1];
      const seconds=session.seconds;
      day.seconds+=seconds;
      day.books.set(session.book,(day.books.get(session.book)||0)+seconds);
      books.set(session.book,(books.get(session.book)||0)+seconds);
      // Older date-only entries were stored at exactly local noon.
      const known = session.hourKnown ?? (date.getHours()!==12 || date.getMinutes()!==0 || date.getSeconds()!==0 || date.getMilliseconds()!==0);
      if (known) hours[new Date(session.started ?? session.time).getHours()]+=seconds;
      else datedOnly++;
      if (isDemo(session)) examples++;
      count++;
    }
    let running=0;
    const accumulated=days.map((day,i)=>{
      running+=day.seconds;
      byWeekday[(first+i)%7]+=day.seconds;
      if (i<elapsed || day.seconds) weekdayCount[(first+i)%7]++;
      return running;
    });
    const observed=Math.max(elapsed,days.findLastIndex(d=>d.seconds>0)+1);
    return {days,first,today,books,hours,datedOnly,examples,count,accumulated,observed,total:running,
      weekdayAverage:byWeekday.map((n,i)=>n/(weekdayCount[i]||1)),
      average:running/(observed||1), active:days.filter(d=>d.seconds>0).length};
  }

  const n = value => +value.toFixed(2);
  function svg(label, content, box="0 0 360 222") {
    return `<svg class="stats-svg" viewBox="${box}" role="img" aria-label="${label}">${content}</svg>`;
  }
  function axisStep(max) {
    const range=max/4;
    if (range<=3600) return [60,120,300,600,900,1200,1800,2700,3600].find(v=>v>=range);
    return Math.ceil(range/3600)*3600;
  }
  function timeChart(model,cumulative=false) {
    const {days,observed,accumulated,total,average}=model;
    const peak=Math.max(goal*(cumulative?days.length:1),cumulative?total:Math.max(...days.map(d=>d.seconds)));
    const step=axisStep(peak);
    const max=4*step, left=11, right=318, top=15, bottom=194;
    const x=i=>n(left+(i+.5)*(right-left)/days.length);
    const y=v=>n(bottom-(bottom-top)*v/max);
    const ticks=Array.from({length:5},(_,i)=>`<line x1="${left}" x2="${right}" y1="${y(i*step)}" y2="${y(i*step)}" class="stats-gridline"/><text x="326" y="${y(i*step)+4}">${step<3600 ? n(i*step/60) : n(i*step/3600)}</text>`).join("");
    const dates=days.map((d,i)=>i===0 || (d.number%5===0 && days.length-d.number>=3) || i===days.length-1 ? `<text x="${x(i)}" y="214" text-anchor="middle">${d.number}</text>` : "").join("");
    const target=cumulative
      ? `<path class="stats-target" d="M${x(0)} ${y(goal)} L${x(days.length-1)} ${y(goal*days.length)}"/>`
      : `<path class="stats-target" d="M${left} ${y(goal)} H${right}"/>`;
    let marks="";
    if (cumulative && observed) {
      const points=accumulated.slice(0,observed).map((v,i)=>[x(i),y(v)]);
      const line=points.map(([a,b],i)=>`${i?"L":"M"}${a} ${b}`).join(" ");
      const [lastX,lastY]=points.at(-1);
      marks=`<defs><linearGradient id="stats-area" x2="0%" y2="100%"><stop stop-color="#65856d" stop-opacity=".32"/><stop offset="100%" stop-color="#65856d" stop-opacity=".04"/></linearGradient></defs>
        <path d="${line} L${lastX} ${bottom} H${x(0)} Z" fill="url(#stats-area)"/><path d="${line}" class="stats-trend"/>
        <circle cx="${lastX}" cy="${lastY}" r="3.8" class="stats-end"><title>累计 ${duration(total)}</title></circle>`;
    } else if (!cumulative) {
      const width=n((right-left)/days.length*.63);
      marks=days.map((d,i)=>d.seconds?`<rect class="stats-bar" x="${x(i)-width/2}" y="${y(d.seconds)}" width="${width}" height="${Math.max(1,bottom-y(d.seconds))}" rx="${width/2}"><title>${d.number} 日 · ${duration(d.seconds)}</title></rect>`:"").join("");
      if (average) marks+=`<path class="stats-average" d="M${left} ${y(average)} H${right}"/>`;
    }
    return `<div class="stats-axis-unit">${step<3600?"分钟":"小时"}</div>${svg(cumulative?"当月累计阅读时长折线图":"当月每日阅读时长柱状图",ticks+marks+target+dates)}
      <div class="stats-keys"><span><i></i>${cumulative?"累计":"日均"} ${duration(cumulative?total:average)}</span><span><i class="target"></i>目标 ${duration(goal*(cumulative?days.length:1))}${cumulative?" / 月":" / 天"}</span></div>`;
  }

  const pt = (r,a) => [n(130+r*Math.cos(a)),n(108+r*Math.sin(a))].join(" ");
  function petals(values,labels,label) {
    const max=Math.max(...values,1);
    const large=values.length===7;
    const outer=large?77:80, inner=large?24:13;
    const piece=(a,width,r)=>{
      const start=a-width, end=a+width;
      return `M${pt(inner,start)} Q${pt((inner+r)*.62,start)} ${pt(r-8,start)}
        Q${pt(r,start)} ${pt(r,a)} Q${pt(r,end)} ${pt(r-8,end)} Q${pt((inner+r)*.62,end)} ${pt(inner,end)}
        Q${pt(inner*.72,a)} ${pt(inner,start)}Z`;
    };
    const content=values.map((v,i)=>{
      const a=i*Math.PI*2/values.length-Math.PI/2, w=Math.PI/values.length*(large?.88:.84);
      const r=inner+10+(outer-inner-10)*v/max;
      const [x,y]=pt(large?99:94,a).split(" ").map(Number);
      return `<path d="${piece(a,w,outer)}" class="stats-petal-track"/>
        ${v?`<path d="${piece(a,w,r)}" class="stats-petal" style="--shade:${n(.55+.45*v/max)}"><title>${labels[i]} · ${duration(v)}</title></path>`:""}
        ${large || i%2===0 ? `<text x="${x}" y="${y+3}" text-anchor="middle">${labels[i]}</text>` : ""}`;
    }).join("");
    return svg(label,content,"0 0 260 219");
  }
  function bookChart(model,lookup,esc,bookHash) {
    if (!model.total) return '<p class="stats-empty">本月还没有图书阅读时长。</p>';
    const entries=[...model.books].sort((a,b)=>b[1]-a[1]);
    const top=entries.slice(0,7);
    if (entries.length>7) top.push([null,sum(entries.slice(7).map(([,v])=>v))]);
    let offset=0;
    const ring=top.map(([id,v],i)=>{
      const length=v/model.total*100;
      const stroke=top.length===1 ? "100 0" : `${Math.max(.1,length-Math.min(1.6,length*.45))} 100`;
      const html=`<circle cx="90" cy="84" r="64" pathLength="100" stroke="${colors[i]}" stroke-dasharray="${stroke}" stroke-dashoffset="${-offset}" transform="rotate(-90 90 84)"><title>${esc(id===null?"其他图书":lookup(id).title)} · ${duration(v)}</title></circle>`;
      offset+=length;
      return html;
    }).join("");
    return `<div class="stats-donut">${svg("各书阅读时间占比",`<g class="stats-ring">${ring}</g><text x="90" y="82" text-anchor="middle" class="stats-ring-value">${model.books.size} 本</text><text x="90" y="103" text-anchor="middle">本月读过</text>`,"0 0 180 168")}</div>
      <ul class="stats-book-key">${top.map(([id,v],i)=>`<li><i style="--book-color:${colors[i]}"></i>${id===null?"<span>其他图书</span>":`<a href="#${bookHash(id)}" title="${esc(lookup(id).title)}">${esc(lookup(id).title)}</a>`}<span>${duration(v)}</span></li>`).join("")}</ul>`;
  }

  function calendar(model,month,selected,lookup,esc,bookHash) {
    const index=new Map([...model.books].sort((a,b)=>b[1]-a[1]).map(([id],i)=>[id,i]));
    const color=id=>colors[index.get(id)%colors.length];
    const active=model.days[selected-1];
    const cells=model.days.map(d=>{
      const list=[...d.books].sort((a,b)=>b[1]-a[1]);
      return `<button type="button" class="stats-day" data-action="stats-day" data-id="${d.number}" aria-pressed="${selected===d.number}" ${d.number===model.today?'aria-current="date"':""}
        aria-label="${month+1} 月 ${d.number} 日 · ${list.length?duration(d.seconds):"无记录"}">
        <span class="stats-day-number">${d.number}</span>${list.slice(0,2).map(([id])=>`<span class="stats-chip" style="--book-color:${color(id)}">${esc(lookup(id).title)}</span>`).join("")}${list.length>2?`<span class="stats-more">+${list.length-2}</span>`:""}</button>`;
    }).join("");
    return `<div class="stats-calendar">
      ${weekdays.map(d=>`<span class="stats-day-label">${d}</span>`).join("")}
      ${'<span class="stats-day-blank" aria-hidden="true"></span>'.repeat(model.first)}
      ${cells}
      ${'<span class="stats-day-blank" aria-hidden="true"></span>'.repeat((7-(model.first+model.days.length)%7)%7)}
      </div><div class="stats-day-detail" aria-live="polite">
      ${active?`<strong>${month+1} 月 ${selected} 日</strong>${active.seconds?` · ${duration(active.seconds)}<ul class="stats-book-key">${[...active.books].sort((a,b)=>b[1]-a[1]).map(([id,v])=>`<li><i style="--book-color:${color(id)}"></i><a href="#${bookHash(id)}">${esc(lookup(id).title)}</a><span>${duration(v)}</span></li>`).join("")}</ul>`:" · 无阅读记录"}`:"选择日期，查看当天读过的书。"}
      </div>`;
  }
  function render(sessions,year,month,selected,lookup,esc,bookHash) {
    const now=new Date();
    const model=summarize(sessions,year,month,now);
    const years=[...new Set([year,now.getFullYear(),now.getFullYear()-1,...sessions.map(s=>new Date(s.time).getFullYear())])].sort((a,b)=>b-a);
    const card=(name,hint,content)=>`<article class="panel stats-card"><h3>${name}</h3><p class="stats-card-hint">${hint}</p>${content}</article>`;
    const week=weekdays.map(d=>"周"+d);
    const weekLegend=`<ul class="stats-week-key">${week.map((d,i)=>`<li><span>${d}</span><strong>${duration(model.weekdayAverage[i])}</strong></li>`).join("")}</ul>`;
    const hourLegend=`<ul class="stats-week-key stats-hour-key">${model.hours.map((v,i)=>v?`<li><span>${i} 时</span><strong>${duration(v)}</strong></li>`:"").join("")}</ul>`;
    const hourHint=model.datedOnly?` · ${model.datedOnly} 条记录未填写时刻`:"";
    return `<section class="reading-stats" aria-labelledby="stats-title">
      <div class="stats-head"><div><div class="stats-eyebrow">月度回顾</div><h2 id="stats-title">阅读统计</h2></div><div class="stats-head-total"><strong>${duration(model.total)}</strong><span>${model.active} 天有阅读 · ${model.books.size} 本书</span></div></div>
      <div class="stats-controls"><select id="stats-year" aria-label="统计年份">${years.map(y=>`<option value="${y}" ${y===year?"selected":""}>${y} 年</option>`).join("")}</select>
      <div class="stats-months" aria-label="统计月份">${Array.from({length:12},(_,m)=>`<button type="button" data-action="stats-month" data-id="${m}" aria-pressed="${m===month}">${m+1} 月</button>`).join("")}</div></div>
      ${model.examples?`<p class="stats-message">${model.examples===model.count?"本月目前展示的是示例记录。":"本月包含 "+model.examples+" 条示例记录。"} 示例可在「阅读计时」中删除。</p>`:!model.count?'<p class="stats-message">本月暂无阅读记录。<a href="#timer">开始计时或补记时长 →</a></p>':""}
      <div class="stats-grid">
      ${card("每日时长","每天读了多久",timeChart(model))}
      ${card("累计时长","从月初累积到当月已过日期",timeChart(model,true))}
      ${card("每日平均","按星期分组，含没有阅读的日期",petals(model.weekdayAverage,week,"星期几的平均阅读时长")+weekLegend)}
      ${card("小时分布","按每条记录的阅读时刻归类"+hourHint,sum(model.hours)?petals(model.hours,Array.from({length:24},(_,i)=>i+" 时"),"一天 24 小时的阅读时长分布")+hourLegend:'<p class="stats-empty">有具体时刻的阅读记录会显示在这里。</p>')}
      ${card("图书时长","本月阅读时间花在哪些书上",bookChart(model,lookup,esc,bookHash))}
      ${card("阅读日历","按日查看读过的书",calendar(model,month,selected,lookup,esc,bookHash))}
      </div></section>`;
  }
  return {render,summarize};
})();
