(()=>{
  const localHosts=new Set(["127.0.0.1","localhost"]);
  if(!localHosts.has(window.location.hostname))return;

  const article=document.querySelector("[data-local-editable-root],.article-body");
  const articleTitle=document.querySelector(".post-header h1");
  if(!article||!articleTitle)return;

  const isChinese=document.documentElement.lang.toLowerCase().startsWith("zh");
  const labels=isChinese?{
    edit:"编辑文章",add:"＋ 下方添加段落",image:"插入图片",remove:"删除本段",save:"保存到 HTML",cancel:"取消",
    connected:"本地编辑器已连接",select:"先点击要编辑的位置",dirty:"有未保存修改",selected:"已选中一段",
    insert:"已选择插入位置",titleSelected:"已选中文章标题",placeholder:"在这里输入新段落",confirmDelete:"删除当前整段文字吗？保存前仍可点击“取消”恢复。",
    selectParagraph:"请先点击要删除的正文段落",
    imageDescription:"请输入图片说明（也会作为图片的替代文本）",uploading:"正在上传图片…",uploadFailed:"图片上传失败",imageTooLarge:"图片不能超过 10 MB",
    emptyTitle:"文章标题不能为空",saving:"正在保存…",saved:"已保存到 HTML",failed:"保存失败",discard:"放弃尚未保存的修改吗？",
  }:{
    edit:"Edit article",add:"＋ Add paragraph below",image:"Insert image",remove:"Delete paragraph",save:"Save to HTML",cancel:"Cancel",
    connected:"Local editor connected",select:"Select text to edit",dirty:"Unsaved changes",selected:"Paragraph selected",
    insert:"Insertion point selected",titleSelected:"Article title selected",placeholder:"Write the new paragraph here",confirmDelete:"Delete this paragraph? You can still cancel before saving.",
    selectParagraph:"Select the paragraph you want to delete first",
    imageDescription:"Image caption (also used as alternative text)",uploading:"Uploading image…",uploadFailed:"Image upload failed",imageTooLarge:"Images cannot exceed 10 MB",
    emptyTitle:"The article title cannot be empty",saving:"Saving…",saved:"Saved to HTML",failed:"Save failed",discard:"Discard unsaved changes?",
  };

  const createToolbar=()=>{
    const element=document.createElement("div");
    element.className="local-editor-toolbar";
    element.dataset.localEditor="";
    element.hidden=true;
    element.innerHTML=`
      <button type="button" data-local-editor-edit>${labels.edit}</button>
      <button type="button" data-local-editor-add hidden>${labels.add}</button>
      <button type="button" data-local-editor-image hidden>${labels.image}</button>
      <button type="button" data-local-editor-delete hidden disabled>${labels.remove}</button>
      <button type="button" data-local-editor-save hidden>${labels.save}</button>
      <button type="button" data-local-editor-cancel hidden>${labels.cancel}</button>
      <span class="local-editor-status" data-local-editor-status aria-live="polite"></span>`;
    document.body.append(element);
    return element;
  };

  const toolbar=document.querySelector("[data-local-editor]")||createToolbar();
  const editButton=toolbar?.querySelector("[data-local-editor-edit]");
  const addButton=toolbar?.querySelector("[data-local-editor-add]");
  let imageButton=toolbar?.querySelector("[data-local-editor-image]");
  if(toolbar&&!imageButton){
    imageButton=document.createElement("button");
    imageButton.type="button";
    imageButton.dataset.localEditorImage="";
    imageButton.textContent=labels.image;
    imageButton.hidden=true;
    toolbar.querySelector("[data-local-editor-delete]")?.before(imageButton);
  }
  const deleteButton=toolbar?.querySelector("[data-local-editor-delete]");
  const saveButton=toolbar?.querySelector("[data-local-editor-save]");
  const cancelButton=toolbar?.querySelector("[data-local-editor-cancel]");
  const status=toolbar?.querySelector("[data-local-editor-status]");
  if(!toolbar||!editButton||!addButton||!imageButton||!deleteButton||!saveButton||!cancelButton||!status)return;

  const imageInput=document.createElement("input");
  imageInput.type="file";
  imageInput.accept="image/png,image/jpeg,image/gif,image/webp";
  imageInput.hidden=true;
  document.body.append(imageInput);

  let editing=false;
  let dirty=false;
  let activeTarget=null;

  const setStatus=(message,state="")=>{
    status.textContent=message;
    status.dataset.state=state;
  };

  const editableTargets=()=>{
    const candidates=[...article.querySelectorAll("p,h2,h3,li,td,th,caption,figcaption,summary,pre code,.article-callout")]
      .filter(element=>!element.closest(".article-end"));
    return candidates.filter(element=>!candidates.some(other=>other!==element&&element.contains(other)));
  };

  const markDirty=()=>{
    if(!editing)return;
    dirty=true;
    setStatus(labels.dirty);
  };

  const pastePlainText=event=>{
    event.preventDefault();
    const clipboardText=event.clipboardData?.getData("text/plain")||"";
    const plainText=event.currentTarget===articleTitle?clipboardText.replace(/\s+/g," "):clipboardText;
    document.execCommand("insertText",false,plainText);
  };

  const prepareEditable=element=>{
    element.contentEditable="true";
    element.spellcheck=true;
    element.dataset.localEditable="";
    element.addEventListener("paste",pastePlainText);
  };

  const topLevelBlock=element=>{
    let block=element;
    while(block&&block.parentElement!==article)block=block.parentElement;
    return block&&block!==article.querySelector(":scope > .article-end")?block:null;
  };

  const selectTarget=element=>{
    document.querySelectorAll("[data-local-editor-active]").forEach(item=>item.removeAttribute("data-local-editor-active"));
    activeTarget=element?.closest?.("[data-local-editable]")||null;
    if(activeTarget)activeTarget.dataset.localEditorActive="";
    if(!dirty&&activeTarget){
      if(activeTarget===articleTitle)setStatus(labels.titleSelected);
      else setStatus(activeTarget.tagName==="P"?labels.selected:labels.insert);
    }
  };

  const focusAndSelect=element=>{
    element.focus();
    const selection=window.getSelection();
    const range=document.createRange();
    range.selectNodeContents(element);
    selection.removeAllRanges();
    selection.addRange(range);
  };

  const startEditing=()=>{
    editing=true;
    dirty=false;
    document.documentElement.classList.add("local-editing");
    prepareEditable(articleTitle);
    editableTargets().forEach(prepareEditable);
    editButton.hidden=true;
    addButton.hidden=false;
    imageButton.hidden=false;
    deleteButton.hidden=false;
    deleteButton.disabled=false;
    saveButton.hidden=false;
    cancelButton.hidden=false;
    setStatus(labels.select);
    article.querySelector("p")?.focus();
  };

  const addParagraph=()=>{
    if(!editing)return;
    const paragraph=document.createElement("p");
    paragraph.textContent=labels.placeholder;
    const anchor=topLevelBlock(activeTarget);
    const articleEnd=article.querySelector(":scope > .article-end");
    if(anchor)anchor.after(paragraph);
    else article.insertBefore(paragraph,articleEnd);
    prepareEditable(paragraph);
    selectTarget(paragraph);
    focusAndSelect(paragraph);
    markDirty();
  };

  const readImage=()=>new Promise((resolve,reject)=>{
    const file=imageInput.files?.[0];
    if(!file){
      resolve(null);
      return;
    }
    if(file.size>10*1024*1024){
      reject(new Error(labels.imageTooLarge));
      return;
    }
    const reader=new FileReader();
    reader.addEventListener("load",()=>resolve({file,data:reader.result}),{once:true});
    reader.addEventListener("error",()=>reject(new Error(labels.uploadFailed)),{once:true});
    reader.readAsDataURL(file);
  });

  const insertImage=async()=>{
    if(!editing)return;
    let selected;
    try{
      selected=await readImage();
      if(!selected)return;
      const fallbackCaption=selected.file.name.replace(/\.[^.]+$/,"")||"image";
      const requestedCaption=window.prompt(labels.imageDescription,fallbackCaption);
      const captionText=(requestedCaption===null?fallbackCaption:requestedCaption.trim())||fallbackCaption;
      imageButton.disabled=true;
      saveButton.disabled=true;
      setStatus(labels.uploading);
      const response=await fetch("/__local_editor/upload-image",{
        method:"POST",
        headers:{"Content-Type":"application/json","X-Local-Editor":"1"},
        body:JSON.stringify({
          page_path:window.location.pathname,
          filename:selected.file.name,
          image_data:selected.data,
        }),
      });
      const result=await response.json().catch(()=>({}));
      if(!response.ok||!result.src)throw new Error(result.error||`${labels.uploadFailed}（${response.status}）`);

      const figure=document.createElement("figure");
      figure.className="paper-figure";
      const link=document.createElement("a");
      link.className="paper-figure-link";
      link.href=result.src;
      link.target="_blank";
      link.rel="noreferrer";
      const image=document.createElement("img");
      image.src=result.src;
      image.alt=captionText;
      image.loading="lazy";
      const hint=document.createElement("span");
      hint.textContent=isChinese?"查看原图":"View full size";
      const caption=document.createElement("figcaption");
      caption.textContent=captionText;
      link.append(image,hint);
      figure.append(link,caption);

      const anchor=topLevelBlock(activeTarget);
      const articleEnd=article.querySelector(":scope > .article-end");
      if(anchor)anchor.after(figure);
      else if(articleEnd)article.insertBefore(figure,articleEnd);
      else article.append(figure);
      prepareEditable(caption);
      selectTarget(caption);
      focusAndSelect(caption);
      markDirty();
    }catch(error){
      setStatus(error.message||labels.uploadFailed,"error");
    }finally{
      imageInput.value="";
      imageButton.disabled=false;
      saveButton.disabled=false;
    }
  };

  const deleteParagraph=()=>{
    if(!editing)return;
    if(activeTarget?.tagName!=="P"){
      setStatus(labels.selectParagraph,"error");
      return;
    }
    if(!window.confirm(labels.confirmDelete))return;
    const paragraph=activeTarget;
    const fallback=paragraph.previousElementSibling||paragraph.nextElementSibling;
    paragraph.remove();
    selectTarget(fallback?.matches?.("[data-local-editable]")?fallback:null);
    markDirty();
  };

  const serializableArticle=()=>{
    const clone=article.cloneNode(true);
    clone.querySelectorAll("[contenteditable],[spellcheck],[data-local-editable],[data-local-editor-active]").forEach(element=>{
      element.removeAttribute("contenteditable");
      element.removeAttribute("spellcheck");
      element.removeAttribute("data-local-editable");
      element.removeAttribute("data-local-editor-active");
    });
    clone.querySelectorAll(":scope > h2[id^='section-']").forEach(heading=>heading.removeAttribute("id"));
    clone.querySelectorAll("details[open]").forEach(details=>details.removeAttribute("open"));
    clone.querySelectorAll("figure.paper-figure").forEach(figure=>{
      const image=figure.querySelector("img");
      const caption=figure.querySelector("figcaption");
      if(image&&caption)image.alt=caption.textContent.trim();
    });
    return clone.outerHTML;
  };

  const saveArticle=async()=>{
    if(!editing)return;
    const title=articleTitle.textContent.replace(/\s+/g," ").trim();
    if(!title){
      setStatus(labels.emptyTitle,"error");
      articleTitle.focus();
      return;
    }
    saveButton.disabled=true;
    cancelButton.disabled=true;
    addButton.disabled=true;
    imageButton.disabled=true;
    deleteButton.disabled=true;
    setStatus(labels.saving);
    try{
      const response=await fetch("/__local_editor/save",{
        method:"POST",
        headers:{"Content-Type":"application/json","X-Local-Editor":"1"},
        body:JSON.stringify({page_path:window.location.pathname,article_title:title,article_html:serializableArticle()}),
      });
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(result.error||`保存失败（${response.status}）`);
      dirty=false;
      setStatus(labels.saved,"saved");
      window.setTimeout(()=>window.location.reload(),450);
    }catch(error){
      setStatus(error.message||labels.failed,"error");
      saveButton.disabled=false;
      cancelButton.disabled=false;
      addButton.disabled=false;
      imageButton.disabled=false;
      deleteButton.disabled=false;
    }
  };

  const cancelEditing=()=>{
    if(dirty&&!window.confirm(labels.discard))return;
    window.location.reload();
  };

  editButton.addEventListener("click",startEditing);
  addButton.addEventListener("click",addParagraph);
  imageButton.addEventListener("click",()=>imageInput.click());
  imageInput.addEventListener("change",insertImage);
  deleteButton.addEventListener("click",deleteParagraph);
  saveButton.addEventListener("click",saveArticle);
  cancelButton.addEventListener("click",cancelEditing);
  article.addEventListener("input",markDirty);
  articleTitle.addEventListener("input",markDirty);
  articleTitle.addEventListener("focusin",event=>{
    if(editing)selectTarget(event.target);
  });
  articleTitle.addEventListener("keydown",event=>{
    if(editing&&event.key==="Enter")event.preventDefault();
  });
  article.addEventListener("focusin",event=>{
    if(editing)selectTarget(event.target);
  });
  article.addEventListener("keydown",event=>{
    if(!editing||event.key!=="Enter"||event.target.closest("pre code"))return;
    event.preventDefault();
    document.execCommand("insertLineBreak");
  });
  window.addEventListener("keydown",event=>{
    if(!editing||!(event.metaKey||event.ctrlKey)||event.key.toLowerCase()!=="s")return;
    event.preventDefault();
    saveArticle();
  });
  window.addEventListener("beforeunload",event=>{
    if(!dirty)return;
    event.preventDefault();
    event.returnValue="";
  });

  fetch("/__local_editor/status",{
    cache:"no-store",
    headers:{"X-Local-Editor":"1"},
  }).then(response=>{
    if(!response.ok)throw new Error("not connected");
    toolbar.hidden=false;
    setStatus(labels.connected);
  }).catch(()=>{
    toolbar.hidden=true;
  });
})();
