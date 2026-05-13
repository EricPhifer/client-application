import type { Handler } from '@netlify/functions';
import { createClient } from '@libsql/client/web';
import { nanoid } from 'nanoid';
import { addAweberTags } from './utils/aweber-tags';

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
  sitePurpose: string;
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
  pws_confirm?: string;
  form_loaded_at?: number;
}

// ============================================
// Bot/Spam Detection Utilities
// ============================================

/**
 * Calculate Shannon entropy (bits per character) for a string.
 * High-entropy strings (random/garbled) score above 3.5 bits/char.
 */
function shannonEntropy(str: string): number {
  if (!str.length) return 0;
  const freq: Record<string, number> = {};
  for (const ch of str) {
    freq[ch] = (freq[ch] || 0) + 1;
  }
  let entropy = 0;
  for (const ch in freq) {
    const p = freq[ch] / str.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

/**
 * A string is high-entropy bot input when ALL of:
 * - length > 10
 * - contains no spaces
 * - Shannon entropy > 3.5 bits/char
 */
function isHighEntropy(str: string): boolean {
  if (!str || str.length <= 10) return false;
  if (str.includes(' ')) return false;
  return shannonEntropy(str) > 3.5;
}

/**
 * Detect suspicious email local parts (the bit before @).
 * Targets common throwaway/burner patterns.
 */
function isSuspiciousEmail(email: string): boolean {
  if (!email || !email.includes('@')) return false;
  const localPart = email.split('@')[0];

  // Length > 40 characters
  if (localPart.length > 40) return true;

  // 4+ consecutive digits anywhere
  if (/\d{4,}/.test(localPart)) return true;

  // 3+ dots in local part
  if ((localPart.match(/\./g) || []).length >= 3) return true;

  // Ends with .digit (e.g., .69)
  if (/\.\d+$/.test(localPart)) return true;

  return false;
}

/**
 * Run all spam signals. Returns the first reason that trips, or null.
 */
function spamCheck(data: ApplicationData): { isSpam: boolean; reason: string } {
  // 1. Honeypot — must be empty
  if (data.pws_confirm && data.pws_confirm.trim().length > 0) {
    return { isSpam: true, reason: 'honeypot_filled' };
  }

  // 2. Submission timing — must be at least 8 seconds after form load
  if (!data.form_loaded_at || typeof data.form_loaded_at !== 'number') {
    return { isSpam: true, reason: 'missing_form_loaded_at' };
  }
  const elapsed = Date.now() - data.form_loaded_at;
  if (elapsed < 8000) {
    return { isSpam: true, reason: `submitted_too_fast_${elapsed}ms` };
  }

  // 3. Input entropy — count high-entropy text fields
  const entropyFields: Array<[string, string]> = [
    ['organization_name', data.organizationName || ''],
    ['contact_name', data.contactName || ''],
    ['project_description', data.projectDescription || ''],
    ['mission_statement', data.missionStatement || ''],
    ['community_impact', data.communityImpact || ''],
  ];
  const failed = entropyFields.filter(([, value]) => isHighEntropy(value));
  if (failed.length >= 2) {
    return {
      isSpam: true,
      reason: `high_entropy_fields:${failed.map(([name]) => name).join(',')}`,
    };
  }

  // 4. Email pattern check
  if (isSuspiciousEmail(data.email || '')) {
    return { isSpam: true, reason: 'suspicious_email_pattern' };
  }

  return { isSpam: false, reason: '' };
}

interface AutoAssessment {
  greenFlags: string[];
  yellowFlags: string[];
  redFlags: string[];
  recommendation: 'ACCEPT_RECOMMENDED' | 'REVIEW_NEEDED' | 'DECLINE_RECOMMENDED';
  score: number;
  site_function: 'active_tool' | 'credential' | 'unknown';
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const formData: ApplicationData = JSON.parse(event.body || '{}');
    const applicationId = nanoid();
    const now = Date.now();

    // Bot/spam screening — runs before validation.
    // On spam detection, return a normal-looking success response and silently
    // drop the submission. Never write to DB, never call AWeber.
    const spam = spamCheck(formData);
    if (spam.isSpam) {
      console.log(
        `[SPAM_BLOCKED] reason=${spam.reason} email=${formData.email || 'none'} ip=${event.headers['x-forwarded-for'] || 'unknown'}`
      );
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          applicationId: nanoid(),
          hasHealthCheckCredit: false,
        }),
      };
    }

    // Validate required fields
    const requiredFields = [
      'organizationName', 'contactName', 'contactRole', 'email',
      'situation', 'sitePurpose', 'projectDescription',
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

    // Update existing client record if email matches (e.g. from health check)
    try {
      const existingClient = await turso.execute({
        sql: 'SELECT id FROM clients WHERE LOWER(email) = LOWER(?)',
        args: [formData.email],
      })
      if (existingClient.rows.length > 0) {
        await turso.execute({
          sql: `UPDATE clients
                SET project_status = 'application',
                    client_category = 'application',
                    updated_at = datetime('now')
                WHERE id = ?`,
          args: [existingClient.rows[0].id],
        })
        console.log(`[Submit Application] Updated existing client ${existingClient.rows[0].id} to application status`)
      }
    } catch (clientErr) {
      console.error('[Submit Application] Failed to update client status (continuing):', clientErr)
    }

    // Tag in AWeber — adds application-submitted, removes lead-captured
    try {
      await addAweberTags(formData.email, ['application-submitted'], formData.contactName)
    } catch (aweberErr) {
      console.error('[Submit Application] Failed to update AWeber tags (continuing):', aweberErr)
    }

    // Notify Client Dashboard for push notifications
    try {
      const webhookSecret = process.env.APPLICATION_WEBHOOK_SECRET
      if (webhookSecret) {
        await fetch('https://isyourwebsitegood.com/.netlify/functions/receive-application-notification', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Secret': webhookSecret,
          },
          body: JSON.stringify({
            organizationName: formData.organizationName,
            contactName: formData.contactName,
            email: formData.email,
            applicationId,
          }),
        })
      }
    } catch (notifyErr) {
      console.error('[Submit Application] Failed to send dashboard notification (continuing):', notifyErr)
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

  // Derive site_function from site_purpose
  const activePurposes = ['search_visibility', 'conversions', 'community_updates'];
  const site_function: 'active_tool' | 'credential' | 'unknown' =
    activePurposes.includes(formData.sitePurpose) ? 'active_tool'
    : formData.sitePurpose === 'credential' ? 'credential'
    : 'unknown';

  // Active site purpose
  if (site_function === 'active_tool') {
    greenFlags.push('Active site purpose (search, conversions, or community updates)');
  }

  // Credential-only purpose + low budget (double signal for Day Rate fit)
  const lowBudget = ['under-2000', 'not-sure'].includes(formData.budgetRange);
  if (site_function === 'credential' && lowBudget) {
    yellowFlags.push('Credential-only site purpose combined with low/uncertain budget — Day Rate likely the right fit');
  }

  // Mission-driven organization check
  const missionDriven = ['church', 'nonprofit', 'author'].includes(
    formData.industry.toLowerCase()
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
  const descriptionLower = formData.projectDescription.toLowerCase();

  const hasEthicalConcern = redFlagIndustries.some(flag =>
    industryLower.includes(flag) ||
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
    site_function,
  };
}
