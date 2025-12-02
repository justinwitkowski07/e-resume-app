import fs from "fs";
import path from "path";

export default function handler(req, res) {
  const resumesDir = path.join(process.cwd(), "resumes");
  const files = fs.readdirSync(resumesDir).filter(f => f.endsWith(".json"));
  const names = files.map(f => f.replace(".json", ""));
  res.status(200).json(names);
}
