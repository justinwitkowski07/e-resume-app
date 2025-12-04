import chromium from "@sparticuz/chromium";
import puppeteerCore from "puppeteer-core";
import puppeteer from "puppeteer";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import Handlebars from "handlebars";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Move utility functions outside handler to avoid recreation
const calculateYears = (experience) => {
  if (!experience || experience.length === 0) return 0;
  
  const parseDate = (dateStr) => {
    if (!dateStr) return null;
    
    // Handle "Present"
    const trimmed = dateStr.trim();
    if (trimmed.toLowerCase() === "present") return new Date();
    
    // Handle "MM/YYYY" format (e.g., "12/2018", "07/2018")
    const mmYyyyMatch = trimmed.match(/^(\d{1,2})\/(\d{4})\s*$/);
    if (mmYyyyMatch) {
      const month = parseInt(mmYyyyMatch[1], 10) - 1; // JS months are 0-indexed
      const year = parseInt(mmYyyyMatch[2], 10);
      return new Date(year, month, 1); // First day of the month
    }
    
    // Handle other formats - try standard Date parsing
    const parsed = new Date(trimmed);
    
    // Check if date is valid
    if (isNaN(parsed.getTime())) {
      console.warn(`Failed to parse date: "${dateStr}"`);
      return null;
    }
    
    return parsed;
  };
  
  // Parse all dates and filter out invalid ones
  const validDates = experience
    .map(job => parseDate(job.start_date))
    .filter(date => date !== null);
  
  if (validDates.length === 0) {
    console.warn("No valid dates found in experience");
    return 0;
  }
  
  // Find earliest date
  const earliest = validDates.reduce((min, date) => {
    return date < min ? date : min;
  }, validDates[0]);
  
  const years = (new Date() - earliest) / (1000 * 60 * 60 * 24 * 365);
  return Math.round(years);
};

// Move constants outside handler
const hybridKeywords = [
  'hybrid', 'hybrid work', 'hybrid model', 'hybrid schedule',
  'days in office', 'days per week in office', 'in-office days',
  'office presence', 'some days in office'
];

const onsiteKeywords = [
  'on-site', 'onsite', 'on site', 'in-office', 'in office',
  'office based', 'office-based', 'must be located in',
  'must be based in', 'must relocate', 'relocation required',
  'physical presence required', 'in person', 'local candidates',
  'candidates must be in', 'candidates must reside'
];

// Cache template compilation
let templateCache = null;
let templatePath = null;

const getTemplate = () => {
  const currentTemplatePath = path.join(process.cwd(), "templates", "Resume.html");
  
  // Only recompile if template path changed or cache is empty
  if (!templateCache || templatePath !== currentTemplatePath) {
    templatePath = currentTemplatePath;
    const templateSource = fs.readFileSync(templatePath, "utf-8");
    
    // Register Handlebars helpers (idempotent, safe to call multiple times)
    Handlebars.registerHelper('formatKey', function(key) {
      return key;
    });
    
    Handlebars.registerHelper('join', function(array, separator) {
      if (Array.isArray(array)) {
        return array.join(separator);
      }
      return '';
    });
    
    templateCache = Handlebars.compile(templateSource);
  }
  
  return templateCache;
};

// Cache profile data in memory to avoid repeated file reads
const profileCache = new Map();

const loadProfile = (profileName) => {
  if (profileCache.has(profileName)) {
    return profileCache.get(profileName);
  }
  
  const profilePath = path.join(process.cwd(), "resumes", `${profileName}.json`);
  if (!fs.existsSync(profilePath)) {
    return null;
  }
  
  const profileData = JSON.parse(fs.readFileSync(profilePath, "utf-8"));
  profileCache.set(profileName, profileData);
  return profileData;
};

// Call OpenAI with timeout & retries (optimized with reduced maxTokens)
async function callOpenAI(promptOrMessages, model = null, maxTokens = 32000, retries = 2, timeoutMs = 90000) {
  while (retries > 0) {
    try {
      // Handle both string prompts and message arrays
      let messages;
      let systemPrompt = null;
      
      if (typeof promptOrMessages === 'string') {
        messages = [{ role: "user", content: promptOrMessages }];
      } else if (Array.isArray(promptOrMessages)) {
        // Extract system message if present (OpenAI supports it natively)
        const systemMsg = promptOrMessages.find(msg => msg.role === 'system');
        if (systemMsg) {
          if (Array.isArray(systemMsg.content)) {
            systemPrompt = systemMsg.content.map(part => (typeof part === 'string' ? part : part?.text || '')).join('\n');
          } else {
            systemPrompt = systemMsg.content;
          }
        }
        // Convert other messages to OpenAI chat format
        messages = promptOrMessages
          .filter(msg => msg.role !== 'system')
          .map(msg => ({
            role: msg.role,
            content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
          }));
      } else {
        messages = [{ role: "user", content: String(promptOrMessages) }];
      }

      if (systemPrompt) {
        messages.unshift({ role: 'system', content: systemPrompt });
      }

      const apiParams = {
        model: model || process.env.OPENAI_MODEL || "gpt-5-mini",
        max_completion_tokens: maxTokens,
        temperature: 1,
        messages: messages
      };
      
      // Add system prompt if present
      if (systemPrompt) {
        apiParams.system = systemPrompt;
      }

      return await Promise.race([
        openai.chat.completions.create(apiParams),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("OpenAI request timed out")), timeoutMs)
        )
      ]);
    } catch (err) {
      retries--;
      if (retries === 0) throw err;
      console.log(`Retrying... (${retries} attempts left)`);
    }
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");

  try {
    const { profile, jd, company, role } = req.body;

    if (!profile) return res.status(400).send("Profile required");
    if (!jd) return res.status(400).send("Job description required");
    if (!company) return res.status(400).send("Company name required");
    if (!role) return res.status(400).send("Role name required");

    // **NEW: Check if job is remote or hybrid/onsite**
    console.log("Checking job location type...");
    const jdLower = jd.toLowerCase();
    
    // Check for hybrid indicators
    const isHybrid = hybridKeywords.some(keyword => jdLower.includes(keyword));
    
    // Check for onsite indicators (but exclude if "remote" is also mentioned strongly)
    const hasOnsiteKeywords = onsiteKeywords.some(keyword => jdLower.includes(keyword));
    const hasRemoteKeywords = jdLower.includes('remote') || jdLower.includes('work from home') || 
                               jdLower.includes('fully remote') || jdLower.includes('100% remote') ||
                               jdLower.includes('remote-first') || jdLower.includes('distributed team');
    const hasJuniorKeywords = jdLower.includes('junior role') || jdLower.includes('entry level') ||
                               jdLower.includes('entry-level');
    
    const hasInternKeywords = jdLower.includes(' intern ') || jdLower.includes('internship');

    const isJunior = hasJuniorKeywords && !hasInternKeywords;
    const isIntern = hasInternKeywords && !hasJuniorKeywords;
    const isEntryLevel = isJunior || isIntern;

    // Determine if it's truly onsite (has onsite keywords but not strong remote indicators)
    const isOnsite = hasOnsiteKeywords && !hasRemoteKeywords;
    
    if (isHybrid) {
      console.log("❌ Job is HYBRID - Rejecting");
      return res.status(400).json({ 
        error: "This position is HYBRID (requires some office days). This tool is designed for REMOTE-ONLY positions. Please provide a fully remote job description.",
        locationType: "hybrid"
      });
    }
    
    if (isOnsite) {
      console.log("❌ Job is ONSITE - Rejecting");
      return res.status(400).json({ 
        error: "This position is ONSITE/IN-PERSON. This tool is designed for REMOTE-ONLY positions. Please provide a fully remote job description.",
        locationType: "onsite"
      });
    }

    if (isEntryLevel) {
      console.log("❌ Job is ENTRY LEVEL - Rejecting");
      return res.status(400).json({ 
        error: "This position is ENTRY LEVEL. This tool is designed for MID-LEVEL and SENIOR positions. Please provide a more senior job description.",
        locationType: "entry-level"
      });
    }
    
    console.log("✅ Job appears to be REMOTE - Proceeding");

    // Load profile JSON (using cache)
    console.log(`Loading profile: ${profile}`);
    const profileData = loadProfile(profile);
    
    if (!profileData) {
      return res.status(404).send(`Profile "${profile}" not found`);
    }

    const yearsOfExperience = calculateYears(profileData.experience) - 1;

    // AI PROMPT: Generate ATS-optimized resume content as JSON (optimized - more concise)
    const prompt = `ATS optimization expert. Generate resume JSON: {"title":"...","summary":"...","skills":{...},"experience":[...]}

**OUTPUT: ONLY valid JSON, no markdown/explanations.**

**PROFILE:**
Candidate: ${profileData.name} | ${profileData.email} | ${profileData.phone} | ${profileData.location}
Experience: ${yearsOfExperience} years | Most Recent: ${profileData.experience[0]?.title || 'N/A'}

**WORK:**
${profileData.experience.map((job, idx) => 
  `${idx + 1}. ${job.company} | ${job.title || ''} | ${job.start_date} - ${job.end_date}`
).join('\n')}

**EDUCATION:**
${profileData.education.map(edu => `${edu.degree}, ${edu.school} (${edu.start_year}-${edu.end_year})`).join('\n')}

**JOB DESCRIPTION:**
${jd}

**INSTRUCTIONS:**

**1. DOMAIN KEYWORDS** (10-15 from JD "About Us"): Identity/Security (OAuth2, JWT, SAML, MFA, SSO, SOC 2, GDPR), Payments (PCI-DSS, fraud detection, KYC/AML, tokenization), Healthcare (HIPAA, HL7, FHIR, EHR), Data (data governance, GDPR, PII protection). Use in Summary (3-5), Skills (dedicated category), Experience (2-3 bullets).

---

### **2. TITLE**
- **BASE TITLE:** Use the candidate's MOST RECENT job title from their work history (first entry in experience list)
- **CRITICAL RULE:** First, check if the profile's most recent title MATCHES or is VERY SIMILAR to the JD title/role
  - If they match (e.g., both are "Senior Frontend Software Engineer" or "Senior Frontend Engineer" vs "Frontend Engineer"), SKIP the specialization and use format: [Profile's Most Recent Title] | [Key Tech 1] | [Key Tech 2] | [Key Tech 3] | [Key Tech 4]
  - If they DON'T match, use format: [Profile's Most Recent Title] | [JD-Related Specialization] | [Key Tech 1] | [Key Tech 2] | [Key Tech 3] | [Key Tech 4]
- **JD-Related Specialization (ONLY if titles don't match):** Add 1 specialization/role that aligns with the JD focus (e.g., if applying for frontend job with full stack profile: "Frontend Specialist" or "Frontend Lead")
  - If JD is frontend-focused → "Frontend Specialist" or "Frontend Lead"
  - If JD is backend-focused → "Backend Specialist" or "Backend Architect"
  - If JD is Full Stack-focused → "Full Stack Developer" or "Full Stack Experience"
  - If JD is DevOps-focused → "DevOps Specialist" or "Infrastructure Lead"
  - If JD is QA-focused → "QA Specialist" or "Quality Assurance Lead"
  - Match the specialization to the JD's primary focus area
- **Tech Stack:** Extract 4-6 most important technologies/tech stack items from JD (prioritize: frameworks, tools, platforms, methodologies)
- Separate all items with " | " (space-pipe-space)
- **Examples:**
  - Profile: "Senior Frontend Software Engineer", JD: "Senior Frontend Software Engineer" → "Senior Frontend Software Engineer | React | TypeScript | Next.js | AWS" (NO specialization added)
  - Profile: "Senior Full Stack Engineer", JD: Frontend job → "Senior Full Stack Engineer | Frontend Specialist | React.js | TypeScript | Next.js | AWS"
  - Profile: "Senior Software Engineer", JD: Backend job → "Senior Software Engineer | Backend Architect | Node.js | Python | Microservices | Docker"
  - Profile: "Senior Frontend Engineer", JD: Full Stack job → "Senior Frontend Engineer | Full Stack Experience | React.js | Node.js | PostgreSQL | AWS"

---

**3. SUMMARY** (5-6 lines, 8-12 JD keywords + 3-5 domain): Line 1: [Title] with ${yearsOfExperience}+ years in [domain]. Line 2: Expertise in [domain keyword] + [3-4 JD techs with versions]. Line 3: Track record in [domain keyword] + [achievement with metric]. Line 4: Proficient in [3-4 more JD techs]. Line 5: [Soft skill] professional with Agile/leadership experience. Line 6: Focus on [2-3 JD skill areas] + scalable solutions.

---

**4. SKILLS** (60-80 total, 5-8 categories): Categories by JD focus (Frontend, Backend, Cloud, DevOps, Security). 8-12 skills/category. Capitalize first letter. NO version spam. Group cloud: "AWS (Lambda, S3, EC2)". 70% JD keywords + 30% complementary. Domain category if relevant (FinTech→"Payment & Compliance", Healthcare→"Healthcare Compliance", Security→"Security & Identity", Data→"Data Governance").

---

**5. EXPERIENCE** (${profileData.experience.length} entries, 6-8 bullets each): Match work history. 6-8 bullets/job (recent=8, older=5-6). 25-35 words/bullet. 2-4 JD keywords/bullet. EVERY bullet needs metric (%, $, time, scale, users). Industry context in 2-3 bullets/job.

**Bullet:** [Action Verb] + [JD Tech] + [built] + [impact] + [metric]. Verbs: Architected, Engineered, Designed, Built, Developed, Implemented, Optimized, Enhanced, Led, Spearheaded, Automated, Deployed. AVOID: "Responsible for", "Worked on".

**Metrics:** Performance (40% faster, 3x throughput), Scale (50K+ users, 10M+ records), Cost (saved $500K, reduced costs 35%), Time (deployment 2hrs→15min), Quality (99.9% uptime, 90% coverage), Team (led team of 10).

---

**ATS CHECKLIST:** Use EXACT JD phrases (not synonyms). High-priority keywords 3-4x (Skills+Summary+2-3 bullets). All required/preferred JD skills in Skills. Match tech versions. Natural flow, professional tone, varied verbs, strong metrics, domain keywords integrated.

**OUTPUT:** ONLY valid JSON: {"title":"...","summary":"...","skills":{"Category":["Skill1","Skill2"]},"experience":[{"title":"...","details":["bullet1","bullet2"]}]}
`;

    const aiResponse = await callOpenAI(prompt);
    
    // Log token usage to debug if we're hitting limits
    console.log("OpenAI API Response Metadata:");
    console.log("- Model:", aiResponse.model);
    const finishReason = aiResponse.choices?.[0]?.finish_reason;
    console.log("- Finish reason:", finishReason);
    console.log("- Prompt tokens:", aiResponse.usage?.prompt_tokens);
    console.log("- Completion tokens:", aiResponse.usage?.completion_tokens);
    
    let content;
    if (finishReason === 'length') {
      console.error("⚠️ WARNING: OpenAI hit the length limit! Response was truncated.");
      console.log("🔄 Retrying with reduced requirements to fit in token limit...");
      
      // Retry with a more concise prompt
      const concisePrompt = prompt
        .replace(/TOTAL: 60-80 skills maximum/g, 'TOTAL: 50-60 skills maximum')
        .replace(/Per category: 8-12 skills/g, 'Per category: 6-10 skills')
        .replace(/6 bullets each/g, '5 bullets each')
        .replace(/5-6 bullets per job/g, '4-5 bullets per job');
      
      const retryResponse = await callOpenAI(concisePrompt);
      console.log("Retry Response Metadata:");
      console.log("- Finish reason:", retryResponse.choices?.[0]?.finish_reason);
      console.log("- Completion tokens:", retryResponse.usage?.completion_tokens);
      
      content = retryResponse.choices?.[0]?.message?.content?.trim() || "";
    } else {
      content = aiResponse.choices?.[0]?.message?.content?.trim() || "";
    }
    
    // Check if AI is apologizing instead of returning JSON
    if (content.toLowerCase().startsWith("i'm sorry") || 
        content.toLowerCase().startsWith("i cannot") || 
        content.toLowerCase().startsWith("i apologize")) {
      console.error("AI is apologizing instead of returning JSON:", content.substring(0, 200));
      throw new Error("AI refused to generate resume. The prompt may be too complex. Please try again with a shorter job description or simpler requirements.");
    }
    
    // Optimized JSON extraction - handle various formats
    // Remove markdown code blocks and common prefixes in one pass
    content = content
      .replace(/```(?:json|javascript)?\s*/gi, "")
      .replace(/```\s*/g, "")
      .replace(/^(here is|here's|this is|the json is):?\s*/gi, "")
      .trim();
    
    // Extract JSON object boundaries
    const firstBrace = content.indexOf('{');
    const lastBrace = content.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      content = content.substring(firstBrace, lastBrace + 1);
    } else {
      console.error("No JSON object found in response");
      throw new Error("AI did not return valid JSON format. Please try again.");
    }
    
    // Parse JSON with better error handling
    let resumeContent;
    try {
      resumeContent = JSON.parse(content);
    } catch (parseError) {
      console.error("=== JSON PARSE ERROR ===");
      console.error("Parse error:", parseError.message);
      console.error("Content length:", content.length);
      console.error("First 1000 chars:", content.substring(0, 1000));
      console.error("Last 500 chars:", content.substring(Math.max(0, content.length - 500)));
      
      // Try to fix common JSON issues (optimized)
      try {
        let fixedContent = content
          .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
          .replace(/,\s*,/g, ','); // Remove double commas
        resumeContent = JSON.parse(fixedContent);
        console.log("✅ Successfully parsed after fixing common issues");
      } catch (secondError) {
        console.error("Failed to parse even after fixes");
        throw new Error(`AI returned invalid JSON: ${parseError.message}. Please try again.`);
      }
    }
    
    // Validate required fields
    if (!resumeContent.title || !resumeContent.summary || !resumeContent.skills || !resumeContent.experience) {
      console.error("Missing required fields in AI response:", Object.keys(resumeContent));
      throw new Error("AI response missing required fields (title, summary, skills, or experience)");
    }

    console.log("✅ AI content generated successfully");
    console.log("Skills categories:", Object.keys(resumeContent.skills).length);
    console.log("Experience entries:", resumeContent.experience.length);
    
    // Debug: Check if experience has details
    resumeContent.experience.forEach((exp, idx) => {
      console.log(`Experience ${idx + 1}: ${exp.title || 'NO TITLE'} - Details count: ${exp.details?.length || 0}`);
      if (!exp.details || exp.details.length === 0) {
        console.error(`⚠️ WARNING: Experience entry ${idx + 1} has NO DETAILS!`);
      }
    });

    // Get cached template (compiled once, reused)
    const template = getTemplate();

    // Prepare data for template
    const templateData = {
      name: profileData.name,
      title: resumeContent.title,
      email: profileData.email,
      phone: profileData.phone,
      location: profileData.location,
      linkedin: profileData.linkedin,
      website: profileData.website,
      summary: resumeContent.summary,
      skills: resumeContent.skills,
      experience: profileData.experience.map((job, idx) => ({
        title: job.title || resumeContent.experience[idx]?.title || "Engineer",
        company: job.company,
        location: job.location,
        start_date: job.start_date,
        end_date: job.end_date,
        details: resumeContent.experience[idx]?.details || []
      })),
      education: profileData.education
    };

    // Render HTML
    const html = template(templateData);
    console.log("HTML rendered from template");

    // Generate PDF with Puppeteer (optimized)
    // Check if running on Vercel (serverless environment)
    const isVercel = process.env.VERCEL || process.env.VERCEL_ENV;
    const isProduction = process.env.NODE_ENV === 'production';
    const isServerless = isVercel || isProduction;
    
    let browser;
    if (isServerless) {
      // Optimized chromium args for faster startup in serverless
      const optimizedArgs = [
        ...chromium.args,
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ];
      
      browser = await puppeteerCore.launch({
        args: optimizedArgs,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
      });
    } else {
      // Local development with optimized settings
      browser = await puppeteer.launch({ 
        headless: "new",
        args: [
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-sandbox'
        ]
      });
    }

    const page = await browser.newPage();
    // Use 'load' instead of 'networkidle0' - much faster since we have no external resources
    await page.setContent(html, { waitUntil: "load" });
    
    // Generate PDF with optimized settings
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { 
        top: "15mm", 
        bottom: "15mm", 
        left: "0mm", 
        right: "0mm" 
      },
      preferCSSPageSize: false, // Faster rendering
    });
    
    await browser.close();

    console.log("PDF generated successfully!");
    
    // Generate filename from profile name, company and role
    // Move sanitize function outside to avoid recreation (though it's only called 3 times)
    const sanitizeFilename = (str) => str.replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    const filename = `${sanitizeFilename(profileData.name)}_${sanitizeFilename(company)}_${sanitizeFilename(role)}.pdf`;
    
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.end(pdfBuffer);
    

  } catch (err) {
    console.error("PDF generation error:", err);
    res.status(500).send("PDF generation failed: " + err.message);
  }
}
