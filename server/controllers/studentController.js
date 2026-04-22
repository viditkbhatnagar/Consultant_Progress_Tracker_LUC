const Student = require('../models/Student');
const Consultant = require('../models/Consultant');
const User = require('../models/User');
const { buildScopeFilter, canAccessDoc, resolveOrganization } = require('../middleware/auth');
const { isSkillhub } = require('../config/organizations');

// @desc    Get distinct LUC program names (for the Meeting Tracker dropdown)
// @route   GET /api/students/programs
// @access  Private (Admin/Team Lead)
exports.getPrograms = async (req, res, next) => {
    try {
        const programs = await Student.distinct('program', {
            organization: 'luc',
            program: { $nin: [null, ''] },
        });
        programs.sort((a, b) => a.localeCompare(b));
        res.status(200).json({ success: true, data: programs });
    } catch (error) {
        next(error);
    }
};

// @desc    Get all students
// @route   GET /api/students
// @access  Private (Admin/Team Lead/Manager/Skillhub)
exports.getStudents = async (req, res, next) => {
    try {
        let query;
        const { startDate, endDate, consultant, university, team, month, program, source, conversionOperator, conversionDays, studentStatus, curriculumSlug } = req.query;

        const filter = buildScopeFilter(req);

        if (studentStatus) {
            filter.studentStatus = studentStatus;
        }
        if (curriculumSlug) {
            // Skillhub-only filter: CBSE or IGCSE. Also match legacy records
            // that stored only the full curriculum (e.g. "IGCSE-Cambridge")
            // without the derived slug.
            if (curriculumSlug === 'CBSE') {
                filter.$or = [
                    { curriculumSlug: 'CBSE' },
                    { curriculum: 'CBSE' },
                ];
            } else if (curriculumSlug === 'IGCSE') {
                filter.$or = [
                    { curriculumSlug: 'IGCSE' },
                    { curriculum: { $regex: '^IGCSE', $options: 'i' } },
                ];
            }
        }

        // Date range filter. For Skillhub (identified by curriculumSlug param
        // or explicit skillhub organization scope) we filter by createdAt —
        // Skillhub admissions don't always carry a closingDate. LUC keeps
        // its existing closingDate semantics. endDate is pushed to end-of-day
        // so records created later on that date are still included.
        if (startDate && endDate) {
            const orgScope = filter.organization || req.query.organization;
            const isSkillhubScope =
                curriculumSlug ||
                orgScope === 'skillhub_training' ||
                orgScope === 'skillhub_institute';
            const field = isSkillhubScope ? 'createdAt' : 'closingDate';
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            filter[field] = {
                $gte: new Date(startDate),
                $lte: end,
            };
        }

        // Consultant filter
        if (consultant) {
            filter.consultantName = consultant;
        }

        // University filter
        if (university) {
            filter.university = university;
        }

        // Team filter (for admin only)
        if (team && req.user.role === 'admin') {
            filter.teamName = team;
        }

        // Month filter (supports multiple months, comma-separated)
        if (month) {
            const months = month.split(',');
            filter.month = { $in: months };
        }

        // Program filter
        if (program) {
            filter.program = program;
        }

        // Source filter
        if (source) {
            filter.source = source;
        }

        // Conversion time filter (greater than / less than X days)
        if (conversionOperator && conversionDays) {
            const days = Number(conversionDays);
            if (!isNaN(days)) {
                filter.conversionTime = conversionOperator === 'gt' ? { $gt: days } : { $lt: days };
            }
        }

        // Server-side pagination. Clients can either pass `page`/`limit` (for
        // the paginated Table view) or omit them (for Cards view which fetches
        // everything). Hard cap at 500 so a missing page param can't eat the
        // server; legacy callers that passed nothing still get the full
        // dataset (bounded to 500).
        const rawPage = parseInt(req.query.page, 10);
        const rawLimit = parseInt(req.query.limit, 10);
        const hasPagination = !Number.isNaN(rawPage) || !Number.isNaN(rawLimit);
        const page = Math.max(1, Number.isNaN(rawPage) ? 1 : rawPage);
        const limit = Math.max(1, Math.min(500, Number.isNaN(rawLimit) ? 500 : rawLimit));
        const skip = (page - 1) * limit;

        const [students, total] = await Promise.all([
            Student.find(filter)
                .populate('teamLead', 'name email teamName')
                .populate('consultant', 'name')
                .populate('createdBy', 'name')
                .sort({ closingDate: -1, sno: -1 })
                .skip(skip)
                .limit(limit),
            hasPagination ? Student.countDocuments(filter) : null,
        ]);

        res.status(200).json({
            success: true,
            count: students.length,
            data: students,
            pagination: hasPagination
                ? {
                      page,
                      limit,
                      total,
                      pages: Math.max(1, Math.ceil(total / limit)),
                  }
                : undefined,
        });
    } catch (error) {
        console.error('Error fetching students:', error);
        next(error);
    }
};

// @desc    Get single student
// @route   GET /api/students/:id
// @access  Private (Admin/Team Lead)
exports.getStudent = async (req, res, next) => {
    try {
        const student = await Student.findById(req.params.id)
            .populate('teamLead', 'name email teamName')
            .populate('consultant', 'name')
            .populate('createdBy', 'name');

        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'Student not found',
            });
        }

        if (!canAccessDoc(req.user, student)) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to view this student',
            });
        }

        res.status(200).json({
            success: true,
            data: student,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Create new student
// @route   POST /api/students
// @access  Private (Admin/Team Lead)
exports.createStudent = async (req, res, next) => {
    try {
        const {
            studentName,
            gender,
            phone,
            email,
            program,
            university,
            courseFee,
            admissionFeePaid,
            source,
            referredBy,
            campaignName,
            enquiryDate,
            closingDate,
            consultantName,
            consultantId,
            residence,
            area,
            nationality,
            region,
            companyName,
            designation,
            experience,
            industryType,
            deptType,
            teamLeadId,
        } = req.body;

        // Determine team lead and organization
        let teamLead;
        let teamLeadName;
        let teamName;
        let organization;

        if (req.user.role === 'team_lead' || req.user.role === 'skillhub') {
            teamLead = req.user.id;
            teamLeadName = req.user.name;
            teamName = req.user.teamName;
            organization = req.user.organization;
        } else if (req.user.role === 'admin') {
            if (!teamLeadId) {
                return res.status(400).json({
                    success: false,
                    message: 'Please provide team lead ID',
                });
            }
            const teamLeadUser = await User.findById(teamLeadId);
            if (!teamLeadUser) {
                return res.status(400).json({
                    success: false,
                    message: 'Team lead not found',
                });
            }
            teamLead = teamLeadId;
            teamLeadName = teamLeadUser.name;
            teamName = teamLeadUser.teamName;
            organization = teamLeadUser.organization || resolveOrganization(req);
        } else {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to create students',
            });
        }

        // Get next SNO scoped by org for Skillhub, by team for LUC
        const sno = await Student.getNextSno(teamLead, organization);

        // Create student — allow Skillhub-specific fields to pass through
        const student = await Student.create({
            ...req.body,
            organization,
            sno,
            studentName,
            gender,
            phone,
            email,
            program,
            university,
            courseFee,
            admissionFeePaid: admissionFeePaid || 0,
            source,
            referredBy: referredBy || '',
            campaignName,
            enquiryDate,
            closingDate,
            consultantName,
            consultant: consultantId || null,
            teamLeadName,
            teamLead,
            teamName,
            residence,
            area,
            nationality,
            region,
            companyName,
            designation,
            experience,
            industryType,
            deptType,
            createdBy: req.user.id,
        });

        res.status(201).json({
            success: true,
            data: student,
        });
    } catch (error) {
        console.error('Error creating student:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to create student',
        });
    }
};

// @desc    Update student
// @route   PUT /api/students/:id
// @access  Private (Admin/Team Lead - own team only)
exports.updateStudent = async (req, res, next) => {
    try {
        let student = await Student.findById(req.params.id);

        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'Student not found',
            });
        }

        if (!canAccessDoc(req.user, student)) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this student',
            });
        }

        // Fields that can be updated
        const updateFields = {
            studentName: req.body.studentName,
            gender: req.body.gender,
            phone: req.body.phone,
            email: req.body.email,
            program: req.body.program,
            university: req.body.university,
            courseFee: req.body.courseFee,
            admissionFeePaid: req.body.admissionFeePaid,
            source: req.body.source,
            referredBy: req.body.referredBy,
            campaignName: req.body.campaignName,
            enquiryDate: req.body.enquiryDate,
            closingDate: req.body.closingDate,
            consultantName: req.body.consultantName,
            consultant: req.body.consultantId || undefined,
            residence: req.body.residence,
            area: req.body.area,
            nationality: req.body.nationality,
            region: req.body.region,
            companyName: req.body.companyName,
            designation: req.body.designation,
            experience: req.body.experience,
            industryType: req.body.industryType,
            deptType: req.body.deptType,
        };

        // Remove undefined fields
        Object.keys(updateFields).forEach(key => {
            if (updateFields[key] === undefined) {
                delete updateFields[key];
            }
        });

        // Recalculate conversion time and month if dates changed
        if (updateFields.enquiryDate && updateFields.closingDate) {
            const enquiry = new Date(updateFields.enquiryDate);
            const closing = new Date(updateFields.closingDate);
            const diffTime = Math.abs(closing - enquiry);
            updateFields.conversionTime = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            const months = [
                'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'
            ];
            updateFields.month = months[closing.getMonth()];
        }

        // Admin can also reassign to different team
        if (req.user.role === 'admin' && req.body.teamLeadId) {
            const teamLeadUser = await User.findById(req.body.teamLeadId);
            if (teamLeadUser) {
                updateFields.teamLead = req.body.teamLeadId;
                updateFields.teamLeadName = teamLeadUser.name;
                updateFields.teamName = teamLeadUser.teamName;
            }
        }

        student = await Student.findByIdAndUpdate(
            req.params.id,
            updateFields,
            {
                new: true,
                runValidators: true,
            }
        );

        res.status(200).json({
            success: true,
            data: student,
        });
    } catch (error) {
        console.error('Error updating student:', error);
        next(error);
    }
};

// @desc    Delete student
// @route   DELETE /api/students/:id
// @access  Private (Admin/Team Lead - own team only)
exports.deleteStudent = async (req, res, next) => {
    try {
        const student = await Student.findById(req.params.id);

        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'Student not found',
            });
        }

        if (!canAccessDoc(req.user, student)) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to delete this student',
            });
        }

        await Student.findByIdAndDelete(req.params.id);

        res.status(200).json({
            success: true,
            data: {},
            message: 'Student deleted successfully',
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Mark a Skillhub New Admission as Active
// @route   PATCH /api/students/:id/activate
// @access  Private (Admin/Skillhub)
exports.activateStudent = async (req, res, next) => {
    try {
        const student = await Student.findById(req.params.id);

        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'Student not found',
            });
        }

        if (!canAccessDoc(req.user, student)) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to activate this student',
            });
        }

        if (!isSkillhub(student.organization)) {
            return res.status(400).json({
                success: false,
                message: 'Only Skillhub students can be activated',
            });
        }

        if (student.studentStatus === 'active') {
            return res.status(400).json({
                success: false,
                message: 'Student is already active',
            });
        }

        // Capture extra fields collected at activation time
        const {
            addressEmirate,
            registrationFee,
            dateOfEnrollment,
            emis,
        } = req.body;

        if (addressEmirate !== undefined) student.addressEmirate = addressEmirate;
        if (registrationFee !== undefined) student.registrationFee = registrationFee;
        if (dateOfEnrollment !== undefined) student.dateOfEnrollment = dateOfEnrollment;
        if (Array.isArray(emis)) student.emis = emis;

        student.studentStatus = 'active';
        await student.save();

        res.status(200).json({
            success: true,
            data: student,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Move a Skillhub student to a different status tab.
//          Generic version of /activate — handles any pair of transitions
//          (active ↔ inactive, inactive → new_admission, etc.).
//          The rich activation flow (collecting emirate / registrationFee /
//          dateOfEnrollment / emis) still lives at /activate for the specific
//          new_admission → active case.
// @route   PATCH /api/students/:id/status
// @access  Private (Admin/Skillhub)
exports.changeStudentStatus = async (req, res, next) => {
    try {
        const { studentStatus } = req.body;
        const allowed = ['new_admission', 'active', 'inactive'];
        if (!allowed.includes(studentStatus)) {
            return res.status(400).json({
                success: false,
                message: `studentStatus must be one of: ${allowed.join(', ')}`,
            });
        }

        const student = await Student.findById(req.params.id);
        if (!student) {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }

        if (!canAccessDoc(req.user, student)) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this student',
            });
        }

        if (!isSkillhub(student.organization)) {
            return res.status(400).json({
                success: false,
                message: 'Only Skillhub students support status transitions',
            });
        }

        if (student.studentStatus === studentStatus) {
            return res.status(200).json({ success: true, data: student });
        }

        student.studentStatus = studentStatus;
        await student.save();

        res.status(200).json({ success: true, data: student });
    } catch (error) {
        next(error);
    }
};

// @desc    Get student statistics
// @route   GET /api/students/stats
// @access  Private (Admin/Team Lead/Manager/Skillhub)
//
// Accepts the same filter query-params as GET /api/students so the KPI strip
// on the Student Database page can show "all-time" totals when no filter is
// set and "filtered-window" totals when any filter is applied. Returns an
// `overview` block used by both LUC + Skillhub pages — LUC ignores the
// Skillhub-specific fields (outstanding / paid) and vice versa.
exports.getStudentStats = async (req, res, next) => {
    try {
        const {
            startDate,
            endDate,
            consultant,
            university,
            team,
            month,
            program,
            source,
            conversionOperator,
            conversionDays,
            studentStatus,
            curriculumSlug,
        } = req.query;

        const filter = buildScopeFilter(req);

        if (studentStatus) filter.studentStatus = studentStatus;

        if (curriculumSlug === 'CBSE') {
            filter.$or = [{ curriculumSlug: 'CBSE' }, { curriculum: 'CBSE' }];
        } else if (curriculumSlug === 'IGCSE') {
            filter.$or = [
                { curriculumSlug: 'IGCSE' },
                { curriculum: { $regex: '^IGCSE', $options: 'i' } },
            ];
        }

        if (startDate && endDate) {
            const orgScope = filter.organization || req.query.organization;
            const isSkillhubScope =
                curriculumSlug ||
                orgScope === 'skillhub_training' ||
                orgScope === 'skillhub_institute';
            const field = isSkillhubScope ? 'createdAt' : 'closingDate';
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            filter[field] = { $gte: new Date(startDate), $lte: end };
        }

        if (consultant) filter.consultantName = consultant;
        if (university) filter.university = university;
        if (team && req.user.role === 'admin') filter.teamName = team;
        if (month) {
            const months = month.split(',');
            filter.month = { $in: months };
        }
        if (program) filter.program = program;
        if (source) filter.source = source;
        if (conversionOperator && conversionDays) {
            const days = Number(conversionDays);
            if (!Number.isNaN(days)) {
                filter.conversionTime =
                    conversionOperator === 'gt' ? { $gt: days } : { $lt: days };
            }
        }

        // Single aggregation that computes everything the KPI strip needs.
        // EMI paid amounts live in an array sub-doc so we $map → $sum them
        // before deriving the per-student outstanding.
        const pipeline = [
            { $match: filter },
            {
                $addFields: {
                    emiPaid: {
                        $sum: {
                            $map: {
                                input: { $ifNull: ['$emis', []] },
                                as: 'e',
                                in: { $ifNull: ['$$e.paidAmount', 0] },
                            },
                        },
                    },
                },
            },
            {
                $addFields: {
                    totalPaidPerStudent: {
                        $add: [
                            { $ifNull: ['$admissionFeePaid', 0] },
                            { $ifNull: ['$registrationFee', 0] },
                            '$emiPaid',
                        ],
                    },
                },
            },
            {
                $addFields: {
                    outstandingPerStudent: {
                        $max: [
                            0,
                            {
                                $subtract: [
                                    { $ifNull: ['$courseFee', 0] },
                                    '$totalPaidPerStudent',
                                ],
                            },
                        ],
                    },
                },
            },
            {
                $group: {
                    _id: null,
                    totalStudents: { $sum: 1 },
                    totalRevenue: { $sum: { $ifNull: ['$courseFee', 0] } },
                    totalPaid: { $sum: '$totalPaidPerStudent' },
                    totalOutstanding: { $sum: '$outstandingPerStudent' },
                    avgConversionTime: { $avg: '$conversionTime' },
                    // Min/max of the most meaningful date per org so the KPI
                    // strip can show a live "coverage" sub-label like
                    // "Jan 1, 2020 – today". We surface both closingDate
                    // (LUC) and createdAt (Skillhub) and let the client pick.
                    minClosingDate: { $min: '$closingDate' },
                    maxClosingDate: { $max: '$closingDate' },
                    minCreatedAt: { $min: '$createdAt' },
                    maxCreatedAt: { $max: '$createdAt' },
                    uniqueConsultants: { $addToSet: '$consultantName' },
                    uniqueUniversities: { $addToSet: '$university' },
                },
            },
        ];

        const [agg] = await Student.aggregate(pipeline);
        const overview = agg
            ? {
                  totalStudents: agg.totalStudents || 0,
                  totalRevenue: agg.totalRevenue || 0,
                  totalPaid: agg.totalPaid || 0,
                  totalOutstanding: agg.totalOutstanding || 0,
                  avgConversionTime: agg.avgConversionTime || 0,
                  minClosingDate: agg.minClosingDate || null,
                  maxClosingDate: agg.maxClosingDate || null,
                  minCreatedAt: agg.minCreatedAt || null,
                  maxCreatedAt: agg.maxCreatedAt || null,
                  consultantCount: (agg.uniqueConsultants || []).filter(Boolean).length,
                  universityCount: (agg.uniqueUniversities || []).filter(Boolean).length,
              }
            : {
                  totalStudents: 0,
                  totalRevenue: 0,
                  totalPaid: 0,
                  totalOutstanding: 0,
                  avgConversionTime: 0,
                  minClosingDate: null,
                  maxClosingDate: null,
                  minCreatedAt: null,
                  maxCreatedAt: null,
                  consultantCount: 0,
                  universityCount: 0,
              };

        res.status(200).json({ success: true, data: { overview } });
    } catch (error) {
        next(error);
    }
};
