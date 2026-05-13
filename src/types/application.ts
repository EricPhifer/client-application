export interface Prospect {
  id: string;
  created_at: number;
  updated_at: number;
  business_name: string;
  contact_name: string;
  email: string;
  website_url: string;
  source: string;
  status: 'health_check_purchased' | 'application_started' | 'application_submitted' | 'converted_to_client' | 'declined' | 'cold';
  application_id: string | null;
  client_id: string | null;
  converted_at: number | null;
  ip_address: string | null;
  user_agent: string | null;
}

export interface Application {
  id: string;
  created_at: number;
  updated_at: number;
  prospect_id: string | null;
  organization_name: string;
  contact_name: string;
  contact_role: string;
  email: string;
  phone: string | null;
  website_url: string | null;
  organization_type: string;
  other_org_type: string | null;
  situation: string;
  project_description: string;
  budget_range: string;
  timeline: string;
  previous_designer: boolean;
  mission_statement: string;
  community_impact: string;
  impact_categories: string[];
  other_impact: string | null;
  industry: string;
  referral_source: string | null;
  referral_detail: string | null;
  status: 'pending' | 'under_review' | 'accepted' | 'declined';
  auto_assessment: AutoAssessment;
  admin_notes: string | null;
  decision_made_at: number | null;
  decision_by: string | null;
  client_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
}

export interface AutoAssessment {
  greenFlags: string[];
  yellowFlags: string[];
  redFlags: string[];
  recommendation: 'ACCEPT_RECOMMENDED' | 'REVIEW_NEEDED' | 'DECLINE_RECOMMENDED';
  score: number;
  site_function: 'active_tool' | 'credential' | 'unknown';
}

export interface Client {
  id: string;
  created_at: number;
  updated_at: number;
  prospect_id: string | null;
  application_id: string;
  organization_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  primary_website_url: string | null;
  auth0_user_id: string | null;
  service_plan: string | null;
  monthly_rate: number | null;
  contract_start_date: number | null;
  contract_end_date: number | null;
  health_check_credit_applied: boolean;
  health_check_credit_amount: number;
  status: 'active' | 'paused' | 'churned';
}

export interface ApplicationFormData {
  organizationName: string;
  contactName: string;
  contactRole: string;
  email: string;
  phone: string;
  websiteUrl: string;
  organizationType: string;
  otherOrgType: string;
  situation: string;
  sitePurpose: 'search_visibility' | 'conversions' | 'community_updates' | 'credential' | 'other' | '';
  projectDescription: string;
  budgetRange: string;
  timeline: string;
  previousDesigner: boolean | null;
  missionStatement: string;
  communityImpact: string;
  impactCategories: string[];
  otherImpact: string;
  industry: string;
  referralSource: string;
  referralDetail: string;
  pwsConfirm?: string;        // honeypot — should always be empty
  formLoadedAt?: number;      // Unix ms timestamp of when the form loaded
}
