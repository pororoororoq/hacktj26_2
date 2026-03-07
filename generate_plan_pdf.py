"""Generate the VoiceRecover team task plan as a PDF."""
from fpdf import FPDF

class PlanPDF(FPDF):
    def header(self):
        self.set_font("Helvetica", "B", 11)
        self.set_text_color(100, 100, 100)
        self.cell(0, 8, "VoiceRecover - Team Task Plan", align="R", new_x="LMARGIN", new_y="NEXT")
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(4)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(150, 150, 150)
        self.cell(0, 10, f"Page {self.page_no()}/{{nb}}", align="C")

    def section_title(self, title):
        self.set_font("Helvetica", "B", 16)
        self.set_text_color(45, 55, 120)
        self.ln(4)
        self.cell(0, 10, title, new_x="LMARGIN", new_y="NEXT")
        self.set_draw_color(45, 55, 120)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(4)

    def sub_title(self, title):
        self.set_font("Helvetica", "B", 13)
        self.set_text_color(70, 70, 70)
        self.ln(2)
        self.cell(0, 8, title, new_x="LMARGIN", new_y="NEXT")
        self.ln(2)

    def body_text(self, text):
        self.set_font("Helvetica", "", 10)
        self.set_text_color(40, 40, 40)
        self.multi_cell(0, 5.5, text)
        self.ln(1)

    def bullet(self, text, indent=10):
        self.set_font("Helvetica", "", 10)
        self.set_text_color(40, 40, 40)
        x = self.get_x()
        self.set_x(x + indent)
        self.cell(5, 5.5, "-")
        self.multi_cell(0, 5.5, text)
        self.ln(0.5)

    def bold_bullet(self, label, desc, indent=10):
        x = self.get_x()
        self.set_x(x + indent)
        self.set_font("Helvetica", "", 10)
        self.set_text_color(40, 40, 40)
        self.cell(5, 5.5, "-")
        self.set_font("Helvetica", "B", 10)
        self.cell(self.get_string_width(label) + 1, 5.5, label)
        self.set_font("Helvetica", "", 10)
        self.multi_cell(0, 5.5, " " + desc)
        self.ln(0.5)

    def table_row(self, cells, widths, bold=False):
        self.set_font("Helvetica", "B" if bold else "", 9)
        h = 7
        for i, cell in enumerate(cells):
            if bold:
                self.set_fill_color(45, 55, 120)
                self.set_text_color(255, 255, 255)
            else:
                self.set_fill_color(245, 245, 250)
                self.set_text_color(40, 40, 40)
            self.cell(widths[i], h, cell, border=1, fill=bold, align="L" if i == 0 else "C")
        self.ln(h)

    def code_block(self, text):
        self.set_font("Courier", "", 9)
        self.set_text_color(30, 30, 30)
        self.set_fill_color(240, 240, 245)
        x = self.get_x()
        self.set_x(x + 5)
        for line in text.strip().split("\n"):
            self.cell(175, 5, "  " + line, fill=True, new_x="LMARGIN", new_y="NEXT")
            self.set_x(x + 5)
        self.ln(3)


pdf = PlanPDF()
pdf.alias_nb_pages()
pdf.set_auto_page_break(auto=True, margin=20)
pdf.add_page()

# ═══════════════════════════════════════════════════════════════════
# TITLE PAGE
# ═══════════════════════════════════════════════════════════════════
pdf.ln(30)
pdf.set_font("Helvetica", "B", 28)
pdf.set_text_color(45, 55, 120)
pdf.cell(0, 15, "VoiceRecover", align="C", new_x="LMARGIN", new_y="NEXT")
pdf.set_font("Helvetica", "", 14)
pdf.set_text_color(100, 100, 100)
pdf.cell(0, 10, "AI Speech Therapy Companion", align="C", new_x="LMARGIN", new_y="NEXT")
pdf.ln(10)
pdf.set_draw_color(45, 55, 120)
pdf.line(60, pdf.get_y(), 150, pdf.get_y())
pdf.ln(10)
pdf.set_font("Helvetica", "B", 16)
pdf.set_text_color(70, 70, 70)
pdf.cell(0, 10, "Team Task Plan", align="C", new_x="LMARGIN", new_y="NEXT")
pdf.ln(5)
pdf.set_font("Helvetica", "", 11)
pdf.set_text_color(120, 120, 120)
pdf.cell(0, 8, "HackTJ 2026 | Theme: Invisible Infrastructure", align="C", new_x="LMARGIN", new_y="NEXT")
pdf.cell(0, 8, "March 2026", align="C", new_x="LMARGIN", new_y="NEXT")

# ═══════════════════════════════════════════════════════════════════
# HACKATHON ANGLE
# ═══════════════════════════════════════════════════════════════════
pdf.add_page()
pdf.section_title("Hackathon Angle: Invisible Infrastructure")

pdf.body_text(
    'Speech is the ultimate invisible infrastructure. We never think about the complex '
    'neuromuscular coordination, breath control, and cognitive processes required to say '
    'a single word -- until it breaks. For stroke survivors and brain injury patients, '
    'losing speech means losing access to the most fundamental human infrastructure: communication.'
)
pdf.ln(2)
pdf.body_text('VoiceRecover rebuilds that invisible infrastructure through AI-guided rehabilitation.')

pdf.sub_title("Supporting Angles")
pdf.bold_bullet("Hidden therapy pipeline:", "Behind a simple 'press record and speak' interface, there's Whisper AI transcription, phoneme alignment, pitch analysis, and HLR spaced repetition -- all invisible to the patient.")
pdf.bold_bullet("Healthcare bottleneck:", "Access to Speech-Language Pathologists is its own invisible infrastructure problem. Long waitlists, expensive sessions, limited rural availability. This app scales therapy invisibly.")
pdf.bold_bullet("Neuroplasticity:", "Melodic Intonation Therapy works because the brain has redundant invisible infrastructure -- singing activates different neural pathways than speech.")
pdf.bold_bullet("Adaptive learning:", "The HLR algorithm silently adjusts difficulty, picks optimal words, tracks weak phonemes. The patient never manages a therapy plan.")

pdf.ln(3)
pdf.set_font("Helvetica", "BI", 11)
pdf.set_text_color(45, 55, 120)
pdf.multi_cell(0, 6, 'Pitch: "Speech is the invisible infrastructure of human connection. When a stroke takes it away, VoiceRecover uses AI to rebuild it -- one phoneme at a time."')

# ═══════════════════════════════════════════════════════════════════
# FEATURE 1: ONBOARDING
# ═══════════════════════════════════════════════════════════════════
pdf.add_page()
pdf.section_title("Feature 1: Onboarding Flow")
pdf.body_text(
    "A 3-step screen shown on first launch. Collects patient info and saves it to the backend. "
    "After completing onboarding, the user goes straight to WelcomeScreen on future launches."
)

pdf.sub_title("Step 1: Welcome & Name")
pdf.bullet('Large friendly header: "Let\'s personalize your therapy"')
pdf.bullet("Text input for name / nickname")
pdf.bullet('"This is not a medical device" disclaimer at bottom')
pdf.bullet('"Next" button')

pdf.sub_title("Step 2: Condition & Affected Side")
pdf.body_text('"What are you recovering from?" -- selectable cards:')
pdf.bullet("Stroke")
pdf.bullet("Traumatic Brain Injury (TBI)")
pdf.bullet("Other neurological condition")
pdf.bullet("Prefer not to say")
pdf.ln(2)
pdf.body_text('"Which side is affected?" -- Left / Right / Both / Not sure')

pdf.sub_title("Step 3: Goals & Self-Assessment")
pdf.body_text('"What is your main goal?" -- multi-select chips:')
pdf.bullet("Say everyday words clearly")
pdf.bullet("Have full conversations")
pdf.bullet("Speak with confidence")
pdf.bullet("Sing along to music")
pdf.ln(2)
pdf.body_text('"How would you rate your current speech?" -- simple 1-5 slider:')
pdf.bullet("1 = Very difficult, 5 = Mostly recovered")
pdf.body_text("This sets the starting difficulty level in the adaptive learning engine.")

pdf.sub_title("Self-Rating to Starting Difficulty Mapping")
w = [60, 60, 60]
pdf.table_row(["Self-Rating", "Starting Difficulty", "Words Unlocked"], w, bold=True)
pdf.table_row(["1-2", "Level 1", "7 easiest words"], w)
pdf.table_row(["3", "Level 2", "14 words"], w)
pdf.table_row(["4-5", "Level 3", "19 words"], w)

pdf.sub_title("Navigation Logic")
pdf.code_block(
    "App launch -> GET /api/profile\n"
    "  -> if 404 (no profile) -> show OnboardingScreen\n"
    "  -> if 200 (profile exists) -> show WelcomeScreen"
)

pdf.sub_title("Backend Data Shape (user_profile.json)")
pdf.code_block(
    '{\n'
    '  "name": "Alex",\n'
    '  "condition": "stroke",\n'
    '  "affected_side": "left",\n'
    '  "goals": ["everyday_words", "confidence"],\n'
    '  "self_rating": 2,\n'
    '  "created_at": "2026-03-07T12:00:00Z"\n'
    '}'
)

pdf.sub_title("Files to Create / Modify")
w2 = [75, 25, 90]
pdf.table_row(["File", "Action", "What"], w2, bold=True)
pdf.table_row(["src/screens/OnboardingScreen.tsx", "Create", "3-step wizard with paging dots"], w2)
pdf.table_row(["src/navigation/AppNavigator.tsx", "Modify", "Add Onboarding route, conditional start"], w2)
pdf.table_row(["src/services/api.ts", "Modify", "Add saveProfile() and getProfile()"], w2)
pdf.table_row(["backend/routers/progress.py", "Modify", "Add POST/GET /api/profile endpoints"], w2)
pdf.table_row(["backend/services/learning_engine.py", "Modify", "save/load profile, set initial difficulty"], w2)

# ═══════════════════════════════════════════════════════════════════
# FEATURE 2: DATA VIZ
# ═══════════════════════════════════════════════════════════════════
pdf.add_page()
pdf.section_title("Feature 2: Data Visualization")
pdf.body_text(
    "Add a Score History line chart and Phoneme Heatmap to the existing ProgressScreen "
    "using react-native-svg (lightweight, no external charting library)."
)

pdf.sub_title("Chart 1: Score Over Time (Line Chart)")
pdf.body_text(
    "Shows assessment scores across sessions so the user can see improvement over time."
)
pdf.bullet("X-axis: dates")
pdf.bullet("Y-axis: 0-100 score")
pdf.bullet("Two lines: word scores (blue) vs melody scores (purple)")
pdf.bullet("Dots on each data point; tap for detail")

pdf.ln(2)
pdf.body_text("New backend endpoint needed:")
pdf.code_block(
    "GET /api/progress/history?days=30\n\n"
    "Response:\n"
    '{\n'
    '  "sessions": [\n'
    '    { "date": "2026-03-05", "type": "assessment", "avg_score": 65 },\n'
    '    { "date": "2026-03-06", "type": "assessment", "avg_score": 72 },\n'
    '    { "date": "2026-03-07", "type": "melody", "avg_score": 78 }\n'
    '  ]\n'
    '}'
)

pdf.sub_title("Chart 2: Phoneme Accuracy Heatmap")
pdf.body_text(
    "A grid of color-coded boxes showing which phonemes the patient is strong/weak on."
)
pdf.bullet("Green (80%+), Yellow (60-79%), Red (<60%)")
pdf.bullet("Arrow showing trend: improving, stable, or declining")

pdf.ln(2)
pdf.body_text("New backend endpoint needed:")
pdf.code_block(
    "GET /api/progress/phoneme-history\n\n"
    "Response:\n"
    '{\n'
    '  "phonemes": [\n'
    '    { "phoneme": "w", "scores": [90, 85, 92], "trend": "stable" },\n'
    '    { "phoneme": "r", "scores": [35, 40, 55], "trend": "improving" },\n'
    '    { "phoneme": "aa", "scores": [40, 38, 42], "trend": "stable" }\n'
    '  ]\n'
    '}'
)

pdf.sub_title("Dependency")
pdf.code_block("cd VoiceRecover && npm install react-native-svg")

pdf.sub_title("Files to Create / Modify")
w2 = [75, 25, 90]
pdf.table_row(["File", "Action", "What"], w2, bold=True)
pdf.table_row(["src/components/ScoreLineChart.tsx", "Create", "SVG line chart component"], w2)
pdf.table_row(["src/components/PhonemeHeatmap.tsx", "Create", "Color-coded phoneme grid + trends"], w2)
pdf.table_row(["src/screens/ProgressScreen.tsx", "Modify", "Add both charts between sections"], w2)
pdf.table_row(["src/services/api.ts", "Modify", "Add getScoreHistory(), getPhonemeHistory()"], w2)
pdf.table_row(["backend/routers/progress.py", "Modify", "Add 2 new endpoints"], w2)
pdf.table_row(["backend/services/learning_engine.py", "Modify", "Add aggregation functions"], w2)

# ═══════════════════════════════════════════════════════════════════
# WORK DIVISION
# ═══════════════════════════════════════════════════════════════════
pdf.add_page()
pdf.section_title("Work Division (3 People)")

pdf.sub_title("Person 1: Frontend / UX Polish")
pdf.body_text("Focus: Make the app feel complete and demo-ready")
w3 = [90, 30, 30]
pdf.table_row(["Task", "Priority", "Time Est."], w3, bold=True)
pdf.table_row(["Onboarding flow (name, condition, goals)", "HIGH", "1-2 hrs"], w3)
pdf.table_row(["Level-up celebration animations (confetti)", "MED", "1 hr"], w3)
pdf.table_row(["Streak badges & achievement notifications", "MED", "1 hr"], w3)
pdf.table_row(["Accessibility pass (font scaling, contrast)", "MED", "1 hr"], w3)
pdf.table_row(["Screenshots & screen recordings for pitch", "HIGH", "30 min"], w3)

pdf.ln(4)
pdf.sub_title("Person 2: Backend / Infrastructure")
pdf.body_text("Focus: Make it real -- deploy, persist data, therapist dashboard")
pdf.table_row(["Task", "Priority", "Time Est."], w3, bold=True)
pdf.table_row(["Deploy backend (Railway/Render -- free tier)", "HIGH", "1 hr"], w3)
pdf.table_row(["Replace JSON file storage with SQLite", "MED", "1-2 hrs"], w3)
pdf.table_row(["Build therapist web dashboard (React page)", "HIGH", "2-3 hrs"], w3)
pdf.table_row(["Add patient ID / simple auth", "MED", "1 hr"], w3)
pdf.table_row(["Progress export endpoint (PDF/CSV)", "LOW", "1 hr"], w3)

pdf.ln(4)
pdf.sub_title("Person 3: Data Viz / Pitch / Research")
pdf.body_text("Focus: Make the story compelling for judges")
pdf.table_row(["Task", "Priority", "Time Est."], w3, bold=True)
pdf.table_row(["Progress charts (score over time, heatmap)", "HIGH", "2 hrs"], w3)
pdf.table_row(["README with architecture diagram", "HIGH", "1 hr"], w3)
pdf.table_row(["Pitch deck (problem > solution > demo)", "HIGH", "1-2 hrs"], w3)
pdf.table_row(["Research slide: MIT therapy evidence", "MED", "30 min"], w3)
pdf.table_row(['"Invisible Infrastructure" narrative framing', "HIGH", "30 min"], w3)

# ═══════════════════════════════════════════════════════════════════
# EXISTING ARCHITECTURE
# ═══════════════════════════════════════════════════════════════════
pdf.add_page()
pdf.section_title("Existing Architecture Reference")

pdf.sub_title("Frontend (React Native)")
pdf.bullet("AppNavigator.tsx -- Stack navigator (Welcome, Assessment, MIT, Results, Progress, Challenge)")
pdf.bullet("AssessmentScreen.tsx -- Record 3 words, adaptive selection via HLR")
pdf.bullet("MITScreen.tsx -- Melody Intonation Therapy with pitch visualization")
pdf.bullet("ChallengeScreen.tsx -- Browse/practice any word by difficulty")
pdf.bullet("ProgressScreen.tsx -- Dashboard with stats, difficulty bars, weak phonemes")
pdf.bullet("WelcomeScreen.tsx -- Daily missions, navigation hub")
pdf.bullet("api.ts -- All backend API calls (assess, analyze-pitch, TTS, progress, missions, challenge)")

pdf.sub_title("Backend (FastAPI + Python)")
pdf.bullet("main.py -- App entry point, mounts all routers")
pdf.bullet("routers/assessment.py -- POST /api/assess (dynamic 1-N word uploads)")
pdf.bullet("routers/analysis.py -- POST /api/analyze-pitch")
pdf.bullet("routers/tts.py -- GET /api/tts (macOS say command)")
pdf.bullet("routers/progress.py -- 10 endpoints for progress, missions, challenge")
pdf.bullet("services/learning_engine.py -- HLR spaced repetition, missions, challenge data")
pdf.bullet("services/phoneme_analyzer.py -- Whisper AI + g2p_en phoneme alignment")
pdf.bullet("services/pitch_analyzer.py -- Pitch contour extraction & scoring")

pdf.sub_title("Key API Endpoints")
w4 = [35, 70, 85]
pdf.table_row(["Method", "Endpoint", "Description"], w4, bold=True)
pdf.table_row(["POST", "/api/assess", "Speech assessment (1-N word audio files)"], w4)
pdf.table_row(["POST", "/api/analyze-pitch", "Pitch analysis for melody therapy"], w4)
pdf.table_row(["GET", "/api/tts?text=...", "Text-to-speech audio generation"], w4)
pdf.table_row(["GET", "/api/progress", "Overall progress summary"], w4)
pdf.table_row(["GET", "/api/next-words?count=3", "HLR-selected words for session"], w4)
pdf.table_row(["GET", "/api/next-phrase", "HLR-selected melody phrase"], w4)
pdf.table_row(["POST", "/api/record-word", "Record word practice result"], w4)
pdf.table_row(["POST", "/api/record-session", "Record completed session"], w4)
pdf.table_row(["GET", "/api/missions", "Daily missions with completion status"], w4)
pdf.table_row(["GET", "/api/challenge-words", "All words grouped by difficulty"], w4)

# ═══════════════════════════════════════════════════════════════════
# SAVE
# ═══════════════════════════════════════════════════════════════════
out_path = "/Users/jeeheeha/projects/hacktj26_2/VoiceRecover_Team_Plan.pdf"
pdf.output(out_path)
print(f"PDF saved to {out_path}")
