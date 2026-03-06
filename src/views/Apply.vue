<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import type { ApplicationFormData } from '@/types/application';

const router = useRouter();
const route = useRoute();

const prospectId = ref<string | null>(route.query.prospect as string || null);
const showHealthCheckCredit = ref(false);
const isSubmitting = ref(false);
const submitError = ref('');

const formData = reactive<ApplicationFormData>({
  organizationName: '',
  contactName: '',
  contactRole: '',
  email: '',
  phone: '',
  websiteUrl: '',
  organizationType: '',
  otherOrgType: '',
  situation: '',
  projectDescription: '',
  budgetRange: '',
  timeline: '',
  previousDesigner: null,
  missionStatement: '',
  communityImpact: '',
  impactCategories: [],
  otherImpact: '',
  industry: '',
  referralSource: '',
  referralDetail: '',
});

// Pre-fill form from prospect data
onMounted(async () => {
  if (prospectId.value) {
    try {
      const response = await fetch(`/.netlify/functions/get-prospect?id=${prospectId.value}`);
      if (response.ok) {
        const prospect = await response.json();

        // Pre-fill form
        formData.organizationName = prospect.business_name;
        formData.contactName = prospect.contact_name;
        formData.email = prospect.email;
        formData.websiteUrl = prospect.website_url;

        // Show credit notice
        showHealthCheckCredit.value = true;
      }
    } catch (error) {
      console.error('Error loading prospect:', error);
    }
  }
});

function normalizeUrl() {
  const url = formData.websiteUrl.trim();
  if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
    formData.websiteUrl = `https://${url}`;
  }
}

async function submitApplication() {
  isSubmitting.value = true;
  submitError.value = '';

  try {
    const response = await fetch('/.netlify/functions/submit-application', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...formData,
        prospectId: prospectId.value,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Submission failed');
    }

    // Redirect to thank you page
    router.push('/thank-you');
  } catch (error) {
    console.error('Submission error:', error);
    submitError.value = error instanceof Error
      ? error.message
      : 'Something went wrong. Please try again.';
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 py-8 md:py-12">
    <!-- Header -->
    <h1 class="text-2xl md:text-4xl font-bold text-text mb-2">Apply to Work With Us</h1>
    <div class="w-12 md:w-16 h-1 bg-accent rounded mb-3 md:mb-4"></div>
    <p class="text-base md:text-lg text-text-secondary mb-6 md:mb-8">
      We partner with mission-driven organizations to create websites that serve their communities.
      Tell us about your project and we'll get back to you within 2 business days.
    </p>

    <!-- Health Check Credit Notice -->
    <div v-if="showHealthCheckCredit" class="bg-surface border border-secondary rounded-lg p-4 mb-8">
      <div class="flex items-start">
        <svg class="w-5 h-5 text-success mt-0.5 mr-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
        </svg>
        <div>
          <p class="font-semibold text-secondary">Health Check Credit Applied</p>
          <p class="text-text-secondary text-sm mt-1">
            Your $49 health check investment will be credited toward your first project if accepted.
          </p>
        </div>
      </div>
    </div>

    <form @submit.prevent="submitApplication" class="space-y-6 md:space-y-10">
      <!-- Section 1: About Your Organization -->
      <section class="bg-surface rounded-xl p-4 md:p-8 space-y-4 md:space-y-6">
        <div class="border-b border-border pb-3">
          <h2 class="text-xl md:text-2xl font-semibold text-primary">About Your Organization</h2>
        </div>

        <div class="grid gap-4 md:gap-6 md:grid-cols-2">
          <div class="md:col-span-2">
            <label for="org-name" class="block text-sm font-medium text-text-secondary mb-2">
              Organization Name <span class="text-error">*</span>
            </label>
            <input
              id="org-name"
              v-model="formData.organizationName"
              type="text"
              required
              class="w-full border border-border rounded-lg px-4 py-2.5 bg-bg text-text placeholder:text-text-muted focus:ring-2 focus:ring-border-focus focus:border-transparent transition-shadow"
              placeholder="Your organization's name"
            />
          </div>

          <div>
            <label for="contact-name" class="block text-sm font-medium text-text-secondary mb-2">
              Your Name <span class="text-error">*</span>
            </label>
            <input
              id="contact-name"
              v-model="formData.contactName"
              type="text"
              required
              class="w-full border border-border rounded-lg px-4 py-2.5 bg-bg text-text placeholder:text-text-muted focus:ring-2 focus:ring-border-focus focus:border-transparent transition-shadow"
              placeholder="First and last name"
            />
          </div>

          <div>
            <label for="contact-role" class="block text-sm font-medium text-text-secondary mb-2">
              Your Role <span class="text-error">*</span>
            </label>
            <input
              id="contact-role"
              v-model="formData.contactRole"
              type="text"
              required
              class="w-full border border-border rounded-lg px-4 py-2.5 bg-bg text-text placeholder:text-text-muted focus:ring-2 focus:ring-border-focus focus:border-transparent transition-shadow"
              placeholder="e.g., Executive Director, Pastor, Owner"
            />
          </div>

          <div>
            <label for="email" class="block text-sm font-medium text-text-secondary mb-2">
              Email Address <span class="text-error">*</span>
            </label>
            <input
              id="email"
              v-model="formData.email"
              type="email"
              required
              class="w-full border border-border rounded-lg px-4 py-2.5 bg-bg text-text placeholder:text-text-muted focus:ring-2 focus:ring-border-focus focus:border-transparent transition-shadow"
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label for="phone" class="block text-sm font-medium text-text-secondary mb-2">
              Phone Number
            </label>
            <input
              id="phone"
              v-model="formData.phone"
              type="tel"
              class="w-full border border-border rounded-lg px-4 py-2.5 bg-bg text-text placeholder:text-text-muted focus:ring-2 focus:ring-border-focus focus:border-transparent transition-shadow"
              placeholder="(555) 555-5555"
            />
          </div>

          <div class="md:col-span-2">
            <label for="website-url" class="block text-sm font-medium text-text-secondary mb-2">
              Current Website URL
            </label>
            <input
              id="website-url"
              v-model="formData.websiteUrl"
              type="text"
              inputmode="url"
              @blur="normalizeUrl"
              class="w-full border border-border rounded-lg px-4 py-2.5 bg-bg text-text placeholder:text-text-muted focus:ring-2 focus:ring-border-focus focus:border-transparent transition-shadow"
              placeholder="yourwebsite.com (leave blank if you don't have one)"
            />
          </div>
        </div>
      </section>

      <!-- Section 2: What You Need -->
      <section class="bg-surface rounded-xl p-4 md:p-8 space-y-4 md:space-y-6">
        <div class="border-b border-border pb-3">
          <h2 class="text-xl md:text-2xl font-semibold text-primary">What You Need</h2>
        </div>

        <div class="space-y-4 md:space-y-6">
          <div>
            <label for="situation" class="block text-sm font-medium text-text-secondary mb-2">
              What best describes your situation? <span class="text-error">*</span>
            </label>
            <select
              id="situation"
              v-model="formData.situation"
              required
              class="w-full border border-border rounded-lg px-4 py-3.5 bg-bg text-text focus:ring-2 focus:ring-border-focus focus:border-transparent transition-shadow"
            >
              <option value="">Select your situation</option>
              <option value="new-website">We need a new website (don't have one)</option>
              <option value="redesign">We need to redesign our existing website</option>
              <option value="maintenance">We need ongoing website support/maintenance</option>
              <option value="not-sure">We're not sure yet</option>
            </select>
          </div>

          <div>
            <label for="project-description" class="block text-sm font-medium text-text-secondary mb-2">
              Tell us about your project <span class="text-error">*</span>
            </label>
            <textarea
              id="project-description"
              v-model="formData.projectDescription"
              required
              rows="5"
              class="w-full border border-border rounded-lg px-4 py-2.5 bg-bg text-text placeholder:text-text-muted focus:ring-2 focus:ring-border-focus focus:border-transparent transition-shadow"
              placeholder="Help us understand what you're hoping to accomplish with your website. (3-5 sentences)"
            ></textarea>
            <p class="text-sm text-text-muted mt-2">
              What are your main goals? Who do you serve? What problems are you trying to solve?
            </p>
          </div>
        </div>
      </section>

      <!-- Section 3: Budget & Timeline -->
      <section class="bg-surface rounded-xl p-4 md:p-8 space-y-4 md:space-y-6">
        <div class="border-b border-border pb-3">
          <h2 class="text-xl md:text-2xl font-semibold text-primary">Budget & Timeline</h2>
        </div>

        <div class="space-y-4 md:space-y-6">
          <div>
            <label for="budget" class="block text-sm font-medium text-text-secondary mb-2">
              What's your budget range for this project? <span class="text-error">*</span>
            </label>
            <select
              id="budget"
              v-model="formData.budgetRange"
              required
              class="w-full border border-border rounded-lg px-4 py-3.5 bg-bg text-text focus:ring-2 focus:ring-border-focus focus:border-transparent transition-shadow"
            >
              <option value="">Select budget range</option>
              <option value="under-2000">Under $2,000</option>
              <option value="2000-5000">$2,000 - $5,000</option>
              <option value="5000-10000">$5,000 - $10,000</option>
              <option value="10000+">$10,000+</option>
              <option value="monthly">Ongoing monthly support ($200-$500/month)</option>
              <option value="not-sure">Not sure yet</option>
            </select>
          </div>

          <div>
            <label for="timeline" class="block text-sm font-medium text-text-secondary mb-2">
              When do you need this completed? <span class="text-error">*</span>
            </label>
            <select
              id="timeline"
              v-model="formData.timeline"
              required
              class="w-full border border-border rounded-lg px-4 py-3.5 bg-bg text-text focus:ring-2 focus:ring-border-focus focus:border-transparent transition-shadow"
            >
              <option value="">Select timeline</option>
              <option value="asap">ASAP (within 2-4 weeks)</option>
              <option value="1-2-months">1-2 months</option>
              <option value="3-6-months">3-6 months</option>
              <option value="no-deadline">No specific deadline</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-text-secondary mb-2">
              Have you worked with a web designer before? <span class="text-error">*</span>
            </label>
            <div class="flex gap-6">
              <label class="flex items-center cursor-pointer">
                <input
                  v-model="formData.previousDesigner"
                  type="radio"
                  :value="true"
                  name="previous-designer"
                  required
                  class="mr-2"
                />
                <span class="text-text">Yes</span>
              </label>
              <label class="flex items-center cursor-pointer">
                <input
                  v-model="formData.previousDesigner"
                  type="radio"
                  :value="false"
                  name="previous-designer"
                  required
                  class="mr-2"
                />
                <span class="text-text">No</span>
              </label>
            </div>
          </div>
        </div>
      </section>

      <!-- Section 4: Mission Alignment -->
      <section class="bg-surface rounded-xl p-4 md:p-8 space-y-4 md:space-y-6">
        <div class="border-b border-border pb-3">
          <h2 class="text-xl md:text-2xl font-semibold text-primary">Your Mission</h2>
          <p class="text-sm text-text-muted mt-2">
            We partner with organizations making a positive impact. Tell us about yours.
          </p>
        </div>

        <div class="space-y-4 md:space-y-6">
          <div>
            <label for="mission" class="block text-sm font-medium text-text-secondary mb-2">
              Describe your mission in one sentence <span class="text-error">*</span>
            </label>
            <input
              id="mission"
              v-model="formData.missionStatement"
              type="text"
              required
              class="w-full border border-border rounded-lg px-4 py-2.5 bg-bg text-text placeholder:text-text-muted focus:ring-2 focus:ring-border-focus focus:border-transparent transition-shadow"
              placeholder="What problem are you solving or who are you serving?"
            />
          </div>

          <div>
            <label for="community-impact" class="block text-sm font-medium text-text-secondary mb-2">
              What positive impact does your organization have on your community? <span class="text-error">*</span>
            </label>
            <textarea
              id="community-impact"
              v-model="formData.communityImpact"
              required
              rows="4"
              class="w-full border border-border rounded-lg px-4 py-2.5 bg-bg text-text placeholder:text-text-muted focus:ring-2 focus:ring-border-focus focus:border-transparent transition-shadow"
              placeholder="e.g., We provide after-school tutoring to kids in under-resourced neighborhoods. Families in our program see measurable improvements in grades and confidence."
            ></textarea>
            <p class="text-sm text-text-muted mt-2">
              No need to be formal. Just tell us who you serve and what changes for them because of your work.
            </p>
          </div>

          <div>
            <label class="block text-sm font-medium text-text-secondary mb-2">
              Please check all that apply to your organization <span class="text-error">*</span>
            </label>
            <div class="space-y-3">
              <label class="flex items-start cursor-pointer">
                <input
                  v-model="formData.impactCategories"
                  type="checkbox"
                  value="vulnerable-populations"
                  class="styled-checkbox mt-0.5 mr-3"
                />
                <span class="text-sm text-text">We serve vulnerable populations</span>
              </label>
              <label class="flex items-start cursor-pointer">
                <input
                  v-model="formData.impactCategories"
                  type="checkbox"
                  value="strengthen-families"
                  class="styled-checkbox mt-0.5 mr-3"
                />
                <span class="text-sm text-text">We strengthen families and relationships</span>
              </label>
              <label class="flex items-start cursor-pointer">
                <input
                  v-model="formData.impactCategories"
                  type="checkbox"
                  value="education"
                  class="styled-checkbox mt-0.5 mr-3"
                />
                <span class="text-sm text-text">We provide education or resources</span>
              </label>
              <label class="flex items-start cursor-pointer">
                <input
                  v-model="formData.impactCategories"
                  type="checkbox"
                  value="community-connections"
                  class="styled-checkbox mt-0.5 mr-3"
                />
                <span class="text-sm text-text">We build community connections</span>
              </label>
              <label class="flex items-start cursor-pointer">
                <input
                  v-model="formData.impactCategories"
                  type="checkbox"
                  value="economic-health"
                  class="styled-checkbox mt-0.5 mr-3"
                />
                <span class="text-sm text-text">We support local economic health</span>
              </label>
              <label class="flex items-start cursor-pointer">
                <input
                  v-model="formData.impactCategories"
                  type="checkbox"
                  value="health-wellness"
                  class="styled-checkbox mt-0.5 mr-3"
                />
                <span class="text-sm text-text">We promote health and wellness</span>
              </label>
              <label class="flex items-start cursor-pointer">
                <input
                  v-model="formData.impactCategories"
                  type="checkbox"
                  value="spiritual-needs"
                  class="styled-checkbox mt-0.5 mr-3"
                />
                <span class="text-sm text-text">We serve spiritual needs</span>
              </label>
              <label class="flex items-start cursor-pointer">
                <input
                  v-model="formData.impactCategories"
                  type="checkbox"
                  value="other"
                  class="styled-checkbox mt-0.5 mr-3"
                />
                <span class="text-sm text-text">Other community benefit</span>
              </label>
            </div>

            <div v-if="formData.impactCategories.includes('other')" class="mt-4">
              <input
                v-model="formData.otherImpact"
                type="text"
                class="w-full border border-border rounded-lg px-4 py-2.5 bg-bg text-text placeholder:text-text-muted focus:ring-2 focus:ring-border-focus focus:border-transparent transition-shadow"
                placeholder="Please describe the community benefit"
              />
            </div>
          </div>

          <div>
            <label for="industry" class="block text-sm font-medium text-text-secondary mb-2">
              What industry best describes your organization? <span class="text-error">*</span>
            </label>
            <select
              id="industry"
              v-model="formData.industry"
              required
              class="w-full border border-border rounded-lg px-4 py-3.5 bg-bg text-text focus:ring-2 focus:ring-border-focus focus:border-transparent transition-shadow"
            >
              <option value="">Select industry</option>
              <option value="church">Church/Religious Organization</option>
              <option value="nonprofit">Nonprofit/Charity</option>
              <option value="author">Author/Speaker</option>
              <option value="hoa">HOA/Community Association</option>
              <option value="healthcare">Healthcare</option>
              <option value="professional-services">Professional Services</option>
              <option value="retail">Retail</option>
              <option value="food-service">Food Service/Restaurant</option>
              <option value="education">Education</option>
              <option value="real-estate">Real Estate</option>
              <option value="home-services">Home Services</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
      </section>

      <!-- Section 5: How Did You Hear About Us -->
      <section class="bg-surface rounded-xl p-4 md:p-8 space-y-4 md:space-y-6">
        <div class="border-b border-border pb-3">
          <h2 class="text-xl md:text-2xl font-semibold text-primary">How Did You Hear About Us?</h2>
        </div>

        <div class="space-y-4 md:space-y-6">
          <div>
            <label for="referral-source" class="block text-sm font-medium text-text-secondary mb-2">
              How did you find Phifer Web Solutions?
            </label>
            <select
              id="referral-source"
              v-model="formData.referralSource"
              class="w-full border border-border rounded-lg px-4 py-3.5 bg-bg text-text focus:ring-2 focus:ring-border-focus focus:border-transparent transition-shadow"
            >
              <option value="">Select source</option>
              <option value="google">Google search</option>
              <option value="referral">Referral from someone</option>
              <option value="previous-client">I'm a previous client</option>
              <option value="social-media">Social media</option>
              <option value="health-check">Through the Health Check tool</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div v-if="formData.referralSource === 'referral'">
            <label for="referral-detail" class="block text-sm font-medium text-text-secondary mb-2">
              Who referred you?
            </label>
            <input
              id="referral-detail"
              v-model="formData.referralDetail"
              type="text"
              class="w-full border border-border rounded-lg px-4 py-2.5 bg-bg text-text placeholder:text-text-muted focus:ring-2 focus:ring-border-focus focus:border-transparent transition-shadow"
              placeholder="Name or organization"
            />
          </div>

          <div v-if="formData.referralSource === 'other'">
            <label for="referral-detail-other" class="block text-sm font-medium text-text-secondary mb-2">
              Please tell us how you found us
            </label>
            <input
              id="referral-detail-other"
              v-model="formData.referralDetail"
              type="text"
              class="w-full border border-border rounded-lg px-4 py-2.5 bg-bg text-text placeholder:text-text-muted focus:ring-2 focus:ring-border-focus focus:border-transparent transition-shadow"
              placeholder="How did you hear about us?"
            />
          </div>
        </div>
      </section>

      <!-- Submit Button -->
      <div class="border-t border-border pt-6">
        <button
          type="submit"
          :disabled="isSubmitting"
          class="w-full md:w-auto bg-btn-primary text-white px-8 py-3 rounded-lg font-semibold hover:bg-btn-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {{ isSubmitting ? 'Submitting...' : 'Submit Application' }}
        </button>

        <p v-if="submitError" class="text-error mt-4 p-4 bg-error/10 border border-error/20 rounded-lg">
          {{ submitError }}
        </p>

        <p class="text-sm text-text-muted mt-4">
          We'll review your application and get back to you within 2 business days.
        </p>
      </div>
    </form>
  </div>
</template>
