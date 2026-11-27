import { Layout } from '../../components/Layout';
import { TimetableBrowser } from '../../components/TimetableBrowser';
import { CommitteeNav } from '../../components/CommitteeNav';
export default function CommitteeHome() {
  return <Layout title="Timetable Console"><CommitteeNav /><TimetableBrowser /></Layout>;
}
