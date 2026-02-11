
/**
 * ==========================================
 * KAOMOJI NOTIFICATION SERVICE ( •_•)
 * ==========================================
 * Layanan notifikasi yang lebih "manusiawi" dan lucu.
 */

const KAOMOJI = {
    HAPPY: "( ◕ ‿ ◕ )",
    CELEBRATE: "ヽ(⌐■_■)ノ♪♬",
    CONFUSED: "( @ _ @ )",
    DETERMINED: "( ง •̀ _ •́ )ง",
    SLEEPY: "( ￣ o ￣ ) zzZ",
    SHOCKED: "( ⊙ _ ⊙ )",
    LOVE: "( ♥ ◡ ♥ )",
    STUDY: "( 📝 _ 📝 )"
};
  
// Request permission helper
export const requestKaomojiPermission = async (): Promise<boolean> => {
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission !== "denied") {
        const permission = await Notification.requestPermission();
        return permission === "granted";
    }
    return false;
};

// Generic sender
const sendKaomojiNotify = (title: string, body: string, tag?: string) => {
    if (Notification.permission === "granted") {
        // Check visibility: Only notify if tab is hidden OR it's a major event
        // But for "Quiz Ready", we always want to know.
        new Notification(title, {
            body: body,
            icon: "https://cdn-icons-png.flaticon.com/512/3767/3767084.png", // Study icon
            tag: tag, // Tag prevents spamming the same notification
            requireInteraction: false
        });
    }
};

// --- SPECIFIC TRIGGERS ---

export const notifyQuizReady = (questionCount: number) => {
    sendKaomojiNotify(
        `${KAOMOJI.CELEBRATE} Quiz Siap Disantap!`,
        `${questionCount} soal sudah selesai digenerate. Yuk gas kerjain sekarang sebelum lupa!`,
        'quiz-ready'
    );
};

export const notifySupabaseSuccess = () => {
    sendKaomojiNotify(
        `${KAOMOJI.LOVE} Terhubung ke Cloud!`,
        `Database Supabase berhasil connect. Riwayat belajarmu sekarang aman tersimpan di awan~`,
        'supabase-connect'
    );
};

export const notifySupabaseError = () => {
    sendKaomojiNotify(
        `${KAOMOJI.CONFUSED} Koneksi Gagal...`,
        `Hmm, kunci Supabase-nya kayaknya salah deh. Coba cek URL dan Key-nya lagi ya.`,
        'supabase-error'
    );
};

export const notifyReviewDue = (count: number) => {
    sendKaomojiNotify(
        `${KAOMOJI.DETERMINED} Waktunya Review!`,
        `Ada ${count} kartu flashcard yang otakmu hampir lupa. Review 5 menit aja yuk biar nempel terus!`,
        'srs-due'
    );
};

export const notifyStudyReminder = () => {
    sendKaomojiNotify(
        `${KAOMOJI.STUDY} Alarm Belajar Bunyi!`,
        `Ingat janji kita? Waktunya mengasah otak sebentar. Jangan skip ya!`,
        'daily-reminder'
    );
};

export const notifyAchievement = (streak: number) => {
    sendKaomojiNotify(
        `${KAOMOJI.HAPPY} Streak ${streak} Hari!`,
        `Gila keren banget! Kamu konsisten belajar ${streak} hari berturut-turut. Pertahankan!`,
        'achievement'
    );
};
