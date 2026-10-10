// Real-Time Browser Notification and Alert Service

export type NotificationPermissionStatus = 'default' | 'granted' | 'denied' | 'unsupported';

export interface AlertPayload {
  title: string;
  body: string;
  type: 'TRADE_OPEN' | 'TRADE_CLOSE' | 'MARGIN_WARNING';
  data?: any;
}

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermissionStatus {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission as NotificationPermissionStatus;
}

export async function requestNotificationPermission(): Promise<NotificationPermissionStatus> {
  if (!isNotificationSupported()) return 'unsupported';
  try {
    const perm = await Notification.requestPermission();
    return perm as NotificationPermissionStatus;
  } catch (err) {
    console.warn('Error requesting browser notification permission:', err);
    return 'denied';
  }
}

export function sendBrowserNotification(alert: AlertPayload) {
  // 1. Try native Web Browser Notification if permitted
  if (isNotificationSupported() && Notification.permission === 'granted') {
    try {
      const options: NotificationOptions = {
        body: alert.body,
        icon: '/favicon.ico',
        tag: alert.type, // Group similar notifications
        silent: false,
      };
      new Notification(alert.title, options);
    } catch (e) {
      // In some cross-origin iframes, Notification constructor may throw a SecurityError
      console.warn('Browser notification prevented by sandbox/iframe policy:', e);
    }
  }
}

// Compute margin usage percent based on open positions and current equity
export function calculateMarginUsage(openPositions: Array<{ qty: number; currentPrice: number; entryPrice: number }>, equity: number): number {
  if (equity <= 0) return 0;
  // Standard 5x leverage margin requirement (20% margin maintenance per position)
  const totalMarginRequired = openPositions.reduce((acc, p) => {
    const price = p.currentPrice || p.entryPrice || 0;
    return acc + (p.qty * price) * 0.2;
  }, 0);

  const usagePercent = (totalMarginRequired / equity) * 100;
  return Number(usagePercent.toFixed(1));
}
