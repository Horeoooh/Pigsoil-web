/**
 * NotificationManager - Web notification system for PigSoil+
 * Handles FCM notifications, localStorage storage, and userId filtering
 * 
 * Notification Types:
 * - chat: Message notifications
 * - subscription: Subscription reminders/updates
 * - system: System updates and alerts
 */

import { auth, db } from './init.js';
import { doc, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js';
import { getMessaging, getToken, onMessage } from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-messaging.js';

class NotificationManager {
  constructor() {
    this.STORAGE_KEY = 'pigsoil_notifications';
    this.MAX_NOTIFICATIONS = 100;
    this.messaging = null;
    this.listeners = [];
    this.vapidKey = 'BKzIFzTLtFoy1oToRe0Ur0kCRF4_gmm4xOJi7tKxzwgKRXhqFQfVcJMZCnzBu5OANg-7Nwrsj7Pdh2T_hF_Dvv0';
  }

  /**
   * Initialize FCM and check/update token
   */
  async initialize() {
    try {
      console.log('🔔 Initializing NotificationManager...');
      
      // Check if user is logged in
      const currentUser = auth.currentUser;
      if (!currentUser) {
        console.warn('⚠️ No user logged in, skipping FCM initialization');
        return false;
      }

      // Initialize Firebase Messaging
      this.messaging = getMessaging();

      // Check and update FCM token
      await this.checkAndUpdateToken();

      // Listen for foreground messages
      this.setupForegroundListener();

      console.log('✅ NotificationManager initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Error initializing NotificationManager:', error);
      return false;
    }
  }

  /**
   * Check if FCM token exists and is valid, update if needed
   */
  async checkAndUpdateToken() {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      console.log('🔍 Checking FCM token...');

      // Ensure browser capabilities
      if (typeof Notification === 'undefined') {
        console.warn('⚠️ Notifications API not supported in this browser');
        return;
      }
      if (!('serviceWorker' in navigator)) {
        console.warn('⚠️ Service workers not supported in this browser');
      }

      // Request notification permission
      const permission = await Notification.requestPermission();
      
      if (permission !== 'granted') {
        console.warn('⚠️ Notification permission denied');
        return;
      }

      // Get FCM token
      let swReg = null;
      try {
        // Try to get an existing registration for messaging SW; register if missing
        swReg = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
        if (!swReg) {
          swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        }
      } catch (swErr) {
        console.warn('⚠️ Could not get/register messaging service worker:', swErr);
      }

      const token = await getToken(this.messaging, {
        vapidKey: this.vapidKey,
        serviceWorkerRegistration: swReg || undefined
      });

      if (token) {
        console.log('📱 FCM Token obtained:', token.substring(0, 20) + '...');
        
        // Update token in Firestore
        await this.updateTokenInFirestore(token);
      } else {
        console.warn('⚠️ No FCM token available');
      }
    } catch (error) {
      console.error('❌ Error checking/updating FCM token:', error);
      
      // If error is about service worker or FCM not supported, continue without it
      if (error.code === 'messaging/unsupported-browser') {
        console.warn('⚠️ FCM not supported in this browser, using simulation mode');
      }
    }
  }

  /**
   * Update FCM token in Firestore
   */
  async updateTokenInFirestore(token) {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        fcmToken: token,
        fcmTokenUpdatedAt: serverTimestamp(),
        platform: 'web'
      });

      console.log('✅ FCM token updated in Firestore');
    } catch (error) {
      console.error('❌ Error updating FCM token in Firestore:', error);
    }
  }

  /**
   * Setup listener for foreground messages
   */
  setupForegroundListener() {
    if (!this.messaging) return;

    onMessage(this.messaging, (payload) => {
      console.log('📬 Foreground message received:', payload);

      const { notification, data } = payload;
      const currentUserId = this.getCurrentUserId();

      // IMPORTANT: Only save notification if it's for the current user
      // If recipientId is provided, it must match the current user; if missing, assume it targets this device/user
      if (data?.recipientId !== undefined && data.recipientId !== currentUserId) {
        console.warn(`⚠️ Notification not for current user. Recipient: ${data.recipientId}, Current: ${currentUserId}`);
        return; // Don't save or show notification
      }

      // Save notification to localStorage (will use current user's ID)
      if (notification) {
        this.saveNotification({
          type: data?.type || 'system',
          title: notification.title,
          message: notification.body,
          data: data || {}
        });
      }

      // Show browser notification
      if (notification && Notification.permission === 'granted') {
        new Notification(notification.title, {
          body: notification.body,
          icon: '/images/pig logo.png',
          badge: '/images/pig logo.png',
          tag: data?.notificationId || Date.now().toString(),
          requireInteraction: false
        });
      }

      // Notify listeners
      this.notifyListeners();
    });
  }

  /**
   * Get current user ID
   */
  getCurrentUserId() {
    const currentUser = auth.currentUser;
    return currentUser ? currentUser.uid : null;
  }

  /**
   * Load ALL notifications from localStorage
   */
  loadAllNotifications() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('Error loading notifications:', error);
      return [];
    }
  }

  /**
   * Load notifications for CURRENT USER only
   */
  loadNotifications() {
    const userId = this.getCurrentUserId();
    if (!userId) {
      console.warn('No user logged in');
      return [];
    }

    const allNotifications = this.loadAllNotifications();
    const userNotifications = allNotifications.filter(n => n.userId === userId);
    
    console.log(`📋 Loaded ${userNotifications.length} notifications for user ${userId}`);
    return userNotifications;
  }

  /**
   * Save ALL notifications to localStorage
   */
  saveAllNotifications(notifications) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(notifications));
    } catch (error) {
      console.error('Error saving notifications:', error);
    }
  }

  /**
   * Save a new notification
   */
  saveNotification({ type, title, message, data = {} }) {
    const userId = this.getCurrentUserId();
    if (!userId) {
      console.warn('Cannot save notification - no user logged in');
      return null;
    }

    try {
      const notifications = this.loadAllNotifications();

      // Prefer stable server-provided id when available (helps dedupe)
      const stableId = (data.notificationId || data.id || '').toString().trim();
      const notifId = stableId || this.generateId();

      const notification = {
        id: notifId,
        userId: userId,
        type: type, // 'chat', 'subscription', 'system'
        title: title,
        message: message,
        timestamp: Date.now(),
        isRead: false,
        data: data,
        senderId: data.senderId || '',
        senderName: data.senderName || '',
        conversationId: data.conversationId || ''
      };

      // Update if exists for this user, else prepend
      const existingIdx = notifications.findIndex(n => n.id === notifId && n.userId === userId);
      if (existingIdx !== -1) {
        notifications[existingIdx] = { ...notifications[existingIdx], ...notification };
      } else {
        notifications.unshift(notification);
      }

      // Trim per user
      const userNotifications = notifications.filter(n => n.userId === userId);
      const otherNotifications = notifications.filter(n => n.userId !== userId);

      const trimmedUserNotifications = userNotifications.slice(0, this.MAX_NOTIFICATIONS);
      const finalNotifications = [...trimmedUserNotifications, ...otherNotifications];

      this.saveAllNotifications(finalNotifications);

      console.log(`✅ Saved ${type} notification for user ${userId}: ${title}`);

      // Notify listeners
      this.notifyListeners();

      return notification;
    } catch (error) {
      console.error('Error saving notification:', error);
      return null;
    }
  }

  /**
   * Mark notification as read
   */
  markAsRead(notificationId) {
    const userId = this.getCurrentUserId();
    if (!userId) return false;

    try {
      const notifications = this.loadAllNotifications();
      const index = notifications.findIndex(n => n.id === notificationId && n.userId === userId);

      if (index !== -1) {
        notifications[index].isRead = true;
        this.saveAllNotifications(notifications);
        this.notifyListeners();
        console.log(`✅ Marked notification as read: ${notificationId}`);
        return true;
      }

      console.warn(`⚠️ Notification not found: ${notificationId}`);
      return false;
    } catch (error) {
      console.error('Error marking as read:', error);
      return false;
    }
  }

  /**
   * Mark all notifications as read for current user
   */
  markAllAsRead() {
    const userId = this.getCurrentUserId();
    if (!userId) return 0;

    try {
      const notifications = this.loadAllNotifications();
      let count = 0;

      const updatedNotifications = notifications.map(n => {
        if (n.userId === userId && !n.isRead) {
          count++;
          return { ...n, isRead: true };
        }
        return n;
      });

      this.saveAllNotifications(updatedNotifications);
      this.notifyListeners();

      console.log(`✅ Marked ${count} notifications as read for user ${userId}`);
      return count;
    } catch (error) {
      console.error('Error marking all as read:', error);
      return 0;
    }
  }

  /**
   * Delete notification
   */
  deleteNotification(notificationId) {
    const userId = this.getCurrentUserId();
    if (!userId) return false;

    try {
      const notifications = this.loadAllNotifications();
      const filtered = notifications.filter(n => !(n.id === notificationId && n.userId === userId));

      if (filtered.length < notifications.length) {
        this.saveAllNotifications(filtered);
        this.notifyListeners();
        console.log(`✅ Deleted notification: ${notificationId}`);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error deleting notification:', error);
      return false;
    }
  }

  /**
   * Clear all notifications for current user
   */
  clearAll() {
    const userId = this.getCurrentUserId();
    if (!userId) return 0;

    try {
      const notifications = this.loadAllNotifications();
      const userCount = notifications.filter(n => n.userId === userId).length;
      const otherNotifications = notifications.filter(n => n.userId !== userId);

      this.saveAllNotifications(otherNotifications);
      this.notifyListeners();

      console.log(`✅ Cleared ${userCount} notifications for user ${userId}`);
      return userCount;
    } catch (error) {
      console.error('Error clearing notifications:', error);
      return 0;
    }
  }

  /**
   * Get unread count for current user
   */
  getUnreadCount() {
    const notifications = this.loadNotifications();
    return notifications.filter(n => !n.isRead).length;
  }

  /**
   * Get notifications by filter
   */
  getNotificationsByFilter(filter = 'all') {
    const notifications = this.loadNotifications();

    let filtered;
    switch (filter.toLowerCase()) {
      case 'unread':
        filtered = notifications.filter(n => !n.isRead);
        break;
      case 'read':
        filtered = notifications.filter(n => n.isRead);
        break;
      case 'chat':
        filtered = notifications.filter(n => n.type === 'chat');
        break;
      case 'subscription':
        filtered = notifications.filter(n => n.type === 'subscription');
        break;
      case 'system':
        filtered = notifications.filter(n => n.type === 'system');
        break;
      case 'all':
      default:
        filtered = notifications;
        break;
    }

    // Sort: unread first, then by timestamp
    const unread = filtered.filter(n => !n.isRead).sort((a, b) => b.timestamp - a.timestamp);
    const read = filtered.filter(n => n.isRead).sort((a, b) => b.timestamp - a.timestamp);

    return [...unread, ...read];
  }

  /**
   * Register listener for notification changes
   */
  addListener(callback) {
    if (typeof callback === 'function') {
      this.listeners.push(callback);
    }
  }

  /**
   * Remove listener
   */
  removeListener(callback) {
    this.listeners = this.listeners.filter(cb => cb !== callback);
  }

  /**
   * Notify all listeners
   */
  notifyListeners() {
    this.listeners.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('Error in notification listener:', error);
      }
    });
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Format timestamp for display
   */
  formatTimestamp(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;

    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    const week = 7 * day;

    if (diff < minute) {
      return 'Just now';
    } else if (diff < hour) {
      const mins = Math.floor(diff / minute);
      return `${mins} ${mins === 1 ? 'minute' : 'minutes'} ago`;
    } else if (diff < day) {
      const hours = Math.floor(diff / hour);
      return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
    } else if (diff < week) {
      const days = Math.floor(diff / day);
      return `${days} ${days === 1 ? 'day' : 'days'} ago`;
    } else {
      const date = new Date(timestamp);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  }

  /**
   * SIMULATION: Create a test notification (for development/testing)
   */
  simulateNotification(type = 'chat') {
    const simulations = {
      chat: {
        title: 'New Message from Juan Dela Cruz',
        message: 'Hi! I\'m interested in your organic fertilizer. Is it still available?',
        data: {
          senderId: 'test_sender_123',
          senderName: 'Juan Dela Cruz',
          conversationId: 'conv_test_123'
        }
      },
      subscription: {
        title: 'Upgrade to PigSoil+ Pro',
        message: 'Get unlimited AI features and maximize your composting potential! Only ₱299/month.',
        data: {}
      },
      system: {
        title: 'System Update',
        message: 'New features available! Check out our improved marketplace and messaging system.',
        data: {}
      }
    };

    const notification = simulations[type] || simulations.system;
    return this.saveNotification({
      type: type,
      title: notification.title,
      message: notification.message,
      data: notification.data
    });
  }
}

// Create singleton instance
const notificationManager = new NotificationManager();

export default notificationManager;
