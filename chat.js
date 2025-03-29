document.addEventListener("DOMContentLoaded", () => {
  // Check if user is logged in
  const currentUser = JSON.parse(localStorage.getItem("currentUser"))
  if (!currentUser) {
    window.location.href = "index.html"
    return
  }

  document.getElementById("user-name").textContent = currentUser.name
  
  // Handle avatar display
  const avatarElement = document.getElementById("user-initial")
  if (currentUser.isGoogleUser && currentUser.picture) {
    // For Google users, use their profile picture
    avatarElement.style.backgroundImage = `url(${currentUser.picture})`
    avatarElement.style.backgroundSize = 'cover'
    avatarElement.style.backgroundPosition = 'center'
    avatarElement.textContent = ''
    avatarElement.parentElement.style.backgroundColor = 'transparent'
  } else {
    // For regular users, show initial
    avatarElement.textContent = currentUser.name.charAt(0).toUpperCase()
    avatarElement.style.backgroundImage = 'none'
    avatarElement.parentElement.style.backgroundColor = 'var(--primary-color)'
  }

  // Handle Ragie Connect
  const uploadBtn = document.getElementById("upload-btn")
  uploadBtn.addEventListener("click", async () => {
    try {
      // Initialize Ragie Connect
      const response = await fetch('/api/ragie/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: currentUser.id
        })
      });

      if (!response.ok) {
        throw new Error('Failed to initialize Ragie Connect');
      }

      const data = await response.json();
      
      // Redirect to Ragie Connect URL
      window.location.href = data.url;
    } catch (error) {
      console.error('Error initializing Ragie Connect:', error);
      alert('Failed to connect to Ragie. Please try again.');
    }
  });

  // Check for Ragie connection success
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('connection_success') === 'true') {
    showNotification('Successfully connected to Google Drive!');
    window.history.replaceState({}, document.title, '/chat.html');
  }

  // Initialize UI elements
  const messagesContainer = document.getElementById('messages-container');
  const messageInput = document.getElementById('message-input');
  const sendButton = document.getElementById('send-button');
  const searchInput = document.getElementById('search-input');
  const filterTags = document.querySelectorAll('.filter-tag');
  const newChatBtn = document.getElementById('new-chat');
  const logoutBtn = document.getElementById('logout');
  const chatThreadsContainer = document.getElementById('chat-threads');
  const modelSelector = document.getElementById('model-selector');

  // State management
  let threads = [];
  let currentThreadId = null;
  let messages = [];
  let currentFilter = 'all';
  let currentModel = 'llama-3.3-70b-versatile'; // Default model
  
  // State
  let conversationContext = []
  let isProcessing = false

  // Available models
  const availableModels = [
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B' },
    { id: 'llama-3.3-70b-specdec', name: 'Llama 3.3 70B SpecDec' },
    { id: 'mistral-saba-24b', name: 'Mistral Saba 24B' },
    { id: 'qwen-2.5-32b', name: 'Qwen 2.5 32B' },
    { id: 'qwen-qwq-32b', name: 'Qwen QWQ 32B' },
    { id: 'deepseek-r1-distill-qwen-32b', name: 'DeepSeek Qwen 32B' }
  ];

  // Initialize model selector
  function initializeModelSelector() {
    availableModels.forEach(model => {
      const option = document.createElement('option');
      option.value = model.id;
      option.textContent = model.name;
      if (model.id === currentModel) {
        option.selected = true;
      }
      modelSelector.appendChild(option);
    });

    // Load saved model preference
    const savedModel = localStorage.getItem(`selected_model_${currentUser.id}`);
    if (savedModel && availableModels.some(m => m.id === savedModel)) {
      currentModel = savedModel;
      modelSelector.value = savedModel;
    }
  }

  // Load threads from storage
  function loadThreads() {
    const savedThreads = localStorage.getItem(`chat_threads_${currentUser.id}`);
    threads = savedThreads ? JSON.parse(savedThreads) : [];
    
    if (threads.length === 0) {
      // Create initial thread
      createNewThread();
    } else {
      // Load last active thread
      const lastActiveThread = threads.find(t => t.isActive) || threads[0];
      loadThread(lastActiveThread.id);
    }
    
    renderThreads();
  }

  // Save threads to storage
  function saveThreads() {
    localStorage.setItem(`chat_threads_${currentUser.id}`, JSON.stringify(threads));
  }

  // Create a new thread
  function createNewThread() {
    const thread = {
      id: Date.now(),
      title: "New Chat",  
      preview: "Start a new conversation",
      timestamp: new Date(),
      isActive: true,
      isNew: true  // Flag to track if this is a new thread
    };

    // Deactivate other threads
    threads.forEach(t => t.isActive = false);
    
    threads.unshift(thread);
    currentThreadId = thread.id;
    messages = [];
    
    saveThreads();
    saveMessages();
    renderThreads();
    renderMessages();
    
    // initial AI message
    addMessage("Hello! I'm your AI assistant. How can I help you today?", true);
  }

  // Load a specific thread
  function loadThread(threadId) {
    // Update active state for all threads
    threads.forEach(t => t.isActive = t.id === threadId);
    currentThreadId = threadId;
    
    // Load messages for this thread
    const savedMessages = localStorage.getItem(`chat_messages_${currentUser.id}_${threadId}`);
    if (savedMessages) {
      messages = JSON.parse(savedMessages);
      messages.forEach(m => m.timestamp = new Date(m.timestamp));
    } else {
      messages = [];
    }
    
    saveThreads();
    renderThreads(); // Re-render threads to update active state
    renderMessages();
  }

  // Render thread list
  function renderThreads() {
    chatThreadsContainer.innerHTML = '';
    
    threads.forEach(thread => {
      const threadElement = document.createElement('div');
      threadElement.className = `thread-item ${thread.isActive ? 'active' : ''}`;
      threadElement.innerHTML = `
        <i class="fas fa-comments thread-icon"></i>
        <div class="thread-content">
          <div class="thread-title">${thread.title}</div>
          <div class="thread-preview">${thread.preview}</div>
        </div>
        <div class="thread-date">${formatDate(thread.timestamp)}</div>
        <button class="delete-thread-btn" title="Delete thread">
          <i class="fas fa-trash"></i>
        </button>
      `;
      
      // Add click handler for thread selection
      threadElement.addEventListener('click', (e) => {
        // Don't trigger if clicking delete button
        if (!e.target.closest('.delete-thread-btn')) {
          loadThread(thread.id);
        }
      });

      // Add delete handler
      const deleteBtn = threadElement.querySelector('.delete-thread-btn');
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent thread selection
        deleteThread(thread.id);
      });
      
      chatThreadsContainer.appendChild(threadElement);
    });
  }

  function deleteThread(threadId) {
    if (confirm('Are you sure you want to delete this chat thread? This action cannot be undone.')) {
      // Remove thread from array
      threads = threads.filter(t => t.id !== threadId);
      
      // If deleted thread was active, select another thread
      if (currentThreadId === threadId) {
        if (threads.length > 0) {
          loadThread(threads[0].id);
        } else {
          createNewThread();
        }
      }
      
      // Remove messages from localStorage
      localStorage.removeItem(`chat_messages_${currentUser.id}_${threadId}`);
      
      // Save updated threads
      saveThreads();
      renderThreads();
    }
  }

  // Update thread preview
  function updateThreadPreview(content) {
    const thread = threads.find(t => t.id === currentThreadId);
    if (thread) {
      thread.preview = content.substring(0, 50) + (content.length > 50 ? '...' : '');
      thread.timestamp = new Date();
      saveThreads();
      renderThreads();
    }
  }

  // Generate thread title from content
  async function generateThreadTitle(content) {
    // Simple title generation from the content
    let title = content.split(' ').slice(0, 4).join(' ');
    if (content.length > 25) {
      title = content.substring(0, 25) + '...';
    }
    return title;
  }

  // Message handling functions
  function addMessage(content, isAI = false) {
    const message = {
      id: Date.now(),
      content,
      isAI,
      timestamp: new Date(),
      favorite: false,
      tags: [isAI ? 'AI' : 'User']
    };

    // Auto-tag messages
    if (content.includes('?')) {
      message.tags.push('questions');
    }
    if (content.includes('```') || content.match(/[<>{}()]/)) {
      message.tags.push('code');
    }

    messages.push(message);
    updateThreadPreview(content);

    // If this is the first user message in a new thread, generate a title
    const thread = threads.find(t => t.id === currentThreadId);
    if (!isAI && thread && thread.isNew && messages.filter(m => !m.isAI).length === 1) {
      generateThreadTitle(content).then(title => {
        thread.title = title;
        thread.isNew = false;
        saveThreads();
        renderThreads();
      });
    }

    renderMessages();
    saveMessages();
  }

  function createMessageElement(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.isAI ? 'ai-message' : 'user-message'}`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = message.content;
    
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'message-actions';
    
    // Add favorite button (hidden by default)
    const favoriteBtn = document.createElement('button');
    favoriteBtn.className = `favorite-btn ${message.favorite ? 'active' : ''}`;
    favoriteBtn.innerHTML = `<i class="fa${message.favorite ? 's' : 'r'} fa-star"></i>`;
    favoriteBtn.addEventListener('click', () => toggleFavorite(message.id));
    actionsDiv.appendChild(favoriteBtn);
    
    messageDiv.appendChild(contentDiv);
    messageDiv.appendChild(actionsDiv);
    return messageDiv;
  }

  function renderMessages() {
    messagesContainer.innerHTML = '';
    
    // Filter messages
    let filteredMessages = messages.filter(message => {
      if (currentFilter === 'all') return true;
      if (currentFilter === 'favorites') return message.favorite;
      return message.tags.includes(currentFilter);
    });
    
    // Apply search filter if search input has value
    const searchTerm = searchInput.value.toLowerCase().trim();
    if (searchTerm) {
      filteredMessages = filteredMessages.filter(message =>
        message.content.toLowerCase().includes(searchTerm)
      );
      
      // Highlight search term in messages
      filteredMessages.forEach(message => {
        const messageElement = createMessageElement(message);
        const contentElement = messageElement.querySelector('.message-content');
        const text = contentElement.textContent;
        const highlightedText = text.replace(
          new RegExp(searchTerm, 'gi'),
          match => `<mark>${match}</mark>`
        );
        contentElement.innerHTML = highlightedText;
        messagesContainer.appendChild(messageElement);
      });
    } else {
      filteredMessages.forEach(message => {
        messagesContainer.appendChild(createMessageElement(message));
      });
    }
    
    // Scroll to bottom if not searching/filtering
    if (!searchTerm && currentFilter === 'all') {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  // Event Listeners
  messageInput.addEventListener('input', () => {
    sendButton.disabled = !messageInput.value.trim();
  });

  messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && messageInput.value.trim()) {
      e.preventDefault();
      sendMessage();
    }
  });

  sendButton.addEventListener('click', sendMessage);

  searchInput.addEventListener('input', debounce(() => {
    renderMessages();
  }, 300));

  filterTags.forEach(tag => {
    tag.addEventListener('click', () => {
      filterTags.forEach(t => t.classList.remove('active'));
      tag.classList.add('active');
      currentFilter = tag.dataset.tag;
      renderMessages();
    });
  });

  async function sendMessage() {
    const content = messageInput.value.trim();
    if (!content) return;

    addMessage(content, false);
    messageInput.value = '';
    sendButton.disabled = true;

    try {
      // Prepare the context from previous messages
      const context = messages.map(msg => ({
        sender: msg.isAI ? 'assistant' : 'user',
        text: msg.content
      }));

      // Make API call to chat endpoint with selected model
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: content,
          context: context,
          model: currentModel
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get response from AI');
      }

      // Create a temporary message element for streaming
      const tempMessage = {
        id: Date.now(),
        content: '',
        isAI: true,
        timestamp: new Date(),
        favorite: false,
        tags: [] // Remove default tags
      };
      messages.push(tempMessage);
      const messageElement = createMessageElement(tempMessage);
      messagesContainer.appendChild(messageElement);

      // Handle streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let aiResponse = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            aiResponse += data.content;
            messageElement.querySelector('.message-content').textContent = aiResponse;
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
          }
        }
      }

      // Update the temporary message with final content
      tempMessage.content = aiResponse;
      saveMessages();
    } catch (error) {
      console.error('Error getting AI response:', error);
      addMessage('Sorry, I encountered an error. Please try again.', true);
    } finally {
      sendButton.disabled = false;
    }
  }

  function toggleFavorite(messageId) {
    const message = messages.find(m => m.id === messageId);
    if (message) {
      message.favorite = !message.favorite;
      renderMessages();
      saveMessages();
    }
  }

  // Storage functions
  function saveMessages() {
    localStorage.setItem(`chat_messages_${currentUser.id}_${currentThreadId}`, JSON.stringify(messages));
  }

  function loadMessages() {
    const savedMessages = localStorage.getItem(`chat_messages_${currentUser.id}_${currentThreadId}`);
    if (savedMessages) {
      messages = JSON.parse(savedMessages);
      messages.forEach(m => m.timestamp = new Date(m.timestamp));
      renderMessages();
    }
  }

  // Utility functions
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Initialize
  loadThreads();
  filterTags[0].classList.add('active'); // Activate 'All' filter by default
  initializeModelSelector(); // Initialize model selector
  
  // Handle logout
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('currentUser');
    window.location.href = 'index.html';
  });

  // Handle new chat
  newChatBtn.addEventListener('click', () => {
    createNewThread();
  });
})

// Show notification
function showNotification(message) {
  const notification = document.createElement('div')
  notification.className = 'notification'
  notification.textContent = message
  document.body.appendChild(notification)
  
  setTimeout(() => {
    notification.classList.add('fade-out')
    setTimeout(() => notification.remove(), 500)
  }, 3000)
}

// Format date for thread list
function formatDate(date) {
  const now = new Date();
  const messageDate = new Date(date);
  
  if (messageDate.toDateString() === now.toDateString()) {
    return messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else {
    return messageDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
}

