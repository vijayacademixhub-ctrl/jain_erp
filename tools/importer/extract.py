#!/usr/bin/env python3
"""CMS AcademicOS · M2 structural extractor.
Reads the institutional workbooks, builds normalized master-data catalogs, and prints a
preview with counts and validation errors. Writes catalogs to <out>/catalogs.json.
Student PII is NOT read here (students are a later, authorised step)."""
import sys, json, re, collections
import openpyxl

ROOMS_TT   = "9f38dc8e-BBA_Master_Timetable_Even_Sem_2027.xlsx"   # Room Timetable, Workload Check, Session List
WORKLOAD   = "e78189bf-Workload_Template_Updated_2nd_3rd_Year.xlsx"  # Allotment, Workload, Credits
STUDENTS   = "7d836bbc-Master_Student_List_Nov2026.xlsx"          # sections (from student master, no PII stored)

def ws_rows(path, sheet):
    wb = openpyxl.load_workbook(path, data_only=True, read_only=True)
    ws = wb[sheet]
    rows = [list(r) for r in ws.iter_rows(values_only=True)]
    wb.close()
    return rows

def norm(s):
    return re.sub(r'\s+', ' ', str(s).strip()) if s is not None else None

def main(updir, outdir):
    import os
    def P(f): return os.path.join(updir, next(x for x in os.listdir(updir) if x.endswith(f)))
    errors = []
    cat = {}

    # ---- departments / programmes (from student master Programme column) ----
    srows = ws_rows(P(STUDENTS), "Master_Students")
    shdr = srows[0]
    prog_i = shdr.index("Programme")
    sec_i  = shdr.index("Class / Section")
    sem_i  = shdr.index("Semester")
    yr_i   = shdr.index("Year")
    batch_i= shdr.index("Batch (from USN)")
    programmes = sorted({norm(r[prog_i]) for r in srows[1:] if r[prog_i]})
    cat["departments"] = [{"code":"BBA","name":"Bachelor of Business Administration"}]
    def prog_code(name):
        key = name.replace("BBA","").strip()
        abbr = "".join(w[0] for w in re.findall(r'[A-Za-z]+', key))[:6].upper()
        return "BBA-"+abbr
    cat["programmes"] = [{"code":prog_code(p),"name":p,"department":"BBA"} for p in programmes]

    # ---- academic year / semesters ----
    cat["academic_years"] = [{"label":"2026-2027","starts_on":"2026-06-01","ends_on":"2027-05-31"}]
    sems = sorted({int(re.match(r'(\d+)', norm(r[sem_i])).group(1)) for r in srows[1:] if r[sem_i]})
    cat["semesters"] = [{"academic_year":"2026-2027","semester_number":n} for n in sems]

    # ---- shifts + periods + timings (from Read Me + period pattern) ----
    # Even-sem shifts from the master TT Read Me.
    cat["shifts"] = [
      {"code":"SHIFT_6TH","name":"6th Sem · Mon-Fri 7:45-12:20"},
      {"code":"SHIFT_4TH","name":"4th Sem · Mon-Fri 8:45-13:20"},
      {"code":"SHIFT_2ND","name":"2nd Sem · Mon-Fri 11:40-16:25"},
    ]

    # ---- rooms (Room Timetable sheet) ----
    rrows = ws_rows(P(ROOMS_TT), "Room Timetable")
    rooms = []
    for r in rrows[1:]:
        num = norm(r[0])
        if not num or num.lower().startswith("room"): continue
        caplabel = norm(r[1])
        cmin=cmax=None
        if caplabel and re.match(r'^\d+\s*-\s*\d+$', caplabel):
            a,b = re.split(r'\s*-\s*', caplabel); cmin,cmax=int(a),int(b)
        elif caplabel and caplabel.isdigit():
            cmin=cmax=int(caplabel)
        rooms.append({"room_number":num,"capacity_label":caplabel,"capacity_min":cmin,"capacity_max":cmax})
    cat["rooms"] = rooms

    # ---- faculty (Workload sheet: short, full, max hrs) ----
    wrows = ws_rows(P(ROOMS_TT), "Workload Check")
    faculty = {}
    for r in wrows[1:]:
        short = norm(r[0]); full = norm(r[1]); mx = r[2]
        if not short or short.lower()=="short": continue
        faculty[short] = {"short_code":short,"full_name":full,
                          "max_weekly_hours":int(mx) if isinstance(mx,(int,float)) else None}
    cat["faculty"] = list(faculty.values())

    # ---- courses + subjects + allocations (Allotment sheet) ----
    arows = ws_rows(P(WORKLOAD), "Allotment")
    ahdr = [norm(x) for x in arows[0]]
    def ai(name): return ahdr.index(name)
    courses = {}; allocations = []; alloc_faculty = {}
    for r in arows[1:]:
        if not r[ai("Course")]: continue
        course = norm(r[ai("Course")]); ctype = norm(r[ai("Course type")])
        prog = norm(r[ai("Programme")]); sec = norm(r[ai("Section")])
        short = norm(r[ai("Short form")]); full = norm(r[ai("Full name")]); hrs = r[ai("Hours (enter)")]
        yr = r[ai("Year")]; sem = r[ai("Semester")]
        courses.setdefault(course, {"code":course,"name":course,"course_type":ctype})
        if short and short not in faculty and short not in alloc_faculty:
            alloc_faculty[short] = {"short_code":short,"full_name":full,"max_weekly_hours":None}
        allocations.append({"course":course,"programme":prog,"section":sec,"faculty_short":short,
                            "year":yr,"semester":sem,"planned_hours":hrs})
    cat["courses"] = list(courses.values())
    cat["allocations"] = allocations
    # merge faculty discovered only in allotment
    for s,f in alloc_faculty.items():
        if s not in faculty: cat["faculty"].append(f)

    # ---- sections (authoritative from student master: programme+sem+label+strength) ----
    counts = collections.Counter((norm(r[prog_i]), norm(r[sem_i]), norm(r[sec_i]), norm(r[batch_i]))
                                 for r in srows[1:] if r[sec_i])
    sections = []
    for (prog, semtext, label, batch), n in sorted(counts.items()):
        semnum = int(re.match(r'(\d+)', semtext).group(1))
        sections.append({"programme":prog,"semester_number":semnum,"label":label,
                         "strength":n,"batch":batch})
    cat["sections"] = sections

    # ---- validations ----
    if len({s["code"] for s in cat["programmes"]}) != len(cat["programmes"]):
        errors.append("programme codes not unique after abbreviation")
    if len({r["room_number"] for r in rooms}) != len(rooms):
        errors.append("duplicate room numbers")
    for a in allocations:
        if a["faculty_short"] and a["faculty_short"] not in {f["short_code"] for f in cat["faculty"]}:
            errors.append(f"allocation references unknown faculty {a['faculty_short']}")
    cat["_errors"] = sorted(set(errors))

    with open(outdir+"/catalogs.json","w") as f: json.dump(cat, f, indent=1)

    # ---- preview ----
    print("=== M2 STRUCTURAL PREVIEW ===")
    for k in ["departments","programmes","academic_years","semesters","shifts","rooms",
              "faculty","courses","allocations","sections"]:
        print(f"  {k:14} {len(cat[k])}")
    print(f"  errors        {len(cat['_errors'])}")
    for e in cat["_errors"][:20]: print("    !", e)
    print("\n  programmes:", ", ".join(p["code"] for p in cat["programmes"]))
    print("  sections by sem:", dict(collections.Counter(s['semester_number'] for s in sections)))
    print("  faculty sample:", ", ".join(f["short_code"] for f in cat["faculty"][:12]), "...")
    print("  rooms sample:", ", ".join(r["room_number"] for r in rooms[:12]), "...")

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
