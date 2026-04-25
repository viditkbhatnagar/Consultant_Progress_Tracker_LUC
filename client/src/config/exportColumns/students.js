import { LUC_COLUMNS, SKILLHUB_STATUS_META } from '../../utils/studentDesign';

// Lift LUC_COLUMNS' export-eligible entries. Special-case `sno`: the model
// field stores the original team-scoped insertion number, which has gaps
// after the LUC zero-fee hide filters out 626 rows. The CEO expects 1..N
// contiguous numbering in both preview and xlsx, so the column renders a
// synthetic counter via `format(_row, i) => i + 1`. The original sno field
// is still on each row doc if a future caller needs it.
export const lucColumns = LUC_COLUMNS
  .filter((c) => c.export)
  .map((c) => {
    const base = {
      key: c.key,
      lbl: c.lbl,
      exportLbl: c.exportLbl,
      date: !!c.date,
      money: !!c.money,
      defaultExport: true,
    };
    if (c.key === 'sno') {
      base.format = (_row, i) => i + 1;
    }
    return base;
  });

export const skillhubColumns = [
  { key: '__row',             lbl: '#',                  format: (_row, i) => i + 1, defaultExport: true },
  { key: 'enrollmentNumber',  lbl: 'Enrollment #',                                    defaultExport: true },
  { key: 'studentName',       lbl: 'Name',                                            defaultExport: true },
  { key: 'school',            lbl: 'School',                                          defaultExport: true },
  { key: 'curriculum',        lbl: 'Curriculum',                                      defaultExport: true },
  { key: 'yearOrGrade',       lbl: 'Year/Grade',                                      defaultExport: true },
  { key: 'academicYear',      lbl: 'Acad. Year',                                      defaultExport: true },
  { key: 'consultantName',    lbl: 'Counselor',                                       defaultExport: true },
  { key: 'mode',              lbl: 'Mode',                                            defaultExport: true },
  { key: 'dateOfEnrollment',  lbl: 'Date of Enrollment', date: true,                  defaultExport: true },
  { key: 'courseFee',         lbl: 'Course Fee (AED)',   money: true,                 defaultExport: true },
  { key: 'outstandingAmount', lbl: 'Outstanding (AED)',  money: true,                 defaultExport: true },
  {
    key: 'studentStatus',
    lbl: 'Status',
    format: (row) => SKILLHUB_STATUS_META[row.studentStatus]?.lbl || row.studentStatus || '',
    defaultExport: true,
  },
  { key: 'leadSource',        lbl: 'Lead Source',                                     defaultExport: true },
  {
    key: 'studentPhone',
    lbl: 'Student Phone',
    format: (row) => row.phones?.student || '',
    defaultExport: true,
  },
  {
    key: 'studentEmail',
    lbl: 'Student Email',
    format: (row) => row.emails?.student || '',
    defaultExport: true,
  },
];

export function defaultsForOrg(org) {
  if (org === 'skillhub_training' || org === 'skillhub_institute') return skillhubColumns;
  return lucColumns;
}

const studentsConfig = { lucColumns, skillhubColumns, defaultsForOrg };
export default studentsConfig;
