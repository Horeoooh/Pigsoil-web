/**
 * NotificationUI - Handles notification dropdown UI and interactions
 */

import notificationManager from './notification-manager.js';

class NotificationUI {
  constructor() {
    this.dropdown = null;
    this.currentFilter = 'all';
    this.isOpen = false;
  }

  /**
   * Initialize notification UI
   */
  init() {
    this.injectDropdownHTML();
    this.attachEventListeners();
    this.updateBadge();

    // Listen for notification changes
    notificationManager.addListener(() => {
      this.updateBadge();
      if (this.isOpen) {
        this.renderNotifications();
      }
    });

    console.log('✅ NotificationUI initialized');
  }

  /**
   * Inject dropdown HTML into the page
   */
  injectDropdownHTML() {
    const notificationBtn = document.getElementById('notificationBtn');
    if (!notificationBtn) {
      console.warn('Notification button not found');
      return;
    }

    // Wrap button in container
    const container = document.createElement('div');
    container.className = 'notification-container';
    notificationBtn.parentNode.insertBefore(container, notificationBtn);
    container.appendChild(notificationBtn);

    // Add badge
    const badge = document.createElement('span');
    badge.className = 'notification-badge';
    badge.id = 'notificationBadge';
    badge.style.display = 'none';
    badge.textContent = '0';
    container.appendChild(badge);

    // Create dropdown
    const dropdown = document.createElement('div');
    dropdown.className = 'notification-dropdown';
    dropdown.id = 'notificationDropdown';
    dropdown.innerHTML = `
      <div class="notification-header">
        <h3>Notifications</h3>
        <div class="notification-header-actions">
          <button class="mark-all-read-btn" id="markAllReadBtn">Mark all as read</button>
          <button class="close-notifications-btn" id="closeNotificationsBtn">×</button>
        </div>
      </div>
      
      <div class="notification-filters">
        <button class="filter-btn active" data-filter="all">All</button>
        <button class="filter-btn" data-filter="unread">Unread</button>
        <button class="filter-btn" data-filter="chat">Messages</button>
        <button class="filter-btn" data-filter="subscription">Subscriptions</button>
        <button class="filter-btn" data-filter="system">System</button>
      </div>
      
      <div class="notification-list" id="notificationList">
        <div class="notification-loading">Loading notifications</div>
      </div>
      
      <div class="notification-footer">
        <button class="clear-all-btn" id="clearAllBtn">Clear All Notifications</button>
      </div>
    `;
    container.appendChild(dropdown);

    this.dropdown = dropdown;
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Toggle dropdown
    const notificationBtn = document.getElementById('notificationBtn');
    if (notificationBtn) {
      notificationBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleDropdown();
      });
    }

    // Close dropdown
    const closeBtn = document.getElementById('closeNotificationsBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.closeDropdown();
      });
    }

    // Mark all as read
    const markAllReadBtn = document.getElementById('markAllReadBtn');
    if (markAllReadBtn) {
      markAllReadBtn.addEventListener('click', () => {
        this.markAllAsRead();
      });
    }

    // Clear all
    const clearAllBtn = document.getElementById('clearAllBtn');
    if (clearAllBtn) {
      clearAllBtn.addEventListener('click', () => {
        this.clearAll();
      });
    }

    // Filter buttons
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.setFilter(btn.dataset.filter);
      });
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (this.isOpen && !this.dropdown.contains(e.target)) {
        this.closeDropdown();
      }
    });

    // Prevent dropdown from closing when clicking inside
    if (this.dropdown) {
      this.dropdown.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }
  }

  /**
   * Toggle dropdown
   */
  toggleDropdown() {
    if (this.isOpen) {
      this.closeDropdown();
    } else {
      this.openDropdown();
    }
  }

  /**
   * Open dropdown
   */
  openDropdown() {
    if (!this.dropdown) return;

    this.dropdown.classList.add('show');
    this.isOpen = true;
    this.renderNotifications();
  }

  /**
   * Close dropdown
   */
  closeDropdown() {
    if (!this.dropdown) return;

    this.dropdown.classList.remove('show');
    this.isOpen = false;
  }

  /**
   * Set filter
   */
  setFilter(filter) {
    this.currentFilter = filter;

    // Update active button
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
      if (btn.dataset.filter === filter) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    this.renderNotifications();
  }

  /**
   * Update notification badge
   */
  updateBadge() {
    const badge = document.getElementById('notificationBadge');
    if (!badge) return;

    const unreadCount = notificationManager.getUnreadCount();

    if (unreadCount > 0) {
      badge.textContent = unreadCount > 99 ? '99+' : unreadCount.toString();
      badge.style.display = 'block';
    } else {
      badge.style.display = 'none';
    }
  }

  /**
   * Render notifications
   */
  renderNotifications() {
    const listElement = document.getElementById('notificationList');
    if (!listElement) return;

    const notifications = notificationManager.getNotificationsByFilter(this.currentFilter);

    if (notifications.length === 0) {
      listElement.innerHTML = this.renderEmptyState();
      return;
    }

    listElement.innerHTML = notifications.map(notification => 
      this.renderNotificationItem(notification)
    ).join('');

    // Attach click handlers
    this.attachNotificationHandlers();

    // Update mark all as read button state
    this.updateMarkAllReadButton();
  }

  /**
   * Render single notification item
   */
  renderNotificationItem(notification) {
    const icon = this.getNotificationIcon(notification.type);
    const timeAgo = notificationManager.formatTimestamp(notification.timestamp);
    const unreadClass = notification.isRead ? '' : 'unread';

    return `
      <div class="notification-item ${unreadClass}" data-id="${notification.id}">
        <div class="notification-icon ${notification.type}">
          ${icon}
        </div>
        <div class="notification-content">
          <div class="notification-title">
            ${this.escapeHtml(notification.title)}
            <span class="notification-type-badge ${notification.type}">
              ${notification.type}
            </span>
          </div>
          <p class="notification-message">${this.escapeHtml(notification.message)}</p>
          <div class="notification-time">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.2 3.2.8-1.3-4.5-2.7V7z"/>
            </svg>
            ${timeAgo}
          </div>
          <div class="notification-actions">
            ${!notification.isRead ? `
              <button class="notification-action-btn primary mark-read-btn" data-id="${notification.id}">
                Mark as Read
              </button>
            ` : ''}
            ${notification.type === 'chat' && notification.conversationId ? `
              <button class="notification-action-btn view-message-btn" data-conversation="${notification.conversationId}" data-sender="${notification.senderId}">
                View Message
              </button>
            ` : ''}
            <button class="notification-action-btn danger delete-btn" data-id="${notification.id}">
              Delete
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render empty state
   */
  renderEmptyState() {
    const messages = {
      all: { icon: '🔔', text: 'No notifications yet' },
      unread: { icon: '✅', text: 'All caught up!' },
      chat: { icon: '💬', text: 'No messages yet' },
      subscription: { icon: '⭐', text: 'No subscription updates' },
      system: { icon: '🔧', text: 'No system notifications' }
    };

    const { icon, text } = messages[this.currentFilter] || messages.all;

    return `
      <div class="notification-empty">
        <div class="notification-empty-icon">${icon}</div>
        <p class="notification-empty-text">${text}</p>
      </div>
    `;
  }

  /**
   * Get notification icon
   */
  getNotificationIcon(type) {
    const icons = {
      chat: '💬',
      subscription: '⭐',
      system: '🔔'
    };
    return icons[type] || '🔔';
  }

  /**
   * Attach handlers to notification items
   */
  attachNotificationHandlers() {
    // Mark as read buttons
    document.querySelectorAll('.mark-read-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        notificationManager.markAsRead(id);
      });
    });

    // Delete buttons
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        if (confirm('Delete this notification?')) {
          notificationManager.deleteNotification(id);
        }
      });
    });

    // View message buttons
    document.querySelectorAll('.view-message-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const conversationId = btn.dataset.conversation;
        const senderId = btn.dataset.sender;
        // Navigate to messages
        window.location.href = `/messages.html?conversation=${conversationId}`;
      });
    });

    // Click on notification item
    document.querySelectorAll('.notification-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.id;
        const notification = notificationManager.loadNotifications().find(n => n.id === id);
        
        if (notification && !notification.isRead) {
          notificationManager.markAsRead(id);
        }

        // Handle navigation based on type
        if (notification.type === 'chat' && notification.conversationId) {
          window.location.href = `/messages.html?conversation=${notification.conversationId}`;
        }
      });
    });
  }

  /**
   * Mark all as read
   */
  markAllAsRead() {
    const count = notificationManager.markAllAsRead();
    if (count > 0) {
      this.showToast(`Marked ${count} notifications as read`);
    } else {
      this.showToast('All notifications already read');
    }
  }

  /**
   * Clear all notifications
   */
  clearAll() {
    if (!confirm('Delete all notifications? This cannot be undone.')) {
      return;
    }

    const count = notificationManager.clearAll();
    if (count > 0) {
      this.showToast(`Cleared ${count} notifications`);
      this.closeDropdown();
    }
  }

  /**
   * Update mark all as read button state
   */
  updateMarkAllReadButton() {
    const btn = document.getElementById('markAllReadBtn');
    if (!btn) return;

    const unreadCount = notificationManager.getUnreadCount();
    btn.disabled = unreadCount === 0;
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  /**
   * Show toast message
   */
  showToast(message) {
    // Create toast element
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #333;
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      animation: slideInUp 0.3s ease-out;
    `;
    toast.textContent = message;

    document.body.appendChild(toast);

    // Remove after 3 seconds
    setTimeout(() => {
      toast.style.animation = 'slideOutDown 0.3s ease-out';
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 3000);
  }
}

// Create singleton instance
const notificationUI = new NotificationUI();

export default notificationUI;
