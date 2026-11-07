/* ============================================
   MyLifeCall — Phone Ring Script
   Powered by ntfy (adminforge.de - works in Pakistan) + Firebase Firestore
   ============================================ */

// Primary & Fallback ntfy servers (adminforge.de works 100% in Pakistan without VPN)
const NTFY_SERVERS = [
    'https://ntfy.adminforge.de',
    'https://ntfy.tedomum.fr'
];
const NTFY_TOPIC = 'mylifecall-ring-basit';

// Firebase Configuration
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

// Timing, input, storage, and notification constants
const COOLDOWN_SECONDS = 30;
const MAX_MESSAGE_LENGTH = 500;
const MAX_NAME_LENGTH = 40;
const CHAT_NAME_STORAGE_KEY = 'mylifecall-chat-name';
const AUTO_RING_TITLE = 'business meeting reminder';
const MANUAL_RING_TITLE = '🔔 INCOMING CALL: MyLifeCall Ring!';
const WEB_MESSAGE_TITLE_PREFIX = '💬 New MyLifeCall message from ';

// Track ring and chat state for this page
let ringCount = 0;
let cooldownInterval = null;
let cooldownRemaining = 0;
let unreadCount = 0;
let isChatOpen = false;
let isSendingMessage = false;
let isDeletingChat = false;
let unsubscribeFirestore = null;
let chatHideTimer = null;
let bodyOverflowBeforeChat = '';
let isBodyScrollLocked = false;
const seenNtfyEventIds = new Set();

// DOM elements
const ringButton = document.getElementById('ringButton');
const buttonText = document.getElementById('buttonText');
const statusIcon = document.getElementById('statusIcon');
const statusText = document.getElementById('statusText');
const cooldownBar = document.getElementById('cooldownBar');
const cooldownProgress = document.getElementById('cooldownProgress');
const cooldownText = document.getElementById('cooldownText');
const ringCountEl = document.getElementById('ringCount');
const openChatBtn = document.getElementById('openChatBtn');
const chatWindow = document.getElementById('chatWindow');
const floatingChatBtn = document.getElementById('floatingChatBtn');
const msgBadge = document.getElementById('msgBadge');
const chatBody = document.getElementById('chatBody');
const chatInput = document.getElementById('chatInput');
const chatSendBtn = document.getElementById('chatSendBtn');
const deleteChatBtn = document.getElementById('deleteChatBtn');
const chatNameInput = document.getElementById('chatNameInput');
const mobileChatMedia = window.matchMedia('(max-width: 600px)');

// Initialize accessibility, limits, and persisted optional name.
msgBadge.hidden = true;
chatInput.maxLength = MAX_MESSAGE_LENGTH;
chatNameInput.maxLength = MAX_NAME_LENGTH;
chatWindow.setAttribute('aria-hidden', 'true');
[openChatBtn, floatingChatBtn].forEach((button) => {
    if (!button) return;
    button.setAttribute('aria-controls', 'chatWindow');
    button.setAttribute('aria-expanded', 'false');
});

try {
    const savedName = localStorage.getItem(CHAT_NAME_STORAGE_KEY);
    if (savedName) chatNameInput.value = savedName.slice(0, MAX_NAME_LENGTH);
} catch (error) {
    console.warn('Could not restore the saved chat name:', error);
}

updateSendButton();
listenToMessages();
setupNtfyListener();

function resetChatBody() {
    const dateDivider = chatBody.querySelector('.chat-date-divider');
    chatBody.replaceChildren();
    if (dateDivider) chatBody.appendChild(dateDivider);
}

function listenToMessages() {
    if (unsubscribeFirestore) unsubscribeFirestore();
    resetChatBody();

    unsubscribeFirestore = db.collection('messages')
        .orderBy('timestamp', 'asc')
        .onSnapshot(
            (snapshot) => {
                resetChatBody();
                snapshot.forEach((messageDoc) => {
                    const msg = messageDoc.data();
                    appendChatBubble(msg.text, msg.timeStr, msg.type, false);
                });
                scrollToBottom();
            },
            (error) => {
                console.error('Firestore message listener failed:', error);
                appendChatBubble(
                    'Chat history could not be loaded. Please check your connection and refresh.',
                    getCurrentTime(),
                    'received'
                );
            }
        );
}

function scheduleAutoRing() {
    window.setTimeout(() => ringPhone({ automatic: true }), 1500);
}

// Send the auto-alert when page is loaded
if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', scheduleAutoRing, { once: true });
} else {
    scheduleAutoRing();
}

// ==========================================
// Robust Multi-Server ntfy Publisher
// ==========================================

function encodeNtfyHeader(value) {
    const bytes = new TextEncoder().encode(value);
    const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
    return `=?UTF-8?B?${btoa(binary)}?=`;
}

function decodeNtfyHeader(value) {
    const match = /^=\?UTF-8\?B\?([^?]+)\?=$/i.exec(value);
    if (!match) return value;
    try {
        const binary = atob(match[1]);
        const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
        return new TextDecoder().decode(bytes);
    } catch (error) {
        return value;
    }
}

async function publishToNtfy(title, priority, tags, bodyText) {
    let delivered = false;

    for (const server of NTFY_SERVERS) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 7000);

            const res = await fetch(`${server}/${NTFY_TOPIC}`, {
                method: 'POST',
                headers: {
                    'Title': encodeNtfyHeader(title),
                    'Priority': String(priority),
                    'Tags': tags,
                    'Click': window.location.href
                },
                body: bodyText,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (res.ok) {
                console.log(`Notification delivered via ${server}`);
                delivered = true;
                break; // Successfully sent!
            }
        } catch (err) {
            console.warn(`Publish to ${server} failed, trying next server...`, err);
        }
    }

    return delivered;
}

// ==========================================
// Phone Ring Function
// ==========================================

async function ringPhone(options = {}) {
    const automatic = Boolean(options && options.automatic);
    if (!automatic && ringButton.disabled) return;

    const controlsRingUi = !ringButton.disabled;
    if (controlsRingUi) {
        ringButton.disabled = true;
        buttonText.textContent = 'Calling Phone...';
        statusIcon.className = 'status-icon ringing';
        statusText.textContent = '📞 Calling your phone now (ringing loud)...';
    }

    try {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const dateStr = now.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });

        const notificationTitle = automatic ? AUTO_RING_TITLE : MANUAL_RING_TITLE;
        const openingLine = automatic
            ? 'Someone special opened your MyLifeCall site.'
            : '🚨 EMERGENCY / CALL: Someone is ringing you from MyLifeCall right now!';

        // Priority 5 = URGENT ALARM / CALL. In ntfy app, priority 5 triggers
        // loud continuous ringing that overrides silent mode & DND!
        const priority = automatic ? '4' : '5';
        const tags = automatic ? 'eyes,bell' : 'phone,loudspeaker,rotating_light,alarm_clock';

        const ntfyBody = `${openingLine}\n\n🕐 Time: ${timeStr}\n📅 Date: ${dateStr}\n🌐 Link: ${window.location.href}`;

        // Send to ntfy (triggers phone call alarm)
        const ntfySuccess = await publishToNtfy(notificationTitle, priority, tags, ntfyBody);

        // Also save to Firestore for sync & receiver page
        try {
            await db.collection('rings').add({
                type: automatic ? 'auto' : 'manual',
                message: openingLine,
                timeStr: timeStr,
                dateStr: dateStr,
                page: window.location.href,
                status: 'pending',
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (e) {
            console.warn('Firestore backup ring save error:', e);
        }

        if (!ntfySuccess && !automatic) {
            // Even if ntfy failed, check if Firestore worked
            console.warn('ntfy publish returned false');
        }

        ringCount += 1;
        ringCountEl.textContent = ringCount;

        if (controlsRingUi) {
            statusIcon.className = 'status-icon success';
            statusText.textContent = '✅ Call sent! Your phone is ringing loudly.';
            buttonText.textContent = 'Call Sent!';
            startCooldown();
        }
    } catch (error) {
        console.error('Ring failed:', error);
        if (controlsRingUi) {
            statusIcon.className = 'status-icon error';
            statusText.textContent = '❌ Could not connect. Check internet and try again.';
            buttonText.textContent = 'Try Again';
            ringButton.disabled = false;
        }
    }
}

function startCooldown() {
    if (cooldownInterval) clearInterval(cooldownInterval);

    cooldownRemaining = COOLDOWN_SECONDS;
    cooldownBar.classList.add('active');
    updateCooldownUI();

    cooldownInterval = window.setInterval(() => {
        cooldownRemaining -= 1;

        if (cooldownRemaining <= 0) {
            clearInterval(cooldownInterval);
            cooldownInterval = null;
            cooldownBar.classList.remove('active');
            cooldownProgress.style.width = '0%';
            cooldownText.textContent = '';
            ringButton.disabled = false;
            buttonText.textContent = 'Ring Again 🔔';
            statusIcon.className = 'status-icon';
            statusText.textContent = 'Ready to ring again! Tap the button.';
            return;
        }

        updateCooldownUI();
    }, 1000);
}

function updateCooldownUI() {
    const elapsed = COOLDOWN_SECONDS - cooldownRemaining;
    cooldownProgress.style.width = `${(elapsed / COOLDOWN_SECONDS) * 100}%`;
    cooldownText.textContent = `You can ring again in ${cooldownRemaining}s`;
    buttonText.textContent = `Wait ${cooldownRemaining}s`;
}

// ==========================================
// Chat Functionality
// ==========================================

function syncBodyScrollLock() {
    const shouldLock = isChatOpen && mobileChatMedia.matches;

    if (shouldLock && !isBodyScrollLocked) {
        bodyOverflowBeforeChat = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        isBodyScrollLocked = true;
    } else if (!shouldLock && isBodyScrollLocked) {
        document.body.style.overflow = bodyOverflowBeforeChat;
        bodyOverflowBeforeChat = '';
        isBodyScrollLocked = false;
    }
}

function setChatOpen(open) {
    isChatOpen = open;
    document.body.classList.toggle('chat-open', open);
    [openChatBtn, floatingChatBtn].forEach((button) => {
        if (button) button.setAttribute('aria-expanded', String(open));
    });
    chatWindow.setAttribute('aria-hidden', String(!open));
    syncBodyScrollLock();

    if (open) {
        if (chatHideTimer) {
            clearTimeout(chatHideTimer);
            chatHideTimer = null;
        }
        chatWindow.classList.remove('hidden');
        unreadCount = 0;
        msgBadge.hidden = true;

        window.requestAnimationFrame(() => {
            if (!isChatOpen) return;
            chatWindow.classList.add('active');
            try {
                chatInput.focus({ preventScroll: true });
            } catch (error) {
                chatInput.focus();
            }
            scrollToBottom();
        });
        return;
    }

    chatWindow.classList.remove('active');
    if (chatHideTimer) clearTimeout(chatHideTimer);
    chatHideTimer = window.setTimeout(() => {
        if (!isChatOpen) chatWindow.classList.add('hidden');
        chatHideTimer = null;
    }, 300);
}

function toggleChatWindow() {
    setChatOpen(!isChatOpen);
}

function updateSendButton() {
    chatSendBtn.disabled = isSendingMessage || chatInput.value.trim().length === 0;
}

function persistOptionalName() {
    const limitedName = chatNameInput.value.slice(0, MAX_NAME_LENGTH);
    if (chatNameInput.value !== limitedName) chatNameInput.value = limitedName;

    try {
        if (limitedName.trim()) {
            localStorage.setItem(CHAT_NAME_STORAGE_KEY, limitedName);
        } else {
            localStorage.removeItem(CHAT_NAME_STORAGE_KEY);
        }
    } catch (error) {
        console.warn('Could not save the chat name:', error);
    }
}

chatInput.addEventListener('input', () => {
    if (chatInput.value.length > MAX_MESSAGE_LENGTH) {
        chatInput.value = chatInput.value.slice(0, MAX_MESSAGE_LENGTH);
    }
    chatInput.removeAttribute('aria-invalid');
    updateSendButton();
});

chatNameInput.addEventListener('input', persistOptionalName);

chatInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.isComposing) {
        event.preventDefault();
        sendChatMessage();
    }
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isChatOpen) {
        event.preventDefault();
        setChatOpen(false);
        floatingChatBtn.focus();
    }
});

if (typeof mobileChatMedia.addEventListener === 'function') {
    mobileChatMedia.addEventListener('change', syncBodyScrollLock);
} else {
    mobileChatMedia.addListener(syncBodyScrollLock);
}

window.deleteChatHistory = deleteChatHistory;

async function deleteChatHistory() {
    if (isDeletingChat) return;

    const confirmed = window.confirm(
        'Delete the whole shared conversation for everyone? This cannot be undone.'
    );
    if (!confirmed) return;

    const wasDisabled = deleteChatBtn ? deleteChatBtn.disabled : false;
    const previousAriaBusy = deleteChatBtn ? deleteChatBtn.getAttribute('aria-busy') : null;
    isDeletingChat = true;

    if (deleteChatBtn) {
        deleteChatBtn.disabled = true;
        deleteChatBtn.setAttribute('aria-busy', 'true');
    }
    chatWindow.classList.add('deleting');

    try {
        while (true) {
            const snapshot = await db.collection('messages').limit(400).get();
            if (snapshot.empty) break;

            const batch = db.batch();
            snapshot.docs.forEach((messageDoc) => batch.delete(messageDoc.ref));
            await batch.commit();
        }

        appendChatBubble(
            'The shared conversation was deleted for everyone.',
            getCurrentTime(),
            'received'
        );
    } catch (error) {
        console.error('Error deleting chat history:', error);
        appendChatBubble(
            'The shared conversation could not be fully deleted. Check your connection and try again.',
            getCurrentTime(),
            'received'
        );
    } finally {
        isDeletingChat = false;
        chatWindow.classList.remove('deleting');

        if (deleteChatBtn) {
            deleteChatBtn.disabled = wasDisabled;
            if (previousAriaBusy === null) {
                deleteChatBtn.removeAttribute('aria-busy');
            } else {
                deleteChatBtn.setAttribute('aria-busy', previousAriaBusy);
            }
        }
    }
}

async function sendChatMessage() {
    if (isSendingMessage) return;

    const text = chatInput.value.trim().slice(0, MAX_MESSAGE_LENGTH);
    if (!text) {
        updateSendButton();
        return;
    }

    const optionalName = chatNameInput.value.trim().slice(0, MAX_NAME_LENGTH);
    const senderName = optionalName || 'Anonymous';
    const timeStr = getCurrentTime();

    isSendingMessage = true;
    chatInput.disabled = true;
    chatNameInput.disabled = true;
    updateSendButton();
    persistOptionalName();

    try {
        await db.collection('messages').add({
            text,
            timeStr,
            type: 'sent',
            sender: senderName,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Also push notification to phone via ntfy
        publishToNtfy(
            `${WEB_MESSAGE_TITLE_PREFIX}${senderName}`,
            4,
            'speech_balloon,incoming_envelope',
            `${text}\n\nFrom: ${senderName}\n🕐 Time: ${timeStr}`
        );

        chatInput.value = '';
        chatInput.removeAttribute('aria-invalid');
    } catch (error) {
        console.error('Error saving message to Firestore:', error);
        chatInput.setAttribute('aria-invalid', 'true');
        appendChatBubble(
            'Your message was not sent. Check your connection and try again — your text is still here.',
            getCurrentTime(),
            'received'
        );
    } finally {
        isSendingMessage = false;
        chatInput.disabled = false;
        chatNameInput.disabled = false;
        updateSendButton();
        if (isChatOpen) chatInput.focus();
    }
}

function appendChatBubble(text, timeStr, type = 'received', shouldScroll = true) {
    const bubble = document.createElement('div');
    const safeType = type === 'sent' ? 'sent' : 'received';
    bubble.classList.add('chat-message', safeType);
    bubble.appendChild(document.createTextNode(String(text ?? '')));

    const timeLabel = document.createElement('span');
    timeLabel.className = 'chat-time-label';
    timeLabel.textContent = String(timeStr ?? '');
    bubble.appendChild(timeLabel);

    chatBody.appendChild(bubble);
    if (shouldScroll) scrollToBottom();
}

function getCurrentTime() {
    return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function scrollToBottom() {
    chatBody.scrollTop = chatBody.scrollHeight;
}

// ==========================================
// Listen for Replies from ntfy App
// ==========================================

function isWebSentNotificationTitle(title) {
    const decodedTitle = decodeNtfyHeader(title);
    return decodedTitle === AUTO_RING_TITLE
        || decodedTitle === MANUAL_RING_TITLE
        || decodedTitle.startsWith(WEB_MESSAGE_TITLE_PREFIX);
}

function setupNtfyListener() {
    const primaryServer = NTFY_SERVERS[0];
    let eventSource = null;

    try {
        eventSource = new EventSource(`${primaryServer}/${NTFY_TOPIC}/sse`);

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.event !== 'message' || typeof data.message !== 'string' || !data.message.trim()) return;

                const title = typeof data.title === 'string' ? data.title : '';
                if (isWebSentNotificationTitle(title)) return;

                const eventId = typeof data.id === 'string' ? data.id.trim() : '';
                if (!eventId || seenNtfyEventIds.has(eventId)) return;
                seenNtfyEventIds.add(eventId);

                handleNtfyIncomingReply(data.message.trim(), title, eventId);
            } catch (err) {
                console.error('Error parsing ntfy reply:', err);
            }
        };

        eventSource.onerror = () => {
            console.warn('ntfy SSE stream temporarily disconnected, browser will auto-reconnect.');
        };
    } catch (e) {
        console.warn('Could not initialize ntfy SSE listener:', e);
    }
}

async function handleNtfyIncomingReply(text, title, eventId) {
    const timeStr = getCurrentTime();
    const sender = String(title || 'Basit').trim().slice(0, MAX_NAME_LENGTH) || 'Basit';

    try {
        await db.collection('messages').doc(`ntfy_${eventId}`).set({
            text: String(text).slice(0, MAX_MESSAGE_LENGTH),
            timeStr,
            type: 'received',
            sender,
            ntfyEventId: eventId,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (e) {
        console.error('Error saving ntfy reply to Firestore:', e);
    }

    floatingChatBtn.classList.remove('hidden');

    if (!isChatOpen) {
        unreadCount += 1;
        msgBadge.textContent = unreadCount;
        msgBadge.hidden = false;
        floatingChatBtn.classList.add('pulse');
        window.setTimeout(() => floatingChatBtn.classList.remove('pulse'), 1000);
    }
}
