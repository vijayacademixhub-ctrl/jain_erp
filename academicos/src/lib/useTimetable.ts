import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { TimetableRow } from './types';

interface Filter { semester?: number; section?: string; facultyCode?: string; }

export function useTimetable(filter: Filter) {
  const [rows, setRows] = useState<TimetableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(null);
    (async () => {
      let q = supabase.from('v_timetable_display').select('*').eq('version_status', 'published');
      if (filter.semester) q = q.eq('semester_number', filter.semester);
      if (filter.facultyCode) q = q.eq('faculty_code', filter.facultyCode);
      if (filter.section) q = q.contains('sections', [filter.section]);
      const { data, error } = await q;
      if (!active) return;
      if (error) { setError(error.message); setRows([]); }
      else setRows((data ?? []) as TimetableRow[]);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [filter.semester, filter.section, filter.facultyCode]);

  return { rows, loading, error };
}
