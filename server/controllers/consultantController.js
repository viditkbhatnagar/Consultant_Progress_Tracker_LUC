const Consultant = require('../models/Consultant');
const User = require('../models/User');

// @desc    Get all consultants
// @route   GET /api/consultants
// @access  Private (Admin/Team Lead)
exports.getConsultants = async (req, res, next) => {
    try {
        let query;

        if (req.user.role === 'team_lead') {
            // Team lead can only see their own consultants
            query = Consultant.find({ teamLead: req.user.id, isActive: true });
        } else if (req.user.role === 'admin') {
            // Admin can see all consultants
            query = Consultant.find();
        } else {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to view consultants',
            });
        }

        const consultants = await query.populate('teamLead', 'name email').sort('name');

        res.status(200).json({
            success: true,
            count: consultants.length,
            data: consultants,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Create new consultant
// @route   POST /api/consultants
// @access  Private (Admin/Team Lead)
exports.createConsultant = async (req, res, next) => {
    try {
        const { name, email, phone, teamName, teamLead } = req.body;

        // Determine team lead ID
        let teamLeadId;
        if (req.user.role === 'team_lead') {
            // Team lead can only create for their own team
            teamLeadId = req.user.id;
            req.body.teamName = req.user.teamName; // Force their own team name
        } else if (req.user.role === 'admin') {
            // Admin can create for any team
            if (!teamLead) {
                return res.status(400).json({
                    success: false,
                    message: 'Please provide team lead ID',
                });
            }
            teamLeadId = teamLead;
        } else {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to create consultants',
            });
        }

        const consultant = await Consultant.create({
            name,
            email,
            phone,
            teamName: req.body.teamName,
            teamLead: teamLeadId,
        });

        res.status(201).json({
            success: true,
            data: consultant,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update consultant
// @route   PUT /api/consultants/:id
// @access  Private (Admin/Team Lead - own consultants only)
exports.updateConsultant = async (req, res, next) => {
    try {
        let consultant = await Consultant.findById(req.params.id);

        if (!consultant) {
            return res.status(404).json({
                success: false,
                message: 'Consultant not found',
            });
        }

        // Check authorization
        if (req.user.role === 'team_lead' && consultant.teamLead.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this consultant',
            });
        }

        // Fields that can be updated
        const fieldsToUpdate = {
            name: req.body.name,
            email: req.body.email,
            phone: req.body.phone,
            isActive: req.body.isActive,
        };

        // Admin can also change team assignment
        if (req.user.role === 'admin') {
            if (req.body.teamName) fieldsToUpdate.teamName = req.body.teamName;
            if (req.body.teamLead) fieldsToUpdate.teamLead = req.body.teamLead;
        }

        consultant = await Consultant.findByIdAndUpdate(
            req.params.id,
            fieldsToUpdate,
            {
                new: true,
                runValidators: true,
            }
        );

        res.status(200).json({
            success: true,
            data: consultant,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete (deactivate) consultant
// @route   DELETE /api/consultants/:id
// @access  Private (Admin/Team Lead - own consultants only)
exports.deleteConsultant = async (req, res, next) => {
    try {
        const consultant = await Consultant.findById(req.params.id);

        if (!consultant) {
            return res.status(404).json({
                success: false,
                message: 'Consultant not found',
            });
        }

        // Check authorization
        if (req.user.role === 'team_lead' && consultant.teamLead.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to delete this consultant',
            });
        }

        // Soft delete - just deactivate
        consultant.isActive = false;
        await consultant.save();

        res.status(200).json({
            success: true,
            data: {},
            message: 'Consultant deactivated successfully',
        });
    } catch (error) {
        next(error);
    }
};
