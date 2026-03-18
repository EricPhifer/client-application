<template>
  <div class="max-w-2xl mx-auto px-4 py-10 md:py-16 text-center">
    <!-- Success Icon -->
    <div class="inline-flex items-center justify-center w-16 h-16 md:w-20 md:h-20 bg-surface rounded-full mb-5 md:mb-6">
      <svg class="w-10 h-10 md:w-12 md:h-12 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
      </svg>
    </div>

    <h1 class="text-2xl md:text-4xl font-bold text-text mb-3 md:mb-4">Application Received!</h1>

    <p class="text-lg md:text-xl text-text-secondary mb-5 md:mb-6">
      Thank you for your interest in working with Phifer Web Solutions.
    </p>

    <div class="bg-surface border border-border rounded-lg p-4 md:p-6 mb-6 md:mb-8 text-left">
      <h2 class="font-semibold text-primary mb-2">What happens next?</h2>
      <ol class="space-y-2 text-sm md:text-base text-text-secondary">
        <li class="flex items-start">
          <span class="font-semibold text-secondary mr-2">1.</span>
          <span>Your application has been received — no further action needed</span>
        </li>
        <li class="flex items-start">
          <span class="font-semibold text-secondary mr-2">2.</span>
          <span>We'll review your application within 2 business days</span>
        </li>
        <li class="flex items-start">
          <span class="font-semibold text-secondary mr-2">3.</span>
          <span>You'll receive an email with our decision and next steps</span>
        </li>
      </ol>
    </div>

    <p class="text-sm md:text-base text-text-secondary mb-6 md:mb-8">
      Questions in the meantime? Feel free to reach out at
      <a href="mailto:eric@ericphifer.tech" class="text-primary hover:text-secondary hover:underline transition-colors">eric@ericphifer.tech</a>
    </p>

    <a
      href="https://phiferwebsolutions.com"
      class="inline-flex items-center text-primary hover:text-secondary font-medium transition-colors"
    >
      Explore Our Work
      <svg class="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
      </svg>
    </a>
  </div>
</template>
