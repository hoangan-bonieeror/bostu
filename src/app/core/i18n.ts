import { Injectable, computed, inject } from '@angular/core';
import { I18nText } from './models';
import { StoreService } from './store.service';

/** UI strings. Content strings (lessons, cards...) carry their own {vi, en} text. */
const DICT = {
  'app.name': { vi: 'Bostu', en: 'Bostu' },
  'app.tagline': { vi: 'Phòng lab học Backend', en: 'Backend learning lab' },

  'nav.dashboard': { vi: 'Tổng quan', en: 'Dashboard' },
  'nav.roadmap': { vi: 'Lộ trình', en: 'Roadmap' },
  'nav.lessons': { vi: 'Bài học', en: 'Lessons' },
  'nav.radar': { vi: 'Tech Radar', en: 'Tech Radar' },
  'nav.sql': { vi: 'SQL Lab', en: 'SQL Lab' },
  'nav.cards': { vi: 'Flashcard', en: 'Flashcards' },
  'nav.settings': { vi: 'Cài đặt', en: 'Settings' },
  'nav.toggleTheme': { vi: 'Đổi giao diện sáng/tối', en: 'Toggle light/dark' },
  'nav.toggleLang': { vi: 'Switch to English', en: 'Chuyển sang tiếng Việt' },
  'nav.menu': { vi: 'Menu', en: 'Menu' },

  'common.loading': { vi: 'Đang tải…', en: 'Loading…' },
  'common.error': { vi: 'Không tải được nội dung.', en: 'Could not load content.' },
  'common.minutes': { vi: 'phút', en: 'min' },
  'common.days': { vi: 'ngày', en: 'days' },
  'common.open': { vi: 'Mở', en: 'Open' },
  'common.back': { vi: 'Quay lại', en: 'Back' },
  'common.all': { vi: 'Tất cả', en: 'All' },

  'dash.hello': { vi: 'Chào An 👋', en: 'Hi An 👋' },
  'dash.subtitle': {
    vi: 'Mỗi ngày một chút, kỹ năng sẽ cộng dồn.',
    en: 'A little every day compounds into skill.',
  },
  'dash.streak': { vi: 'Chuỗi ngày học', en: 'Day streak' },
  'dash.lessons': { vi: 'Bài đã học', en: 'Lessons done' },
  'dash.cardsDue': { vi: 'Thẻ cần ôn hôm nay', en: 'Cards due today' },
  'dash.sqlSolved': { vi: 'Bài SQL đã giải', en: 'SQL solved' },
  'dash.todayGoal': { vi: 'Mục tiêu hôm nay', en: "Today's goal" },
  'dash.logTime': { vi: 'Ghi thời gian tự học', en: 'Log study time' },
  'dash.continue': { vi: 'Học tiếp', en: 'Continue learning' },
  'dash.allDone': {
    vi: 'Bạn đã học hết bài hiện có. Hãy thêm bài mới trong public/content!',
    en: 'You finished every lesson. Add new ones in public/content!',
  },
  'dash.reviewNow': { vi: 'Ôn thẻ ngay', en: 'Review now' },
  'dash.activity': { vi: 'Hoạt động 20 tuần gần nhất', en: 'Activity — last 20 weeks' },
  'dash.less': { vi: 'Ít', en: 'Less' },
  'dash.more': { vi: 'Nhiều', en: 'More' },
  'dash.skills': { vi: 'Kỹ năng tự đánh giá', en: 'Self-rated skills' },

  'road.title': { vi: 'Lộ trình Backend', en: 'Backend roadmap' },
  'road.subtitle': {
    vi: 'Đi từ nền tảng đến nâng cao. Tự chấm 0–5 sao cho mỗi kỹ năng.',
    en: 'From foundations to advanced. Rate yourself 0–5 stars per skill.',
  },
  'road.foundation': { vi: 'Nền tảng', en: 'Foundations' },
  'road.core': { vi: 'Cốt lõi', en: 'Core' },
  'road.advanced': { vi: 'Nâng cao', en: 'Advanced' },
  'road.topics': { vi: 'Chủ đề', en: 'Topics' },
  'road.noLessons': { vi: 'Chưa có bài — hãy tự thêm!', en: 'No lessons yet — add your own!' },
  'road.rate': { vi: 'Tự đánh giá', en: 'Self-rating' },

  'lessons.title': { vi: 'Bài học', en: 'Lessons' },
  'lessons.subtitle': {
    vi: 'Đọc, ghi chú, rồi đánh dấu hoàn thành.',
    en: 'Read, take notes, then mark complete.',
  },
  'lessons.done': { vi: 'Đã học', en: 'Done' },
  'lessons.markDone': { vi: 'Đánh dấu đã học', en: 'Mark as done' },
  'lessons.markUndone': { vi: 'Bỏ đánh dấu', en: 'Mark as not done' },
  'lessons.prev': { vi: 'Bài trước', en: 'Previous' },
  'lessons.next': { vi: 'Bài tiếp', en: 'Next' },
  'lessons.practice': { vi: 'Luyện tập trong SQL Lab', en: 'Practice in SQL Lab' },
  'lessons.featured': { vi: 'Bài nên đọc tiếp', en: 'Up next' },
  'lessons.read': { vi: 'Đọc bài', en: 'Read article' },
  'lessons.allPosts': { vi: 'Tất cả bài viết', en: 'All articles' },
  'lessons.words': { vi: 'từ', en: 'words' },
  'lessons.toc': { vi: 'Mục lục', en: 'On this page' },
  'lessons.finished': {
    vi: 'Bạn đã hoàn thành bài này. Ôn lại bằng flashcard nhé!',
    en: 'You finished this lesson. Reinforce it with flashcards!',
  },
  'lessons.finishPrompt': {
    vi: 'Đọc xong rồi? Đánh dấu để theo dõi tiến độ.',
    en: 'Done reading? Mark it to track your progress.',
  },
  'lessons.fallback': {
    vi: 'Bài này chưa có bản tiếng Việt, đang hiển thị bản tiếng Anh.',
    en: 'No English version yet — showing Vietnamese.',
  },

  'radar.latest': { vi: 'Tech Radar mới nhất', en: 'Latest Tech Radar' },
  'radar.newest': { vi: 'Số mới nhất', en: 'Newest issue' },
  'radar.about': {
    vi: 'Các bài Tech Radar do bot tự động tổng hợp mỗi tuần từ GitHub, Hacker News và DEV, rồi xếp theo kỹ năng trên lộ trình của bạn.',
    en: 'Tech Radar posts are compiled weekly by a bot from GitHub, Hacker News and DEV, then grouped by the skills on your roadmap.',
  },
  'sql.title': { vi: 'SQL Lab', en: 'SQL Lab' },
  'sql.subtitle': {
    vi: 'SQLite chạy ngay trong trình duyệt. Dữ liệu được làm mới mỗi lần chạy.',
    en: 'SQLite running in your browser. Data is reset on every run.',
  },
  'sql.exercises': { vi: 'Bài tập', en: 'Exercises' },
  'sql.playground': { vi: 'Sân chơi tự do', en: 'Free playground' },
  'sql.run': { vi: 'Chạy', en: 'Run' },
  'sql.check': { vi: 'Kiểm tra', en: 'Check' },
  'sql.solution': { vi: 'Xem đáp án', en: 'Show solution' },
  'sql.hint': { vi: 'Gợi ý', en: 'Hint' },
  'sql.reset': { vi: 'Xóa', en: 'Clear' },
  'sql.schema': { vi: 'Cấu trúc bảng', en: 'Schema' },
  'sql.rows': { vi: 'dòng', en: 'rows' },
  'sql.noResult': {
    vi: 'Câu lệnh chạy thành công, không có dữ liệu trả về.',
    en: 'Statement ran successfully, no rows returned.',
  },
  'sql.correct': {
    vi: '✅ Chính xác! Kết quả khớp với đáp án.',
    en: '✅ Correct! Your result matches the solution.',
  },
  'sql.wrongCols': { vi: '❌ Số cột không khớp', en: '❌ Column count differs' },
  'sql.wrongRows': { vi: '❌ Số dòng không khớp', en: '❌ Row count differs' },
  'sql.wrongValues': {
    vi: '❌ Dữ liệu chưa khớp. Kiểm tra lại điều kiện lọc hoặc phép tính.',
    en: '❌ Values differ. Re-check your filters or calculations.',
  },
  'sql.wrongOrder': {
    vi: '❌ Thứ tự dòng chưa đúng (bài yêu cầu ORDER BY).',
    en: '❌ Row order is wrong (this exercise needs ORDER BY).',
  },
  'sql.expected': { vi: 'mong đợi', en: 'expected' },
  'sql.got': { vi: 'bạn trả về', en: 'you returned' },
  'sql.solved': { vi: 'Đã giải', en: 'Solved' },
  'sql.loadingEngine': { vi: 'Đang khởi động SQLite…', en: 'Starting SQLite…' },
  'sql.shortcut': { vi: 'Ctrl/⌘ + Enter để chạy', en: 'Ctrl/⌘ + Enter to run' },
  'sql.level': { vi: 'Cấp', en: 'Level' },

  'cards.title': { vi: 'Flashcard', en: 'Flashcards' },
  'cards.subtitle': {
    vi: 'Lặp lại ngắt quãng (SM-2): thẻ khó gặp lại sớm, thẻ dễ giãn ra xa.',
    en: 'Spaced repetition (SM-2): hard cards come back sooner, easy ones later.',
  },
  'cards.deck': { vi: 'Bộ thẻ', en: 'Deck' },
  'cards.due': { vi: 'Đến hạn', en: 'Due' },
  'cards.new': { vi: 'Thẻ mới', en: 'New' },
  'cards.learned': { vi: 'Đã học', en: 'Learned' },
  'cards.start': { vi: 'Bắt đầu ôn', en: 'Start review' },
  'cards.show': { vi: 'Hiện đáp án', en: 'Show answer' },
  'cards.again': { vi: 'Quên', en: 'Again' },
  'cards.hard': { vi: 'Khó', en: 'Hard' },
  'cards.good': { vi: 'Nhớ', en: 'Good' },
  'cards.easy': { vi: 'Dễ', en: 'Easy' },
  'cards.left': { vi: 'thẻ còn lại', en: 'cards left' },
  'cards.finished': { vi: '🎉 Xong phiên ôn hôm nay!', en: '🎉 Session complete!' },
  'cards.nothing': {
    vi: 'Không có thẻ nào cần ôn lúc này. Quay lại vào ngày mai nhé.',
    en: 'Nothing to review right now. Come back tomorrow.',
  },
  'cards.shortcuts': {
    vi: 'Phím tắt: Space = lật thẻ, 1–4 = chấm điểm',
    en: 'Shortcuts: Space = flip, 1–4 = grade',
  },
  'cards.end': { vi: 'Kết thúc', en: 'End session' },

  'set.title': { vi: 'Cài đặt', en: 'Settings' },
  'set.language': { vi: 'Ngôn ngữ', en: 'Language' },
  'set.theme': { vi: 'Giao diện', en: 'Theme' },
  'set.light': { vi: 'Sáng', en: 'Light' },
  'set.dark': { vi: 'Tối', en: 'Dark' },
  'set.study': { vi: 'Thói quen học', en: 'Study habits' },
  'set.dailyNew': { vi: 'Số thẻ mới mỗi ngày', en: 'New cards per day' },
  'set.dailyGoal': { vi: 'Mục tiêu (phút/ngày)', en: 'Daily goal (minutes)' },
  'set.data': { vi: 'Dữ liệu', en: 'Data' },
  'set.dataNote': {
    vi: 'Tiến độ chỉ lưu trong trình duyệt này (localStorage). Hãy xuất file sao lưu định kỳ.',
    en: 'Progress is stored only in this browser (localStorage). Export a backup regularly.',
  },
  'set.export': { vi: 'Xuất file sao lưu', en: 'Export backup' },
  'set.import': { vi: 'Nhập file sao lưu', en: 'Import backup' },
  'set.reset': { vi: 'Xóa toàn bộ tiến độ', en: 'Reset all progress' },
  'set.resetConfirm': {
    vi: 'Xóa toàn bộ tiến độ? Không thể hoàn tác.',
    en: 'Reset all progress? This cannot be undone.',
  },
  'set.imported': { vi: 'Đã nhập dữ liệu thành công.', en: 'Backup imported.' },
  'set.importFailed': { vi: 'File không hợp lệ.', en: 'Invalid backup file.' },
} satisfies Record<string, I18nText>;

export type I18nKey = keyof typeof DICT;

@Injectable({ providedIn: 'root' })
export class I18n {
  private store = inject(StoreService);
  readonly lang = computed(() => this.store.lang());

  /** Translate a UI key. Reading `lang()` makes templates re-render on language switch. */
  t(key: I18nKey): string {
    return DICT[key][this.lang()];
  }

  /** Pick the current-language variant of a content string. */
  pick(text: I18nText | undefined | null): string {
    if (!text) return '';
    return text[this.lang()] || text.vi || text.en;
  }
}
