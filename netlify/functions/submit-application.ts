import type { Handler } from '@netlify/functions';
import { createClient } from '@libsql/client/web';
import { nanoid } from 'nanoid';

const turso = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

interface ApplicationData {
  prospectId?: string;
  organizationName: string;
  contactName: string;
  contactRole: string;
  email: string;
  phone?: string;
  websiteUrl?: string;
  organizationType: string;
  otherOrgType?: string;
  situation: string;
  projectDescription: string;
  budgetRange: string;
  timeline: string;
  previousDesigner: boolean;
  missionStatement: string;
  communityImpact: string;
  impactCategories: string[];
  otherImpact?: string;
  industry: string;
  referralSource?: string;
  referralDetail?: string;
}

interface AutoAssessment {
  greenFlags: string[];
  yellowFlags: string[];
  redFlags: string[];
  recommendation: 'ACCEPT_RECOMMENDED' | 'REVIEW_NEEDED' | 'DECLINE_RECOMMENDED';
  score: number;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const formData: ApplicationData = JSON.parse(event.body || '{}');
    const applicationId = nanoid();
    const now = Date.now();

    // Validate required fields
    const requiredFields = [
      'organizationName', 'contactName', 'contactRole', 'email',
      'organizationType', 'situation', 'projectDescription',
      'budgetRange', 'timeline', 'missionStatement', 'communityImpact',
      'industry',
    ] as const;

    for (const field of requiredFields) {
      if (!formData[field]) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            error: `Missing required field: ${field}`,
            message: 'Please fill out all required fields.',
          }),
        };
      }
    }

    // Validate impact categories (at least one required)
    if (!formData.impactCategories || formData.impactCategories.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Missing impact categories',
          message: 'Please select at least one community impact category.',
        }),
      };
    }

    // Perform auto-assessment
    const autoAssessment = performAutoAssessment(formData);

    // Insert application into database
    await turso.execute({
      sql: `INSERT INTO applications (
        id, created_at, updated_at,
        prospect_id,
        organization_name, contact_name, contact_role, email, phone, website_url,
        organization_type, other_org_type, situation, project_description,
        budget_range, timeline, previous_designer,
        mission_statement, community_impact, impact_categories, other_impact, industry,
        referral_source, referral_detail,
        status, auto_assessment,
        ip_address, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        applicationId, now, now,
        formData.prospectId || null,
        formData.organizationName, formData.contactName, formData.contactRole,
        formData.email, formData.phone || null, formData.websiteUrl || null,
        formData.organizationType, formData.otherOrgType || null,
        formData.situation, formData.projectDescription,
        formData.budgetRange, formData.timeline, formData.previousDesigner,
        formData.missionStatement, formData.communityImpact,
        JSON.stringify(formData.impactCategories), formData.otherImpact || null,
        formData.industry,
        formData.referralSource || null, formData.referralDetail || null,
        'pending', JSON.stringify(autoAssessment),
        event.headers['x-forwarded-for'] || event.headers['client-ip'] || null,
        event.headers['user-agent'] || null,
      ],
    });

    // Update prospect status if applicable
    if (formData.prospectId) {
      await turso.execute({
        sql: `UPDATE prospects
              SET status = 'application_submitted', application_id = ?, updated_at = ?
              WHERE id = ?`,
        args: [applicationId, now, formData.prospectId],
      });
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        applicationId,
        hasHealthCheckCredit: !!formData.prospectId,
      }),
    };
  } catch (error) {
    console.error('Application submission error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        message: 'We encountered an error submitting your application. Please try again or contact us directly.',
      }),
    };
  }
};

function performAutoAssessment(formData: ApplicationData): AutoAssessment {
  const greenFlags: string[] = [];
  const yellowFlags: string[] = [];
  const redFlags: string[] = [];

  // Mission-driven organization check
  const missionDriven = ['church', 'nonprofit', 'author'].includes(
    formData.organizationType.toLowerCase()
  );
  if (missionDriven) {
    greenFlags.push('Mission-driven organization');
  }

  // Budget check
  if (formData.budgetRange === 'under-2000') {
    yellowFlags.push('Budget under $2,000');
  } else if (['2000-5000', '5000-10000', '10000+', 'monthly'].includes(formData.budgetRange)) {
    greenFlags.push('Adequate budget');
  } else if (formData.budgetRange === 'not-sure') {
    yellowFlags.push('Budget uncertain');
  }

  // Timeline check
  if (formData.timeline === 'asap') {
    yellowFlags.push('Urgent timeline (ASAP)');
  } else if (['1-2-months', '3-6-months', 'no-deadline'].includes(formData.timeline)) {
    greenFlags.push('Realistic timeline');
  }

  // Clear project scope check
  if (formData.projectDescription.length >= 100) {
    greenFlags.push('Clear project description');
  } else {
    yellowFlags.push('Vague project description');
  }

  // Community impact check
  if (formData.impactCategories.length >= 2) {
    greenFlags.push('Strong community impact');
  }

  // Ethical industry screening
  const redFlagIndustries = [
    'gambling', 'casino', 'poker', 'betting',
    'adult', 'escort', 'xxx',
    'tobacco', 'vaping', 'cigarette',
    'payday loan', 'title loan', 'cash advance',
    'mlm', 'multi-level', 'pyramid',
    'cryptocurrency', 'crypto', 'nft',
  ];

  const industryLower = formData.industry.toLowerCase();
  const orgTypeLower = formData.organizationType.toLowerCase();
  const descriptionLower = formData.projectDescription.toLowerCase();

  const hasEthicalConcern = redFlagIndustries.some(flag =>
    industryLower.includes(flag) ||
    orgTypeLower.includes(flag) ||
    descriptionLower.includes(flag)
  );

  if (hasEthicalConcern) {
    redFlags.push('Potential ethical concern with industry/business model');
  }

  // Determine recommendation
  let recommendation: AutoAssessment['recommendation'] = 'REVIEW_NEEDED';

  if (redFlags.length > 0) {
    recommendation = 'DECLINE_RECOMMENDED';
  } else if (greenFlags.length >= 3 && yellowFlags.length === 0) {
    recommendation = 'ACCEPT_RECOMMENDED';
  }

  return {
    greenFlags,
    yellowFlags,
    redFlags,
    recommendation,
    score: greenFlags.length - yellowFlags.length - (redFlags.length * 2),
  };
}
