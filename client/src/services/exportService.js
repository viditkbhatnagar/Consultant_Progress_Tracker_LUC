import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { format } from 'date-fns';

// Export commitments to Excel
export const exportCommitmentsToExcel = (commitments, filename = 'commitments') => {
    // Prepare data for export
    const data = commitments.map(commitment => ({
        'Week': commitment.weekNumber,
        'Year': commitment.year,
        'Consultant': commitment.consultant?.name || commitment.consultantName,
        'Team': commitment.teamName,
        'Student Name': commitment.studentName || 'N/A',
        'Day Committed': commitment.dayCommitted,
        'Commitment': commitment.commitmentMade,
        'Lead Stage': commitment.leadStage,
        'Conversion Probability': commitment.conversionProbability + '%',
        'Meetings Done': commitment.meetingsDone || 0,
        'Achievement %': commitment.achievementPercentage || 0,
        'Status': commitment.status,
        'Admission Closed': commitment.admissionClosed ? 'Yes' : 'No',
        'Closed Date': commitment.closedDate ? format(new Date(commitment.closedDate), 'yyyy-MM-dd') : 'N/A',
        'Follow-up Date': commitment.followUpDate ? format(new Date(commitment.followUpDate), 'yyyy-MM-dd') : 'N/A',
        'Corrective Action': commitment.correctiveActionByTL || 'N/A',
        'Prospect Rating': commitment.prospectForWeek || 'N/A',
    }));

    // Create workbook and worksheet
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Commitments');

    // Auto-size columns
    const maxWidth = data.reduce((w, r) => Math.max(w, r['Commitment']?.length || 0), 10);
    worksheet['!cols'] = [
        { wch: 6 },  // Week
        { wch: 6 },  // Year
        { wch: 15 }, // Consultant
        { wch: 15 }, // Team
        { wch: 20 }, // Student Name
        { wch: 10 }, // Day
        { wch: Math.min(maxWidth, 50) }, // Commitment
        { wch: 12 }, // Lead Stage
        { wch: 12 }, // Probability
        { wch: 10 }, // Meetings
        { wch: 10 }, // Achievement
        { wch: 10 }, // Status
        { wch: 12 }, // Closed
        { wch: 12 }, // Closed Date
        { wch: 12 }, // Follow-up
        { wch: 30 }, // Corrective Action
        { wch: 10 }, // Prospect
    ];

    // Generate Excel file
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    saveAs(blob, `${filename}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
};

// Export summary statistics to Excel
export const exportSummaryToExcel = (summaryData, filename = 'summary') => {
    const workbook = XLSX.utils.book_new();

    // Overview sheet
    const overviewData = [
        { Metric: 'Total Commitments', Value: summaryData.totalCommitments },
        { Metric: 'Achieved', Value: summaryData.totalAchieved },
        { Metric: 'Achievement Rate', Value: summaryData.achievementRate + '%' },
        { Metric: 'Total Meetings', Value: summaryData.totalMeetings },
        { Metric: 'Admissions Closed', Value: summaryData.totalClosed },
    ];
    const overviewSheet = XLSX.utils.json_to_sheet(overviewData);
    XLSX.utils.book_append_sheet(workbook, overviewSheet, 'Overview');

    // Consultant performance sheet (if available)
    if (summaryData.consultantStats && summaryData.consultantStats.length > 0) {
        const consultantData = summaryData.consultantStats.map(stat => ({
            'Consultant': stat.consultant.name,
            'Email': stat.consultant.email,
            'Total Commitments': stat.total,
            'Achieved': stat.achieved,
            'Achievement Rate': stat.achievementRate + '%',
            'Meetings': stat.meetings,
            'Closed Admissions': stat.closed,
        }));
        const consultantSheet = XLSX.utils.json_to_sheet(consultantData);
        XLSX.utils.book_append_sheet(workbook, consultantSheet, 'Consultant Performance');
    }

    // Team performance sheet (if available)
    if (summaryData.teamStats && summaryData.teamStats.length > 0) {
        const teamData = summaryData.teamStats.map(stat => ({
            'Team': stat.teamName,
            'Team Lead': stat.teamLead.name,
            'Total Commitments': stat.total,
            'Achieved': stat.achieved,
            'Achievement Rate': stat.achievementRate + '%',
            'Meetings': stat.meetings,
            'Closed Admissions': stat.closed,
        }));
        const teamSheet = XLSX.utils.json_to_sheet(teamData);
        XLSX.utils.book_append_sheet(workbook, teamSheet, 'Team Performance');
    }

    // Generate Excel file
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    saveAs(blob, `${filename}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
};

// Export to CSV
export const exportToCSV = (data, filename = 'export') => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });

    saveAs(blob, `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
};

const exportService = {
    exportCommitmentsToExcel,
    exportSummaryToExcel,
    exportToCSV,
};

export default exportService;
