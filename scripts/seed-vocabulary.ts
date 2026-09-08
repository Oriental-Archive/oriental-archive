import { prisma } from "../src/lib/prisma";

// Fills out the controlled vocabulary beyond whatever a librarian happened to
// type into the Vocabulary admin page during development (as of writing:
// 4 languages, 3 of the 6 church traditions, 3 document types, no rights
// statuses, no church fathers) — the Add Book form is only as useful as this
// list is complete. Upserts on the [type, value] unique key, so it's safe to
// run again later after a librarian adds more of their own.
const TERMS: { type: string; value: string; label: string }[] = [
  // Languages
  { type: "LANGUAGE", value: "geez", label: "Ge'ez" },
  { type: "LANGUAGE", value: "amharic", label: "Amharic" },
  { type: "LANGUAGE", value: "tigrinya", label: "Tigrinya" },
  { type: "LANGUAGE", value: "coptic", label: "Coptic" },
  { type: "LANGUAGE", value: "syriac", label: "Syriac" },
  { type: "LANGUAGE", value: "arabic", label: "Arabic" },
  { type: "LANGUAGE", value: "armenian", label: "Armenian" },
  { type: "LANGUAGE", value: "malayalam", label: "Malayalam" },
  { type: "LANGUAGE", value: "greek", label: "Greek" },
  { type: "LANGUAGE", value: "english", label: "English" },

  // Church traditions — the six sister churches of the communion, so this
  // list should never be missing one of them.
  { type: "CHURCH_TRADITION", value: "coptic_orthodox", label: "Coptic Orthodox" },
  { type: "CHURCH_TRADITION", value: "syriac", label: "Syriac Orthodox" },
  { type: "CHURCH_TRADITION", value: "armenian_apostolic", label: "Armenian Apostolic" },
  { type: "CHURCH_TRADITION", value: "eotc", label: "Ethiopian Orthodox Tewahedo" },
  { type: "CHURCH_TRADITION", value: "eritrean_orthodox", label: "Eritrean Orthodox Tewahedo" },
  { type: "CHURCH_TRADITION", value: "malankara_orthodox", label: "Malankara Orthodox Syrian" },

  // Document types
  { type: "DOCUMENT_TYPE", value: "manuscript", label: "Manuscript" },
  { type: "DOCUMENT_TYPE", value: "printed_book", label: "Printed Book" },
  { type: "DOCUMENT_TYPE", value: "scholarly_edition", label: "Scholarly Edition" },
  { type: "DOCUMENT_TYPE", value: "critical_edition", label: "Critical Edition" },
  { type: "DOCUMENT_TYPE", value: "translation", label: "Translation" },
  { type: "DOCUMENT_TYPE", value: "facsimile", label: "Facsimile" },
  { type: "DOCUMENT_TYPE", value: "anthology", label: "Anthology" },

  // Categories
  { type: "CATEGORY", value: "patristics", label: "Patristics" },
  { type: "CATEGORY", value: "liturgy", label: "Liturgy" },
  { type: "CATEGORY", value: "hagiography", label: "Hagiography" },
  { type: "CATEGORY", value: "christology", label: "Christology" },
  { type: "CATEGORY", value: "church_history", label: "Church History" },
  { type: "CATEGORY", value: "scripture", label: "Scripture" },
  { type: "CATEGORY", value: "spirituality", label: "Spirituality" },
  { type: "CATEGORY", value: "canon_law", label: "Canon Law" },
  { type: "CATEGORY", value: "apologetics", label: "Apologetics" },

  // Rights statuses
  { type: "RIGHTS_STATUS", value: "public_domain", label: "Public Domain" },
  { type: "RIGHTS_STATUS", value: "permission_granted", label: "Permission Granted" },
  { type: "RIGHTS_STATUS", value: "in_copyright", label: "In Copyright" },
  { type: "RIGHTS_STATUS", value: "rights_unknown", label: "Rights Unknown" },

  // Topics
  { type: "TOPIC", value: "christology", label: "Christology" },
  { type: "TOPIC", value: "fasting", label: "Fasting" },
  { type: "TOPIC", value: "monasticism", label: "Monasticism" },
  { type: "TOPIC", value: "ecclesiology", label: "Ecclesiology" },
  { type: "TOPIC", value: "sacraments", label: "Sacraments" },
  { type: "TOPIC", value: "mariology", label: "Mariology" },
  { type: "TOPIC", value: "eschatology", label: "Eschatology" },
  { type: "TOPIC", value: "asceticism", label: "Asceticism" },
  { type: "TOPIC", value: "biblical_commentary", label: "Biblical Commentary" },

  // Church Fathers / Saints
  { type: "CHURCH_FATHER", value: "athanasius_of_alexandria", label: "Athanasius of Alexandria" },
  { type: "CHURCH_FATHER", value: "cyril_of_alexandria", label: "Cyril of Alexandria" },
  { type: "CHURCH_FATHER", value: "severus_of_antioch", label: "Severus of Antioch" },
  { type: "CHURCH_FATHER", value: "ephrem_the_syrian", label: "Ephrem the Syrian" },
  { type: "CHURCH_FATHER", value: "john_climacus", label: "John Climacus" },
  { type: "CHURCH_FATHER", value: "jacob_of_serugh", label: "Jacob of Serugh" },
  { type: "CHURCH_FATHER", value: "gregory_of_narek", label: "Gregory of Narek" },
  { type: "CHURCH_FATHER", value: "yared", label: "Yared" },
];

async function main() {
  for (const term of TERMS) {
    await prisma.controlledTerm.upsert({
      where: { type_value: { type: term.type as never, value: term.value } },
      create: { ...term, type: term.type as never },
      update: {},
    });
  }
  console.log(`Vocabulary seeded — ${TERMS.length} terms checked.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
