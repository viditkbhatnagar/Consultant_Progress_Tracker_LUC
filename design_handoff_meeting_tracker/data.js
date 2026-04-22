// Sample data for Meeting Tracker
window.MT_DATA = (function () {
  const students = [
    ["Maria Anastasia", "BSc", "Zoom", "Nivya", "Anousha", "Admission", "Converted — paid in full"],
    ["Rehan Feshihi", "MBA", "Out Meeting", "Arunima", "Anousha", "Warm", "Received documents — waiting on payment"],
    ["Sarbeg Abramian", "MBA", "Out Meeting", "Nivya", "Anousha", "Awaiting", ""],
    ["Sachin Kapoor", "MBA", "Out Meeting", "Arunima", "Anousha", "Admission", "On-spot admission"],
    ["Ajay Vikraman", "MBA", "Out Meeting", "Arunima", "Anousha", "Admission", "On-spot admission"],
    ["Reggie Bance", "MBA", "Out Meeting", "Nivya", "Anousha", "Warm", "Will decide by Friday"],
    ["Orlando Pérez", "MBA", "Out Meeting", "Arunima", "Anousha", "Awaiting", "Docs partially submitted"],
    ["Murtaza Hasan", "BSc", "Zoom", "Arunima", "Anousha", "Admission", "On-spot payment"],
    ["Faizan Ali", "BSc", "Out Meeting", "Arunima", "Anousha", "Awaiting", ""],
    ["Yasmeen Qadri", "MBA", "Zoom", "Arunima", "Anousha", "Awaiting", "Follow up next week"],
    ["Hamzah Qasim Kamil", "BSc", "Zoom", "Nivya", "Anousha", "Lost", "Chose competitor program"],
    ["Jordan Varian Crane", "MBA", "Out Meeting", "Nivya", "Anousha", "Admission", "Meeting done — paid after meeting"],
    ["Muh Sadath", "MBA", "Zoom", "Arunima", "Anousha", "Awaiting", ""],
    ["Priya Raghavan", "BSc", "Zoom", "Nivya", "Karim", "Warm", "Parents need to approve"],
    ["Dmitri Volkov", "MBA", "Out Meeting", "Arunima", "Karim", "Admission", ""],
    ["Leila Hassan", "BSc", "Zoom", "Nivya", "Karim", "Awaiting", "Sent application link"],
    ["Tomás Rivera", "MBA", "Zoom", "Arunima", "Karim", "Warm", "Reviewing financial aid options"],
    ["Aiko Tanaka", "BSc", "Out Meeting", "Nivya", "Karim", "Lost", "Deferred to next intake"],
    ["Kwame Boateng", "MBA", "Zoom", "Arunima", "Karim", "Admission", "Paid tuition deposit"],
    ["Elena Ricci", "BSc", "Out Meeting", "Nivya", "Karim", "Warm", ""],
    ["Noor Saleh", "MBA", "Zoom", "Arunima", "Anousha", "Awaiting", "Scheduled follow-up call"],
    ["Bjorn Eriksen", "BSc", "Zoom", "Nivya", "Karim", "Admission", ""],
    ["Anjali Menon", "MBA", "Out Meeting", "Arunima", "Anousha", "Warm", "Considering two programs"],
    ["Felix Wagner", "BSc", "Zoom", "Nivya", "Karim", "Awaiting", "Transcript pending"]
  ];

  // Dates working backwards from Apr 22 2026
  const baseDay = new Date(2026, 3, 22);
  const rows = students.map((s, i) => {
    const d = new Date(baseDay);
    d.setDate(baseDay.getDate() - Math.floor(i * 0.7));
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return {
      id: "m-" + (1000 + i),
      date: `${dd}/${mm}/${d.getFullYear()}`,
      dateObj: d,
      name: s[0],
      program: s[1],
      mode: s[2],
      consultant: s[3],
      teamLead: s[4],
      status: s[5],
      remarks: s[6]
    };
  });

  return {
    rows,
    statuses: ["Admission", "Warm", "Awaiting", "Lost"],
    consultants: ["Nivya", "Arunima"],
    teamLeads: ["Anousha", "Karim"],
    modes: ["Zoom", "Out Meeting"],
    programs: ["BSc", "MBA"]
  };
})();
