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
    // Phase 2: Admin dashboard routes (protected by Auth0)
    // {
    //   path: '/admin',
    //   name: 'AdminDashboard',
    //   component: () => import('@/views/admin/Dashboard.vue'),
    //   meta: { requiresAuth: true },
    // },
  ],
});

// Update document title on navigation
router.afterEach((to) => {
  if (to.meta.title) {
    document.title = to.meta.title as string;
  }
});

// Phase 2: Auth guard for admin routes
// router.beforeEach(async (to) => {
//   if (to.meta.requiresAuth) {
//     const { isAuthenticated, loginWithRedirect } = useAuth0();
//     if (!isAuthenticated.value) {
//       await loginWithRedirect({ appState: { targetUrl: to.fullPath } });
//       return false;
//     }
//   }
// });

export default router;
