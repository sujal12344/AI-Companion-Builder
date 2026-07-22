const { PrismaClient } = require("@prisma/client");

const db = new PrismaClient();

async function main() {
  try {
    // Delete existing categories first to avoid duplicates
    await db.category.deleteMany({});
    
    console.log("Creating categories...");
    
    await db.category.createMany({
      data: [
        // === Professional & Business ===
        { name: "Entrepreneurs & Business Leaders" },
        { name: "Tech Founders & Innovators" },
        { name: "Authors & Writers" },
        { name: "Content Creators & Influencers" },
        
        // === Knowledge & Education ===
        { name: "Scientists & Researchers" },
        { name: "Philosophers & Thinkers" },
        { name: "Historians & Educators" },
        
        // === Entertainment & Arts ===
        { name: "Musicians & Artists" },
        { name: "Actors & Directors" },
        { name: "Anime & Manga Characters" },
        { name: "Movie & TV Characters" },
        { name: "Game Characters & Streamers" },
        
        // === Sports & Fitness ===
        { name: "Athletes & Sports Legends" },
        { name: "Fitness Coaches & Trainers" },
        
        // === Lifestyle & Wellness ===
        { name: "Motivational Speakers & Life Coaches" },
        { name: "Spiritual Leaders & Guides" },
        { name: "Chefs & Food Creators" },
        
        // === Politics & Social ===
        { name: "Political Leaders & Activists" },
        { name: "Social Media Personalities" },
        
        // === Fun & Unique ===
        { name: "Fictional Characters" },
        { name: "Historical Figures" },
        { name: "Pets & Animals" },
        { name: "Custom AI Personas" },
      ],
    });
    
    console.log("✅ Categories seeded successfully!");
  } catch (error) {
    console.error("❌ Error seeding default categories:", error);
    throw error;
  } finally {
    await db.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
