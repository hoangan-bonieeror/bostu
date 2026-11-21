import { Injectable, computed, inject } from '@angular/core';
import { I18nText } from './models';
import { StoreService } from './store.service';

/** UI strings. Post content carries its own language versions. */
const DICT = {
  'app.name': { vi: 'Bostu', en: 'Bostu' },
  'app.tagline': { vi: 'Sổ tay kỹ thuật', en: 'Tech notebook' },

  'nav.home': { vi: 'Trang chủ', en: 'Home' },
  'nav.categories': { vi: 'Chuyên mục', en: 'Topics' },
  'nav.series': { vi: 'Series', en: 'Series' },
  'nav.radar': { vi: 'Tech Radar', en: 'Tech Radar' },
  'nav.news': { vi: 'Tin tức', en: 'News' },
  'nav.archive': { vi: 'Lưu trữ', en: 'Archive' },
  'nav.search': { vi: 'Tìm kiếm', en: 'Search' },
  'nav.saved': { vi: 'Đã lưu', en: 'Saved' },
  'nav.menu': { vi: 'Menu', en: 'Menu' },
  'nav.toggleTheme': { vi: 'Đổi giao diện sáng/tối', en: 'Toggle light/dark' },

  'common.loading': { vi: 'Đang tải…', en: 'Loading…' },
  'common.error': { vi: 'Không tải được nội dung.', en: 'Could not load content.' },
  'common.notFound': { vi: 'Không tìm thấy bài viết này.', en: 'This post could not be found.' },
  'common.minRead': { vi: 'phút đọc', en: 'min read' },
  'common.posts': { vi: 'bài', en: 'posts' },
  'common.readMore': { vi: 'Đọc tiếp', en: 'Read more' },
  'common.backHome': { vi: 'Về trang chủ', en: 'Back to home' },

  'type.article': { vi: 'Bài viết', en: 'Article' },
  'type.note': { vi: 'Ghi chép', en: 'Note' },
  'type.radar': { vi: 'Tech Radar', en: 'Tech Radar' },
  'type.news': { vi: 'Bản tin', en: 'News' },

  'home.title': { vi: 'Sổ tay kỹ thuật', en: 'A tech notebook' },
  'home.subtitle': {
    vi: 'Ghi chép về thiết kế hệ thống, giải thuật, database, CI/CD và hệ thống doanh nghiệp.',
    en: 'Writing on system design, algorithms, databases, CI/CD and enterprise systems.',
  },
  'home.featured': { vi: 'Nổi bật', en: 'Featured' },
  'home.latest': { vi: 'Bài mới nhất', en: 'Latest posts' },
  'home.loadMore': { vi: 'Xem thêm bài', en: 'Load more' },
  'home.categories': { vi: 'Chuyên mục', en: 'Topics' },
  'home.series': { vi: 'Series', en: 'Series' },
  'home.tags': { vi: 'Thẻ phổ biến', en: 'Popular tags' },
  'home.radar': { vi: 'Tech Radar mới nhất', en: 'Latest Tech Radar' },
  'home.news': { vi: 'Bản tin hôm nay', en: "Today's news" },
  'home.allNews': { vi: 'Xem các bản tin trước', en: 'Earlier digests' },
  'news.about': {
    vi: 'Mỗi sáng bot đọc Hacker News và các trang tin, blog kỹ thuật lớn, rồi dùng Gemini tóm tắt song ngữ. Bấm vào tiêu đề để đọc bài gốc.',
    en: 'Every morning a bot reads Hacker News and major tech news sites and engineering blogs, then summarises them in both languages with Gemini. Follow a title to read the original.',
  },

  'post.toc': { vi: 'Mục lục', en: 'On this page' },
  'post.backTop': { vi: 'Lên đầu trang', en: 'Back to top' },
  'post.fallback': {
    vi: 'Bài này chưa có bản tiếng Việt, đang hiển thị bản tiếng Anh.',
    en: 'No English version yet — showing Vietnamese.',
  },
  'post.bookmark': { vi: 'Lưu để đọc sau', en: 'Save for later' },
  'post.bookmarked': { vi: 'Đã lưu', en: 'Saved' },
  'post.read': { vi: 'Đã đọc', en: 'Read' },
  'post.inSeries': { vi: 'Thuộc series', en: 'Part of the series' },
  'post.part': { vi: 'Phần', en: 'Part' },
  'post.prev': { vi: 'Bài trước', en: 'Previous' },
  'post.next': { vi: 'Bài tiếp', en: 'Next' },
  'post.related': { vi: 'Bài liên quan', en: 'Related posts' },
  'post.notes': { vi: 'Ghi chú của bạn', en: 'Your notes' },
  'post.notesHint': {
    vi: 'Ghi lại điều bạn rút ra, câu hỏi còn thắc mắc… Ghi chú chỉ lưu trong trình duyệt này.',
    en: 'Write down takeaways or open questions… Notes are stored only in this browser.',
  },
  'post.notesSaved': { vi: 'Đã lưu', en: 'Saved' },
  'post.words': { vi: 'từ', en: 'words' },
  'post.allPosts': { vi: 'Tất cả bài viết', en: 'All posts' },

  'series.subtitle': {
    vi: 'Các chuỗi bài nên đọc theo thứ tự.',
    en: 'Multi-part posts best read in order.',
  },
  'series.parts': { vi: 'phần', en: 'parts' },
  'series.start': { vi: 'Bắt đầu đọc', en: 'Start reading' },

  'archive.title': { vi: 'Lưu trữ', en: 'Archive' },
  'archive.subtitle': { vi: 'Tất cả bài viết theo thời gian.', en: 'Every post, by date.' },

  'tag.title': { vi: 'Thẻ', en: 'Tag' },

  'search.placeholder': {
    vi: 'Tìm bài viết, chủ đề, công nghệ…',
    en: 'Search posts, topics, technologies…',
  },
  'search.results': { vi: 'kết quả', en: 'results' },
  'search.none': {
    vi: 'Không có bài nào khớp. Thử từ khóa khác?',
    en: 'No posts match. Try another keyword?',
  },
  'search.hint': { vi: 'Gõ ít nhất 2 ký tự để tìm.', en: 'Type at least 2 characters.' },

  'saved.title': { vi: 'Đã lưu', en: 'Saved' },
  'saved.subtitle': {
    vi: 'Bài đánh dấu đọc sau và ghi chú của bạn.',
    en: 'Your bookmarks and notes.',
  },
  'saved.bookmarks': { vi: 'Đọc sau', en: 'Read later' },
  'saved.notes': { vi: 'Ghi chú', en: 'Notes' },
  'saved.history': { vi: 'Đã đọc gần đây', en: 'Recently read' },
  'saved.emptyBookmarks': {
    vi: 'Chưa lưu bài nào. Bấm 🔖 trên một bài viết để lưu.',
    en: 'Nothing saved yet. Tap 🔖 on a post to save it.',
  },
  'saved.emptyNotes': {
    vi: 'Chưa có ghi chú. Ghi chú nằm ở cuối mỗi bài viết.',
    en: 'No notes yet. You can write one at the end of any post.',
  },
  'saved.data': { vi: 'Sao lưu dữ liệu', en: 'Backup' },
  'saved.dataNote': {
    vi: 'Bookmark, ghi chú và lịch sử đọc chỉ lưu trong trình duyệt này. Hãy xuất file sao lưu định kỳ.',
    en: 'Bookmarks, notes and history live only in this browser. Export a backup regularly.',
  },
  'saved.export': { vi: 'Xuất file', en: 'Export' },
  'saved.import': { vi: 'Nhập file', en: 'Import' },
  'saved.reset': { vi: 'Xóa tất cả', en: 'Clear all' },
  'saved.resetConfirm': {
    vi: 'Xóa toàn bộ bookmark, ghi chú và lịch sử đọc?',
    en: 'Delete all bookmarks, notes and history?',
  },
  'saved.imported': { vi: 'Đã nhập dữ liệu.', en: 'Backup imported.' },
  'saved.importFailed': { vi: 'File không hợp lệ.', en: 'Invalid backup file.' },

  'radar.about': {
    vi: 'Các bài Tech Radar do bot tự động tổng hợp mỗi tuần từ GitHub, Hacker News và DEV, đọc nội dung từng link rồi xếp theo chuyên mục.',
    en: 'Tech Radar posts are compiled weekly by a bot from GitHub, Hacker News and DEV; it reads each link and groups items by topic.',
  },
  'radar.lastRun': { vi: 'Lần quét gần nhất', en: 'Last scan' },
  'radar.relevant': { vi: 'Mục mới phù hợp sau khi lọc', en: 'Relevant new items after filtering' },
  'radar.published': { vi: 'Đã đăng', en: 'Published' },
  'radar.noPost': { vi: 'Không có gì mới nên không đăng bài', en: 'Nothing new, so no post' },
  'radar.crawled': { vi: 'Đã đọc nội dung', en: 'Articles read' },
  'radar.aiOff': { vi: 'tắt (chưa có GEMINI_API_KEY)', en: 'off (no GEMINI_API_KEY)' },
  'radar.neverRun': {
    vi: 'Chưa có dữ liệu trạng thái quét. Ô này sẽ hiện sau lần chạy tới của bot.',
    en: 'No scan status yet. It will appear after the bot’s next run.',
  },
  'radar.today': { vi: 'hôm nay', en: 'today' },
  'radar.daysAgo': { vi: 'ngày trước', en: 'days ago' },

  'sql.run': { vi: 'Chạy', en: 'Run' },
  'sql.reset': { vi: 'Khôi phục', en: 'Reset' },
  'sql.setup': { vi: 'Dữ liệu mẫu', en: 'Sample data' },
  'sql.tables': { vi: 'Bảng', en: 'Tables' },
  'sql.rows': { vi: 'dòng', en: 'rows' },
  'sql.noResult': {
    vi: 'Chạy thành công, không có dòng nào trả về.',
    en: 'Ran successfully, no rows returned.',
  },
  'sql.loading': { vi: 'Đang khởi động SQLite…', en: 'Starting SQLite…' },
  'sql.hint': {
    vi: 'Sửa câu lệnh rồi bấm Chạy (Ctrl/⌘ + Enter). Mỗi lần chạy dùng dữ liệu mới.',
    en: 'Edit and press Run (Ctrl/⌘ + Enter). Each run starts from fresh data.',
  },

  'footer.about': {
    vi: 'Bostu là sổ tay kỹ thuật cá nhân, song ngữ Việt–Anh, mã nguồn mở trên GitHub.',
    en: 'Bostu is a personal, bilingual (VI/EN) tech notebook, open source on GitHub.',
  },
  'footer.rss': { vi: 'RSS', en: 'RSS' },
} satisfies Record<string, I18nText>;

export type I18nKey = keyof typeof DICT;

@Injectable({ providedIn: 'root' })
export class I18n {
  private store = inject(StoreService);
  readonly lang = computed(() => this.store.lang());

  /** Translate a UI key. Reading `lang()` makes templates update on language switch. */
  t(key: I18nKey): string {
    return DICT[key][this.lang()];
  }

  /** Pick the current-language variant of a content string. */
  pick(text: I18nText | undefined | null): string {
    if (!text) return '';
    return text[this.lang()] || text.vi || text.en;
  }

  /** Locale-aware date, e.g. "19 thg 11, 2026" / "Nov 19, 2026". */
  date(iso: string, style: 'short' | 'long' = 'short'): string {
    const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
    return d.toLocaleDateString(this.lang() === 'vi' ? 'vi-VN' : 'en-US', {
      day: 'numeric',
      month: style === 'long' ? 'long' : 'short',
      year: 'numeric',
    });
  }
}
