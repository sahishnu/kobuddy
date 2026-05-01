/**
 * Populate the local SQLite DB with synthetic books and page stats for UI/stats testing.
 *
 * Usage (from repo root, with `.env` configured like normal dev):
 *   pnpm seed:dev
 *   pnpm seed:dev -- --books 120 --days 180 --stats-per-book 50 --reset
 *
 * Stop the dev server before `--reset` if it is using the same database file.
 *
 * Book titles and authors come from a fixed catalog of real works; reading times
 * and `md5` fingerprints are still synthetic (not tied to your devices).
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { config } from '../config.js';
import { createDatabase } from '../lib/db.js';
import { resolveSqlitePath } from '../lib/paths.js';
import { invalidateStatsCache } from '../stats/stats-cache.js';
import {
  seedBook,
  seedBookDevice,
  seedDevice,
  seedPageStat,
} from '../test-util/seed.js';

function parseArgs(argv: string[]) {
  const out = {
    books: 40,
    days: 90,
    statsPerBook: 35,
    reset: false,
    deviceId: 'local-dev-device',
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--reset') out.reset = true;
    else if (a === '--books' && argv[i + 1] !== undefined) {
      i += 1;
      const v = argv[i];
      if (v !== undefined) out.books = Math.max(1, Number.parseInt(v, 10));
    } else if (a === '--days' && argv[i + 1] !== undefined) {
      i += 1;
      const v = argv[i];
      if (v !== undefined) out.days = Math.max(1, Number.parseInt(v, 10));
    } else if (a === '--stats-per-book' && argv[i + 1] !== undefined) {
      i += 1;
      const v = argv[i];
      if (v !== undefined)
        out.statsPerBook = Math.max(1, Number.parseInt(v, 10));
    } else if (a === '--device-id' && argv[i + 1] !== undefined) {
      i += 1;
      const v = argv[i];
      if (v !== undefined) out.deviceId = v;
    }
  }
  return out;
}

/** Real titles/authors for believable UI; `md5` values remain synthetic per seed index. */
const DEV_SEED_BOOKS: readonly { title: string; authors: string }[] = [
  { title: 'Pride and Prejudice', authors: 'Jane Austen' },
  { title: '1984', authors: 'George Orwell' },
  { title: 'The Hobbit', authors: 'J. R. R. Tolkien' },
  { title: 'Dune', authors: 'Frank Herbert' },
  { title: 'The Three-Body Problem', authors: 'Liu Cixin' },
  { title: 'The Remains of the Day', authors: 'Kazuo Ishiguro' },
  { title: 'Circe', authors: 'Madeline Miller' },
  { title: 'Project Hail Mary', authors: 'Andy Weir' },
  { title: 'Klara and the Sun', authors: 'Kazuo Ishiguro' },
  { title: 'The Overstory', authors: 'Richard Powers' },
  { title: 'Educated', authors: 'Tara Westover' },
  { title: 'Sapiens', authors: 'Yuval Noah Harari' },
  { title: 'Thinking, Fast and Slow', authors: 'Daniel Kahneman' },
  { title: 'The Body Keeps the Score', authors: 'Bessel van der Kolk' },
  { title: 'Atomic Habits', authors: 'James Clear' },
  { title: 'All the Light We Cannot See', authors: 'Anthony Doerr' },
  { title: 'The Goldfinch', authors: 'Donna Tartt' },
  { title: 'The Sympathizer', authors: 'Viet Thanh Nguyen' },
  { title: 'Wolf Hall', authors: 'Hilary Mantel' },
  { title: 'Beloved', authors: 'Toni Morrison' },
  { title: 'Kindred', authors: 'Octavia E. Butler' },
  { title: 'The Left Hand of Darkness', authors: 'Ursula K. Le Guin' },
  { title: 'Neuromancer', authors: 'William Gibson' },
  { title: 'Snow Crash', authors: 'Neal Stephenson' },
  { title: 'The Martian', authors: 'Andy Weir' },
  { title: "The Hitchhiker's Guide to the Galaxy", authors: 'Douglas Adams' },
  { title: 'Foundation', authors: 'Isaac Asimov' },
  { title: 'Annihilation', authors: 'Jeff VanderMeer' },
  { title: 'Normal People', authors: 'Sally Rooney' },
  { title: 'Station Eleven', authors: 'Emily St. John Mandel' },
  { title: 'The Night Circus', authors: 'Erin Morgenstern' },
  { title: 'Gone Girl', authors: 'Gillian Flynn' },
  { title: 'The Name of the Wind', authors: 'Patrick Rothfuss' },
  { title: 'A Little Life', authors: 'Hanya Yanagihara' },
  { title: 'A Brief History of Time', authors: 'Stephen Hawking' },
  { title: 'The Design of Everyday Things', authors: 'Don Norman' },
  { title: 'Clean Code', authors: 'Robert C. Martin' },
  {
    title: 'Designing Data-Intensive Applications',
    authors: 'Martin Kleppmann',
  },
  { title: 'Invisible Women', authors: 'Caroline Criado Perez' },
  { title: 'Braiding Sweetgrass', authors: 'Robin Wall Kimmerer' },
  { title: 'The Dispossessed', authors: 'Ursula K. Le Guin' },
  { title: 'Middlemarch', authors: 'George Eliot' },
  { title: 'Crime and Punishment', authors: 'Fyodor Dostoevsky' },
  { title: 'War and Peace', authors: 'Leo Tolstoy' },
  { title: 'Anna Karenina', authors: 'Leo Tolstoy' },
  { title: 'The Brothers Karamazov', authors: 'Fyodor Dostoevsky' },
  { title: 'One Hundred Years of Solitude', authors: 'Gabriel García Márquez' },
  { title: 'Love in the Time of Cholera', authors: 'Gabriel García Márquez' },
  { title: 'The Master and Margarita', authors: 'Mikhail Bulgakov' },
  { title: 'Don Quixote', authors: 'Miguel de Cervantes' },
  { title: 'Les Misérables', authors: 'Victor Hugo' },
  { title: 'The Count of Monte Cristo', authors: 'Alexandre Dumas' },
  { title: 'Jane Eyre', authors: 'Charlotte Brontë' },
  { title: 'Wuthering Heights', authors: 'Emily Brontë' },
  { title: 'Great Expectations', authors: 'Charles Dickens' },
  { title: 'A Tale of Two Cities', authors: 'Charles Dickens' },
  { title: 'Bleak House', authors: 'Charles Dickens' },
  { title: 'Moby-Dick', authors: 'Herman Melville' },
  { title: 'The Adventures of Huckleberry Finn', authors: 'Mark Twain' },
  { title: 'The Great Gatsby', authors: 'F. Scott Fitzgerald' },
  { title: 'Tender Is the Night', authors: 'F. Scott Fitzgerald' },
  { title: 'The Sun Also Rises', authors: 'Ernest Hemingway' },
  { title: 'For Whom the Bell Tolls', authors: 'Ernest Hemingway' },
  { title: 'The Old Man and the Sea', authors: 'Ernest Hemingway' },
  { title: 'To the Lighthouse', authors: 'Virginia Woolf' },
  { title: 'Mrs Dalloway', authors: 'Virginia Woolf' },
  { title: 'Orlando', authors: 'Virginia Woolf' },
  { title: 'Ulysses', authors: 'James Joyce' },
  { title: 'Dubliners', authors: 'James Joyce' },
  { title: 'The Trial', authors: 'Franz Kafka' },
  { title: 'The Metamorphosis', authors: 'Franz Kafka' },
  { title: 'The Stranger', authors: 'Albert Camus' },
  { title: 'The Plague', authors: 'Albert Camus' },
  { title: 'Nausea', authors: 'Jean-Paul Sartre' },
  { title: 'Brave New World', authors: 'Aldous Huxley' },
  { title: 'Fahrenheit 451', authors: 'Ray Bradbury' },
  { title: 'The Handmaid’s Tale', authors: 'Margaret Atwood' },
  { title: 'Oryx and Crake', authors: 'Margaret Atwood' },
  { title: 'Never Let Me Go', authors: 'Kazuo Ishiguro' },
  { title: 'Lincoln in the Bardo', authors: 'George Saunders' },
  { title: 'A Visit from the Goon Squad', authors: 'Jennifer Egan' },
  { title: 'The Road', authors: 'Cormac McCarthy' },
  { title: 'Blood Meridian', authors: 'Cormac McCarthy' },
  { title: 'No Country for Old Men', authors: 'Cormac McCarthy' },
  { title: 'Beloved Country', authors: 'Alan Paton' },
  { title: 'Things Fall Apart', authors: 'Chinua Achebe' },
  { title: 'Half of a Yellow Sun', authors: 'Chimamanda Ngozi Adichie' },
  { title: 'Americanah', authors: 'Chimamanda Ngozi Adichie' },
  { title: 'The God of Small Things', authors: 'Arundhati Roy' },
  { title: 'A Suitable Boy', authors: 'Vikram Seth' },
  { title: 'Midnight’s Children', authors: 'Salman Rushdie' },
  { title: 'The Kite Runner', authors: 'Khaled Hosseini' },
  { title: 'A Thousand Splendid Suns', authors: 'Khaled Hosseini' },
  { title: 'Pachinko', authors: 'Min Jin Lee' },
  { title: 'The Vegetarian', authors: 'Han Kang' },
  { title: 'Convenience Store Woman', authors: 'Sayaka Murata' },
  { title: 'Kafka on the Shore', authors: 'Haruki Murakami' },
  { title: 'Norwegian Wood', authors: 'Haruki Murakami' },
  { title: '1Q84', authors: 'Haruki Murakami' },
  { title: 'The Wind-Up Bird Chronicle', authors: 'Haruki Murakami' },
  { title: 'Snow Country', authors: 'Yasunari Kawabata' },
  { title: 'The Tale of Genji', authors: 'Murasaki Shikibu' },
  { title: 'A Gentleman in Moscow', authors: 'Amor Towles' },
  { title: 'The Lincoln Highway', authors: 'Amor Towles' },
  { title: 'Cloud Atlas', authors: 'David Mitchell' },
  { title: 'The Bone Clocks', authors: 'David Mitchell' },
  { title: 'Piranesi', authors: 'Susanna Clarke' },
  { title: 'Jonathan Strange & Mr Norrell', authors: 'Susanna Clarke' },
  { title: 'The Fifth Season', authors: 'N. K. Jemisin' },
  { title: 'A Memory Called Empire', authors: 'Arkady Martine' },
  { title: 'Children of Time', authors: 'Adrian Tchaikovsky' },
  { title: 'Hyperion', authors: 'Dan Simmons' },
  { title: 'Anathem', authors: 'Neal Stephenson' },
  { title: 'Cryptonomicon', authors: 'Neal Stephenson' },
  { title: 'American Gods', authors: 'Neil Gaiman' },
  { title: 'The Ocean at the End of the Lane', authors: 'Neil Gaiman' },
  { title: 'Good Omens', authors: 'Neil Gaiman & Terry Pratchett' },
  { title: 'Going Postal', authors: 'Terry Pratchett' },
  { title: 'Small Gods', authors: 'Terry Pratchett' },
  { title: 'The Lies of Locke Lamora', authors: 'Scott Lynch' },
  { title: 'Mistborn: The Final Empire', authors: 'Brandon Sanderson' },
  { title: 'The Way of Kings', authors: 'Brandon Sanderson' },
  { title: 'A Wizard of Earthsea', authors: 'Ursula K. Le Guin' },
  { title: 'The Fellowship of the Ring', authors: 'J. R. R. Tolkien' },
  { title: 'A Game of Thrones', authors: 'George R. R. Martin' },
  { title: 'The Power', authors: 'Naomi Alderman' },
  { title: 'Exhalation', authors: 'Ted Chiang' },
  { title: 'Stories of Your Life and Others', authors: 'Ted Chiang' },
  { title: 'Bel Canto', authors: 'Ann Patchett' },
  { title: 'Commonwealth', authors: 'Ann Patchett' },
  { title: 'A Tree Grows in Brooklyn', authors: 'Betty Smith' },
  { title: 'East of Eden', authors: 'John Steinbeck' },
  { title: 'The Grapes of Wrath', authors: 'John Steinbeck' },
  { title: 'Of Mice and Men', authors: 'John Steinbeck' },
  { title: 'Slaughterhouse-Five', authors: 'Kurt Vonnegut' },
  { title: 'Cat’s Cradle', authors: 'Kurt Vonnegut' },
  { title: 'Catch-22', authors: 'Joseph Heller' },
  { title: 'Gravity’s Rainbow', authors: 'Thomas Pynchon' },
  { title: 'Infinite Jest', authors: 'David Foster Wallace' },
  { title: 'House of Leaves', authors: 'Mark Z. Danielewski' },
  { title: 'The Crying of Lot 49', authors: 'Thomas Pynchon' },
  { title: 'White Teeth', authors: 'Zadie Smith' },
  { title: 'On Beauty', authors: 'Zadie Smith' },
  { title: 'Atonement', authors: 'Ian McEwan' },
  { title: 'Saturday', authors: 'Ian McEwan' },
  { title: 'The Sense of an Ending', authors: 'Julian Barnes' },
  { title: 'Disgrace', authors: 'J. M. Coetzee' },
  { title: 'Waiting for the Barbarians', authors: 'J. M. Coetzee' },
  { title: 'The Underground Railroad', authors: 'Colson Whitehead' },
  { title: 'The Nickel Boys', authors: 'Colson Whitehead' },
  { title: 'Homegoing', authors: 'Yaa Gyasi' },
  { title: 'Transcendent Kingdom', authors: 'Yaa Gyasi' },
  { title: 'There There', authors: 'Tommy Orange' },
  { title: 'The Brief Wondrous Life of Oscar Wao', authors: 'Junot Díaz' },
  { title: 'In the Time of the Butterflies', authors: 'Julia Alvarez' },
  { title: 'How to Read the Air', authors: 'Dinaw Mengestu' },
  { title: 'Quiet', authors: 'Susan Cain' },
  { title: 'The Power of Habit', authors: 'Charles Duhigg' },
  { title: 'Outliers', authors: 'Malcolm Gladwell' },
  { title: 'The Tipping Point', authors: 'Malcolm Gladwell' },
  { title: 'Talking to Strangers', authors: 'Malcolm Gladwell' },
  { title: 'Bad Blood', authors: 'John Carreyrou' },
  { title: 'Empire of Pain', authors: 'Patrick Radden Keefe' },
  { title: 'Say Nothing', authors: 'Patrick Radden Keefe' },
  { title: 'The Warmth of Other Suns', authors: 'Isabel Wilkerson' },
  { title: 'Caste', authors: 'Isabel Wilkerson' },
  { title: 'Between the World and Me', authors: 'Ta-Nehisi Coates' },
  { title: 'The New Jim Crow', authors: 'Michelle Alexander' },
  { title: 'Just Mercy', authors: 'Bryan Stevenson' },
  { title: 'On Writing', authors: 'Stephen King' },
  { title: 'The Stand', authors: 'Stephen King' },
  { title: '11/22/63', authors: 'Stephen King' },
  { title: 'Mexican Gothic', authors: 'Silvia Moreno-Garcia' },
  {
    title: 'The Seven Husbands of Evelyn Hugo',
    authors: 'Taylor Jenkins Reid',
  },
  { title: 'Daisy Jones & The Six', authors: 'Taylor Jenkins Reid' },
  { title: 'Tomorrow, and Tomorrow, and Tomorrow', authors: 'Gabrielle Zevin' },
  { title: 'Lessons in Chemistry', authors: 'Bonnie Garmus' },
  { title: 'Demon Copperhead', authors: 'Barbara Kingsolver' },
  { title: 'The Poisonwood Bible', authors: 'Barbara Kingsolver' },
  { title: 'Trust', authors: 'Hernan Diaz' },
  { title: 'Hamnet', authors: 'Maggie O’Farrell' },
  { title: 'The Marriage Portrait', authors: 'Maggie O’Farrell' },
];

function shuffled<T>(items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = out[i] as T;
    out[i] = out[j] as T;
    out[j] = tmp;
  }
  return out;
}

function fakeMd5(i: number): string {
  return createHash('md5').update(`kobuddy-dev-seed-${i}`).digest('hex');
}

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const sqlitePath = resolveSqlitePath(config.DATA_PATH, config.DATABASE_FILE);

  if (opts.reset && fs.existsSync(sqlitePath)) {
    fs.unlinkSync(sqlitePath);
    console.info(`Removed existing database: ${sqlitePath}`);
  }

  const { db, raw } = createDatabase(config, sqlitePath);

  seedDevice(db, opts.deviceId, 'kobuddy-dev-seeder');

  const catalogSize = DEV_SEED_BOOKS.length;
  if (opts.books > catalogSize) {
    console.warn(
      `Requested ${opts.books} books but catalog only has ${catalogSize} unique titles; capping to avoid duplicates.`,
    );
    opts.books = catalogSize;
  }
  const catalog = shuffled(DEV_SEED_BOOKS).slice(0, opts.books);

  const nowSec = Math.floor(Date.now() / 1000);
  const windowStart = nowSec - opts.days * 86400;
  let pageStatsInserted = 0;

  for (let i = 0; i < opts.books; i++) {
    const md5 = fakeMd5(i);
    const totalPages = randInt(120, 520);
    const entry = catalog[i] ?? { title: 'Untitled', authors: 'Unknown' };
    const { title, authors } = entry;

    seedBook(db, {
      md5,
      title,
      authors,
      hidden: i % 23 === 0,
      completedAt:
        i % 7 === 0 ? windowStart + randInt(0, opts.days * 86400) : null,
    });

    let maxPage = 0;
    let sumDuration = 0;
    let lastStart = windowStart;
    const bookTimeBase =
      windowStart +
      randInt(0, Math.max(0, opts.days * 86400 - opts.statsPerBook * 400)) +
      i * 17;

    for (let s = 0; s < opts.statsPerBook; s++) {
      const startTime = bookTimeBase + s * 400 + randInt(0, 80);
      const page = Math.min(
        totalPages - 1,
        Math.max(
          0,
          Math.floor((s / opts.statsPerBook) * totalPages) + randInt(-2, 4),
        ),
      );
      const duration = randInt(45, 720);
      seedPageStat(db, {
        bookMd5: md5,
        deviceId: opts.deviceId,
        page,
        startTime,
        duration,
        totalPages,
      });
      pageStatsInserted++;
      maxPage = Math.max(maxPage, page);
      sumDuration += duration;
      lastStart = Math.max(lastStart, startTime);
    }

    seedBookDevice(db, {
      bookMd5: md5,
      deviceId: opts.deviceId,
      pages: totalPages,
      totalReadPages: Math.min(totalPages, maxPage + randInt(0, 8)),
      lastOpen: lastStart,
      totalReadTime: sumDuration,
    });
  }

  await invalidateStatsCache(db);
  raw.close();

  console.info(
    `Seeded ${opts.books} books, ${pageStatsInserted} page_stat rows (device ${opts.deviceId}) into:\n  ${sqlitePath}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
