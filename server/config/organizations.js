const ORG_LUC = 'luc';
const ORG_SKILLHUB_TRAINING = 'skillhub_training';
const ORG_SKILLHUB_INSTITUTE = 'skillhub_institute';

const ORGANIZATIONS = [ORG_LUC, ORG_SKILLHUB_TRAINING, ORG_SKILLHUB_INSTITUTE];
const SKILLHUB_ORGS = [ORG_SKILLHUB_TRAINING, ORG_SKILLHUB_INSTITUTE];

const isSkillhub = (org) => SKILLHUB_ORGS.includes(org);
const isLuc = (org) => org === ORG_LUC;

module.exports = {
    ORG_LUC,
    ORG_SKILLHUB_TRAINING,
    ORG_SKILLHUB_INSTITUTE,
    ORGANIZATIONS,
    SKILLHUB_ORGS,
    isSkillhub,
    isLuc,
};
