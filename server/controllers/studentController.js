const Student = require('../models/Student');
const Consultant = require('../models/Consultant');
const User = require('../models/User');

// @desc    Get all students
// @route   GET /api/students
// @access  Private (Admin/Team Lead)
exports.getStudents = async (req, res, next) => {
    try {
        let query;
        const { startDate, endDate, consultant, university, team, month, program, source, conversionOperator, conversionDays } = req.query;

        // Build filter based on role
        let filter = {};

        if (req.user.role === 'team_lead') {
            // Team lead can only see students from their team
            filter.teamLead = req.user.id;
        }
        // Admin sees all students

        // Date range filter on closing date
        if (startDate && endDate) {
            filter.closingDate = {
                $gte: new Date(startDate),
                $lte: new Date(endDate),
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

        query = Student.find(filter)
            .populate('teamLead', 'name email teamName')
            .populate('consultant', 'name')
            .populate('createdBy', 'name')
            .sort({ closingDate: -1, sno: -1 });

        const students = await query;

        res.status(200).json({
            success: true,
            count: students.length,
            data: students,
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

        // Check authorization
        if (req.user.role === 'team_lead' && student.teamLead._id.toString() !== req.user.id) {
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

        // Determine team lead
        let teamLead;
        let teamLeadName;
        let teamName;

        if (req.user.role === 'team_lead') {
            // Team lead creates for their own team
            teamLead = req.user.id;
            teamLeadName = req.user.name;
            teamName = req.user.teamName;
        } else if (req.user.role === 'admin') {
            // Admin must provide team lead ID
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
        } else {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to create students',
            });
        }

        // Get next SNO for this team
        const sno = await Student.getNextSno(teamLead);

        // Create student
        const student = await Student.create({
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

        // Check authorization
        if (req.user.role === 'team_lead' && student.teamLead.toString() !== req.user.id) {
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

        // Check authorization
        if (req.user.role === 'team_lead' && student.teamLead.toString() !== req.user.id) {
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

// @desc    Get student statistics
// @route   GET /api/students/stats
// @access  Private (Admin/Team Lead)
exports.getStudentStats = async (req, res, next) => {
    try {
        let matchStage = {};

        if (req.user.role === 'team_lead') {
            matchStage.teamLead = req.user._id;
        }

        const stats = await Student.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: null,
                    totalStudents: { $sum: 1 },
                    totalRevenue: { $sum: '$courseFee' },
                    avgConversionTime: { $avg: '$conversionTime' },
                }
            }
        ]);

        // Stats by university
        const universityStats = await Student.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: '$university',
                    count: { $sum: 1 },
                    revenue: { $sum: '$courseFee' },
                }
            },
            { $sort: { count: -1 } }
        ]);

        // Stats by source
        const sourceStats = await Student.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: '$source',
                    count: { $sum: 1 },
                }
            },
            { $sort: { count: -1 } }
        ]);

        // Stats by consultant
        const consultantStats = await Student.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: '$consultantName',
                    count: { $sum: 1 },
                    revenue: { $sum: '$courseFee' },
                }
            },
            { $sort: { count: -1 } }
        ]);

        res.status(200).json({
            success: true,
            data: {
                overview: stats[0] || { totalStudents: 0, totalRevenue: 0, avgConversionTime: 0 },
                byUniversity: universityStats,
                bySource: sourceStats,
                byConsultant: consultantStats,
            },
        });
    } catch (error) {
        next(error);
    }
};
