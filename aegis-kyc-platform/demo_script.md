# AegisKYC — Interactive Presentation & Demo Script

Welcome to the **AegisKYC Platform** interactive demonstration script. This guide walks you through a structured, end-to-end presentation showing how AegisKYC leverages **LangGraph agents**, **local LLM orchestration (Qwen3-4B)**, and **GPU-accelerated biometrics** to automate compliance on the AMD Instinct™ MI300X platform.

---

## 🛠️ Demo Setup Checklist
Before starting, ensure that both servers are running on the system:
1. **vLLM Inference Server** (Serving Qwen3-4B on Port 8000):
   ```bash
   bash start_vllm.sh
   ```
2. **FastAPI Web Application** (Server on Port 8001):
   ```bash
   bash start_app.sh
   ```
3. Open the browser to the **AegisKYC UI**:
   * Local: `http://localhost:8001/`
   * AMD Workbench: `https://notebooks.amd.com/.../proxy/8001/`

---

## 🟢 PART 1: The "Happy Path" Demo (Clean & Approved)
* **Goal:** Show a perfect, clean onboarding flow where the customer is approved automatically with zero friction.
* **Candidate:** **Rahul Sharma** (Aadhaar Card)

### Step 1: Document Selection & Stream Launch
1. On the **KYC Verification** tab, locate the **Select ID Document** card.
2. Select **"Rahul Sharma — Aadhaar Card (Clean Onboarding)"** from the preset dropdown.
3. *Talk track:* 
   > "First, we will demonstrate a clean onboarding scenario using an Aadhaar card. When I click 'Run Verification', our multi-agent pipeline is triggered. You will see a live state machine update in real-time as each agent processes the document."
4. Click the blue **"Run Verification"** button.

### Step 2: Explaining the Live Pipeline Run (Watch the center tracker)
As the icons pulse and light up green, explain what the backend agents are doing:
* **OCR Agent:**
  * *What it does:* Runs multi-language OCR (PaddleOCR) to extract raw multilingual text.
  * *Bilingual Cross-Validation:* It cross-checks the name printed in Hindi against the English spelling to detect name tampering or spoofed document formats.
* **Guardrail Agent:**
  * *What it does:* Checks the raw OCR output for prompt injection attacks or hostile instructions trying to override the system.
* **Extraction Agent:**
  * *What it does:* Sends the clean OCR text to **Qwen3-4B** running locally on our AMD MI300X. It extracts structured fields like Name, DOB, Nationality, and ID Number.
* **Compliance Agent:**
  * *What it does:* Screens the extracted name against sanctions lists and government registries using fuzzy string distance algorithms. For Rahul, it finds **0 matches**.

### Step 3: Biometric Verification
1. Once processing finishes, the UI advances to the **Biometric Verification** step.
2. You will see the Aadhaar card photo on the left, and a camera selfie on the right.
3. Select **"Selfie: Matching (Success)"** in the dropdown.
4. Click **"Verify Identity →"**.
5. *What the backend does:* Calls the **Face Match Agent** which uses **DeepFace (VGG-Face)**. It measures the cosine distance between the document photo and selfie. 
   * A distance **< 0.40** is a match.
   * Rahul's distance is **0.1240** (98.5% confidence) — the match passes.
6. The UI advances to the final screen. You will see **"APPROVED"** in a green hero banner.

---

## 🔴 PART 2: The "Blocked/Escalated Path" Demo (Fuzzy Match Registry Mismatch)
* **Goal:** Show how AegisKYC flags PEPs (Politically Exposed Persons) or sanctions watchlists, and overrides the process.
* **Candidate:** **Devendra Singh** (PAN Card)

### Step 1: Select Devendra's Profile
1. Click **"Start New Verification"** to reset the wizard.
2. Select **"Devendra Singh — PAN Card (High Risk Match)"** in the dropdown.
3. *Talk track:*
   > "Next, we will verify a high-risk candidate. Devendra's profile looks similar to an individual on a global sanctions watchlist. Let's see how our fuzzy matcher and orchestrator handle this candidate."
4. Click **"Run Verification"**.

### Step 2: The Compliance Alert
1. Watch the pipeline complete. Notice that the **Compliance Screening** node turns **Amber** and shows: `🚨 ALERT: 1 watchlist match(es) found`.
2. Look at the **Extracted Identity** card:
   * Beneath the fields, a clear red alert is displayed: **"⚠️ Watchlist Matches (1)"**.
   * It shows the exact details: **`Watchlist Match: Devendra Sen`** with an **`88% Match (HIGH Risk)`**.
   * The backend provided the reason: *Name matches sanctioned entity 'Devendra Sen' with 88% similarity (Registry ID: SANCTION-108).*
3. *Talk track:*
   * Point out the **Watchlist Matches** alert card. Explain that the fuzzy matcher caught a variations mismatch (Singh vs. Sen) that would bypass standard database lookups, and automatically raised a high-risk flag.

### Step 3: Triggering a Biometric Block
1. Now select **"Selfie: Disguise / Spoofing (Critical Failure)"** in the dropdown.
2. Click **"Verify Identity →"**.
3. The UI advances to the final screen. You will see a red **"ESCALATED"** hero banner.
4. Explain the **Escalation Breakdown** details card:
   * **Government Registry Mismatch:** Highlighting the fuzzy matched sanctions entry.
   * **Biometric Verification Failed:** Showing that the face match distance was **0.8870** (way above the 0.40 threshold), detecting a biometric spoof.
   * **Final Decision (Orchestrator Agent):** The Orchestrator agent synthesized all flags and automatically routed this case to a human officer.

---

## 🔵 PART 3: The "Biometric Demo" Tab (Biometric Under-the-Hood)
1. Scroll to the top and click the **"Biometric Demo"** tab in the navigation bar.
2. *Talk track:*
   > "Under the hood, our biometric pipeline is powered by GPU-accelerated face embeddings. In this playground, we can examine how the VGG-Face model behaves under different conditions."
3. Select different presets (e.g. **Same person (angle diff)** vs. **Different person**).
4. Point out the **Cosine Distance Meter**:
   * Green area: `< 0.40` (Match Verified)
   * Red area: `>= 0.40` (Mismatch / Spoof)
5. Show how changing the preset updates the landmark similarity metrics in the backend and outputs the precise cosine distance.

---

## 🟣 PART 4: The "Workflow Diagram" Tab (Agent Architecture)
1. Click the **"Workflow Diagram"** tab in the navigation bar.
2. *Talk track:*
   > "AegisKYC is not a linear script; it is a dynamic state-graph built on LangGraph. Here is our execution path."
3. Walk through the nodes shown on the live Mermaid flow diagram:
   1. **Start:** Entry point.
   2. **OCR / Bilingual Validation:** Bypassed for pure text inputs, activated for image uploads.
   3. **Guardrails:** Scans incoming payloads for adversarial content.
   4. **Extraction:** Local LLM structures the text.
   5. **Compliance (Fuzzy Matcher):** Screens lists and adds flags.
   6. **Orchestrator:** The reasoning agent that decides whether to `APPROVE`, `REVIEW`, or `ESCALATE`.
   7. **Sanitizer:** Masks sensitive fields (like ID numbers) to satisfy PII regulations.
   8. **End:** Outputs the final compliance packet.

---

## 🏆 Key Summary Points for Judges
To conclude your presentation, summarize the core engineering achievements:
1. **AMD Instinct™ Acceleration:** Qwen3-4B runs locally with high-throughput vLLM orchestration, keeping sensitive KYC data entirely on-prem.
2. **LangGraph Agentic Flow:** The pipeline uses structured, error-resilient agent loops instead of fragile, hardcoded heuristics.
3. **Multi-Layer Security:** Prompt injection detection, bilingual document verification, fuzzy watchlist screening, and facial biometrics work together to block fraud attempts.
