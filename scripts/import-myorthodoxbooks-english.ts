import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { prisma } from "../src/lib/prisma";
import { putObject, generateStorageKey } from "../src/lib/storage";

// One-off bulk import of the English books from myorthodoxbooks.org (files
// and covers already downloaded/renamed on disk). Same approach as the
// Pope Shenouda III import: straight through Prisma + storage.ts.
// Pope Shenouda titles already in the library were left out of BOOKS on
// purpose (matched by checksum/page count); the checksum guard below also
// skips anything already uploaded.

const DIR = "C:/Users/Eyuel/Downloads/My Orthodox Books/English";
const COVERS_DIR = path.join(DIR, "Covers");
const PROVENANCE =
  "Digitized copy sourced from the English collection of My Orthodox Books (myorthodoxbooks.org), an Orthodox Tewahedo online book library.";

const SHENOUDA = "H.H. Amba Shenouda III";
const MALATY = "Fr. Tadros Y. Malaty";

type Entry = {
  file: string;
  title: string;
  author?: string;
  translator?: string;
  publisher?: string;
  publicationYear?: number;
  description: string;
  tradition: "coptic_orthodox" | "eotc";
  category: string;
  documentType: string;
  rights?: string;
  scriptureReferences?: string[];
};

const BOOKS: Entry[] = [
  {
    file: "Holy Week Contemplations",
    title: "Holy Week Contemplations",
    author: SHENOUDA,
    publisher: "St. Shenouda Monastery, Sydney",
    publicationYear: 2013,
    description:
      "Meditations for each day of Holy Week, following Christ from His entry into Jerusalem through His Passion, Crucifixion and burial, as kept in the Coptic Orthodox Pascha services.",
    tradition: "coptic_orthodox",
    category: "liturgy",
    documentType: "translation",
  },
  {
    file: "Judge Not Others",
    title: "Judge Not Others",
    author: SHENOUDA,
    description:
      "A spiritual study of Christ's command not to judge, examining the causes of condemning others, its harm to the soul, and the humility and love that overcome it.",
    tradition: "coptic_orthodox",
    category: "spirituality",
    documentType: "translation",
  },
  {
    file: "What is Man",
    title: "What is Man?",
    author: SHENOUDA,
    description:
      "A reflection on the nature and dignity of the human person — created in God's image, fallen, and called to holiness — and on what it means to live as a true human being before God.",
    tradition: "coptic_orthodox",
    category: "spirituality",
    documentType: "translation",
  },
  {
    file: "Synaxarium",
    title: "Synaxarium: The Book of the Saints of the Ethiopian Orthodox Tewahedo Church",
    translator: "Sir E. A. Wallis Budge",
    publisher: "Debre Meheret St. Michael Ethiopian Orthodox Tewahedo Church, Garland, TX",
    description:
      "The Ethiopian Synaxarium in E. A. Wallis Budge's English translation: the lives of the saints, martyrs and feasts commemorated on each day of the Ethiopian church year, arranged month by month.",
    tradition: "eotc",
    category: "hagiography",
    documentType: "translation",
  },
  {
    file: "Saint Kristos Semra Hagiography",
    title: "Gedle Kirstos Semra: The Hagiography of Saint Kristos Semra",
    publisher: "De Birhan Media",
    publicationYear: 2011,
    description:
      "An English summary of the Gedle (hagiography and miracles) of Saint Kristos Semra, the Ethiopian woman saint renowned for her asceticism and her intercession for the salvation of souls.",
    tradition: "eotc",
    category: "hagiography",
    documentType: "translation",
  },
  {
    file: "Miracles of Saint Teklehaymanot",
    title: "The Life of Takla Haymanot and the Miracles of Takla Haymanot",
    translator: "Sir E. A. Wallis Budge",
    publisher: "Privately printed for Lady Meux, London",
    publicationYear: 1906,
    description:
      "E. A. Wallis Budge's edition of the Ethiopic Life and Miracles of Saint Takla Haymanot in the Debre Libanos version, with the Book of the Riches of Kings — Ge'ez texts with English translations and colour plates. Takla Haymanot is among the most beloved saints of the Ethiopian and Eritrean churches.",
    tradition: "eotc",
    category: "hagiography",
    documentType: "scholarly_edition",
    rights: "public_domain",
  },
];

// Fr. Tadros Malaty commentaries: file "Biblical Commentary on <X>" → focus line.
const MALATY_BOOKS: Record<string, string> = {
  Genesis: "the account of creation, the fall, and the patriarchs from Abraham to Joseph",
  Exodus: "Israel's deliverance from Egypt, the Passover, the giving of the Law and the Tabernacle",
  Leviticus: "the sacrifices, priesthood and laws of holiness and their fulfilment in Christ",
  Numbers: "Israel's wanderings in the wilderness and the lessons of their journey to the Promised Land",
  Deuteronomy: "Moses' final discourses renewing the covenant before Israel entered the Promised Land",
  Joshua: "the entry into and conquest of the Promised Land under Joshua as a figure of Christ",
  Judges: "the cycles of apostasy and deliverance in Israel under the judges",
  "1st Samuel": "the lives of Samuel, Saul and the young David (1 Samuel / 1 Kingdoms)",
  "2nd Samuel": "the reign of King David (2 Samuel / 2 Kingdoms)",
  "1st Kings": "the reign of Solomon, the building of the Temple and the divided kingdom (1 Kings / 3 Kingdoms)",
  "2nd Kings": "the ministries of Elijah and Elisha and the fall of Israel and Judah (2 Kings / 4 Kingdoms)",
  "1st Chronicles": "the genealogies of Israel and the reign of David",
  "2nd Chronicles": "the kings of Judah from Solomon to the Babylonian exile",
  Ezra: "the return from exile and the rebuilding of the Temple",
  Nehemiah: "the rebuilding of the walls of Jerusalem and the renewal of the covenant",
  Esther: "God's hidden providence in delivering His people through Queen Esther",
  Psalms: "the Psalter, the prayer book of the Church, psalm by psalm",
  Job: "the righteous sufferer Job and the mystery of suffering and divine providence",
  Proverbs: "the wisdom teachings of Solomon for righteous living",
  Ecclesiastes: "the vanity of a life not centred on God",
  "Song of Songs": "the Song of Songs as the love between Christ and His Church and the soul",
  Hosea: "God's faithful love for unfaithful Israel",
  Amos: "the prophet's call to justice and true worship",
  Micah: "judgement, restoration and the prophecy of the Messiah's birth in Bethlehem",
  Joel: "the day of the Lord and the promised outpouring of the Holy Spirit",
  Obadiah: "the prophecy against Edom and the coming kingdom of the Lord",
  Jonah: "the prophet Jonah, God's mercy to Nineveh and the sign of Christ's resurrection",
  Nahum: "the prophecy of the fall of Nineveh",
  Habakkuk: "the prophet's dialogue with God and the call to live by faith",
  Zephaniah: "the day of the Lord and the restoration of a humble remnant",
  Haggai: "the call to rebuild the Lord's house after the exile",
  Zechariah: "the visions of restoration and the messianic prophecies of Zechariah",
  Malachi: "the last of the prophets and the promise of the coming messenger",
  Isaiah: "the prophet Isaiah, called the evangelist of the Old Testament",
  Jeremiah: "the call and mission of the weeping prophet Jeremiah",
  Ezekiel: "the visions of the prophet Ezekiel among the exiles",
  Daniel: "the prophet Daniel, his faithfulness in Babylon and his visions of the kingdom of God",
  "the Gospel of Matthew": "the Gospel of Christ the King according to Saint Matthew",
  "the Gospel of Mark": "the Gospel according to Saint Mark, the evangelist of Egypt",
  "the Gospel of Luke": "the Gospel according to Saint Luke",
  "the Gospel of John": "the Gospel according to Saint John the Theologian",
  Acts: "the Acts of the Apostles and the birth and spread of the early Church",
  Romans: "Saint Paul's Epistle to the Romans",
  "1st Corinthians": "Saint Paul's First Epistle to the Corinthians",
  "2nd Corinthians": "Saint Paul's Second Epistle to the Corinthians",
  Galatians: "Saint Paul's Epistle to the Galatians",
  Ephesians: "Saint Paul's Epistle to the Ephesians",
  Philippians: "Saint Paul's Epistle to the Philippians",
  Colossians: "Saint Paul's Epistle to the Colossians",
  "1st Thessalonians": "Saint Paul's First Epistle to the Thessalonians",
  "2nd Thessalonians": "Saint Paul's Second Epistle to the Thessalonians",
  "1st Timothy": "Saint Paul's First Epistle to Timothy",
  "2nd Timothy": "Saint Paul's Second Epistle to Timothy",
  Titus: "Saint Paul's Epistle to Titus",
  Philemon: "Saint Paul's Epistle to Philemon",
  Hebrews: "the Epistle to the Hebrews",
  James: "the Epistle of Saint James",
  "1st Peter": "the First Epistle of Saint Peter",
  "2nd Peter": "the Second Epistle of Saint Peter",
  "John 1,2,3": "the three Epistles of Saint John",
  Jude: "the Epistle of Saint Jude",
  Revelation: "the Book of Revelation",
};

const refName = (k: string) =>
  k === "John 1,2,3"
    ? "1–3 John"
    : k.replace(/^the Gospel of /, "").replace(/^(\d)(st|nd|rd|th) /, "$1 ");

for (const [k, focus] of Object.entries(MALATY_BOOKS)) {
  BOOKS.push({
    file: `Biblical Commentary on ${k}`,
    title: `Biblical Commentary on ${k}`,
    author: MALATY,
    description: `A patristic commentary by Fr. Tadros Y. Malaty on ${focus}, drawing on the interpretations and meditations of the early Church Fathers.`,
    tradition: "coptic_orthodox",
    category: "scripture",
    documentType: "translation",
    scriptureReferences: [refName(k)],
  });
}

async function getPageCount(buf: Buffer): Promise<number> {
  const doc = await getDocument({ data: new Uint8Array(buf), useWorkerFetch: false, isEvalSupported: false }).promise;
  const n = doc.numPages;
  await doc.destroy();
  return n;
}

async function main() {
  const terms = await prisma.controlledTerm.findMany();
  const termId = (type: string, value: string) => {
    const t = terms.find((t) => t.type === type && t.value === value);
    if (!t) throw new Error(`Missing controlled term ${type}:${value}`);
    return t.id;
  };
  const languageId = termId("LANGUAGE", "english");

  const librarian = await prisma.user.findFirst({ where: { role: "MASTER_LIBRARIAN" } });
  if (!librarian) throw new Error("No MASTER_LIBRARIAN user found");

  const only = process.argv.slice(2);
  let ok = 0;
  let skipped = 0;
  let failed = 0;
  for (const info of BOOKS) {
    if (only.length && !only.some((s) => info.file.includes(s))) continue;
    const pdfPath = path.join(DIR, `${info.file}.pdf`);
    const coverPath = path.join(COVERS_DIR, `${info.file}.png`);
    if (!fs.existsSync(pdfPath) || !fs.existsSync(coverPath)) {
      console.log(`FAIL (missing pdf or cover) ${info.file}`);
      failed++;
      continue;
    }

    try {
      const pdfBuf = fs.readFileSync(pdfPath);
      const checksum = crypto.createHash("sha256").update(pdfBuf).digest("hex");
      const existing = await prisma.book.findFirst({
        where: { OR: [{ checksumSha256: checksum }, { title: info.title, author: info.author ?? null }] },
      });
      if (existing) {
        console.log(`SKIP (already in library as "${existing.title}") ${info.file}`);
        skipped++;
        continue;
      }

      const coverBuf = fs.readFileSync(coverPath);
      const pageCount = await getPageCount(pdfBuf);
      const book = await prisma.book.create({
        data: {
          title: info.title,
          author: info.author,
          translator: info.translator,
          publisher: info.publisher,
          publicationYear: info.publicationYear,
          description: info.description,
          provenance: PROVENANCE,
          scriptureReferences: info.scriptureReferences ?? [],
          pageCount,
          checksumSha256: checksum,
          languageId,
          churchTraditionId: termId("CHURCH_TRADITION", info.tradition),
          documentTypeId: termId("DOCUMENT_TYPE", info.documentType),
          categoryId: termId("CATEGORY", info.category),
          rightsStatusId: termId("RIGHTS_STATUS", info.rights ?? "rights_unknown"),
          visibility: "DRAFT",
          createdById: librarian.id,
        },
      });

      const pdfKey = generateStorageKey("originals");
      const coverKey = generateStorageKey("covers");
      await putObject({ key: pdfKey, body: pdfBuf, contentType: "application/pdf" });
      await putObject({ key: coverKey, body: coverBuf, contentType: "image/png" });

      const version = await prisma.documentVersion.create({
        data: {
          bookId: book.id,
          versionNumber: 1,
          storageKey: pdfKey,
          originalFilename: `${info.file}.pdf`,
          mimeType: "application/pdf",
          fileSizeBytes: pdfBuf.length,
          checksumSha256: checksum,
          uploadedById: librarian.id,
        },
      });

      // Published only once the file, cover and version are all in place.
      await prisma.book.update({
        where: { id: book.id },
        data: { activeVersionId: version.id, coverImageStorageKey: coverKey, visibility: "PUBLIC" },
      });

      console.log(`OK ${info.title} (${pageCount}p, ${(pdfBuf.length / 1024 / 1024).toFixed(1)}MB)`);
      ok++;
    } catch (e) {
      console.log(`FAIL ${info.file} - ${(e as Error).message}`);
      failed++;
    }
  }

  console.log(`\nDone. Imported ${ok}, skipped ${skipped}, failed ${failed}, mapped ${BOOKS.length}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
