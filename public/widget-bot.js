// PandaWiki 问答机器人挂件 - 莫兰迪色系
(function() {
  if (window.pandaBotInitialized) return;
  window.pandaBotInitialized = true;

  const BRAND = '#D4A0A8';
  const BRAND_DARK = '#C48E96';
  const ACCENT = '#A8B8A8';
  const ACCENT_DARK = '#94A694';
  const BG = '#F7F4F2';
  const BG_WINDOW = '#FFFFFF';
  const TEXT_PRIMARY = '#3D3533';
  const TEXT_SECONDARY = '#8A7E7A';
  const BORDER = '#E8E2DE';
  const BOT_BUBBLE = '#EEEAE7';
  const USER_BUBBLE = '#D4A0A8';
  const ONLINE = '#A8B8A8';
  const SHADOW = 'rgba(61, 53, 51, 0.08)';
  const SHADOW_HOVER = 'rgba(61, 53, 51, 0.12)';

  const icons = {
    send: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
    </svg>`,
    
    close: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
    </svg>`,
    
    summary: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
      <path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"/>
    </svg>`,
    
    points: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
    </svg>`,
    
    audience: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
    </svg>`
  };

  const widget = document.createElement('div');
  widget.className = 'panda-bot-widget';
  widget.style.position = 'fixed';
  widget.style.bottom = '30px';
  widget.style.right = '30px';
  widget.style.zIndex = '99999';
  widget.style.fontFamily = '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif';
  widget.style.transform = 'none';
  widget.style.float = 'none';
  document.body.appendChild(widget);

  const btn = document.createElement('button');
  btn.id = 'panda-bot-btn';
  btn.className = 'panda-bot-btn';
  btn.style.width = '56px';
  btn.style.height = '56px';
  btn.style.background = 'linear-gradient(135deg, ' + BRAND + ', ' + BRAND_DARK + ')';
  btn.style.borderRadius = '50%';
  btn.style.border = 'none';
  btn.style.cursor = 'pointer';
  btn.style.display = 'flex';
  btn.style.alignItems = 'center';
  btn.style.justifyContent = 'center';
  btn.style.boxShadow = '0 4px 20px ' + SHADOW;
  btn.style.transition = 'all 0.3s ease';
  btn.style.padding = '0';
  
  const btnImg = document.createElement('img');
  btnImg.src = '/bot-logo.svg';
  btnImg.alt = 'Logo';
  btnImg.style.width = '30px';
  btnImg.style.height = '30px';
  btn.appendChild(btnImg);
  widget.appendChild(btn);

  const windowEl = document.createElement('div');
  windowEl.id = 'panda-bot-window';
  windowEl.className = 'panda-bot-window';
  windowEl.style.display = 'none';
  windowEl.style.position = 'fixed';
  windowEl.style.bottom = '80px';
  windowEl.style.right = '30px';
  windowEl.style.width = '420px';
  windowEl.style.height = '700px';
  windowEl.style.background = BG_WINDOW;
  windowEl.style.borderRadius = '28px';
  windowEl.style.boxShadow = '0 20px 50px ' + SHADOW;
  windowEl.style.overflow = 'hidden';
  windowEl.style.flexDirection = 'column';
  windowEl.style.zIndex = '99998';
  windowEl.style.transform = 'none';
  widget.appendChild(windowEl);

  const header = document.createElement('div');
  header.className = 'panda-bot-header';
  header.style.padding = '18px 22px';
  header.style.display = 'flex';
  header.style.alignItems = 'center';
  header.style.justifyContent = 'space-between';
  header.style.background = BG;
  header.style.borderBottom = '1px solid ' + BORDER;
  header.style.flexShrink = '0';
  windowEl.appendChild(header);

  const headerLeft = document.createElement('div');
  headerLeft.style.display = 'flex';
  headerLeft.style.alignItems = 'center';
  headerLeft.style.gap = '14px';
  header.appendChild(headerLeft);

  const logoImg = document.createElement('img');
  logoImg.src = '/bot-logo.svg';
  logoImg.alt = 'Logo';
  logoImg.style.width = '44px';
  logoImg.style.height = '44px';
  logoImg.style.borderRadius = '12px';
  headerLeft.appendChild(logoImg);

  const headerInfo = document.createElement('div');
  headerLeft.appendChild(headerInfo);

  const title = document.createElement('h3');
  title.textContent = '问答机器人';
  title.style.margin = '0';
  title.style.fontSize = '17px';
  title.style.fontWeight = '500';
  title.style.color = TEXT_PRIMARY;
  title.style.writingMode = 'horizontal-tb';
  title.style.transform = 'none';
  headerInfo.appendChild(title);

  const status = document.createElement('div');
  status.style.display = 'flex';
  status.style.alignItems = 'center';
  status.style.gap = '6px';
  status.style.marginTop = '2px';
  headerInfo.appendChild(status);

  const statusDot = document.createElement('span');
  statusDot.style.width = '8px';
  statusDot.style.height = '8px';
  statusDot.style.background = ONLINE;
  statusDot.style.borderRadius = '50%';
  status.appendChild(statusDot);

  const statusText = document.createElement('span');
  statusText.textContent = '在线';
  statusText.style.fontSize = '12px';
  statusText.style.color = TEXT_SECONDARY;
  status.appendChild(statusText);

  const closeBtn = document.createElement('button');
  closeBtn.id = 'panda-bot-close';
  closeBtn.className = 'panda-bot-close';
  closeBtn.style.background = 'transparent';
  closeBtn.style.border = 'none';
  closeBtn.style.color = TEXT_SECONDARY;
  closeBtn.style.cursor = 'pointer';
  closeBtn.style.padding = '6px';
  closeBtn.style.width = '32px';
  closeBtn.style.height = '32px';
  closeBtn.style.display = 'flex';
  closeBtn.style.alignItems = 'center';
  closeBtn.style.justifyContent = 'center';
  closeBtn.style.borderRadius = '50%';
  closeBtn.style.transition = 'background 0.2s';
  closeBtn.innerHTML = icons.close;
  header.appendChild(closeBtn);

  const messages = document.createElement('div');
  messages.id = 'panda-bot-messages';
  messages.className = 'panda-bot-messages';
  messages.style.flex = '1';
  messages.style.overflowY = 'auto';
  messages.style.padding = '20px';
  messages.style.background = BG;
  windowEl.appendChild(messages);

  const emptyState = document.createElement('div');
  emptyState.id = 'panda-bot-empty-state';
  emptyState.className = 'panda-bot-empty-state';
  emptyState.style.display = 'flex';
  emptyState.style.flexDirection = 'column';
  emptyState.style.alignItems = 'center';
  emptyState.style.justifyContent = 'center';
  emptyState.style.height = '100%';
  emptyState.style.padding = '40px';
  emptyState.style.textAlign = 'center';
  messages.appendChild(emptyState);

  const emptyLogo = document.createElement('img');
  emptyLogo.src = '/bot-logo.svg';
  emptyLogo.alt = 'Logo';
  emptyLogo.style.width = '72px';
  emptyLogo.style.height = '72px';
  emptyLogo.style.marginBottom = '18px';
  emptyState.appendChild(emptyLogo);

  const emptyTitle = document.createElement('h4');
  emptyTitle.textContent = '你好！我是问答机器人';
  emptyTitle.style.margin = '0 0 6px 0';
  emptyTitle.style.fontSize = '17px';
  emptyTitle.style.fontWeight = '500';
  emptyTitle.style.color = TEXT_PRIMARY;
  emptyState.appendChild(emptyTitle);

  const emptyDesc = document.createElement('p');
  emptyDesc.textContent = '有什么可以帮助你的吗？试试点击下方按钮';
  emptyDesc.style.margin = '0 0 24px 0';
  emptyDesc.style.fontSize = '14px';
  emptyDesc.style.color = TEXT_SECONDARY;
  emptyDesc.style.lineHeight = '1.6';
  emptyState.appendChild(emptyDesc);

  const quickActions = document.createElement('div');
  quickActions.className = 'panda-bot-quick-actions';
  quickActions.style.display = 'flex';
  quickActions.style.flexDirection = 'column';
  quickActions.style.gap = '10px';
  quickActions.style.width = '100%';
  emptyState.appendChild(quickActions);

  const quickBtnsData = [
    { action: '帮我总结要点', icon: icons.summary },
    { action: '提取关键信息', icon: icons.points },
    { action: '这篇文章适合谁', icon: icons.audience }
  ];

  const quickBtns = [];
  quickBtnsData.forEach(item => {
    const btnEl = document.createElement('button');
    btnEl.className = 'panda-bot-quick-btn';
    btnEl.dataset.action = item.action;
    btnEl.style.padding = '12px 16px';
    btnEl.style.border = '1.5px solid ' + BORDER;
    btnEl.style.background = BG_WINDOW;
    btnEl.style.borderRadius = '16px';
    btnEl.style.cursor = 'pointer';
    btnEl.style.fontSize = '14px';
    btnEl.style.color = TEXT_PRIMARY;
    btnEl.style.transition = 'all 0.2s';
    btnEl.style.textAlign = 'left';
    btnEl.style.display = 'flex';
    btnEl.style.alignItems = 'center';
    btnEl.style.gap = '10px';
    btnEl.innerHTML = item.icon + ' ' + item.action;
    quickActions.appendChild(btnEl);
    quickBtns.push(btnEl);
  });

  const inputArea = document.createElement('div');
  inputArea.className = 'panda-bot-input-area';
  inputArea.style.padding = '14px 20px';
  inputArea.style.background = BG_WINDOW;
  inputArea.style.borderTop = '1px solid ' + BORDER;
  inputArea.style.flexShrink = '0';
  windowEl.appendChild(inputArea);

  const textareaWrapper = document.createElement('div');
  textareaWrapper.className = 'panda-bot-textarea-wrapper';
  textareaWrapper.style.display = 'flex';
  textareaWrapper.style.gap = '10px';
  textareaWrapper.style.alignItems = 'flex-end';
  inputArea.appendChild(textareaWrapper);

  const textarea = document.createElement('textarea');
  textarea.id = 'panda-bot-textarea';
  textarea.className = 'panda-bot-textarea';
  textarea.placeholder = '输入你的问题...';
  textarea.rows = 1;
  textarea.style.flex = '1';
  textarea.style.padding = '12px 16px';
  textarea.style.border = '1.5px solid ' + BORDER;
  textarea.style.borderRadius = '18px';
  textarea.style.fontSize = '14px';
  textarea.style.lineHeight = '1.5';
  textarea.style.outline = 'none';
  textarea.style.resize = 'none';
  textarea.style.transition = 'all 0.2s';
  textarea.style.maxHeight = '140px';
  textarea.style.minHeight = '44px';
  textarea.style.fontFamily = 'inherit';
  textarea.style.background = BG;
  textarea.style.color = TEXT_PRIMARY;
  textareaWrapper.appendChild(textarea);

  const sendBtn = document.createElement('button');
  sendBtn.id = 'panda-bot-send';
  sendBtn.className = 'panda-bot-send';
  sendBtn.disabled = true;
  sendBtn.style.width = '42px';
  sendBtn.style.height = '42px';
  sendBtn.style.background = BRAND;
  sendBtn.style.border = 'none';
  sendBtn.style.borderRadius = '50%';
  sendBtn.style.color = 'white';
  sendBtn.style.cursor = 'pointer';
  sendBtn.style.display = 'flex';
  sendBtn.style.alignItems = 'center';
  sendBtn.style.justifyContent = 'center';
  sendBtn.style.transition = 'all 0.2s';
  sendBtn.style.flexShrink = '0';
  sendBtn.innerHTML = icons.send;
  textareaWrapper.appendChild(sendBtn);

  const knowledgeBase = {
    '你好': '你好！有什么可以帮助你的吗？',
    '你是谁': '我是问答机器人，专门为知识分享平台服务！',
    '帮助': '我可以帮助你了解笔记系统的使用方法、搜索笔记、解答常见问题等。',
    '笔记': '笔记是记录知识的重要工具，可以帮助你整理和回顾学习内容。',
    '登录': '请在首页输入账号和密码进行登录。',
    '注册': '目前暂不支持自主注册，请联系管理员获取账号。',
    '搜索': '使用顶部搜索框可以搜索笔记的标题、内容和标签。',
    '分类': '笔记可以按过程组分类：启动、规划、执行、监控、收尾。',
    '难度': '笔记难度分为初级、中级和高级，帮助你了解学习难度。',
    '考试': '考试模式可以查看高频考点、过程组分布和掌握度等信息。',
    '历史': '历史记录功能可以查看你最近浏览的笔记。',
    '设置': '设置面板可以调整字体大小、主题颜色等个性化选项。',
    '评论': '你可以在笔记详情页发表评论和交流学习心得。',
    '有用': '觉得笔记有帮助可以点击「有用」按钮支持作者。',
    '欢迎': '欢迎使用知识分享平台！祝你学习愉快！',
    '谢谢': '不客气！如果还有其他问题，随时可以问我。',
    '再见': '再见！期待下次为你服务！',
    '总结': '我可以帮你总结文章的核心内容，让你快速了解重点。',
    '帮我总结要点': '这篇文章主要讲述了项目管理的核心知识，包括五大过程组和十大知识领域。通过系统化的管理方法，可以有效提高项目成功率。',
    '提取关键信息': '核心要点：\n1. 项目管理五大过程组：启动、规划、执行、监控、收尾\n2. 十大知识领域：整合、范围、进度、成本、质量、资源、沟通、风险、采购、相关方\n3. 关键成功因素：明确目标、有效沟通、风险管理',
    '这篇文章适合谁': '这篇文章适合：\n- 正在学习系统集成项目管理的学员\n- 准备软考中级考试的考生\n- 从事IT项目管理的职场人士\n- 对项目管理感兴趣的初学者',
    '关键信息': '关键信息包括：项目背景、核心目标、主要方法、预期成果等。'
  };

  const defaultReplies = [
    '这个问题很有趣！让我想想...',
    '我不太确定，让我查一下资料...',
    '抱歉，我还在学习中，这个问题暂时无法回答。',
    '你可以尝试搜索相关笔记获取更多信息。',
    '这个问题超出了我的知识库范围，但我会继续学习！'
  ];

  function getAnswer(question) {
    const lowerQ = question.toLowerCase().trim();
    for (const [key, answer] of Object.entries(knowledgeBase)) {
      if (lowerQ.includes(key.toLowerCase())) {
        return answer;
      }
    }
    return defaultReplies[Math.floor(Math.random() * defaultReplies.length)];
  }

  function addMessage(text, isUser) {
    if (emptyState) emptyState.style.display = 'none';
    
    const message = document.createElement('div');
    message.className = 'panda-bot-message ' + (isUser ? 'user' : 'bot');
    message.style.marginBottom = '14px';
    message.style.maxWidth = '85%';
    message.style.textAlign = isUser ? 'right' : 'left';
    if (isUser) message.style.marginLeft = 'auto';
    
    const content = document.createElement('div');
    content.style.display = 'inline-block';
    content.style.padding = '12px 16px';
    content.style.borderRadius = isUser ? '18px 6px 18px 18px' : '6px 18px 18px 18px';
    content.style.fontSize = '14px';
    content.style.lineHeight = '1.65';
    content.style.wordWrap = 'break-word';
    
    if (isUser) {
      content.style.background = USER_BUBBLE;
      content.style.color = 'white';
    } else {
      content.style.background = BOT_BUBBLE;
      content.style.color = TEXT_PRIMARY;
    }
    
    content.innerHTML = text.replace(/\n/g, '<br>');
    message.appendChild(content);
    messages.appendChild(message);
    messages.scrollTop = messages.scrollHeight;
  }

  function addTyping() {
    if (emptyState) emptyState.style.display = 'none';
    
    const typing = document.createElement('div');
    typing.className = 'panda-bot-message bot';
    typing.id = 'panda-bot-typing';
    typing.style.marginBottom = '14px';
    typing.style.maxWidth = '85%';
    typing.style.textAlign = 'left';
    
    const typingContent = document.createElement('div');
    typingContent.style.display = 'inline-flex';
    typingContent.style.alignItems = 'center';
    typingContent.style.gap = '6px';
    typingContent.style.padding = '12px 16px';
    typingContent.style.background = BOT_BUBBLE;
    typingContent.style.borderRadius = '6px 18px 18px 18px';
    
    for (let i = 0; i < 3; i++) {
      const dot = document.createElement('div');
      dot.style.width = '7px';
      dot.style.height = '7px';
      dot.style.background = ACCENT;
      dot.style.borderRadius = '50%';
      dot.style.animation = 'typingDot 1.4s infinite ease-in-out';
      if (i > 0) dot.style.animationDelay = (i * 0.2) + 's';
      typingContent.appendChild(dot);
    }
    
    typing.appendChild(typingContent);
    messages.appendChild(typing);
    messages.scrollTop = messages.scrollHeight;
    return typing;
  }

  function removeTyping() {
    const typing = document.getElementById('panda-bot-typing');
    if (typing) typing.remove();
  }

  async function sendMessage() {
    const text = textarea.value.trim();
    if (!text) return;

    addMessage(text, true);
    
    textarea.value = '';
    textarea.style.height = '44px';
    updateSendButton();

    const typingElement = addTyping();

    await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 600));

    removeTyping();

    const answer = getAnswer(text);
    addMessage(answer, false);
  }

  function updateSendButton() {
    sendBtn.disabled = !textarea.value.trim();
    sendBtn.style.opacity = sendBtn.disabled ? '0.45' : '1';
    sendBtn.style.cursor = sendBtn.disabled ? 'not-allowed' : 'pointer';
  }

  function autoResizeTextarea() {
    textarea.style.height = '44px';
    const scrollHeight = textarea.scrollHeight;
    const maxHeight = 140;
    textarea.style.height = Math.min(scrollHeight, maxHeight) + 'px';
    updateSendButton();
  }

  function toggleWindow() {
    const isHidden = windowEl.style.display === 'none';
    windowEl.style.display = isHidden ? 'flex' : 'none';
    if (isHidden) {
      setTimeout(() => textarea.focus(), 100);
    }
  }

  btn.addEventListener('click', toggleWindow);
  closeBtn.addEventListener('click', toggleWindow);
  sendBtn.addEventListener('click', sendMessage);
  textarea.addEventListener('input', autoResizeTextarea);
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  quickBtns.forEach(btnEl => {
    btnEl.addEventListener('click', () => {
      textarea.value = btnEl.dataset.action;
      autoResizeTextarea();
      textarea.focus();
    });
    btnEl.addEventListener('mouseenter', () => {
      btnEl.style.background = BRAND;
      btnEl.style.color = 'white';
      btnEl.style.borderColor = BRAND;
    });
    btnEl.addEventListener('mouseleave', () => {
      btnEl.style.background = BG_WINDOW;
      btnEl.style.color = TEXT_PRIMARY;
      btnEl.style.borderColor = BORDER;
    });
  });

  document.addEventListener('click', (e) => {
    if (!widget.contains(e.target) && windowEl.style.display === 'flex') {
      toggleWindow();
    }
  });

  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
    @keyframes botPulse {
      0%, 100% { box-shadow: 0 4px 20px ${SHADOW}; transform: scale(1); }
      50% { box-shadow: 0 6px 28px ${SHADOW_HOVER}; transform: scale(1.04); }
    }
    @keyframes typingDot {
      0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
      40% { transform: scale(1); opacity: 1; }
    }
    .panda-bot-btn { animation: botPulse 2.5s ease-in-out infinite; }
    .panda-bot-btn:hover { transform: scale(1.08) !important; box-shadow: 0 6px 28px ${SHADOW_HOVER} !important; }
    .panda-bot-close:hover { background: ${BG} !important; color: ${TEXT_PRIMARY} !important; }
    .panda-bot-send:hover:not(:disabled) { transform: scale(1.08); box-shadow: 0 4px 14px rgba(212, 160, 168, 0.35); }
    .panda-bot-send:active:not(:disabled) { transform: scale(0.96); }
    .panda-bot-textarea:focus { border-color: ${BRAND} !important; background: ${BG_WINDOW} !important; }
    .panda-bot-textarea::placeholder { color: ${TEXT_SECONDARY}; }
    .panda-bot-messages::-webkit-scrollbar { width: 5px; }
    .panda-bot-messages::-webkit-scrollbar-track { background: transparent; }
    .panda-bot-messages::-webkit-scrollbar-thumb { background: ${ACCENT}; border-radius: 3px; }
    .panda-bot-messages::-webkit-scrollbar-thumb:hover { background: ${ACCENT_DARK}; }
    @media (max-width: 480px) {
      .panda-bot-widget { bottom: 20px !important; right: 20px !important; }
      .panda-bot-btn { width: 52px !important; height: 52px !important; }
      .panda-bot-window { width: calc(100vw - 40px) !important; height: calc(100vh - 110px) !important; right: 10px !important; border-radius: 24px !important; }
    }
  `;
  document.head.appendChild(styleSheet);

  console.log('🌸 问答机器人挂件加载成功！');
})();
