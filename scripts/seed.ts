const { PrismaClient } = require("@prisma/client");

const db = new PrismaClient();

async function main() {
  try {
    await db.category.createMany({
      data: [
        { name: "Famous People" },
        { name: "Business Man" },
        { name: "Movies & Sereis" },
        { name: "Philosophy" },
        { name: "Scientists" },
        { name: "Games" },
        { name: "Anime & Manga" },
        { name: "Artist" },
        { name: "Blogger or Content creator" },
        { name: "Animal" },
      ],
    });
  } catch (error) {
    console.error("Error seeding default categories", error);
  } finally {
    await db.$disconnect();
  }
}

main();
