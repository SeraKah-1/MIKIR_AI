/**
 * ==========================================
 * BROWSER NOTIFICATION SERVICE
 * ==========================================
 */

const REMINDER_KEY = 'glassquiz_reminder_time';

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!("Notification" in window)) {
    alert("Browser ini tidak mendukung notifikasi desktop.");
    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }

  return false;
};

export const scheduleDailyReminder = (time: string) => { // format "HH:MM"
  localStorage.setItem(REMINDER_KEY, time);
  
  // Send immediate feedback
  if (Notification.permission === "granted") {
    new Notification("Pengingat Diaktifkan! ⏰", {
      body: `GlassQuiz akan mengingatkanmu setiap hari jam ${time}.`,
      icon: "https://cdn-icons-png.flaticon.com/512/3767/3767084.png" // Generic study icon
    });
  }
};

export const getReminderTime = (): string | null => {
  return localStorage.getItem(REMINDER_KEY);
};

export const checkAndTriggerNotification = () => {
  const savedTime = getReminderTime();
  if (!savedTime || Notification.permission !== "granted") return;

  const now = new Date();
  const [targetHours, targetMinutes] = savedTime.split(':').map(Number);
  
  const lastTriggerDate = localStorage.getItem('glassquiz_last_notification_date');
  const todayStr = now.toDateString();

  // If already triggered today, skip
  if (lastTriggerDate === todayStr) return;

  // Simple check: If current time is past the target time (within 1 hour window), trigger it
  // This relies on the user opening the app or tab being open.
  // For true background push without tab open, we'd need a Service Worker + Backend, 
  // but for a simple client-side app, this checks "Did I miss my study time?" when opening.
  
  const targetTime = new Date();
  targetTime.setHours(targetHours, targetMinutes, 0, 0);

  // If now is later than target time
  if (now >= targetTime) {
      new Notification("Waktunya Belajar! 📚", {
        body: "Target harianmu belum tercapai. Yuk kerjakan 1 kuis sekarang!",
        requireInteraction: true,
      });
      localStorage.setItem('glassquiz_last_notification_date', todayStr);
  }
};