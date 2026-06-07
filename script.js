/* ============================================
   MyLifeCall — Phone Ring Script
   ============================================ */

// ⚠️ IMPORTANT: Change this to YOUR unique ntfy topic!
// This must match the topic you subscribed to in the ntfy app on your phone.
const NTFY_TOPIC = 'mylifecall-ring-basitali-secret';

// Firebase Configuration (from subagent setup)
const firebaseConfig = {
    apiKey: "AIzaSyCpMlfNxaKSOnyUokMaxSkxJ2r9mDKyLA4",
    authDomain: "mylifecall-chat.firebaseapp.com",
    projectId: "mylifecall-chat",
    storageBucket: "mylifecall-chat.firebasestorage.app",
    messagingSenderId: "1002911804959",
    appId: "1:1002911804959:web:784c551c78dbefdbd0ef2a"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// Cooldown duration in seconds (30 seconds)
const COOLDOWN_SECONDS = 30;

// Track ring count for this session
let ringCount = 0;
let cooldownInterval = null;
let cooldownRemaining = 0;

// DOM elements
const ringButton = document.getElementById('ringButton');
const buttonText = document.getElementById('buttonText');
const statusIcon = document.getElementById('statusIcon');
const statusText = document.getElementById('statusText');
const cooldownBar = document.getElementById('cooldownBar');
const cooldownProgress = document.getElementById('cooldownProgress');
const cooldownText = document.getElementById('cooldownText');
const ringCountEl = document.getElementById('ringCount');
// Chat UI Elements
const chatWindow = document.getElementById('chatWindow');
const floatingChatBtn = document.getElementById('floatingChatBtn');
const msgBadge = document.getElementById('msgBadge');
const chatBody = document.getElementById('chatBody');
const chatInput = document.getElementById('chatInput');
const chatSendBtn = document.getElementById('chatSendBtn');
const chatNameInput = document.getElementById('chatNameInput');

// State for messages
let unreadCount = 0;
let isChatOpen = false;
let unsubscribeFirestore = null;

// Start listening immediately (Global Chat)
listenToMessages();

function listenToMessages() {
    if (unsubscribeFirestore) unsubscribeFirestore(); // clear previous listener if any
    
    // Clear chat UI before loading
    const dateDivider = chatBody.querySelector('.chat-date-divider');
    chatBody.innerHTML = '';
    if (dateDivider) chatBody.appendChild(dateDivider);

    unsubscribeFirestore = db.collection('messages')
        .orderBy('timestamp', 'asc')
        .onSnapshot((snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const msg = change.doc.data();
                    appendChatBubble(msg.text, msg.timeStr, msg.type, false);
                }
            });
        });
}

// Auto-ring on first visit (page load)
window.addEventListener('DOMContentLoaded', () => {
    // Small delay so user sees the page first
    setTimeout(() => {
        ringPhone();
    }, 1500);
});

async function ringPhone() {
    if (ringButton.disabled) return;

    // Disable button
    ringButton.disabled = true;
    buttonText.textContent = 'Ringing...';
    statusIcon.className = 'status-icon ringing';
    statusText.textContent = '📞 Ringing your phone now...';

    try {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

        const response = await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
            method: 'POST',
            headers: {
                'Title': 'Someone is calling you!',
                'Priority': '5',
                'Tags': 'phone,loudspeaker,rotating_light',
            },
            body: `Businness update client!\n\n🕐 Time: ${timeStr}\n📅 Date: ${dateStr}\n🌐 Page: ${window.location.href}`
        });

        if (response.ok) {
            // Success
            ringCount++;
            ringCountEl.textContent = ringCount;
            statusIcon.className = 'status-icon success';
            statusText.textContent = '✅ Phone is ringing! Call sent successfully.';
            buttonText.textContent = 'Ring Sent!';

            // Start cooldown
            startCooldown();
        } else {
            throw new Error(`Failed: ${response.status}`);
        }
    } catch (error) {
        console.error('Ring failed:', error);
        statusIcon.className = 'status-icon error';
        statusText.textContent = '❌ Failed to ring. Please try again.';
        buttonText.textContent = 'Try Again';
        ringButton.disabled = false;
    }
}

function startCooldown() {
    cooldownRemaining = COOLDOWN_SECONDS;
    cooldownBar.classList.add('active');
    updateCooldownUI();

    cooldownInterval = setInterval(() => {
        cooldownRemaining--;

        if (cooldownRemaining <= 0) {
            // Cooldown complete
            clearInterval(cooldownInterval);
            cooldownInterval = null;
            cooldownBar.classList.remove('active');
            cooldownProgress.style.width = '0%';
            cooldownText.textContent = '';

            // Re-enable button
            ringButton.disabled = false;
            buttonText.textContent = 'Ring Again 🔔';
            statusIcon.className = 'status-icon';
            statusText.textContent = 'Ready to ring again! Tap the button.';
        } else {
            updateCooldownUI();
        }
    }, 1000);
}

function updateCooldownUI() {
    const elapsed = COOLDOWN_SECONDS - cooldownRemaining;
    const progressPercent = (elapsed / COOLDOWN_SECONDS) * 100;
    cooldownProgress.style.width = `${progressPercent}%`;
    cooldownText.textContent = `You can ring again in ${cooldownRemaining}s`;
    buttonText.textContent = `Wait ${cooldownRemaining}s`;
}

// ==========================================
// Chat Functionality
// ==========================================

async function deleteChatHistory() {
    if (!confirm("Are you sure you want to delete everyone's chat history? This cannot be undone.")) return;

    try {
        const snapshot = await db.collection('messages').get();
        
        const batch = db.batch();
        snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });
        await batch.commit();

        // Optional: clear the UI immediately
        const dateDivider = chatBody.querySelector('.chat-date-divider');
        chatBody.innerHTML = '';
        if (dateDivider) chatBody.appendChild(dateDivider);
        
        toggleChatWindow(); // Close the window
        
    } catch (error) {
        console.error("Failed to delete chat history:", error);
        alert("Failed to delete history. Please try again.");
    }
}

function toggleChatWindow() {
    isChatOpen = !isChatOpen;
    
    if (isChatOpen) {
        chatWindow.classList.remove('hidden');
        // Reset unread counts
        unreadCount = 0;
        msgBadge.style.display = 'none';
        
        setTimeout(() => {
            chatWindow.classList.add('active');
            chatInput.focus();
            scrollToBottom();
        }, 10);
    } else {
        chatWindow.classList.remove('active');
        setTimeout(() => chatWindow.classList.add('hidden'), 300);
    }
}

// Enable/Disable send button based on input
chatInput.addEventListener('input', () => {
    chatSendBtn.disabled = chatInput.value.trim().length === 0;
});

// Send on Enter
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendChatMessage();
    }
});

async function sendChatMessage() {
    const text = chatInput.value.trim();
    if (!text) return;

    const name = chatNameInput.value.trim() || 'Anonymous';
    
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    
    // Clear input
    chatInput.value = '';
    chatSendBtn.disabled = true;

    // Save to Firestore (Global Collection)
    try {
        await db.collection('messages').add({
            text: text,
            timeStr: timeStr,
            type: 'sent',
            sender: name,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (e) {
        console.error("Error saving to Firestore:", e);
        appendChatBubble("Failed to send.", timeStr, 'sent');
        return;
    }

    // Send original push notification to you
    try {
        const response = await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
            method: 'POST',
            headers: {
                'Title': `New Message from ${name}`,
                'Priority': '4',
                'Tags': 'speech_balloon,incoming_envelope',
            },
            body: `${text}\n\n🕐 Time: ${timeStr}`
        });

        if (!response.ok) {
            console.error(`Failed to send via ntfy: ${response.status}`);
        }
    } catch (error) {
        console.error('Message failed:', error);
    }
}

function appendChatBubble(text, timeStr, type = 'received') {
    const bubble = document.createElement('div');
    bubble.className = `chat-message ${type}`;
    
    bubble.innerHTML = `
        ${text}
        <span class="chat-time-label">${timeStr}</span>
    `;
    
    chatBody.appendChild(bubble);
    scrollToBottom();
}

function scrollToBottom() {
    chatBody.scrollTop = chatBody.scrollHeight;
}

// ==========================================
// Listen for incoming messages (Replies)
// ==========================================

function setupMessageListener() {
    const eventSource = new EventSource(`https://ntfy.sh/${NTFY_TOPIC}/sse`);

    eventSource.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);

            // Process new messages
            if (data.event === 'message' && data.message) {
                // Ignore our own outgoing messages (rings and messages sent from site)
                if (data.message.includes('INCOMING CALL') || (data.title && data.title.includes('New Message from'))) return;

                // Make sure it's a genuine reply (or just testing)
                addMessageToPanel(data.message, data.title || 'Me');
            }
        } catch (e) {
            console.error('Error parsing notification:', e);
        }
    };
}

function addMessageToPanel(text, title) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    
    // Save your reply to the global chat
    db.collection('messages').add({
        text: text,
        timeStr: timeStr,
        type: 'received',
        sender: 'You',
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(e => console.error("Error saving reply to Firestore:", e));
    
    // Update badge / notification dot
    floatingChatBtn.classList.remove('hidden'); // Show floating button
    
    if (!isChatOpen) {
        unreadCount++;
        msgBadge.textContent = unreadCount;
        msgBadge.style.display = 'flex';
        
        // Add animation for new message
        floatingChatBtn.classList.add('pulse');
        setTimeout(() => floatingChatBtn.classList.remove('pulse'), 1000);
    }
}

// Initialize the listener
setupMessageListener();
