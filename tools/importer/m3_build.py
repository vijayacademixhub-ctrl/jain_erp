#!/usr/bin/env python3
"""M3 timetable loader. Reads Session List (869), resolves to master data, emits SQL:
 pre (new courses+room+ensure subjects+versions), staging rows, post (entries+entry_sections).
MILES = elective basket -> faculty null (externals added later). Auditorium room created."""
import openpyxl, sys, re, json, collections, os
U, out = sys.argv[1], sys.argv[2]
def Pth(f): return os.path.join(U, next(x for x in os.listdir(U) if x.endswith(f)))
def q(s): return "null" if s is None else "'"+str(s).replace("'","''")+"'"
def norm(s): return re.sub(r'[^A-Z0-9]','',str(s).upper())
COURSES=["Agri Business Marketing/SHRM","Applied Business Intelligence in Management","BE","BOS","Business Decision Through Data Analytics","Business Finance","Compensation Management","CONTEMPORARY ISSUE IN PUBLIC ADMINISTRATION","Corporate Accounting","Cost Analysis for Business Decisions","Digital Marketing","Ecommerce","EPI-LAB","EXIM","FinTech","Global Banking Systems","GLOBAL Intelligence","Global Marketing","Global Strategic Management","GMC","GMS","GST","IKS","INCOME TAX - II","INDIAN BAZAAR","INDIAN CONSTITUTION","International Marketing","INTERNATIONAL Marketing/ International Relations","INTRO TO AI","Language – Additional English","Language – Hindi","Language – Kannada","Language – Sanskrit","Legal Aspects of Workforce","LOGISTICS MANAGEMENT FOR FMB","MM","OB","PC","Performance Management","PROCUREMENT","Procurement And Supplier Management","QTDM","Service Marketing","Strategic Brand Management","Strategic Branding Management","Supply Chain Analytics & Risk Management","Sustainable HR and Wellbeing","TOURISM IN INDIA"]
courseByNorm={norm(c):c for c in COURSES}
ALIAS={'Additional English':'Language – Additional English','Hindi':'Language – Hindi','Kannada':'Language – Kannada','Sanskrit':'Language – Sanskrit','Contemporary Issues in Public Admin':'CONTEMPORARY ISSUE IN PUBLIC ADMINISTRATION','Intl Marketing / Intl Relations':'INTERNATIONAL Marketing/ International Relations'}
NEW_COURSES={'MILES Major 1','MILES Major 2'}
TOKPROG={**{k:'BBA-C' for k in 'ABCDEFGHI'},'BAV':'BBA-BA','BAV-A':'BBA-BA','BAV-B':'BBA-BA','BAI-A':'BBA-BAI','BAI-B':'BBA-BAI','DB':'BBA-DB','EEM':'BBA-EEMM','ENT':'BBA-E','F&A':'BBA-FA','GB':'BBA-GB','SPM':'BBA-SM','STF':'BBA-SF'}
PREFIX={6:'5th',4:'3rd',2:'1st'}; SHIFT={6:'SHIFT_6TH',4:'SHIFT_4TH',2:'SHIFT_2ND'}
TIMELU={}
for sh,dt,hhmm,p in json.load(open(out+"/ref.json"))["timings"]: TIMELU[(sh,dt,hhmm)]=p
def t24(hm):
    h,m=map(int,hm.split(':'))
    if h<7: h+=12
    return f"{h:02d}:{m:02d}"
def course_of(sub):
    if sub in ALIAS: return ALIAS[sub]
    if sub in NEW_COURSES: return sub
    return courseByNorm.get(norm(sub))

wb=openpyxl.load_workbook(Pth("BBA_Master_Timetable_Even_Sem_2027.xlsx"),data_only=True,read_only=True)
ws=wb["Session List"]; rows=[list(r) for r in ws.iter_rows(values_only=True)]; wb.close()
H=rows[0]; C=lambda n:H.index(n); data=[r for r in rows[1:] if r[0]]
staging=[]; need_subjects=set()
for i,r in enumerate(data):
    sem=int(re.match(r'(\d+)',str(r[C("Semester")])).group(1))
    day=str(r[C("Day")]); dt='saturday' if day=='Saturday' else 'weekday'
    start=t24(str(r[C("Time")]).split('-')[0].strip())
    per=TIMELU[(SHIFT[sem],dt,start)]
    sub=str(r[C("Subject")]).strip(); course=course_of(sub)
    fac=str(r[C("Faculty")]).strip() if r[C("Faculty")] else None
    if fac=='MILES': fac=None
    room=str(r[C("Room")]).strip() if r[C("Room")] else None
    if room and room.rstrip('*')=='Auditorium': room='Auditorium'
    toks=[t.strip() for t in re.split(r'\s*/\s*', str(r[C("Section(s)")])) if t.strip()]
    labels=[f"{PREFIX[sem]} {t}" for t in toks]
    pprog=TOKPROG.get(toks[0]) if toks else None
    if course and pprog: need_subjects.add((course,pprog,sem))
    uid=f"SL{i+1:04d}"
    staging.append((uid,sem,day,per,course,fac,room,labels[0] if labels else None,labels))

# PRE
pre=[]
pre.append("insert into public.courses(code,name,course_type) values ('MILES Major 1','MILES Major 1','Elective'),('MILES Major 2','MILES Major 2','Elective') on conflict(code,name) do nothing;")
pre.append("insert into public.rooms(room_number,room_type,bookable) values ('Auditorium','Auditorium',false) on conflict(room_number) do nothing;")
pre.append("insert into public.subjects(course_id,programme_id,semester_id,short_form) select co.id,pr.id,se.id,v.c from (values\n"+
  ",\n".join(f"({q(c)},{q(p)},{s})" for c,p,s in sorted(need_subjects))+
  "\n) v(c,pc,sem) join public.courses co on co.code=v.c join public.programmes pr on pr.code=v.pc join public.semesters se on se.semester_number=v.sem join public.academic_years ay on ay.id=se.academic_year_id and ay.label='2026-2027' on conflict(course_id,programme_id,semester_id) do nothing;")
for sem in (6,4,2):
    pre.append(f"insert into public.timetable_versions(semester_id,academic_year_id,name,status,version_number,published_at) select se.id,ay.id,'Even Sem 2027 Master — {sem}th Sem','published',1,now() from public.semesters se join public.academic_years ay on ay.id=se.academic_year_id where se.semester_number={sem} and ay.label='2026-2027' and not exists (select 1 from public.timetable_versions tv where tv.semester_id=se.id and tv.name='Even Sem 2027 Master — {sem}th Sem');")
open(out+"/m3_pre.sql","w").write("\n".join(pre))

# STAGING (chunked)
head="drop table if exists public.tt_staging; create table public.tt_staging(uid text, sem int, day text, period_number int, course_code text, faculty_short text, room_number text, primary_label text, section_labels text[]);\n"
def row_sql(s):
    uid,sem,day,per,course,fac,room,plab,labels=s
    arr="array["+",".join(q(x) for x in labels)+"]::text[]"
    return f"({q(uid)},{sem},{q(day)},{per},{q(course)},{q(fac)},{q(room)},{q(plab)},{arr})"
chunks=[staging[i:i+300] for i in range(0,len(staging),300)]
for ci,ch in enumerate(chunks):
    body="insert into public.tt_staging(uid,sem,day,period_number,course_code,faculty_short,room_number,primary_label,section_labels) values\n"+",\n".join(row_sql(s) for s in ch)+";"
    open(out+f"/m3_stage_{ci}.sql","w").write((head if ci==0 else "")+body)

# POST
post=[]
post.append("""insert into public.timetable_entries(version_id,subject_id,faculty_id,room_id,period_id,day_of_week,source_ref)
select tv.id, su.id, f.id, rm.id, pe.id, g.day, g.uid
from public.tt_staging g
join public.semesters se on se.semester_number=g.sem
join public.academic_years ay on ay.id=se.academic_year_id and ay.label='2026-2027'
join public.timetable_versions tv on tv.semester_id=se.id and tv.name='Even Sem 2027 Master — '||g.sem||'th Sem'
join public.sections psec on psec.semester_id=se.id and psec.label=g.primary_label
left join public.courses co on co.code=g.course_code
left join public.subjects su on su.course_id=co.id and su.programme_id=psec.programme_id and su.semester_id=se.id
left join public.faculty f on f.short_code=g.faculty_short
left join public.rooms rm on rm.room_number=g.room_number
join public.shifts sh on sh.code=case g.sem when 6 then 'SHIFT_6TH' when 4 then 'SHIFT_4TH' else 'SHIFT_2ND' end
join public.periods pe on pe.shift_id=sh.id and pe.period_number=g.period_number
where not exists (select 1 from public.timetable_entries te where te.source_ref=g.uid);""")
post.append("""insert into public.timetable_entry_sections(entry_id,section_id)
select te.id, s.id
from public.tt_staging g
join public.timetable_entries te on te.source_ref=g.uid
join public.semesters se on se.semester_number=g.sem
join public.academic_years ay on ay.id=se.academic_year_id and ay.label='2026-2027'
cross join lateral unnest(g.section_labels) as lbl
join public.sections s on s.semester_id=se.id and s.label=lbl
on conflict do nothing;""")
post.append("drop table if exists public.tt_staging;")
open(out+"/m3_post.sql","w").write("\n".join(post))

print("sessions",len(staging),"| need_subjects",len(need_subjects),"| staging chunks",len(chunks),
      "| total section links", sum(len(s[8]) for s in staging),
      "| null-faculty(MILES)", sum(1 for s in staging if s[5] is None))
