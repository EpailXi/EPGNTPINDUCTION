const mainTabs = {
  tab1: 'https://twswzvv3ark.sg.feishu.cn/share/base/form/shrlgPuhdE1BMJp9m35UCE1P2db',
  tab2: 'https://twswzvv3ark.sg.feishu.cn/share/base/query/shrlg51LfM6trGZoyggk5RhyiWy',
  tab3: 'https://twswzvv3ark.sg.feishu.cn/share/base/view/shrlgUmnr3LVMDLPgijDJCwnAXc'
};

const subTabs = {
  subtab1: 'https://twswzvv3ark.sg.feishu.cn/file/RjUib4vWXoiFgcxlctslNW88gAg?from=from_copylink',
  subtab2: 'https://twswzvv3ark.sg.feishu.cn/slides/OzJisWFv9lsTlFdx2XflBdl5gKf?from=from_copylink'
};

const isMobile = /iPhone|iPad|Android|webOS|BlackBerry|Windows Phone/i.test(navigator.userAgent);
const iframe = document.getElementById('frame');
const subtabs = document.getElementById('subtabs');

// Event delegation for main tabs
document.querySelector('.tab-container').addEventListener('click', (e) => {
  if (e.target.tagName === 'BUTTON') {
    document.querySelectorAll('.tab-container button').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');

    const id = e.target.id;

    if (id === 'tab4') {
      subtabs.style.display = 'flex';
      document.getElementById('subtab1').click();
    } else {
      subtabs.style.display = 'none';
      if ((id === 'tab2' || id === 'tab3') && isMobile) {
        iframe.srcdoc = `
          <div style="padding: 2rem; font-family: sans-serif; text-align: center;">
            <p>⚠️ 此功能在手机上可能无法嵌入显示。</p>
            <p><a href="${mainTabs[id]}" target="_blank" style="color: #007bff;">点击此处在新窗口打开</a></p>
          </div>
        `;
      } else {
        iframe.src = mainTabs[id];
      }
    }
  }
});

// Event delegation for sub tabs
document.querySelector('.subnav').addEventListener('click', (e) => {
  if (e.target.tagName === 'BUTTON') {
    document.querySelectorAll('.subnav button').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    iframe.src = subTabs[e.target.id];
  }
});
