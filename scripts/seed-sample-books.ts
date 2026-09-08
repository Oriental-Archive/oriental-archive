// One-off dev script for design-audit browsing — not part of the app's seed path.
import { prisma } from "../src/lib/prisma";

async function term(type: "LANGUAGE" | "CHURCH_TRADITION" | "CATEGORY" | "DOCUMENT_TYPE" | "TOPIC", value: string, label: string) {
  return prisma.controlledTerm.upsert({
    where: { type_value: { type, value } },
    update: {},
    create: { type, value, label },
  });
}

async function main() {
  const master = await prisma.user.findFirstOrThrow({ where: { role: "MASTER_LIBRARIAN" } });

  const geez = await term("LANGUAGE", "geez", "Ge'ez");
  const amharic = await term("LANGUAGE", "amharic", "Amharic");
  const english = await term("LANGUAGE", "english", "English");
  const coptic = await term("LANGUAGE", "coptic", "Coptic");

  const eotc = await term("CHURCH_TRADITION", "eotc", "Ethiopian Orthodox Tewahedo");
  const coptic_tr = await term("CHURCH_TRADITION", "coptic_orthodox", "Coptic Orthodox");
  const syriac = await term("CHURCH_TRADITION", "syriac", "Syriac Orthodox");

  const liturgy = await term("CATEGORY", "liturgy", "Liturgy");
  const hagiography = await term("CATEGORY", "hagiography", "Hagiography");
  const patristics = await term("CATEGORY", "patristics", "Patristics");

  const manuscript = await term("DOCUMENT_TYPE", "manuscript", "Manuscript");
  const printed = await term("DOCUMENT_TYPE", "printed_book", "Printed Book");
  const scholarly = await term("DOCUMENT_TYPE", "scholarly_edition", "Scholarly Edition");

  const fasting = await term("TOPIC", "fasting", "Fasting");
  const monasticism = await term("TOPIC", "monasticism", "Monasticism");
  const christology = await term("TOPIC", "christology", "Christology");

  const books = [
    {
      title: "The Book of the Mysteries of the Heavens and the Earth",
      author: "Enbaqom",
      translator: "Wallis Budge",
      publisher: "Oxford University Press",
      publicationYear: 1935,
      languageId: geez.id,
      churchTraditionId: eotc.id,
      categoryId: patristics.id,
      documentTypeId: scholarly.id,
      description:
        "A cosmological and theological treatise attributed to the Ethiopian tradition, describing the order of creation and the mysteries of the heavens.",
      topics: { connect: [{ id: christology.id }] },
      visibility: "PUBLIC" as const,
    },
    {
      title: "Filkesus: The Homily on the Cross",
      author: null,
      translator: null,
      publisher: null,
      publicationYear: null,
      languageId: geez.id,
      churchTraditionId: eotc.id,
      categoryId: liturgy.id,
      documentTypeId: manuscript.id,
      description: null,
      topics: { connect: [] },
      visibility: "PUBLIC" as const,
    },
    {
      title: "The Life and Struggles of Abba Anthony",
      author: "Athanasius of Alexandria",
      translator: "H. Ellershaw",
      publisher: "Nicene and Post-Nicene Fathers",
      publicationYear: 1892,
      languageId: coptic.id,
      churchTraditionId: coptic_tr.id,
      categoryId: hagiography.id,
      documentTypeId: printed.id,
      description:
        "The foundational account of Egyptian monasticism, narrating the ascetic life of Saint Anthony the Great in the desert.",
      topics: { connect: [{ id: monasticism.id }] },
      visibility: "PUBLIC" as const,
    },
    {
      title: "Sinkessar (Synaxarium): Readings for the Fasting Season",
      author: null,
      translator: null,
      publisher: null,
      publicationYear: null,
      languageId: amharic.id,
      churchTraditionId: eotc.id,
      categoryId: liturgy.id,
      documentTypeId: manuscript.id,
      description: "Daily commemorations of saints and feasts observed during the Great Fast.",
      topics: { connect: [{ id: fasting.id }] },
      visibility: "PUBLIC" as const,
    },
    {
      title: "On the Incarnation",
      author: "Athanasius of Alexandria",
      translator: "A Religious of C.S.M.V.",
      publisher: "St Vladimir's Seminary Press",
      publicationYear: 1944,
      languageId: english.id,
      churchTraditionId: coptic_tr.id,
      categoryId: patristics.id,
      documentTypeId: printed.id,
      description:
        "A classical patristic defense of the Incarnation of the Word, foundational to Oriental Orthodox Christology.",
      topics: { connect: [{ id: christology.id }] },
      visibility: "PUBLIC" as const,
    },
    {
      title: "The Ladder of Divine Ascent",
      author: "John Climacus",
      translator: null,
      publisher: null,
      publicationYear: null,
      languageId: syriac.id === syriac.id ? english.id : english.id,
      churchTraditionId: syriac.id,
      categoryId: hagiography.id,
      documentTypeId: scholarly.id,
      description: "A monastic treatise structured as thirty rungs leading the soul toward union with God.",
      topics: { connect: [{ id: monasticism.id }] },
      visibility: "PUBLIC" as const,
    },
    {
      title: "Draft: Untitled Fragment 14",
      author: null,
      translator: null,
      publisher: null,
      publicationYear: null,
      languageId: geez.id,
      churchTraditionId: eotc.id,
      categoryId: null,
      documentTypeId: manuscript.id,
      description: null,
      topics: { connect: [] },
      visibility: "DRAFT" as const,
    },
  ];

  for (const b of books) {
    await prisma.book.create({
      data: {
        title: b.title,
        author: b.author,
        translator: b.translator,
        publisher: b.publisher,
        publicationYear: b.publicationYear,
        languageId: b.languageId,
        churchTraditionId: b.churchTraditionId,
        categoryId: b.categoryId,
        documentTypeId: b.documentTypeId,
        description: b.description,
        visibility: b.visibility,
        allowOnlineReading: true,
        allowDownload: b.visibility === "PUBLIC",
        topics: b.topics,
        createdById: master.id,
      },
    });
  }

  console.log(`Seeded ${books.length} sample books.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
