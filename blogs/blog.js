const blogRoot=document.documentElement;
const blogLanguage=blogRoot.lang.toLowerCase().startsWith("zh")?"zh-CN":"en-US";
const inheritedTheme=sessionStorage.getItem("portfolio-theme");
blogRoot.dataset.theme=inheritedTheme==="dark"?"dark":"light";
document.querySelector(".blog-theme-toggle")?.addEventListener("click",()=>{
  const next=blogRoot.dataset.theme==="dark"?"light":"dark";
  blogRoot.dataset.theme=next;
  sessionStorage.setItem("portfolio-theme",next);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content",next==="dark"?"#101014":"#f7f7fb");
});

const searchInput=document.querySelector("[data-blog-search]");
const sortSelect=document.querySelector("[data-blog-sort]");
const grid=document.querySelector("[data-post-grid]");
const cards=[...document.querySelectorAll(".post-card")];
const tagButtons=[...document.querySelectorAll("[data-blog-tag]")];
const emptyState=document.querySelector("[data-empty-state]");
const resultStatus=document.querySelector("[data-result-status]");
let activeTag="all";

function updatePosts(){
  const query=(searchInput?.value||"").trim().toLowerCase();
  const visible=cards.filter(card=>{
    const searchable=`${card.dataset.title} ${card.dataset.tags}`.toLowerCase();
    const matchesSearch=!query||searchable.includes(query);
    const matchesTag=activeTag==="all"||card.dataset.tags.split(" ").includes(activeTag);
    card.hidden=!(matchesSearch&&matchesTag);
    return !card.hidden;
  });
  const direction=sortSelect?.value==="oldest"?1:-1;
  visible.sort((a,b)=>a.dataset.date.localeCompare(b.dataset.date)*direction);
  if(grid){
    grid.replaceChildren();
    const monthGroups=new Map();
    visible.forEach(card=>{
      const date=new Date(`${card.dataset.date}T00:00:00`);
      const monthKey=card.dataset.date.slice(0,7);
      if(!monthGroups.has(monthKey)){
        const group=document.createElement("section");
        group.className="month-group";
        const heading=document.createElement("h2");
        heading.className="month-title";
        const monthName=document.createElement("strong");
        monthName.textContent=date.toLocaleDateString(blogLanguage,{month:"long"});
        const year=document.createElement("span");
        year.textContent=date.getFullYear();
        heading.append(monthName,year);
        const list=document.createElement("div");
        list.className="month-posts";
        group.append(heading,list);
        grid.append(group);
        monthGroups.set(monthKey,list);
      }
      monthGroups.get(monthKey).append(card);
    });
  }
  if(emptyState)emptyState.hidden=visible.length!==0;
  if(resultStatus)resultStatus.textContent=blogLanguage==="zh-CN"?`显示 ${visible.length} 篇文章`:`${visible.length} post${visible.length===1?"":"s"} shown`;
}

searchInput?.addEventListener("input",updatePosts);
sortSelect?.addEventListener("change",updatePosts);
tagButtons.forEach(button=>button.addEventListener("click",()=>{
  activeTag=button.dataset.blogTag;
  tagButtons.forEach(item=>{const selected=item===button;item.classList.toggle("is-active",selected);item.setAttribute("aria-pressed",String(selected))});
  updatePosts();
}));
updatePosts();

const toc=document.querySelector("[data-article-toc]");
const articleHeadings=[...document.querySelectorAll(".article-body > h2")];
if(toc&&articleHeadings.length){
  articleHeadings.forEach((heading,index)=>{
    if(!heading.id)heading.id=`section-${index+1}`;
    const link=document.createElement("a");
    link.href=`#${heading.id}`;
    link.textContent=heading.textContent;
    toc.append(link);
  });

  const links=[...toc.querySelectorAll("a")];
  const setActive=id=>links.forEach(link=>link.classList.toggle("is-active",link.hash===`#${id}`));
  const observer=new IntersectionObserver(entries=>{
    const visible=entries.filter(entry=>entry.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top);
    if(visible[0])setActive(visible[0].target.id);
  },{rootMargin:"-10% 0px -72%",threshold:0});
  articleHeadings.forEach(heading=>observer.observe(heading));
  setActive(articleHeadings[0].id);
}
