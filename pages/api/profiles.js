import fs from "fs";
import path from "path";

export default function handler(req, res) {
  try {
    const resumesDir = path.join(process.cwd(), "resumes");
    const files = fs.readdirSync(resumesDir);
    
    // Filter JSON files and exclude template
    const profiles = files
      .filter(file => file.endsWith(".json") && file !== "_template.json")
      .map(file => ({
        id: file.replace(".json", ""),
        name: file.replace(".json", "").replace(/_/g, " ")
      }));
    
    res.status(200).json(profiles);
  } catch (error) {
    console.error("Error reading profiles:", error);
    res.status(500).json({ error: "Failed to load profiles" });
  }
}

