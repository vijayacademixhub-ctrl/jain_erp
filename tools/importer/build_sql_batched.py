#!/usr/bin/env python3
"""M2 structural loader (batched/compact). Emits set-based idempotent SQL."""
import sys, os, re, json, collections, openpyxl
def P(u,f): return os.path.join(u, next(x for x in os.listdir(u) if x.endswith(f)))
def rows(p,s):
    wb=openpyxl.load_workbook(p,data_only=True,read_only=True); r=[list(x) for x in wb[s].iter_rows(values_only=True)]; wb.close(); return r
def n(s): return re.sub(r'\s+',' ',str(s).strip()) if s is not None else None
def q(s): return "null" if s is None else "'"+str(s).replace("'","''")+"'"
def num(x): return str(int(x)) if isinstance(x,(int,float)) else "null"
def t24(hm):
    h,m=map(int,hm.split(':'));
    if h<7: h+=12
    return f"{h:02d}:{m:02d}:00"
TIMINGS={
 "SHIFT_6TH":{"weekday":[(1,"7:45","8:35"),(2,"8:35","9:25"),(3,"9:55","10:45"),(4,"10:45","11:35"),(5,"11:35","12:20")],
              "saturday":[(1,"7:45","8:30"),(2,"8:30","9:15"),(3,"9:35","10:20"),(4,"10:20","11:05")]},
 "SHIFT_4TH":{"weekday":[(1,"8:45","9:35"),(2,"9:35","10:25"),(3,"11:00","11:50"),(4,"11:50","12:35"),(5,"12:35","1:20")],
              "saturday":[(1,"8:45","9:30"),(2,"9:30","10:15"),(3,"11:00","11:50"),(4,"11:50","12:35")]},
 "SHIFT_2ND":{"weekday":[(1,"11:40","12:30"),(2,"12:35","1:25"),(3,"2:00","2:50"),(4,"2:50","3:40"),(5,"3:40","4:25")],
              "saturday":[(1,"11:00","11:45"),(2,"12:00","12:45"),(3,"12:45","1:30"),(4,"1:30","2:15")]}}
EXPLICIT={'Corporate':'BBA Corporate','Events & Entertainment':'BBA Events, Entertainment & Media Mgmt',
 'Branding & Advertising':'BBA Branding & Advertising','Global Business':'BBA Global Business',
 'Digital Business':'BBA Digital Business','Sports Management':'BBA Sports Management',
 'Strategic Finance (STF)':'BBA Strategic Finance (US CMA)','Finance & Accounting (ACCA)':'BBA Finance & Accounting (ACCA)',
 'Business Analytics & Intelligence':'BBA Business Analytics & Intelligence'}

def main(u,out):
    err=[]
    srows=rows(P(u,"Master_Student_List_Nov2026.xlsx"),"Master_Students")
    sh=srows[0]; pi=sh.index("Programme"); ci=sh.index("Class / Section"); mi=sh.index("Semester")
    mprogs=sorted({n(r[pi]) for r in srows[1:] if r[pi]})
    def pcode(name):
        key=re.sub(r'\(.*?\)','',name).replace("BBA","").strip()
        return "BBA-"+"".join(w[0] for w in re.findall(r'[A-Za-z&]+',key) if w!='&')[:5].upper()
    pc={p:pcode(p) for p in mprogs}
    arows=rows(P(u,"Workload_Template_Updated_2nd_3rd_Year.xlsx"),"Allotment")
    ah=[n(x) for x in arows[0]]; A=lambda nm: ah.index(nm)
    pmap={}
    for ap in sorted({n(r[A("Programme")]) for r in arows[1:] if r[A("Programme")]}):
        if EXPLICIT.get(ap) in mprogs: pmap[ap]=EXPLICIT[ap]
        else: err.append(f"unmapped programme {ap}")
    rrows=rows(P(u,"BBA_Master_Timetable_Even_Sem_2027.xlsx"),"Room Timetable")
    rooms=[]
    for r in rrows[1:]:
        nm=n(r[0])
        if not nm or nm.lower().startswith("room"): continue
        cl=n(r[1]); cmin=cmax=None
        if cl and re.match(r'^\d+\s*-\s*\d+$',cl): x,y=re.split(r'\s*-\s*',cl); cmin,cmax=int(x),int(y)
        elif cl and cl.isdigit(): cmin=cmax=int(cl)
        rooms.append((nm,cl,cmin,cmax))
    fac={}
    for r in rows(P(u,"BBA_Master_Timetable_Even_Sem_2027.xlsx"),"Workload Check")[1:]:
        s=n(r[0])
        if not s or s.lower()=="short": continue
        fac[s]=(s,n(r[1]),r[2] if isinstance(r[2],(int,float)) else None)
    courses={}; subjects=set(); allocs=collections.defaultdict(float)
    for r in arows[1:]:
        if not r[A("Course")]: continue
        c=n(r[A("Course")]); ct=n(r[A("Course type")]); ap=n(r[A("Programme")])
        sc=n(r[A("Short form")]); fn=n(r[A("Full name")]); hrs=r[A("Hours (enter)")]; sem=int(r[A("Semester")])
        mp=pmap.get(ap);
        if not mp: continue
        courses.setdefault(c,(c,ct))
        if sc and sc not in fac: fac[sc]=(sc,fn,None)
        subjects.add((c,mp,sem))
        if sc: allocs[(sc,c,mp,sem)] += (hrs if isinstance(hrs,(int,float)) else 0)
    counts=collections.Counter((n(r[pi]),int(re.match(r'(\d+)',n(r[mi])).group(1)),n(r[ci])) for r in srows[1:] if r[ci])
    sections=[(pc[p],s,l,cnt) for (p,s,l),cnt in sorted(counts.items())]
    for (sc,*_) in allocs:
        if sc not in fac: err.append(f"alloc unknown faculty {sc}")

    def vals(rowsl): return ",\n".join(rowsl)
    L=[]
    L.append("insert into public.departments(code,name) values ('BBA','Bachelor of Business Administration') on conflict(code) do nothing;")
    L.append("insert into public.programmes(department_id,code,name) select d.id,v.code,v.name from (values\n"+
        vals([f"({q(pc[p])},{q(p)})" for p in mprogs])+"\n) v(code,name) cross join public.departments d where d.code='BBA' on conflict(code) do nothing;")
    L.append("insert into public.academic_years(label,starts_on,ends_on) values ('2026-2027','2026-06-01','2027-05-31') on conflict(label) do nothing;")
    L.append("insert into public.semesters(academic_year_id,semester_number) select ay.id,v.s from (values (2),(4),(6)) v(s) cross join public.academic_years ay where ay.label='2026-2027' on conflict(academic_year_id,semester_number) do nothing;")
    L.append("insert into public.shifts(code,name) values ('SHIFT_6TH','6th Sem · Mon-Fri 7:45-12:20'),('SHIFT_4TH','4th Sem · Mon-Fri 8:45-13:20'),('SHIFT_2ND','2nd Sem · Mon-Fri 11:40-16:25') on conflict(code) do nothing;")
    pr=[]
    for sc,days in TIMINGS.items():
        for p in sorted({p for d in days.values() for p,_,_ in d}): pr.append(f"({q(sc)},{p})")
    L.append("insert into public.periods(shift_id,period_number) select s.id,v.p from (values\n"+vals(pr)+"\n) v(code,p) join public.shifts s on s.code=v.code on conflict(shift_id,period_number) do nothing;")
    pt=[]
    for sc,days in TIMINGS.items():
        for day,items in days.items():
            for p,st,en in items: pt.append(f"({q(sc)},{p},{q(day)},'{t24(st)}','{t24(en)}')")
    L.append("insert into public.period_timings(period_id,day_type,start_time,end_time) select pe.id,v.day,v.st::time,v.en::time from (values\n"+vals(pt)+"\n) v(code,p,day,st,en) join public.shifts s on s.code=v.code join public.periods pe on pe.shift_id=s.id and pe.period_number=v.p on conflict(period_id,day_type) do nothing;")
    L.append("insert into public.rooms(room_number,capacity_label,capacity_min,capacity_max) values\n"+
        vals([f"({q(nm)},{q(cl)},{num(cmin)},{num(cmax)})" for nm,cl,cmin,cmax in rooms])+"\non conflict(room_number) do nothing;")
    L.append("insert into public.faculty(short_code,full_name,max_weekly_hours,department_id) select v.sc,v.fn,v.mx,d.id from (values\n"+
        vals([f"({q(s)},{q(f)},{num(m)})" for s,f,m in fac.values()])+"\n) v(sc,fn,mx) cross join public.departments d where d.code='BBA' on conflict(short_code) do nothing;")
    L.append("insert into public.courses(code,name,course_type) values\n"+
        vals([f"({q(c)},{q(c)},{q(ct)})" for c,ct in courses.values()])+"\non conflict(code,name) do nothing;")
    L.append("insert into public.sections(programme_id,semester_id,label,strength) select pr.id,se.id,v.lab,v.st from (values\n"+
        vals([f"({q(pcc)},{s},{q(l)},{cnt})" for pcc,s,l,cnt in sections])+
        "\n) v(pc,sem,lab,st) join public.programmes pr on pr.code=v.pc join public.semesters se on se.semester_number=v.sem join public.academic_years ay on ay.id=se.academic_year_id and ay.label='2026-2027' on conflict(programme_id,semester_id,label) do nothing;")
    L.append("insert into public.subjects(course_id,programme_id,semester_id,short_form) select co.id,pr.id,se.id,v.c from (values\n"+
        vals([f"({q(c)},{q(pc[mp])},{s})" for c,mp,s in sorted(subjects)])+
        "\n) v(c,pc,sem) join public.courses co on co.code=v.c join public.programmes pr on pr.code=v.pc join public.semesters se on se.semester_number=v.sem join public.academic_years ay on ay.id=se.academic_year_id and ay.label='2026-2027' on conflict(course_id,programme_id,semester_id) do nothing;")
    L.append("insert into public.faculty_allocations(faculty_id,subject_id,academic_year_id,planned_hours) select f.id,su.id,ay.id,v.h from (values\n"+
        vals([f"({q(sc)},{q(c)},{q(pc[mp])},{s},{int(h)})" for (sc,c,mp,s),h in sorted(allocs.items())])+
        "\n) v(sc,c,pc,sem,h) join public.faculty f on f.short_code=v.sc join public.academic_years ay on ay.label='2026-2027' join public.programmes pr on pr.code=v.pc join public.semesters se on se.semester_number=v.sem and se.academic_year_id=ay.id join public.subjects su on su.course_id=(select id from public.courses where code=v.c) and su.programme_id=pr.id and su.semester_id=se.id where not exists (select 1 from public.faculty_allocations fa where fa.faculty_id=f.id and fa.subject_id=su.id and fa.academic_year_id=ay.id);")
    sql="\n".join(L)
    open(out+"/load_batched.sql","w").write(sql)
    print("bytes",len(sql),"stmts",len(L),"| programmes",len(mprogs),"rooms",len(rooms),"faculty",len(fac),
          "courses",len(courses),"subjects",len(subjects),"sections",len(sections),"allocations",len(allocs))
    print("ERRORS:", err if err else "none")
main(sys.argv[1], sys.argv[2])
