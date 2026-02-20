import type { Handler } from '@netlify/functions';
import { createClient } from '@libsql/client';
import { Resend } from 'resend';
import { nanoid } from 'nanoid';

const turso = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

const resend = new Resend(process.env.RESEND_API_KEY!);

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

    // Send confirmation email to applicant
    await sendConfirmationEmail(formData, !!formData.prospectId);

    // Send notification email to admin
    await sendAdminNotification(applicationId, formData, autoAssessment);

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

async function sendConfirmationEmail(formData: ApplicationData, hasHealthCheckCredit: boolean) {
  const creditMessage = hasHealthCheckCredit
    ? `<p style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 12px; margin: 20px 0;">
         <strong style="color: #16a34a;">&#10003; Health Check Credit Applied</strong><br>
         <span style="color: #15803d;">Your $49 health check investment will be credited toward your first project if accepted.</span>
       </p>`
    : '';

  await resend.emails.send({
    from: 'Phifer Web Solutions <hello@ericphifer.tech>',
    to: formData.email,
    subject: 'Application Received - Phifer Web Solutions',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #2563eb; margin-bottom: 20px;">Thank you for your application!</h1>

        <p>Hi ${formData.contactName},</p>

        <p>We've received your application for <strong>${formData.organizationName}</strong> and are excited to learn more about your project.</p>

        ${creditMessage}

        <p>We'll review your application and get back to you within <strong>2 business days</strong> with next steps.</p>

        <p>In the meantime, if you have any questions, feel free to reply to this email.</p>

        <p style="margin-top: 30px;">Best regards,<br>
        <strong>Eric Phifer</strong><br>
        Phifer Web Solutions</p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

        <p style="font-size: 14px; color: #6b7280;">
          Phifer Web Solutions<br>
          <a href="https://ericphifer.tech" style="color: #2563eb;">ericphifer.tech</a><br>
          eric@ericphifer.tech
        </p>
      </body>
      </html>
    `,
  });
}

async function sendAdminNotification(
  applicationId: string,
  formData: ApplicationData,
  assessment: AutoAssessment,
) {
  const hasCredit = !!formData.prospectId;
  const creditBadge = hasCredit
    ? '<span style="background: #22c55e; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">$49 CREDIT</span>'
    : '';

  const assessmentColor =
    assessment.recommendation === 'ACCEPT_RECOMMENDED' ? '#22c55e' :
    assessment.recommendation === 'DECLINE_RECOMMENDED' ? '#ef4444' :
    '#f59e0b';

  const flagsList = (flags: string[], color: string) =>
    flags.length > 0
      ? `<ul style="margin: 10px 0; padding-left: 20px;">
           ${flags.map(flag => `<li style="color: ${color};">${flag}</li>`).join('')}
         </ul>`
      : '<p style="color: #9ca3af;">None</p>';

  await resend.emails.send({
    from: 'Applications <applications@ericphifer.tech>',
    to: process.env.ADMIN_EMAIL!,
    subject: `New Application: ${formData.organizationName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1f2937;">New Application Received ${creditBadge}</h2>

        <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Contact Information</h3>
          <p><strong>Organization:</strong> ${formData.organizationName}</p>
          <p><strong>Contact:</strong> ${formData.contactName} (${formData.contactRole})</p>
          <p><strong>Email:</strong> <a href="mailto:${formData.email}">${formData.email}</a></p>
          <p><strong>Phone:</strong> ${formData.phone || 'Not provided'}</p>
          <p><strong>Website:</strong> ${formData.websiteUrl || 'None'}</p>
        </div>

        <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Project Details</h3>
          <p><strong>Organization Type:</strong> ${formData.organizationType}</p>
          <p><strong>Industry:</strong> ${formData.industry}</p>
          <p><strong>Situation:</strong> ${formData.situation}</p>
          <p><strong>Budget:</strong> ${formData.budgetRange}</p>
          <p><strong>Timeline:</strong> ${formData.timeline}</p>
          <p><strong>Previous Designer:</strong> ${formData.previousDesigner ? 'Yes' : 'No'}</p>
        </div>

        <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Mission & Impact</h3>
          <p><strong>Mission:</strong> ${formData.missionStatement}</p>
          <p><strong>Community Impact:</strong> ${formData.communityImpact}</p>
          <p><strong>Impact Categories:</strong> ${formData.impactCategories.join(', ')}</p>
        </div>

        <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Project Description</h3>
          <p style="white-space: pre-wrap;">${formData.projectDescription}</p>
        </div>

        <div style="background: ${assessmentColor}15; border-left: 4px solid ${assessmentColor}; padding: 20px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: ${assessmentColor};">Auto-Assessment: ${assessment.recommendation.replace(/_/g, ' ')}</h3>
          <p><strong>Score:</strong> ${assessment.score}</p>

          <div style="margin: 15px 0;">
            <strong style="color: #22c55e;">Green Flags (${assessment.greenFlags.length}):</strong>
            ${flagsList(assessment.greenFlags, '#22c55e')}
          </div>

          <div style="margin: 15px 0;">
            <strong style="color: #f59e0b;">Yellow Flags (${assessment.yellowFlags.length}):</strong>
            ${flagsList(assessment.yellowFlags, '#f59e0b')}
          </div>

          <div style="margin: 15px 0;">
            <strong style="color: #ef4444;">Red Flags (${assessment.redFlags.length}):</strong>
            ${flagsList(assessment.redFlags, '#ef4444')}
          </div>
        </div>

        <div style="margin-top: 20px;">
          <p><strong>Application ID:</strong> ${applicationId}</p>
          ${hasCredit ? '<p><strong>Health Check Credit:</strong> $49 to be applied to first project</p>' : ''}
          ${formData.referralSource ? `<p><strong>Referral Source:</strong> ${formData.referralSource}${formData.referralDetail ? ` - ${formData.referralDetail}` : ''}</p>` : ''}
        </div>
      </body>
      </html>
    `,
  });
}
