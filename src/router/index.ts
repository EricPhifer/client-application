import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/apply',
    },
    {
      path: '/apply',
      name: 'Apply',
      component: () => import('@/views/Apply.vue'),
      meta: {
        title: 'Apply - Phifer Web Solutions',
        description: 'Apply to work with Phifer Web Solutions for your web design project.',
      },
    },
    {
      path: '/apply/thank-you',
      name: 'ApplyThankYou',
      component: () => import('@/views/ApplyThankYou.vue'),
      meta: {
        title: 'Thank You - Phifer Web Solutions',
      },
    },
  ],
});

// Update document title on navigation
router.afterEach((to) => {
  if (to.meta.title) {
    document.title = to.meta.title as string;
  }
});

export default router;
