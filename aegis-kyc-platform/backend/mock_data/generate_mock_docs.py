import os
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

# Set up directories
MOCK_DATA_DIR = Path(__file__).parent
OUTPUT_DIR = MOCK_DATA_DIR / "sample_documents"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Try to find a nice TrueType font, fall back to default
def get_font(size, bold=False):
    # Common Linux font paths
    paths = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf" if not bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf" if not bold else "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSans.ttf" if not bold else "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
    ]
    for p in paths:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                pass
    return ImageFont.load_default()

def draw_avatar(draw, x, y, w, h):
    # Draw a clean vector avatar face placeholder
    draw.rectangle([x, y, x + w, y + h], fill="#1e293b", outline="#475569", width=2)
    # Head
    draw.ellipse([x + w//4, y + h//5, x + 3*w//4, y + 3*h//5], fill="#94a3b8")
    # Body
    draw.chord([x + w//10, y + h//2, x + 9*w//10, y + 1.1*h], 180, 360, fill="#475569")
    # Eyes
    draw.ellipse([x + 3*w//8, y + 3*h//8, x + 3*w//8 + 4, y + 3*h//8 + 4], fill="#1e293b")
    draw.ellipse([x + 5*w//8 - 4, y + 3*h//8, x + 5*w//8, y + 3*h//8 + 4], fill="#1e293b")

def draw_government_seal(draw, x, y, r):
    # Draw gold circular emblem/seal
    draw.ellipse([x-r, y-r, x+r, y+r], fill="#d97706", outline="#b45309", width=2)
    draw.ellipse([x-r+4, y-r+4, x+r-4, y+r-4], outline="#f59e0b", width=1)
    # Simple star shape inside
    draw.regular_polygon((x, y, r-6), 3, fill="#fef08a")

def create_aadhaar(filename, name_en, name_hi, dob, uid, address_pincode):
    # Standard ID card dimensions: 856 x 540 pixels (1.58:1 ratio)
    img = Image.new("RGB", (856, 540), "#f8fafc")
    draw = ImageDraw.Draw(img)
    
    # Background gradient approximation (top tricolor bar, light green bottom)
    draw.rectangle([0, 0, 856, 12], fill="#ea580c") # Saffron stripe
    draw.rectangle([0, 528, 856, 540], fill="#16a34a") # Green stripe
    
    # Card Border
    draw.rectangle([0, 0, 856, 540], outline="#cbd5e1", width=3)
    
    # Header English
    font_title = get_font(24, bold=True)
    font_subtitle = get_font(16)
    font_body = get_font(18)
    font_body_bold = get_font(18, bold=True)
    font_uid = get_font(32, bold=True)
    
    draw.text((30, 30), "भारत सरकार", fill="#d97706", font=font_title)
    draw.text((30, 65), "GOVERNMENT OF INDIA", fill="#d97706", font=font_title)
    
    draw.text((500, 30), "भारतीय विशिष्ट पहचान प्राधिकरण", fill="#0f172a", font=font_subtitle)
    draw.text((500, 50), "UNIQUE IDENTIFICATION AUTHORITY OF INDIA", fill="#475569", font=font_subtitle)
    
    # Divider line
    draw.line([30, 105, 826, 105], fill="#cbd5e1", width=2)
    
    # Avatar photo
    draw_avatar(draw, 50, 130, 180, 220)
    
    # Information fields
    col_x = 260
    draw.text((col_x, 130), name_hi, fill="#0f172a", font=font_body_bold)
    draw.text((col_x, 155), name_en, fill="#0f172a", font=font_body_bold)
    draw.text((col_x, 195), f"जन्म तिथि / DOB: {dob}", fill="#475569", font=font_body)
    draw.text((col_x, 225), "पुरुष / MALE" if "Rahul" in name_en or "Devendra" in name_en else "महिला / FEMALE", fill="#475569", font=font_body)
    
    # Address Info
    draw.text((col_x, 265), "पता / Address:", fill="#475569", font=font_body_bold)
    addr_line = "12, Barakhamba Road, Connaught Place, New Delhi - 110001" if "Rahul" in name_en else \
                "102, Hawa Mahal Road, J.D.A. Colony, Jaipur, Rajasthan - 302001" if "Devendra" in name_en else \
                "25, Marine Drive, Nariman Point, Mumbai, Maharashtra - 380009"
    draw.text((col_x, 290), addr_line[:40], fill="#475569", font=font_body)
    if len(addr_line) > 40:
        draw.text((col_x, 312), addr_line[40:], fill="#475569", font=font_body)
        
    # Government Seal
    draw_government_seal(draw, 740, 180, 40)
    
    # UID Section
    draw.rectangle([30, 420, 826, 490], fill="#f1f5f9", outline="#e2e8f0", width=1)
    draw.text((270, 435), f"आधार संख्या / UID No:  {uid}", fill="#0f172a", font=font_uid)
    
    # Bottom text
    draw.text((320, 500), "आधार - आम आदमी का अधिकार", fill="#1e3a8a", font=font_subtitle)
    
    img.save(OUTPUT_DIR / filename)
    print(f"Generated Aadhaar card: {filename}")

def create_pan(filename, name, dob, pan_num):
    img = Image.new("RGB", (856, 540), "#ecfeff") # Light cyan-blue bg
    draw = ImageDraw.Draw(img)
    
    # Header block
    draw.rectangle([0, 0, 856, 90], fill="#0891b2")
    draw.rectangle([0, 0, 856, 540], outline="#cbd5e1", width=3)
    
    font_title = get_font(26, bold=True)
    font_subtitle = get_font(18)
    font_body = get_font(18)
    font_body_bold = get_font(20, bold=True)
    
    draw.text((30, 15), "आयकर विभाग", fill="#ffffff", font=font_title)
    draw.text((30, 50), "INCOME TAX DEPARTMENT", fill="#ffffff", font=font_title)
    
    draw.text((540, 15), "भारत सरकार", fill="#fef08a", font=font_subtitle)
    draw.text((540, 40), "GOVT. OF INDIA", fill="#fef08a", font=font_subtitle)
    
    # Avatar photo
    draw_avatar(draw, 50, 120, 160, 200)
    
    # Fields
    col_x = 250
    draw.text((col_x, 120), "नाम / Name", fill="#475569", font=font_body)
    draw.text((col_x, 142), name.upper(), fill="#0f172a", font=font_body_bold)
    
    draw.text((col_x, 185), "पिता का नाम / Father's Name", fill="#475569", font=font_body)
    draw.text((col_x, 207), "RAJESH KUMAR", fill="#0f172a", font=font_body_bold)
    
    draw.text((col_x, 250), "जन्म तिथि / Date of Birth", fill="#475569", font=font_body)
    draw.text((col_x, 272), dob, fill="#0f172a", font=font_body_bold)
    
    # Permanent Account Number Section
    draw.rectangle([250, 340, 800, 430], fill="#0891b2")
    draw.text((270, 350), "स्थायी खाता संख्या / PERMANENT ACCOUNT NUMBER", fill="#ffffff", font=font_subtitle)
    draw.text((270, 380), pan_num, fill="#fef08a", font=font_body_bold)
    
    # Signature
    draw.rectangle([50, 360, 200, 420], fill="#ffffff", outline="#cbd5e1")
    draw.text((65, 380), name, fill="#1e3a8a", font=get_font(18, bold=True))
    draw.text((50, 430), "Signature / हस्ताक्षर", fill="#475569", font=font_body)
    
    # Emblem/Seal
    draw_government_seal(draw, 740, 180, 45)
    
    img.save(OUTPUT_DIR / filename)
    print(f"Generated PAN card: {filename}")

def create_passport(filename, name, dob, passport_num):
    # Dark blue premium passport cover-like layout
    img = Image.new("RGB", (856, 540), "#0f172a")
    draw = ImageDraw.Draw(img)
    
    draw.rectangle([0, 0, 856, 540], outline="#b45309", width=4) # gold border
    
    font_title = get_font(28, bold=True)
    font_subtitle = get_font(20, bold=True)
    font_body = get_font(16)
    font_body_bold = get_font(18, bold=True)
    
    # Header
    draw.text((40, 30), "PASSPORT", fill="#f59e0b", font=font_title)
    draw.text((40, 70), "REPUBLIC OF INDIA", fill="#f59e0b", font=font_subtitle)
    
    # Divider
    draw.line([40, 110, 816, 110], fill="#b45309", width=2)
    
    # Avatar
    draw_avatar(draw, 50, 140, 200, 260)
    
    # Information columns
    col1 = 280
    col2 = 540
    
    # Passport Number
    draw.text((col1, 140), "Passport No / पासपोर्ट संख्या", fill="#94a3b8", font=font_body)
    draw.text((col1, 162), passport_num, fill="#ffffff", font=font_body_bold)
    
    # Surname / Given names
    parts = name.split(" ")
    surname = parts[-1] if len(parts) > 1 else name
    given_names = " ".join(parts[:-1]) if len(parts) > 1 else name
    
    draw.text((col1, 210), "Surname / उपनाम", fill="#94a3b8", font=font_body)
    draw.text((col1, 232), surname.upper(), fill="#ffffff", font=font_body_bold)
    
    draw.text((col1, 280), "Given Names / दिया गया नाम", fill="#94a3b8", font=font_body)
    draw.text((col1, 302), given_names.upper(), fill="#ffffff", font=font_body_bold)
    
    # Nationality / DOB / Sex
    draw.text((col2, 140), "Nationality / राष्ट्रीयता", fill="#94a3b8", font=font_body)
    draw.text((col2, 162), "RUSSIAN" if "Sokolov" in name else "INDIAN", fill="#ffffff", font=font_body_bold)
    
    draw.text((col2, 210), "Date of Birth / जन्म तिथि", fill="#94a3b8", font=font_body)
    draw.text((col2, 232), dob, fill="#ffffff", font=font_body_bold)
    
    draw.text((col2, 280), "Sex / लिंग", fill="#94a3b8", font=font_body)
    draw.text((col2, 302), "MALE" if "Viktor" in name else "FEMALE", fill="#ffffff", font=font_body_bold)
    
    # Government Seal
    draw_government_seal(draw, 740, 360, 40)
    
    # Machine Readable Zone (MRZ)
    draw.rectangle([40, 440, 816, 500], fill="#1e293b", outline="#334155")
    mrz1 = f"P<IND{surname}<<{given_names.replace(' ', '<')}<<<<<<<<<<<<<<<<<<<<<<<"[:44]
    mrz2 = f"{passport_num}<8IND7811155M3205101<<<<<<<<<<<<<<02"[:44]
    
    font_mrz = get_font(16, bold=False) # standard monospace approximation
    draw.text((60, 448), mrz1, fill="#94a3b8", font=font_mrz)
    draw.text((60, 470), mrz2, fill="#94a3b8", font=font_mrz)
    
    img.save(OUTPUT_DIR / filename)
    print(f"Generated Passport card: {filename}")


def create_selfie(filename, label_text, match_status="MATCH"):
    # Standard selfie size: 400x400
    img = Image.new("RGB", (400, 400), "#0f172a" if match_status == "MATCH" else "#311010")
    draw = ImageDraw.Draw(img)
    
    # Border
    draw.rectangle([0, 0, 400, 400], outline="#475569" if match_status == "MATCH" else "#b91c1c", width=4)
    
    # Draw avatar face
    x, y, w, h = 100, 80, 200, 240
    # Head outline
    draw.ellipse([x, y, x + w, y + h], fill="#cbd5e1" if match_status == "MATCH" else "#f87171")
    
    # Inner face / eyes
    eye_color = "#1e293b" if match_status == "MATCH" else "#7f1d1d"
    draw.ellipse([x + w//4, y + h//3, x + w//4 + 16, y + h//3 + 16], fill=eye_color)
    draw.ellipse([x + 3*w//4 - 16, y + h//3, x + 3*w//4, y + h//3 + 16], fill=eye_color)
    
    # Mouth
    if match_status == "MATCH":
        draw.arc([x + w//3, y + h//2, x + 2*w//3, y + 2*h//3], 0, 180, fill="#1e293b", width=3)
    else:
        # Frown mouth for spoof/mismatch
        draw.arc([x + w//3, y + h//2, x + 2*w//3, y + 2*h//3], 180, 360, fill="#7f1d1d", width=3)
        
    # Text badge
    font = get_font(16)
    draw.text((20, 340), f"SELFIE: {label_text.upper()}", fill="#cbd5e1" if match_status == "MATCH" else "#fca5a5", font=font)
    draw.text((20, 365), f"STATUS: {match_status}", fill="#10b981" if match_status == "MATCH" else "#ef4444", font=font)
    
    img.save(OUTPUT_DIR / filename)
    print(f"Generated selfie: {filename}")


if __name__ == "__main__":
    # 1. Valid Aadhaar
    create_aadhaar("aadhaar_rahul_sharma.png", "Rahul Sharma", "राहुल शर्मा", "12/08/1990", "1234-5678-9012", "110001")
    # 2. Valid PAN
    create_pan("pan_amit_kumar.png", "Amit Kumar", "20/04/1988", "PAN8877665")
    # 3. Bilingual Aadhaar (Fuzzy CBI Watchlist Scenario)
    create_aadhaar("aadhaar_devendra_singh.png", "Devendra Singh", "देवेन्द्र सिंह", "15/01/1982", "5555-6666-7777", "302001")
    # 4. Suspended Passport
    create_passport("passport_viktor_sokolov.png", "Viktor Sokolov", "15 NOV 1978", "P1122334")
    # 5. Tampered Aadhaar (Priya Patel, card says 1985, registry says 1995)
    create_aadhaar("aadhaar_priya_patel_tampered.png", "Priya Patel", "प्रिया पटेल", "05/12/1985", "9876-5432-1098", "380009")
    
    # Generate Selfies
    create_selfie("selfie_rahul_sharma.png", "Rahul Sharma", "MATCH")
    create_selfie("selfie_rahul_sharma_spoof.png", "Rahul Sharma (Spoof/Biometric Mismatch)", "SPOOF")
    create_selfie("selfie_amit_kumar.png", "Amit Kumar", "MATCH")
    create_selfie("selfie_devendra_singh.png", "Devendra Singh", "MATCH")
    create_selfie("selfie_viktor_sokolov.png", "Viktor Sokolov", "MATCH")
    create_selfie("selfie_priya_patel.png", "Priya Patel", "MATCH")
    
    print("All synthetic documents and selfies generated successfully!")
