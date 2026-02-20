import { useAuth0 } from '@auth0/auth0-vue';
import { computed } from 'vue';

export function useAuth() {
  const {
    isAuthenticated,
    isLoading,
    user,
    loginWithRedirect,
    logout,
    getAccessTokenSilently,
  } = useAuth0();

  const isAdmin = computed(() => {
    // Phase 2: Check Auth0 user roles/permissions
    return isAuthenticated.value;
  });

  async function getToken(): Promise<string> {
    return await getAccessTokenSilently();
  }

  return {
    isAuthenticated,
    isLoading,
    user,
    isAdmin,
    loginWithRedirect,
    logout: () => logout({ logoutParams: { returnTo: window.location.origin } }),
    getToken,
  };
}
