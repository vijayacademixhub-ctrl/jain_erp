#!/usr/bin/env python3
"""M2 structural loader: reads workbooks, reconciles, emits idempotent load.sql.
No student PII. Faculty = public staff directory. FK resolution via natural-key subselects."""
import sys, os, re, json, collections, openpyxl

def P(u,f): return os.path.join(u, next(x for x in os.listdir(u) if x.endswith(f)))
def rows(p,s):
    wb=openpyxl.load_workbook(p,data_only=True,read_only=True); r=[list(x) for x in wb[s].iter_rows(values_only=True)]; wb.close(); return r
def n(s): return re.sub(r'\s+',' ',str(s).strip()) if s is not None else None
def q(s): return "null" if s is None else "'"+str(s).replace("'","''")+"'"

def t24(hm):
    h,m=map(int,hm.split(':'))
    if h<7: h+=12            # afternoon 1:25 -> 13:25 (anything before 7 is PM here)
    return f"{h:02d}:{m:02d}:00"

# exact per-shift timings read from the master TT (weekday, saturday)
TIMINGS={
 "SHIFT_6TH":{"weekday":[(1,"7:45","8:35"),(2,"8:35","9:25"),(3,"9:55","10:45"),(4,"10:45","11:35"),(5,"11:35","12:20")],
              "saturday":[(1,"7:45","8:30"),(2,"8:30","9:15"),(3,"9:35","10:20"),(4,"10:20","11:05")]},
 "SHIFT_4TH":{"weekday":[(1,"8:45","9:35"),(2,"9:35","10:25"),(3,"11:00","11:50"),(4,"11:50","12:35"),(5,"12:35","1:20")],
              "saturday":[(1,"8:45","9:30"),(2,"9:30","10:15"),(3,"11:00","11:50"),(4,"11:50","12:35")]},
 "SHIFT_2ND":{"weekday":[(1,"11:40","12:30"),(2,"12:35","1:25"),(3,"2:00","2:50"),(4,"2:50","3:40"),(5,"3:40","4:25")],
              "saturday":[(1,"11:00","11:45"),(2,"12:00","12:45"),(3,"12:45","1:30"),(4,"1:30","2:15")]},
}
SEM_SHIFT={6:"SHIFT_6TH",4:"SHIFT_4TH",2:"SHIFT_2ND"}

def main(u,out):
    err=[]
    srows=rows(P(u,"Master_Student_List_Nov2026.xlsx"),"Master_Students")
    sh=srows[0]; pi=sh.index("Programme"); ci=sh.index("Class / Section"); mi=sh.index("Semester")
    mprogs=sorted({n(r[pi]) for r in srows[1:] if r[pi]})
    def pcode(name):
        key=re.sub(r'\(.*?\)','',name).replace("BBA","").strip()
        return "BBA-"+"".join(w[0] for w in re.findall(r'[A-Za-z&]+',key) if w!='&')[:5].upper()
    pcodes={p:pcode(p) for p in mprogs}
    if len(set(pcodes.values()))!=len(pcodes): err.append("prog code collision: "+str(pcodes))

    # allotment programme -> master programme (substring)
    arows=rows(P(u,"Workload_Template_Updated_2nd_3rd_Year.xlsx"),"Allotment")
    ah=[n(x) for x in arows[0]]
    def a(name): return ah.index(name)
    aprogs=sorted({n(r[a("Programme")]) for r in arows[1:] if r[a("Programme")]})
    # Explicit, auditable allotment -> master programme mapping (deterministic).
    EXPLICIT={
      'Corporate':'BBA Corporate',
      'Events & Entertainment':'BBA Events, Entertainment & Media Mgmt',
      'Branding & Advertising':'BBA Branding & Advertising',
      'Global Business':'BBA Global Business',
      'Digital Business':'BBA Digital Business',
      'Sports Management':'BBA Sports Management',
      'Strategic Finance (STF)':'BBA Strategic Finance (US CMA)',
      'Finance & Accounting (ACCA)':'BBA Finance & Accounting (ACCA)',
      'Business Analytics & Intelligence':'BBA Business Analytics & Intelligence',
    }
    pmap={}
    for ap in aprogs:
        if ap in EXPLICIT and EXPLICIT[ap] in mprogs: pmap[ap]=EXPLICIT[ap]
        else: err.append(f"unmapped allotment programme '{ap}'")

    # catalogs
    rrows=rows(P(u,"BBA_Master_Timetable_Even_Sem_2027.xlsx"),"Room Timetable")
    rooms=[]
    for r in rrows[1:]:
        num=n(r[0])
        if not num or num.lower().startswith("room"): continue
        cl=n(r[1]); cmin=cmax=None
        if cl and re.match(r'^\d+\s*-\s*\d+$',cl): x,y=re.split(r'\s*-\s*',cl); cmin,cmax=int(x),int(y)
        elif cl and cl.isdigit(): cmin=cmax=int(cl)
        rooms.append((num,cl,cmin,cmax))
    wrows=rows(P(u,"BBA_Master_Timetable_Even_Sem_2027.xlsx"),"Workload Check")
    fac={}
    for r in wrows[1:]:
        s=n(r[0])
        if not s or s.lower()=="short": continue
        fac[s]=(s,n(r[1]),int(r[2]) if isinstance(r[2],(int,float)) else None)

    courses={}; subjects=set(); allocs=collections.defaultdict(float)
    for r in arows[1:]:
        if not r[a("Course")]: continue
        c=n(r[a("Course")]); ct=n(r[a("Course type")]); ap=n(r[a("Programme")])
        sc=n(r[a("Short form")]); fn=n(r[a("Full name")]); hrs=r[a("Hours (enter)")]; sem=r[a("Semester")]
        mp=pmap.get(ap)
        if not mp: continue
        courses.setdefault(c,(c,c,ct))
        if sc and sc not in fac: fac[sc]=(sc,fn,None)
        subjects.add((c,mp,int(sem)))
        if sc: allocs[(sc,c,mp,int(sem))]+= (hrs if isinstance(hrs,(int,float)) else 0)

    counts=collections.Counter((n(r[pi]),int(re.match(r'(\d+)',n(r[mi])).group(1)),n(r[ci])) for r in srows[1:] if r[ci])
    sections=[(prog,sem,lab,cnt) for (prog,sem,lab),cnt in sorted(counts.items())]

    for (sc,*_ ) in list(allocs):
        if sc not in fac: err.append(f"alloc unknown faculty {sc}")

    # ---- emit SQL ----
    L=["-- M2 structural load (idempotent). Generated; not hand-edited.","begin;"]
    L.append("insert into public.departments(code,name) values('BBA','Bachelor of Business Administration') on conflict(code) do nothing;")
    for p in mprogs:
        L.append(f"insert into public.programmes(department_id,code,name) select id,{q(pcodes[p])},{q(p)} from public.departments where code='BBA' on conflict(code) do nothing;")
    L.append("insert into public.academic_years(label,starts_on,ends_on) values('2026-2027','2026-06-01','2027-05-31') on conflict(label) do nothing;")
    for s in sorted({sem for _,sem,_,_ in sections}):
        L.append(f"insert into public.semesters(academic_year_id,semester_number) select id,{s} from public.academic_years where label='2026-2027' on conflict(academic_year_id,semester_number) do nothing;")
    for code,name in [("SHIFT_6TH","6th Sem · Mon-Fri 7:45-12:20"),("SHIFT_4TH","4th Sem · Mon-Fri 8:45-13:20"),("SHIFT_2ND","2nd Sem · Mon-Fri 11:40-16:25")]:
        L.append(f"insert into public.shifts(code,name) values({q(code)},{q(name)}) on conflict(code) do nothing;")
    for sc,days in TIMINGS.items():
        for pnum in sorted({p for d in days.values() for p,_,_ in d}):
            L.append(f"insert into public.periods(shift_id,period_number) select id,{pnum} from public.shifts where code={q(sc)} on conflict(shift_id,period_number) do nothing;")
        for day,items in days.items():
            for pnum,st,en in items:
                L.append(f"insert into public.period_timings(period_id,day_type,start_time,end_time) select p.id,{q(day)},'{t24(st)}','{t24(en)}' from public.periods p join public.shifts s on s.id=p.shift_id where s.code={q(sc)} and p.period_number={pnum} on conflict(period_id,day_type) do nothing;")
    for num,cl,cmin,cmax in rooms:
        L.append(f"insert into public.rooms(room_number,capacity_label,capacity_min,capacity_max) values({q(num)},{q(cl)},{cmin if cmin is not None else 'null'},{cmax if cmax is not None else 'null'}) on conflict(room_number) do nothing;")
    for s,full,mx in fac.values():
        L.append(f"insert into public.faculty(short_code,full_name,max_weekly_hours,department_id) select {q(s)},{q(full)},{mx if mx is not None else 'null'},(select id from public.departments where code='BBA') on conflict(short_code) do nothing;")
    for c,name,ct in courses.values():
        L.append(f"insert into public.courses(code,name,course_type) values({q(c)},{q(name)},{q(ct)}) on conflict(code,name) do nothing;")
    for prog,sem,lab,cnt in sections:
        L.append(f"insert into public.sections(programme_id,semester_id,label,strength) select pr.id,se.id,{q(lab)},{cnt} from public.programmes pr, public.semesters se join public.academic_years ay on ay.id=se.academic_year_id where pr.code={q(pcodes[prog])} and se.semester_number={sem} and ay.label='2026-2027' on conflict(programme_id,semester_id,label) do nothing;")
    for c,mp,sem in sorted(subjects):
        L.append(f"insert into public.subjects(course_id,programme_id,semester_id,short_form) select co.id,pr.id,se.id,{q(c)} from public.courses co, public.programmes pr, public.semesters se join public.academic_years ay on ay.id=se.academic_year_id where co.code={q(c)} and pr.code={q(pcodes[mp])} and se.semester_number={sem} and ay.label='2026-2027' on conflict(course_id,programme_id,semester_id) do nothing;")
    for (sc,c,mp,sem),hrs in sorted(allocs.items()):
        L.append(f"insert into public.faculty_allocations(faculty_id,subject_id,academic_year_id,planned_hours) select f.id,su.id,ay.id,{int(hrs)} from public.faculty f, public.academic_years ay, public.subjects su join public.courses co on co.id=su.course_id join public.programmes pr on pr.id=su.programme_id join public.semesters se on se.id=su.semester_id where f.short_code={q(sc)} and co.code={q(c)} and pr.code={q(pcodes[mp])} and se.semester_number={sem} and ay.label='2026-2027' and se.academic_year_id=ay.id;")
    L.append("commit;")
    open(out+"/load_structural.sql","w").write("\n".join(L))

    print("COUNTS: programmes",len(mprogs),"semesters",len({s for _,s,_,_ in sections}),
          "rooms",len(rooms),"faculty",len(fac),"courses",len(courses),
          "subjects",len(subjects),"sections",len(sections),"allocations",len(allocs),
          "sql_stmts",len(L))
    print("ERRORS:",err if err else "none")
    print("prog map:", {k:pcodes[v] for k,v in pmap.items()})
    json.dump({"errors":err}, open(out+"/structural_preview.json","w"))

main(sys.argv[1], sys.argv[2])
