"use strict";
const $ = (id) => document.getElementById(id);
const storageKey = "project-log-editor-v2";
const introductionDefaults = JSON.parse(JSON.stringify(projectData));
function upgradeData(data) {
  if (typeof data.weeks[0].document !== "string") {
    data.title = introductionDefaults.title;
    data.description = introductionDefaults.description;
    data.weeks[0] = {...introductionDefaults.weeks[0], date:data.weeks[0].date, materials:data.weeks[0].materials};
  }
  return data;
}
function validData(data) {
  const string = value => typeof value === "string";
  return data && ["title","description","author","period","status"].every(key => string(data[key])) &&
    Array.isArray(data.overview) && data.overview.length === 4 && data.overview.every(item => item && string(item.title) && string(item.content)) &&
    Array.isArray(data.weeks) && data.weeks.length === 16 && data.weeks.every((week,i) => week && week.number === i+1 &&
      ["title","date","status","summary","goal","work","troubleshooting","next"].every(key => string(week[key])) &&
      (week.document === undefined || string(week.document)) &&
      Array.isArray(week.materials) && week.materials.every(item => item && string(item.title) && string(item.url)));
}
let loadError = false;
try {
  const saved = localStorage.getItem(storageKey) || localStorage.getItem("project-log-editor-v1");
  if (saved) { const data = JSON.parse(saved); if (!validData(data)) throw Error(); Object.assign(projectData, upgradeData(data)); }
} catch { loadError = true; }
let activeIndex = 0;
const weeks = projectData.weeks;
const fields = [
  ["goal", "이번 주 목표"], ["work", "진행 내용"],
  ["troubleshooting", "문제와 해결"], ["next", "다음 주 계획"]
];
function element(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}
function safeLink(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value, document.baseURI);
    if (["https:", "http:"].includes(url.protocol)) return url.href;
    // 로컬에서 열 때도 상대경로 첨부 파일을 사용할 수 있습니다.
    if (location.protocol === "file:" && url.protocol === "file:" && !/^[a-z][a-z\d+.-]*:/i.test(value)) return url.href;
  } catch { /* 잘못된 링크는 클릭할 수 없는 상태로 표시 */ }
  return null;
}
// 제한된 문서 서식만 DOM으로 렌더링합니다. 입력한 HTML은 실행하지 않습니다.
function inlineText(parent, text) {
  text.split(/(\*\*[^*]+\*\*)/g).forEach(part => {
    parent.append(part.startsWith("**") && part.endsWith("**") ? element("strong","",part.slice(2,-2)) : document.createTextNode(part));
  });
}
function renderDocument(text, target) {
  const lines=text.split(/\r?\n/); let i=0;
  const cells=line=>line.trim().replace(/^\||\|$/g,"").split("|").map(cell=>cell.trim());
  while(i<lines.length) {
    const line=lines[i];
    if (!line.trim()) { i++; continue; }
    if (line.startsWith("```")) {
      const code=[]; i++; while(i<lines.length && !lines[i].startsWith("```")) code.push(lines[i++]);
      i++; const pre=element("pre","system-diagram"); pre.append(element("code","",code.join("\n"))); target.append(pre); continue;
    }
    if (line.startsWith("|")) {
      const wrap=element("div","document-table-wrap"); wrap.tabIndex=0; wrap.setAttribute("role","region"); wrap.setAttribute("aria-label","발표 자료 표");
      const table=element("table","document-table"); const head=element("thead"); const row=element("tr");
      cells(line).forEach(value=>{const th=element("th");th.scope="col";inlineText(th,value);row.append(th);});head.append(row);table.append(head);i++;
      if (i<lines.length && /^\|[\s:|\-]+\|\s*$/.test(lines[i])) i++;
      const body=element("tbody");
      while(i<lines.length && lines[i].startsWith("|")) {const tr=element("tr");cells(lines[i++]).forEach(value=>{const td=element("td");inlineText(td,value || "—");tr.append(td);});body.append(tr);}
      table.append(body);wrap.append(table);target.append(wrap);continue;
    }
    if (line.startsWith("- ")) {
      const list=element("ul");while(i<lines.length && lines[i].startsWith("- ")) {const li=element("li");inlineText(li,lines[i++].slice(2));list.append(li);}target.append(list);continue;
    }
    const heading=line.match(/^(#{2,3})\s+(.+)$/);
    if(heading) {const h=element(heading[1].length===2?"h3":"h4");inlineText(h,heading[2]);target.append(h);i++;continue;}
    const paragraph=element("p"); const parts=[lines[i++]];
    while(i<lines.length && lines[i].trim() && !/^(##|\||- |```)/.test(lines[i])) parts.push(lines[i++]);
    inlineText(paragraph,parts.join("\n"));target.append(paragraph);
  }
}
function renderWeek(index) {
  activeIndex = index;
  const week = weeks[index];
  if (!week) {
    $("report-title").textContent = "아직 등록된 발표가 없습니다";
    $("report-summary").textContent = "data.js에 첫 번째 주차 기록을 추가하세요.";
    $("previous-week").disabled = $("next-week").disabled = true;
    return;
  }
  $("report-week").textContent = `WEEK ${String(week.number).padStart(2, "0")}`;
  $("report-title").textContent = week.title;
  $("report-state").textContent = week.status;
  $("report-state").classList.toggle("complete", week.status === "작성 완료");
  $("report-summary").textContent = week.summary;
  $("report-date").textContent = week.date || "발표일 미정";
  $("report-sections").replaceChildren();
  const introduction = index === 0 && typeof week.document === "string";
  $("report-sections").classList.toggle("introduction-document",introduction);
  if(introduction) renderDocument(week.document,$("report-sections"));
  else fields.forEach(([key, title], i) => {
    const section = element("section", `report-section section-${key}`);
    section.append(element("span", "section-number", `0${i + 1}`));
    const content = element("div", "section-content");
    content.append(element("h3", "", title), element("p", "section-text", week[key] || "내용을 작성하세요."));
    section.append(content);
    $("report-sections").append(section);
  });
  $("materials").replaceChildren();
  if (!week.materials?.length) $("materials").append(element("p", "empty-materials", "등록된 자료가 없습니다. 발표 문서, 실행 화면, 참고 링크를 여기에 모아두세요."));
  (week.materials || []).forEach(item => {
    const href = safeLink(item.url);
    const link = element(href ? "a" : "span", "material-link", item.title + (href ? " ↗" : " (링크 확인 필요)"));
    if (href) { link.href = href; link.target = "_blank"; link.rel = "noopener noreferrer"; }
    $("materials").append(link);
  });
  document.querySelectorAll(".week-button").forEach((button, i) => {
    button.classList.toggle("active", i === index);
    button.setAttribute("aria-pressed", String(i === index));
  });
  $("previous-week").disabled = index === 0;
  $("next-week").disabled = index === weeks.length - 1;
  $("page-position").textContent = `${index + 1} / ${weeks.length}`;
}
$("project-title").textContent = projectData.title;
$("project-description").textContent = projectData.description;
document.title = `${projectData.title} | 프로젝트 기록`;
$("week-count").textContent = `${weeks.length}주`;
weeks.forEach((week, i) => {
  const button = element("button", "week-button");
  button.type = "button";
  button.setAttribute("aria-controls", "report-sections");
  button.append(element("span", "week-number", String(week.number).padStart(2, "0")));
  const content = element("span", "week-info");
  content.append(element("strong", "", `${week.number}주차`), element("span", "", week.title));
  button.append(content, element("span", "week-arrow", "↗"));
  button.addEventListener("click", () => renderWeek(i));
  $("week-list").append(button);
});
$("previous-week").addEventListener("click", () => renderWeek(activeIndex - 1));
$("next-week").addEventListener("click", () => renderWeek(activeIndex + 1));
$("print-button").addEventListener("click", () => window.print());
renderWeek(0);

// 프로젝트 정보를 왼쪽에 배치하고, 저장이 성공한 뒤 화면에 반영합니다.
const sidebar = element("div", "project-sidebar");
$("main").prepend(sidebar);
sidebar.append(document.querySelector(".intro"), document.querySelector(".archive"));
const projectButton = element("button", "project-edit", "프로젝트 정보 편집");
projectButton.type = "button";
document.querySelector(".intro").append(projectButton);
const note = element("p", "storage-note", "이 브라우저에 저장 · 다른 기기로 옮길 때는 백업을 다운로드하세요.");
document.querySelector(".intro").append(note);
let editing = "week";
let dirty = false;
function notify(message) { $("notice").textContent = message; $("notice").hidden = false; }
function inputField(key, label, value, multiline = false) {
  const wrap = element("label", "editor-field", label);
  const input = element(multiline ? "textarea" : "input");
  input.name = key; input.value = value; if (multiline) input.rows = 5;
  wrap.append(input); $("editor-fields").append(wrap);
}
function openEditor(mode) {
  editing = mode; dirty = false; $("editor-fields").replaceChildren(); $("editor-error").textContent = "";
  $("editor-title").textContent = mode === "week" ? `${weeks[activeIndex].number}주차 편집` : "프로젝트 정보 편집";
  if (mode === "week") {
    const week = weeks[activeIndex];
    [["title","발표 제목"],["date","발표일"],["summary","한 줄 요약"]].forEach(([key,label]) => inputField(key,label,week[key]));
    const label = element("label","editor-field","작성 상태");
    const select = element("select"); select.name = "status";
    [...new Set(["작성 전","작성 중","작성 완료",week.status])].forEach(value => { const option = element("option","",value); option.value=value; select.append(option); });
    select.value = week.status; label.append(select); $("editor-fields").append(label);
    if (activeIndex === 0) {
      inputField("document","프로젝트 소개 본문 · ## 제목 / ### 소제목 / **강조** / | 표 |",week.document,true);
      $("editor-fields").lastElementChild.querySelector("textarea").rows=24;
    } else fields.forEach(([key,label]) => inputField(key,label,week[key],true));
    inputField("materials","첨부 링크 · 한 줄에 자료 이름 | URL",week.materials.map(item => `${item.title} | ${item.url}`).join("\n"),true);
  } else {
    [["title","프로젝트 이름"],["description","프로젝트 설명"]].forEach(([key,label]) => inputField(key,label,projectData[key]));
  }
  $("editor").showModal();
}
function closeEditor() { if (!dirty || confirm("저장하지 않은 변경 사항을 취소할까요?")) { dirty=false; $("editor").close(); } }
projectButton.addEventListener("click",() => openEditor("project"));
$("edit-week").addEventListener("click",() => openEditor("week"));
$("close-editor").addEventListener("click",closeEditor);
$("cancel-editor").addEventListener("click",closeEditor);
$("editor").addEventListener("cancel",event => { event.preventDefault(); closeEditor(); });
$("editor-form").addEventListener("input",() => { dirty=true; });
window.addEventListener("beforeunload",event => { if (dirty) { event.preventDefault(); event.returnValue=""; } });
function refresh() {
  $("project-title").textContent=projectData.title; $("project-description").textContent=projectData.description;
  document.title=`${projectData.title} | 프로젝트 기록`;
  document.querySelectorAll(".week-info > span").forEach((el,i) => { el.textContent=weeks[i].title; });
  renderWeek(activeIndex);
}
function commit(data) {
  localStorage.setItem(storageKey,JSON.stringify(data));
  // 기존 주차 배열 참조를 유지합니다.
  weeks.splice(0,weeks.length,...data.weeks); Object.assign(projectData,data,{weeks}); refresh();
}
$("editor-form").addEventListener("submit", event => {
  event.preventDefault(); const form = new FormData(event.currentTarget);
  const data = JSON.parse(JSON.stringify(projectData));
  if (editing === "week") {
    const week = data.weeks[activeIndex];
    ["title","date","status","summary",...(activeIndex===0 ? ["document"] : fields.map(([key])=>key))].forEach(key => { week[key]=String(form.get(key)).trim(); });
    if (!week.title) { $("editor-error").textContent="발표 제목을 입력해 주세요."; return; }
    const lines=String(form.get("materials")).split("\n").filter(line=>line.trim());
    const materials=[];
    for (const line of lines) {
      const separator=line.indexOf("|"); const title=line.slice(0,separator).trim(); const url=line.slice(separator+1).trim();
      if (separator<1 || !title || !safeLink(url)) { $("editor-error").textContent="첨부 자료를 ‘이름 | https://주소’ 또는 ‘이름 | assets/파일명’ 형식으로 입력해 주세요."; return; }
      materials.push({title,url});
    }
    week.materials=materials;
  } else {
    ["title","description"].forEach(key=>{ data[key]=String(form.get(key)).trim(); });
    if (!data.title) { $("editor-error").textContent="프로젝트 이름을 입력해 주세요."; return; }
  }
  try { commit(data); dirty=false; $("editor").close(); notify("이 브라우저에 저장했습니다. 다른 기기에서 사용하려면 백업을 다운로드하세요."); }
  catch { $("editor-error").textContent="브라우저 저장 공간에 저장하지 못했습니다. 입력 내용은 유지됩니다. 저장 공간과 브라우저 설정을 확인해 주세요."; }
});
$("backup").addEventListener("click",()=>{
  const blob=new Blob([JSON.stringify(projectData,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob); const link=element("a"); link.href=url; link.download="project-log-backup.json";
  document.body.append(link); link.click(); link.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
});
$("restore").addEventListener("click",()=>$("backup-file").click());
$("backup-file").addEventListener("change",async event=>{
  const file=event.target.files[0]; if (!file) return;
  try {
    if (file.size>5000000) throw Error("파일이 너무 큽니다. 5MB 이하의 백업을 선택해 주세요.");
    let data; try { data=JSON.parse(await file.text()); } catch { throw Error("JSON 백업 파일을 읽을 수 없습니다."); }
    if (!validData(data)) throw Error("이 사이트의 16주차 백업 형식과 일치하지 않습니다.");
    if (!confirm("현재 프로젝트와 16주차 내용을 백업 파일의 내용으로 교체할까요?")) return;
    try { commit(upgradeData(data)); } catch { throw Error("브라우저 저장에 실패했습니다. 기존 내용은 유지됩니다."); }
    notify("백업 내용을 불러와 이 브라우저에 저장했습니다.");
  } catch(error) { notify(error.message); } finally { event.target.value=""; }
});
if(loadError) notify("기존 브라우저 기록을 읽지 못해 기본 내용을 표시합니다. 필요한 경우 백업을 불러와 주세요.");
