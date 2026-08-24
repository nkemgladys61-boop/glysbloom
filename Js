const urlParams = new URLSearchParams(window.location.search);
const isAdmin = urlParams.get('admin') === 'true';

let BOOKS_DATA = []; // will load from json
let currentBook = null, currentChapter = 0, currentPage = 0, currentBookKey = '';

// THEME
document.getElementById('themeToggle').onclick = () => {
  const theme = document.body.getAttribute('data-theme') === 'light'? 'dark' : 'light';
  document.body.setAttribute('data-theme', theme);
  localStorage.setItem('glysTheme', theme);
  document.getElementById('themeToggle').textContent = theme === 'light'? '🌙 Dark' : '☀️ Light';
}
document.body.setAttribute('data-theme', localStorage.getItem('glysTheme') || 'dark');

// SHOW ANALYTICS BUTTON ONLY FOR ADMIN
if(isAdmin) document.getElementById('analyticsBtn').classList.remove('hidden');

// NAVIGATION
document.getElementById('enterBtn').onclick = () => {
  document.getElementById('landing').classList.add('hidden');
  document.getElementById('main').classList.remove('hidden');
  loadBooksFromJSON(); // Load from JSON
}
document.getElementById('analyticsBtn').onclick = () => showAnalytics();

// LOAD BOOKS FROM books.json
async function loadBooksFromJSON() {
  try {
    const res = await fetch('books.json');
    BOOKS_DATA = await res.json();
    renderLibrary();
  } catch(e) {
    document.getElementById('bookList').innerHTML = "Error: books.json not found. Upload it.";
  }
}

function renderLibrary() {
  const bookList = document.getElementById('bookList');
  bookList.innerHTML = '';
  if(BOOKS_DATA.length === 0) bookList.innerHTML = '<p>No books yet. Add to books.json</p>';
  BOOKS_DATA.forEach(book => {
    const views = localStorage.getItem(`views_${book.id}`) || 0;
    bookList.innerHTML += `
      <div class="book-card">
        <img src="${book.cover}" class="book-cover" alt="${book.title}">
        <div class="book-info">
          <h3>${book.title}</h3>
          <p class="blurb">${book.blurb}</p>
          <p>👁️ Views: ${views}</p>
          <button onclick="openBook('${book.id}')" class="btn-primary">Read Now</button>
        </div>
      </div>`;
  });
}

async function openBook(key) {
  currentBookKey = key;
  currentBook = BOOKS_DATA.find(b => b.id === key);

  if(!isAdmin) {
    let v = parseInt(localStorage.getItem(`views_${key}`) || 0) + 1;
    localStorage.setItem(`views_${key}`, v);
  }

  document.getElementById('library').classList.add('hidden');
  document.getElementById('bookPage').classList.remove('hidden');
  document.getElementById('bookTitle').textContent = currentBook.title;
  document.getElementById('bookBlurb').textContent = currentBook.blurb;
  document.getElementById('bookCover').src = currentBook.cover;
  document.getElementById('bookViews').textContent = localStorage.getItem(`views_${key}`) || 0;

  const toc = document.getElementById('tocList'); toc.innerHTML = '';
  currentBook.chapters.forEach((ch, i) => {
    toc.innerHTML += `<li onclick="readChapter(${i})">${ch.title}</li>`;
  });

  const saved = localStorage.getItem(`progress_${key}`);
  if(saved){ const [ch, pg] = saved.split('-').map(Number); readChapter(ch, pg); }
}

async function fetchDocContent(url){
  try {
    const res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
    let text = await res.text();
    return text.replace(/---PAGE BREAK---/g, '|');
  } catch(e) {
    return "Error loading Google Doc. Make sure it's 'Anyone with link can view'.";
  }
}

async function readChapter(chIndex, pageIndex = 0){
  currentChapter = chIndex; currentPage = pageIndex;
  if(!isAdmin) {
    let r = parseInt(localStorage.getItem(`reads_${currentBookKey}_${chIndex}`) || 0) + 1;
    localStorage.setItem(`reads_${currentBookKey}_${chIndex}`, r);
  }

  document.getElementById('bookPage').classList.add('hidden');
  document.getElementById('readerPage').classList.remove('hidden');
  document.getElementById('pageContent').innerHTML = 'Loading...';
  await loadPage();
  loadComments();
  saveProgress();
}

async function loadPage(){
  let chapter = currentBook.chapters[currentChapter];
  let content = chapter.content;

  if(chapter.isDocLink) {
    content = await fetchDocContent(content);
  }

  const pages = content.split('|');
  document.getElementById('chapterTitle').textContent = chapter.title;
  document.getElementById('pageContent').innerHTML = `<p>${pages[currentPage] || "End of chapter"}</p>`;
  document.getElementById('pageNum').textContent = `Page ${currentPage + 1} of ${pages.length}`;
  window.scrollTo(0,0);
}

function nextPage(){
  const chapter = currentBook.chapters[currentChapter];
  let content = chapter.isDocLink? chapter._cachedContent : chapter.content;
  if(!content) content = chapter.content;
  const pages = content.split('|').length;
  if(currentPage < pages - 1) currentPage++;
  else if(currentChapter < currentBook.chapters.length - 1){ currentChapter++; currentPage = 0; }
  loadPage(); saveProgress();
}
function prevPage(){
  if(currentPage > 0) currentPage--;
  else if(currentChapter > 0){ currentChapter--; currentPage = 99; } // will fix on load
  loadPage(); saveProgress();
}

function saveProgress(){ localStorage.setItem(`progress_${currentBookKey}`, `${currentChapter}-${currentPage}`); }

document.getElementById('bookmarkBtn').onclick = () => {
  localStorage.setItem(`bookmark_${currentBookKey}`, `${currentChapter}-${currentPage}`);
  alert(`🔖 Bookmarked: ${currentBook.chapters[currentChapter].title} - Page ${currentPage + 1}`);
}

function postComment(){
  const input = document.getElementById('commentInput');
  if(input.value.trim() === '') return;
  const key = `comments_${currentBookKey}_${currentChapter}`;
  let comments = JSON.parse(localStorage.getItem(key) || '[]');
  comments.push({text: input.value, time: new Date().toLocaleDateString()});
  localStorage.setItem(key, JSON.stringify(comments));
  input.value = ''; loadComments();
}

function loadComments(){
  const key = `comments_${currentBookKey}_${currentChapter}`;
  let comments = JSON.parse(localStorage.getItem(key) || '[]');
  document.getElementById('commentList').innerHTML = comments.map(c => `<div class="comment">${c.text} <small>-${c.time}</small></div>`).join('');
}

function shareBook(){
  const url = window.location.href.split('#')[0] + `#book=${currentBookKey}`;
  navigator.clipboard.writeText(url);
  alert('📤 Link copied to clipboard!');
}

function showAnalytics(){
  if(!isAdmin) return alert('Admin only');
  document.getElementById('bookPage').classList.add('hidden');
  document.getElementById('analyticsPage').classList.remove('hidden');
  const views = localStorage.getItem(`views_${currentBookKey}`) || 0;
  document.getElementById('analyticsViews').textContent = views;

  const graph = document.getElementById('analyticsGraph'); graph.innerHTML = '';
  currentBook.chapters.forEach((ch, i) => {
    const reads = localStorage.getItem(`reads_${currentBookKey}_${i}`) || 0;
    const percent = views > 0? (reads / views) * 100 : 0;
    graph.innerHTML += `<p>${ch.title}</p><div class="bar" style="width:${percent}%">${reads}</div>`;
  });
}

function showLibrary(){
  document.getElementById('bookPage').classList.add('hidden');
  document.getElementById('readerPage').classList.add('hidden');
  document.getElementById('analyticsPage').classList.add('hidden');
  document.getElementById('library').classList.remove('hidden');
  renderLibrary();
}
function backToBook(){
  document.getElementById('readerPage').classList.add('hidden');
  document.getElementById('analyticsPage').classList.add('hidden');
  document.getElementById('bookPage').classList.remove('hidden');
}
